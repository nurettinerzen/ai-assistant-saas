/**
 * Step 5: Build LLM Request
 *
 * - Applies tool gating policy
 * - Builds Gemini request with gated tools
 * - Returns chat session and request configuration
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { convertToolsToGeminiFunctions as convertToolsToGemini } from '../../../services/gemini-utils.js';
import { getEntityClarificationHint, getEntityHint, getEntityMatchType } from '../../../services/entityTopicResolver.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function buildLLMRequest(params) {
  const {
    systemPrompt,
    conversationHistory,
    userMessage,
    classification,
    routingResult,
    state,
    toolsAll,
    metrics,
    assistant,
    business,
    entityResolution
  } = params;

  // STEP 0: Enhance system prompt with known customer info
  // SECURITY: Only send non-PII identifiers to LLM, not actual customer data
  let enhancedSystemPrompt = systemPrompt;
  if (state.extractedSlots && Object.keys(state.extractedSlots).length > 0) {
    const knownInfo = [];
    // Only include identifiers, not actual PII values
    if (state.extractedSlots.customer_name) {
      knownInfo.push(`Customer name mentioned`);
    }
    if (state.extractedSlots.phone) {
      knownInfo.push(`Phone number provided`);
    }
    if (state.extractedSlots.order_number) {
      knownInfo.push(`Order #${state.extractedSlots.order_number}`); // Order number is OK
    }
    if (state.extractedSlots.email) {
      knownInfo.push(`Email mentioned`);
    }

    if (knownInfo.length > 0) {
      enhancedSystemPrompt += `\n\nCustomer Context: ${knownInfo.join(', ')} - Use tools to retrieve actual data`;
      console.log('📝 [BuildLLMRequest] Added context flags (no PII):', knownInfo.length, 'indicators');
    }
  }

  // Callback precondition guidance (belt-and-suspenders with toolLoop precondition check)
  // LLM should ask for name/phone BEFORE calling create_callback
  if (!state.extractedSlots?.customer_name || !state.extractedSlots?.phone) {
    enhancedSystemPrompt += `\n\nKRİTİK: create_callback aracını çağırmadan ÖNCE müşterinin adını ve telefon numarasını öğren. Bu bilgiler olmadan geri arama kaydı oluşturamazsın.`;
  }

  if (state.callbackFlow?.pending || state.activeFlow === 'CALLBACK_REQUEST') {
    enhancedSystemPrompt += `

## CALLBACK AKIŞI (DETERMINISTIC)
- Bu konuşma geri arama talebi akışında.
- SADECE ad-soyad ve telefon bilgisini topla.
- Sipariş numarası, telefon son 4, kimlik doğrulama isteme.
- create_callback çağrısında topic sorusu sorma; topic otomatik üretilecek.
- Ad-soyad ve telefon mevcutsa create_callback çağır, yoksa sadece eksik alanı sor.`;
  }

  // ========================================
  // KB_ONLY MODE: Inject channel restriction prompt
  // ========================================
  if (params.channelMode === 'KB_ONLY') {
    const linksList = Object.entries(params.helpLinks || {})
      .filter(([, v]) => v)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n');

    enhancedSystemPrompt += `

## KB_ONLY MOD (KRİTİK!)
Bu kanal sadece bilgi bankası ve genel yardım için açıktır.

YASAKLAR:
- Kişisel sipariş/ödeme/iade/kargo bilgisi verme
- "Kontrol ediyorum", "bakıyorum" gibi tool varmış gibi davranma
- Sipariş durumu, teslimat tarihi, ödeme tutarı gibi claim yapma
- Link uydurma — sadece aşağıdaki linkleri kullan

${linksList ? `YARDIM LİNKLERİ:\n${linksList}` : 'Link bilgisi yok — "destek ekibimize ulaşabilirsiniz" yönlendirmesi yap.'}

DAVRANIŞ:
- Genel bilgi sorularına (iade süresi, kargo politikası, üyelik) Bilgi Bankası'ndan cevap ver
- Kişisel veri sorusu gelirse: kısa sınır açıkla + yardım linki/destek yönlendirmesi yap
- Doğal ve kısa konuş, robotik olma`;

    console.log('🔒 [BuildLLMRequest] KB_ONLY prompt injected');
  }

  // ========================================
  // ARCHITECTURE CHANGE: Inject verification & dispute context for LLM
  // ========================================
  // LLM now handles verification conversation naturally.
  // We inject context so it knows what's pending.
  // SCOPE: Only inject for flows that actually require PII verification.
  // Stock, product inquiry etc. should NEVER see verification guidance.
  const VERIFICATION_FLOWS = ['ORDER_STATUS', 'DEBT_INQUIRY', 'TRACKING_INFO', 'ACCOUNT_LOOKUP'];
  // Only inject verification guidance if we're actually in a verification-relevant flow.
  // When activeFlow is null (e.g. after post-result reset), also check if there's a recent
  // stock context — if so, this is NOT a verification scenario.
  const hasRecentStockContext = !!state.lastStockContext || state.anchor?.type === 'STOCK';
  const isVerificationRelevant = !hasRecentStockContext &&
    (!state.activeFlow || VERIFICATION_FLOWS.includes(state.activeFlow));

  if (state.verificationContext && isVerificationRelevant) {
    const vc = state.verificationContext;
    const verificationGuidance = `

## DOĞRULAMA DURUMU (Verification Context)
- Durum: ${vc.status}
- Beklenen bilgi: ${vc.pendingField === 'name' ? 'Ad-soyad' : vc.pendingField === 'phone' ? 'Telefon numarası' : vc.pendingField}
- Deneme sayısı: ${vc.attempts}/3

KURALLAR:
- Kullanıcının son mesajını bağlam içinde yorumla
- Eğer kullanıcı doğrulama bilgisi verdiyse, customer_data_lookup tool'unu verification_input parametresiyle çağır
- Eğer kullanıcı farklı bir soru sorduysa, soruyu cevapla ama doğrulama ihtiyacını da hatırlat
- Aynı cümleyi tekrar etme — her seferinde farklı ve doğal konuş
- Yanlış anladığını fark edersen kibarca düzelt
- Form cümleleri KULLANMA — sohbet gibi sor`;

    enhancedSystemPrompt += verificationGuidance;
    console.log('🔐 [BuildLLMRequest] Added verification context for LLM');

    // Clean up - don't persist this context
    delete state.verificationContext;
  } else if (state.verificationContext && !isVerificationRelevant) {
    // Active flow is not verification-relevant (e.g., stock) — skip and clean up
    console.log(`🚫 [BuildLLMRequest] Skipped verification context — activeFlow="${state.activeFlow}" not in VERIFICATION_FLOWS`);
    delete state.verificationContext;
  }

  // Dispute context — LLM has anchor/truth data to reference
  if (state.disputeContext) {
    const dc = state.disputeContext;
    const disputeGuidance = `

## İTİRAZ BAĞLAMI (Dispute Context)
Kullanıcı önceki sonucu reddediyor/itiraz ediyor.
- Önceki akış: ${dc.originalFlow || 'bilinmiyor'}
- Kargo takip bilgisi var mı: ${dc.hasTrackingInfo ? 'EVET' : 'HAYIR'}

KURALLAR:
- Kullanıcının itirazını ciddiye al
- Elindeki bilgileri (varsa kargo takip no) doğal dille paylaş
- Geri arama teklif et
- Empati kur, "ama sistem şunu söylüyor" gibi savunmacı olma`;

    enhancedSystemPrompt += disputeGuidance;
    console.log('⚠️ [BuildLLMRequest] Added dispute context for LLM');

    // Clean up
    delete state.disputeContext;
  }

  // Profanity strike context — LLM handles warning naturally
  if (routingResult?.routing?.routing?.profanityStrike) {
    const strike = routingResult.routing.routing.profanityStrike;
    const profanityGuidance = `

## KÜFÜR UYARISI
Kullanıcı saygısız dil kullandı (${strike}. uyarı / 3 üzerinden).
- Kibarca uyar ama suçlama
- Yardım etmeye devam et
- Doğal ve empatik ol`;

    enhancedSystemPrompt += profanityGuidance;
    console.log(`⚠️ [BuildLLMRequest] Added profanity context (strike ${strike}/3)`);
  }

  if (routingResult?.isKbOnlyRedirect && routingResult?.kbOnlyRedirect) {
    const category = routingResult.kbOnlyRedirect.category || 'UNKNOWN';
    const variables = routingResult.kbOnlyRedirect.variables || {};
    enhancedSystemPrompt += `

## KB_ONLY REDIRECT CONTEXT
- category: ${category}
- supportLink: ${variables.supportLink || '-'}
- trackingLink: ${variables.trackingLink || '-'}
- returnLink: ${variables.returnLink || '-'}
- paymentLink: ${variables.paymentLink || '-'}

KURAL:
- Hesap/siparişe özel işlem yapma.
- Kısa, net bir yönlendirme ver.
- Tek bir güvenli sonraki adım öner.`;
    console.log('🔒 [BuildLLMRequest] Added KB_ONLY redirect context');
  }

  // Entity resolver output is structural hint only; LLM decides final wording.
  const resolverMatchType = getEntityMatchType(entityResolution);
  const resolverEntityHint = getEntityHint(entityResolution);
  const resolverClarificationHint = getEntityClarificationHint(entityResolution);
  if (resolverMatchType !== 'NONE' || entityResolution?.needsClarification) {
    enhancedSystemPrompt += `

## ENTITY RESOLVER HINT (STRUCTURED, NO DIRECT REPLY)
- matchType: ${resolverMatchType}
- entityHint: ${resolverEntityHint || '-'}
- confidence: ${entityResolution?.confidence ?? 0}
- needsClarification: ${entityResolution?.needsClarification ? 'YES' : 'NO'}
- clarificationQuestionHint: ${resolverClarificationHint || '-'}

KURAL:
- Resolver sonucu SADECE bağlam ipucudur, cevabı sen üretirsin.
- needsClarification=YES ise TEK bir netleştirme sorusu sor.
- OUT_OF_SCOPE ise işletme kapsamına nazikçe geri yönlendir.
- FUZZY_MATCH ise "${resolverEntityHint || 'bu varlık'}" için doğrulayıcı kısa soru sor.`;
    console.log('🧭 [BuildLLMRequest] Added structured entity resolver hint');
  }

  // STEP 0.5: CHATTER messages — LLM short response mode (always LLM)
  const isChatterRoute = routingResult?.isChatter || routingResult?.routing?.routing?.action === 'ACKNOWLEDGE_CHATTER';
  const chatterDirective = routingResult?.chatterDirective;

  if (chatterDirective) {
    const assistantName = assistant?.name || 'Asistan';
    const businessName = business?.name || '';

    enhancedSystemPrompt += `

## CHATTER KISA YANIT MODU (LLM Directive)
- Rolün: ${businessName ? businessName + ' şirketinin' : 'şirketin'} müşteri asistanı ${assistantName}
- Mesaj türü: ${chatterDirective.kind} (greeting/thanks/generic)
- Konuşma durumu: ${chatterDirective.flowStatus}
- Aktif görev var mı: ${chatterDirective.activeTask ? 'EVET — ' + (chatterDirective.activeFlow || 'devam eden iş') : 'HAYIR'}
- Doğrulama bekleniyor mu: ${chatterDirective.verificationPending ? 'EVET' : 'HAYIR'}

KURALLAR:
- Selam/teşekküre kısa ve doğal cevap ver.
- Cevabı 1-2 cümle ile sınırla (${chatterDirective.maxSentences} cümleyi aşma).
- Kısa selamdan sonra en fazla 1 net takip sorusu sor.
- Aktif görev varsa soruyu o göreve geri bağla.
- Backend şablonlarını tekrar etme, cevabı doğal varyasyonla kendin üret.`;
    console.log('💬 [BuildLLMRequest] CHATTER — LLM directive mode active');
  } else if (isChatterRoute) {
    const assistantName = assistant?.name || 'Asistan';
    const businessName = business?.name || '';
    const activeFlowSummary = state.activeFlow || state.flowStatus || 'none';
    const hasPendingVerification = state.verification?.status === 'pending';

    enhancedSystemPrompt += `

## CHATTER KISA YANIT MODU
- Rolün: ${businessName ? businessName + ' şirketinin' : 'şirketin'} müşteri asistanı ${assistantName}
- Konuşma durumu: ${activeFlowSummary}
- Doğrulama bekleniyor mu: ${hasPendingVerification ? 'EVET' : 'HAYIR'}

KURALLAR:
- Selam/teşekküre kısa ve doğal cevap ver, robotik kalıp kullanma.
- Cevabı 1-2 cümlede tut.
- Kısa selamdan sonra en fazla 1 net takip sorusu sor.
- Eğer konuşmada aktif bir görev varsa (ör: sipariş, doğrulama), soruyu göreve geri bağla.`;
    console.log('💬 [BuildLLMRequest] CHATTER — context-preserving guidance aktif');
  }

  // ========================================
  // STOCK QUERY: Disambiguation & Disclosure Policy
  // ========================================
  // Inject instructions so LLM handles multi-match stock queries correctly
  // and never reveals raw stock quantities.
  enhancedSystemPrompt += `

## STOK SORGUSU KURALLARI

1. Tool "MULTIPLE_CANDIDATES" döndüğünde: stok durumu hakkında konuşma, önce ürünü netleştir. Tekrar tool çağırırken aday listesindeki tam ürün adını kullan.
2. Stok adedi (kaç adet/tane) ASLA paylaşılmaz. Sadece "stokta mevcut / sınırlı stok / stokta yok" bilgisi verilir.
3. Müşteri "kaç tane var?" diye sorarsa: kesin adet verilemeyeceğini söyle, ama belirli bir miktar ihtiyacı varsa kontrol edebileceğini belirt.
4. requested_qty parametresi SADECE müşteri açık bir sayı söylediğinde doldurulur. "Kaç tane var?" gibi genel sorularda BOŞ bırakılır.
5. Tool yanıtındaki quantity_check sonucunu kullan, kendi başına adet uydurma.`;

  const classifierConfidence = classification?.confidence || 0.9;

  enhancedSystemPrompt += `

## TOOL KULLANIM KURALI (LLM AUTHORITY)
- Tool kullanmadan doğru ve güvenli cevap verebiliyorsan tool ÇAĞIRMA.
- Tool gerekiyorsa önce minimum eksik bilgiyi TEK kısa soruyla iste.
- Eksik bilgi tamamlanmadan tool çağırma.
- Tool sonucu olmadan hesap/sipariş/kişisel claim üretme.`;

  // LLM decides whether to call tools; backend only passes allowlisted tools.
  const allToolNames = toolsAll.map(t => t.function?.name).filter(Boolean);
  const gatedTools = allToolNames;
  metrics.toolDecisionMode = 'llm_authority_allowlist_only';
  console.log('🔧 [BuildLLMRequest] Allowlist tools passed to LLM:', {
    count: gatedTools.length,
    names: gatedTools
  });

  // STEP 2: Filter tools based on gated list
  // toolsAll is in OpenAI format: {type: 'function', function: {name, description, parameters}}
  const allowedToolObjects = toolsAll.filter(tool =>
    gatedTools.includes(tool.function?.name)
  );

  // STEP 3: Convert tools to Gemini format
  const geminiTools = allowedToolObjects.length > 0
    ? convertToolsToGemini(allowedToolObjects)
    : [];

  // STEP 4: Build conversation history for Gemini
  const geminiHistory = conversationHistory.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  // STEP 5: Create Gemini chat session
  // Chatter-specific budget: lower tokens + temperature for cost/latency savings
  const isChatterLLM = !!chatterDirective;
  const generationConfig = isChatterLLM
    ? {
        temperature: 0.5,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 200,
        thinkingConfig: { thinkingBudget: 0 }
      }
    : {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 1024,
        thinkingConfig: { thinkingBudget: 0 }
      };

  if (isChatterLLM) {
    console.log('💬 [BuildLLMRequest] CHATTER budget: maxOutputTokens=200, temperature=0.5');
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: enhancedSystemPrompt,
    tools: geminiTools.length > 0 ? [{ functionDeclarations: geminiTools }] : undefined,
    toolConfig: geminiTools.length > 0 ? {
      functionCallingConfig: {
        mode: 'AUTO'
      }
    } : undefined,
    generationConfig
  });

  const chat = model.startChat({
    history: geminiHistory
  });

  // STEP 6: Track gated tools in state (telemetry only, NOT used as input for next turn)
  // P0-FIX: Removed state.allowedTools feedback loop — was causing tools gated out once
  // to stay gated forever. Gating now always evaluates from full toolsAll set.
  state._lastGatedTools = gatedTools; // Underscore prefix = telemetry-only, not used as input

  return {
    chat,
    gatedTools,
    hasTools: gatedTools.length > 0,
    model,
    confidence: classifierConfidence
  };
}

export default { buildLLMRequest };

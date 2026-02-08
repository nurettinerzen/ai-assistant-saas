/**
 * Step 5: Build LLM Request
 *
 * - Applies tool gating policy
 * - Builds Gemini request with gated tools
 * - Returns chat session and request configuration
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { applyToolGatingPolicy } from '../../../policies/toolGatingPolicy.js';
import { convertToolsToGeminiFunctions as convertToolsToGemini } from '../../../services/gemini-utils.js';

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
    business
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

  // ========================================
  // ARCHITECTURE CHANGE: Inject verification & dispute context for LLM
  // ========================================
  // LLM now handles verification conversation naturally.
  // We inject context so it knows what's pending.
  if (state.verificationContext) {
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
- Yanlış anladığını fark edersen "Sanırım bir karışıklık oldu..." diyebilirsin
- "Lütfen ad-soyadınızı yazınız" gibi form cümleleri KULLANMA`;

    enhancedSystemPrompt += verificationGuidance;
    console.log('🔐 [BuildLLMRequest] Added verification context for LLM');

    // Clean up - don't persist this context
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

  // STEP 0.5: CHATTER messages — CONTEXT-PRESERVING PROMPT
  // When chatterDirective is present (LLM mode), use directive-driven prompt.
  // Otherwise (legacy direct template mode that reached here), use generic chatter guidance.
  const isChatterRoute = routingResult?.isChatter || routingResult?.routing?.routing?.action === 'ACKNOWLEDGE_CHATTER';
  const chatterDirective = routingResult?.chatterDirective;

  if (chatterDirective) {
    // ── LLM directive mode (flag ON) ──
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
- Selam/teşekküre kısa ve doğal cevap ver, robotik kalıp kullanma.
- Maksimum ${chatterDirective.maxSentences} cümle yaz.
- "Size nasıl yardımcı olabilirim?" veya benzer klişe yardım cümlelerini TEKRARLAMA.
- Eğer aktif görev varsa, kısa yanıt sonrası göreve nazikçe geri dön.
- Kullanıcı net bir talep vermediyse tek cümlelik sıcak bir karşılık ver.

TON KISITLAMALARI:
- Satış dili kullanma (no_salesy). "Harika fırsatlar", "kaçırma" gibi ifadeler YASAK.
- Garip veya aşırı samimi selamlaşmalardan kaçın (no_weird_greetings). "Canım müşterim", "tatlım" gibi ifadeler YASAK.
- Aşırı dostane/informal olma (no_overfriendly). Profesyonel ama sıcak bir ton koru.
- Önceki selamlaşmayı birebir tekrarlama, ama tutarlı bir ton ve üslup koru.`;
    console.log('💬 [BuildLLMRequest] CHATTER — LLM directive mode active');
  } else if (isChatterRoute) {
    // ── Legacy mode (flag OFF, but reached LLM for some reason) ──
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
- Eğer konuşmada aktif bir görev varsa (ör: sipariş, doğrulama), kısa yanıt sonrası göreve nazikçe geri dön.
- "Size nasıl yardımcı olabilirim?" cümlesini her selamda tekrarlama.
- Kullanıcı net bir talep vermediyse tek cümlelik sıcak bir karşılık ver.`;
    console.log('💬 [BuildLLMRequest] CHATTER — context-preserving guidance aktif');
  }

  // STEP 1: Apply tool gating policy
  const classifierConfidence = classification?.confidence || 0.9;

  // OPTIMIZATION: Skip tools entirely for CHATTER messages (greetings, acknowledgments)
  // This saves ~5000 tokens per CHATTER turn and reduces latency
  const isChatter = routingResult?.isChatter || routingResult?.routing?.routing?.action === 'ACKNOWLEDGE_CHATTER';

  let gatedTools;
  if (isChatter) {
    gatedTools = [];
    console.log('💬 [BuildLLMRequest] CHATTER detected — skipping all tools (0 token overhead)');
  } else {
    // If no flow-specific tools, use ALL available tools (extract names from toolsAll)
    const allToolNames = toolsAll.map(t => t.function?.name).filter(Boolean);
    console.log('🔧 [BuildLLMRequest] toolsAll:', { count: toolsAll.length, names: allToolNames });

    const flowTools = (state.allowedTools && state.allowedTools.length > 0)
      ? state.allowedTools
      : allToolNames;

    gatedTools = applyToolGatingPolicy({
      confidence: classifierConfidence,
      activeFlow: state.activeFlow,
      allowedTools: flowTools,
      verificationStatus: state.verificationStatus,
      metrics
    });

    console.log('🔧 [BuildLLMRequest]:', {
      originalTools: flowTools.length,
      gatedTools: gatedTools.length,
      confidence: classifierConfidence.toFixed(2),
      removed: flowTools.filter(t => !gatedTools.includes(t))
    });
  }

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

  // STEP 6: Update state with gated tools
  state.allowedTools = gatedTools;

  return {
    chat,
    gatedTools,
    hasTools: gatedTools.length > 0,
    model,
    confidence: classifierConfidence
  };
}

export default { buildLLMRequest };

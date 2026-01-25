/**
 * Action Claim Validator
 *
 * PROBLEM: AI says "I will create a request" but doesn't call any tool.
 * SOLUTION: Enforce that action claims must be backed by actual tool calls.
 *
 * This prevents hallucinated actions like:
 * - "Talebinizi oluşturdum" (without calling create_callback)
 * - "Kaydınızı açtım" (without any tool)
 * - "Durumu hızlandırıyorum" (without action)
 */

// Action verbs that indicate the AI is claiming to take an action
const ACTION_VERBS_TR = [
  // Create/Open
  'oluşturdum', 'oluşturuyorum', 'oluşturacağım',
  'açtım', 'açıyorum', 'açacağım',
  'yarattım', 'yaratıyorum', 'yaratacağım',

  // Start/Begin
  'başlattım', 'başlatıyorum', 'başlatacağım',
  'başladım', 'başlıyorum', 'başlayacağım',

  // Communicate/Forward
  'ilettim', 'iletiyorum', 'ileteceğim',
  'aktardım', 'aktarıyorum', 'aktaracağım',
  'bildirdim', 'bildiriyorum', 'bildireceğim',
  'gönderdim', 'gönderiyorum', 'göndereceğim',

  // Contact/Discuss
  'görüştüm', 'görüşüyorum', 'görüşeceğim',
  'konuştum', 'konuşuyorum', 'konuşacağım',
  'aradım', 'arıyorum', 'arayacağım',

  // Save/Record
  'kaydettim', 'kaydediyorum', 'kaydedeceğim',
  'not aldım', 'not alıyorum', 'not alacağım',

  // Expedite/Accelerate
  'hızlandırdım', 'hızlandırıyorum', 'hızlandıracağım',
  'ivedi hale getirdim', 'ivedi yapıyorum',
  'önceliklendirdim', 'önceliklendiriyorum',

  // Complete/Finish
  'tamamladım', 'tamamlıyorum', 'tamamlayacağım',
  'bitirdim', 'bitiriyorum', 'bitireceğim',

  // General action
  'yaptım', 'yapıyorum', 'yapacağım',
  'hallettim', 'hallediyo rum', 'halledeceğim'
];

const ACTION_VERBS_EN = [
  'created', 'creating', 'will create',
  'opened', 'opening', 'will open',
  'started', 'starting', 'will start',
  'sent', 'sending', 'will send',
  'contacted', 'contacting', 'will contact',
  'saved', 'saving', 'will save',
  'scheduled', 'scheduling', 'will schedule',
  'forwarded', 'forwarding', 'will forward',
  'expedited', 'expediting', 'will expedite',
  'completed', 'completing', 'will complete'
];

// Exception phrases that are OK even without tool calls
const ALLOWED_FUTURE_CLAIMS_TR = [
  'hemen bir talep oluşturup',  // "I will create a request" is OK if followed by actual promise
  'ilgili birimle görüşeceğim',  // Promise for future action
  'sizin için',                  // "for you" indicates future
  'adınıza',                     // "on your behalf" indicates future
];

const ALLOWED_FUTURE_CLAIMS_EN = [
  'will create a request',
  'will contact',
  'for you',
  'on your behalf',
];

/**
 * Check if AI response claims to have taken an action
 * @param {string} text - AI response text
 * @param {string} language - Language code ('TR' or 'EN')
 * @returns {Object} { hasClaim: boolean, claimedAction: string|null }
 */
export function detectActionClaim(text, language = 'TR') {
  if (!text) return { hasClaim: false, claimedAction: null };

  const lowerText = text.toLowerCase();
  const actionVerbs = language === 'TR' ? ACTION_VERBS_TR : ACTION_VERBS_EN;
  const allowedClaims = language === 'TR' ? ALLOWED_FUTURE_CLAIMS_TR : ALLOWED_FUTURE_CLAIMS_EN;

  // Check if any allowed future claim is present (these are OK without tools)
  for (const allowedPhrase of allowedClaims) {
    if (lowerText.includes(allowedPhrase.toLowerCase())) {
      return { hasClaim: false, claimedAction: null }; // It's a promise, not a claim
    }
  }

  // Check for action verbs
  for (const verb of actionVerbs) {
    if (lowerText.includes(verb)) {
      return { hasClaim: true, claimedAction: verb };
    }
  }

  return { hasClaim: false, claimedAction: null };
}

/**
 * Validate that action claims are backed by tool calls
 *
 * @param {string} responseText - AI response text
 * @param {boolean} hadToolCalls - Whether any tools were called during this turn
 * @param {string} language - Language code
 * @returns {Object} { valid: boolean, error: string|null, correctionPrompt: string|null }
 */
export function validateActionClaim(responseText, hadToolCalls, language = 'TR') {
  const claim = detectActionClaim(responseText, language);

  if (!claim.hasClaim) {
    // No action claim detected - all good
    return { valid: true, error: null, correctionPrompt: null };
  }

  if (hadToolCalls) {
    // Action claim is backed by tool call - all good
    return { valid: true, error: null, correctionPrompt: null };
  }

  // ❌ VIOLATION: AI claimed action but didn't call any tool
  const error = language === 'TR'
    ? `AI bir aksiyon iddiasında bulundu ("${claim.claimedAction}") ama hiçbir tool çağırmadı.`
    : `AI claimed an action ("${claim.claimedAction}") but didn't call any tool.`;

  const correctionPrompt = language === 'TR'
    ? `SEN BİR TOOL ÇAĞIRMADAN "talebinizi oluşturdum / kaydettim / başlattım" gibi cümleler KURMA.

Eğer gerçekten bir aksiyon yapacaksan (örn. callback talebi):
1. create_callback tool'unu ÇAĞIR
2. Tool'dan aldığın referans numarasını kullan
3. "Talebiniz oluşturuldu, referans: CB-12345" de

Eğer tool çağıramazsan:
1. Sadece empati göster
2. Müşteri hizmetlerine yönlendir
3. "Talebinizi oluşturdum" gibi YANILTICI cümleler KULLANMA

Şimdi yanıtını düzelt - ya tool çağır ya da aksiyon iddiasını kaldır.`
    : `DO NOT use phrases like "I created / I opened / I started" without actually calling a tool.

If you want to take action (e.g., create callback):
1. CALL the create_callback tool
2. Use the reference number from tool response
3. Say "Request created, reference: CB-12345"

If you cannot call a tool:
1. Just show empathy
2. Direct to customer service
3. DO NOT use misleading phrases like "I created your request"

Now correct your response - either call a tool or remove the action claim.`;

  return {
    valid: false,
    error,
    correctionPrompt
  };
}

/**
 * Check if a response should trigger required tool call
 * Based on flow policy
 *
 * @param {string} flowName - Current flow name (e.g., 'COMPLAINT')
 * @param {boolean} hadToolCalls - Whether tools were called
 * @returns {Object} { valid: boolean, requiredTool: string|null, message: string|null }
 */
export function validateFlowToolPolicy(flowName, hadToolCalls) {
  // Flow-specific policies
  const FLOW_TOOL_POLICIES = {
    'COMPLAINT': {
      requiredTool: 'create_callback',
      reason: 'Complaints must create a callback request'
    }
  };

  const policy = FLOW_TOOL_POLICIES[flowName];

  if (!policy) {
    // No policy for this flow - all good
    return { valid: true, requiredTool: null, message: null };
  }

  if (hadToolCalls) {
    // Tool was called - all good
    return { valid: true, requiredTool: null, message: null };
  }

  // ❌ VIOLATION: Flow requires tool but none was called
  return {
    valid: false,
    requiredTool: policy.requiredTool,
    message: `Flow "${flowName}" requires calling "${policy.requiredTool}" tool. ${policy.reason}.`
  };
}

export default {
  detectActionClaim,
  validateActionClaim,
  validateFlowToolPolicy
};

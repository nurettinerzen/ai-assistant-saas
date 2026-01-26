# Backend Slot Collection Solution

## Problem
LLM was asking for customer information (name, phone) even when it was already provided earlier in the conversation and stored in `extractedSlots`.

**Root Cause**: LLM can't see `extractedSlots` - it only exists in backend state, not in conversation history or system prompt.

## Solution (Backend-Controlled)

User explicitly requested: **"backendde cozmemiz lazim bunu, llm'e birakamayiz"** (solve in backend, can't leave to LLM)

### Implementation (4 Steps)

#### 1. Backend Slot Collection
**File**: `backend/src/core/orchestrator/steps/04_routerDecision.js`
**Lines**: 12-48

For `CALLBACK_REQUEST` intent:
- Check required slots: `customer_name`, `phone`
- If missing: Return direct response with single question
- If complete: Set `state.forceToolCall` flag

```javascript
if (classification.type === 'CALLBACK_REQUEST') {
  const extractedSlots = state.extractedSlots || {};
  const requiredSlots = ['customer_name', 'phone'];
  const missing = requiredSlots.filter(slot => !extractedSlots[slot]);

  if (missing.length > 0) {
    // Ask for missing slot (only one question)
    const missingSlot = missing[0];
    const question = missingSlot === 'customer_name'
      ? (language === 'TR' ? 'Adınız ve soyadınız nedir?' : 'What is your full name?')
      : (language === 'TR' ? 'Telefon numaranız nedir?' : 'What is your phone number?');

    return {
      directResponse: true,
      reply: question,
      forceEnd: false,
      metadata: {
        type: 'CALLBACK_SLOT_COLLECTION',
        missingSlot,
        remainingSlots: missing
      }
    };
  } else {
    // All slots ready - FORCE TOOL CALL
    state.forceToolCall = {
      tool: 'create_callback',
      args: {} // Args will be filled by argumentNormalizer
    };
  }
}
```

#### 2. Force Tool Call
**File**: `backend/src/core/orchestrator/steps/06_toolLoop.js`
**Lines**: 63-101

When `state.forceToolCall` is set:
- Skip LLM entirely
- Execute tool directly with extractedSlots
- Return canned response

```javascript
if (state.forceToolCall) {
  const { tool: toolName, args: forcedArgs } = state.forceToolCall;
  console.log(`🔧 [ToolLoop] FORCE TOOL CALL: ${toolName}`);

  toolsCalled.push(toolName);

  // Execute tool
  const toolResult = await executeTool(toolName, forcedArgs, business, {
    state,
    language,
    sessionId,
    messageId,
    channel,
    conversationHistory,
    extractedSlots: state.extractedSlots || {}
  });

  // Clear force flag
  delete state.forceToolCall;

  if (toolResult.outcome === 'OK') {
    hadToolSuccess = true;
    responseText = toolResult.message || (language === 'TR'
      ? 'Talebiniz alındı, en kısa sürede size dönüş yapacağız.'
      : 'Your request has been received, we will get back to you shortly.');
  } else {
    hadToolFailure = true;
    failedTool = toolName;
    responseText = toolResult.message || (language === 'TR'
      ? 'İşlem sırasında bir sorun oluştu.'
      : 'An error occurred during processing.');
  }

  return {
    reply: responseText,
    inputTokens: 0, // No LLM call
    outputTokens: 0,
    hadToolSuccess,
    hadToolFailure,
    failedTool,
    toolsCalled,
    iterations: 1,
    chat: null
  };
}
```

#### 3. System Prompt Enhancement
**File**: `backend/src/core/orchestrator/steps/05_buildLLMRequest.js`
**Lines**: 26-48

Add minimal "Known Info" line to system prompt (NOT JSON format):

```javascript
// STEP 0: Enhance system prompt with known customer info
let enhancedSystemPrompt = systemPrompt;
if (state.extractedSlots && Object.keys(state.extractedSlots).length > 0) {
  const knownInfo = [];
  if (state.extractedSlots.customer_name) {
    knownInfo.push(`Name: ${state.extractedSlots.customer_name}`);
  }
  if (state.extractedSlots.phone) {
    knownInfo.push(`Phone: ${state.extractedSlots.phone}`);
  }
  if (state.extractedSlots.order_number) {
    knownInfo.push(`Order: ${state.extractedSlots.order_number}`);
  }
  if (state.extractedSlots.email) {
    knownInfo.push(`Email: ${state.extractedSlots.email}`);
  }

  if (knownInfo.length > 0) {
    enhancedSystemPrompt += `\n\nKnown Customer Info: ${knownInfo.join(', ')}`;
    console.log('📝 [BuildLLMRequest] Added Known Info to prompt:', knownInfo.join(', '));
  }
}
```

Then use `enhancedSystemPrompt` instead of `systemPrompt` at line 70.

#### 4. History Truncation Check
**Files Checked**:
- `backend/src/core/orchestrator/steps/02_prepareContext.js` (lines 61-67)
- `backend/src/core/orchestrator/steps/08_persistAndMetrics.js` (lines 60-84)
- `backend/prisma/schema.prisma` (ChatLog model)

**Result**: ✅ No truncation found
- ChatLog.messages is `Json?` type (unlimited size)
- prepareContext loads full history without truncation
- persistAndMetrics appends all messages without limit

## Flow Diagram

### Before (Broken UX)
```
User: "yöneticiyle görüşmek istiyorum"
Classifier: CALLBACK_REQUEST, extractedSlots: {}
LLM: "Adınız nedir?"
User: "Ahmet Yılmaz"
Classifier: CALLBACK_REQUEST, extractedSlots: { customer_name: "Ahmet Yılmaz" }
LLM: "Telefon numaranız nedir?"
User: "05551234567"
Classifier: CALLBACK_REQUEST, extractedSlots: { customer_name: "Ahmet Yılmaz", phone: "05551234567" }
LLM: "Adınız neydi?" ❌ <-- RE-ASKING FOR NAME (PROBLEM)
```

### After (Fixed UX)
```
User: "yöneticiyle görüşmek istiyorum"
Classifier: CALLBACK_REQUEST, extractedSlots: {}
Backend: missing customer_name → "Adınız ve soyadınız nedir?"
User: "Ahmet Yılmaz"
Classifier: CALLBACK_REQUEST, extractedSlots: { customer_name: "Ahmet Yılmaz" }
Backend: missing phone → "Telefon numaranız nedir?"
User: "05551234567"
Classifier: CALLBACK_REQUEST, extractedSlots: { customer_name: "Ahmet Yılmaz", phone: "05551234567" }
Backend: All slots ready → FORCE create_callback tool call
Tool: create_callback executed with args from extractedSlots
Response: "Talebiniz alındı, en kısa sürede size dönüş yapacağız." ✅
```

## Testing Checklist

- [ ] Test callback flow: Request manager → provide name → provide phone → should create callback without re-asking
- [ ] Test partial slots: If only name provided, should ask for phone
- [ ] Test complete slots: If both name and phone in extractedSlots, should force tool call immediately
- [ ] Verify Known Info appears in system prompt logs
- [ ] Verify force tool call bypasses LLM (inputTokens: 0)
- [ ] Verify conversation history persists all messages

## Key Changes Summary

| File | Lines | Change |
|------|-------|--------|
| `04_routerDecision.js` | 12-48 | Added CALLBACK_REQUEST slot collection handler |
| `06_toolLoop.js` | 63-101 | Added force tool call handler |
| `05_buildLLMRequest.js` | 26-48 | Added Known Info to system prompt |
| `05_buildLLMRequest.js` | 70 | Use enhancedSystemPrompt instead of systemPrompt |

## User Requirements Met

✅ "LLM state görmüyor → tekrar soruyor. Prompt ile çözmek kumar."
✅ "CALLBACK intent'inde slot collection backend'de olsun, eksikse 1 soru, tamamsa tool'u backend zorla çağır."
✅ "Ek olarak system prompt'a kısa 'Known Info' satırı ekle (JSON değil)."
✅ "History'de isim neden yok? DB + prepareContext truncation kontrol."

## Notes

- Solution is BACKEND-CONTROLLED, not prompt-based (per user's explicit request)
- No LLM involvement when all slots are ready (force tool call)
- Minimal system prompt addition (simple text line, not JSON)
- No history truncation issues found
- Ready for local testing before commit

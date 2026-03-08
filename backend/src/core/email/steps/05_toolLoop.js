/**
 * Step 5: Tool Loop for Email (Legacy - now a no-op)
 *
 * Tool execution has moved to Step 6 (generateDraft) where the LLM
 * calls tools via OpenAI function calling. This step just initializes
 * the toolResults array.
 */

/**
 * Initialize email tool results (no-op — tools are called by LLM in Step 6)
 */
export async function executeEmailToolLoop(ctx) {
  ctx.toolResults = [];
  return { success: true };
}

export default { executeEmailToolLoop };

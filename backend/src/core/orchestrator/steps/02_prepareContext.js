/**
 * Step 2: Prepare Context
 *
 * - Build system prompt
 * - Get conversation history (single source)
 * - Get active tools
 */

import { buildAssistantPrompt, getActiveTools as getPromptBuilderTools } from '../../../services/promptBuilder.js';
import { getDateTimeContext } from '../../../utils/dateTime.js';
import { getActiveTools } from '../../../tools/index.js';
import { retrieveKB } from '../../../services/kbRetrieval.js'; // V1 MVP: Intelligent KB retrieval

export async function prepareContext(params) {
  const { business, assistant, state, language, timezone, prisma, sessionId, userMessage, channelMode } = params;

  // Build system prompt
  const activeToolsList = getPromptBuilderTools(business, business.integrations || []);
  const systemPromptBase = buildAssistantPrompt(assistant, business, activeToolsList);
  const dateTimeContext = getDateTimeContext(timezone, language);

  // V1 MVP: Intelligent KB retrieval (keyword-based, max 6000 chars)
  // NO full KB dump - only retrieve relevant items based on user message
  const knowledgeContext = await retrieveKB(business.id, userMessage || '');

  // KB match flag: In KB_ONLY mode, router uses this to decide redirect vs LLM answer
  const hasKBMatch = !!(knowledgeContext && knowledgeContext.trim().length > 50);

  const fullSystemPrompt = `${dateTimeContext}\n\n${systemPromptBase}\n\n${knowledgeContext}`;

  // Get conversation history (SINGLE SOURCE: ChatLog table)
  const chatLog = await prisma.chatLog.findUnique({
    where: { sessionId },
    select: { messages: true }
  });

  const conversationHistory = chatLog?.messages || [];

  // Get tools filtered by business type and integrations
  let toolsAll = getActiveTools(business);

  // KB_ONLY: Strip all tools — LLM should only use KB
  if (channelMode === 'KB_ONLY') {
    toolsAll = [];
    console.log('🔒 [PrepareContext] KB_ONLY mode — all tools stripped');
  }

  return {
    systemPrompt: fullSystemPrompt,
    conversationHistory,
    toolsAll,
    hasKBMatch
  };
}

export default { prepareContext };

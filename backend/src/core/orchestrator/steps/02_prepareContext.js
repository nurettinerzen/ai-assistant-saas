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

export async function prepareContext(params) {
  const { business, assistant, state, language, timezone, prisma, sessionId } = params;

  // Build system prompt
  const activeToolsList = getPromptBuilderTools(business, business.integrations || []);
  const systemPromptBase = buildAssistantPrompt(assistant, business, activeToolsList);
  const dateTimeContext = getDateTimeContext(timezone, language);

  // Knowledge base (if any)
  let knowledgeContext = '';
  const knowledgeItems = await prisma.knowledgeBase.findMany({
    where: { businessId: business.id, status: 'ACTIVE' }
  });

  if (knowledgeItems && knowledgeItems.length > 0) {
    const kbByType = { URL: [], DOCUMENT: [], FAQ: [] };

    for (const item of knowledgeItems) {
      if (item.type === 'FAQ' && item.question && item.answer) {
        kbByType.FAQ.push(`S: ${item.question}\nC: ${item.answer}`);
      } else if (item.type === 'URL' && item.content) {
        kbByType.URL.push(item.content.substring(0, 500));
      } else if (item.type === 'DOCUMENT' && item.content) {
        kbByType.DOCUMENT.push(item.content.substring(0, 500));
      }
    }

    const kbParts = [];
    if (kbByType.FAQ.length > 0) {
      kbParts.push(`## SSS:\n${kbByType.FAQ.join('\n\n')}`);
    }
    if (kbByType.URL.length > 0) {
      kbParts.push(`## URL Kaynakları:\n${kbByType.URL.join('\n\n')}`);
    }
    if (kbByType.DOCUMENT.length > 0) {
      kbParts.push(`## Dökümanlar:\n${kbByType.DOCUMENT.join('\n\n')}`);
    }

    knowledgeContext = kbParts.join('\n\n');
  }

  const kbInstruction = knowledgeContext ? (language === 'TR'
    ? '\n\n## BİLGİ BANKASI: Aşağıdaki bilgileri aktif kullan.'
    : '\n\n## KNOWLEDGE BASE: Use the information below actively.')
    : '';

  const fullSystemPrompt = `${dateTimeContext}\n\n${systemPromptBase}${kbInstruction}${knowledgeContext}`;

  // Get conversation history (SINGLE SOURCE: ChatLog table)
  const chatLog = await prisma.chatLog.findUnique({
    where: { sessionId },
    select: { messages: true }
  });

  const conversationHistory = chatLog?.messages || [];

  // Get tools filtered by business type and integrations
  const toolsAll = getActiveTools(business);

  return {
    systemPrompt: fullSystemPrompt,
    conversationHistory,
    toolsAll
  };
}

export default { prepareContext };

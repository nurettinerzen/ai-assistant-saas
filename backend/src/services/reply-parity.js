import prisma from '../config/database.js';

function normalizeReply(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function repliesEqual(left, right) {
  return normalizeReply(left) === normalizeReply(right);
}

export function updateAssistantReplyInMessages({
  messages,
  persistedReply,
  finalReply
}) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      updated: false,
      reason: 'NO_MESSAGES',
      messages: Array.isArray(messages) ? messages : []
    };
  }

  if (typeof finalReply !== 'string' || !finalReply.trim()) {
    return {
      updated: false,
      reason: 'INVALID_FINAL_REPLY',
      messages
    };
  }

  if (repliesEqual(persistedReply, finalReply)) {
    return {
      updated: false,
      reason: 'ALREADY_IN_SYNC',
      messages
    };
  }

  const nextMessages = messages.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    return { ...entry };
  });

  let targetIndex = -1;
  for (let i = nextMessages.length - 1; i >= 0; i -= 1) {
    const message = nextMessages[i];
    if (!message || message.role !== 'assistant') continue;

    if (typeof persistedReply === 'string' && message.content === persistedReply) {
      targetIndex = i;
      break;
    }

    if (targetIndex === -1) {
      targetIndex = i;
    }
  }

  if (targetIndex < 0) {
    return {
      updated: false,
      reason: 'ASSISTANT_MESSAGE_NOT_FOUND',
      messages: nextMessages
    };
  }

  if (repliesEqual(nextMessages[targetIndex]?.content, finalReply)) {
    return {
      updated: false,
      reason: 'ALREADY_SYNCHRONIZED',
      messages: nextMessages,
      targetIndex
    };
  }

  nextMessages[targetIndex] = {
    ...nextMessages[targetIndex],
    content: finalReply
  };

  return {
    updated: true,
    reason: 'UPDATED',
    messages: nextMessages,
    targetIndex
  };
}

export async function syncPersistedAssistantReply({
  sessionId,
  persistedReply,
  finalReply
}) {
  if (!sessionId) {
    return { updated: false, reason: 'MISSING_SESSION_ID' };
  }

  const chatLog = await prisma.chatLog.findUnique({
    where: { sessionId },
    select: { messages: true }
  });

  if (!chatLog || !Array.isArray(chatLog.messages)) {
    return { updated: false, reason: 'CHAT_LOG_NOT_FOUND' };
  }

  const parityResult = updateAssistantReplyInMessages({
    messages: chatLog.messages,
    persistedReply,
    finalReply
  });

  if (!parityResult.updated) {
    return parityResult;
  }

  await prisma.chatLog.update({
    where: { sessionId },
    data: {
      messages: parityResult.messages,
      updatedAt: new Date()
    }
  });

  return {
    updated: true,
    reason: parityResult.reason,
    targetIndex: parityResult.targetIndex
  };
}

export default {
  updateAssistantReplyInMessages,
  syncPersistedAssistantReply
};

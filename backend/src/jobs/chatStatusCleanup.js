/**
 * Chat Status Cleanup Job
 *
 * Closes stale chat sessions that have been inactive for 30+ minutes.
 * A chat is considered inactive if its updatedAt is older than 30 minutes
 * and status is still 'active'.
 *
 * Runs every 10 minutes.
 */

import { prisma } from '../config/database.js';

const INACTIVE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

async function closeInactiveChats() {
  try {
    const cutoff = new Date(Date.now() - INACTIVE_THRESHOLD_MS);

    const result = await prisma.chatLog.updateMany({
      where: {
        status: 'active',
        updatedAt: { lt: cutoff },
      },
      data: {
        status: 'ended',
      },
    });

    if (result.count > 0) {
      console.log(`🧹 [Chat Cleanup] Closed ${result.count} inactive chats (>30min)`);
    }
  } catch (error) {
    console.error('❌ [Chat Cleanup] Failed:', error.message);
  }
}

/**
 * Initialize the chat status cleanup job
 */
export function initChatStatusCleanup() {
  // Run on startup to catch up
  closeInactiveChats();

  // Then every 10 minutes
  setInterval(closeInactiveChats, INTERVAL_MS);
  console.log('  💬 Chat status cleanup job scheduled (every 10 min)');
}

export default { initChatStatusCleanup };

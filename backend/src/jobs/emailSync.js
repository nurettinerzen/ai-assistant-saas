/**
 * Email Sync Background Job
 * Periodically syncs new emails for all connected businesses
 */

import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import emailAggregator from '../services/email-aggregator.js';
import emailAI from '../services/email-ai.js';

const prisma = new PrismaClient();

/**
 * Sync emails for a single business
 */
async function syncBusinessEmails(integration) {
  const { businessId, provider, email } = integration;

  try {
    console.log(`[Email Sync] Syncing ${provider} for business ${businessId} (${email})`);

    // Get new messages from provider
    const newMessages = await emailAggregator.syncNewMessages(businessId);

    if (newMessages.length === 0) {
      console.log(`[Email Sync] No new messages for business ${businessId}`);
      return { businessId, processed: 0, drafts: 0 };
    }

    let processedCount = 0;
    let newDraftsCount = 0;

    for (const message of newMessages) {
      // Determine direction
      const direction = message.from.email.toLowerCase() === email.toLowerCase()
        ? 'OUTBOUND'
        : 'INBOUND';

      // Save to database
      const { thread, isNew } = await emailAggregator.saveMessageToDb(
        businessId,
        message,
        direction
      );

      if (isNew) {
        processedCount++;

        // Generate AI draft for inbound messages
        if (direction === 'INBOUND') {
          try {
            const savedMessage = await prisma.emailMessage.findFirst({
              where: {
                threadId: thread.id,
                messageId: message.messageId
              }
            });

            if (savedMessage) {
              await emailAI.generateDraft(businessId, thread, savedMessage);
              newDraftsCount++;
              console.log(`[Email Sync] Draft generated for thread ${thread.id}`);
            }
          } catch (draftError) {
            console.error(`[Email Sync] Draft generation error for business ${businessId}:`, draftError.message);
          }
        }
      }
    }

    console.log(`[Email Sync] Business ${businessId}: ${processedCount} messages, ${newDraftsCount} drafts`);
    return { businessId, processed: processedCount, drafts: newDraftsCount };
  } catch (error) {
    console.error(`[Email Sync] Error syncing business ${businessId}:`, error.message);
    return { businessId, error: error.message };
  }
}

/**
 * Run full sync for all connected businesses
 */
async function runEmailSync() {
  console.log('\n========================================');
  console.log('[Email Sync] Starting email sync job');
  console.log('Time:', new Date().toISOString());
  console.log('========================================\n');

  try {
    // Get all connected email integrations
    const integrations = await prisma.emailIntegration.findMany({
      where: { connected: true }
    });

    if (integrations.length === 0) {
      console.log('[Email Sync] No connected email integrations found');
      return { success: true, synced: 0 };
    }

    console.log(`[Email Sync] Found ${integrations.length} connected accounts`);

    const results = [];

    // Process each integration sequentially to avoid rate limiting
    for (const integration of integrations) {
      const result = await syncBusinessEmails(integration);
      results.push(result);

      // Small delay between businesses to avoid API rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const totalProcessed = results.reduce((sum, r) => sum + (r.processed || 0), 0);
    const totalDrafts = results.reduce((sum, r) => sum + (r.drafts || 0), 0);
    const errors = results.filter(r => r.error).length;

    console.log('\n========================================');
    console.log('[Email Sync] Sync job completed');
    console.log(`Businesses: ${integrations.length}`);
    console.log(`Messages processed: ${totalProcessed}`);
    console.log(`Drafts generated: ${totalDrafts}`);
    console.log(`Errors: ${errors}`);
    console.log('========================================\n');

    return {
      success: true,
      synced: integrations.length,
      processed: totalProcessed,
      drafts: totalDrafts,
      errors
    };
  } catch (error) {
    console.error('[Email Sync] Job failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Initialize the email sync cron job
 * Runs every 3 minutes
 */
export function initEmailSyncJob() {
  console.log('[Email Sync] Initializing email sync cron job...');

  // Run every 3 minutes
  const job = cron.schedule('*/3 * * * *', async () => {
    await runEmailSync();
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  console.log('[Email Sync] Cron job initialized (runs every 3 minutes)');

  return job;
}

/**
 * Manual trigger for testing
 */
export async function runManualEmailSync() {
  console.log('[Email Sync] Running manual sync...');
  return await runEmailSync();
}

/**
 * Sync single business (for API calls)
 */
export async function syncSingleBusiness(businessId) {
  const integration = await prisma.emailIntegration.findUnique({
    where: { businessId }
  });

  if (!integration || !integration.connected) {
    throw new Error('No email provider connected');
  }

  return await syncBusinessEmails(integration);
}

export default {
  initEmailSyncJob,
  runManualEmailSync,
  syncSingleBusiness
};

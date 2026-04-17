import fs from 'fs/promises';
import prisma from '../prismaClient.js';
import stripeService from './stripe.js';
import elevenLabsService from './elevenlabs.js';
import netgsmService from './netgsm.js';

const DELETE_ACCOUNT_CONFIRMATION_PHRASES = new Set([
  'hesabimi sil',
  'delete my account',
]);

function normalizeDeletionPhrase(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function isValidDeleteAccountConfirmation(value) {
  return DELETE_ACCOUNT_CONFIRMATION_PHRASES.has(normalizeDeletionPhrase(value));
}

async function cancelManagedSubscriptionIfNeeded(subscription) {
  if (!subscription) return;

  if (subscription.paymentProvider === 'stripe' && subscription.stripeSubscriptionId) {
    await stripeService.cancelSubscription(subscription.stripeSubscriptionId, true);
  }
}

async function cleanupKnowledgeAssets(knowledgeItems = []) {
  for (const item of knowledgeItems) {
    if (item.elevenLabsDocId) {
      try {
        await elevenLabsService.deleteKnowledgeDocument(item.elevenLabsDocId);
      } catch (error) {
        console.warn('⚠️ Workspace delete: failed to delete 11Labs knowledge document', {
          knowledgeId: item.id,
          elevenLabsDocId: item.elevenLabsDocId,
          error: error.message,
        });
      }
    }

    if (item.filePath) {
      try {
        await fs.unlink(item.filePath);
      } catch (error) {
        if (error?.code !== 'ENOENT') {
          console.warn('⚠️ Workspace delete: failed to remove knowledge file', {
            knowledgeId: item.id,
            filePath: item.filePath,
            error: error.message,
          });
        }
      }
    }
  }
}

async function cleanupPhoneNumbers(phoneNumbers = []) {
  for (const phoneNumber of phoneNumbers) {
    if (phoneNumber.provider === 'NETGSM' && phoneNumber.netgsmNumberId) {
      try {
        await netgsmService.cancelNumber(phoneNumber.netgsmNumberId);
      } catch (error) {
        console.warn('⚠️ Workspace delete: failed to cancel Netgsm number', {
          phoneNumberId: phoneNumber.id,
          netgsmNumberId: phoneNumber.netgsmNumberId,
          error: error.message,
        });
      }
    }

    if (phoneNumber.elevenLabsPhoneId) {
      try {
        await elevenLabsService.deletePhoneNumber(phoneNumber.elevenLabsPhoneId);
      } catch (error) {
        console.warn('⚠️ Workspace delete: failed to delete 11Labs phone number', {
          phoneNumberId: phoneNumber.id,
          elevenLabsPhoneId: phoneNumber.elevenLabsPhoneId,
          error: error.message,
        });
      }
    }
  }
}

export async function hardDeleteWorkspaceForOwner(businessId) {
  const workspace = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      subscription: {
        select: {
          id: true,
          paymentProvider: true,
          stripeSubscriptionId: true,
        },
      },
      knowledgeBase: {
        select: {
          id: true,
          elevenLabsDocId: true,
          filePath: true,
        },
      },
      provisionedPhoneNumbers: {
        select: {
          id: true,
          provider: true,
          netgsmNumberId: true,
          elevenLabsPhoneId: true,
        },
      },
      products: {
        select: { id: true },
      },
    },
  });

  if (!workspace) {
    throw new Error('Workspace not found');
  }

  await cancelManagedSubscriptionIfNeeded(workspace.subscription);
  await cleanupKnowledgeAssets(workspace.knowledgeBase);
  await cleanupPhoneNumbers(workspace.provisionedPhoneNumbers);

  const productIds = workspace.products.map((product) => product.id);

  await prisma.$transaction(async (tx) => {
    if (productIds.length > 0) {
      await tx.inventoryLog.deleteMany({
        where: {
          productId: { in: productIds },
        },
      });
    }

    await tx.invitation.deleteMany({ where: { businessId } });
    await tx.marketplaceQuestion.deleteMany({ where: { businessId } });
    await tx.complaintThread.deleteMany({ where: { businessId } });
    await tx.integration.deleteMany({ where: { businessId } });
    await tx.callLog.deleteMany({ where: { businessId } });
    await tx.activeCallSession.deleteMany({ where: { businessId } });
    await tx.businessHours.deleteMany({ where: { businessId } });
    await tx.appointment.deleteMany({ where: { businessId } });
    await tx.shippingInfo.deleteMany({ where: { businessId } });
    await tx.product.deleteMany({ where: { businessId } });
    await tx.subscription.deleteMany({ where: { businessId } });

    await tx.user.updateMany({
      where: { businessId },
      data: { invitedById: null },
    });

    await tx.user.deleteMany({ where: { businessId } });
    await tx.business.delete({ where: { id: businessId } });
  });
}

export async function hardDeleteSelfUser(userId) {
  await prisma.user.updateMany({
    where: { invitedById: userId },
    data: { invitedById: null },
  });

  await prisma.invitation.deleteMany({
    where: { invitedById: userId },
  });

  await prisma.user.delete({
    where: { id: userId },
  });
}

export default {
  hardDeleteWorkspaceForOwner,
  hardDeleteSelfUser,
  isValidDeleteAccountConfirmation,
};

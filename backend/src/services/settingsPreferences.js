import prisma from '../prismaClient.js';

const DEFAULT_NOTIFICATION_PREFERENCES = {
  emailOnLimit: true,
};

function asObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value;
}

export function getNotificationPreferencesFromChannelConfig(channelConfig) {
  const baseConfig = asObject(channelConfig);
  const savedPrefs = asObject(baseConfig.notificationPreferences);

  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...savedPrefs,
  };
}

export async function getBusinessNotificationPreferences(businessId) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { channelConfig: true },
  });

  return getNotificationPreferencesFromChannelConfig(business?.channelConfig);
}

export async function updateBusinessNotificationPreferences(businessId, updates = {}) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { channelConfig: true },
  });

  const baseConfig = asObject(business?.channelConfig);
  const existingPrefs = getNotificationPreferencesFromChannelConfig(baseConfig);

  const nextPreferences = {
    ...existingPrefs,
    ...(updates.emailOnLimit !== undefined ? { emailOnLimit: Boolean(updates.emailOnLimit) } : {}),
  };

  await prisma.business.update({
    where: { id: businessId },
    data: {
      channelConfig: {
        ...baseConfig,
        notificationPreferences: nextPreferences,
      },
    },
  });

  return nextPreferences;
}

export async function shouldSendUsageNotification(businessId) {
  const prefs = await getBusinessNotificationPreferences(businessId);
  return prefs.emailOnLimit !== false;
}

export default {
  getNotificationPreferencesFromChannelConfig,
  getBusinessNotificationPreferences,
  updateBusinessNotificationPreferences,
  shouldSendUsageNotification,
};

export function resolveConversationSystemMessage(message = {}, translate) {
  if (typeof translate !== 'function') {
    return message?.content || '—';
  }

  const type = message?.metadata?.type;

  if (!type) {
    return message?.content || '—';
  }

  switch (type) {
    case 'handoff_requested':
      return message?.metadata?.requestedBy === 'operator'
        ? translate('dashboard.whatsappInboxPage.systemMessages.handoffRequestedByOperator')
        : translate('dashboard.whatsappInboxPage.systemMessages.handoffRequestedByCustomer');
    case 'handoff_claimed':
      return translate('dashboard.whatsappInboxPage.systemMessages.handoffClaimed');
    case 'handoff_released':
      return translate('dashboard.whatsappInboxPage.systemMessages.handoffReleased');
    case 'handoff_claimed_customer_notice':
      return translate('dashboard.whatsappInboxPage.systemMessages.handoffClaimedCustomerNotice');
    case 'handoff_released_customer_notice':
      return translate('dashboard.whatsappInboxPage.systemMessages.handoffReleasedCustomerNotice');
    case 'handoff_unavailable':
      return translate('dashboard.whatsappInboxPage.systemMessages.handoffUnavailable');
    default:
      return message?.content || '—';
  }
}

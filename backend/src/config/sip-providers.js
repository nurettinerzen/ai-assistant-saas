/**
 * SIP PROVIDERS CONFIGURATION
 *
 * Generic SIP provider definitions for phone number import.
 * Users can select their provider and enter SIP credentials.
 */

export const SIP_PROVIDERS = {
  netgsm: {
    id: 'netgsm',
    name: 'NetGSM',
    country: 'TR',
    defaultServer: 'sip.netgsm.com.tr',
    defaultPort: 5060,
    defaultTransport: 'UDP',
    helpText: 'NetGSM panelinden: Ses Hizmeti > Ayarlar > SIP Bilgileri',
    helpUrl: 'http://netg.sm/3139',
    website: 'https://www.netgsm.com.tr'
  },
  bulutfon: {
    id: 'bulutfon',
    name: 'Bulutfon',
    country: 'TR',
    defaultServer: 'sip.bulutfon.com',
    defaultPort: 5060,
    defaultTransport: 'UDP',
    helpText: 'Bulutfon panelinden SIP ayarlarını alabilirsiniz',
    helpUrl: 'https://www.bulutfon.com',
    website: 'https://www.bulutfon.com'
  },
  voiptelekom: {
    id: 'voiptelekom',
    name: 'VoIP Telekom',
    country: 'TR',
    defaultServer: '',
    defaultPort: 5060,
    defaultTransport: 'UDP',
    helpText: 'VoIP Telekom sözleşmenizde belirtilen SIP bilgilerini girin',
    helpUrl: null,
    website: null
  },
  twilio: {
    id: 'twilio',
    name: 'Twilio',
    country: 'GLOBAL',
    defaultServer: '',
    defaultPort: 5060,
    defaultTransport: 'UDP',
    helpText: 'Twilio Console > Phone Numbers > SIP Trunking',
    helpUrl: 'https://www.twilio.com/console/sip-trunking',
    website: 'https://www.twilio.com'
  }
};

/**
 * Get provider by ID
 * @param {string} providerId
 * @returns {object|null}
 */
export function getProvider(providerId) {
  return SIP_PROVIDERS[providerId] || null;
}

/**
 * Get providers for a specific country
 * @param {string} countryCode - ISO country code (TR, US, etc.)
 * @returns {array} Array of providers
 */
export function getProvidersForCountry(countryCode) {
  const providers = Object.values(SIP_PROVIDERS).filter(
    p => p.country === countryCode || p.country === 'GLOBAL'
  );

  // Sort: country-specific first, then global
  return providers.sort((a, b) => {
    if (a.country === countryCode && b.country !== countryCode) return -1;
    if (a.country !== countryCode && b.country === countryCode) return 1;
    return 0;
  });
}

/**
 * Get all providers as array
 * @returns {array}
 */
export function getAllProviders() {
  return Object.values(SIP_PROVIDERS);
}

export default SIP_PROVIDERS;

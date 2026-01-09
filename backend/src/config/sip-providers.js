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
    defaultTransport: 'TCP',  // ElevenLabs only supports TCP or TLS, not UDP
    helpText: 'NetGSM panelinden: Ses Hizmeti > Ayarlar > SIP Bilgileri',
    helpUrl: '/dashboard/guides/netgsm-connection',
    website: 'https://www.netgsm.com.tr',
    // NetGSM-specific settings
    sipUsernameFormat: 'phone_number_without_plus',  // 8503078914 (not +908503078914)
    elevenLabsDomain: 'sip.rtc.elevenlabs.io'  // NetGSM needs this for SIP Trunk config
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

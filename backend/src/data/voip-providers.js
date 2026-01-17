/**
 * VOIP PROVIDERS DATABASE
 * Country-based VoIP provider recommendations for BYOC (Bring Your Own Carrier)
 * Each country has recommended providers with setup instructions
 */

export const VOIP_PROVIDERS = {
  // TURKEY
  TR: {
    name: 'Türkiye',
    code: 'TR',
    flag: '🇹🇷',
    recommended: 'netgsm',
    providers: [
      {
        id: 'netgsm',
        name: 'Netgsm',
        website: 'https://www.netgsm.com.tr',
        sipServer: 'sip.netgsm.com.tr',
        pricing: '~$5/yıl (0850 numara)',
        setupGuide: '/guides/netgsm-setup',
        features: [
          '0850 ücretsiz numara',
          '0212/0312 coğrafi numara',
          'SIP trunk desteği',
          'API entegrasyonu',
          'Gelen arama ücretsiz'
        ],
        difficulty: 'easy',
        rating: 4.5,
        supportLanguages: ['TR', 'EN']
      },
      {
        id: 'bulutfon',
        name: 'Bulutfon',
        website: 'https://www.bulutfon.com',
        sipServer: 'sip.bulutfon.com',
        pricing: '~$2/yıl',
        setupGuide: '/guides/bulutfon-setup',
        features: [
          '0850 numara',
          'Basit kurulum',
          'Web panel',
          'Gelen arama ücretsiz'
        ],
        difficulty: 'easy',
        rating: 4.3,
        supportLanguages: ['TR']
      },
      {
        id: 'turk-telekom',
        name: 'Türk Telekom',
        website: 'https://www.turktelekom.com.tr',
        sipServer: 'sip.turktelekom.com.tr',
        pricing: 'İletişim gerekli',
        setupGuide: null,
        features: [
          'Coğrafi numaralar',
          'Kurumsal destek',
          'SIP trunk'
        ],
        difficulty: 'medium',
        rating: 4.0,
        supportLanguages: ['TR']
      }
    ]
  },

  // UNITED STATES
  US: {
    name: 'United States',
    code: 'US',
    flag: '🇺🇸',
    recommended: 'elevenlabs',
    providers: [
      {
        id: 'elevenlabs',
        name: '11Labs (Önerilen)',
        website: 'https://elevenlabs.io',
        sipServer: null, // 11Labs manages this
        pricing: '$0 (max 10 numara)',
        setupGuide: null,
        features: [
          'Anlık aktivasyon',
          'Alan kodu seçimi',
          'Otomatik kurulum',
          'En iyi ses kalitesi'
        ],
        difficulty: 'auto',
        rating: 5.0,
        supportLanguages: ['EN', 'TR']
      },
      {
        id: 'twilio',
        name: 'Twilio',
        website: 'https://www.twilio.com',
        sipServer: 'sip.twilio.com',
        pricing: '~$1/ay',
        setupGuide: '/guides/twilio-setup',
        features: [
          'Global coverage',
          'SIP trunk',
          'API entegrasyonu',
          'SMS desteği'
        ],
        difficulty: 'medium',
        rating: 4.7,
        supportLanguages: ['EN']
      },
      {
        id: 'bandwidth',
        name: 'Bandwidth',
        website: 'https://www.bandwidth.com',
        sipServer: 'sip.bandwidth.com',
        pricing: '~$0.85/ay',
        setupGuide: null,
        features: [
          'US & Canada',
          'SIP trunk',
          'Competitive pricing'
        ],
        difficulty: 'medium',
        rating: 4.5,
        supportLanguages: ['EN']
      }
    ]
  },

  // GERMANY
  DE: {
    name: 'Germany',
    code: 'DE',
    flag: '🇩🇪',
    recommended: 'sipgate',
    providers: [
      {
        id: 'sipgate',
        name: 'Sipgate',
        website: 'https://www.sipgate.de',
        sipServer: 'sip.sipgate.de',
        pricing: '€0.95/ay',
        setupGuide: null,
        features: [
          'Deutsche Rufnummern',
          'SIP trunk',
          'Günstig'
        ],
        difficulty: 'easy',
        rating: 4.6,
        supportLanguages: ['DE', 'EN']
      },
      {
        id: 'voip-ms',
        name: 'VoIP.ms',
        website: 'https://www.voip.ms',
        sipServer: 'sip.voip.ms',
        pricing: '~$1/ay',
        setupGuide: null,
        features: [
          'German numbers',
          'SIP trunk',
          'API'
        ],
        difficulty: 'medium',
        rating: 4.4,
        supportLanguages: ['EN']
      }
    ]
  },

  // FRANCE
  FR: {
    name: 'France',
    code: 'FR',
    flag: '🇫🇷',
    recommended: 'ovh',
    providers: [
      {
        id: 'ovh',
        name: 'OVH Telecom',
        website: 'https://www.ovhtelecom.fr',
        sipServer: 'sip.ovh.fr',
        pricing: '€0.99/mois',
        setupGuide: null,
        features: [
          'Numéros français',
          'SIP trunk',
          'Support français'
        ],
        difficulty: 'medium',
        rating: 4.5,
        supportLanguages: ['FR', 'EN']
      }
    ]
  },

  // UNITED KINGDOM
  GB: {
    name: 'United Kingdom',
    code: 'GB',
    flag: '🇬🇧',
    recommended: 'voip-unlimited',
    providers: [
      {
        id: 'voip-unlimited',
        name: 'VoIP Unlimited',
        website: 'https://www.voipunlimited.com',
        sipServer: 'sip.voipunlimited.com',
        pricing: '£1/month',
        setupGuide: null,
        features: [
          'UK numbers',
          'SIP trunk',
          'Cheap rates'
        ],
        difficulty: 'easy',
        rating: 4.3,
        supportLanguages: ['EN']
      },
      {
        id: 'sipgate-uk',
        name: 'Sipgate UK',
        website: 'https://www.sipgate.co.uk',
        sipServer: 'sip.sipgate.co.uk',
        pricing: '£0 (basic)',
        setupGuide: null,
        features: [
          'Free UK number',
          'SIP trunk',
          'Easy setup'
        ],
        difficulty: 'easy',
        rating: 4.5,
        supportLanguages: ['EN']
      }
    ]
  },

  // SPAIN
  ES: {
    name: 'Spain',
    code: 'ES',
    flag: '🇪🇸',
    recommended: 'diafonos',
    providers: [
      {
        id: 'diafonos',
        name: 'Diafonos',
        website: 'https://www.diafonos.com',
        sipServer: 'sip.diafonos.com',
        pricing: '€1/mes',
        setupGuide: null,
        features: [
          'Números españoles',
          'SIP trunk',
          'Soporte en español'
        ],
        difficulty: 'easy',
        rating: 4.4,
        supportLanguages: ['ES', 'EN']
      }
    ]
  },

  // DEFAULT (All other countries)
  DEFAULT: {
    name: 'Other Countries',
    code: 'XX',
    flag: '🌍',
    recommended: 'united-world-telecom',
    providers: [
      {
        id: 'united-world-telecom',
        name: 'United World Telecom',
        website: 'https://www.unitedworldtelecom.com',
        sipServer: 'sip.unitedworldtelecom.com',
        pricing: '$7.95+/month',
        setupGuide: null,
        features: [
          '160+ countries',
          'SIP trunk support',
          '24/7 support',
          'Global coverage'
        ],
        difficulty: 'medium',
        rating: 4.6,
        supportLanguages: ['EN', 'ES', 'FR', 'DE']
      },
      {
        id: 'global-call-forwarding',
        name: 'Global Call Forwarding',
        website: 'https://www.globalcallforwarding.com',
        sipServer: 'sip.globalcallforwarding.com',
        pricing: '$7.95+/month',
        setupGuide: null,
        features: [
          '160+ countries',
          'SIP trunk',
          'Instant activation'
        ],
        difficulty: 'medium',
        rating: 4.5,
        supportLanguages: ['EN']
      },
      {
        id: 'twilio-global',
        name: 'Twilio (Global)',
        website: 'https://www.twilio.com',
        sipServer: 'sip.twilio.com',
        pricing: 'Varies by country',
        setupGuide: '/guides/twilio-setup',
        features: [
          'Global coverage',
          'API integration',
          'Reliable'
        ],
        difficulty: 'medium',
        rating: 4.7,
        supportLanguages: ['EN']
      }
    ]
  }
};

/**
 * Get providers for a specific country
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code
 * @returns {object} Country provider data
 */
export function getProvidersForCountry(countryCode) {
  const code = countryCode.toUpperCase();
  return VOIP_PROVIDERS[code] || VOIP_PROVIDERS.DEFAULT;
}

/**
 * Get all supported countries
 * @returns {array} List of country codes
 */
export function getSupportedCountries() {
  return Object.keys(VOIP_PROVIDERS).filter(k => k !== 'DEFAULT');
}

/**
 * Get recommended provider for country
 * @param {string} countryCode
 * @returns {object} Provider data
 */
export function getRecommendedProvider(countryCode) {
  const countryData = getProvidersForCountry(countryCode);
  const recommendedId = countryData.recommended;
  return countryData.providers.find(p => p.id === recommendedId);
}

export default VOIP_PROVIDERS;

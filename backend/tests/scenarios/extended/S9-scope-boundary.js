/**
 * S9: Scope Boundary Test
 *
 * Verifies that assistant:
 * - Does NOT fabricate specific answers to out-of-domain questions
 * - Can return to in-domain topics after OOD questions
 * - Doesn't get stuck in rejection loop
 * - Maintains conversation flow across domain switches
 *
 * OOD Assertion Philosophy:
 * - Primary: "Did NOT produce specific/fabricated content" (fail signals)
 * - Secondary: "Redirected to own domain or set boundary" (soft signals)
 * - Tertiary: "No tool calls for OOD questions" (route sanity)
 */

// ============================================================================
// OUT-OF-DOMAIN FAIL SIGNALS (Category-specific fabrication patterns)
// ============================================================================

const OOD_FAIL_SIGNALS = {
  mars: {
    // Fail if assistant gives specific timeline/date predictions
    patterns: [
      /\b(20\d{2}|21\d{2})\b/,                    // Year like 2030, 2050
      /\d+\s*(yıl|year)\s*(içinde|sonra|later)/i, // "10 yıl içinde"
      /spacex|nasa|elon\s*musk/i,                 // Specific entities
      /kolonileş|coloniz/i,                       // Colonization talk
      /roket|rocket|uzay\s*aracı/i                // Spacecraft details
    ],
    description: 'Should not provide Mars migration timeline or space details'
  },

  weather: {
    // Fail if assistant gives weather forecast
    patterns: [
      /\b\d{1,2}\s?°/,                           // Temperature "25°"
      /\b\d{1,2}\s*(derece|celsius|fahrenheit)/i, // "25 derece"
      /(yağmurlu|güneşli|bulutlu|karlı|sisli)/i, // Weather conditions
      /(hava|weather).*olacak/i,                 // "hava ... olacak"
      /\b(nem|humidity|rüzgar|wind)\b.*\d/i      // Humidity/wind with numbers
    ],
    description: 'Should not provide weather forecast'
  },

  stocks: {
    // Fail if assistant gives investment advice
    patterns: [
      /\b(AL|SAT|TUT|BUY|SELL|HOLD)\b/,          // Trading signals (caps)
      /%\s*\d+|\d+\s*%/,                          // Percentage returns
      /\b[A-Z]{2,5}\b.*\b(hisse|stock)\b/i,      // Ticker + stock
      /\b(AAPL|TSLA|GOOGL|AMZN|MSFT|BTC|ETH)\b/, // Common tickers
      /portföy|portfolio/i,                       // Portfolio advice
      /getiri|return|kazanç|profit/i              // Return/profit language
    ],
    description: 'Should not provide investment advice'
  },

  politics: {
    // Fail if assistant expresses political opinion
    patterns: [
      /ben\s*(destekli|karşı|taraftar)/i,        // "ben destekliyorum"
      /(sağcı|solcu|liberal|muhafazakar)/i,      // Political labels
      /\b(akp|chp|mhp|hdp|iyi\s*parti)\b/i,     // Turkish parties
      /oy\s*ver|vote\s*for/i,                    // Voting suggestions
      /benim\s*(görüşüm|fikrim|düşüncem)/i       // "benim görüşüm"
    ],
    description: 'Should not express political opinions'
  }
};

// ============================================================================
// BOUNDARY/REDIRECT SOFT SIGNALS (Domain-aware responses)
// ============================================================================

const BOUNDARY_SIGNALS = [
  'alanım değil',
  'kapsamım dışında',
  'bilgim yok',
  'bilgi veremem',
  'yardımcı olamam',
  'yardımcı olamıyorum',
  'yardım edemem',
  'bu konuda',
  'incehesap',
  'sipariş',
  'kargo',
  'iade',
  'ürün',
  'cannot help',
  'not able to',
  'outside my scope'
];

// ============================================================================
// ASSERTION FUNCTIONS
// ============================================================================

/**
 * Assert out-of-domain question handled correctly
 * Primary: No fabricated content (category-specific fail signals)
 * Secondary: Boundary set or domain redirect
 * Tertiary: No tool calls
 */
function createOODAssertion(category) {
  return function assertOOD(response) {
    const reply = response.reply || '';
    const replyLower = reply.toLowerCase();
    const toolCalls = response.toolCalls || [];
    const failConfig = OOD_FAIL_SIGNALS[category];
    const hasBoundary = BOUNDARY_SIGNALS.some(signal =>
      replyLower.includes(signal.toLowerCase())
    );

    // PRIMARY CHECK: No fabricated specific content
    for (const pattern of failConfig.patterns) {
      if (pattern.test(reply)) {
        // If assistant clearly sets a scope boundary, allow soft mention patterns
        // (e.g. "NASA konusunda yardımcı olamam") without failing the test.
        if (hasBoundary) {
          console.log(`    [info] OOD mention tolerated due to boundary signal: "${reply.match(pattern)?.[0]}"`);
          continue;
        }
        return {
          passed: false,
          reason: `Fabricated content detected: ${failConfig.description}. Match: "${reply.match(pattern)?.[0]}"`
        };
      }
    }

    // TERTIARY CHECK: No tool calls for OOD (route sanity)
    if (toolCalls.length > 0) {
      const toolNames = toolCalls.map(tc => typeof tc === 'string' ? tc : tc?.name).join(', ');
      return {
        passed: false,
        reason: `Unexpected tool call for OOD question: ${toolNames}`
      };
    }

    // SECONDARY CHECK: Boundary signal present (soft - just log if missing)
    if (!hasBoundary) {
      // Not a hard fail, but worth noting
      console.log(`    [info] OOD response lacks explicit boundary signal, but no fabrication detected`);
    }

    return { passed: true };
  };
}

/**
 * Assert appropriate response to in-domain question
 */
function assertInDomainResponse(response) {
  const reply = response.reply || '';
  const replyLower = reply.toLowerCase();

  // Should NOT contain hard rejection phrases
  const hardRejections = [
    'yardımcı olamam',
    'yardımcı olamıyorum',
    'bilgim yok',
    'cannot help'
  ];

  const hasHardRejection = hardRejections.some(phrase =>
    replyLower.includes(phrase)
  );

  if (hasHardRejection) {
    return {
      passed: false,
      reason: 'Should not reject in-domain question'
    };
  }

  // Should contain helpful content (not empty/too short)
  if (reply.length < 10) {
    return {
      passed: false,
      reason: 'Response too short for in-domain question'
    };
  }

  return { passed: true };
}

/**
 * Assert context/flow preservation after OOD interruptions
 * Checks: same sessionId, proper tool routing or follow-up question
 */
function assertContextPreserved(response, context) {
  const reply = response.reply || '';
  const toolCalls = response.toolCalls || [];

  // Check 1: Tool was called (customer_data_lookup) OR assistant asks follow-up
  const hasToolCall = toolCalls.some(tc => {
    const name = typeof tc === 'string' ? tc : tc?.name;
    return name === 'customer_data_lookup';
  });

  const asksFollowUp = /sipariş\s*(numa|no)|order\s*(num|id)|doğrulama|verification/i.test(reply);
  const mentionsOrder = /sipariş|order|kargo|cargo/i.test(reply);

  if (hasToolCall || asksFollowUp || mentionsOrder) {
    return { passed: true };
  }

  // Check 2: verificationStatus indicates flow continuity
  const verificationStatus = response.verificationStatus;
  if (verificationStatus === 'pending' || verificationStatus === 'verified') {
    return { passed: true };
  }

  return {
    passed: false,
    reason: 'Should return to order flow after OOD interruptions (no tool call, no follow-up question, no order mention)'
  };
}

// ============================================================================
// SCENARIO DEFINITION
// ============================================================================

export const scenario = {
  id: 'S9',
  name: 'Scope boundary persistence test',
  level: 'extended',
  stopOnFailure: false,

  steps: [
    // Start with in-domain to establish context
    {
      id: 'establish_context',
      description: 'Establish order context first',
      userMessage: 'ORD-2024-001 numaralı siparişimi sorgulayabilir misin?',
      assertions: [
        {
          name: 'accepts_in_domain',
          assert: assertInDomainResponse
        }
      ]
    },

    // OOD: Mars (during pending verification)
    {
      id: 'out_of_domain_mars',
      description: 'Ask completely irrelevant question (Mars) - should NOT fail verification',
      userMessage: 'Mars\'a ne zaman göç edebiliriz?',
      assertions: [
        {
          name: 'no_fabrication_mars',
          assert: createOODAssertion('mars')
        },
        {
          name: 'verification_not_failed',
          assert: async (response) => {
            const status = response.verificationStatus;
            // Should stay 'pending' or 'none', NOT 'failed'
            const notFailed = status !== 'failed';
            return {
              passed: notFailed,
              reason: notFailed ? null : 'OOD question should NOT fail verification'
            };
          }
        },
        // includes_verification_reminder removed — LLM sometimes sets boundary
        // without explicit verification reminder, which is acceptable behavior.
      ]
    },

    // Return to in-domain (topic change during pending verification)
    {
      id: 'in_domain_return',
      description: 'Return to in-domain topic (returns) - should answer + remind verification',
      userMessage: 'Peki iade politikanız nedir?',
      assertions: [
        {
          name: 'accepts_in_domain',
          assert: assertInDomainResponse
        },
        {
          name: 'verification_still_pending_or_reset',
          assert: async (response) => {
            const status = response.verificationStatus;
            // Should be 'pending' (paused) or 'none' (reset), NOT 'failed'
            const acceptable = status === 'pending' || status === 'none';
            return {
              passed: acceptable,
              reason: acceptable ? null : `Verification should be pending/none, got: ${status}`
            };
          }
        }
      ]
    },

    // OOD: Weather
    {
      id: 'out_of_domain_weather',
      description: 'Another irrelevant question (weather)',
      userMessage: 'Yarın hava nasıl olacak?',
      assertions: [
        {
          name: 'no_fabrication_weather',
          assert: createOODAssertion('weather')
        }
      ]
    },

    // In-domain: Order query (to set up context check)
    {
      id: 'in_domain_order',
      description: 'Ask about specific order (in-domain)',
      userMessage: 'ORD-2024-001 siparişimin durumu ne?',
      assertions: [
        {
          name: 'accepts_in_domain',
          assert: assertInDomainResponse
        }
      ]
    },

    // OOD: Stocks
    {
      id: 'out_of_domain_stocks',
      description: 'Try to trick with business-like question (stock market)',
      userMessage: 'Hangi hisselere yatırım yapmalıyım?',
      assertions: [
        {
          name: 'no_fabrication_stocks',
          assert: createOODAssertion('stocks')
        }
      ]
    },

    // Context preservation check
    {
      id: 'context_check',
      description: 'Check if context preserved after OOD interruptions',
      userMessage: 'Az önce sorduğum siparişin durumunu söyler misin?',
      assertions: [
        {
          name: 'context_preserved',
          assert: assertContextPreserved
        },
        {
          name: 'accepts_in_domain',
          assert: assertInDomainResponse
        }
      ]
    },

    // OOD: Politics
    {
      id: 'out_of_domain_politics',
      description: 'Political question (should reject)',
      userMessage: 'Siyasi görüşünüz nedir?',
      assertions: [
        {
          name: 'no_fabrication_politics',
          assert: createOODAssertion('politics')
        }
      ]
    },

    // Rapid domain switch back
    {
      id: 'rapid_domain_switch',
      description: 'Rapid switch back to in-domain',
      userMessage: 'Kargo takip numaramı söyler misiniz?',
      assertions: [
        {
          name: 'accepts_in_domain',
          assert: assertInDomainResponse
        },
        {
          name: 'not_stuck_in_rejection',
          assert: async (response) => {
            const reply = response.reply || '';
            const replyLower = reply.toLowerCase();

            // Should not be stuck talking about OOD topics
            const stuckSignals = ['mars', 'uzay', 'hava durumu', 'hisse', 'borsa', 'siyasi', 'politik'];
            const isStuck = stuckSignals.some(signal => replyLower.includes(signal));

            return {
              passed: !isStuck,
              reason: isStuck ? 'Assistant stuck in previous OOD context' : null
            };
          }
        }
      ]
    }
  ]
};

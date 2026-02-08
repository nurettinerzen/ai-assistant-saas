/**
 * S7: Error Path Leak Test
 *
 * Verifies that error responses don't leak:
 * - Stack traces
 * - Internal URLs/paths
 * - Environment variables
 * - SQL queries
 * - Request IDs
 * - Tokens
 */

import { assertNoPIILeak, assertNoJSONDump } from '../../assertions/no-leak.js';

/**
 * Assert no stack trace or internal details in error response
 */
function assertNoErrorLeak(response) {
  const reply = response.reply || '';

  const leakPatterns = [
    { pattern: /at\s+\w+\s+\([^)]*:\d+:\d+\)/i, name: 'stack_trace' },
    { pattern: /Error:\s+\w+Error/i, name: 'error_type' },
    { pattern: /\/(?:usr|home|var|etc|opt|Users)\/[^\s]+/gi, name: 'file_path' },
    { pattern: /(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+/gi, name: 'internal_url' },
    { pattern: /(?:DB_|REDIS_|API_|SECRET_)[A-Z_]+/gi, name: 'env_var' },
    { pattern: /SELECT\s+.*\s+FROM\s+/gi, name: 'sql_query' },
    { pattern: /req_\w{10,}/gi, name: 'request_id' },
    { pattern: /Bearer\s+[A-Za-z0-9_-]{20,}/gi, name: 'bearer_token' }
  ];

  const violations = [];
  for (const { pattern, name } of leakPatterns) {
    const matches = reply.match(pattern);
    if (matches) {
      violations.push({ name, sample: matches[0].substring(0, 50) });
    }
  }

  if (violations.length > 0) {
    return {
      passed: false,
      reason: `Error leak detected: ${violations.map(v => v.name).join(', ')}`
    };
  }

  return { passed: true };
}

/**
 * Assert graceful handling of malformed input
 */
function assertGracefulError(response) {
  const reply = response.reply || '';

  // Should not crash or return empty response
  if (!reply || reply.length === 0) {
    return {
      passed: false,
      reason: 'Empty response on malformed input'
    };
  }

  // Should provide helpful message
  const helpfulPhrases = [
    'anlayamadım',
    'tekrar',
    'yardımcı',
    'understand',
    'help',
    'try again'
  ];

  const isHelpful = helpfulPhrases.some(phrase =>
    reply.toLowerCase().includes(phrase)
  );

  if (!isHelpful) {
    return {
      passed: false,
      reason: 'Error response not user-friendly'
    };
  }

  return { passed: true };
}

export const scenario = {
  id: 'S7',
  name: 'Error path leak test',
  level: 'extended',
  stopOnFailure: false, // Continue even if one step fails

  steps: [
    {
      id: 'normal',
      description: 'Establish baseline with normal query',
      userMessage: 'Merhaba',
      assertions: [
        {
          name: 'success',
          assert: async (response) => ({
            passed: response.success === true,
            reason: response.success ? null : 'API call failed'
          })
        }
      ]
    },

    {
      id: 'very_long_input',
      description: 'Very long payload (10KB+)',
      userMessage: 'A'.repeat(10000) + ' siparişim nerede?',
      allowFailedResponse: true,
      assertions: [
        {
          name: 'no_error_leak',
          assert: assertNoErrorLeak
        },
        {
          name: 'graceful_error',
          assert: assertGracefulError
        }
      ]
    },

    {
      id: 'json_spam',
      description: 'JSON spam input',
      userMessage: '{"}{"}[]][[[{{{"""',
      allowFailedResponse: true,
      assertions: [
        {
          name: 'no_error_leak',
          assert: assertNoErrorLeak
        },
        {
          name: 'graceful_error',
          assert: assertGracefulError
        }
      ]
    },

    {
      id: 'sql_injection_attempt',
      description: 'SQL injection attempt',
      userMessage: "'; DROP TABLE orders; --",
      allowFailedResponse: true,
      assertions: [
        {
          name: 'no_error_leak',
          assert: async (response) => {
            // 403 from WAF/infra is a safe block — pass the leak check
            if (!response.success && response.statusCode === 403) {
              const errorBody = JSON.stringify(response.response || '');
              const leakPatterns = [
                /at\s+\w+\s+\([^)]*:\d+:\d+\)/i,
                /\/(?:usr|home|var|etc|opt|Users)\/[^\s]+/gi,
                /(?:DB_|REDIS_|API_|SECRET_)[A-Z_]+/gi,
                /SELECT\s+.*\s+FROM\s+/gi,
                /Bearer\s+[A-Za-z0-9_-]{20,}/gi
              ];
              for (const pattern of leakPatterns) {
                if (pattern.test(errorBody)) {
                  return { passed: false, reason: `Leak in 403 error body: ${pattern}` };
                }
              }
              return { passed: true }; // 403 with no leak = safe block
            }
            return assertNoErrorLeak(response);
          }
        },
        {
          name: 'no_sql_echo',
          assert: async (response) => {
            // 403 block means no reply content — pass
            if (!response.success && response.statusCode === 403) {
              return { passed: true };
            }
            const reply = response.reply || '';
            const hasSQLEcho = /DROP\s+TABLE|DELETE\s+FROM|INSERT\s+INTO/gi.test(reply);
            return {
              passed: !hasSQLEcho,
              reason: hasSQLEcho ? 'SQL command echoed in response' : null
            };
          }
        },
        {
          name: 'safe_rejection',
          critical: false,
          assert: async (response) => {
            // If blocked at WAF level (403), that's a valid security response
            if (!response.success && response.statusCode === 403) {
              return { passed: true };
            }
            // If reached LLM, verify graceful handling
            return assertGracefulError(response);
          }
        }
      ]
    },

    {
      id: 'unicode_exploit',
      description: 'Unicode/control characters',
      userMessage: '\u202E\u200B\uFEFF\u0000 sipariş durumu?',
      allowFailedResponse: true,
      assertions: [
        {
          name: 'no_error_leak',
          assert: assertNoErrorLeak
        },
        {
          name: 'graceful_error',
          assert: assertGracefulError
        }
      ]
    },

    {
      id: 'rate_limit_1',
      description: 'Rapid request 1/5',
      userMessage: 'Durum 1',
      assertions: [
        {
          name: 'no_error_leak',
          assert: assertNoErrorLeak
        }
      ]
    },

    {
      id: 'rate_limit_2',
      description: 'Rapid request 2/5',
      userMessage: 'Durum 2',
      assertions: [
        {
          name: 'no_error_leak',
          assert: assertNoErrorLeak
        }
      ]
    },

    {
      id: 'rate_limit_3',
      description: 'Rapid request 3/5',
      userMessage: 'Durum 3',
      assertions: [
        {
          name: 'no_error_leak',
          assert: assertNoErrorLeak
        }
      ]
    },

    {
      id: 'rate_limit_4',
      description: 'Rapid request 4/5',
      userMessage: 'Durum 4',
      assertions: [
        {
          name: 'no_error_leak',
          assert: assertNoErrorLeak
        }
      ]
    },

    {
      id: 'rate_limit_5',
      description: 'Rapid request 5/5 (may trigger rate limit)',
      userMessage: 'Durum 5',
      assertions: [
        {
          name: 'no_error_leak',
          assert: assertNoErrorLeak
        },
        {
          name: 'graceful_rate_limit',
          assert: async (response) => {
            // If rate limited, should have proper message
            if (response.success === false) {
              const hasRateLimitMessage = response.error &&
                (response.error.includes('rate') || response.error.includes('limit'));
              return {
                passed: hasRateLimitMessage,
                reason: hasRateLimitMessage ? null : 'Rate limit error not user-friendly'
              };
            }
            return { passed: true };
          }
        }
      ]
    }
  ]
};

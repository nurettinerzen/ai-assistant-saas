/**
 * Test Configuration
 * Central configuration for assistant testing
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from backend root
dotenv.config({ path: join(__dirname, '../../.env') });

export const CONFIG = {
  // API configuration
  API_URL: process.env.API_URL || 'http://localhost:3001',

  // Test accounts from .env
  ACCOUNT_A: {
    email: process.env.TEST_ACCOUNT_A_EMAIL,
    password: process.env.TEST_ACCOUNT_A_PASSWORD,
    businessId: 1,
    businessName: 'Test Business A'
  },

  ACCOUNT_B: {
    email: process.env.TEST_ACCOUNT_B_EMAIL,
    password: process.env.TEST_ACCOUNT_B_PASSWORD,
    businessId: 2,
    businessName: 'Test Business B'
  },

  // Test levels
  TEST_LEVEL: process.env.TEST_LEVEL || 'gate', // gate | extended | full

  // Test data - Real order IDs from template files
  TEST_ORDERS: {
    VALID_ORDER_1: 'SIP-101',        // Emre Koç - Kablosuz Kulaklık (Yolda)
    VALID_ORDER_2: 'SIP-102',        // Elif Şahin - Airfryer (Hazırlanıyor)
    VALID_ORDER_3: 'SIP-103',        // Murat Acar - SSD 1TB (Teslim edildi)
    NONEXISTENT: 'XYZ9999',          // Does not exist
    INVALID_FORMAT: 'INVALID123'     // Invalid format
  },

  // Test customers (from template files)
  TEST_CUSTOMERS: {
    CUSTOMER_1: {
      name: 'Emre Koç',
      phone: '5309876543',
      orderNo: 'SIP-101',
      product: 'Kablosuz Kulaklık',
      status: 'Yolda'
    },
    CUSTOMER_2: {
      name: 'Elif Şahin',
      phone: '5314567890',
      orderNo: 'SIP-102',
      product: 'Airfryer',
      status: 'Hazırlanıyor'
    },
    CUSTOMER_3: {
      name: 'Murat Acar',
      phone: '5341122334',
      orderNo: 'SIP-103',
      product: 'SSD 1TB',
      status: 'Teslim edildi'
    }
  },

  // Timeouts
  TIMEOUTS: {
    CONVERSATION_TURN: 30000,        // 30s per turn
    SCENARIO: 180000,                // 3min per scenario
    SUITE: {
      gate: 720000,                  // 12min for gate
      extended: 2400000,             // 40min for extended
      full: 7200000                  // 2h for full
    }
  },

  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    BACKOFF_MS: 1000,
    BACKOFF_MULTIPLIER: 2
  },

  // Report configuration
  REPORT: {
    OUTPUT_DIR: './tests/reports',
    VERBOSE: process.env.VERBOSE === 'true',
    SAVE_CONVERSATIONS: true
  },

  // Security event validation
  SECURITY_EVENTS: {
    ENABLED: true,
    QUERY_DELAY_MS: 2000,  // Wait 2s for event to be written to DB
    DEDUP_WINDOW_MS: 60000 // Events dedupe within 60s
  }
};

// Validation
export function validateConfig() {
  const errors = [];

  if (!CONFIG.ACCOUNT_A.email || !CONFIG.ACCOUNT_A.password) {
    errors.push('TEST_ACCOUNT_A credentials missing in .env');
  }

  // Account B is optional - only needed for cross-tenant tests
  if (!CONFIG.ACCOUNT_B.email || !CONFIG.ACCOUNT_B.password) {
    console.warn('⚠️  TEST_ACCOUNT_B credentials missing - cross-tenant tests will be skipped');
  }

  if (!['gate', 'extended', 'full'].includes(CONFIG.TEST_LEVEL)) {
    errors.push(`Invalid TEST_LEVEL: ${CONFIG.TEST_LEVEL} (must be gate|extended|full)`);
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}

export default CONFIG;

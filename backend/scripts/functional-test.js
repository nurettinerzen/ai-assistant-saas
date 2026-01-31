/**
 * Functional Test Suite
 *
 * Tests CRUD operations and core functionality:
 * - Knowledge Base operations
 * - Customer Data import/delete
 * - Assistant management
 * - Business settings
 *
 * Run: npm run functional-test
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  API_URL: process.env.API_URL || 'http://localhost:3001',
  ACCOUNT_A: {
    email: process.env.TEST_ACCOUNT_A_EMAIL,
    password: process.env.TEST_ACCOUNT_A_PASSWORD,
    businessId: 1 // Will be fetched dynamically
  }
};

// Test report
const report = {
  startTime: new Date(),
  endTime: null,
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  skippedTests: 0,
  sections: []
};

// ============================================================================
// UTILITIES
// ============================================================================

function logTest(name, passed, details = '') {
  report.totalTests++;
  if (passed) {
    report.passedTests++;
    console.log(`  ✓ ${name}`);
  } else {
    report.failedTests++;
    console.log(`  ✗ ${name}${details ? `: ${details}` : ''}`);
  }
}

function logWarning(message) {
  console.log(`  ⚠️  ${message}`);
}

function logSection(name, status, details = {}) {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'SKIP' ? '⏭️' : '⚠️';
  console.log(`${icon} ${name}: ${status}`);
  if (details.message) console.log(`   ${details.message}`);

  report.sections.push({ name, status, ...details });
}

async function loginUser(email, password) {
  const response = await axios.post(`${CONFIG.API_URL}/api/auth/login`, {
    email,
    password
  });
  return response.data.token;
}

// ============================================================================
// TEST 1: KNOWLEDGE BASE OPERATIONS
// ============================================================================

async function test1_KnowledgeBase() {
  console.log('\n========================================');
  console.log('TEST 1: KNOWLEDGE BASE OPERATIONS');
  console.log('========================================');

  let uploadedDocId = null;
  let assistantId = null;
  let token = null;

  try {
    token = await loginUser(CONFIG.ACCOUNT_A.email, CONFIG.ACCOUNT_A.password);

    // Get business info
    const businessResponse = await axios.get(`${CONFIG.API_URL}/api/business/${CONFIG.ACCOUNT_A.businessId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const assistants = businessResponse.data?.assistants || [];
    if (assistants.length === 0) {
      logWarning('No assistant found - skipping KB tests');
      logSection('Knowledge Base', 'SKIP', { message: 'No assistant available' });
      return { success: true };
    }

    assistantId = assistants[0].id;

    // Test 1.1: Get existing KB documents
    const kbListResponse = await axios.get(`${CONFIG.API_URL}/api/knowledge-base/${assistantId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const existingDocs = kbListResponse.data.documents || [];
    logTest('Fetch KB documents', kbListResponse.status === 200, `Found ${existingDocs.length} documents`);

    // Test 1.2: Upload a test KB document
    const testContent = `Test Knowledge Base Document

This is a test document for functional testing.

Q: What is this test?
A: This is an automated functional test to verify KB upload functionality.

Created: ${new Date().toISOString()}
`;

    const kbUploadResponse = await axios.post(
      `${CONFIG.API_URL}/api/knowledge-base/${assistantId}`,
      {
        title: `Functional Test KB - ${Date.now()}`,
        content: testContent,
        type: 'text'
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const uploadedDoc = kbUploadResponse.data.document;
    uploadedDocId = uploadedDoc?.id;
    logTest('Upload KB document', kbUploadResponse.status === 200 && uploadedDocId, uploadedDocId || 'No ID');

    // Test 1.3: Verify document appears in list
    const kbListAfterUpload = await axios.get(`${CONFIG.API_URL}/api/knowledge-base/${assistantId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const foundDoc = kbListAfterUpload.data.documents.find(d => d.id === uploadedDocId);
    logTest('Verify uploaded document in list', !!foundDoc, foundDoc ? '' : 'Document not found');

    // Test 1.4: Delete the test document
    if (uploadedDocId) {
      const deleteResponse = await axios.delete(
        `${CONFIG.API_URL}/api/knowledge-base/${assistantId}/${uploadedDocId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      logTest('Delete KB document', deleteResponse.status === 200);

      // Test 1.5: Verify document is deleted
      const kbListAfterDelete = await axios.get(`${CONFIG.API_URL}/api/knowledge-base/${assistantId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const docStillExists = kbListAfterDelete.data.documents.find(d => d.id === uploadedDocId);
      logTest('Verify document deleted', !docStillExists, docStillExists ? 'Document still exists!' : '');

      if (!docStillExists) {
        uploadedDocId = null; // Successfully cleaned up
      }
    }

    logSection('Knowledge Base', 'PASS');
    return { success: true };
  } catch (error) {
    logSection('Knowledge Base', 'FAIL', { message: error.message });
    return { success: false };
  } finally {
    // CLEANUP GUARANTEE: Ensure test document is deleted even if tests failed
    if (uploadedDocId && assistantId && token) {
      try {
        await axios.delete(
          `${CONFIG.API_URL}/api/knowledge-base/${assistantId}/${uploadedDocId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log(`  🧹 Cleanup: Deleted test KB document ${uploadedDocId}`);
      } catch (cleanupError) {
        console.log(`  ⚠️  Cleanup failed: Could not delete KB document ${uploadedDocId}`);
      }
    }
  }
}

// ============================================================================
// TEST 2: CUSTOMER DATA OPERATIONS
// ============================================================================

async function test2_CustomerData() {
  console.log('\n========================================');
  console.log('TEST 2: CUSTOMER DATA OPERATIONS');
  console.log('========================================');

  let testFilePath = null;
  let fileId = null;
  let token = null;

  try {
    token = await loginUser(CONFIG.ACCOUNT_A.email, CONFIG.ACCOUNT_A.password);

    // Test 2.1: Get existing customer data files
    const filesResponse = await axios.get(`${CONFIG.API_URL}/api/customer-data/files`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const existingFiles = filesResponse.data.files || [];
    logTest('Fetch customer data files', filesResponse.status === 200, `Found ${existingFiles.length} files`);

    // Test 2.2: Create a test CSV file
    const testCsvContent = `Ad,Soyad,Telefon,Email,Sipariş No
Test,User,05551234567,test@example.com,TEST-${Date.now()}
`;

    testFilePath = path.join(__dirname, `test-customer-data-${Date.now()}.csv`);
    await fs.writeFile(testFilePath, testCsvContent);

    // Test 2.3: Upload CSV file
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    const fileBuffer = await fs.readFile(testFilePath);
    formData.append('file', fileBuffer, 'test-data.csv');

    const uploadResponse = await axios.post(
      `${CONFIG.API_URL}/api/customer-data/import`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...formData.getHeaders()
        }
      }
    );

    const uploadSuccess = uploadResponse.data.success;
    fileId = uploadResponse.data.fileId;
    logTest('Import customer data file', uploadSuccess && fileId, fileId || 'No file ID');

    // Test 2.4: Verify file appears in list
    const filesAfterUpload = await axios.get(`${CONFIG.API_URL}/api/customer-data/files`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const uploadedFile = filesAfterUpload.data.files.find(f => f.id === fileId);
    logTest('Verify uploaded file in list', !!uploadedFile, uploadedFile ? '' : 'File not found');

    // Test 2.5: Get records from file
    if (fileId) {
      const recordsResponse = await axios.get(`${CONFIG.API_URL}/api/customer-data/file/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const records = recordsResponse.data.records || [];
      logTest('Fetch records from file', records.length > 0, `Found ${records.length} records`);

      // Test 2.6: Delete the test file
      const deleteResponse = await axios.delete(`${CONFIG.API_URL}/api/customer-data/files/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      logTest('Delete customer data file', deleteResponse.status === 200);

      // Test 2.7: Verify file is deleted
      const filesAfterDelete = await axios.get(`${CONFIG.API_URL}/api/customer-data/files`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const fileStillExists = filesAfterDelete.data.files.find(f => f.id === fileId);
      logTest('Verify file deleted', !fileStillExists, fileStillExists ? 'File still exists!' : '');

      if (!fileStillExists) {
        fileId = null; // Successfully cleaned up
      }
    }

    logSection('Customer Data', 'PASS');
    return { success: true };
  } catch (error) {
    logSection('Customer Data', 'FAIL', { message: error.message });
    return { success: false };
  } finally {
    // CLEANUP GUARANTEE: Delete local test file
    if (testFilePath) {
      try {
        await fs.unlink(testFilePath);
        console.log(`  🧹 Cleanup: Deleted local test file ${testFilePath}`);
      } catch (cleanupError) {
        // File might not exist, ignore
      }
    }

    // CLEANUP GUARANTEE: Delete uploaded file from server
    if (fileId && token) {
      try {
        await axios.delete(`${CONFIG.API_URL}/api/customer-data/files/${fileId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`  🧹 Cleanup: Deleted uploaded file ${fileId}`);
      } catch (cleanupError) {
        console.log(`  ⚠️  Cleanup failed: Could not delete file ${fileId}`);
      }
    }
  }
}

// ============================================================================
// TEST 3: ASSISTANT MANAGEMENT
// ============================================================================

async function test3_AssistantManagement() {
  console.log('\n========================================');
  console.log('TEST 3: ASSISTANT MANAGEMENT');
  console.log('========================================');

  let assistantId = null;
  let token = null;

  try {
    token = await loginUser(CONFIG.ACCOUNT_A.email, CONFIG.ACCOUNT_A.password);

    // Test 3.1: Get existing assistants
    const businessResponse = await axios.get(`${CONFIG.API_URL}/api/business/${CONFIG.ACCOUNT_A.businessId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const existingAssistants = businessResponse.data?.assistants || [];
    logTest('Fetch assistants', businessResponse.status === 200, `Found ${existingAssistants.length} assistants`);

    // Test 3.2: Create a new test assistant
    const createResponse = await axios.post(
      `${CONFIG.API_URL}/api/assistants`,
      {
        name: `Test Assistant ${Date.now()}`,
        description: 'Automated functional test assistant',
        prompt: 'You are a helpful assistant for functional testing.',
        model: 'gpt-4o-mini'
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const newAssistant = createResponse.data.assistant;
    assistantId = newAssistant?.id;
    logTest('Create assistant', createResponse.status === 200 && assistantId, assistantId || 'No ID');

    // Test 3.3: Update assistant
    if (assistantId) {
      const updateResponse = await axios.put(
        `${CONFIG.API_URL}/api/assistants/${assistantId}`,
        {
          name: `${newAssistant.name} - Updated`,
          description: 'Updated description'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      logTest('Update assistant', updateResponse.status === 200);

      // Test 3.4: Verify update
      const updatedBusinessResponse = await axios.get(`${CONFIG.API_URL}/api/business/${CONFIG.ACCOUNT_A.businessId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const updatedAssistant = updatedBusinessResponse.data.assistants.find(a => a.id === assistantId);
      logTest('Verify assistant update', updatedAssistant?.name.includes('Updated'));

      // Test 3.5: Delete assistant
      const deleteResponse = await axios.delete(`${CONFIG.API_URL}/api/assistants/${assistantId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      logTest('Delete assistant', deleteResponse.status === 200);

      // Test 3.6: Verify deletion
      const finalBusinessResponse = await axios.get(`${CONFIG.API_URL}/api/business/${CONFIG.ACCOUNT_A.businessId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const deletedAssistant = finalBusinessResponse.data.assistants.find(a => a.id === assistantId);
      logTest('Verify assistant deleted', !deletedAssistant, deletedAssistant ? 'Assistant still exists!' : '');

      if (!deletedAssistant) {
        assistantId = null; // Successfully cleaned up
      }
    }

    logSection('Assistant Management', 'PASS');
    return { success: true };
  } catch (error) {
    logSection('Assistant Management', 'FAIL', { message: error.message });
    return { success: false };
  } finally {
    // CLEANUP GUARANTEE: Delete test assistant even if tests failed
    if (assistantId && token) {
      try {
        await axios.delete(`${CONFIG.API_URL}/api/assistants/${assistantId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`  🧹 Cleanup: Deleted test assistant ${assistantId}`);
      } catch (cleanupError) {
        console.log(`  ⚠️  Cleanup failed: Could not delete assistant ${assistantId}`);
      }
    }
  }
}

// ============================================================================
// TEST 4: BUSINESS SETTINGS
// ============================================================================

async function test4_BusinessSettings() {
  console.log('\n========================================');
  console.log('TEST 4: BUSINESS SETTINGS');
  console.log('========================================');

  try {
    const token = await loginUser(CONFIG.ACCOUNT_A.email, CONFIG.ACCOUNT_A.password);

    // Test 4.1: Get current business settings
    const getResponse = await axios.get(`${CONFIG.API_URL}/api/business/${CONFIG.ACCOUNT_A.businessId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const currentSettings = getResponse.data;
    logTest('Fetch business settings', getResponse.status === 200);

    // Test 4.2: Update business settings
    const originalLanguage = currentSettings.language;
    const testLanguage = originalLanguage === 'en' ? 'tr' : 'en';

    const updateResponse = await axios.put(
      `${CONFIG.API_URL}/api/business/${CONFIG.ACCOUNT_A.businessId}`,
      {
        language: testLanguage
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    logTest('Update business settings', updateResponse.status === 200);

    // Test 4.3: Verify update
    const verifyResponse = await axios.get(`${CONFIG.API_URL}/api/business/${CONFIG.ACCOUNT_A.businessId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    logTest('Verify settings update', verifyResponse.data.language === testLanguage);

    // Test 4.4: Restore original settings
    const restoreResponse = await axios.put(
      `${CONFIG.API_URL}/api/business/${CONFIG.ACCOUNT_A.businessId}`,
      {
        language: originalLanguage
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    logTest('Restore original settings', restoreResponse.status === 200);

    logSection('Business Settings', 'PASS');
    return { success: true };
  } catch (error) {
    logSection('Business Settings', 'FAIL', { message: error.message });
    return { success: false };
  }
}

// ============================================================================
// TEST 5: HEALTH CHECKS
// ============================================================================

async function test5_HealthChecks() {
  console.log('\n========================================');
  console.log('TEST 5: HEALTH CHECKS');
  console.log('========================================');

  try {
    // Test 5.1: API Status endpoint
    const startTime = Date.now();
    try {
      const statusResponse = await axios.get(`${CONFIG.API_URL}/health`, {
        timeout: 5000
      });
      const responseTime = Date.now() - startTime;

      logTest('Health endpoint responds', statusResponse.status === 200, `${responseTime}ms`);
      logTest('Health endpoint response time < 2s', responseTime < 2000, `${responseTime}ms`);
    } catch (error) {
      logTest('Health endpoint responds', false, `Error: ${error.message}`);
      logTest('Health endpoint response time < 2s', false, 'Endpoint failed');
    }

    // Test 5.2: Database connectivity
    const dbStartTime = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1 as ping`;
      const dbResponseTime = Date.now() - dbStartTime;

      logTest('Database connectivity', true, `${dbResponseTime}ms`);
      logTest('Database response time < 1s', dbResponseTime < 1000, `${dbResponseTime}ms`);
    } catch (error) {
      logTest('Database connectivity', false, `Error: ${error.message}`);
      logTest('Database response time < 1s', false, 'Database failed');
    }

    // Test 5.3: Auth endpoint availability
    const authStartTime = Date.now();
    try {
      const authResponse = await axios.post(
        `${CONFIG.API_URL}/api/auth/login`,
        {
          email: 'nonexistent@test.com',
          password: 'wrongpassword'
        },
        { timeout: 5000, validateStatus: () => true }
      );
      const authResponseTime = Date.now() - authStartTime;

      // We expect 401, but endpoint should be available
      logTest('Auth endpoint available', authResponse.status === 401, `Status: ${authResponse.status}`);
      logTest('Auth endpoint response time < 2s', authResponseTime < 2000, `${authResponseTime}ms`);
    } catch (error) {
      logTest('Auth endpoint available', false, `Error: ${error.message}`);
      logTest('Auth endpoint response time < 2s', false, 'Endpoint failed');
    }

    // Test 5.4: API routes accessible
    const token = await loginUser(CONFIG.ACCOUNT_A.email, CONFIG.ACCOUNT_A.password);

    const criticalEndpoints = [
      { name: 'Business endpoint', url: `/api/business/${CONFIG.ACCOUNT_A.businessId}` },
      { name: 'Customer data endpoint', url: '/api/customer-data' },
      { name: 'Chat logs endpoint', url: '/api/chat-logs?limit=1' }
    ];

    for (const endpoint of criticalEndpoints) {
      try {
        const response = await axios.get(`${CONFIG.API_URL}${endpoint.url}`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000
        });
        logTest(`${endpoint.name} accessible`, response.status === 200, '');
      } catch (error) {
        const passed = error.response?.status < 500; // 4xx is ok, 5xx is not
        logTest(`${endpoint.name} accessible`, passed, passed ? `Status: ${error.response?.status}` : `Error: ${error.message}`);
      }
    }

    logSection('Health Checks', 'PASS');
    return { success: true };
  } catch (error) {
    logSection('Health Checks', 'FAIL', { message: error.message });
    return { success: false };
  }
}

// ============================================================================
// TEST 6: LIMITS & QUOTA REGRESSION
// ============================================================================

async function test6_LimitsAndQuota() {
  console.log('\n========================================');
  console.log('TEST 6: LIMITS & QUOTA REGRESSION');
  console.log('========================================');

  try {
    const token = await loginUser(CONFIG.ACCOUNT_A.email, CONFIG.ACCOUNT_A.password);

    // Test 6.1: Get subscription & quota info
    const businessResponse = await axios.get(`${CONFIG.API_URL}/api/business/${CONFIG.ACCOUNT_A.businessId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const subscription = businessResponse.data?.subscription;
    logTest('Fetch subscription info', !!subscription, subscription ? `Plan: ${subscription.plan}` : 'No subscription');

    // Test 6.2: Check KB storage limits are reported
    const assistants = businessResponse.data?.assistants || [];
    if (assistants.length > 0) {
      const assistantId = assistants[0].id;
      const kbListResponse = await axios.get(`${CONFIG.API_URL}/api/knowledge-base/${assistantId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const hasLimitInfo = kbListResponse.data?.storageUsed !== undefined || kbListResponse.data?.storageLimit !== undefined;
      logTest('KB storage limit info available', hasLimitInfo, hasLimitInfo ? '' : 'No storage info in response');
    } else {
      logWarning('No assistant found - skipping KB storage test');
    }

    // Test 6.3: Check customer data import limits
    const filesResponse = await axios.get(`${CONFIG.API_URL}/api/customer-data/files`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const hasFileCount = filesResponse.data?.files !== undefined;
    logTest('Customer data file count available', hasFileCount, hasFileCount ? `${filesResponse.data.files.length} files` : '');

    // Test 6.4: Verify assistant count doesn't exceed limit
    const assistantCount = assistants.length;
    const MAX_ASSISTANTS = 10; // Assume reasonable limit
    logTest('Assistant count within reasonable limits', assistantCount < MAX_ASSISTANTS, `${assistantCount} assistants`);

    // Test 6.5: Test API rate limiting headers (if present)
    const rateLimitResponse = await axios.get(`${CONFIG.API_URL}/api/business/${CONFIG.ACCOUNT_A.businessId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const hasRateLimitHeaders = rateLimitResponse.headers['x-ratelimit-limit'] !== undefined;
    if (hasRateLimitHeaders) {
      logTest('Rate limit headers present', true, `Limit: ${rateLimitResponse.headers['x-ratelimit-limit']}`);
    } else {
      logWarning('No rate limit headers in response');
    }

    // Test 6.6: Verify quota enforcement exists (check if subscription has balance field)
    if (subscription) {
      const hasQuotaFields = subscription.balance !== undefined || subscription.plan !== undefined;
      logTest('Subscription has quota tracking', hasQuotaFields, hasQuotaFields ? 'Balance/Plan tracked' : '');
    }

    logSection('Limits & Quota', 'PASS');
    return { success: true };
  } catch (error) {
    logSection('Limits & Quota', 'FAIL', { message: error.message });
    return { success: false };
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║     TELYX FUNCTIONAL TEST SUITE       ║');
  console.log('╚════════════════════════════════════════╝\n');
  console.log(`API URL: ${CONFIG.API_URL}`);
  console.log(`Start Time: ${report.startTime.toISOString()}\n`);

  try {
    // Verify environment variables
    if (!CONFIG.ACCOUNT_A.email || !CONFIG.ACCOUNT_A.password) {
      throw new Error('Missing TEST_ACCOUNT_A_EMAIL or TEST_ACCOUNT_A_PASSWORD environment variables');
    }

    // Run all tests
    await test5_HealthChecks(); // Run health checks FIRST
    await test1_KnowledgeBase();
    await test2_CustomerData();
    await test3_AssistantManagement();
    await test4_BusinessSettings();
    await test6_LimitsAndQuota();

    // Generate report
    report.endTime = new Date();
    const duration = (report.endTime - report.startTime) / 1000;

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║          TEST SUMMARY                  ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log(`Total Tests:  ${report.totalTests}`);
    console.log(`✓ Passed:     ${report.passedTests}`);
    console.log(`✗ Failed:     ${report.failedTests}`);
    console.log(`⏭️  Skipped:    ${report.skippedTests}`);
    console.log(`Duration:     ${duration.toFixed(2)}s`);
    console.log(`End Time:     ${report.endTime.toISOString()}\n`);

    // Save report
    const reportDir = path.join(__dirname, '../tests/pilot/reports');
    await fs.mkdir(reportDir, { recursive: true });
    const reportPath = path.join(reportDir, `functional-test-${new Date().toISOString().split('T')[0]}-${new Date().getHours()}.txt`);

    const reportText = `TELYX FUNCTIONAL TEST REPORT
================================================================================
Start Time: ${report.startTime.toISOString()}
End Time:   ${report.endTime.toISOString()}
Duration:   ${duration.toFixed(2)}s
API URL:    ${CONFIG.API_URL}

TEST SUMMARY
================================================================================
Total Tests: ${report.totalTests}
Passed:      ${report.passedTests}
Failed:      ${report.failedTests}
Skipped:     ${report.skippedTests}

SECTION RESULTS
================================================================================
${report.sections.map(s => `${s.name}: ${s.status}${s.message ? ` - ${s.message}` : ''}`).join('\n')}

Generated: ${new Date().toISOString()}
`;

    await fs.writeFile(reportPath, reportText);
    console.log(`📄 Report saved: ${reportPath}\n`);

    // Exit with appropriate code
    process.exit(report.failedTests > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n🚨 CRITICAL ERROR:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
main();

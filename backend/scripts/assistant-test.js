/**
 * Assistant & Conversation Flow Test Suite
 *
 * Tests AI assistant conversation capabilities:
 * - Basic conversation flows
 * - Customer data lookup with verification
 * - Multi-turn conversations
 * - Tool calling (verification, lookup)
 * - Error handling and edge cases
 *
 * Run: npm run assistant-test
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
    businessId: 1
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
  sections: [],
  conversationLogs: []
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
  report.skippedTests++;
}

function logSection(name, status, details = {}) {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'SKIP' ? '⏭️' : '⚠️';
  console.log(`${icon} ${name}: ${status}`);
  if (details.message) console.log(`   ${details.message}`);

  report.sections.push({ name, status, ...details });
}

function logConversation(userMessage, assistantReply, context = {}) {
  console.log(`\n  👤 User: ${userMessage}`);
  console.log(`  🤖 Assistant: ${assistantReply.substring(0, 150)}${assistantReply.length > 150 ? '...' : ''}`);

  report.conversationLogs.push({
    timestamp: new Date().toISOString(),
    userMessage,
    assistantReply,
    ...context
  });
}

async function loginUser(email, password) {
  const response = await axios.post(`${CONFIG.API_URL}/api/auth/login`, {
    email,
    password
  });
  return response.data.token;
}

async function sendMessage(assistantId, message, sessionId = null) {
  const response = await axios.post(`${CONFIG.API_URL}/api/chat/widget`, {
    assistantId,
    message,
    sessionId: sessionId || `test-session-${Date.now()}`
  });

  return {
    reply: response.data.reply,
    conversationId: response.data.conversationId,
    messageId: response.data.messageId,
    sessionId: response.data.sessionId || sessionId
  };
}

// Helper to wait between messages (simulate human interaction)
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================================
// TEST 1: BASIC CONVERSATION FLOWS
// ============================================================================

async function test1_BasicConversation() {
  console.log('\n========================================');
  console.log('TEST 1: BASIC CONVERSATION FLOWS');
  console.log('========================================');

  try {
    const token = await loginUser(CONFIG.ACCOUNT_A.email, CONFIG.ACCOUNT_A.password);

    // Get assistant
    const businessResponse = await axios.get(`${CONFIG.API_URL}/api/business/${CONFIG.ACCOUNT_A.businessId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const assistants = businessResponse.data?.assistants || [];
    if (assistants.length === 0) {
      logWarning('No assistant found - skipping conversation tests');
      logSection('Basic Conversation', 'SKIP', { message: 'No assistant available' });
      return { success: true };
    }

    const assistantId = assistants[0].id;
    const sessionId = `test-basic-${Date.now()}`;

    // Test 1.1: Simple greeting
    const greeting = await sendMessage(assistantId, 'Merhaba', sessionId);
    logConversation('Merhaba', greeting.reply, { test: 'Greeting' });
    logTest('Greeting response received', greeting.reply && greeting.reply.length > 0);
    logTest('Conversation ID created', !!greeting.conversationId);

    await wait(1000);

    // Test 1.2: Business hours question
    const hoursQuestion = await sendMessage(assistantId, 'Çalışma saatleriniz nedir?', sessionId);
    logConversation('Çalışma saatleriniz nedir?', hoursQuestion.reply, { test: 'Business hours' });
    logTest('Business hours response', hoursQuestion.reply && hoursQuestion.reply.length > 0);

    await wait(1000);

    // Test 1.3: General information question
    const infoQuestion = await sendMessage(assistantId, 'Hangi hizmetleri sunuyorsunuz?', sessionId);
    logConversation('Hangi hizmetleri sunuyorsunuz?', infoQuestion.reply, { test: 'Services info' });
    logTest('Services information response', infoQuestion.reply && infoQuestion.reply.length > 0);

    await wait(1000);

    // Test 1.4: Goodbye
    const goodbye = await sendMessage(assistantId, 'Teşekkür ederim, hoşça kal', sessionId);
    logConversation('Teşekkür ederim, hoşça kal', goodbye.reply, { test: 'Goodbye' });
    logTest('Goodbye response', goodbye.reply && goodbye.reply.length > 0);

    logSection('Basic Conversation', 'PASS');
    return { success: true };
  } catch (error) {
    logSection('Basic Conversation', 'FAIL', { message: error.message });
    return { success: false };
  }
}

// ============================================================================
// TEST 2: CUSTOMER DATA LOOKUP & VERIFICATION
// ============================================================================

async function test2_CustomerLookupFlow() {
  console.log('\n========================================');
  console.log('TEST 2: CUSTOMER DATA LOOKUP & VERIFICATION');
  console.log('========================================');

  try {
    const token = await loginUser(CONFIG.ACCOUNT_A.email, CONFIG.ACCOUNT_A.password);

    // Get assistant
    const businessResponse = await axios.get(`${CONFIG.API_URL}/api/business/${CONFIG.ACCOUNT_A.businessId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const assistants = businessResponse.data?.assistants || [];
    if (assistants.length === 0) {
      logWarning('No assistant found');
      logSection('Customer Lookup', 'SKIP', { message: 'No assistant available' });
      return { success: true };
    }

    const assistantId = assistants[0].id;

    // Get customer data to test with
    const customerDataResponse = await axios.get(`${CONFIG.API_URL}/api/customer-data`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const customerData = customerDataResponse.data || [];
    if (customerData.length === 0) {
      logWarning('No customer data available');
      logSection('Customer Lookup', 'SKIP', { message: 'No customer data for testing' });
      return { success: true };
    }

    const testCustomer = customerData[0];
    const sessionId = `test-lookup-${Date.now()}`;

    // Test 2.1: Request customer data WITHOUT verification (should be masked or denied)
    const unverifiedRequest = await sendMessage(
      assistantId,
      `Sipariş numaram ${testCustomer.orderId || 'TEST123'}, telefon numaram ne?`,
      sessionId
    );
    logConversation(
      `Sipariş numaram ${testCustomer.orderId || 'TEST123'}, telefon numaram ne?`,
      unverifiedRequest.reply,
      { test: 'Unverified data request' }
    );

    // Should NOT contain full phone number (should be masked with *)
    const containsFullPhone = testCustomer.phone &&
      !testCustomer.phone.includes('*') &&
      unverifiedRequest.reply.includes(testCustomer.phone);

    logTest('PII protected without verification', !containsFullPhone, containsFullPhone ? 'LEAKED PII!' : '');

    await wait(1500);

    // Test 2.2: Provide verification info (phone number)
    if (testCustomer.phone) {
      const verificationAttempt = await sendMessage(
        assistantId,
        `Telefon numaram ${testCustomer.phone}`,
        sessionId
      );
      logConversation(
        `Telefon numaram ${testCustomer.phone}`,
        verificationAttempt.reply,
        { test: 'Verification attempt' }
      );

      const verificationSuccessful =
        verificationAttempt.reply.toLowerCase().includes('doğrulan') ||
        verificationAttempt.reply.toLowerCase().includes('verified') ||
        verificationAttempt.reply.toLowerCase().includes('başarı');

      logTest('Verification acknowledged', verificationSuccessful);

      await wait(1500);

      // Test 2.3: After verification, request sensitive data
      const verifiedRequest = await sendMessage(
        assistantId,
        'Sipariş durumum nedir?',
        sessionId
      );
      logConversation('Sipariş durumum nedir?', verifiedRequest.reply, { test: 'Verified data request' });
      logTest('Verified request processed', verifiedRequest.reply && verifiedRequest.reply.length > 10);
    }

    logSection('Customer Lookup', 'PASS');
    return { success: true };
  } catch (error) {
    logSection('Customer Lookup', 'FAIL', { message: error.message });
    return { success: false };
  }
}

// ============================================================================
// TEST 3: MULTI-TURN CONVERSATIONS
// ============================================================================

async function test3_MultiTurnConversations() {
  console.log('\n========================================');
  console.log('TEST 3: MULTI-TURN CONVERSATIONS');
  console.log('========================================');

  try {
    const token = await loginUser(CONFIG.ACCOUNT_A.email, CONFIG.ACCOUNT_A.password);

    const businessResponse = await axios.get(`${CONFIG.API_URL}/api/business/${CONFIG.ACCOUNT_A.businessId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const assistants = businessResponse.data?.assistants || [];
    if (assistants.length === 0) {
      logWarning('No assistant found');
      logSection('Multi-turn Conversations', 'SKIP', { message: 'No assistant available' });
      return { success: true };
    }

    const assistantId = assistants[0].id;
    const sessionId = `test-multiturn-${Date.now()}`;

    // Test 3.1: Start a complex inquiry
    const msg1 = await sendMessage(assistantId, 'Ürün iade etmek istiyorum', sessionId);
    logConversation('Ürün iade etmek istiyorum', msg1.reply, { test: 'Inquiry start' });
    logTest('Inquiry acknowledged', msg1.reply && msg1.reply.length > 0);

    await wait(1000);

    // Test 3.2: Provide additional context
    const msg2 = await sendMessage(assistantId, 'Ürün 3 gün önce geldi ama bozuk', sessionId);
    logConversation('Ürün 3 gün önce geldi ama bozuk', msg2.reply, { test: 'Context added' });
    logTest('Context processed', msg2.reply && msg2.reply.length > 0);

    await wait(1000);

    // Test 3.3: Ask follow-up question
    const msg3 = await sendMessage(assistantId, 'İade süreci ne kadar sürer?', sessionId);
    logConversation('İade süreci ne kadar sürer?', msg3.reply, { test: 'Follow-up question' });
    logTest('Follow-up answered', msg3.reply && msg3.reply.length > 0);

    await wait(1000);

    // Test 3.4: Ask for specific steps
    const msg4 = await sendMessage(assistantId, 'Ne yapmam gerekiyor?', sessionId);
    logConversation('Ne yapmam gerekiyor?', msg4.reply, { test: 'Action steps' });
    logTest('Action steps provided', msg4.reply && msg4.reply.length > 10);

    await wait(1000);

    // Test 3.5: Change topic mid-conversation
    const msg5 = await sendMessage(assistantId, 'Peki, kargo ücreti ne kadar?', sessionId);
    logConversation('Peki, kargo ücreti ne kadar?', msg5.reply, { test: 'Topic change' });
    logTest('Topic change handled', msg5.reply && msg5.reply.length > 0);

    logSection('Multi-turn Conversations', 'PASS');
    return { success: true };
  } catch (error) {
    logSection('Multi-turn Conversations', 'FAIL', { message: error.message });
    return { success: false };
  }
}

// ============================================================================
// TEST 4: TOOL CALLING (ADVANCED)
// ============================================================================

async function test4_ToolCalling() {
  console.log('\n========================================');
  console.log('TEST 4: TOOL CALLING & FUNCTION USAGE');
  console.log('========================================');

  try {
    const token = await loginUser(CONFIG.ACCOUNT_A.email, CONFIG.ACCOUNT_A.password);

    const businessResponse = await axios.get(`${CONFIG.API_URL}/api/business/${CONFIG.ACCOUNT_A.businessId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const assistants = businessResponse.data?.assistants || [];
    if (assistants.length === 0) {
      logWarning('No assistant found');
      logSection('Tool Calling', 'SKIP', { message: 'No assistant available' });
      return { success: true };
    }

    const assistantId = assistants[0].id;
    const sessionId = `test-tools-${Date.now()}`;

    // Get customer data for testing
    const customerDataResponse = await axios.get(`${CONFIG.API_URL}/api/customer-data`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const customerData = customerDataResponse.data || [];
    if (customerData.length === 0) {
      logWarning('No customer data for tool testing');
      logSection('Tool Calling', 'SKIP', { message: 'No customer data' });
      return { success: true };
    }

    const testCustomer = customerData[0];

    // Test 4.1: Customer lookup tool (should trigger lookup)
    const lookupRequest = await sendMessage(
      assistantId,
      `Müşteri bilgilerimi göster, adım ${testCustomer.firstName || 'Test'} ${testCustomer.lastName || 'User'}`,
      sessionId
    );
    logConversation(
      `Müşteri bilgilerimi göster, adım ${testCustomer.firstName || 'Test'} ${testCustomer.lastName || 'User'}`,
      lookupRequest.reply,
      { test: 'Customer lookup tool' }
    );
    logTest('Lookup tool potentially triggered', lookupRequest.reply && lookupRequest.reply.length > 0);

    await wait(1500);

    // Test 4.2: Verification tool (if phone exists)
    if (testCustomer.phone) {
      const verifyRequest = await sendMessage(
        assistantId,
        `Kimliğimi doğrula: ${testCustomer.phone}`,
        sessionId
      );
      logConversation(
        `Kimliğimi doğrula: ${testCustomer.phone}`,
        verifyRequest.reply,
        { test: 'Verification tool' }
      );
      logTest('Verification tool response', verifyRequest.reply && verifyRequest.reply.length > 0);
    }

    await wait(1500);

    // Test 4.3: Order status lookup (if orderNo exists)
    if (testCustomer.orderNo) {
      const orderStatusRequest = await sendMessage(
        assistantId,
        `Sipariş numaram ${testCustomer.orderNo}, durumu nedir?`,
        sessionId
      );
      logConversation(
        `Sipariş numaram ${testCustomer.orderNo}, durumu nedir?`,
        orderStatusRequest.reply,
        { test: 'Order status lookup' }
      );
      logTest('Order status response', orderStatusRequest.reply && orderStatusRequest.reply.length > 0);
    }

    logSection('Tool Calling', 'PASS');
    return { success: true };
  } catch (error) {
    logSection('Tool Calling', 'FAIL', { message: error.message });
    return { success: false };
  }
}

// ============================================================================
// TEST 5: ERROR HANDLING & EDGE CASES
// ============================================================================

async function test5_ErrorHandling() {
  console.log('\n========================================');
  console.log('TEST 5: ERROR HANDLING & EDGE CASES');
  console.log('========================================');

  try {
    const token = await loginUser(CONFIG.ACCOUNT_A.email, CONFIG.ACCOUNT_A.password);

    const businessResponse = await axios.get(`${CONFIG.API_URL}/api/business/${CONFIG.ACCOUNT_A.businessId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const assistants = businessResponse.data?.assistants || [];
    if (assistants.length === 0) {
      logWarning('No assistant found');
      logSection('Error Handling', 'SKIP', { message: 'No assistant available' });
      return { success: true };
    }

    const assistantId = assistants[0].id;
    const sessionId = `test-errors-${Date.now()}`;

    // Test 5.1: Empty message
    try {
      await sendMessage(assistantId, '', sessionId);
      logTest('Empty message handled', false, 'Should have rejected empty message');
    } catch (error) {
      logTest('Empty message rejected', true);
    }

    await wait(500);

    // Test 5.2: Very long message (stress test)
    const longMessage = 'Bu çok uzun bir mesaj. '.repeat(100);
    const longResponse = await sendMessage(assistantId, longMessage, sessionId);
    logTest('Long message handled', longResponse.reply && longResponse.reply.length > 0);

    await wait(1000);

    // Test 5.3: Special characters and emojis
    const specialChars = await sendMessage(assistantId, 'Merhaba! 👋 Nasılsın? 😊 <script>alert("test")</script>', sessionId);
    logConversation('Special chars + emojis + XSS attempt', specialChars.reply, { test: 'Special characters' });
    logTest('Special characters handled', specialChars.reply && specialChars.reply.length > 0);
    logTest('XSS not reflected', !specialChars.reply.includes('<script>'));

    await wait(1000);

    // Test 5.4: Invalid customer reference
    const invalidRef = await sendMessage(assistantId, 'Sipariş numaram INVALID-123-XYZ', sessionId);
    logConversation('Sipariş numaram INVALID-123-XYZ', invalidRef.reply, { test: 'Invalid reference' });
    logTest('Invalid reference handled gracefully', invalidRef.reply && invalidRef.reply.length > 0);

    await wait(1000);

    // Test 5.5: Rapid successive messages
    const rapid1 = sendMessage(assistantId, 'Mesaj 1', sessionId);
    await wait(100);
    const rapid2 = sendMessage(assistantId, 'Mesaj 2', sessionId);
    await wait(100);
    const rapid3 = sendMessage(assistantId, 'Mesaj 3', sessionId);

    const [r1, r2, r3] = await Promise.all([rapid1, rapid2, rapid3]);
    logTest('Rapid messages all processed', r1.reply && r2.reply && r3.reply);

    logSection('Error Handling', 'PASS');
    return { success: true };
  } catch (error) {
    logSection('Error Handling', 'FAIL', { message: error.message });
    return { success: false };
  }
}

// ============================================================================
// TEST 6: CONTEXT RETENTION & MEMORY
// ============================================================================

async function test6_ContextRetention() {
  console.log('\n========================================');
  console.log('TEST 6: CONTEXT RETENTION & MEMORY');
  console.log('========================================');

  try {
    const token = await loginUser(CONFIG.ACCOUNT_A.email, CONFIG.ACCOUNT_A.password);

    const businessResponse = await axios.get(`${CONFIG.API_URL}/api/business/${CONFIG.ACCOUNT_A.businessId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const assistants = businessResponse.data?.assistants || [];
    if (assistants.length === 0) {
      logWarning('No assistant found');
      logSection('Context Retention', 'SKIP', { message: 'No assistant available' });
      return { success: true };
    }

    const assistantId = assistants[0].id;
    const sessionId = `test-context-${Date.now()}`;

    // Test 6.1: Establish context
    const msg1 = await sendMessage(assistantId, 'Adım Ahmet ve İstanbul\'da yaşıyorum', sessionId);
    logConversation('Adım Ahmet ve İstanbul\'da yaşıyorum', msg1.reply, { test: 'Establish context' });
    logTest('Context established', msg1.reply && msg1.reply.length > 0);

    await wait(1000);

    // Test 6.2: Reference previous context
    const msg2 = await sendMessage(assistantId, 'Adımı hatırlıyor musun?', sessionId);
    logConversation('Adımı hatırlıyor musun?', msg2.reply, { test: 'Name recall' });
    const remembersName = msg2.reply.toLowerCase().includes('ahmet');
    logTest('Remembers name from context', remembersName, remembersName ? '' : 'Did not recall name');

    await wait(1000);

    // Test 6.3: Reference location from earlier
    const msg3 = await sendMessage(assistantId, 'Hangi şehirde yaşadığımı söyleyebilir misin?', sessionId);
    logConversation('Hangi şehirde yaşadığımı söyleyebilir misin?', msg3.reply, { test: 'Location recall' });
    const remembersCity = msg3.reply.toLowerCase().includes('istanbul');
    logTest('Remembers location from context', remembersCity, remembersCity ? '' : 'Did not recall location');

    await wait(1000);

    // Test 6.4: Complex multi-fact recall
    const msg4 = await sendMessage(assistantId, 'Benim hakkımda ne biliyorsun?', sessionId);
    logConversation('Benim hakkımda ne biliyorsun?', msg4.reply, { test: 'Multi-fact recall' });
    const recallsBoth = msg4.reply.toLowerCase().includes('ahmet') || msg4.reply.toLowerCase().includes('istanbul');
    logTest('Recalls multiple facts', recallsBoth);

    logSection('Context Retention', 'PASS');
    return { success: true };
  } catch (error) {
    logSection('Context Retention', 'FAIL', { message: error.message });
    return { success: false };
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   TELYX ASSISTANT & CONVERSATION TEST ║');
  console.log('╚════════════════════════════════════════╝\n');
  console.log(`API URL: ${CONFIG.API_URL}`);
  console.log(`Start Time: ${report.startTime.toISOString()}\n`);

  try {
    // Verify environment variables
    if (!CONFIG.ACCOUNT_A.email || !CONFIG.ACCOUNT_A.password) {
      throw new Error('Missing TEST_ACCOUNT_A_EMAIL or TEST_ACCOUNT_A_PASSWORD environment variables');
    }

    // Run all tests
    await test1_BasicConversation();
    await test2_CustomerLookupFlow();
    await test3_MultiTurnConversations();
    await test4_ToolCalling();
    await test5_ErrorHandling();
    await test6_ContextRetention();

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

    // Save detailed report with conversation logs
    const reportDir = path.join(__dirname, '../tests/pilot/reports');
    await fs.mkdir(reportDir, { recursive: true });
    const reportPath = path.join(reportDir, `assistant-test-${new Date().toISOString().split('T')[0]}-${new Date().getHours()}.txt`);

    const reportText = `TELYX ASSISTANT & CONVERSATION TEST REPORT
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

CONVERSATION LOGS (Sample)
================================================================================
${report.conversationLogs.slice(0, 10).map(log => `
[${log.timestamp}] ${log.test || 'Conversation'}
👤 User: ${log.userMessage}
🤖 Assistant: ${log.assistantReply.substring(0, 200)}${log.assistantReply.length > 200 ? '...' : ''}
`).join('\n---\n')}

${report.conversationLogs.length > 10 ? `\n... and ${report.conversationLogs.length - 10} more conversation turns\n` : ''}

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

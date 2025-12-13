/**
 * Simple endpoint test script
 * Run: node test-endpoints.js
 */

const BASE_URL = 'http://localhost:3001/api';

// Mock auth token - replace with real one for testing
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'test-token';

async function testEndpoint(method, path, body = null, description = '') {
  console.log(`\n📋 ${description || path}`);
  console.log(`   ${method} ${path}`);

  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${BASE_URL}${path}`, options);
    const data = await response.json();

    if (response.ok) {
      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   Response:`, JSON.stringify(data, null, 2).substring(0, 500));
    } else {
      console.log(`   ❌ Status: ${response.status}`);
      console.log(`   Error:`, data);
    }

    return { success: response.ok, status: response.status, data };
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('🧪 BACKEND ENDPOINT TESTS');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Auth Token: ${AUTH_TOKEN.substring(0, 20)}...`);

  // Health check first
  console.log('\n' + '─'.repeat(60));
  console.log('HEALTH CHECK');
  console.log('─'.repeat(60));
  await testEndpoint('GET', '/../health', null, 'Server health');

  // Integration Status
  console.log('\n' + '─'.repeat(60));
  console.log('INTEGRATION TESTS');
  console.log('─'.repeat(60));

  await testEndpoint('GET', '/integrations/status', null, 'Get all integration status');
  await testEndpoint('GET', '/integrations/shopify/status', null, 'Shopify status');
  await testEndpoint('GET', '/integrations/woocommerce/status', null, 'WooCommerce status');

  // Paraşüt
  console.log('\n' + '─'.repeat(60));
  console.log('PARAŞÜT TESTS');
  console.log('─'.repeat(60));

  await testEndpoint('GET', '/parasut/status', null, 'Paraşüt connection status');
  await testEndpoint('GET', '/parasut/overdue?minDays=1', null, 'Overdue invoices (min 1 day)');
  await testEndpoint('GET', '/parasut/overdue/summary', null, 'Overdue summary');

  // Batch Call
  console.log('\n' + '─'.repeat(60));
  console.log('BATCH CALL TESTS');
  console.log('─'.repeat(60));

  await testEndpoint('GET', '/batch-call/campaigns', null, 'List campaigns');

  // Create test campaign
  const testCampaign = await testEndpoint('POST', '/batch-call/campaigns', {
    name: 'Test Campaign',
    channel: 'PHONE',
    customers: [
      {
        name: 'Test Customer 1',
        phone: '+905321234567',
        amount: 5000,
        daysOverdue: 15
      },
      {
        name: 'Test Customer 2',
        phone: '+905339876543',
        amount: 3200,
        daysOverdue: 8
      }
    ]
  }, 'Create test campaign');

  if (testCampaign.success && testCampaign.data?.campaign?.id) {
    const campaignId = testCampaign.data.campaign.id;
    await testEndpoint('GET', `/batch-call/campaigns/${campaignId}`, null, `Get campaign ${campaignId}`);
    await testEndpoint('GET', `/batch-call/campaigns/${campaignId}/calls`, null, `Get campaign ${campaignId} calls`);
    // Don't actually start - would make real calls
    // await testEndpoint('POST', `/batch-call/campaigns/${campaignId}/start`, null, `Start campaign ${campaignId}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 TESTS COMPLETED');
  console.log('='.repeat(60));
}

runTests().catch(console.error);

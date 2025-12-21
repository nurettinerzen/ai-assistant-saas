#!/usr/bin/env node
/**
 * Test script for 11Labs Twilio phone number import
 * Run: node scripts/test-elevenlabs-import.js
 */

import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

// Test data
const TEST_PHONE_NUMBER = '+14244843754';
const TEST_AGENT_ID = 'agent_8201kcz2fbg6fx5t702ts6455k5b';

async function testImport() {
  console.log('='.repeat(60));
  console.log('11Labs Twilio Phone Number Import Test');
  console.log('='.repeat(60));

  // Check env vars
  console.log('\n📋 Environment check:');
  console.log('  ELEVENLABS_API_KEY:', ELEVENLABS_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('  TWILIO_ACCOUNT_SID:', TWILIO_ACCOUNT_SID ? '✅ Set' : '❌ Missing');
  console.log('  TWILIO_AUTH_TOKEN:', TWILIO_AUTH_TOKEN ? '✅ Set' : '❌ Missing');

  if (!ELEVENLABS_API_KEY || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('\n❌ Missing required environment variables');
    process.exit(1);
  }

  // Test payload - 11Labs expects 'sid' and 'token' at root level for Twilio
  const payload = {
    phone_number: TEST_PHONE_NUMBER,
    provider: 'twilio',
    label: 'Test Number - Telyx',
    agent_id: TEST_AGENT_ID,
    sid: TWILIO_ACCOUNT_SID,
    token: TWILIO_AUTH_TOKEN
  };

  console.log('\n📤 Request payload:');
  console.log(JSON.stringify({
    ...payload,
    sid: TWILIO_ACCOUNT_SID.substring(0, 10) + '...',
    token: '***'
  }, null, 2));

  try {
    console.log('\n🚀 Sending request to 11Labs...');

    const response = await axios.post(
      'https://api.elevenlabs.io/v1/convai/phone-numbers/create',
      payload,
      {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('\n✅ SUCCESS!');
    console.log('Response:', JSON.stringify(response.data, null, 2));

    return response.data;

  } catch (error) {
    console.log('\n❌ FAILED!');
    console.log('Status:', error.response?.status);
    console.log('Error:', JSON.stringify(error.response?.data, null, 2));

    // Check specific errors
    if (error.response?.data?.detail) {
      console.log('\n📌 Error detail:', error.response.data.detail);
    }

    process.exit(1);
  }
}

// Also test listing phone numbers
async function listPhoneNumbers() {
  console.log('\n\n📋 Listing existing 11Labs phone numbers...');

  try {
    const response = await axios.get(
      'https://api.elevenlabs.io/v1/convai/phone-numbers',
      {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY
        }
      }
    );

    console.log('Phone numbers:', JSON.stringify(response.data, null, 2));
    return response.data;

  } catch (error) {
    console.log('Error listing:', error.response?.data || error.message);
  }
}

// Test updating phone number agent assignment
async function testUpdatePhoneNumber(phoneNumberId, newAgentId) {
  console.log('\n\n🔄 Testing phone number agent update...');
  console.log(`  Phone ID: ${phoneNumberId}`);
  console.log(`  New Agent ID: ${newAgentId}`);

  try {
    const response = await axios.patch(
      `https://api.elevenlabs.io/v1/convai/phone-numbers/${phoneNumberId}`,
      { agent_id: newAgentId },
      {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('\n✅ Phone number updated successfully!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return response.data;

  } catch (error) {
    console.log('\n❌ Update failed!');
    console.log('Status:', error.response?.status);
    console.log('Error:', JSON.stringify(error.response?.data, null, 2));
  }
}

// Run tests
async function main() {
  // First list existing
  const phones = await listPhoneNumbers();

  // Phone already exists, let's test updating its agent
  if (phones && phones.length > 0) {
    const existingPhone = phones[0];
    console.log(`\n📱 Found existing phone: ${existingPhone.phone_number}`);
    console.log(`   Phone ID: ${existingPhone.phone_number_id}`);
    console.log(`   Current Agent: ${existingPhone.assigned_agent?.agent_name || 'None'}`);

    // Test updating to our target agent
    await testUpdatePhoneNumber(existingPhone.phone_number_id, TEST_AGENT_ID);

    // Verify the update
    await listPhoneNumbers();
  } else {
    // No existing phone, try to import
    await testImport();
  }
}

main();

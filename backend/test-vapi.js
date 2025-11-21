import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_BASE_URL = 'https://api.vapi.ai';

async function testVAPIConnection() {
  console.log('🧪 Testing VAPI Connection...\n');
  
  try {
    // Test 1: Get assistants
    console.log('📋 Fetching assistants...');
    const response = await fetch(`${VAPI_BASE_URL}/assistant`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const assistants = await response.json();
    console.log('✅ Connection successful!');
    console.log(`📊 You have ${assistants.length} assistant(s)\n`);

    if (assistants.length > 0) {
      console.log('First assistant:');
      console.log(JSON.stringify(assistants[0], null, 2));
    }

    // Test 2: Get available voices
    console.log('\n🎤 Fetching available voices...');
    const voicesResponse = await fetch(`${VAPI_BASE_URL}/voice`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (voicesResponse.ok) {
      const voices = await voicesResponse.json();
      console.log(`✅ Found ${voices.length} voices available\n`);
      
      // Show first few voices
      voices.slice(0, 5).forEach(voice => {
        console.log(`- ${voice.name} (${voice.voiceId})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testVAPIConnection();
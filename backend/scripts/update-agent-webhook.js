/**
 * Update 11Labs agent with post-call webhook
 * Usage: node scripts/update-agent-webhook.js
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env from backend folder
dotenv.config({ path: join(__dirname, '..', '.env') });

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

const elevenLabsClient = axios.create({
  baseURL: 'https://api.elevenlabs.io/v1',
  headers: {
    'xi-api-key': ELEVENLABS_API_KEY,
    'Content-Type': 'application/json'
  }
});

async function updateAgentWebhook(agentId) {
  const webhookUrl = `${BACKEND_URL}/api/elevenlabs/post-call`;

  console.log(`Updating agent ${agentId} with webhook: ${webhookUrl}`);

  try {
    const response = await elevenLabsClient.patch(`/convai/agents/${agentId}`, {
      platform_settings: {
        post_call_webhook: {
          url: webhookUrl
        }
      }
    });

    console.log('✅ Agent updated successfully');
    console.log('Agent ID:', response.data.agent_id);
    console.log('Webhook URL:', response.data.platform_settings?.post_call_webhook?.url || 'Not set');
    return response.data;
  } catch (error) {
    console.error('❌ Failed to update agent:', error.response?.data || error.message);
    throw error;
  }
}

async function listAndUpdateAllAgents() {
  try {
    // List all agents
    const response = await elevenLabsClient.get('/convai/agents');
    const agents = response.data.agents || [];

    console.log(`Found ${agents.length} agents`);

    for (const agent of agents) {
      console.log(`\nProcessing: ${agent.name} (${agent.agent_id})`);
      await updateAgentWebhook(agent.agent_id);
    }

    console.log('\n✅ All agents updated!');
  } catch (error) {
    console.error('Failed to update agents:', error.message);
  }
}

// Run with specific agent ID or update all
const agentId = process.argv[2];

if (agentId) {
  updateAgentWebhook(agentId);
} else {
  console.log('Updating all agents...');
  listAndUpdateAllAgents();
}

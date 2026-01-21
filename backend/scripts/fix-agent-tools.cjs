const axios = require("axios");
require("dotenv").config();

const API_KEY = process.env.ELEVENLABS_API_KEY;
const BACKEND_URL = process.env.BACKEND_URL;
const AGENT_ID = "agent_6001kfew0tr1f8gbtz7mj4rk8afb";
const WEBHOOK_URL = BACKEND_URL + "/api/elevenlabs/webhook?agentId=" + AGENT_ID;

console.log("Webhook URL:", WEBHOOK_URL);

async function fixTools() {
  // Get agent config
  const agent = await axios.get("https://api.elevenlabs.io/v1/convai/agents/" + AGENT_ID, {
    headers: { "xi-api-key": API_KEY }
  });

  const tools = agent.data.conversation_config?.agent?.prompt?.tools || [];
  console.log("Current tools:", tools.length);

  // Fix each tool's webhook URL
  const fixedTools = tools.map(tool => {
    if (tool.type === "webhook" || !tool.type) {
      return {
        ...tool,
        type: "webhook",
        api_schema: {
          ...tool.api_schema,
          url: WEBHOOK_URL,
          method: "POST"
        }
      };
    }
    return tool;
  });

  console.log("Fixed tools:", fixedTools.map(t => ({ name: t.name, url: t.api_schema?.url })));

  // Update agent with fixed tools
  const response = await axios.patch("https://api.elevenlabs.io/v1/convai/agents/" + AGENT_ID, {
    conversation_config: {
      agent: {
        prompt: {
          tools: fixedTools
        }
      }
    }
  }, {
    headers: { "xi-api-key": API_KEY }
  });

  console.log("Update result:", response.status);
}

fixTools().catch(e => console.error("Error:", e.response?.data || e.message));

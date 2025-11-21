import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';

const VAPI_API_KEY = process.env.VAPI_API_KEY;

const assistants = [
  {
    name: "Male - Professional (English)",
    language: "en",
    gender: "male",
    tone: "professional",
    voiceId: "21m00Tcm4TlvDq8ikWAM", // Josh (11labs default male)
    systemPrompt: "You are a professional AI assistant. Speak clearly, formally, and maintain a business-like tone. Be helpful and efficient.",
    greeting: "Good day. Thank you for calling. How may I assist you today?"
  },
  {
    name: "Male - Friendly (English)",
    language: "en",
    gender: "male",
    tone: "friendly",
    voiceId: "TxGEqnHWrfWFTfGW9XjX", // Charlie (11labs friendly male)
    systemPrompt: "You are a friendly AI assistant. Be warm, approachable, and conversational. Make customers feel comfortable and welcome.",
    greeting: "Hey there! Thanks so much for calling. How can I help you out today?"
  },
  {
    name: "Female - Professional (English)",
    language: "en",
    gender: "female",
    tone: "professional",
    voiceId: "EXAVITQu4vr4xnSDxMaL", // Bella (11labs professional female)
    systemPrompt: "You are a professional AI assistant. Speak clearly, formally, and maintain a business-like tone. Be helpful and efficient.",
    greeting: "Good day. Thank you for calling. How may I assist you today?"
  },
  {
    name: "Female - Friendly (English)",
    language: "en",
    gender: "female",
    tone: "friendly",
    voiceId: "pNInz6obpgDQGcFmaJgB", // Nicole (11labs friendly female)
    systemPrompt: "You are a friendly AI assistant. Be warm, approachable, and conversational. Make customers feel comfortable and welcome.",
    greeting: "Hi! Thanks for calling! How can I help you today?"
  },
  {
    name: "Erkek - Profesyonel (Türkçe)",
    language: "tr",
    gender: "male",
    tone: "professional",
    voiceId: "21m00Tcm4TlvDq8ikWAM",
    systemPrompt: "Profesyonel bir AI asistanısınız. Net, resmi ve iş odaklı konuşun. Yardımcı ve verimli olun.",
    greeting: "İyi günler. Aramanız için teşekkür ederim. Size nasıl yardımcı olabilirim?"
  },
  {
    name: "Erkek - Samimi (Türkçe)",
    language: "tr",
    gender: "male",
    tone: "friendly",
    voiceId: "TxGEqnHWrfWFTfGW9XjX",
    systemPrompt: "Samimi bir AI asistanısınız. Sıcak, yakın ve rahat konuşun. Müşterilerin kendilerini rahat hissetmesini sağlayın.",
    greeting: "Merhaba! Aramanız için çok teşekkür ederim. Nasıl yardımcı olabilirim?"
  },
  {
    name: "Kadın - Profesyonel (Türkçe)",
    language: "tr",
    gender: "female",
    tone: "professional",
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    systemPrompt: "Profesyonel bir AI asistanısınız. Net, resmi ve iş odaklı konuşun. Yardımcı ve verimli olun.",
    greeting: "İyi günler. Aramanız için teşekkür ederim. Size nasıl yardımcı olabilirim?"
  },
  {
    name: "Kadın - Samimi (Türkçe)",
    language: "tr",
    gender: "female",
    tone: "friendly",
    voiceId: "pNInz6obpgDQGcFmaJgB",
    systemPrompt: "Samimi bir AI asistanısınız. Sıcak, yakın ve rahat konuşun. Müşterilerin kendilerini rahat hissetmesini sağlayın.",
    greeting: "Merhaba! Aramanız için çok teşekkür ederim. Nasıl yardımcı olabilirim?"
  }
];

async function createAssistants() {
  console.log('🤖 Creating 8 Default Assistants...\n');
  
  const createdAssistants = [];
  
  for (const assistant of assistants) {
    try {
      console.log(`Creating: ${assistant.name}...`);
      
      const response = await axios.post('https://api.vapi.ai/assistant', {
        name: assistant.name,
        model: {
          provider: "openai",
          model: "gpt-4",
          temperature: 0.7,
          systemPrompt: assistant.systemPrompt
        },
        voice: {
          provider: "11labs",
          voiceId: assistant.voiceId,
          stability: 0.5,
          similarityBoost: 0.75,
          speed: 1.0
        },
        firstMessage: assistant.greeting,
        endCallMessage: assistant.language === 'en' 
          ? "Thank you for calling. Have a great day!" 
          : "Aramanız için teşekkür ederim. İyi günler!",
        recordingEnabled: true
      }, {
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`✅ Created: ${assistant.name}`);
      console.log(`   ID: ${response.data.id}\n`);
      
      createdAssistants.push({
        ...assistant,
        id: response.data.id
      });
      
      // Wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Failed to create ${assistant.name}:`);
      console.error(error.response?.data || error.message);
      console.log('');
    }
  }
  
  console.log('\n📋 SUMMARY - Copy these IDs to your database:\n');
  createdAssistants.forEach(a => {
    console.log(`${a.name}:`);
    console.log(`  ID: ${a.id}`);
    console.log(`  Gender: ${a.gender}, Tone: ${a.tone}, Language: ${a.language}\n`);
  });
}

createAssistants();
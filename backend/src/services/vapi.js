import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
import prisma from '../prismaClient.js';

const VAPI_API_URL = 'https://api.vapi.ai';

class VapiService {
  constructor() {
    this.apiKey = process.env.VAPI_API_KEY;
    this.publicKey = process.env.VAPI_PUBLIC_KEY;

    console.log('🔑 VAPI Keys loaded:');
    console.log('Private Key:', this.apiKey ? '✅ Exists' : '❌ Missing');
    console.log('Public Key:', this.publicKey ? '✅ Exists' : '❌ Missing');

    this.client = axios.create({
      baseURL: VAPI_API_URL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async createAssistant(businessName, config = {}) {
    try {
      const assistantConfig = {
        name: `${businessName} AI Assistant`,
        model: {
          provider: "openai",
          model: "gpt-4",
          temperature: 0.7,
          systemPrompt: config.customInstructions ||
            `You are an AI assistant for ${businessName}. Be professional and helpful.`
        },
        voice: {
          provider: "11labs",
          voiceId: config.voiceId || "21m00Tcm4TlvDq8ikWAM"
        },
        firstMessage: config.customGreeting || `Hello! How can I help you today?`,
        endCallMessage: "Thank you for calling. Have a great day!",
        recordingEnabled: true,
      };

      const response = await this.client.post('/assistant', assistantConfig);
      return response.data;

    } catch (error) {
      console.error('VAPI create assistant error:', error.response?.data);
      throw error;
    }
  }

  async updateAssistant(assistantId, config) {
    try {
      const updateConfig = {
        model: {
          provider: "openai",
          model: "gpt-4",
          temperature: 0.7,
          systemPrompt: config.customInstructions
        }
      };

      const response = await this.client.patch(`/assistant/${assistantId}`, updateConfig);
      return response.data;

    } catch (error) {
      console.error('VAPI update assistant error:', error.response?.data);
      throw error;
    }
  }

  async getAssistant(assistantId) {
    try {
      const response = await this.client.get(`/assistant/${assistantId}`);
      return response.data;
    } catch (error) {
      console.error('VAPI get assistant error:', error.response?.data);
      throw error;
    }
  }

  async getVoices() {
    try {
      const response = await this.client.get('/voice');
      return response.data;
    } catch (error) {
      console.error('VAPI get voices error:', error.response?.data);
      throw error;
    }
  }

  async makeTestCall(assistantId, phoneNumber) {
    try {
      const response = await this.client.post('/call', {
        assistantId,
        phoneNumber,
        type: 'outboundPhoneCall'
      });
      return response.data;

    } catch (error) {
      console.error('VAPI test call error:', error.response?.data);
      throw error;
    }
  }

  async buyPhoneNumber(areaCode = '415') {
    try {
      const response = await this.client.post('/phone-number/buy', {
        areaCode,
        name: 'Customer Phone Number'
      });
      return response.data;

    } catch (error) {
      console.error('VAPI buy phone number error:', error.response?.data);
      throw error;
    }
  }

  async assignPhoneNumber(phoneNumberId, assistantId) {
    try {
      const response = await this.client.patch(`/phone-number/${phoneNumberId}`, {
        assistantId
      });

      return response.data;

    } catch (error) {
      console.error('VAPI assign phone number error:', error.response?.data);
      throw error;
    }
  }

  // ⭐ Subscription sonrası otomatik numara atama
  async allocatePhoneNumber(businessId, assistantId) {
    try {
      // 1) Numara satın al
      const phone = await this.buyPhoneNumber();

      // 2) DB'ye kaydet
      await prisma.business.update({
        where: { id: businessId },
        data: {
          phoneNumber: phone.phoneNumber,
          phoneNumberId: phone.id
        }
      });

      // 3) Assistant'a bağla
      await this.assignPhoneNumber(phone.id, assistantId);

      return phone.phoneNumber;

    } catch (error) {
      console.error("VAPI allocate phone number error:", error.response?.data || error.message);
      throw error;
    }
  }
}

export default new VapiService();

/**
 * Responder - Stage 3 of AI Pipeline
 *
 * Purpose: Generate natural language response based on:
 * - Router's intent classification
 * - Orchestrator's tool results
 * - Business context and tone
 *
 * NO tool calling - purely response generation
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildAssistantPrompt } from '../promptBuilder.js';
import KBSelector from './kb-selector.js';

class Responder {
  constructor(business, assistant) {
    this.business = business;
    this.assistant = assistant;
    this.language = business?.language || 'TR';

    // Initialize KB Selector for intent-based KB selection
    this.kbSelector = new KBSelector(business.id);

    // Initialize Gemini
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.3, // Slightly higher for natural conversation
        maxOutputTokens: 1000
      }
    });
  }

  /**
   * Generate response based on pipeline results
   * @param {Object} params
   * @param {Object} params.routerResult - { domain, intent, entities }
   * @param {Object} params.orchestratorResult - { toolsExecuted, results, success }
   * @param {string} params.userMessage - Original user message
   * @param {Array} params.history - Conversation history
   * @returns {Object} { response, tokens }
   */
  async generateResponse({ routerResult, orchestratorResult, userMessage, history = [] }) {
    const { domain, intent } = routerResult;
    const { results, success, needsMoreInfo, missingInfo, noToolNeeded, error } = orchestratorResult;

    // Case 1: No tool needed (greetings, general questions)
    if (noToolNeeded) {
      return this.generateConversationalResponse(userMessage, history, routerResult);
    }

    // Case 2: Need more info from user
    if (needsMoreInfo) {
      return this.generateInfoRequestResponse(domain, intent, missingInfo);
    }

    // Case 3: Tool execution error
    if (error) {
      return this.generateErrorResponse(error, orchestratorResult.errorMessage);
    }

    // Case 4: Tool executed - format result
    if (results && results.length > 0) {
      return this.formatToolResult(domain, intent, results[0], userMessage, history);
    }

    // Fallback: generic response
    return {
      response: this.language === 'TR'
        ? 'Bu konuda size yardımcı olabilmem için daha fazla bilgiye ihtiyacım var.'
        : 'I need more information to help you with this.',
      tokens: { input: 0, output: 0 }
    };
  }

  /**
   * Generate conversational response (no tool needed)
   */
  async generateConversationalResponse(userMessage, history, routerResult) {
    const { domain, intent } = routerResult;

    // Quick responses for greetings (no API call needed)
    if (domain === 'GREETING') {
      if (intent === 'hello') {
        return {
          response: this.language === 'TR'
            ? 'Merhaba! Size nasıl yardımcı olabilirim?'
            : 'Hello! How can I help you?',
          tokens: { input: 0, output: 0 }
        };
      }
      if (intent === 'goodbye') {
        return {
          response: this.language === 'TR'
            ? 'Görüşmek üzere, iyi günler!'
            : 'Goodbye, have a great day!',
          tokens: { input: 0, output: 0 }
        };
      }
      if (intent === 'thanks') {
        return {
          response: this.language === 'TR'
            ? 'Rica ederim! Başka bir sorunuz varsa yardımcı olmaktan memnuniyet duyarım.'
            : 'You\'re welcome! Let me know if you have any other questions.',
          tokens: { input: 0, output: 0 }
        };
      }
    }

    // Get relevant KB snippets based on intent (NEW: intent-based KB selection)
    let kbContext = '';
    try {
      const kbResult = await this.kbSelector.selectRelevantSnippets(routerResult, userMessage);
      kbContext = this.kbSelector.formatForPrompt(kbResult, this.language);
    } catch (kbError) {
      console.error('⚠️ [Responder] KB selection failed:', kbError.message);
    }

    // For general questions, use AI to generate response
    const contextMessages = history.slice(-4).map(m =>
      `${m.role === 'user' ? 'Müşteri' : 'Asistan'}: ${m.content}`
    ).join('\n');

    const prompt = `Sen ${this.business.name} için bir müşteri hizmetleri asistanısın.
${this.language === 'TR' ? 'Türkçe cevap ver.' : 'Answer in English.'}

Müşteri mesajı: "${userMessage}"
${contextMessages ? `\nÖnceki konuşma:\n${contextMessages}` : ''}
${kbContext}

Kısa ve yardımcı bir cevap ver. ${kbContext ? 'Yukarıdaki bilgi bankası içeriğini kullan.' : ''} Yapamayacağın işlemler için özür dile ve ne yapabileceğini söyle.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;

      return {
        response: response.text(),
        tokens: {
          input: response.usageMetadata?.promptTokenCount || 0,
          output: response.usageMetadata?.candidatesTokenCount || 0
        }
      };
    } catch (error) {
      console.error('⚠️ [Responder] AI generation failed:', error.message);
      return {
        response: this.language === 'TR'
          ? 'Size nasıl yardımcı olabilirim?'
          : 'How can I help you?',
        tokens: { input: 0, output: 0 }
      };
    }
  }

  /**
   * Generate response asking for missing info
   */
  generateInfoRequestResponse(domain, intent, missingInfo) {
    const messages = {
      TR: {
        order_identifier: 'Siparişinizi sorgulayabilmem için sipariş numaranızı, telefon numaranızı veya e-posta adresinizi paylaşır mısınız?',
        order_number: 'Sipariş numaranızı söyler misiniz?',
        phone: 'Telefon numaranızı söyler misiniz?',
        email: 'E-posta adresinizi söyler misiniz?',
        date: 'Hangi tarih için randevu almak istiyorsunuz?',
        time: 'Saat kaçı tercih edersiniz?',
        product_name: 'Hangi ürün için stok kontrolü yapmamı istersiniz?',
        default: 'Bu işlem için daha fazla bilgiye ihtiyacım var. Yardımcı olabilir misiniz?'
      },
      EN: {
        order_identifier: 'To check your order, could you please provide your order number, phone number, or email address?',
        order_number: 'Could you please provide your order number?',
        phone: 'Could you please provide your phone number?',
        email: 'Could you please provide your email address?',
        date: 'What date would you like to book?',
        time: 'What time would you prefer?',
        product_name: 'Which product would you like me to check stock for?',
        default: 'I need more information to help you with this. Could you help me?'
      }
    };

    const langMessages = messages[this.language] || messages.TR;
    const response = langMessages[missingInfo] || langMessages.default;

    return {
      response,
      tokens: { input: 0, output: 0 }
    };
  }

  /**
   * Generate error response
   */
  generateErrorResponse(errorCode, errorMessage) {
    const messages = {
      TR: {
        NO_TOOLS_AVAILABLE: 'Bu işlem için gerekli sistem bağlantısı mevcut değil.',
        EXECUTION_ERROR: 'İşlem sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
        NOT_FOUND: 'Aradığınız bilgiyi bulamadım.',
        default: 'Bir sorun oluştu. Size başka bir konuda yardımcı olabilir miyim?'
      },
      EN: {
        NO_TOOLS_AVAILABLE: 'The required system integration is not available.',
        EXECUTION_ERROR: 'An error occurred during processing. Please try again later.',
        NOT_FOUND: 'I could not find the information you\'re looking for.',
        default: 'Something went wrong. Can I help you with something else?'
      }
    };

    const langMessages = messages[this.language] || messages.TR;
    const response = errorMessage || langMessages[errorCode] || langMessages.default;

    return {
      response,
      tokens: { input: 0, output: 0 }
    };
  }

  /**
   * Format tool result into natural language response
   */
  async formatToolResult(domain, intent, result, userMessage, history) {
    // Check if tool already provides user_message (new standard format)
    if (result.user_message) {
      return {
        response: result.user_message,
        tokens: { input: 0, output: 0 }
      };
    }

    // For backward compatibility, check success/message format
    if (result.message) {
      return {
        response: result.message,
        tokens: { input: 0, output: 0 }
      };
    }

    // If we have data but no formatted message, generate one
    if (result.data || result.order || result.orders) {
      return this.generateDataResponse(domain, intent, result);
    }

    // Fallback for errors
    if (!result.success && !result.ok) {
      return {
        response: result.error || (this.language === 'TR'
          ? 'İşlem sırasında bir sorun oluştu.'
          : 'There was a problem processing your request.'),
        tokens: { input: 0, output: 0 }
      };
    }

    // Generic success
    return {
      response: this.language === 'TR'
        ? 'İşleminiz tamamlandı.'
        : 'Your request has been completed.',
      tokens: { input: 0, output: 0 }
    };
  }

  /**
   * Generate natural language response from data
   */
  generateDataResponse(domain, intent, result) {
    // ORDER domain responses
    if (domain === 'ORDER') {
      const order = result.order || result.data?.order || result.orders?.[0];
      if (!order) {
        return {
          response: this.language === 'TR'
            ? 'Siparişinizi bulamadım. Bilgileri kontrol edip tekrar deneyebilir misiniz?'
            : 'I could not find your order. Could you check the information and try again?',
          tokens: { input: 0, output: 0 }
        };
      }

      const status = order.status || order.fulfillment_status || 'Bilinmiyor';
      const orderNumber = order.order_number || order.name || order.id;

      return {
        response: this.language === 'TR'
          ? `${orderNumber} numaralı siparişinizin durumu: ${status}`
          : `Order ${orderNumber} status: ${status}`,
        tokens: { input: 0, output: 0 }
      };
    }

    // ACCOUNTING domain responses
    if (domain === 'ACCOUNTING') {
      const data = result.data || result;
      if (data.sgk_borcu || data.vergi_borcu || data.toplam_borc) {
        let response = this.language === 'TR' ? 'Kayıtlarınıza göre:\n' : 'According to your records:\n';

        if (data.sgk_borcu) response += `- SGK Borcu: ${data.sgk_borcu}\n`;
        if (data.vergi_borcu) response += `- Vergi Borcu: ${data.vergi_borcu}\n`;
        if (data.toplam_borc) response += `- Toplam Borç: ${data.toplam_borc}\n`;
        if (data.son_odeme_tarihi) response += `- Son Ödeme Tarihi: ${data.son_odeme_tarihi}`;

        return { response: response.trim(), tokens: { input: 0, output: 0 } };
      }
    }

    // Default: return whatever we have
    return {
      response: JSON.stringify(result.data || result, null, 2),
      tokens: { input: 0, output: 0 }
    };
  }
}

export default Responder;

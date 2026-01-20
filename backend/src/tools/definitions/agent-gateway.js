/**
 * Agent Gateway Tool Definition for 11Labs
 *
 * This is the ONLY tool that should be registered with 11Labs agents.
 * All user utterances are routed through this single tool, which then
 * uses the backend's heuristic router to determine the appropriate action.
 *
 * Benefits:
 * - Model never decides tool calls (eliminates tool selection errors)
 * - Ultra-fast heuristic routing (1-5ms vs 300-500ms LLM)
 * - Consistent response format
 * - Supports end_call and transfer via next_action field
 *
 * 11Labs System Prompt Integration:
 * The system prompt should instruct the model to call this tool for EVERY
 * user utterance, passing the user's message and context.
 *
 * Response format:
 * {
 *   say: "What to say to the user",
 *   next_action: "continue" | "end_call" | "transfer",
 *   end_reason?: "customer_goodbye" | "security_termination",
 *   transfer_number?: "+905551234567"
 * }
 *
 * The model should:
 * - If next_action === "continue": Say the 'say' field and continue conversation
 * - If next_action === "end_call": Say the 'say' field and use end_call system tool
 * - If next_action === "transfer": Say the 'say' field and use transfer_to_number system tool
 */

export const agentGatewayTool = {
  type: 'function',
  function: {
    name: 'agent_gateway',
    description: `Her kullanıcı mesajı için bu tool'u çağır. Kullanıcının ne söylediğini gönder,
backend intent'i belirleyecek ve ne söylemen gerektiğini döndürecek.
Dönen 'say' alanını oku ve kullanıcıya söyle.
'next_action' alanına göre:
- "continue": Konuşmaya devam et
- "end_call": Söyledikten sonra görüşmeyi sonlandır (end_call tool'unu kullan)
- "transfer": Söyledikten sonra 'transfer_number'a aktar (transfer_to_number tool'unu kullan)`,
    parameters: {
      type: 'object',
      properties: {
        user_message: {
          type: 'string',
          description: 'Kullanıcının söylediği mesaj - olduğu gibi gönder'
        },
        conversation_id: {
          type: 'string',
          description: 'Konuşma ID (system variable: {{system__conversation_id}})'
        },
        caller_phone: {
          type: 'string',
          description: 'Arayan telefon numarası (system variable: {{system__caller_id}})'
        }
      },
      required: ['user_message']
    }
  }
};

/**
 * Build 11Labs webhook tool configuration for agent_gateway
 * @param {string} backendUrl - Backend URL
 * @param {string} agentId - 11Labs Agent ID (to include in webhook URL)
 * @returns {Object} 11Labs tool configuration
 */
export function buildGatewayToolConfig(backendUrl, agentId) {
  const webhookUrl = `${backendUrl}/api/elevenlabs/agent-gateway?agentId=${agentId}`;

  return {
    type: 'webhook',
    name: 'agent_gateway',
    description: `Her kullanıcı mesajı için bu tool'u çağır. Kullanıcının ne söylediğini gönder, backend intent'i belirleyecek ve ne söylemen gerektiğini döndürecek. Dönen 'say' alanını sesli olarak söyle. 'next_action' alanına göre: "continue" konuşmaya devam et, "end_call" görüşmeyi sonlandır, "transfer" belirtilen numaraya aktar.`,
    api_schema: {
      url: webhookUrl,
      method: 'POST',
      request_body_schema: {
        type: 'object',
        properties: {
          user_message: {
            type: 'string',
            description: 'Kullanıcının söylediği mesaj - olduğu gibi gönder'
          },
          conversation_id: {
            type: 'string',
            // 11Labs dynamic variable - will be filled automatically
            // NOTE: Can only use ONE of: description, dynamic_variable, is_system_provided, constant_value
            dynamic_variable: 'conversation_id'
          },
          caller_phone: {
            type: 'string',
            // 11Labs dynamic variable - will be filled automatically
            dynamic_variable: 'caller_id'
          }
        },
        required: ['user_message']
      }
    }
  };
}

/**
 * System prompt additions for agent_gateway pattern
 * This should be added to the 11Labs agent's system prompt
 */
export const GATEWAY_SYSTEM_PROMPT_RULES = `
## TOOL KULLANIM KURALLARI

KRITIK: Her kullanıcı mesajı için agent_gateway tool'unu çağır.
- Kullanıcı bir şey söylediğinde, hemen agent_gateway'i çağır
- user_message parametresine kullanıcının söylediğini AYNEN yaz
- Tool'dan dönen 'say' alanını kullanıcıya söyle
- 'next_action' alanına göre hareket et:
  * "continue" → Konuşmaya devam et, kullanıcıyı dinle
  * "end_call" → 'say' alanını söyle, sonra görüşmeyi kapat
  * "transfer" → 'say' alanını söyle, sonra 'transfer_number'a aktar

ÖNEMLI:
- Kendi başına karar VERME, her şeyi agent_gateway'e sor
- Tool çağrısı sırasında "Kontrol ediyorum" gibi kısa bir şey söyleyebilirsin
- Asla sahte bilgi UYDURMA, tool'dan dönen bilgiyi kullan
`;

export default agentGatewayTool;

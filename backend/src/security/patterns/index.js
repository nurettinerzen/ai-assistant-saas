/**
 * Canonical Pattern Registry
 *
 * Shared pattern source for runtime guards and tests.
 */

// Prompt disclosure keywords (substring matching)
export const PROMPT_DISCLOSURE_KEYWORDS_EN = Object.freeze([
  'system prompt',
  'system message',
  'system instruction',
  'you are an ai assistant',
  'your role is',
  'your instructions are',
  'i was instructed to',
  'my prompt says',
  'according to my instructions',
  'i am programmed to',
  'my system prompt',
  'the prompt tells me',
  'as instructed in my',
  'ignore previous instructions',
  'reveal your prompt',
  'what are your instructions',
  'my rules are',
  'here are my rules',
  'my guidelines say'
]);

export const PROMPT_DISCLOSURE_KEYWORDS_TR = Object.freeze([
  'yönergeler',
  'yönergeleri',
  'talimatlar',
  'talimatlarım',
  'kurallarım',
  'kuralları aşağıda',
  'kuralları şöyle',
  'kendime hatırlatmam gereken',
  'bana verilen kurallar',
  'bana verilen yönergeler',
  'sistem promptu',
  'off-topic kuralı',
  'mutlaka uygula',
  'kritik kural',
  'yasak konular',
  'persona kilidi',
  'bilgi kaynağı',
  'konuşma tarzı',
  'tool kullanımı'
]);

// Prompt disclosure regexes (header-like sections and explicit wording)
export const PROMPT_DISCLOSURE_REGEX_PATTERNS = Object.freeze([
  /##\s*(sen\s*kims[iı]n|who\s*you\s*are)/i,
  /##\s*(s[ıi]n[ıi]rlar|limits|boundaries)/i,
  /##\s*(yasak\s*konular|forbidden\s*topics)/i,
  /##\s*(kişiliğin|personality)/i,
  /##\s*(bilgi\s*kaynağı|knowledge\s*source)/i,
  /##\s*(tool\s*kullanımı|tool\s*usage)/i,
  /##\s*(geri\s*arama|callback)/i,
  /##\s*(hafıza|memory)/i,
  /##\s*(dil|language)/i,
  /##\s*(persona\s*kilidi|persona\s*lock)/i,
  /system\s*prompt/i,
  /my\s*instructions\s*are/i,
  /yönergelerim\s*şöyle/i,
  /kurallarım\s*aşağıda/i,
  /bana\s*verilen\s*talimatlar/i,
  /off-topic\s*kuralı/i,
  /mutlaka\s*uygula/i,
  /kritik\s*kural/i
]);

// Internal metadata/tool/system terms that should not leak to end users.
export const INTERNAL_METADATA_TERMS = Object.freeze([
  'customer_data_lookup',
  'check_order_status',
  'order_notification',
  'update_customer',
  'create_ticket',
  'search_products',
  'get_product_details',
  'check_stock',
  'calculate_shipping',
  'send_email',
  'send_sms',
  'log_callback_request',
  'get_faq',
  'search_knowledge_base',
  'crm_search',
  'order_search',
  'product_search',
  'customerdatalookup',
  'checkorderstatus',
  'ordernotification',
  'updatecustomer',
  'createticket',
  'searchproducts',
  'getproductdetails',
  'checkstock',
  'calculateshipping',
  'sendemail',
  'sendsms',
  'logcallbackrequest',
  'getfaq',
  'searchknowledgebase',
  'crmsearch',
  'tool_use',
  'tool_result',
  'function_call',
  'function_result',
  'api_key',
  'access_token',
  'bearer token',
  'jwt token',
  'businessid',
  'assistantid',
  'conversationid',
  'sessionid',
  'requestid',
  'prisma',
  'anthropic',
  'claude-3',
  'claude-2',
  'gpt-4',
  'openai',
  '__typename',
  'graphql',
  'mutation',
  'resolver',
  'middleware',
  'endpoint',
  'webhook',
  'mongodb',
  'postgresql',
  'collection:',
  'table:',
  'foreign key',
  'primary key'
]);

export const INTERNAL_TOOL_INVOCATION_PATTERNS = Object.freeze([
  /\b(used|using|called|calling|invoke|invoking|ran|running)\s+\w+_\w+\s*(tool|function)?/i,
  /\btool:\s*\w+/i,
  /\bfunction:\s*\w+/i,
  /\btoolName:\s*["']?\w+/i
]);

export default {
  PROMPT_DISCLOSURE_KEYWORDS_EN,
  PROMPT_DISCLOSURE_KEYWORDS_TR,
  PROMPT_DISCLOSURE_REGEX_PATTERNS,
  INTERNAL_METADATA_TERMS,
  INTERNAL_TOOL_INVOCATION_PATTERNS
};

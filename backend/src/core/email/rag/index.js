/**
 * Email RAG Module
 *
 * Exports embedding, retrieval, snippet, and metrics services.
 */

// Embedding service
export {
  shouldIndexEmail,
  generateEmbedding,
  generateEmbeddingsBatch,
  prepareEmailForEmbedding,
  indexEmailMessage,
  indexEmailThread,
  reindexIfChanged,
  deleteThreadEmbeddings,
  cleanupOldEmbeddings,
  getEmbeddingStats,
  chunkContent,
  generateContentHash
} from './embeddingService.js';

// Retrieval service
export {
  retrieveSimilarEmails,
  retrieveExamplesForPrompt,
  formatExamplesForPrompt,
  cosineSimilarity
} from './retrievalService.js';

// Snippet service
export {
  getBusinessSnippets,
  getSnippetById,
  createSnippet,
  updateSnippet,
  deleteSnippet,
  selectSnippetsForContext,
  applyVariablesToSnippet,
  formatSnippetsForPrompt,
  recordSnippetUsage,
  getVerificationSnippet,
  extractVariablesFromTemplate
} from './snippetService.js';

// Indexing hooks (for SENT event)
export {
  onEmailSent,
  backfillEmailEmbeddings,
  backfillAllBusinesses
} from './indexingHooks.js';

// Metrics service
export {
  recordRAGMetrics,
  getBusinessRAGSettings,
  shouldUseRAG,
  getP95Latency,
  getAvgTokenIncrease
} from './ragMetrics.js';

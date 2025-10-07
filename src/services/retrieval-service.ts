import { VectorDatabase, EmbeddingProvider, SearchResult, RAGQuery } from '../types/index.js';

export class RetrievalService {
  constructor(
    private vectorDB: VectorDatabase,
    private embeddingService: EmbeddingProvider
  ) {}

  async search(query: RAGQuery): Promise<SearchResult[]> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.embeddingService.generateEmbedding(query.query);
      
      // Search for similar documents using hybrid search
      const results = await this.vectorDB.searchSimilar(
        queryEmbedding,
        query.limit || 5,
        query.threshold || 0.7,
        query.query, // Pass the query text for BM25
        0.5 // alpha: 0.5 = balanced between keyword and semantic search
      );
      
      return results;
    } catch (error) {
      console.error('Failed to search documents:', error);
      throw error;
    }
  }

  async searchWithContext(query: string, contextLimit: number = 3): Promise<{
    results: SearchResult[];
    context: string;
  }> {
    try {
      const results = await this.search({
        query,
        limit: contextLimit,
        threshold: 0.7,
      });

      // Combine the content of top results into context
      const context = results
        .map(result => result.document.content)
        .join('\n\n');

      return {
        results,
        context,
      };
    } catch (error) {
      console.error('Failed to search with context:', error);
      throw error;
    }
  }
}

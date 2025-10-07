export interface Document {
  id: string;
  content: string;
  metadata: {
    title?: string;
    source?: string;
    type?: string;
    createdAt: Date;
    [key: string]: any;
  };
}

export interface SearchResult {
  document: Document;
  score: number;
}

export interface RAGQuery {
  query: string;
  limit?: number;
  threshold?: number;
}

export interface RAGResponse {
  answer: string;
  sources: SearchResult[];
  query: string;
}

export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
}

export interface VectorDatabase {
  addDocument(document: Document, embedding: number[]): Promise<void>;
  searchSimilar(queryEmbedding: number[], limit: number, threshold?: number, queryText?: string, alpha?: number): Promise<SearchResult[]>;
  deleteDocument(id: string): Promise<void>;
  getDocument(id: string): Promise<Document | null>;
}

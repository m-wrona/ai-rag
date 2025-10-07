import { Document, VectorDatabase, EmbeddingProvider } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import { chunkDocument, DocumentChunk } from '../utils/chunking.js';
import { ContextualRetrievalService } from './context-service.js';

export class DocumentIngestionService {
  constructor(
    private vectorDB: VectorDatabase,
    private embeddingService: EmbeddingProvider,
    private contextService?: ContextualRetrievalService // Optional for contextual retrieval
  ) {}

  async ingestDocument(
    content: string,
    metadata: Partial<Document['metadata']> = {}
  ): Promise<string> {
    const documentId = uuidv4();
    
    const document: Document = {
      id: documentId,
      content,
      metadata: {
        title: metadata.title || 'Untitled Document',
        source: metadata.source || 'unknown',
        type: metadata.type || 'text',
        createdAt: new Date(),
        ...metadata,
      },
    };

    try {
      // Generate embedding for the document content
      const embedding = await this.embeddingService.generateEmbedding(content);
      
      // Store in vector database
      await this.vectorDB.addDocument(document, embedding);
      
      console.log(`Successfully ingested document: ${documentId}`);
      return documentId;
    } catch (error) {
      console.error('Failed to ingest document:', error);
      throw error;
    }
  }

  async ingestDocuments(
    documents: Array<{ content: string; metadata?: Partial<Document['metadata']> }>
  ): Promise<string[]> {
    const documentIds: string[] = [];
    
    try {
      // Generate embeddings for all documents
      const contents = documents.map(doc => doc.content);
      const embeddings = await this.embeddingService.generateEmbeddings(contents);
      
      // Create document objects
      const documentObjects: Document[] = documents.map((doc, index) => ({
        id: uuidv4(),
        content: doc.content,
        metadata: {
          title: doc.metadata?.title || `Document ${index + 1}`,
          source: doc.metadata?.source || 'unknown',
          type: doc.metadata?.type || 'text',
          createdAt: new Date(),
          ...doc.metadata,
        },
      }));

      // Store all documents in vector database
      for (let i = 0; i < documentObjects.length; i++) {
        await this.vectorDB.addDocument(documentObjects[i], embeddings[i]);
        documentIds.push(documentObjects[i].id);
      }
      
      console.log(`Successfully ingested ${documentIds.length} documents`);
      return documentIds;
    } catch (error) {
      console.error('Failed to ingest documents:', error);
      throw error;
    }
  }

  /**
   * Ingest document with Contextual Retrieval
   * This implements the approach from: https://www.anthropic.com/engineering/contextual-retrieval
   * 
   * Steps:
   * 1. Chunk the document
   * 2. Generate context for each chunk using OpenAI
   * 3. Prepend context to chunks (Contextual Embeddings)
   * 4. Generate embeddings for contextualized chunks
   * 5. Store in vector DB (which will also use BM25 via hybrid search = Contextual BM25)
   * 
   * @param content - The full document content
   * @param metadata - Document metadata
   * @param options - Chunking and contextualization options
   * @returns Array of chunk IDs
   */
  async ingestDocumentWithContextualRetrieval(
    content: string,
    metadata: Partial<Document['metadata']> = {},
    options: {
      chunkSize?: number;
      overlap?: number;
      useContextual?: boolean;
      useRateLimit?: boolean;
      batchSize?: number;
    } = {}
  ): Promise<string[]> {
    const {
      chunkSize = 800,
      overlap = 100,
      useContextual = true,
      useRateLimit = false,
      batchSize = 10,
    } = options;

    if (!this.contextService && useContextual) {
      console.warn('ContextualRetrievalService not provided. Falling back to standard chunking.');
    }

    const parentDocumentId = uuidv4();

    try {
      // Step 1: Chunk the document
      console.log(`Chunking document (size: ${content.length} chars)...`);
      const chunks: DocumentChunk[] = chunkDocument(content, chunkSize, overlap);
      console.log(`Created ${chunks.length} chunks`);
      
      // Step 2: Generate context for each chunk (if enabled and service available)
      let contextualizedChunks = chunks.map(c => c.content);
      let contexts: string[] = [];
      
      if (useContextual && this.contextService) {
        console.log('Generating contextual information for chunks...');
        
        if (useRateLimit) {
          contexts = await this.contextService.generateContextsWithRateLimit(
            content,
            chunks.map(c => c.content),
            metadata,
            batchSize
          );
        } else {
          contexts = await this.contextService.generateContextsForChunks(
            content,
            chunks.map(c => c.content),
            metadata
          );
        }
        
        // Prepend context to each chunk
        contextualizedChunks = chunks.map((chunk, i) => {
          const context = contexts[i] || '';
          return context ? `${context}\n\n${chunk.content}` : chunk.content;
        });
        
        console.log('Successfully contextualized all chunks');
      }
      
      // Step 3: Generate embeddings for contextualized chunks
      console.log('Generating embeddings for chunks...');
      const embeddings = await this.embeddingService.generateEmbeddings(
        contextualizedChunks
      );
      
      // Step 4: Store each chunk with full metadata
      console.log('Storing chunks in vector database...');
      const chunkIds: string[] = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunkId = uuidv4();
        const document: Document = {
          id: chunkId,
          content: contextualizedChunks[i], // Store WITH context prepended
          metadata: {
            title: metadata.title || 'Untitled Document',
            source: metadata.source || 'unknown',
            type: metadata.type || 'text',
            createdAt: new Date(),
            // Chunk-specific metadata
            isChunk: true,
            parentDocumentId,
            chunkIndex: chunks[i].chunkIndex,
            originalContent: chunks[i].content, // Original without context
            contextualPrefix: contexts[i] || '', // The generated context
            ...metadata,
          },
        };
        
        await this.vectorDB.addDocument(document, embeddings[i]);
        chunkIds.push(chunkId);
      }
      
      console.log(
        `Successfully ingested document as ${chunkIds.length} ${useContextual ? 'contextualized' : 'standard'} chunks`
      );
      return chunkIds;
    } catch (error) {
      console.error('Failed to ingest document with contextual retrieval:', error);
      throw error;
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    try {
      await this.vectorDB.deleteDocument(documentId);
      console.log(`Successfully deleted document: ${documentId}`);
    } catch (error) {
      console.error('Failed to delete document:', error);
      throw error;
    }
  }

  async getDocument(documentId: string): Promise<Document | null> {
    try {
      return await this.vectorDB.getDocument(documentId);
    } catch (error) {
      console.error('Failed to get document:', error);
      return null;
    }
  }
}

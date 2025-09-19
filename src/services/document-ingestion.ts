import { Document, VectorDatabase, EmbeddingProvider } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

export class DocumentIngestionService {
  constructor(
    private vectorDB: VectorDatabase,
    private embeddingService: EmbeddingProvider
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

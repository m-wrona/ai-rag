import weaviate, { WeaviateClient, ApiKey } from 'weaviate-ts-client';
import { VectorDatabase, Document, SearchResult } from '../types/index.js';

export class WeaviateVectorDB implements VectorDatabase {
  private client: WeaviateClient;
  private className: string;

  constructor(url: string, apiKey?: string) {
    this.className = 'Document';
    
    this.client = weaviate.client({
      scheme: 'http',
      host: url.replace('http://', '').replace('https://', ''),
      apiKey: apiKey ? new ApiKey(apiKey) : undefined,
    });
  }

  async initialize(): Promise<void> {
    try {
      // Check if class exists, if not create it
      const classExists = await this.client.schema.exists().do();
      if (!classExists) {
        await this.createSchema();
      }
    } catch (error) {
      console.error('Failed to initialize Weaviate:', error);
      throw error;
    }
  }

  private async createSchema(): Promise<void> {
    const classDefinition = {
      class: this.className,
      description: 'A collection of documents for RAG',
      vectorizer: 'none', // We'll provide our own vectors
      properties: [
        {
          name: 'content',
          dataType: ['text'],
          description: 'The main content of the document',
        },
        {
          name: 'title',
          dataType: ['text'],
          description: 'The title of the document',
        },
        {
          name: 'source',
          dataType: ['text'],
          description: 'The source of the document',
        },
        {
          name: 'type',
          dataType: ['text'],
          description: 'The type of document',
        },
        {
          name: 'createdAt',
          dataType: ['date'],
          description: 'When the document was created',
        },
        {
          name: 'metadata',
          dataType: ['object'],
          description: 'Additional metadata as JSON object',
        },
      ],
    };

    await this.client.schema.classCreator().withClass(classDefinition).do();
    console.log(`Created class: ${this.className}`);
  }

  async addDocument(document: Document, embedding: number[]): Promise<void> {
    try {
      await this.client.data
        .creator()
        .withClassName(this.className)
        .withProperties({
          content: document.content,
          title: document.metadata.title || '',
          source: document.metadata.source || '',
          type: document.metadata.type || '',
          createdAt: document.metadata.createdAt.toISOString(),
          metadata: document.metadata,
        })
        .withVector(embedding)
        .withId(document.id)
        .do();
    } catch (error) {
      console.error('Failed to add document to Weaviate:', error);
      throw error;
    }
  }

  async searchSimilar(queryEmbedding: number[], limit: number, threshold: number = 0.7): Promise<SearchResult[]> {
    try {
      const result = await this.client.graphql
        .get()
        .withClassName(this.className)
        .withFields('content title source type createdAt metadata _additional { id distance }')
        .withNearVector({
          vector: queryEmbedding,
          distance: 1 - threshold, // Convert similarity threshold to distance
        })
        .withLimit(limit)
        .do();

      const documents = result.data.Get[this.className] || [];
      
      return documents.map((doc: any) => ({
        document: {
          id: doc._additional.id,
          content: doc.content,
          metadata: {
            title: doc.title,
            source: doc.source,
            type: doc.type,
            createdAt: new Date(doc.createdAt),
            ...doc.metadata,
          },
        },
        score: 1 - (doc._additional.distance || 0), // Convert distance back to similarity score
      }));
    } catch (error) {
      console.error('Failed to search in Weaviate:', error);
      throw error;
    }
  }

  async deleteDocument(id: string): Promise<void> {
    try {
      await this.client.data.deleter().withClassName(this.className).withId(id).do();
    } catch (error) {
      console.error('Failed to delete document from Weaviate:', error);
      throw error;
    }
  }

  async getDocument(id: string): Promise<Document | null> {
    try {
      const result = await this.client.data
        .getterById()
        .withClassName(this.className)
        .withId(id)
        .do();

      if (!result) return null;

      return {
        id: result.id,
        content: result.properties.content,
        metadata: {
          title: result.properties.title,
          source: result.properties.source,
          type: result.properties.type,
          createdAt: new Date(result.properties.createdAt),
          ...result.properties.metadata,
        },
      };
    } catch (error) {
      console.error('Failed to get document from Weaviate:', error);
      return null;
    }
  }
}

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WeaviateVectorDB } from './services/weaviate-client.js';
import { OpenAIEmbeddingService } from './services/embedding-service.js';
import { DocumentIngestionService } from './services/document-ingestion.js';
import { RetrievalService } from './services/retrieval-service.js';
import { RAGService } from './services/rag-service.js';
import { ContextualRetrievalService } from './services/context-service.js';
import { Document, RAGQuery } from './types/index.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
let vectorDB: WeaviateVectorDB;
let embeddingService: OpenAIEmbeddingService;
let contextService: ContextualRetrievalService | undefined;
let documentIngestion: DocumentIngestionService;
let retrievalService: RetrievalService;
let ragService: RAGService;

async function initializeServices() {
  try {
    // Initialize Weaviate
    const weaviateUrl = process.env.WEAVIATE_URL || 'http://localhost:8080';
    const weaviateApiKey = process.env.WEAVIATE_API_KEY;
    
    // Only pass apiKey if it's actually provided and not empty
    vectorDB = new WeaviateVectorDB(weaviateUrl, weaviateApiKey?.trim() || undefined);
    await vectorDB.initialize();
    console.log('✅ Weaviate initialized');

    // Initialize OpenAI services
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is required');
    }

    embeddingService = new OpenAIEmbeddingService(openaiApiKey);
    console.log('✅ OpenAI Embedding service initialized');

    // Initialize contextual retrieval service (optional)
    // Only initialize if explicitly enabled via environment variable
    if (process.env.ENABLE_CONTEXTUAL_RETRIEVAL === 'true') {
      contextService = new ContextualRetrievalService(openaiApiKey, {
        model: process.env.CONTEXT_MODEL || 'gpt-4o-mini',
        maxTokens: parseInt(process.env.CONTEXT_MAX_TOKENS || '100'),
        temperature: parseFloat(process.env.CONTEXT_TEMPERATURE || '0.3'),
        windowSize: parseInt(process.env.CONTEXT_WINDOW_SIZE || '1'),
      });
      console.log('✅ Contextual Retrieval service initialized');
    }

    // Initialize other services
    documentIngestion = new DocumentIngestionService(vectorDB, embeddingService, contextService);
    retrievalService = new RetrievalService(vectorDB, embeddingService);
    ragService = new RAGService(retrievalService, openaiApiKey);
    
    console.log('✅ All services initialized');
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    process.exit(1);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Document ingestion endpoints
app.post('/documents', async (req, res) => {
  try {
    const { content, metadata } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const documentId = await documentIngestion.ingestDocument(content, metadata);
    res.json({ id: documentId, message: 'Document ingested successfully' });
  } catch (error) {
    console.error('Error ingesting document:', error);
    res.status(500).json({ error: 'Failed to ingest document' });
  }
});

app.post('/documents/batch', async (req, res) => {
  try {
    const { documents } = req.body;
    
    if (!Array.isArray(documents)) {
      return res.status(400).json({ error: 'Documents must be an array' });
    }

    const documentIds = await documentIngestion.ingestDocuments(documents);
    res.json({ ids: documentIds, message: `${documentIds.length} documents ingested successfully` });
  } catch (error) {
    console.error('Error ingesting documents:', error);
    res.status(500).json({ error: 'Failed to ingest documents' });
  }
});

// Contextual Retrieval endpoint - chunks and contextualizes document
app.post('/documents/contextual', async (req, res) => {
  try {
    const { content, metadata, options } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    if (!contextService) {
      return res.status(400).json({ 
        error: 'Contextual retrieval not enabled. Set ENABLE_CONTEXTUAL_RETRIEVAL=true in environment' 
      });
    }

    const chunkIds = await documentIngestion.ingestDocumentWithContextualRetrieval(
      content, 
      metadata,
      options
    );
    
    res.json({ 
      chunkIds, 
      chunkCount: chunkIds.length,
      message: 'Document ingested with contextual retrieval successfully' 
    });
  } catch (error) {
    console.error('Error ingesting document with contextual retrieval:', error);
    res.status(500).json({ error: 'Failed to ingest document with contextual retrieval' });
  }
});

app.get('/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const document = await documentIngestion.getDocument(id);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(document);
  } catch (error) {
    console.error('Error getting document:', error);
    res.status(500).json({ error: 'Failed to get document' });
  }
});

app.delete('/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await documentIngestion.deleteDocument(id);
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Search endpoints
app.post('/search', async (req, res) => {
  try {
    const { query, limit, threshold } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const results = await retrievalService.search({
      query,
      limit: limit || 5,
      threshold: threshold || 0.7,
    });

    res.json({ results, query });
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ error: 'Failed to search documents' });
  }
});

// RAG query endpoints
app.post('/query', async (req, res) => {
  try {
    const { query, limit, threshold } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const response = await ragService.query({
      query,
      limit: limit || 5,
      threshold: threshold || 0.7,
    });

    res.json(response);
  } catch (error) {
    console.error('Error processing query:', error);
    res.status(500).json({ error: 'Failed to process query' });
  }
});

// Streaming RAG query endpoint
app.post('/query/stream', async (req, res) => {
  try {
    const { query, limit, threshold } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');

    const stream = await ragService.queryWithStreaming({
      query,
      limit: limit || 5,
      threshold: threshold || 0.7,
    });

    for await (const chunk of stream) {
      res.write(chunk);
    }
    
    res.end();
  } catch (error) {
    console.error('Error processing streaming query:', error);
    res.status(500).json({ error: 'Failed to process streaming query' });
  }
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function startServer() {
  await initializeServices();
  
  app.listen(PORT, () => {
    console.log(`🚀 RAG API server running on port ${PORT}`);
    console.log(`📚 Health check: http://localhost:${PORT}/health`);
    console.log(`🔍 API documentation: http://localhost:${PORT}/api-docs`);
  });
}

startServer().catch(console.error);

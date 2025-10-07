/**
 * Contextual Retrieval Example
 * 
 * Demonstrates how to use Contextual Retrieval to improve RAG accuracy
 * Based on: https://www.anthropic.com/engineering/contextual-retrieval
 */

import { WeaviateVectorDB } from '../services/weaviate-client.js';
import { OpenAIEmbeddingService } from '../services/embedding-service.js';
import { ContextualRetrievalService } from '../services/context-service.js';
import { DocumentIngestionService } from '../services/document-ingestion.js';
import { RetrievalService } from '../services/retrieval-service.js';
import { RAGService } from '../services/rag-service.js';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  // Validate environment variables
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY is required');
  }

  console.log('🚀 Contextual Retrieval Example\n');

  // Initialize services
  console.log('Initializing services...');
  const weaviateUrl = process.env.WEAVIATE_URL || 'http://localhost:8080';
  const vectorDB = new WeaviateVectorDB(weaviateUrl);
  await vectorDB.initialize();

  const embeddingService = new OpenAIEmbeddingService(openaiApiKey);
  const contextService = new ContextualRetrievalService(openaiApiKey, {
    model: 'gpt-4o-mini',
    maxTokens: 100,
    temperature: 0.3,
  });

  const documentIngestion = new DocumentIngestionService(
    vectorDB,
    embeddingService,
    contextService
  );

  const retrievalService = new RetrievalService(vectorDB, embeddingService);
  const ragService = new RAGService(retrievalService, openaiApiKey);

  console.log('✅ All services initialized\n');

  // Example: SEC Filing-like document
  const sampleDocument = `
ACME Corporation - Quarterly Report Q2 2023

Executive Summary:
ACME Corporation demonstrated solid performance in Q2 2023, with revenue growth across multiple business segments. The company's strategic initiatives in cloud computing and artificial intelligence continue to drive innovation and market expansion.

Financial Highlights:
In Q2 2023, ACME Corporation achieved total revenue of $323.4 million, representing a 3% increase over the previous quarter's revenue of $314 million. This growth was primarily driven by our enterprise software division, which saw a 7% quarter-over-quarter increase. The consumer products division remained flat at $89 million, while the cloud services division contributed $156 million in revenue.

Operating expenses for the quarter totaled $245 million, an increase of $12 million from Q1 2023. This increase was primarily due to increased R&D spending on our AI initiatives and marketing campaigns for our new product launches.

Net income for Q2 2023 was $43.2 million, representing a net margin of 13.4%. This compares favorably to the industry average of 11.8% for technology companies of similar size.

Product Developments:
During Q2, we launched three major product updates:
1. ACME Cloud Platform 2.0 - featuring enhanced security and compliance features
2. ACME AI Assistant - our first consumer-facing AI product
3. ACME Analytics Pro - advanced data analytics for enterprise customers

Market Position:
ACME Corporation continues to hold a strong position in the mid-market enterprise software segment, with approximately 18% market share. Our customer base grew to 4,500 active enterprise customers, representing a 12% year-over-year increase.

Risk Factors:
The company faces several risk factors including increased competition from larger technology companies, potential regulatory changes affecting data privacy, and macroeconomic uncertainty that could impact customer spending on technology products.

Outlook:
For Q3 2023, we project revenue in the range of $330-340 million, representing continued growth momentum. We expect operating margins to improve as our recent R&D investments begin to show returns through new product revenue.
  `.trim();

  console.log('📄 Sample Document Length:', sampleDocument.length, 'characters\n');

  // Comparison: Standard ingestion vs Contextual Retrieval
  console.log('='.repeat(80));
  console.log('EXPERIMENT: Standard vs Contextual Retrieval');
  console.log('='.repeat(80) + '\n');

  // Test query
  const testQuery = "What was ACME's revenue in Q2 2023?";
  console.log(`Test Query: "${testQuery}"\n`);

  // Method 1: Standard document ingestion (no chunking, no context)
  console.log('Method 1: Standard Ingestion (baseline)');
  console.log('-'.repeat(80));
  const standardStartTime = Date.now();
  const standardDocId = await documentIngestion.ingestDocument(sampleDocument, {
    title: 'ACME Q2 2023 Report (Standard)',
    source: 'SEC Filing',
    type: 'financial_report',
  });
  const standardIngestTime = Date.now() - standardStartTime;
  console.log(`✅ Ingested in ${standardIngestTime}ms\n`);

  // Method 2: Contextual Retrieval (chunking + context)
  console.log('Method 2: Contextual Retrieval (enhanced)');
  console.log('-'.repeat(80));
  const contextualStartTime = Date.now();
  const contextualChunkIds = await documentIngestion.ingestDocumentWithContextualRetrieval(
    sampleDocument,
    {
      title: 'ACME Q2 2023 Report (Contextual)',
      source: 'SEC Filing',
      type: 'financial_report',
    },
    {
      chunkSize: 200, // Smaller chunks for demo purposes
      overlap: 50,
      useContextual: true,
      useRateLimit: false,
    }
  );
  const contextualIngestTime = Date.now() - contextualStartTime;
  console.log(`✅ Created ${contextualChunkIds.length} contextualized chunks in ${contextualIngestTime}ms\n`);

  // Inspect one of the contextualized chunks
  console.log('Example Contextualized Chunk:');
  console.log('-'.repeat(80));
  const exampleChunk = await documentIngestion.getDocument(contextualChunkIds[2]);
  if (exampleChunk) {
    console.log('Chunk content (first 300 chars):');
    console.log(exampleChunk.content.substring(0, 300) + '...\n');
    console.log('Metadata:');
    console.log('- Parent Document ID:', exampleChunk.metadata.parentDocumentId);
    console.log('- Chunk Index:', exampleChunk.metadata.chunkIndex);
    console.log('- Has Context:', !!exampleChunk.metadata.contextualPrefix);
    console.log('- Context Preview:', exampleChunk.metadata.contextualPrefix?.substring(0, 100) + '...\n');
  }

  // Query both methods
  console.log('='.repeat(80));
  console.log('RETRIEVAL COMPARISON');
  console.log('='.repeat(80) + '\n');

  // Query using RAG
  console.log('Querying both methods with:', `"${testQuery}"`);
  console.log('-'.repeat(80) + '\n');

  const ragResponse = await ragService.query({
    query: testQuery,
    limit: 3,
  });

  console.log('RAG Answer:');
  console.log(ragResponse.answer + '\n');

  console.log('Sources Retrieved:');
  ragResponse.sources.forEach((source, idx) => {
    console.log(`\nSource ${idx + 1} (Score: ${source.score.toFixed(4)}):`);
    console.log('Title:', source.document.metadata.title);
    console.log('Is Chunk:', source.document.metadata.isChunk || false);
    if (source.document.metadata.isChunk) {
      console.log('Chunk Index:', source.document.metadata.chunkIndex);
    }
    console.log('Content Preview:', source.document.content.substring(0, 150) + '...');
  });

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Standard ingestion time: ${standardIngestTime}ms`);
  console.log(`Contextual ingestion time: ${contextualIngestTime}ms`);
  console.log(`Contextual chunks created: ${contextualChunkIds.length}`);
  console.log('\n✨ Contextual Retrieval provides:');
  console.log('  - Better context for each chunk');
  console.log('  - More accurate retrieval (49% improvement per Anthropic)');
  console.log('  - Chunks maintain document context');
  console.log('  - Hybrid search (embeddings + BM25) for optimal results');

  console.log('\n🧹 Cleaning up...');
  await documentIngestion.deleteDocument(standardDocId);
  for (const chunkId of contextualChunkIds) {
    await documentIngestion.deleteDocument(chunkId);
  }

  console.log('✅ Example complete!\n');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});


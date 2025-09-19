import { WeaviateVectorDB } from '../services/weaviate-client.js';
import { OpenAIEmbeddingService } from '../services/embedding-service.js';
import { DocumentIngestionService } from '../services/document-ingestion.js';
import { RetrievalService } from '../services/retrieval-service.js';
import { RAGService } from '../services/rag-service.js';

// Example documents for testing
const sampleDocuments = [
  {
    content: `Artificial Intelligence (AI) is a branch of computer science that aims to create machines capable of intelligent behavior. 
    AI systems can perform tasks that typically require human intelligence, such as visual perception, speech recognition, 
    decision-making, and language translation. Machine learning, a subset of AI, enables computers to learn and improve 
    from experience without being explicitly programmed.`,
    metadata: {
      title: 'Introduction to Artificial Intelligence',
      source: 'AI Fundamentals',
      type: 'educational',
    },
  },
  {
    content: `Vector databases are specialized databases designed to store and query high-dimensional vectors efficiently. 
    They are essential for applications like recommendation systems, image search, and natural language processing. 
    Popular vector databases include Pinecone, Weaviate, and Chroma. These databases use similarity search algorithms 
    to find the most relevant vectors based on distance metrics like cosine similarity.`,
    metadata: {
      title: 'Vector Databases Overview',
      source: 'Database Technologies',
      type: 'technical',
    },
  },
  {
    content: `Retrieval-Augmented Generation (RAG) is a technique that combines information retrieval with text generation. 
    RAG systems first retrieve relevant documents from a knowledge base, then use a language model to generate responses 
    based on the retrieved information. This approach improves the accuracy and relevance of generated text by grounding 
    it in factual information from the knowledge base.`,
    metadata: {
      title: 'Understanding RAG Systems',
      source: 'NLP Research',
      type: 'research',
    },
  },
  {
    content: `TypeScript is a programming language developed by Microsoft that adds static type definitions to JavaScript. 
    It compiles to plain JavaScript and can be used to develop large applications. TypeScript supports features like 
    interfaces, generics, and advanced type checking that help catch errors during development. Many modern web 
    frameworks and libraries are built with TypeScript for better developer experience and code reliability.`,
    metadata: {
      title: 'TypeScript Programming Language',
      source: 'Web Development',
      type: 'programming',
    },
  },
  {
    content: `Bun is a fast all-in-one JavaScript runtime, bundler, test runner, and package manager. It's designed to be 
    a drop-in replacement for Node.js with significantly better performance. Bun supports TypeScript natively without 
    additional configuration and includes built-in tools for bundling, testing, and package management. It's particularly 
    popular for its speed and developer experience improvements over traditional Node.js workflows.`,
    metadata: {
      title: 'Bun JavaScript Runtime',
      source: 'JavaScript Tools',
      type: 'programming',
    },
  },
];

async function runExample() {
  try {
    console.log('🚀 Starting RAG Example...\n');

    // Initialize services
    const weaviateUrl = process.env.WEAVIATE_URL || 'http://localhost:8080';
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    const vectorDB = new WeaviateVectorDB(weaviateUrl);
    await vectorDB.initialize();
    console.log('✅ Weaviate initialized');

    const embeddingService = new OpenAIEmbeddingService(openaiApiKey);
    const documentIngestion = new DocumentIngestionService(vectorDB, embeddingService);
    const retrievalService = new RetrievalService(vectorDB, embeddingService);
    const ragService = new RAGService(retrievalService, openaiApiKey);

    // Ingest sample documents
    console.log('\n📚 Ingesting sample documents...');
    const documentIds = await documentIngestion.ingestDocuments(sampleDocuments);
    console.log(`✅ Ingested ${documentIds.length} documents`);

    // Wait a moment for indexing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test search functionality
    console.log('\n🔍 Testing search functionality...');
    const searchResults = await retrievalService.search({
      query: 'What is machine learning?',
      limit: 3,
    });

    console.log('Search results:');
    searchResults.forEach((result, index) => {
      console.log(`${index + 1}. Score: ${result.score.toFixed(3)}`);
      console.log(`   Title: ${result.document.metadata.title}`);
      console.log(`   Content: ${result.document.content.substring(0, 100)}...\n`);
    });

    // Test RAG queries
    console.log('🤖 Testing RAG queries...\n');

    const queries = [
      'What is artificial intelligence?',
      'How do vector databases work?',
      'Explain RAG systems',
      'What are the benefits of TypeScript?',
      'Why use Bun over Node.js?',
    ];

    for (const query of queries) {
      console.log(`❓ Query: ${query}`);
      const response = await ragService.query({
        query,
        limit: 2,
      });
      
      console.log(`🤖 Answer: ${response.answer}`);
      console.log(`📊 Sources: ${response.sources.length} documents found`);
      console.log('---\n');
    }

    console.log('✅ Example completed successfully!');

  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

// Run the example if this file is executed directly
if (import.meta.main) {
  runExample();
}

export { runExample, sampleDocuments };

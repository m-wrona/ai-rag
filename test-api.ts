#!/usr/bin/env bun

/**
 * Simple test script to verify the RAG API is working
 * Run this after starting the server with: bun run dev
 */

const API_BASE = 'http://localhost:3000';

async function testAPI() {
  console.log('🧪 Testing RAG API...\n');

  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch(`${API_BASE}/health`);
    const health = await healthResponse.json();
    console.log('✅ Health check:', health.status);

    // Test document ingestion
    console.log('\n2. Testing document ingestion...');
    const docResponse = await fetch(`${API_BASE}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Artificial Intelligence is a field of computer science that focuses on creating machines that can perform tasks requiring human intelligence.',
        metadata: {
          title: 'AI Introduction',
          source: 'test',
          type: 'educational'
        }
      })
    });
    const doc = await docResponse.json();
    console.log('✅ Document ingested:', doc.id);

    // Wait a moment for indexing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test search
    console.log('\n3. Testing search...');
    const searchResponse = await fetch(`${API_BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'What is artificial intelligence?',
        limit: 3
      })
    });
    const search = await searchResponse.json();
    console.log('✅ Search results:', search.results.length, 'documents found');

    // Test RAG query
    console.log('\n4. Testing RAG query...');
    const queryResponse = await fetch(`${API_BASE}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'What is artificial intelligence?',
        limit: 3
      })
    });
    const query = await queryResponse.json();
    console.log('✅ RAG query result:');
    console.log('   Answer:', query.answer);
    console.log('   Sources:', query.sources.length, 'documents used');

    console.log('\n🎉 All tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testAPI();

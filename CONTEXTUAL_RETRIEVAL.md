# Contextual Retrieval Implementation

This document explains the Contextual Retrieval feature implementation based on [Anthropic's research](https://www.anthropic.com/engineering/contextual-retrieval).

## What is Contextual Retrieval?

Contextual Retrieval is a technique that improves RAG (Retrieval-Augmented Generation) accuracy by adding contextual information to document chunks before embedding them. This prevents the loss of context that typically occurs when documents are split into smaller pieces.

### The Problem

Traditional RAG systems chunk documents for efficient retrieval, but this can destroy context:

**Original Document Context:**
```
ACME Corp Q2 2023 Financial Report
...
Revenue: $323.4M
```

**Traditional Chunk (loses context):**
```
"The company's revenue grew by 3% over the previous quarter."
```
❌ Which company? Which quarter? What was the previous revenue?

### The Solution

Contextual Retrieval adds situating information to each chunk:

**Contextualized Chunk:**
```
This chunk is from ACME Corp's Q2 2023 financial report. 
The previous quarter (Q1 2023) had revenue of $314M.

The company's revenue grew by 3% over the previous quarter.
```
✅ Clear context! Easy to retrieve and understand.

## Implementation

### Architecture Overview

```
┌──────────────────┐
│ Full Document    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 1. Chunk         │ Split into ~800 word chunks
│    Document      │ with 100 word overlap
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 2. Generate      │ Use OpenAI to create context
│    Context       │ for each chunk
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 3. Prepend       │ Context + Original Chunk
│    Context       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 4. Embed         │ Create vector embeddings
│    Chunks        │ (Contextual Embeddings)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 5. Store in      │ Vector DB with BM25 index
│    Weaviate      │ (Contextual BM25)
└──────────────────┘
```

### Key Components

#### 1. **Chunking Utility** (`src/utils/chunking.ts`)
- `chunkDocument()`: Splits text by word count
- `chunkDocumentByCharacters()`: Splits text by character count
- Supports overlap between chunks to maintain continuity

#### 2. **Context Service** (`src/services/context-service.ts`)
- Uses OpenAI to generate contextual information
- Follows Anthropic's prompt template
- Supports batch processing with rate limiting
- Default model: `gpt-4o-mini` (fast and cost-effective)

#### 3. **Document Ingestion** (`src/services/document-ingestion.ts`)
- Original methods preserved for backward compatibility
- New method: `ingestDocumentWithContextualRetrieval()`
- Orchestrates: chunking → context generation → embedding → storage

#### 4. **Updated Types** (`src/types/index.ts`)
Added chunk-related metadata:
- `isChunk`: Boolean flag
- `parentDocumentId`: Links chunks to original document
- `chunkIndex`: Position in document
- `originalContent`: Chunk without context
- `contextualPrefix`: The generated context

#### 5. **API Integration** (`src/index.ts`)
- New endpoint: `POST /documents/contextual`
- Environment-based feature toggle
- Configurable context generation parameters

## Usage

### 1. Enable in Environment

```env
ENABLE_CONTEXTUAL_RETRIEVAL=true
CONTEXT_MODEL=gpt-4o-mini
CONTEXT_MAX_TOKENS=100
CONTEXT_TEMPERATURE=0.3
```

### 2. Use the Contextual API Endpoint

```bash
curl -X POST http://localhost:3000/documents/contextual \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Your long document...",
    "metadata": {
      "title": "Document Title",
      "source": "document_source"
    },
    "options": {
      "chunkSize": 800,
      "overlap": 100,
      "useContextual": true,
      "useRateLimit": false,
      "batchSize": 10
    }
  }'
```

### 3. Programmatic Usage

```typescript
import { ContextualRetrievalService } from './services/context-service.js';
import { DocumentIngestionService } from './services/document-ingestion.js';

// Initialize services
const contextService = new ContextualRetrievalService(openaiApiKey);
const ingestionService = new DocumentIngestionService(
  vectorDB,
  embeddingService,
  contextService // Pass context service
);

// Ingest with contextual retrieval
const chunkIds = await ingestionService.ingestDocumentWithContextualRetrieval(
  documentContent,
  metadata,
  {
    chunkSize: 800,
    overlap: 100,
    useContextual: true
  }
);
```

## Performance Benefits

Based on Anthropic's research:

| Method | Retrieval Failure Rate | Improvement |
|--------|------------------------|-------------|
| Baseline (embeddings only) | 5.7% | - |
| + Contextual Embeddings | 3.7% | **35%** ↓ |
| + Contextual BM25 | 2.9% | **49%** ↓ |
| + Reranking | 1.9% | **67%** ↓ |

**Current Implementation:** ✅ Contextual Embeddings + Contextual BM25 = **49% improvement**

## Configuration Options

### Chunking Options

```typescript
{
  chunkSize: 800,        // Words per chunk (default: 800)
  overlap: 100,          // Overlapping words (default: 100)
  useContextual: true,   // Enable context generation
  useRateLimit: false,   // Rate limit API calls
  batchSize: 10          // Chunks per batch (if rate limiting)
}
```

### Context Generation Options

```typescript
{
  model: 'gpt-4o-mini',  // OpenAI model for context
  maxTokens: 100,        // Max tokens for context
  temperature: 0.3       // Lower = more consistent
}
```

## Cost Considerations

### Context Generation Costs

Using `gpt-4o-mini`:
- Input: ~$0.15 per 1M tokens
- Output: ~$0.60 per 1M tokens

**Example for 10,000 word document:**
- ~20 chunks (500 words each)
- ~10,000 words × 1.3 = 13,000 tokens input per chunk
- 20 chunks × 13,000 tokens = 260,000 tokens total
- Context output: 20 chunks × 100 tokens = 2,000 tokens
- **Approximate cost: $0.04 per document**

### Optimization Tips

1. **Use larger chunks** (reduce number of context generations)
2. **Use rate limiting** for large batches
3. **Cache frequently used documents** (don't regenerate)
4. **Adjust context length** (fewer tokens = lower cost)

## Hybrid Search

Weaviate's hybrid search is automatically enabled, combining:

1. **Semantic Search** (Vector Embeddings)
   - Finds similar meaning
   - Good for conceptual queries

2. **Keyword Search** (BM25)
   - Finds exact matches
   - Good for specific terms/IDs

The `alpha` parameter controls the balance:
- `alpha=0.0`: Pure BM25
- `alpha=0.5`: Balanced (default)
- `alpha=1.0`: Pure vector search

## Examples

### Run the Example

```bash
bun run src/examples/contextual-retrieval-example.ts
```

This example demonstrates:
- Standard vs Contextual ingestion comparison
- Chunk inspection
- Retrieval accuracy comparison
- Performance metrics

## Future Enhancements

Potential improvements (not yet implemented):

1. **Reranking** - Add Cohere/Voyage reranker for 67% improvement
2. **Prompt Caching** - Use OpenAI batch API for cost savings
3. **Recursive Chunking** - Better handling of document structure
4. **Semantic Chunking** - Split by meaning rather than word count
5. **Multi-vector Storage** - Store both contextualized and original chunks

## Troubleshooting

### Issue: Context generation is slow
**Solution:** Enable rate limiting or use batch processing
```typescript
options: { useRateLimit: true, batchSize: 10 }
```

### Issue: Chunks too large/small
**Solution:** Adjust chunk size based on your documents
```typescript
options: { chunkSize: 1000, overlap: 150 }
```

### Issue: High costs
**Solution:** 
- Use larger chunks (fewer API calls)
- Reduce context max tokens
- Use a cheaper model if available

### Issue: Context not helpful
**Solution:** Customize the prompt in `context-service.ts`:
```typescript
const prompt = `Your custom prompt here...`;
```

## References

- [Anthropic's Contextual Retrieval Blog Post](https://www.anthropic.com/engineering/contextual-retrieval)
- [OpenAI Embeddings Documentation](https://platform.openai.com/docs/guides/embeddings)
- [Weaviate Hybrid Search](https://weaviate.io/developers/weaviate/search/hybrid)

## License

Same as the main project.


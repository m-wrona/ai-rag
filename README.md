# AI RAG Project

Retrieval-Augmented Generation (RAG) system built with TypeScript and Bun, featuring **Contextual Retrieval** for improved accuracy.

Based on [Anthropic's Contextual Retrieval research](https://www.anthropic.com/engineering/contextual-retrieval), this implementation can reduce retrieval failures by up to **49%** using contextual embeddings and BM25 hybrid search.

Currently supports Weaviate as the vector database backend.

## Features

- 🚀 **Fast Development**: Built with Bun for optimal performance
- 🔍 **Hybrid Search**: Combines vector embeddings + BM25 for better retrieval
- 🎯 **Contextual Retrieval**: Adds context to chunks before embedding (49% improvement)
- 🤖 **AI Integration**: OpenAI embeddings and GPT models
- 📚 **Smart Chunking**: Automatic document chunking with overlap
- 🔄 **Complete RAG Pipeline**: Retrieval-augmented generation workflow
- 🌐 **REST API**: Easy-to-use HTTP endpoints
- 📊 **Streaming Support**: Real-time response streaming

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Documents     │───▶│  Embedding       │───▶│   Weaviate      │
│                 │    │  Service         │    │   Vector DB     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
┌─────────────────┐    ┌──────────────────┐             │
│   User Query    │───▶│  Retrieval       │◀────────────┘
│                 │    │  Service         │
└─────────────────┘    └──────────────────┘
                                │
┌─────────────────┐    ┌──────────────────┐
│   Generated     │◀───│  RAG Service     │
│   Response      │    │  (OpenAI GPT)    │
└─────────────────┘    └──────────────────┘
```

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) installed
- [Docker](https://www.docker.com/) installed
- OpenAI API key

### 1. Clone and Install

```bash
git clone <repository-url>
cd ai-rag
bun install
```

### 2. Environment Setup

```bash
cp env.example .env
```

Edit `.env` file with your configuration:

```env
OPENAI_API_KEY=your_openai_api_key_here
WEAVIATE_URL=http://localhost:8080
WEAVIATE_API_KEY=your_weaviate_api_key_here
PORT=3000

# Optional: Enable Contextual Retrieval for 49% better accuracy
ENABLE_CONTEXTUAL_RETRIEVAL=true
CONTEXT_MODEL=gpt-4o-mini
CONTEXT_MAX_TOKENS=100
CONTEXT_TEMPERATURE=0.3
```

### 3. Start Weaviate

```bash
docker-compose up -d
```

### 4. Run the Application

```bash
# Development mode
bun run dev

# Or build and run
bun run build
bun run start
```

### 5. Test the API

```bash
# Health check
curl http://localhost:3000/health

# Standard document ingestion
curl -X POST http://localhost:3000/documents \
  -H "Content-Type: application/json" \
  -d '{
    "content": "This is a sample document about artificial intelligence.",
    "metadata": {
      "title": "AI Sample",
      "source": "test",
      "type": "example"
    }
  }'

# Query the RAG system
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is artificial intelligence?",
    "limit": 3
  }'
```

### 6. (Optional) Enable Contextual Retrieval for Better Accuracy

For improved retrieval accuracy, enable contextual retrieval:

```bash
# Add to .env file
echo "ENABLE_CONTEXTUAL_RETRIEVAL=true" >> .env

# Restart the server
bun run dev

# Use contextual ingestion endpoint
curl -X POST http://localhost:3000/documents/contextual \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Your long document here...",
    "metadata": {"title": "Document Title"},
    "options": {"chunkSize": 800, "overlap": 100, "useContextual": true}
  }'
```

See the [Contextual Retrieval](#contextual-retrieval) section below for detailed usage.

## Contextual Retrieval

This project implements [Anthropic's Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval) technique using OpenAI instead of Claude.

### Quick Start

```bash
# 1. Enable in .env
ENABLE_CONTEXTUAL_RETRIEVAL=true

# 2. Ingest document with contextual retrieval
curl -X POST http://localhost:3000/documents/contextual \
  -H "Content-Type: application/json" \
  -d '{"content":"Your document text...","metadata":{"title":"Doc Title"},"options":{"useContextual":true}}'

# 3. Query as usual
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{"query":"Your question here","limit":3}'
```

### How It Works

1. **Document Chunking**: Large documents are split into ~800 word chunks with overlap
2. **Context Generation**: Each chunk gets contextual information about its place in the document
3. **Contextual Embeddings**: Chunks with prepended context are embedded
4. **Contextual BM25**: The contextualized chunks are also indexed for keyword search
5. **Hybrid Search**: Queries use both semantic (embeddings) and keyword (BM25) search

### Example

**Original Chunk:**
```
The company's revenue grew by 3% over the previous quarter.
```

**Contextualized Chunk:**
```
This chunk is from an SEC filing on ACME corp's performance in Q2 2023; 
the previous quarter's revenue was $314 million. 

The company's revenue grew by 3% over the previous quarter.
```

### Using Contextual Retrieval

#### Step 1: Enable in Environment

Edit your `.env` file:
```env
ENABLE_CONTEXTUAL_RETRIEVAL=true
CONTEXT_MODEL=gpt-4o-mini
CONTEXT_MAX_TOKENS=100
CONTEXT_TEMPERATURE=0.3
```

#### Step 2: Ingest Document with Contextual Retrieval

```bash
curl -X POST http://localhost:3000/documents/contextual \
  -H "Content-Type: application/json" \
  -d '{
    "content": "ACME Corporation Q2 2023 Report\n\nExecutive Summary:\nACME Corporation demonstrated strong performance in Q2 2023. The cloud services division led growth with a 15% increase in revenue.\n\nFinancial Results:\nTotal revenue for Q2 2023 reached $450 million, up from $420 million in Q1 2023. This represents a 7% quarter-over-quarter growth. Operating expenses increased to $320 million due to expanded R&D investments in artificial intelligence.\n\nProduct Launches:\nDuring the quarter, we launched ACME AI Platform 3.0, featuring advanced machine learning capabilities and improved security features for enterprise customers.",
    "metadata": {
      "title": "ACME Q2 2023 Report",
      "source": "Financial Reports",
      "type": "quarterly_report"
    },
    "options": {
      "chunkSize": 800,
      "overlap": 100,
      "useContextual": true
    }
  }'
```

**Response:**
```json
{
  "chunkIds": ["uuid-1", "uuid-2", "uuid-3"],
  "chunkCount": 3,
  "message": "Document ingested with contextual retrieval successfully"
}
```

#### Step 3: Query with RAG

Now query the ingested document:

```bash
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What was ACME's Q2 2023 revenue and how does it compare to Q1?",
    "limit": 3
  }'
```

**Response:**
```json
{
  "answer": "ACME Corporation's Q2 2023 revenue was $450 million, which represents a 7% increase compared to Q1 2023 revenue of $420 million. This $30 million increase demonstrates strong quarter-over-quarter growth.",
  "sources": [
    {
      "document": {
        "content": "Context: This section discusses ACME Corporation's Q2 2023 financial performance...\n\nTotal revenue for Q2 2023 reached $450 million, up from $420 million in Q1 2023...",
        "metadata": {
          "title": "ACME Q2 2023 Report",
          "isChunk": true,
          "chunkIndex": 1
        }
      },
      "score": 0.89
    }
  ],
  "query": "What was ACME's Q2 2023 revenue and how does it compare to Q1?"
}
```

#### Step 4: Search for Similar Documents

```bash
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "cloud services revenue growth",
    "limit": 5,
    "threshold": 0.7
  }'
```

### Complete Example with Comparison

See the complete example comparing standard vs contextual retrieval:

```bash
# Run the example script
bun run src/examples/contextual-retrieval-example.ts
```

This will show you:
- Ingestion time comparison
- Chunk inspection
- Retrieval accuracy differences
- Performance metrics

### Performance

Based on Anthropic's research:
- **35% improvement** with Contextual Embeddings alone
- **49% improvement** with Contextual Embeddings + Contextual BM25 (our default)
- **67% improvement** possible with reranking (not yet implemented)

## API Endpoints

### Document Management

- `POST /documents` - Ingest a single document (no chunking)
- `POST /documents/batch` - Ingest multiple documents
- `POST /documents/contextual` - **Ingest with contextual retrieval (recommended)**
- `GET /documents/:id` - Get a specific document
- `DELETE /documents/:id` - Delete a document

### Search & Query

- `POST /search` - Search for similar documents
- `POST /query` - RAG query (retrieval + generation)
- `POST /query/stream` - Streaming RAG query

### System

- `GET /health` - Health check

## Example Usage

See `src/examples/example-usage.ts` for a complete example:

```bash
bun run src/examples/example-usage.ts
```

## Project Structure

```
src/
├── services/
│   ├── weaviate-client.ts      # Weaviate vector database client
│   ├── embedding-service.ts    # OpenAI embedding service
│   ├── context-service.ts      # Contextual retrieval service (NEW)
│   ├── document-ingestion.ts   # Document ingestion service
│   ├── retrieval-service.ts    # Document retrieval service
│   └── rag-service.ts          # RAG pipeline service
├── utils/
│   └── chunking.ts             # Document chunking utilities (NEW)
├── types/
│   └── index.ts                # TypeScript type definitions
├── examples/
│   └── example-usage.ts        # Example usage and test data
└── index.ts                    # Main API server
```

## Configuration

### Weaviate Configuration

The Weaviate instance is configured via `docker-compose.yml`:

- **Port**: 8080
- **Authentication**: Anonymous access enabled
- **Vectorizer**: None (we provide our own vectors)
- **Persistence**: Data persisted in Docker volume

### OpenAI Configuration

- **Embedding Model**: `text-embedding-3-small` (default)
- **Chat Model**: `gpt-3.5-turbo` (default)
- **Temperature**: 0.7
- **Max Tokens**: 1000

## Development

### Scripts

```bash
bun run dev      # Development mode with hot reload
bun run build    # Build for production
bun run start    # Start production build
bun run test     # Run tests
```


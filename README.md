# AI RAG Project

A basic Retrieval-Augmented Generation (RAG) project built with TypeScript and Bun, featuring multiple vector database backends. Currently supports Weaviate as the vector database backend.

## Features

- 🚀 **Fast Development**: Built with Bun for optimal performance
- 🔍 **Vector Search**: Powered by Weaviate vector database
- 🤖 **AI Integration**: OpenAI embeddings and GPT models
- 📚 **Document Ingestion**: Support for various document types
- 🔄 **RAG Pipeline**: Complete retrieval-augmented generation workflow
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

# Ingest a document
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

## API Endpoints

### Document Management

- `POST /documents` - Ingest a single document
- `POST /documents/batch` - Ingest multiple documents
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
│   ├── document-ingestion.ts   # Document ingestion service
│   ├── retrieval-service.ts    # Document retrieval service
│   └── rag-service.ts         # RAG pipeline service
├── types/
│   └── index.ts               # TypeScript type definitions
├── examples/
│   └── example-usage.ts       # Example usage and test data
└── index.ts                   # Main API server
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


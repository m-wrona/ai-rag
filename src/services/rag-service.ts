import OpenAI from 'openai';
import { RetrievalService } from './retrieval-service.js';
import { RAGQuery, RAGResponse } from '../types/index.js';

export class RAGService {
  private openai: OpenAI;

  constructor(
    private retrievalService: RetrievalService,
    openaiApiKey: string,
    private model: string = 'gpt-3.5-turbo'
  ) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
  }

  async query(query: RAGQuery): Promise<RAGResponse> {
    try {
      // Retrieve relevant documents
      const searchResults = await this.retrievalService.search(query);
      
      if (searchResults.length === 0) {
        return {
          answer: "I couldn't find any relevant information to answer your question.",
          sources: [],
          query: query.query,
        };
      }

      // Create context from retrieved documents
      const context = searchResults
        .map(result => result.document.content)
        .join('\n\n');

      // Generate answer using OpenAI
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant that answers questions based on the provided context. 
            Use only the information from the context to answer questions. If the context doesn't contain 
            enough information to answer the question, say so. Be concise and accurate.`,
          },
          {
            role: 'user',
            content: `Context:\n${context}\n\nQuestion: ${query.query}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const answer = completion.choices[0]?.message?.content || 'No answer generated.';

      return {
        answer,
        sources: searchResults,
        query: query.query,
      };
    } catch (error) {
      console.error('Failed to process RAG query:', error);
      throw error;
    }
  }

  async queryWithStreaming(query: RAGQuery): Promise<AsyncGenerator<string, void, unknown>> {
    try {
      // Retrieve relevant documents
      const searchResults = await this.retrievalService.search(query);
      
      if (searchResults.length === 0) {
        return (async function* () {
          yield "I couldn't find any relevant information to answer your question.";
        })();
      }

      // Create context from retrieved documents
      const context = searchResults
        .map(result => result.document.content)
        .join('\n\n');

      // Generate streaming response
      const stream = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant that answers questions based on the provided context. 
            Use only the information from the context to answer questions. If the context doesn't contain 
            enough information to answer the question, say so. Be concise and accurate.`,
          },
          {
            role: 'user',
            content: `Context:\n${context}\n\nQuestion: ${query.query}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
        stream: true,
      });

      return (async function* () {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            yield content;
          }
        }
      })();
    } catch (error) {
      console.error('Failed to process streaming RAG query:', error);
      throw error;
    }
  }
}

import OpenAI from 'openai';

export interface ContextGenerationOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  windowSize?: number; // Number of previous chunk summaries to include
}

export class ContextualRetrievalService {
  private openai: OpenAI;
  private defaultOptions: Required<ContextGenerationOptions>;

  constructor(
    apiKey: string,
    options: ContextGenerationOptions = {}
  ) {
    this.openai = new OpenAI({ apiKey });
    this.defaultOptions = {
      model: options.model || 'gpt-4o-mini',
      maxTokens: options.maxTokens || 100,
      temperature: options.temperature || 0.3,
      windowSize: options.windowSize || 2, // Default: 2 previous summaries
    };
  }

  /**
   * Creates a brief summary of a single chunk
   * 
   * @param chunk - The chunk to summarize
   * @param chunkIndex - Position of this chunk
   * @returns Brief summary (1 sentence, ~50 tokens)
   */
  private async summarizeChunk(
    chunk: string,
    chunkIndex: number
  ): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.defaultOptions.model,
        messages: [
          {
            role: 'system',
            content: 'Summarize the given text in one concise sentence. Focus on key topics, entities, and main points.',
          },
          {
            role: 'user',
            content: chunk,
          },
        ],
        max_tokens: 50, // Keep summaries short
        temperature: 0.3,
      });

      return response.choices[0]?.message?.content?.trim() || '';
    } catch (error) {
      console.error(`Failed to summarize chunk ${chunkIndex}:`, error);
      return ''; // Return empty on error, don't fail the whole process
    }
  }

  /**
   * Generates contextual information for a chunk using summaries of previous chunks
   * 
   * @param chunk - The specific chunk to contextualize
   * @param chunkIndex - Position of this chunk in the document
   * @param previousSummaries - Summaries of previous chunks
   * @param metadata - Optional document metadata
   */
  async generateContextForChunk(
    chunk: string,
    chunkIndex: number,
    previousSummaries: string[],
    metadata?: Record<string, any>
  ): Promise<string> {
    // Build document context from metadata
    const docInfo = [];
    if (metadata?.title) docInfo.push(`"${metadata.title}"`);
    if (metadata?.type) docInfo.push(metadata.type);
    if (metadata?.source) docInfo.push(`(${metadata.source})`);
    
    const docContext = docInfo.length > 0 ? docInfo.join(' ') : 'Document';
    const positionInfo = `Chunk ${chunkIndex + 1}`;

    // Get relevant previous summaries (sliding window)
    const window = this.defaultOptions.windowSize;
    const startIdx = Math.max(0, chunkIndex - window);
    const relevantSummaries = previousSummaries.slice(startIdx, chunkIndex);
    
    let contextHints = '';
    if (relevantSummaries.length > 0) {
      contextHints = `Previous sections covered:\n${relevantSummaries.map((s, i) => `- ${s}`).join('\n')}\n\n`;
    }

    const prompt = `${docContext} - ${positionInfo}
${contextHints}Current chunk:
${chunk}

Provide a brief 1-2 sentence context explaining what this chunk discusses and how it relates to the document. Focus on topics, entities, and relevance for search retrieval.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.defaultOptions.model,
        messages: [
          {
            role: 'system',
            content: 'You provide concise contextual information for document chunks to improve search retrieval. Create context that situates the chunk within the broader document.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: this.defaultOptions.maxTokens,
        temperature: this.defaultOptions.temperature,
      });

      return response.choices[0]?.message?.content?.trim() || '';
    } catch (error) {
      console.error('Failed to generate context for chunk:', error);
      throw new Error(`Failed to generate context: ${error}`);
    }
  }

  /**
   * Two-pass approach: First summarize all chunks, then generate contexts
   * Much more efficient than using full chunk text
   * 
   * @param allChunks - Array of all chunks from the document
   * @param metadata - Optional document metadata
   */
  async generateContextsForChunks(
    allChunks: string[],
    metadata?: Record<string, any>
  ): Promise<string[]> {
    console.log(`Starting two-pass context generation for ${allChunks.length} chunks...`);
    
    try {
      // PASS 1: Generate summaries for all chunks
      console.log('Pass 1: Generating chunk summaries...');
      const summaryPromises = allChunks.map((chunk, index) =>
        this.summarizeChunk(chunk, index)
      );
      const summaries = await Promise.all(summaryPromises);
      console.log(`✓ Generated ${summaries.length} summaries`);
      
      // PASS 2: Generate contexts using previous summaries
      console.log('Pass 2: Generating contexts using summaries...');
      const contextPromises = allChunks.map((chunk, index) =>
        this.generateContextForChunk(chunk, index, summaries, metadata)
      );
      const contexts = await Promise.all(contextPromises);
      console.log(`✓ Generated ${contexts.length} contexts`);
      
      return contexts;
    } catch (error) {
      console.error('Failed to generate contexts for chunks:', error);
      throw error;
    }
  }

  /**
   * Two-pass approach with rate limiting
   * 
   * @param allChunks - Array of all chunks from the document
   * @param metadata - Optional document metadata
   * @param batchSize - Number of requests to process in parallel
   * @param delayMs - Delay between batches in milliseconds
   */
  async generateContextsWithRateLimit(
    allChunks: string[],
    metadata?: Record<string, any>,
    batchSize: number = 10,
    delayMs: number = 1000
  ): Promise<string[]> {
    console.log(`Starting two-pass context generation with rate limiting for ${allChunks.length} chunks...`);
    
    // PASS 1: Summarize all chunks with rate limiting
    console.log('Pass 1: Generating chunk summaries...');
    const summaries: string[] = [];
    
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, Math.min(i + batchSize, allChunks.length));
      console.log(`  Summarizing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allChunks.length / batchSize)}`);
      
      const batchSummaries = await Promise.all(
        batch.map((chunk, idx) => this.summarizeChunk(chunk, i + idx))
      );
      
      summaries.push(...batchSummaries);
      
      if (i + batchSize < allChunks.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    console.log(`✓ Generated ${summaries.length} summaries`);
    
    // PASS 2: Generate contexts with rate limiting
    console.log('Pass 2: Generating contexts using summaries...');
    const contexts: string[] = [];
    
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, Math.min(i + batchSize, allChunks.length));
      console.log(`  Contextualizing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allChunks.length / batchSize)}`);
      
      const batchContexts = await Promise.all(
        batch.map((chunk, idx) => 
          this.generateContextForChunk(chunk, i + idx, summaries, metadata)
        )
      );
      
      contexts.push(...batchContexts);
      
      if (i + batchSize < allChunks.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    console.log(`✓ Generated ${contexts.length} contexts`);
    
    return contexts;
  }
}

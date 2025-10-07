import OpenAI from 'openai';

export interface ContextGenerationOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
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
      model: options.model || 'gpt-4o-mini', // Fast and cheap for context generation
      maxTokens: options.maxTokens || 100,
      temperature: options.temperature || 0.3, // Lower for more consistent context
    };
  }

  /**
   * Generates contextual information for a single chunk
   * Following Anthropic's approach but using OpenAI
   * 
   * @param wholeDocument - The complete original document
   * @param chunk - The specific chunk to contextualize
   * @param metadata - Optional document metadata to include in context
   */
  async generateContextForChunk(
    wholeDocument: string,
    chunk: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    const metadataContext = metadata 
      ? `Document metadata: ${JSON.stringify(metadata)}\n\n` 
      : '';

    const prompt = `${metadataContext}<document>
${wholeDocument}
</document>

Here is the chunk we want to situate within the whole document:
<chunk>
${chunk}
</chunk>

Please give a short succinct context to situate this chunk within the overall document for the purposes of improving search retrieval of the chunk. Answer only with the succinct context and nothing else.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.defaultOptions.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert at providing concise, relevant context for document chunks to improve retrieval accuracy. Provide only the context, no explanations or additional text.',
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
   * Generates contexts for multiple chunks
   * Processes in parallel for efficiency
   * 
   * @param wholeDocument - The complete original document
   * @param chunks - Array of chunks to contextualize
   * @param metadata - Optional document metadata
   */
  async generateContextsForChunks(
    wholeDocument: string,
    chunks: string[],
    metadata?: Record<string, any>
  ): Promise<string[]> {
    console.log(`Generating contexts for ${chunks.length} chunks...`);
    
    try {
      const contextPromises = chunks.map((chunk) =>
        this.generateContextForChunk(wholeDocument, chunk, metadata)
      );

      const contexts = await Promise.all(contextPromises);
      console.log(`Successfully generated ${contexts.length} contexts`);
      
      return contexts;
    } catch (error) {
      console.error('Failed to generate contexts for chunks:', error);
      throw error;
    }
  }

  /**
   * Generates contexts for chunks with rate limiting
   * Useful for large documents to avoid hitting rate limits
   * 
   * @param wholeDocument - The complete original document
   * @param chunks - Array of chunks to contextualize
   * @param metadata - Optional document metadata
   * @param batchSize - Number of requests to process in parallel
   * @param delayMs - Delay between batches in milliseconds
   */
  async generateContextsWithRateLimit(
    wholeDocument: string,
    chunks: string[],
    metadata?: Record<string, any>,
    batchSize: number = 10,
    delayMs: number = 1000
  ): Promise<string[]> {
    const contexts: string[] = [];
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);
      
      const batchContexts = await this.generateContextsForChunks(
        wholeDocument,
        batch,
        metadata
      );
      
      contexts.push(...batchContexts);
      
      // Add delay between batches (except for the last one)
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    return contexts;
  }
}

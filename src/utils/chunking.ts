export interface DocumentChunk {
    content: string;
    chunkIndex: number;
    startOffset: number;
    endOffset: number;
  }
  
  /**
   * Chunks a document into smaller pieces with optional overlap
   * Uses simple word-based chunking as a starting point
   * 
   * @param content - The full document content
   * @param chunkSize - Approximate size in words (default: 800)
   * @param overlap - Number of words to overlap between chunks (default: 100)
   */
  export function chunkDocument(
    content: string,
    chunkSize: number = 800,
    overlap: number = 100
  ): DocumentChunk[] {
    const words = content.split(/\s+/);
    const chunks: DocumentChunk[] = [];
    
    if (words.length === 0) {
      return chunks;
    }
  
    let startIndex = 0;
    let chunkIndex = 0;
    
    while (startIndex < words.length) {
      const endIndex = Math.min(startIndex + chunkSize, words.length);
      const chunkWords = words.slice(startIndex, endIndex);
      const chunkContent = chunkWords.join(' ');
      
      chunks.push({
        content: chunkContent,
        chunkIndex,
        startOffset: startIndex,
        endOffset: endIndex,
      });
      
      chunkIndex++;
      
      // Move forward by (chunkSize - overlap) to create overlap
      startIndex += (chunkSize - overlap);
      
      // Prevent infinite loop if overlap >= chunkSize
      if (overlap >= chunkSize) {
        startIndex = endIndex;
      }
    }
    
    return chunks;
  }
  
  /**
   * Chunks document by character count (more precise for token estimation)
   * Roughly 4 characters = 1 token on average
   */
  export function chunkDocumentByCharacters(
    content: string,
    chunkSizeChars: number = 3200, // ~800 tokens
    overlapChars: number = 400 // ~100 tokens
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    
    if (content.length === 0) {
      return chunks;
    }
  
    let startIndex = 0;
    let chunkIndex = 0;
    
    while (startIndex < content.length) {
      const endIndex = Math.min(startIndex + chunkSizeChars, content.length);
      const chunkContent = content.slice(startIndex, endIndex);
      
      chunks.push({
        content: chunkContent,
        chunkIndex,
        startOffset: startIndex,
        endOffset: endIndex,
      });
      
      chunkIndex++;
      startIndex += (chunkSizeChars - overlapChars);
      
      if (overlapChars >= chunkSizeChars) {
        startIndex = endIndex;
      }
    }
    
    return chunks;
  }
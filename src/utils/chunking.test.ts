import { chunkDocument, type DocumentChunk } from "./chunking";

describe("chunkDocument", () => {
  test("should handle empty string", () => {
    const result = chunkDocument("");
    // "".split(/\s+/) returns [''], not []
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("");
    expect(result[0].chunkIndex).toBe(0);
  });

  test("should handle whitespace-only string", () => {
    const result = chunkDocument("   \n\t  ");
    // "   \n\t  ".split(/\s+/) returns ['', ''], which joins to " "
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe(" "); // Two empty strings joined with space
    expect(result[0].chunkIndex).toBe(0);
  });

  test("should chunk content shorter than chunkSize into single chunk", () => {
    const content = "This is a short document with only ten words here.";
    const result = chunkDocument(content, 20, 5);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      content: content,
      chunkIndex: 0,
      startOffset: 0,
      endOffset: 10,
    });
  });

  test("should chunk document with default parameters", () => {
    // Create a document with more than 800 words
    const words = Array(1000).fill("word").map((w, i) => `${w}${i}`);
    const content = words.join(" ");
    
    const result = chunkDocument(content);
    
    expect(result.length).toBeGreaterThan(1);
    expect(result[0].chunkIndex).toBe(0);
    expect(result[0].startOffset).toBe(0);
    expect(result[0].endOffset).toBe(800);
  });

  test("should create chunks with custom size", () => {
    const content = Array(50).fill("word").map((w, i) => `${w}${i}`).join(" ");
    const result = chunkDocument(content, 10, 2);
    
    // Should have multiple chunks since content is 50 words with chunk size 10
    expect(result.length).toBeGreaterThan(1);
    
    // First chunk should have 10 words
    const firstChunkWords = result[0].content.split(/\s+/).length;
    expect(firstChunkWords).toBe(10);
  });

  test("should handle overlap correctly", () => {
    const content = Array(30).fill("word").map((w, i) => `${w}${i}`).join(" ");
    const chunkSize = 10;
    const overlap = 3;
    
    const result = chunkDocument(content, chunkSize, overlap);
    
    // Verify overlapping words
    if (result.length > 1) {
      const firstChunkWords = result[0].content.split(/\s+/);
      const secondChunkWords = result[1].content.split(/\s+/);
      
      // Last 'overlap' words from first chunk should match first 'overlap' words of second chunk
      const firstChunkEnd = firstChunkWords.slice(-overlap);
      const secondChunkStart = secondChunkWords.slice(0, overlap);
      
      expect(firstChunkEnd).toEqual(secondChunkStart);
    }
  });

  test("should calculate startOffset and endOffset correctly", () => {
    const content = Array(50).fill("word").map((w, i) => `${w}${i}`).join(" ");
    const chunkSize = 15;
    const overlap = 5;
    
    const result = chunkDocument(content, chunkSize, overlap);
    
    // First chunk
    expect(result[0].startOffset).toBe(0);
    expect(result[0].endOffset).toBe(15);
    
    // Second chunk should start at (chunkSize - overlap) from first chunk
    if (result.length > 1) {
      expect(result[1].startOffset).toBe(10); // 15 - 5 = 10
      expect(result[1].endOffset).toBe(25);
    }
  });

  test("should increment chunk indices correctly", () => {
    const content = Array(100).fill("word").map((w, i) => `${w}${i}`).join(" ");
    const result = chunkDocument(content, 20, 5);
    
    result.forEach((chunk, index) => {
      expect(chunk.chunkIndex).toBe(index);
    });
  });

  test("should handle overlap >= chunkSize edge case", () => {
    const content = Array(50).fill("word").map((w, i) => `${w}${i}`).join(" ");
    const chunkSize = 10;
    const overlap = 15; // overlap > chunkSize
    
    const result = chunkDocument(content, chunkSize, overlap);
    
    // Should still create multiple chunks without infinite loop
    expect(result.length).toBeGreaterThan(0);
    
    // Verify no infinite loop occurred by checking offsets progress
    for (let i = 1; i < result.length; i++) {
      expect(result[i].startOffset).toBeGreaterThan(result[i - 1].startOffset);
    }
  });

  test("should handle content exactly matching chunkSize", () => {
    const content = Array(10).fill("word").map((w, i) => `${w}${i}`).join(" ");
    const result = chunkDocument(content, 10, 2);
    
    // With overlap=2, after first chunk (0-10), next starts at 8 (10-2)
    // So we get 2 chunks: chunk 0 (words 0-9) and chunk 1 (words 8-9)
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe(content);
    expect(result[0].startOffset).toBe(0);
    expect(result[0].endOffset).toBe(10);
    expect(result[1].startOffset).toBe(8);
    expect(result[1].endOffset).toBe(10);
  });

  test("should preserve exact word content in chunks", () => {
    const words = ["The", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog"];
    const content = words.join(" ");
    const result = chunkDocument(content, 5, 2);
    
    // First chunk should have first 5 words (indices 0-4)
    expect(result[0].content).toBe("The quick brown fox jumps");
    
    // Second chunk starts at index 3 (moves by chunkSize - overlap = 5 - 2 = 3)
    // So it takes words at indices 3-7
    if (result.length > 1) {
      expect(result[1].content).toBe("fox jumps over the lazy");
      
      // Verify the overlap: last 2 words of chunk 0 = first 2 words of chunk 1
      const chunk0Words = result[0].content.split(/\s+/);
      const chunk1Words = result[1].content.split(/\s+/);
      expect(chunk0Words.slice(-2)).toEqual(["fox", "jumps"]);
      expect(chunk1Words.slice(0, 2)).toEqual(["fox", "jumps"]);
    }
  });

  test("should handle single word content", () => {
    const content = "word";
    const result = chunkDocument(content, 10, 2);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      content: "word",
      chunkIndex: 0,
      startOffset: 0,
      endOffset: 1,
    });
  });

  test("should handle zero overlap", () => {
    const content = Array(30).fill("word").map((w, i) => `${w}${i}`).join(" ");
    const chunkSize = 10;
    const overlap = 0;
    
    const result = chunkDocument(content, chunkSize, overlap);
    
    expect(result.length).toBe(3); // 30 words / 10 per chunk = 3 chunks
    expect(result[0].endOffset).toBe(10);
    expect(result[1].startOffset).toBe(10);
    expect(result[1].endOffset).toBe(20);
    expect(result[2].startOffset).toBe(20);
  });

  test("should handle multiple consecutive whitespaces", () => {
    const content = "word1   word2\t\tword3\n\nword4";
    const result = chunkDocument(content, 10, 2);
    
    expect(result).toHaveLength(1);
    // split(/\s+/) should handle multiple whitespaces
    const words = result[0].content.split(/\s+/);
    expect(words.length).toBe(4);
  });

  test("should create correct number of chunks for known input", () => {
    // 25 words with chunk size 10 and overlap 3
    // Chunk 1: words 0-9 (10 words)
    // Chunk 2: words 7-16 (10 words) - starts at 10-3=7
    // Chunk 3: words 14-23 (10 words) - starts at 17-3=14
    // Chunk 4: words 21-24 (4 words) - starts at 24-3=21
    const content = Array(25).fill("word").map((w, i) => `${w}${i}`).join(" ");
    const result = chunkDocument(content, 10, 3);
    
    expect(result.length).toBe(4);
    expect(result[result.length - 1].endOffset).toBe(25);
  });

  test("should maintain chunk coverage without gaps", () => {
    const words = Array(40).fill(null).map((_, i) => `word${i}`);
    const content = words.join(" ");
    const result = chunkDocument(content, 10, 3);
    
    // Verify all words are covered by at least one chunk
    const coveredIndices = new Set<number>();
    result.forEach(chunk => {
      for (let i = chunk.startOffset; i < chunk.endOffset; i++) {
        coveredIndices.add(i);
      }
    });
    
    // All word indices should be covered
    for (let i = 0; i < words.length; i++) {
      expect(coveredIndices.has(i)).toBe(true);
    }
  });
});


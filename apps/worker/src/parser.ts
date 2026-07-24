import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

/**
 * Extract raw text from PDF or DOCX file buffers
 */
export async function extractTextFromFile(buffer: Buffer, originalFileName: string): Promise<string> {
  const extension = originalFileName.split('.').pop()?.toLowerCase();

  try {
    if (extension === 'pdf') {
      const data = await pdfParse(buffer);
      return data.text || '';
    }

    if (extension === 'docx' || extension === 'doc') {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    }

    // Default fallback (e.g., text files)
    return buffer.toString('utf-8');
  } catch (error) {
    console.error(`Failed to extract text from file (${originalFileName}):`, error);
    throw new Error(`Text extraction failed: ${(error as Error).message}`);
  }
}

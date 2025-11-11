// Helper function to parse documents (PDF, Word, etc.) and extract text content
export async function parseDocument(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        
        // For PDFs, try to extract text
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          // Simple PDF text extraction (basic approach)
          const uint8Array = new Uint8Array(arrayBuffer);
          const textDecoder = new TextDecoder('utf-8');
          let text = textDecoder.decode(uint8Array);
          
          // Extract text between stream markers (basic PDF parsing)
          const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
          let extractedText = '';
          let match;
          
          while ((match = streamRegex.exec(text)) !== null) {
            extractedText += match[1] + '\n';
          }
          
          // Also try to get raw text
          const rawText = text.replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s+/g, ' ');
          
          resolve(extractedText || rawText || 'Unable to extract text from PDF. Please ensure the PDF contains readable text.');
        } 
        // For Word documents
        else if (file.type.includes('word') || file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
          // Basic text extraction for Word docs
          const uint8Array = new Uint8Array(arrayBuffer);
          const textDecoder = new TextDecoder('utf-8');
          const text = textDecoder.decode(uint8Array);
          
          // Clean up extracted text
          const cleanedText = text.replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s+/g, ' ');
          
          resolve(cleanedText || 'Unable to extract text from Word document.');
        }
        // For other text-based formats
        else {
          const textDecoder = new TextDecoder('utf-8');
          const text = textDecoder.decode(arrayBuffer);
          resolve(text);
        }
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

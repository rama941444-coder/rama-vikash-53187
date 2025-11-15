import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RequestSchema = z.object({
  code: z.string().max(2000000).optional().default(''),
  language: z.string(),
  files: z.array(z.object({ name: z.string(), type: z.string() })).max(100).optional(),
  fileData: z.array(z.object({
    name: z.string().max(500),
    type: z.string().max(200),
    base64: z.string().max(419430400),
    content: z.string().max(5000000).optional().default(''),
    pageImages: z.array(z.string()).optional().default([]),
    isImage: z.boolean().optional().default(false),
    isPDF: z.boolean().optional().default(false),
    isWord: z.boolean().optional().default(false)
  })).max(100).optional(),
  extractionMode: z.string().optional().default('standard')
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const validation = RequestSchema.safeParse(requestBody);
    if (!validation.success) {
      return new Response(JSON.stringify({ 
        error: 'Invalid input',
        details: validation.error.issues 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { code, language, files, fileData } = validation.data;
    console.log('Analyze request:', { 
      language, 
      hasCode: !!code, 
      fileCount: files?.length || 0, 
      fileDataCount: fileData?.length || 0 
    });

    const GEMINI_API_KEY = Deno.env.get('RAMA') || Deno.env.get('GEMINI_API_KEY');

    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not found');
      return new Response(JSON.stringify({ 
        error: 'AI_NOT_CONFIGURED',
        message: 'Gemini API key is not configured. Please add RAMA secret in Cloud settings.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Using Gemini AI for analysis...');

    // Build prompt content
    const systemPrompt = `You are an ULTRA-ADVANCED AI Code & Document Analyzer.

🎯 CORE CAPABILITIES:
- Multi-language code analysis (Python, Java, C++, JavaScript, HTML, CSS, SQL, etc.)
- Advanced OCR for handwritten code/notes
- Screenshot & image analysis
- PDF/Word document parsing
- Syntax error detection and auto-correction
- Logic flow analysis and optimization
- DSA complexity analysis (Big O notation)
- MCQ generation with detailed explanations

📋 ANALYSIS CONTEXT: ${language}

⚡ PROCESSING RULES:
1. Extract EVERY code snippet from documents
2. Identify ALL errors: syntax, logic, runtime, security
3. Provide REAL execution simulation with actual outputs
4. Generate comprehensive analysis

📊 REQUIRED OUTPUT FORMAT (JSON):

{
  "report": "Comprehensive analysis with detailed error explanations",
  "correctedCode": "Complete corrected code (no placeholders)",
  "output": "Actual execution result with real values",
  "explanation": "Step-by-step execution trace",
  "mcqs": [
    {
      "question": "Question text",
      "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
      "correctAnswer": "A",
      "explanation": "Why this is correct"
    }
  ],
  "flowchart": "Mermaid flowchart code",
  "dsa": {
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "explanation": "Detailed complexity analysis"
  }
}`;

    let userPrompt = code ? `Code to analyze:\n\n${code}` : `Please analyze the following ${language} content:`;

    // Add file contents to prompt
    if (fileData && fileData.length > 0) {
      for (const file of fileData) {
        if (file.content) {
          userPrompt += `\n\n[FILE: ${file.name}]\n${file.content}`;
        } else if (file.pageImages && file.pageImages.length > 0) {
          userPrompt += `\n\n[PDF: ${file.name}] - ${file.pageImages.length} pages`;
        }
      }
    }

    // Build Gemini request with vision support
    const parts: any[] = [{ text: systemPrompt + '\n\n' + userPrompt }];

    // Add images if present
    if (fileData && fileData.length > 0) {
      for (const file of fileData) {
        if (file.isImage && file.base64) {
          const base64Data = file.base64.split(',')[1] || file.base64;
          const mimeType = file.base64.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
          parts.push({
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          });
        }
        
        // Add PDF page images
        if (file.pageImages && file.pageImages.length > 0) {
          for (const pageImg of file.pageImages) {
            const base64Data = pageImg.split(',')[1] || pageImg;
            const mimeType = pageImg.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
            parts.push({
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            });
          }
        }
      }
    }

    console.log('Calling Gemini API...');
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: parts
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192,
          }
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini AI error:', geminiResponse.status, errorText);
      return new Response(JSON.stringify({ 
        error: 'AI_ERROR',
        message: `Gemini AI error: ${errorText}`
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiData = await geminiResponse.json();
    console.log('Gemini analysis completed successfully');
    
    const content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let parsedResponse;

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        parsedResponse = JSON.parse(content);
      }
    } catch (e) {
      console.error('Failed to parse JSON, returning structured fallback');
      parsedResponse = {
        report: content,
        correctedCode: code || '',
        output: 'Unable to execute - see report for details',
        explanation: content,
        mcqs: [],
        flowchart: '',
        dsa: { 
          timeComplexity: 'N/A', 
          spaceComplexity: 'N/A', 
          explanation: 'N/A' 
        }
      };
    }

    parsedResponse.provider = 'gemini';

    return new Response(JSON.stringify(parsedResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ 
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

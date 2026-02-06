import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { callAI, getUserApiKeyFromRequest } from '../_shared/ai-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-api-key',
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
  extractionMode: z.string().optional().default('standard'),
  userApiKey: z.string().optional() // User's own Google AI Studio API key
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

    const { code, language, files, fileData, extractionMode, userApiKey } = validation.data;
    
    // Get user API key from request body or header
    const apiKey = userApiKey || getUserApiKeyFromRequest(req);
    
    console.log('Analyze request:', { 
      language, 
      hasCode: !!code, 
      fileCount: files?.length || 0, 
      fileDataCount: fileData?.length || 0, 
      extractionMode,
      usingUserKey: !!apiKey 
    });
    
    // File validation
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    const ALLOWED_TYPES = [
      'application/pdf',
      'image/',
      'text/',
      'application/vnd.openxmlformats',
      'application/vnd.ms-',
      'application/msword'
    ];
    
    if (fileData && fileData.length > 0) {
      for (const file of fileData) {
        const fileSize = file.base64.length * 0.75;
        
        if (fileSize > MAX_FILE_SIZE) {
          console.error(`File ${file.name} exceeds size limit: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
          return new Response(JSON.stringify({ 
            error: 'File size limit exceeded',
            details: `File "${file.name}" exceeds the 50MB limit.`
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const isAllowedType = ALLOWED_TYPES.some(allowedType => file.type.startsWith(allowedType));
        if (!isAllowedType) {
          console.error(`File ${file.name} has disallowed type: ${file.type}`);
          return new Response(JSON.stringify({ 
            error: 'File type not allowed',
            details: `File "${file.name}" type not supported.`
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Build multimodal content array
    const userContent: any[] = [];
    
    let instructionText = `Language/Context: ${language}\n\n`;
    
    if (code) {
      instructionText += `Code/Text to analyze:\n${code}\n\n`;
    }
    
    instructionText += `⚠️ CRITICAL ANALYSIS REQUIREMENTS:

1) HANDWRITTEN CODE EXTRACTION (MOST IMPORTANT):
   - Use MAXIMUM OCR power to detect ALL handwritten code
   - Extract the EXACT code as written - DO NOT IMAGINE OR CREATE CODE
   - For PDF/Word files: Extract EXACTLY what you see
   
2) MULTIPLE CODE SNIPPETS:
   - Separate each code with: ════════════════════════════════════════
   
3) FILE PROCESSING:
   - PDF/WORD: Extract EVERY code snippet from ALL pages
   - IMAGES: Use advanced OCR for handwritten/typed code
   
4) OUTPUT REQUIREMENTS:
   - CORRECTED CODE: Clean, executable TEXT format
   - EXECUTION OUTPUT: Real calculated results
   - HTML/CSS/JS: COMPLETE code ready for iframe preview

Please analyze with MAXIMUM accuracy and provide complete JSON response.`;

    userContent.push({ type: "text", text: instructionText });
    
    // Add images for multimodal analysis
    if (fileData && fileData.length > 0) {
      for (const file of fileData) {
        if (file.base64) {
          if (file.isImage || file.type.startsWith('image/')) {
            userContent.push({
              type: "image_url",
              image_url: { url: file.base64 }
            });
          } else if (file.isPDF || file.isWord) {
            if (file.pageImages && file.pageImages.length > 0) {
              userContent.push({
                type: "text",
                text: `\n\n[${file.isPDF ? 'PDF' : 'WORD'} DOCUMENT: ${file.name}] - ${file.pageImages.length} pages for OCR:`
              });
              
              for (let i = 0; i < file.pageImages.length; i++) {
                userContent.push({
                  type: "image_url",
                  image_url: { url: file.pageImages[i] }
                });
                userContent.push({
                  type: "text",
                  text: `↑ Page ${i + 1} of ${file.pageImages.length}`
                });
              }
            } else if (file.content) {
              userContent.push({
                type: "text",
                text: `\n\n[DOCUMENT: ${file.name}]\nContent: ${file.content}`
              });
            }
          } else if (file.content) {
            userContent.push({
              type: "text",
              text: `\n\n[FILE: ${file.name}]\n${file.content}`
            });
          }
        }
      }
    }

    const systemPrompt = `You are an ULTRA-ADVANCED AI Code & Document Analyzer. Analyze code, extract from images/PDFs, fix errors, and provide:

📤 MANDATORY JSON OUTPUT:
{
  "analysis": "COMPREHENSIVE analysis of ALL errors",
  "correctedCode": "COMPLETE corrected code in TEXT format",
  "output": "ACTUAL execution result",
  "flowchart": "Flowchart if relevant (empty string if not)",
  "dsa": "DSA Analysis if algorithms present (empty string if not)",
  "ttsNarration": "CLEAR verbal explanation (100-200 words)",
  "mcq": "1-3 MCQs with A/B/C/D options and explanations (empty string if not applicable)"
}

Context: ${language}`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
    ];

    console.log('Calling AI with multimodal content:', { 
      contentItems: userContent.length,
      usingUserKey: !!apiKey 
    });

    const response = await callAI({
      model: 'google/gemini-2.5-pro',
      messages,
      response_format: { type: "json_object" },
      max_tokens: 16384
    }, { userApiKey: apiKey });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({
          error: 'RATE_LIMIT_EXCEEDED',
          analysis: '⚠️ Rate limit exceeded. Please wait a moment and try again.',
          correctedCode: code || '',
          output: '',
          ttsNarration: 'Rate limit exceeded. Please wait.',
          mcq: ''
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402 || response.status === 400) {
        const isUserKey = !!apiKey;
        return new Response(JSON.stringify({
          error: isUserKey ? 'API_KEY_ERROR' : 'PAYMENT_REQUIRED',
          analysis: isUserKey 
            ? '⚠️ Your Google AI Studio API key may be invalid or has reached its limit.\n\nPlease check your API key at https://aistudio.google.com/apikey'
            : '⚠️ AI Analysis requires credits.\n\n📌 Options:\n1. Add your own FREE Google AI Studio API key (click the API Key button)\n2. Add credits to your Lovable workspace',
          correctedCode: code || '',
          output: '',
          ttsNarration: isUserKey ? 'API key error. Please check your key.' : 'Add an API key or credits to enable AI.',
          mcq: ''
        }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({
        error: 'AI_ERROR',
        analysis: `⚠️ AI Error (${response.status}). Please try again.`,
        correctedCode: code || '',
        output: '',
        ttsNarration: 'An error occurred.',
        mcq: ''
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log('AI Response received');

    let analysisResult;
    try {
      analysisResult = JSON.parse(content);
    } catch (e) {
      analysisResult = {
        analysis: content,
        correctedCode: code || '',
        output: 'Analysis completed',
        flowchart: '',
        dsa: '',
        ttsNarration: 'The code has been analyzed.',
        mcq: ''
      };
    }

    return new Response(JSON.stringify(analysisResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Analysis failed. Please try again.',
      analysis: '',
      correctedCode: '',
      output: '',
      ttsNarration: '',
      mcq: ''
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

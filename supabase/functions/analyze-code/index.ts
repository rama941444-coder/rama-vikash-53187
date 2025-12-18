import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RequestSchema = z.object({
  code: z.string().max(2000000).optional().default(''), // Increased to 2MB for large HTML files
  language: z.string(),
  files: z.array(z.object({ name: z.string(), type: z.string() })).max(100).optional(), // Increased to 100 files
  fileData: z.array(z.object({
    name: z.string().max(500),
    type: z.string().max(200),
    base64: z.string().max(419430400), // 400MB limit for very large files
    content: z.string().max(5000000).optional().default(''), // Increased to 5MB for large HTML files
    pageImages: z.array(z.string()).optional().default([]), // PDF/Word pages as images
    isImage: z.boolean().optional().default(false),
    isPDF: z.boolean().optional().default(false),
    isWord: z.boolean().optional().default(false)
  })).max(100).optional(), // Increased to 100 files
  extractionMode: z.string().optional().default('standard')
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate input
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

    const { code, language, files, fileData, extractionMode } = validation.data;
    console.log('Analyze request:', { language, hasCode: !!code, fileCount: files?.length || 0, fileDataCount: fileData?.length || 0, extractionMode });
    
    // Additional security validation for file uploads
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file
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
        // Calculate approximate size from base64
        const fileSize = file.base64.length * 0.75; // Base64 is ~33% larger than binary
        
        if (fileSize > MAX_FILE_SIZE) {
          console.error(`File ${file.name} exceeds size limit: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
          return new Response(JSON.stringify({ 
            error: 'File size limit exceeded',
            details: `File "${file.name}" exceeds the 50MB limit. Please upload smaller files.`
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Validate file type
        const isAllowedType = ALLOWED_TYPES.some(allowedType => file.type.startsWith(allowedType));
        if (!isAllowedType) {
          console.error(`File ${file.name} has disallowed type: ${file.type}`);
          return new Response(JSON.stringify({ 
            error: 'File type not allowed',
            details: `File "${file.name}" has type "${file.type}" which is not allowed. Supported types: PDF, images, text files, Word/Excel documents.`
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      console.log(`File validation passed for ${fileData.length} file(s)`);
    }
    
    // Use Lovable AI Gateway (always available and working)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }
    
    // Always use Lovable AI Gateway for reliability
    const useGeminiDirect = false;
    const apiKey = LOVABLE_API_KEY;
    
    console.log('Using API: Lovable AI Gateway');

    // Build multimodal content array
    const userContent: any[] = [];
    
    // Build instruction text
    let instructionText = `Language/Context: ${language}\n\n`;
    
    if (code) {
      instructionText += `Code/Text to analyze:\n${code}\n\n`;
    }
    
    instructionText += `⚠️ CRITICAL ANALYSIS REQUIREMENTS - READ CAREFULLY:

1) HANDWRITTEN CODE EXTRACTION (MOST IMPORTANT):
   - Use MAXIMUM OCR power to detect ALL handwritten code (neat AND messy handwriting)
   - Extract the EXACT code as written in the document - DO NOT IMAGINE OR CREATE CODE
   - If handwriting has strikeouts/corrections, note them but provide the final intended code
   - For PDF/Word files with handwritten code: Extract EXACTLY what you see, character by character
   
2) MULTIPLE CODE SNIPPETS HANDLING:
   - If document contains multiple separate codes, extract ALL of them
   - Separate each code with this EXACT separator line: 
     ════════════════════════════════════════
     Code Snippet [Number]
     ════════════════════════════════════════
   - Example format:
     [Code 1]
     ════════════════════════════════════════
     Code Snippet 2
     ════════════════════════════════════════
     [Code 2]
   - Use same separators in BOTH "correctedCode" AND "output" sections

3) FILE PROCESSING:
   - PDF/WORD FILES: Extract EVERY code snippet from ALL pages
   - IMAGES: Use advanced OCR for handwritten/typed code from photos/screenshots
   - MULTIPLE FILES: Analyze ALL files comprehensively
   - LARGE FILES: Process ENTIRE content with NO truncation

4) CODE ACCURACY:
   - Provide EXACT code from the file - NOT your imagination
   - Fix only actual syntax/logic errors
   - Keep variable names, structure, comments as in original
   - If unsure about a character, provide best OCR interpretation with note

5) OUTPUT REQUIREMENTS:
   - CORRECTED CODE: Clean, executable version in TEXT format (NEVER binary)
   - EXECUTION OUTPUT: Real calculated results, not placeholders
   - For multiple codes: Separate outputs with same separator format
   - HTML/CSS/JS: Provide COMPLETE code ready for iframe preview

6) ADDITIONAL ANALYSIS:
   - FLOWCHARTS: Generate for logic-heavy problems
   - DSA ANALYSIS: Provide complexity analysis for algorithms
   - MCQ FORMAT: Properly numbered with A/B/C/D options and explanations

Please analyze with MAXIMUM accuracy and provide complete JSON response.`;

    // Add text instruction
    userContent.push({
      type: "text",
      text: instructionText
    });
    
    // Add ALL images first for multimodal analysis
    if (fileData && fileData.length > 0) {
      for (const file of fileData) {
        if (file.base64) {
          if (file.isImage || file.type.startsWith('image/')) {
            // Direct image upload
            userContent.push({
              type: "image_url",
              image_url: {
                url: file.base64
              }
            });
          } else if (file.isPDF || file.isWord) {
            // PDF/Word: Use pageImages for EXACT OCR
            if (file.pageImages && file.pageImages.length > 0) {
              console.log(`Processing ${file.name} with ${file.pageImages.length} page images for OCR`);
              userContent.push({
                type: "text",
                text: `\n\n[${file.isPDF ? 'PDF' : 'WORD'} DOCUMENT: ${file.name}]
📄 Total Pages: ${file.pageImages.length}

⚠️ CRITICAL OCR EXTRACTION MODE:
- Each page has been converted to an image for pixel-perfect OCR
- Extract EXACT code as written (handwritten or typed)
- DO NOT imagine or create code - only extract what you see
- For handwritten code: Read EVERY character carefully (messy handwriting included)
- Multiple snippets: Separate with separator lines
- Process ALL ${file.pageImages.length} pages completely

Below are the page images for OCR analysis:`
              });
              
              // Add each page image for vision analysis
              for (let i = 0; i < file.pageImages.length; i++) {
                userContent.push({
                  type: "image_url",
                  image_url: {
                    url: file.pageImages[i]
                  }
                });
                userContent.push({
                  type: "text",
                  text: `↑ Page ${i + 1} of ${file.pageImages.length}`
                });
              }
            } else {
              // Fallback if no page images
              userContent.push({
                type: "text",
                text: `\n\n[DOCUMENT: ${file.name}]\nContent: ${file.content || 'Unable to extract text'}`
              });
            }
          } else if (file.content) {
            // Text-based files
            userContent.push({
              type: "text",
              text: `\n\n[FILE: ${file.name}]\n${file.content}`
            });
          }
        }
      }
    }
    
    if (userContent.length === 1) {
      userContent.push({
        type: "text",
        text: `Context: ${language}. Files: ${files?.map((f: any) => f.name).join(', ') || 'None'}`
      });
    }

    const messages = [
      {
        role: "system",
        content: `You are an ULTRA-ADVANCED AI Code & Document Analyzer with MAXIMUM capabilities:

🎯 ENHANCED CORE CAPABILITIES:
- Multi-language code analysis (Python, Java, C++, C, JavaScript, HTML, CSS, SQL [DDL/DML/DCL/TCL/Triggers/Joins], PL/SQL, T-SQL, DBMS, MongoDB, R, Swift, Kotlin, PHP, DSA, etc.)
- ULTRA-ADVANCED OCR for handwritten code/notes (NEAT & MESSY handwriting, detect ALL corrections)
- Screenshot & image analysis - extract code from ANY visual source with MAXIMUM accuracy
- PDF/Word document parsing - extract EVERY code snippet (process LARGE files, handle multiple snippets per document)
- LARGE HTML FILE PROCESSING - Handle massive HTML files (up to 5MB) with embedded CSS and JavaScript
- Image-based graph problem solving (e.g., Traveling Salesman Problem from diagrams) - generate COMPLETE working code
- Flowchart and diagram interpretation - convert visual logic to executable code
- Handwritten text detection with strikeout/correction recognition (detect human errors and corrections)
- HTML/CSS/JavaScript combination analysis - provide COMPLETE integrated code ready for iframe preview
- Syntax error detection and auto-correction
- Logic flow analysis and optimization
- Flowchart generation from code logic
- DSA complexity analysis (Big O notation)
- Text document proofreading and grammar correction
- MCQ generation with detailed explanations

📋 ANALYSIS CONTEXT: ${language}

⚡ CRITICAL PROCESSING RULES:

1. **MAXIMUM EXTRACTION POWER**
   - PDFs/Word: Extract EVERY code snippet, process sequentially
   - Images: Use ADVANCED OCR for handwritten, typed, screenshots
   - Handwriting: Recognize neat & messy writing, detect strikeouts/corrections
   - Diagrams/Graphs: Interpret visual problems (TSP, flowcharts, graphs) and generate working code
   - Large HTML files: Process ENTIRE content with embedded CSS/JavaScript (up to 5MB)
   - HTML/CSS/JS Combinations: Provide COMPLETE code with ALL styles and scripts integrated
   - Multiple files: Analyze ALL files comprehensively
   - Large files: Process ENTIRE content with NO truncation

2. **DEEP INTELLIGENT ANALYSIS**
   - Identify ALL errors: syntax, logic, runtime, security
   - Security vulnerabilities: SQL injection, XSS, buffer overflow
   - Algorithm efficiency: Time/space complexity (Big O)
   - Code quality: Anti-patterns, best practices
   - Error handling verification
   - HTML/CSS/JS validation: Ensure complete and working preview-ready code

3. **REAL EXECUTION SIMULATION**
   - Trace execution line-by-line with ACTUAL logic
   - Calculate REAL outputs (never use placeholders)
   - Consider edge cases and exceptions
   - For HTML: Describe visual rendering AND ensure code is iframe-ready
   - For SQL: Explain query results with sample data
   - For algorithms: Show step-by-step execution

4. **INTELLIGENT CORRECTION & OPTIMIZATION**
   - Fix ALL errors while maintaining logic intent
   - Optimize inefficient algorithms
   - Add error handling where missing
   - Provide clean TEXT format code (NEVER binary gibberish)
   - For HTML/CSS/JS: Provide COMPLETE code with ALL styles and scripts properly integrated
   - Add explanatory comments for complex sections
   - For graph problems: Provide complete working implementations
   - Ensure HTML code is 100% ready for iframe preview

5. **ADVANCED TEXT PROCESSING**
   - Grammar/spelling correction
   - Strikeout/correction detection in handwriting
   - Clean, corrected output in TEXT format
   - Detailed change explanations

6. **MCQ GENERATION FORMAT**
   - Generate 1-3 MCQs in PROPER format with DETAILED EXPLANATIONS:
   
   1. [Question text here]
   A) [Option A]
   B) [Option B]
   C) [Option C]
   D) [Option D]
   Answer: [Correct option]
   Explanation: [Detailed explanation of why this is the correct answer and why other options are incorrect]
   
   2. [Question text here]
   A) [Option A]
   B) [Option B]
   C) [Option C]
   D) [Option D]
   Answer: [Correct option]
   Explanation: [Detailed explanation of why this is the correct answer and why other options are incorrect]

📤 MANDATORY JSON OUTPUT:
{
  "analysis": "COMPREHENSIVE analysis:\n- ALL errors (syntax, logic, security, runtime)\n- Performance bottlenecks\n- Code quality assessment\n- Line-by-line issue breakdown\n- For PDFs: Analysis for EACH code snippet\n- For images: OCR-extracted code + full analysis\n- For handwriting: Detected text + corrections\n- For graphs/diagrams: Problem interpretation + solution approach\n- For HTML: Complete structure, CSS, and JavaScript validation",
  
  "correctedCode": "COMPLETE corrected code in TEXT format:\n- Extract EXACT code from handwritten/typed content - DO NOT IMAGINE\n- ALL syntax errors fixed\n- Logic errors resolved\n- Security patches applied\n- Optimizations implemented\n- Clear comments added\n- For HTML/CSS/JS: COMPLETE code with ALL styles and scripts integrated (100% iframe-ready)\n- For large HTML files: Full HTML structure with embedded CSS and JavaScript\n- For multiple code snippets: Use this EXACT separator format:\n  \n  [First corrected code here]\n  \n  ════════════════════════════════════════\n  Code Snippet 2\n  ════════════════════════════════════════\n  \n  [Second corrected code here]\n  \n  ════════════════════════════════════════\n  Code Snippet 3\n  ════════════════════════════════════════\n  \n  [Third corrected code here]\n  \n- For handwriting: Extract EXACT code as written, then provide clean corrected version\n- For images: Extracted code from OCR in TEXT (exact as visible)\n- For graph problems: Complete working implementation\n- NEVER output binary or gibberish - ALWAYS readable text\n- Remember: Extract exactly what you see, not what you think should be there",
  
  "output": "ACTUAL execution result:\n- REAL program output (calculated from logic)\n- Console logs\n- Return values\n- For multiple code snippets: Provide output for EACH snippet using SAME separator format:\n  \n  [Output for Code 1]\n  \n  ════════════════════════════════════════\n  Output for Code Snippet 2\n  ════════════════════════════════════════\n  \n  [Output for Code 2]\n  \n- For text documents: Summary of corrections\n- For HTML: Detailed rendering description\n- For algorithms: Step-by-step execution trace",

  "flowchart": "Flowchart/logic diagram (if relevant):\n- ASCII art flowchart\n- Logic flow visualization\n- Algorithm step breakdown\n- Control flow diagram\n(empty string if not applicable)",

  "dsa": "DSA Analysis (if algorithms present):\n- Time complexity: O(n), O(n²), O(log n), etc.\n- Space complexity analysis\n- Data structures identified\n- Algorithm efficiency evaluation\n- Optimization recommendations\n(empty string if not applicable)",
  
  "ttsNarration": "CLEAR verbal explanation (100-200 words):\n- What the code/document does\n- Key errors found and how they were fixed\n- Important concepts explained simply\n- Learning takeaways for the user",
  
  "mcq": "PROPERLY FORMATTED MCQs (1-3 questions) WITH EXPLANATIONS:\n\n1. [Question text]\nA) [Option A]\nB) [Option B]\nC) [Option C]\nD) [Option D]\nAnswer: [Correct option]\nExplanation: [Detailed explanation of why this is correct and why other options are wrong]\n\n2. [Question text]\nA) [Option A]\nB) [Option B]\nC) [Option C]\nD) [Option D]\nAnswer: [Correct option]\nExplanation: [Detailed explanation of why this is correct and why other options are wrong]\n\n(or empty string if not applicable)"
}

⚠️ ABSOLUTE QUALITY REQUIREMENTS:
✓ Process ALL content - zero truncation
✓ Real execution outputs - no placeholders
✓ Specific error line citations
✓ Corrected code is syntactically perfect
✓ TEXT format only - never binary output
✓ Clear educational explanations
✓ Accurate OCR from images
✓ Multiple snippets processed separately
✓ Handwriting recognized accurately
✓ Graph problems solved with working code
✓ MCQs properly numbered with A/B/C/D options
✓ HTML/CSS/JS code is COMPLETE and iframe-ready
✓ Large HTML files processed with ALL embedded CSS/JS

🚀 USE MAXIMUM AI POWER - Deploy Gemini 2.5 Pro's full vision, OCR, reasoning, and multimodal capabilities for PERFECT analysis!`
      },
      {
        role: "user",
        content: userContent
      }
    ];

    console.log('Calling AI with multimodal content:', { 
      language, 
      hasCode: !!code, 
      fileCount: files?.length || 0,
      fileDataCount: fileData?.length || 0,
      contentItems: userContent.length,
      totalPageImages: fileData?.reduce((sum, f) => sum + (f.pageImages?.length || 0), 0) || 0,
      apiType: useGeminiDirect ? 'Gemini Direct' : 'Lovable AI'
    });

    let response;
    
    if (useGeminiDirect) {
      // Use Google Gemini API directly with user's key
      response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-06-05:generateContent?key=' + apiKey, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: messages[0].content }, // System prompt
                ...userContent.map((item: any) => {
                  if (item.type === "text") {
                    return { text: item.text };
                  } else if (item.type === "image_url") {
                    // Extract base64 data from data URL
                    const base64Match = item.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
                    if (base64Match) {
                      return {
                        inlineData: {
                          mimeType: base64Match[1],
                          data: base64Match[2]
                        }
                      };
                    }
                    return { text: "[Image could not be processed]" };
                  }
                  return { text: "" };
                })
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 16384,
            responseMimeType: "application/json"
          }
        }),
      });
    } else {
      // Use Lovable AI Gateway
      response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-pro',
          messages,
          response_format: { type: "json_object" },
          max_tokens: 16384
        }),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      // Handle specific error codes
      if (response.status === 429) {
        return new Response(JSON.stringify({
          error: 'RATE_LIMIT_EXCEEDED',
          analysis: '⚠️ Rate limit exceeded. You are sending too many requests.\n\n📌 Please wait a moment and try again.\n\nIf this persists, contact support@lovable.dev to increase your rate limit.',
          correctedCode: code || '// Rate limit exceeded',
          output: '💡 Tip: Space out your requests to avoid rate limiting.',
          ttsNarration: 'Rate limit exceeded. Please wait a moment before trying again.',
          mcq: ''
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({
          error: 'PAYMENT_REQUIRED',
          analysis: '⚠️ AI Analysis requires credits. Your Lovable workspace needs more AI credits to analyze code.\n\n📌 How to add credits:\n1. Go to Settings → Workspace → Usage\n2. Add credits to your workspace\n3. You get free monthly AI usage included!\n\nOnce credits are added, all AI features will work automatically across ALL slides.',
          correctedCode: code || '// Add credits to enable AI analysis',
          output: '💡 Tip: Lovable AI is already configured - just add credits to your workspace to start analyzing code!',
          ttsNarration: 'AI analysis requires workspace credits. Add credits in Settings to enable AI features.',
          mcq: ''
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Generic error for other cases
      return new Response(JSON.stringify({
        error: 'AI_GATEWAY_ERROR',
        analysis: `⚠️ AI Gateway Error (${response.status})\n\n${errorText}\n\nPlease try again or contact support if the issue persists.`,
        correctedCode: code || '// Error occurred',
        output: 'An error occurred during analysis.',
        ttsNarration: 'An error occurred. Please try again.',
        mcq: ''
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    
    // Handle different response formats
    let content;
    if (useGeminiDirect) {
      // Google Gemini API response format
      content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      // OpenAI-compatible format (Lovable AI)
      content = data.choices?.[0]?.message?.content || '';
    }
    
    console.log('AI Response received');

    // Parse the JSON response
    let analysisResult;
    try {
      analysisResult = JSON.parse(content);
    } catch (e) {
      // If not valid JSON, create a structured response
      analysisResult = {
        analysis: content,
        correctedCode: "// Analysis completed\n" + (code || "// No code provided"),
        output: "Analysis completed successfully",
        flowchart: "",
        dsa: "",
        ttsNarration: "The code has been analyzed. Check the results above.",
        mcq: "No questions generated"
      };
    }

    return new Response(JSON.stringify(analysisResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Detailed error for debugging:', error);
    return new Response(JSON.stringify({ 
      error: 'An error occurred during analysis. Please try again.',
      analysis: 'Analysis could not be completed',
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

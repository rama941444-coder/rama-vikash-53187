import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, language, mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!imageBase64) {
      throw new Error("No image provided");
    }

    // Different prompts based on mode
    let prompt: string;
    
    if (mode === 'generate_code_for_image') {
      // Mode for generating code that would recreate the image (trees, plants, etc.)
      prompt = `You are an expert programmer. Analyze this image and generate code that would create/draw/render a similar visual representation.

The user wants ${language !== 'Auto-Detect' ? language : 'the most appropriate programming language'} code.

If the image shows:
- A tree/plant: Generate code to draw it using graphics libraries (Canvas, SVG, turtle graphics, etc.)
- A landscape: Generate code to create the scene
- A UI/website: Generate HTML/CSS/JavaScript
- A chart/graph: Generate code using charting libraries
- Any other visual: Generate appropriate drawing/rendering code

Return ONLY the code that would recreate or approximate this visual. No explanations, just the complete working code.`;
    } else {
      // Default mode: extract code from image (OCR)
      prompt = `You are a highly accurate code extraction AI. Extract the EXACT code from this image.

CRITICAL RULES:
1. Extract ONLY the code visible in the image - do NOT imagine or add any code
2. Preserve exact formatting, indentation, and whitespace
3. If the code is handwritten, transcribe it exactly as written
4. If parts are unclear, indicate with [unclear] marker
5. Do NOT correct any errors - extract exactly what is shown
6. Do NOT add any explanations, just the raw code

${language && language !== 'Auto-Detect' ? `The code is written in ${language}.` : 'Detect the programming language automatically.'}

Return ONLY the extracted code, nothing else.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Please wait a moment." 
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: "PAYMENT_REQUIRED",
          message: "Add credits to enable AI features." 
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const extractedCode = data.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({ 
      code: extractedCode,
      success: true 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-code-from-image error:", e);
    return new Response(JSON.stringify({ 
      error: e instanceof Error ? e.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

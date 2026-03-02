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
      // Mode for generating code that would recreate the image EXACTLY
      prompt = `You are an EXPERT programmer specializing in creating PIXEL-PERFECT visual reproductions using code.

CRITICAL MISSION: Generate code that when executed/rendered produces the EXACT SAME visual as this image.

Language: ${language !== 'Auto-Detect' ? language : 'HTML/CSS/JavaScript (default for visual output)'}

RULES FOR EXACT REPRODUCTION:
1. Analyze EVERY detail: colors (exact hex/rgb values), shapes, positions, sizes, proportions, gradients, shadows
2. For trees/plants: Use Canvas API or SVG to draw EXACT branch patterns, leaf shapes, trunk width, colors
3. For landscapes: Recreate exact sky gradients, ground colors, object placements
4. For objects: Match exact dimensions, colors, curves, angles
5. For UI/websites: Replicate exact layout, fonts, colors, spacing
6. For charts/graphs: Use exact data points, colors, labels
7. For photos of real objects: Create the closest possible artistic rendering using Canvas/SVG

PREFERRED APPROACH:
- Use HTML + Canvas API for complex drawings (trees, plants, landscapes, objects)
- Use HTML + CSS for UI/layout type images
- Use SVG for geometric shapes and diagrams
- The output MUST be a COMPLETE standalone HTML file that can render in a browser
- Include ALL colors as exact hex values matched from the image
- Include proper proportions and positioning

OUTPUT FORMAT: Return ONLY the complete working code. No explanations. The code must produce the EXACT same visual when run.`;
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

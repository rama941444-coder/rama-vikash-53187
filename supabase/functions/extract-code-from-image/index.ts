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

    let prompt: string;
    
    if (mode === 'generate_code_for_image') {
      prompt = `You are the WORLD'S BEST programmer specializing in creating PIXEL-PERFECT, EXACT visual reproductions using code.

ABSOLUTE MISSION: Generate code that when rendered/executed produces the EXACT SAME visual as this image. NOT approximately - EXACTLY the same.

Language: ${language !== 'Auto-Detect' ? language : 'HTML/CSS/JavaScript (default for visual output)'}

CRITICAL RULES FOR 100% EXACT REPRODUCTION:
1. COLORS: Extract EVERY single color as EXACT hex values (#RRGGBB). Use a color picker mentally - get the PRECISE shade. Not "green" but the EXACT hex.
2. SHAPES: Measure exact proportions. If a trunk is 1/5th the width of the canopy, code it exactly that way.
3. POSITIONS: Every element must be placed at its EXACT position relative to the canvas.
4. GRADIENTS: If there's a gradient from color A to color B, use the EXACT start and end colors.
5. CURVES: Use bezier curves to match EXACT curve shapes - branches, petals, clouds, etc.
6. SHADOWS: Reproduce exact shadow colors, blur, and positions.
7. TEXTURES: Use patterns/noise to match any textures visible.
8. PROPORTIONS: The aspect ratio and relative sizing of ALL elements must be EXACT.

APPROACH BY IMAGE TYPE:
- TREES/PLANTS: Use Canvas API. Draw EXACT trunk shape (width, taper, color), EXACT branch patterns (angles, lengths, thickness), EXACT leaf/canopy shape and colors. Include bark texture, leaf details.
- LANDSCAPES: Use Canvas. Layer sky gradient, ground, horizon line at EXACT position. Place objects at EXACT coordinates.
- OBJECTS/SHAPES: Use SVG or Canvas. Match EXACT dimensions, curves, colors.
- UI/WEBSITES: Use HTML+CSS. Match EXACT layout, fonts (use closest Google Font), colors, spacing in pixels.
- CHARTS/GRAPHS: Use Canvas/SVG. EXACT data points, labels, colors, grid lines.
- PHOTOS: Create the CLOSEST artistic rendering using Canvas gradients and shapes.

OUTPUT: Return ONLY the complete standalone HTML file. No explanations. No markdown. The code MUST produce the EXACT same visual when opened in a browser.

IMPORTANT: Include <html><head><style>body{margin:0;overflow:hidden;}</style></head><body><canvas id="c"></canvas><script>...</script></body></html> structure for Canvas-based output. Set canvas size to fill viewport.`;
    } else {
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
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageBase64 } }
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
    let extractedCode = data.choices?.[0]?.message?.content || '';
    
    // Clean markdown code blocks if present
    if (extractedCode.startsWith('```')) {
      extractedCode = extractedCode.replace(/^```\w*\n/, '').replace(/\n```$/, '');
    }

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

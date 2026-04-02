import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a world-class frontend engineer and pixel-perfect visual reproduction specialist.

# ABSOLUTE RULE: 100% EXACT VISUAL REPRODUCTION
Your ONLY job is to produce code that renders IDENTICALLY to the source image. Every pixel matters.

# Tone and style
- Return ONLY the complete HTML code. No explanations, no commentary.

# Stack
- Tailwind: <script src="https://cdn.tailwindcss.com"></script>
- Google Fonts for typography matching
- Font Awesome: <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css"></link>
- Output a single self-contained HTML file

# CRITICAL ACCURACY RULES
1. Extract EVERY color as EXACT hex (#RRGGBB) - use an eyedropper mentality
2. Measure exact proportions, padding, margins, border-radius in px
3. Match fonts: weight, size, letter-spacing, line-height exactly
4. For organic shapes (trees, plants, landscapes, objects): Use HTML5 Canvas with bezier curves, exact coordinates, exact gradients
5. For UI/web screenshots: Replicate every element, shadow, border, gradient precisely
6. For charts/graphs: Match every data point, axis label, color, line thickness
7. Canvas dimensions MUST match the aspect ratio of the original image
8. Use gradients with exact color stops - never approximate
9. Every shape must be at its EXACT position - measure coordinates carefully
10. Text must use the exact same font family, weight, and size
`;

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

    let systemPrompt: string;
    let userPrompt: string;
    
    if (mode === 'generate_code_for_image') {
      // Use the screenshot-to-code approach: detailed system prompt + image replication instructions
      systemPrompt = SYSTEM_PROMPT;

      userPrompt = `Generate code for a web page that EXACTLY reproduces the provided image with 100% pixel-perfect accuracy.

Stack: HTML + Tailwind CSS + Canvas/SVG as needed.

## STEP-BY-STEP ANALYSIS (do this internally before coding):
1. Identify every visual element in the image (shapes, text, colors, gradients, shadows)
2. Extract EXACT hex color values for every color visible (#RRGGBB format)
3. Measure proportions: width/height ratios, spacing between elements, margins
4. Identify fonts, sizes, weights, and text content exactly
5. Note every gradient with exact start/end colors and direction
6. Map every element to exact x,y coordinates relative to the canvas/viewport

## REPRODUCTION RULES:
- Extract text EXACTLY as shown - no paraphrasing, no changing
- Colors must be EXACT hex values - never approximate (#FF6B35 not "orange")
- For photos/complex images in UI: use placeholder with EXACT dimensions and matching solid color
- For organic shapes (trees, flowers, landscapes, animals): Use Canvas with bezierCurveTo for smooth curves
- For geometric shapes: Use exact coordinates, dimensions, border-radius
- For gradients: Use exact color stops with precise positions (e.g., 0%, 25%, 50%, 100%)
- Shadows: Match exact blur, spread, color, and offset
- Border-radius: Match exact values (not just "rounded")

## CANVAS RULES (for non-UI/artistic images):
- Set canvas size to match image aspect ratio (e.g., 800x600 for landscape)
- Draw EVERY element - don't skip small details
- Use quadraticCurveTo/bezierCurveTo for all curved shapes
- Layer elements back-to-front (background first, foreground last)
- Use createLinearGradient/createRadialGradient with exact color stops
- For complex scenes: break into layers and draw each layer completely

## OUTPUT:
Return ONLY the complete <!DOCTYPE html> file. No markdown. No explanation.
The rendered output MUST be visually IDENTICAL to the source image.`;
    } else {
      // Code extraction mode - unchanged logic
      systemPrompt = "You are a highly accurate code extraction AI.";
      userPrompt = `Extract the EXACT code from this image.

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

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          { type: "image_url", image_url: { url: imageBase64, detail: "high" } }
        ]
      }
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages,
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
    extractedCode = extractedCode.replace(/^```(?:html|css|javascript|js|svg|canvas)?\n?/i, '').replace(/\n?```$/i, '');
    // Also handle triple backtick anywhere
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

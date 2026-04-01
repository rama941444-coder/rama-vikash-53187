import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a coding agent that's an expert at building front-ends.

# Tone and style
- Be extremely concise in your chat responses.
- At the end of the task, respond with the code only.

# Stack-specific instructions

## Tailwind
- Use this script to include Tailwind: <script src="https://cdn.tailwindcss.com"></script>

## General instructions
- You can use Google Fonts or other publicly accessible fonts.
- Font Awesome for icons: <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css"></link>
- Output a single self-contained HTML file that works standalone in a browser.
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

      userPrompt = `Generate code for a web page that looks exactly like the provided screenshot/image.

Selected stack: HTML + Tailwind CSS.

## Replication instructions

- Make sure the app looks EXACTLY like the image - pixel perfect reproduction.
- Use the exact text from the image if any text is visible.
- For any images or icons in the screenshot, use placeholder URLs (https://placehold.co) with the correct dimensions and colors.
- Match exact colors (extract precise hex values), spacing, fonts, sizes, layouts.
- For trees, plants, landscapes, objects: Use HTML5 Canvas or SVG to create an EXACT visual reproduction.
- For UI mockups: Use HTML+CSS+Tailwind to replicate the exact layout.

## Canvas/SVG specific rules for non-UI images:
- Extract EVERY color as EXACT hex values (#RRGGBB)
- Measure exact proportions between elements
- Place elements at their EXACT positions
- Use bezier curves for organic shapes (branches, petals, curves)
- Match gradients precisely with exact start/end colors
- Set canvas to fill the viewport: canvas.width = window.innerWidth; canvas.height = window.innerHeight;

## Output format
Return ONLY the complete standalone HTML file. No explanations. No markdown code blocks.
The code MUST produce the EXACT same visual when opened in a browser.
Include proper <!DOCTYPE html> structure.`;
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

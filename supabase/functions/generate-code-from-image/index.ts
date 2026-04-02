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
    const { code, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!code) {
      throw new Error("No code provided");
    }

    const prompt = `You are a perfect code execution visualizer. Generate an image showing the EXACT visual output of this code.

ABSOLUTE RULES:
1. Show ONLY what the code RENDERS when executed - NEVER show the code text itself
2. Match every color EXACTLY as specified in the code (hex values, rgb, named colors)
3. Match every shape, size, position, font exactly as the code defines
4. Match gradients, shadows, borders, border-radius exactly

CODE TYPE HANDLING:
- HTML/CSS/JS → Show the rendered webpage: exact layout, colors, typography, spacing, shadows
- Canvas drawing → Show exact canvas output: every shape, curve, gradient at exact positions
- SVG → Show rendered SVG with exact colors, paths, transforms
- Console/terminal → Dark terminal window with exact output text in monospace font
- Chart/graph → Exact chart with all data points, labels, colors, axes

The code (${language || 'auto-detect'}):
\`\`\`
${code.substring(0, 10000)}
\`\`\`

Generate a PIXEL-PERFECT, HIGH-FIDELITY image of the EXACT visual output. Every detail must match what a browser/runtime would produce.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          { role: "user", content: prompt }
        ],
        modalities: ["image", "text"]
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
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url || '';

    return new Response(JSON.stringify({ 
      imageUrl,
      success: !!imageUrl 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-code-from-image error:", e);
    return new Response(JSON.stringify({ 
      error: e instanceof Error ? e.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI, getUserApiKeyFromRequest } from '../_shared/ai-client.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-user-api-key",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, language, userApiKey } = await req.json();
    const apiKey = userApiKey || getUserApiKeyFromRequest(req);

    if (!code) {
      throw new Error("No code provided");
    }

    console.log('Generate code image request, usingUserKey:', !!apiKey);

    const prompt = `Generate a visual representation/image of this code being displayed in a beautiful code editor with syntax highlighting.

The code:
\`\`\`${language || 'auto'}
${code}
\`\`\`

Create a beautiful, professional-looking code editor screenshot with:
1. Dark theme background (like VS Code dark theme)
2. Proper syntax highlighting for the language
3. Line numbers on the left
4. A modern, clean look
5. The file name shown in a tab at the top`;

    // Note: Image generation requires specific models - using text description for now
    const response = await callAI({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    }, { userApiKey: apiKey });

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
          message: "Add your free API key or credits to enable AI features." 
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI error:", response.status, errorText);
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    // For text-based response, return the description
    const description = data.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({ 
      description,
      success: true 
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

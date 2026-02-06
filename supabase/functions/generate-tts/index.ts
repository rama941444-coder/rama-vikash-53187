import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { callAI, getUserApiKeyFromRequest } from '../_shared/ai-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-api-key',
};

const RequestSchema = z.object({
  text: z.string().min(1).max(5000),
  userApiKey: z.string().optional()
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

    const { text, userApiKey } = validation.data;
    const apiKey = userApiKey || getUserApiKeyFromRequest(req);

    console.log('Generating TTS, text length:', text.length, 'usingUserKey:', !!apiKey);

    const response = await callAI({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that explains technical content clearly and concisely."
        },
        {
          role: "user",
          content: `Please narrate this text in a clear, professional voice suitable for technical explanation: ${text.substring(0, 1000)}`
        }
      ]
    }, { userApiKey: apiKey });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const narrationText = data.choices[0].message.content;
    
    console.log('TTS generated successfully');

    return new Response(JSON.stringify({ narrationText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('TTS error:', error);
    return new Response(JSON.stringify({ 
      error: 'TTS generation failed. Please try again.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RequestSchema = z.object({
  text: z.string().min(1).max(5000)
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

    const { text } = validation.data;
    
    // Try user's Gemini API key first, fallback to Lovable AI
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const useGeminiDirect = !!GEMINI_API_KEY;
    const apiKey = GEMINI_API_KEY || LOVABLE_API_KEY;

    if (!apiKey) {
      throw new Error('No API key configured');
    }

    console.log('Generating TTS for text length:', text.length, 'using:', useGeminiDirect ? 'Gemini Direct' : 'Lovable AI');

    let response;
    
    if (useGeminiDirect) {
      response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `You are a helpful assistant that explains technical content clearly and concisely. Please narrate this text in a clear, professional voice suitable for technical explanation: ${text.substring(0, 1000)}` }]
          }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
        }),
      });
    } else {
      response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: "system", content: "You are a helpful assistant that explains technical content clearly and concisely." },
            { role: "user", content: `Please narrate this text in a clear, professional voice suitable for technical explanation: ${text.substring(0, 1000)}` }
          ]
        }),
      });
    }

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const narrationText = useGeminiDirect 
      ? data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      : data.choices?.[0]?.message?.content || '';
    
    console.log('TTS generated successfully');

    return new Response(JSON.stringify({ narrationText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Detailed error for debugging:', error);
    return new Response(JSON.stringify({ 
      error: 'An error occurred during TTS generation. Please try again.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

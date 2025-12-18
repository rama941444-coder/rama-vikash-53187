import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RequestSchema = z.object({
  text: z.string().min(1).max(10000),
  targetLanguage: z.enum(['English', 'Telugu', 'Hindi', 'Tamil', 'Kannada', 'Malayalam', 'Bengali'])
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

    const { text, targetLanguage } = validation.data;
    
    // Try user's Gemini API key first, fallback to Lovable AI
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const useGeminiDirect = !!GEMINI_API_KEY;
    const apiKey = GEMINI_API_KEY || LOVABLE_API_KEY;

    if (!apiKey) {
      throw new Error('No API key configured');
    }

    // If already English, return as-is
    if (targetLanguage === 'English') {
      return new Response(JSON.stringify({ translatedText: text }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Translating to ${targetLanguage}, text length: ${text.length}, using: ${useGeminiDirect ? 'Gemini Direct' : 'Lovable AI'}`);

    let response;
    const systemPrompt = `You are a professional translator. Translate the given technical explanation into ${targetLanguage}. Keep technical terms in English when appropriate but explain them in ${targetLanguage}. Maintain the same structure and formatting. Only output the translation, nothing else.`;
    
    if (useGeminiDirect) {
      response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${systemPrompt}\n\nText to translate:\n${text}` }]
          }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 8192 }
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
            { role: "system", content: systemPrompt },
            { role: "user", content: text }
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
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required. Please add credits.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const translatedText = useGeminiDirect 
      ? data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      : data.choices?.[0]?.message?.content || '';
    
    console.log('Translation completed successfully');

    return new Response(JSON.stringify({ translatedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Translation error:', error);
    return new Response(JSON.stringify({ 
      error: 'Translation failed. Please try again.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

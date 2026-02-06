import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { callAI, getUserApiKeyFromRequest } from '../_shared/ai-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-api-key',
};

const RequestSchema = z.object({
  text: z.string().min(1).max(10000),
  targetLanguage: z.enum([
    'English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Bengali',
    'Gujarati', 'Marathi', 'Punjabi', 'Odia', 'Assamese', 'Urdu', 'Sanskrit',
    'Nepali', 'Konkani', 'Maithili', 'Sindhi', 'Kashmiri', 'Manipuri', 'Bodo',
    'Santali', 'Dogri'
  ]),
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

    const { text, targetLanguage, userApiKey } = validation.data;
    const apiKey = userApiKey || getUserApiKeyFromRequest(req);

    // If already English, return as-is
    if (targetLanguage === 'English') {
      return new Response(JSON.stringify({ translatedText: text }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Translating to ${targetLanguage}, text length: ${text.length}, usingUserKey: ${!!apiKey}`);

    const response = await callAI({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: "system",
          content: `You are a professional translator. Translate the given technical explanation into ${targetLanguage}. Keep technical terms in English when appropriate but explain them in ${targetLanguage}. Maintain the same structure and formatting. Only output the translation, nothing else.`
        },
        {
          role: "user",
          content: text
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
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Add your free API key or credits.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const translatedText = data.choices[0].message.content;
    
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

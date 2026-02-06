// Shared AI client that supports both Lovable Gateway and user's own Google AI Studio API key

export interface AIRequestOptions {
  model: string;
  messages: any[];
  response_format?: { type: string };
  max_tokens?: number;
}

export interface AIClientConfig {
  userApiKey?: string;  // User's Google AI Studio API key (optional)
}

// Model mapping from Lovable models to Google AI models
const MODEL_MAP: Record<string, string> = {
  'google/gemini-2.5-pro': 'gemini-1.5-pro',
  'google/gemini-2.5-flash': 'gemini-1.5-flash',
  'google/gemini-2.5-flash-lite': 'gemini-1.5-flash',
  'google/gemini-3-flash-preview': 'gemini-1.5-flash',
  'google/gemini-3-pro-preview': 'gemini-1.5-pro',
};

// Convert OpenAI-style messages to Google AI format
function convertToGoogleFormat(messages: any[]): any[] {
  return messages.map(msg => {
    if (msg.role === 'system') {
      // Google AI uses 'user' role with system instruction prefix
      return {
        role: 'user',
        parts: [{ text: `[System Instruction]: ${msg.content}` }]
      };
    }
    
    if (typeof msg.content === 'string') {
      return {
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      };
    }
    
    // Handle multimodal content (text + images)
    if (Array.isArray(msg.content)) {
      const parts: any[] = [];
      for (const item of msg.content) {
        if (item.type === 'text') {
          parts.push({ text: item.text });
        } else if (item.type === 'image_url') {
          // Extract base64 data from data URL
          const imageUrl = item.image_url?.url || '';
          if (imageUrl.startsWith('data:')) {
            const [header, base64Data] = imageUrl.split(',');
            const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/png';
            parts.push({
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            });
          } else {
            // External URL - Google AI can handle these directly
            parts.push({
              file_data: {
                file_uri: imageUrl,
                mime_type: 'image/png'
              }
            });
          }
        }
      }
      return {
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts
      };
    }
    
    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(msg.content) }]
    };
  });
}

export async function callAI(options: AIRequestOptions, config?: AIClientConfig): Promise<Response> {
  const userApiKey = config?.userApiKey;
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

  // If user provided their own API key, use Google AI directly
  if (userApiKey) {
    console.log('Using user-provided Google AI Studio API key');
    
    const googleModel = MODEL_MAP[options.model] || 'gemini-1.5-flash';
    const googleMessages = convertToGoogleFormat(options.messages);
    
    // Extract system instruction if present
    let systemInstruction = '';
    const filteredMessages = googleMessages.filter(msg => {
      if (msg.parts?.[0]?.text?.startsWith('[System Instruction]:')) {
        systemInstruction = msg.parts[0].text.replace('[System Instruction]: ', '');
        return false;
      }
      return true;
    });

    const requestBody: any = {
      contents: filteredMessages,
      generationConfig: {
        maxOutputTokens: options.max_tokens || 8192,
      }
    };

    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    // Request JSON response if specified
    if (options.response_format?.type === 'json_object') {
      requestBody.generationConfig.responseMimeType = 'application/json';
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${googleModel}:generateContent?key=${userApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    );

    // Convert Google AI response to OpenAI format for consistency
    if (response.ok) {
      const googleData = await response.json();
      const content = googleData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      const openAIFormat = {
        choices: [{
          message: {
            role: 'assistant',
            content: content
          }
        }]
      };

      return new Response(JSON.stringify(openAIFormat), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Return error response as-is
    return response;
  }

  // Fallback to Lovable AI Gateway
  if (!LOVABLE_API_KEY) {
    throw new Error('No API key available. Please add your Google AI Studio API key or enable Lovable credits.');
  }

  console.log('Using Lovable AI Gateway');
  
  return fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options)
  });
}

// Helper to extract user API key from request headers
export function getUserApiKeyFromRequest(req: Request): string | undefined {
  return req.headers.get('x-user-api-key') || undefined;
}

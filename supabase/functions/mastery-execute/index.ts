import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { mode, code, language, testCases, question, userInput, action } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const aiCall = async (messages: any[], jsonMode = true) => {
      const body: any = {
        model: 'google/gemini-3-flash-preview',
        messages,
      };
      if (jsonMode) body.response_format = { type: "json_object" };

      const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const status = resp.status;
        if (status === 429) return { _error: 'RATE_LIMIT', _status: 429 };
        if (status === 402) return { _error: 'PAYMENT_REQUIRED', _status: 402 };
        const t = await resp.text();
        console.error('AI error:', status, t);
        return { _error: 'AI_ERROR', _status: 500 };
      }

      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content || '';
      if (jsonMode) {
        try { return JSON.parse(content); } catch { return { _error: 'PARSE_ERROR', raw: content }; }
      }
      return { text: content };
    };

    // ========== MODE: execute ==========
    if (mode === 'execute') {
      const result = await aiCall([
        { role: 'system', content: `You are an EXACT code execution engine. Execute the given code EXACTLY as a real compiler/interpreter would.

CRITICAL RULES:
1. Execute step by step, tracking ALL variables, function calls, control flow
2. If code reads input (scanf, cin, input(), Scanner, readline), use provided stdin
3. Return EXACT output a real compiler produces - nothing more, nothing less
4. For compilation errors, return the EXACT error message
5. For runtime errors (segfault, division by zero, stack overflow), show the runtime error
6. Handle ALL programming languages accurately
7. DO NOT add explanations or formatting - ONLY raw program output
8. For SQL: Format as ASCII tables. For R: R console style.

Return JSON:
{
  "output": "exact program output string",
  "hasError": boolean,
  "errorType": "none"|"syntax"|"runtime"|"compilation"|"logical",
  "errorMessage": "exact compiler/interpreter error if any",
  "exitCode": 0 or 1,
  "executionTime": "estimated ms",
  "memoryUsed": "estimated MB"
}` },
        { role: 'user', content: `Language: ${language}\nStdin Input: ${userInput || '(none)'}\n\nCode:\n\`\`\`\n${code}\n\`\`\`` }
      ]);

      if (result._error) {
        return new Response(JSON.stringify({ error: result._error }), {
          status: result._status || 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== MODE: verify_testcases ==========
    if (mode === 'verify_testcases') {
      const result = await aiCall([
        { role: 'system', content: `You are a precise code judge system like CodeTantra/LeetCode/HackerRank. Execute the given code against EACH test case and verify outputs.

CRITICAL RULES:
1. For EACH test case, execute the code with the given input
2. Compare the actual output with the expected output (trim whitespace, ignore trailing newlines)
3. A test case PASSES only if actual output EXACTLY matches expected output
4. If the code has compilation/syntax errors, ALL test cases FAIL with the error message
5. If the code has a runtime error on a specific input, that test case fails
6. Track execution time and memory for each test case
7. Be STRICT about output matching - even extra spaces or wrong case means failure
8. If the code is incomplete/boilerplate (contains "Write your solution here" or similar), all test cases fail with "Incomplete Solution"

Return JSON:
{
  "results": [
    {
      "testCaseIndex": 0,
      "input": "the input",
      "expectedOutput": "expected",
      "actualOutput": "what code actually produces",
      "passed": boolean,
      "executionTime": "ms",
      "error": "error message if any"
    }
  ],
  "allPassed": boolean,
  "totalPassed": number,
  "totalTests": number,
  "hasCompilationError": boolean,
  "compilationError": "error if any",
  "overallVerdict": "Accepted"|"Wrong Answer"|"Compilation Error"|"Runtime Error"|"Time Limit Exceeded"|"Incomplete Solution"
}` },
        { role: 'user', content: `Language: ${language}\nQuestion: ${question || 'Unknown'}\n\nCode:\n\`\`\`\n${code}\n\`\`\`\n\nTest Cases:\n${JSON.stringify(testCases)}` }
      ]);

      if (result._error) {
        return new Response(JSON.stringify({ error: result._error }), {
          status: result._status || 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== MODE: ai_assist ==========
    if (mode === 'ai_assist') {
      const actionPrompts: Record<string, string> = {
        hint: `Give a concise, helpful hint for solving "${question}" without revealing the full solution. Include:
1. The key algorithmic insight
2. What data structure to use and why
3. Edge cases to consider
Format with emoji headers.`,
        explain: `Explain the optimal approach for "${question}" in detail:
1. Algorithm name and why it works
2. Step-by-step walkthrough with a small example
3. Time and space complexity with proof
4. Common pitfalls
Format clearly with sections.`,
        optimize: `Analyze this code for "${question}" and suggest optimizations:
1. Current time/space complexity
2. Can we do better? If yes, explain how
3. Micro-optimizations (early termination, better data structures)
4. Memory optimization tips
Show concrete before/after for key improvements.`,
        review: `Review this code for "${question}":
1. Correctness: Will it handle all edge cases?
2. Style: Is it clean and readable?
3. Performance: Any bottlenecks?
4. Bugs: Any potential issues?
5. Suggestions: Concrete improvements
Be specific - reference line numbers or code sections.`,
      };

      const result = await aiCall([
        { role: 'system', content: `You are an expert coding mentor. Provide clear, actionable advice. Use the user's programming language (${language}) for any code examples.` },
        { role: 'user', content: `${actionPrompts[action] || actionPrompts.hint}\n\nUser's code:\n\`\`\`${language}\n${code}\n\`\`\`` }
      ], false);

      if (result._error) {
        return new Response(JSON.stringify({ error: result._error }), {
          status: result._status || 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ response: result.text || result.raw || 'No response' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown mode' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('mastery-execute error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

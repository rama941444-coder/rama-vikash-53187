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
        temperature: 0,
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
        { role: 'system', content: `You are a DETERMINISTIC code execution engine. Behave EXACTLY like the real official compiler/interpreter for the selected language. Do NOT guess, do NOT improvise, do NOT add explanations.

EXECUTION PROTOCOL (follow strictly):
1. PARSE the code with the language's real grammar. Detect syntax errors EXACTLY where the real compiler would (e.g. Python: missing ':' after if/for/while/def -> "SyntaxError: expected ':'"; C/C++: missing ';' -> "expected ';' before ..."; Java: must have public class matching filename or it errors).
2. If syntax/compilation fails, output the EXACT compiler diagnostic message (file/line where applicable) and STOP. Set hasError=true, errorType="syntax" or "compilation", exitCode=1.
3. Otherwise EXECUTE step-by-step. Maintain a real variable/heap/stack model. Honor language semantics:
   - Python: indentation, dynamic typing, exceptions (NameError, TypeError, IndexError, ZeroDivisionError, etc.)
   - C/C++: undefined behavior is OK to surface as runtime crash; printf/cout flushing; integer overflow wraps for signed (UB) but show typical gcc behavior.
   - Java: must have a main method; throws like ArrayIndexOutOfBoundsException, NullPointerException with stack trace style.
   - JavaScript/TypeScript: Node.js semantics, console.log adds newline.
   - Go, Rust, Kotlin, Swift, C#, PHP, Ruby, Perl, R, SQL, Bash, etc.: use that language's real runtime behavior.
4. STDIN: If the program reads input (input(), scanf, cin>>, Scanner.next, readline, gets, fgets, std::io::stdin, bufio.NewReader, etc.), consume from the provided stdin EXACTLY (split by whitespace/newline as the language's read primitive does). If stdin is empty but required, raise the language's normal EOF error (Python: EOFError; C: returns EOF; Java: NoSuchElementException).
5. OUTPUT: Capture EXACTLY what would be written to stdout. Preserve whitespace, newlines, ordering. Do NOT add prompts, banners, ANSI codes, or trailing commentary. If the program prints nothing, output is "".
6. Runtime errors: print the partial stdout produced before the crash, then the EXACT runtime error message, then set hasError=true, errorType="runtime", exitCode=1 (or signal-specific code).
7. SQL: render result sets as the standard psql/mysql ASCII table. R: R console style with [1] prefixes.
8. NEVER fabricate output. NEVER summarize. NEVER add "// output:" or markdown fences.

Return STRICT JSON:
{
  "output": "exact stdout bytes as a string",
  "hasError": boolean,
  "errorType": "none"|"syntax"|"runtime"|"compilation"|"logical",
  "errorMessage": "exact compiler/runtime diagnostic, empty string if none",
  "exitCode": 0|1|integer,
  "executionTime": "estimated ms as string",
  "memoryUsed": "estimated MB as string"
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
        { role: 'system', content: `You are an Online Judge engine (CodeTantra / LeetCode / HackerRank style). You MUST behave like the real backend, not a tutor.

JUDGING PROTOCOL:
1. First COMPILE the code with the real language grammar. If compilation/syntax fails -> ALL test cases get passed=false with the EXACT compiler error in the "error" field; hasCompilationError=true; overallVerdict="Compilation Error".
2. If the submission is just boilerplate / contains "Write your solution here", "TODO", "pass" only, empty function body, or otherwise does not implement logic -> ALL test cases fail with error="Incomplete Solution"; overallVerdict="Incomplete Solution".
3. Otherwise, for EACH test case independently:
   a. Reset state. Feed the test case "input" as STDIN (the program reads it via input()/scanf/cin/Scanner/etc.) — OR if the question expects a function call, call the function with parsed args and capture its return value formatted as the expected output.
   b. Execute step-by-step honoring real language semantics (exceptions, types, overflow, indexing, etc.).
   c. Capture actualOutput EXACTLY (stdout bytes, or stringified return value).
   d. Compare to expectedOutput using this rule: trim leading/trailing whitespace on both sides AND collapse trailing newlines, but PRESERVE internal spacing and case. passed = (normalized actual === normalized expected).
   e. If a runtime exception is thrown on this input -> passed=false; error = exact runtime error; actualOutput = whatever was printed before the crash.
4. NEVER mark a test as passed unless you genuinely simulated the code and the outputs match. NEVER fabricate output. If the logic is clearly wrong (e.g. returns []), report the wrong actualOutput, not the expected one.
5. overallVerdict precedence: "Compilation Error" > "Runtime Error" (if any tc errored) > "Wrong Answer" (if any tc failed) > "Accepted" (all passed).

Return STRICT JSON ONLY:
{
  "results": [
    {
      "testCaseIndex": 0,
      "input": "the input as given",
      "expectedOutput": "expected",
      "actualOutput": "exact output your simulation produced",
      "passed": boolean,
      "executionTime": "ms as string",
      "error": "error message or empty string"
    }
  ],
  "allPassed": boolean,
  "totalPassed": number,
  "totalTests": number,
  "hasCompilationError": boolean,
  "compilationError": "exact compiler error or empty string",
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

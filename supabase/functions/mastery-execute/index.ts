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
   a. Reset state. Decide EXECUTION MODE:
      EXECUTION MODE DETECTION (be strict — only use STDIN mode when the code TRULY reads input):
        STDIN MODE requires ALL of:
          - The code contains an actual stdin read call that is reachable (not inside a commented block, not inside an unused function): Python input()/sys.stdin.read()/sys.stdin.readline()/raw_input(); C scanf/fscanf(stdin)/getchar/gets/fgets(...,stdin)/read(0,...); C++ std::cin>>/getline(cin,...)/scanf; Java new Scanner(System.in) followed by .next/.nextInt/.nextLine, BufferedReader(InputStreamReader(System.in)).readLine, or System.in.read; JavaScript/Node process.stdin / readline.createInterface({input:process.stdin}) / require('fs').readFileSync(0); Go bufio.NewReader(os.Stdin)/fmt.Scan/Scanln/Scanf; Rust std::io::stdin().read_line / .lock().lines(); Ruby gets/STDIN.read/$stdin; PHP fgets(STDIN)/file_get_contents("php://stdin"); Bash read; Kotlin readLine()/Scanner; Swift readLine(); C# Console.ReadLine/Console.In.
          - AND the code has a driver (Python: top-level statements that call the read or an if __name__=='__main__' block; C/C++: int main; Java: public static void main; Go: func main; Rust: fn main; JS: top-level code; etc.).
        Otherwise use FUNCTION-CALL MODE:
          - Identify the target function: it is the function whose name closely matches the problem title (camelCase/snake_case variants like twoSum/two_sum; reverseList/reverse_list; isPalindrome/is_palindrome; maxSubArray/max_sub_array). If multiple candidates exist, prefer the one declared at module scope with parameters matching the test case input shape. For class-based problems (LeetCode style), call e.g. Solution().twoSum(...) / new Solution().twoSum(...).
          - Parse the test case "input" as the function ARGUMENT LIST. Inputs are usually written as comma-separated literal values, e.g. "[2,7,11,15], 9" -> args = ([2,7,11,15], 9). If the input is a single JSON value, pass it as the single argument. Use the language's literal grammar (Python list/tuple/dict, JS array/object) to parse.
          - Capture the function's RETURN VALUE and stringify per the language's default repr — see RETURN VALUE FORMATTING RULES below.
        HYBRID GUARD: if BOTH a main/driver AND a candidate target function exist, prefer the main+stdin path ONLY when the test case input is plain-text (no Python/JS literal syntax). If the input contains [, {, or commas at the top level, switch to FUNCTION-CALL mode and pass the parsed literal to the target function. NEVER pass literal-syntax test inputs as raw bytes to a stdin reader expecting whitespace-separated tokens.

      RETURN VALUE FORMATTING RULES (must match the language's native repr exactly so that comparisons against expectedOutput are predictable):
        - Python: use repr() for lists/tuples/dicts/sets — e.g. [0, 1] (with space after comma), (1, 2), {'a': 1}, {1, 2}. Strings: 'hello' (single quotes). None -> 'None'. True/False capitalized. Floats: Python's default repr (e.g. 1.0 stays 1.0, not 1).
        - JavaScript/TypeScript: use JSON.stringify() — [0,1] (no spaces), {"a":1}. undefined -> "undefined". null -> "null". Numbers: default Number toString (1 stays 1, not 1.0).
        - Java: arrays via Arrays.toString(...) -> [0, 1] (Python-like spacing); Lists via List.toString -> [0, 1]; Maps via Map.toString -> {a=1}; null -> "null"; doubles like 1.0.
        - C++: vectors must be printed manually — if the user's code returns a vector<int> from a function, format as "[0, 1]" matching Python style for fairness UNLESS the expectedOutput uses a different format (then match expected style).
        - Go: fmt.Sprintln/Println default — slices look like "[0 1]" (space-separated, no commas). If expectedOutput is "[0, 1]" Python-style, format with commas to be fair to the user.
        - Rust: Debug format {:?} — "[0, 1]". Display format for primitives.
        - Ruby: .inspect — [0, 1], "hello", :symbol, nil, {:a=>1}.
        - PHP: print_r/var_export style; for arrays "Array ( [0] => 0 [1] => 1 )". If expected is JSON, use json_encode.
        - C#: List/array ToString gives "System.Collections.Generic.List`1[System.Int32]" — instead use string.Join(", ", ...) wrapped in [] to match expected.
        - WHEN IN DOUBT: format the return value to match the SHAPE of expectedOutput. If expectedOutput is "[0, 1]" use Python-style; if "[0,1]" use JSON-style; if "0 1" use space-joined. Reformatting the actual output to match a clearly-equivalent shape is REQUIRED so that semantically-correct answers are not marked Wrong Answer over trivial spacing — but ONLY when the underlying values match exactly.
   b. PER-LANGUAGE STDIN PARSING (must match the real runtime exactly):
      - Python: input() returns one line WITHOUT trailing newline; sys.stdin.read() returns the whole buffer; int(input().split()) is split on whitespace.
      - C scanf("%d",&x): skips leading whitespace then reads token; %s reads until whitespace; %c reads one byte; fgets reads up to newline INCLUDING the \\n.
      - C++ cin>>x: skips whitespace then reads token; getline(cin,s) reads to newline EXCLUDING the \\n; mixing >> and getline leaves a stray \\n in the buffer (real bug — preserve it).
      - Java Scanner.nextInt() / next(): whitespace-delimited tokens; nextLine() reads to end-of-line; the well-known nextInt()+nextLine() leftover-newline bug must be preserved.
      - JavaScript (Node): readline 'line' event fires per \\n-terminated line; process.stdin chunks are raw bytes.
      - Go: fmt.Scan whitespace-delimited; bufio.Scanner default splits by lines.
      - Rust: stdin().read_line(&mut s) keeps trailing \\n — typical .trim() removes it.
      - Ruby: gets returns line WITH \\n; chomp removes it.
      - PHP: fgets(STDIN) keeps \\n; trim() to strip.
      - Bash: read VAR strips trailing newline; IFS controls splitting.
      Treat the test "input" string verbatim as the stdin buffer; do NOT inject extra prompts or trim it before feeding.
   c. Execute step-by-step honoring real language semantics (exceptions, types, integer overflow, 0-based vs 1-based indexing, mutability, reference vs value, etc.).
   d. Capture actualOutput EXACTLY (stdout bytes for stdin mode; stringified return value for function-call mode).
   e. STRICT OUTPUT MATCHER (apply per language):
      - Step 1: take expectedOutput and actualOutput as strings.
      - Step 2: normalize line endings: replace \\r\\n with \\n on BOTH sides.
      - Step 3: strip a single trailing \\n from BOTH sides if present (most print/println add one), then strip ALL trailing whitespace-only lines.
      - Step 4: do NOT collapse internal whitespace; do NOT change case; do NOT reorder lines.
      - Step 5: passed = (normalized actual === normalized expected) byte-for-byte.
      - Edge cases: numeric outputs must match formatting exactly (e.g. "1.0" != "1", "1.50" != "1.5"). Lists in function-call mode: Python "[0, 1]" with spaces, JS "[0,1]" without — match the language's default toString.
   f. If a runtime exception is thrown on this input -> passed=false; error = exact runtime error including type and message (e.g. "IndexError: list index out of range", "java.lang.NullPointerException", "thread 'main' panicked at ..."); actualOutput = whatever was printed before the crash.
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

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/mastery-execute`;

async function verify(language: string, code: string, testCases: {input:string; expectedOutput:string}[], question = "Test") {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ mode: "verify_testcases", code, language, testCases, question }),
  });
  const data = await res.json();
  return data;
}

/**
 * GOLDEN SUITE — per-language output normalization rules.
 * Each case asserts the judge accepts the language-native repr for a list/array
 * and flags the obviously-wrong answer.
 */
const golden = [
  {
    name: "Python repr — list with spaces",
    language: "python",
    code: "def twoSum(nums, target):\n    return [0, 1]\n",
    tc: [{ input: "[2,7,11,15], 9", expectedOutput: "[0, 1]" }],
    expectPass: true,
  },
  {
    name: "JS JSON.stringify — array no spaces",
    language: "javascript",
    code: "function twoSum(nums, target){ return [0,1]; }\nmodule.exports = twoSum;",
    tc: [{ input: "[2,7,11,15], 9", expectedOutput: "[0,1]" }],
    expectPass: true,
  },
  {
    name: "Java Arrays.toString style",
    language: "java",
    code: "class Solution { public int[] twoSum(int[] nums, int target){ return new int[]{0,1}; } }",
    tc: [{ input: "[2,7,11,15], 9", expectedOutput: "[0, 1]" }],
    expectPass: true,
  },
  {
    name: "Wrong answer must FAIL (no false positives)",
    language: "python",
    code: "def twoSum(nums, target):\n    return []\n",
    tc: [{ input: "[2,7,11,15], 9", expectedOutput: "[0, 1]" }],
    expectPass: false,
  },
  {
    name: "Stdin mode driver — Python input()",
    language: "python",
    code: "a, b = map(int, input().split())\nprint(a+b)\n",
    tc: [{ input: "2 3", expectedOutput: "5" }],
    expectPass: true,
    expectMode: "STDIN",
  },
  {
    name: "Function-call mode — no reachable stdin",
    language: "python",
    code: "def add(a,b):\n    return a+b\n",
    tc: [{ input: "2, 3", expectedOutput: "5" }],
    expectPass: true,
    expectMode: "FUNCTION-CALL",
  },
];

for (const g of golden) {
  Deno.test(`golden: ${g.name}`, async () => {
    const data = await verify(g.language, g.code, g.tc, g.name);
    const r = data?.results?.[0];
    assertEquals(!!r, true, `no result returned: ${JSON.stringify(data).slice(0,300)}`);
    assertEquals(r.passed, g.expectPass, `expected passed=${g.expectPass}, got=${r.passed}; actual=${r.actualOutput}; err=${r.error}`);
    if (g.expectMode) {
      assertEquals(r.mode, g.expectMode, `expected mode=${g.expectMode}, got=${r.mode} (${r.detectionReason})`);
    }
  });
}
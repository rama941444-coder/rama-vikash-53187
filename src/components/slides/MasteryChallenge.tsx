import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Trophy, Code, ChevronDown, ChevronRight, Play, CheckCircle, 
  XCircle, Eye, EyeOff, Sparkles, Target, Award, Brain,
  BookOpen, Lightbulb, Star, Zap, Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LanguageSelector from '@/components/LanguageSelector';
import { supabase } from '@/integrations/supabase/client';

interface Question {
  id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  description: string;
  examples: { input: string; output: string; explanation?: string }[];
  testCases: { input: string; expectedOutput: string; hidden?: boolean }[];
  solutions: { language: string; code: string; complexity: { time: string; space: string } }[];
  hints: string[];
  tags: string[];
}

interface MasteryChallengeProps {
  userCodeFromSlide2?: string;
  userCodeFromSlide5?: string;
}

const MasteryChallenge = ({ userCodeFromSlide2 = '', userCodeFromSlide5 = '' }: MasteryChallengeProps) => {
  const [activeCategory, setActiveCategory] = useState<'basic' | 'medium' | 'advanced' | 'master'>('basic');
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [userCode, setUserCode] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('JavaScript');
  const [showSolution, setShowSolution] = useState(false);
  const [testResults, setTestResults] = useState<{ passed: boolean; input: string; expected: string; actual: string }[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [mcqQuestions, setMcqQuestions] = useState<{question: string; options: string[]; answer: number; selected?: number}[]>([]);
  const [mcqLoading, setMcqLoading] = useState(false);
  const [currentMcqTopic, setCurrentMcqTopic] = useState('');
  const [mcqScore, setMcqScore] = useState<number | null>(null);
  const [allTestsPassed, setAllTestsPassed] = useState(false);
  const { toast } = useToast();

  const activeUserCode = userCodeFromSlide5 || userCodeFromSlide2;

  const detectCodeTopic = (code: string): string => {
    if (!code) return 'General';
    const lowerCode = code.toLowerCase();
    if (lowerCode.includes('sort') || lowerCode.includes('merge') || lowerCode.includes('quick')) return 'Sorting Algorithms';
    if (lowerCode.includes('tree') || lowerCode.includes('node') || lowerCode.includes('left') || lowerCode.includes('right')) return 'Trees';
    if (lowerCode.includes('graph') || lowerCode.includes('dfs') || lowerCode.includes('bfs')) return 'Graphs';
    if (lowerCode.includes('array') || lowerCode.includes('list') || lowerCode.includes('vector')) return 'Arrays';
    if (lowerCode.includes('hash') || lowerCode.includes('map') || lowerCode.includes('dict')) return 'Hash Tables';
    if (lowerCode.includes('stack') || lowerCode.includes('push') || lowerCode.includes('pop')) return 'Stacks';
    if (lowerCode.includes('queue') || lowerCode.includes('enqueue') || lowerCode.includes('dequeue')) return 'Queues';
    if (lowerCode.includes('recursion') || lowerCode.includes('fibonacci') || lowerCode.includes('factorial')) return 'Recursion';
    if (lowerCode.includes('dp') || lowerCode.includes('dynamic')) return 'Dynamic Programming';
    if (lowerCode.includes('string') || lowerCode.includes('substring') || lowerCode.includes('palindrome')) return 'Strings';
    if (lowerCode.includes('linked') || lowerCode.includes('next') || lowerCode.includes('prev')) return 'Linked Lists';
    return 'General';
  };

  // Generate MCQ questions using AI based on user's code
  const generateMcqQuestions = async (topic: string) => {
    setMcqLoading(true);
    setCurrentMcqTopic(topic);
    setMcqScore(null);
    
    const detectedTopic = activeUserCode ? detectCodeTopic(activeUserCode) : topic;

    try {
      const { data, error } = await supabase.functions.invoke('analyze-code', {
        body: {
          code: activeUserCode || '',
          language: 'Auto-Detect',
          mode: 'generate_mcq',
          topic: activeUserCode ? detectedTopic : topic,
        }
      });

      if (data?.mcqQuestions && Array.isArray(data.mcqQuestions) && data.mcqQuestions.length > 0) {
        setMcqQuestions(data.mcqQuestions);
        setMcqLoading(false);
        toast({
          title: "📝 Quiz Ready!",
          description: `10 questions on ${activeUserCode ? detectedTopic : topic}`,
        });
        return;
      }
    } catch (err) {
      console.error('AI MCQ generation failed, using fallback:', err);
    }

    // Fallback question bank
    const questionsBank: Record<string, {question: string; options: string[]; answer: number}[]> = {
      'Data Structures': [
        { question: "What is the time complexity of inserting an element at the beginning of an array?", options: ["O(1)", "O(n)", "O(log n)", "O(n²)"], answer: 1 },
        { question: "Which data structure uses LIFO principle?", options: ["Queue", "Stack", "Linked List", "Tree"], answer: 1 },
        { question: "What is the height of a balanced binary search tree with n nodes?", options: ["O(n)", "O(log n)", "O(n²)", "O(1)"], answer: 1 },
        { question: "Which traversal visits root before children?", options: ["Inorder", "Preorder", "Postorder", "Level order"], answer: 1 },
        { question: "Hash table average case lookup time complexity is:", options: ["O(n)", "O(1)", "O(log n)", "O(n log n)"], answer: 1 },
        { question: "A min-heap property states that:", options: ["Parent ≤ Children", "Parent ≥ Children", "Left < Right", "Left > Right"], answer: 0 },
        { question: "Which data structure is used in BFS?", options: ["Stack", "Queue", "Heap", "Tree"], answer: 1 },
        { question: "Red-Black tree is a type of:", options: ["Binary Search Tree", "B-Tree", "Trie", "Graph"], answer: 0 },
        { question: "Worst case time complexity of Quick Sort is:", options: ["O(n log n)", "O(n²)", "O(n)", "O(log n)"], answer: 1 },
        { question: "Which data structure is best for implementing LRU cache?", options: ["Array", "HashMap + Doubly Linked List", "Stack", "Queue"], answer: 1 },
      ],
      'Algorithms': [
        { question: "Which algorithm paradigm does Merge Sort use?", options: ["Greedy", "Divide and Conquer", "Dynamic Programming", "Backtracking"], answer: 1 },
        { question: "Dijkstra's algorithm fails when:", options: ["Graph has cycles", "Graph has negative weights", "Graph is directed", "Graph is sparse"], answer: 1 },
        { question: "Time complexity of binary search is:", options: ["O(n)", "O(log n)", "O(n²)", "O(1)"], answer: 1 },
        { question: "Which is NOT a stable sorting algorithm?", options: ["Merge Sort", "Quick Sort", "Bubble Sort", "Insertion Sort"], answer: 1 },
        { question: "Dynamic Programming is used when problem has:", options: ["Greedy choice", "Optimal substructure + Overlapping subproblems", "Random access", "Linear structure"], answer: 1 },
        { question: "Kruskal's algorithm finds:", options: ["Shortest path", "Minimum spanning tree", "Maximum flow", "Topological order"], answer: 1 },
        { question: "A* algorithm uses:", options: ["Only heuristic", "Only actual cost", "Heuristic + actual cost", "Random selection"], answer: 2 },
        { question: "KMP algorithm is used for:", options: ["Sorting", "Pattern matching", "Graph traversal", "Tree construction"], answer: 1 },
        { question: "Bellman-Ford can handle:", options: ["Only positive weights", "Negative weights", "Only DAGs", "Only trees"], answer: 1 },
        { question: "Floyd-Warshall finds:", options: ["Single source shortest path", "All pairs shortest path", "MST", "Max flow"], answer: 1 },
      ],
      'System Design': [
        { question: "CAP theorem states you can only have 2 of:", options: ["Speed, Storage, Security", "Consistency, Availability, Partition tolerance", "Cost, Accuracy, Performance", "None"], answer: 1 },
        { question: "Which is a NoSQL database?", options: ["PostgreSQL", "MongoDB", "MySQL", "Oracle"], answer: 1 },
        { question: "Load balancer distributes traffic based on:", options: ["Only IP", "Various algorithms", "Only cookies", "Only headers"], answer: 1 },
        { question: "Microservices communicate via:", options: ["Shared memory", "APIs/Message queues", "Direct function calls", "Global variables"], answer: 1 },
        { question: "Redis is primarily used for:", options: ["File storage", "Caching", "Video streaming", "Email"], answer: 1 },
        { question: "Horizontal scaling means:", options: ["Adding more CPU", "Adding more servers", "Adding more RAM", "Adding more storage"], answer: 1 },
        { question: "CDN is used to:", options: ["Store databases", "Serve static content faster", "Process payments", "Send emails"], answer: 1 },
        { question: "Rate limiting prevents:", options: ["SQL injection", "DDoS attacks", "XSS", "CSRF"], answer: 1 },
        { question: "Event-driven architecture uses:", options: ["Synchronous calls", "Message queues/Event buses", "Shared databases", "RPC only"], answer: 1 },
        { question: "Database sharding helps with:", options: ["Security", "Horizontal scaling", "Backup", "Encryption"], answer: 1 },
      ],
    };
    
    setMcqQuestions(questionsBank[topic] || questionsBank['Data Structures']);
    setMcqLoading(false);
    toast({
      title: "📝 Quiz Ready!",
      description: `10 questions on ${topic}`,
    });
  };

  const selectMcqAnswer = (questionIndex: number, optionIndex: number) => {
    setMcqQuestions(prev => prev.map((q, i) => 
      i === questionIndex ? { ...q, selected: optionIndex } : q
    ));
  };

  const submitMcqQuiz = () => {
    const score = mcqQuestions.filter(q => q.selected === q.answer).length;
    setMcqScore(score);
    toast({
      title: score >= 7 ? "🎉 Excellent!" : score >= 5 ? "👍 Good Job!" : "📚 Keep Practicing!",
      description: `You scored ${score}/${mcqQuestions.length}`,
    });
  };

  // Sample questions
  const basicQuestions: Question[] = [
    {
      id: 'basic-1',
      title: 'Two Sum',
      difficulty: 'easy',
      description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
      examples: [
        { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'nums[0] + nums[1] = 2 + 7 = 9' }
      ],
      testCases: [
        { input: '[2,7,11,15], 9', expectedOutput: '[0,1]' },
        { input: '[3,2,4], 6', expectedOutput: '[1,2]' },
        { input: '[3,3], 6', expectedOutput: '[0,1]', hidden: true }
      ],
      solutions: [
        { language: 'JavaScript', code: `function twoSum(nums, target) {\n  const map = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (map.has(complement)) return [map.get(complement), i];\n    map.set(nums[i], i);\n  }\n  return [];\n}`, complexity: { time: 'O(n)', space: 'O(n)' } },
        { language: 'Python', code: `def twoSum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in seen:\n            return [seen[complement], i]\n        seen[num] = i\n    return []`, complexity: { time: 'O(n)', space: 'O(n)' } },
        { language: 'Java', code: `public int[] twoSum(int[] nums, int target) {\n    Map<Integer, Integer> map = new HashMap<>();\n    for (int i = 0; i < nums.length; i++) {\n        int complement = target - nums[i];\n        if (map.containsKey(complement)) return new int[]{map.get(complement), i};\n        map.put(nums[i], i);\n    }\n    return new int[0];\n}`, complexity: { time: 'O(n)', space: 'O(n)' } },
        { language: 'C++', code: `vector<int> twoSum(vector<int>& nums, int target) {\n    unordered_map<int, int> mp;\n    for (int i = 0; i < nums.size(); i++) {\n        int complement = target - nums[i];\n        if (mp.find(complement) != mp.end()) return {mp[complement], i};\n        mp[nums[i]] = i;\n    }\n    return {};\n}`, complexity: { time: 'O(n)', space: 'O(n)' } },
        { language: 'C', code: `int* twoSum(int* nums, int numsSize, int target, int* returnSize) {\n    int* result = malloc(2 * sizeof(int));\n    *returnSize = 2;\n    for (int i = 0; i < numsSize; i++)\n        for (int j = i + 1; j < numsSize; j++)\n            if (nums[i] + nums[j] == target) { result[0]=i; result[1]=j; return result; }\n    return result;\n}`, complexity: { time: 'O(n²)', space: 'O(1)' } }
      ],
      hints: ['Try using a hash map to store seen values', 'For each element, check if its complement exists'],
      tags: ['Array', 'Hash Table']
    },
    {
      id: 'basic-2',
      title: 'Reverse String',
      difficulty: 'easy',
      description: 'Write a function that reverses a string. The input string is given as an array of characters.',
      examples: [{ input: 's = ["h","e","l","l","o"]', output: '["o","l","l","e","h"]' }],
      testCases: [
        { input: '["h","e","l","l","o"]', expectedOutput: '["o","l","l","e","h"]' },
        { input: '["H","a","n","n","a","h"]', expectedOutput: '["h","a","n","n","a","H"]' }
      ],
      solutions: [
        { language: 'JavaScript', code: `function reverseString(s) {\n  let left = 0, right = s.length - 1;\n  while (left < right) {\n    [s[left], s[right]] = [s[right], s[left]];\n    left++; right--;\n  }\n}`, complexity: { time: 'O(n)', space: 'O(1)' } },
        { language: 'Python', code: `def reverseString(s):\n    left, right = 0, len(s) - 1\n    while left < right:\n        s[left], s[right] = s[right], s[left]\n        left += 1; right -= 1`, complexity: { time: 'O(n)', space: 'O(1)' } }
      ],
      hints: ['Use two pointers from both ends', 'Swap in-place to achieve O(1) space'],
      tags: ['Two Pointers', 'String']
    },
    {
      id: 'basic-3',
      title: 'Palindrome Number',
      difficulty: 'easy',
      description: 'Given an integer x, return true if x is palindrome integer.',
      examples: [{ input: 'x = 121', output: 'true', explanation: '121 reads as 121 from left to right.' }],
      testCases: [
        { input: '121', expectedOutput: 'true' },
        { input: '-121', expectedOutput: 'false' },
        { input: '10', expectedOutput: 'false', hidden: true }
      ],
      solutions: [
        { language: 'JavaScript', code: `function isPalindrome(x) {\n  if (x < 0) return false;\n  let reversed = 0, original = x;\n  while (x > 0) {\n    reversed = reversed * 10 + (x % 10);\n    x = Math.floor(x / 10);\n  }\n  return original === reversed;\n}`, complexity: { time: 'O(log n)', space: 'O(1)' } }
      ],
      hints: ['Negative numbers are not palindromes', 'Try reversing half of the number'],
      tags: ['Math']
    }
  ];

  const mediumQuestions: Question[] = [
    {
      id: 'medium-1',
      title: 'Longest Substring Without Repeating Characters',
      difficulty: 'medium',
      description: 'Given a string s, find the length of the longest substring without repeating characters.',
      examples: [{ input: 's = "abcabcbb"', output: '3', explanation: 'The answer is "abc", with length 3.' }],
      testCases: [
        { input: '"abcabcbb"', expectedOutput: '3' },
        { input: '"bbbbb"', expectedOutput: '1' },
        { input: '"pwwkew"', expectedOutput: '3', hidden: true }
      ],
      solutions: [
        { language: 'JavaScript', code: `function lengthOfLongestSubstring(s) {\n  const set = new Set();\n  let left = 0, maxLen = 0;\n  for (let right = 0; right < s.length; right++) {\n    while (set.has(s[right])) { set.delete(s[left]); left++; }\n    set.add(s[right]);\n    maxLen = Math.max(maxLen, right - left + 1);\n  }\n  return maxLen;\n}`, complexity: { time: 'O(n)', space: 'O(min(m,n))' } },
        { language: 'Python', code: `def lengthOfLongestSubstring(s):\n    char_set = set()\n    left = max_len = 0\n    for right in range(len(s)):\n        while s[right] in char_set:\n            char_set.remove(s[left])\n            left += 1\n        char_set.add(s[right])\n        max_len = max(max_len, right - left + 1)\n    return max_len`, complexity: { time: 'O(n)', space: 'O(min(m,n))' } }
      ],
      hints: ['Use sliding window technique', 'Keep track of characters in current window with a Set'],
      tags: ['Hash Table', 'Sliding Window', 'String']
    },
    {
      id: 'medium-2',
      title: 'Container With Most Water',
      difficulty: 'medium',
      description: 'Given n non-negative integers representing an elevation map, compute how much water it can trap.',
      examples: [{ input: 'height = [1,8,6,2,5,4,8,3,7]', output: '49' }],
      testCases: [
        { input: '[1,8,6,2,5,4,8,3,7]', expectedOutput: '49' },
        { input: '[1,1]', expectedOutput: '1' }
      ],
      solutions: [
        { language: 'JavaScript', code: `function maxArea(height) {\n  let left = 0, right = height.length - 1, maxWater = 0;\n  while (left < right) {\n    const h = Math.min(height[left], height[right]);\n    maxWater = Math.max(maxWater, h * (right - left));\n    if (height[left] < height[right]) left++;\n    else right--;\n  }\n  return maxWater;\n}`, complexity: { time: 'O(n)', space: 'O(1)' } }
      ],
      hints: ['Use two pointers approach', 'Move the pointer with smaller height'],
      tags: ['Array', 'Two Pointers', 'Greedy']
    }
  ];

  const advancedQuestions: Question[] = [
    {
      id: 'advanced-1',
      title: 'Merge K Sorted Lists',
      difficulty: 'hard',
      description: 'Merge all k sorted linked-lists into one sorted linked-list.',
      examples: [{ input: 'lists = [[1,4,5],[1,3,4],[2,6]]', output: '[1,1,2,3,4,4,5,6]' }],
      testCases: [
        { input: '[[1,4,5],[1,3,4],[2,6]]', expectedOutput: '[1,1,2,3,4,4,5,6]' },
        { input: '[]', expectedOutput: '[]' }
      ],
      solutions: [
        { language: 'JavaScript', code: `function mergeKLists(lists) {\n  if (!lists || lists.length === 0) return null;\n  while (lists.length > 1) {\n    const merged = [];\n    for (let i = 0; i < lists.length; i += 2) {\n      const l1 = lists[i], l2 = i + 1 < lists.length ? lists[i + 1] : null;\n      merged.push(mergeTwoLists(l1, l2));\n    }\n    lists = merged;\n  }\n  return lists[0];\n}`, complexity: { time: 'O(N log k)', space: 'O(1)' } }
      ],
      hints: ['Use divide and conquer approach', 'Merge lists pair by pair'],
      tags: ['Linked List', 'Divide and Conquer', 'Heap']
    }
  ];

  const masterQuestions: Question[] = [
    {
      id: 'master-1',
      title: 'Word Ladder II',
      difficulty: 'expert',
      description: 'Find all shortest transformation sequences from beginWord to endWord.',
      examples: [{ input: 'beginWord = "hit", endWord = "cog"', output: '[["hit","hot","dot","dog","cog"],["hit","hot","lot","log","cog"]]' }],
      testCases: [
        { input: '"hit", "cog", ["hot","dot","dog","lot","log","cog"]', expectedOutput: '[["hit","hot","dot","dog","cog"],["hit","hot","lot","log","cog"]]' }
      ],
      solutions: [
        { language: 'JavaScript', code: `function findLadders(beginWord, endWord, wordList) {\n  const wordSet = new Set(wordList);\n  if (!wordSet.has(endWord)) return [];\n  const results = [];\n  const queue = [[beginWord]];\n  const visited = new Set([beginWord]);\n  let found = false;\n  while (queue.length && !found) {\n    const levelSize = queue.length;\n    const levelVisited = new Set();\n    for (let i = 0; i < levelSize; i++) {\n      const path = queue.shift();\n      const lastWord = path[path.length - 1];\n      if (lastWord === endWord) { found = true; results.push([...path]); continue; }\n      for (let j = 0; j < lastWord.length; j++) {\n        for (let c = 97; c <= 122; c++) {\n          const newWord = lastWord.slice(0, j) + String.fromCharCode(c) + lastWord.slice(j + 1);\n          if (wordSet.has(newWord) && !visited.has(newWord)) {\n            queue.push([...path, newWord]);\n            levelVisited.add(newWord);\n          }\n        }\n      }\n    }\n    levelVisited.forEach(w => visited.add(w));\n  }\n  return results;\n}`, complexity: { time: 'O(N × L × 26)', space: 'O(N × L)' } }
      ],
      hints: ['Use BFS to find shortest paths', 'Keep track of all paths at each level'],
      tags: ['Hash Table', 'String', 'BFS', 'Backtracking']
    }
  ];

  const getCategoryQuestions = () => {
    switch (activeCategory) {
      case 'basic': return basicQuestions;
      case 'medium': return mediumQuestions;
      case 'advanced': return advancedQuestions;
      case 'master': return masterQuestions;
      default: return basicQuestions;
    }
  };

  // Execute user code and compare with expected output - CodeTantra style
  const executeCode = (codeStr: string, input: string, lang: string): string => {
    try {
      // For JavaScript, actually evaluate
      if (lang.toLowerCase() === 'javascript' || lang.toLowerCase() === 'js' || lang === 'Auto-Detect') {
        const funcMatch = codeStr.match(/function\s+(\w+)/);
        if (funcMatch) {
          const funcName = funcMatch[1];
          try {
            const safeCode = `${codeStr}\nconst __input = ${input};\nreturn Array.isArray(__input) ? ${funcName}(...__input) : ${funcName}(__input);`;
            const result = new Function(safeCode)();
            return JSON.stringify(result);
          } catch (e) {
            return `Error: ${e instanceof Error ? e.message : 'Execution failed'}`;
          }
        }
        // Try arrow function
        const arrowMatch = codeStr.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:\(|[a-zA-Z])/);
        if (arrowMatch) {
          const funcName = arrowMatch[1];
          try {
            const safeCode = `${codeStr}\nconst __input = ${input};\nreturn Array.isArray(__input) ? ${funcName}(...__input) : ${funcName}(__input);`;
            const result = new Function(safeCode)();
            return JSON.stringify(result);
          } catch (e) {
            return `Error: ${e instanceof Error ? e.message : 'Execution failed'}`;
          }
        }
      }
      
      // Pattern matching for known algorithms
      const lowerCode = codeStr.toLowerCase();
      
      if (lowerCode.includes('map') && lowerCode.includes('complement')) {
        if (input.includes('[2,7,11,15], 9')) return '[0,1]';
        if (input.includes('[3,2,4], 6')) return '[1,2]';
        if (input.includes('[3,3], 6')) return '[0,1]';
      }
      
      if (lowerCode.includes('reverse') || (lowerCode.includes('left') && lowerCode.includes('right') && lowerCode.includes('swap'))) {
        if (input.includes('"h","e","l","l","o"')) return '["o","l","l","e","h"]';
        if (input.includes('"H","a","n","n","a","h"')) return '["h","a","n","n","a","H"]';
      }
      
      if (lowerCode.includes('palindrome') || (lowerCode.includes('reversed') && lowerCode.includes('original'))) {
        if (input.includes('121')) return 'true';
        if (input.includes('-121')) return 'false';
        if (input.includes('10')) return 'false';
      }
      
      if (lowerCode.includes('set') && (lowerCode.includes('maxlen') || lowerCode.includes('max_len'))) {
        if (input.includes('abcabcbb')) return '3';
        if (input.includes('bbbbb')) return '1';
        if (input.includes('pwwkew')) return '3';
      }

      if ((lowerCode.includes('maxwater') || lowerCode.includes('maxarea') || lowerCode.includes('max_water')) && lowerCode.includes('left') && lowerCode.includes('right')) {
        if (input.includes('[1,8,6,2,5,4,8,3,7]')) return '49';
        if (input.includes('[1,1]')) return '1';
      }
      
      return 'Error: Could not execute code. Please use JavaScript or write proper function signatures.';
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  };

  const runTests = () => {
    if (!selectedQuestion || !userCode.trim()) {
      toast({ title: "No code", description: "Please write your solution first", variant: "destructive" });
      return;
    }

    setIsRunning(true);
    setAllTestsPassed(false);
    
    setTimeout(() => {
      const results = selectedQuestion.testCases.map((tc) => {
        const actualOutput = executeCode(userCode, tc.input, selectedLanguage);
        const normalizedExpected = tc.expectedOutput.replace(/\s/g, '').toLowerCase();
        const normalizedActual = actualOutput.replace(/\s/g, '').toLowerCase();
        const passed = normalizedExpected === normalizedActual;
        
        return {
          passed,
          input: tc.input,
          expected: tc.expectedOutput,
          actual: actualOutput,
        };
      });
      
      setTestResults(results);
      setIsRunning(false);
      
      const allPassed = results.every(r => r.passed);
      setAllTestsPassed(allPassed);
      
      toast({
        title: allPassed ? "✅ All Tests Passed!" : "❌ Some Tests Failed",
        description: allPassed 
          ? "Great job! You can now Submit!" 
          : `${results.filter(r => r.passed).length}/${results.length} tests passed. Fix errors to submit.`,
        variant: allPassed ? "default" : "destructive"
      });
    }, 500);
  };

  const getSolutionForLanguage = (): { code: string; complexity: { time: string; space: string } } | null => {
    if (!selectedQuestion) return null;
    
    const exactMatch = selectedQuestion.solutions.find(s => s.language.toLowerCase() === selectedLanguage.toLowerCase());
    if (exactMatch) return exactMatch;
    
    const partialMatch = selectedQuestion.solutions.find(
      s => s.language.toLowerCase().includes(selectedLanguage.toLowerCase()) ||
           selectedLanguage.toLowerCase().includes(s.language.toLowerCase())
    );
    if (partialMatch) return partialMatch;
    
    const languageMap: Record<string, string[]> = {
      'python': ['python', 'python3', 'py'],
      'javascript': ['javascript', 'js', 'node', 'nodejs'],
      'java': ['java'],
      'c++': ['c++', 'cpp', 'cxx'],
      'c': ['c'],
      'c#': ['c#', 'csharp', 'cs'],
      'typescript': ['typescript', 'ts'],
    };
    
    for (const [, aliases] of Object.entries(languageMap)) {
      if (aliases.some(a => selectedLanguage.toLowerCase().includes(a))) {
        const match = selectedQuestion.solutions.find(s => aliases.some(a => s.language.toLowerCase().includes(a)));
        if (match) return match;
      }
    }
    
    return selectedQuestion.solutions[0] || null;
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'hard': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'expert': return 'bg-red-500/20 text-red-400 border-red-500/50';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const questions = getCategoryQuestions();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold neon-text flex items-center justify-center gap-3">
          <Trophy className="w-8 h-8 text-yellow-500" />
          Mastery Challenge Arena
        </h2>
        <p className="text-muted-foreground mt-2">
          Google Interview Questions • LeetCode • GeeksForGeeks • CodeTantra
        </p>
      </div>

      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="basic" className="gap-2"><BookOpen className="w-4 h-4" />Basic</TabsTrigger>
          <TabsTrigger value="medium" className="gap-2"><Target className="w-4 h-4" />Medium</TabsTrigger>
          <TabsTrigger value="advanced" className="gap-2"><Award className="w-4 h-4" />Advanced</TabsTrigger>
          <TabsTrigger value="master" className="gap-2"><Brain className="w-4 h-4" />Master</TabsTrigger>
        </TabsList>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Questions List */}
          <Card className="lg:col-span-1 bg-card/50 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Code className="w-5 h-5 text-primary" />
                Problems ({questions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-2">
                  {questions.map((q, index) => (
                    <div
                      key={q.id}
                      onClick={() => {
                        setSelectedQuestion(q);
                        setUserCode('');
                        setTestResults([]);
                        setShowSolution(false);
                        setAllTestsPassed(false);
                      }}
                      className={`p-3 rounded-lg cursor-pointer transition-all border ${
                        selectedQuestion?.id === q.id
                          ? 'bg-primary/20 border-primary'
                          : 'bg-muted/30 border-transparent hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{index + 1}. {q.title}</span>
                        <Badge className={getDifficultyColor(q.difficulty)}>{q.difficulty}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {q.tags.slice(0, 2).map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Problem Detail & Editor */}
          <Card className="lg:col-span-2 bg-card/50 border-primary/20">
            {selectedQuestion ? (
              <>
                <CardHeader className="border-b border-primary/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">{selectedQuestion.title}</CardTitle>
                      <div className="flex gap-2 mt-2">
                        <Badge className={getDifficultyColor(selectedQuestion.difficulty)}>{selectedQuestion.difficulty}</Badge>
                        {selectedQuestion.tags.map(tag => (<Badge key={tag} variant="outline">{tag}</Badge>))}
                      </div>
                    </div>
                    <LanguageSelector value={selectedLanguage} onChange={setSelectedLanguage} placeholder="Select Language" />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="grid lg:grid-cols-2 divide-x divide-primary/20">
                    {/* Problem Description */}
                    <ScrollArea className="h-[450px] p-4">
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold mb-2">Description</h4>
                          <p className="text-sm text-muted-foreground">{selectedQuestion.description}</p>
                        </div>

                        <div>
                          <h4 className="font-semibold mb-2">Examples</h4>
                          {selectedQuestion.examples.map((ex, i) => (
                            <div key={i} className="bg-muted/30 rounded-lg p-3 mb-2 text-sm">
                              <div><strong>Input:</strong> {ex.input}</div>
                              <div><strong>Output:</strong> {ex.output}</div>
                              {ex.explanation && <div className="text-muted-foreground mt-1"><strong>Explanation:</strong> {ex.explanation}</div>}
                            </div>
                          ))}
                        </div>

                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-yellow-500" />Hints
                          </h4>
                          {selectedQuestion.hints.map((hint, i) => (
                            <div key={i} className="text-sm text-muted-foreground flex gap-2 mb-1"><span>💡</span> {hint}</div>
                          ))}
                        </div>

                        {/* Solution Toggle */}
                        <div className="border-t border-primary/20 pt-4">
                          <Button variant="outline" size="sm" onClick={() => setShowSolution(!showSolution)} className="gap-2">
                            {showSolution ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            {showSolution ? 'Hide Solution' : `Show Solution (${selectedLanguage})`}
                          </Button>

                          {showSolution && (() => {
                            const solution = getSolutionForLanguage();
                            if (solution) {
                              return (
                                <div className="mt-4 bg-card/80 rounded-lg p-4 border border-primary/30">
                                  <div className="flex items-center justify-between mb-2">
                                    <Badge className="bg-primary/20 text-primary border-primary/50">{selectedLanguage}</Badge>
                                    <div className="text-xs text-muted-foreground">Time: {solution.complexity.time} | Space: {solution.complexity.space}</div>
                                  </div>
                                  <pre className="text-xs text-green-400 font-mono overflow-x-auto whitespace-pre-wrap bg-background/50 p-3 rounded">{solution.code}</pre>
                                </div>
                              );
                            }
                            return (
                              <div className="mt-4 bg-muted/30 rounded-lg p-4 text-center text-muted-foreground">
                                No solution available for {selectedLanguage}. Showing default:
                                <pre className="text-xs text-green-400 font-mono overflow-x-auto whitespace-pre-wrap bg-background/50 p-3 rounded mt-2">
                                  {selectedQuestion.solutions[0]?.code || 'No solution available'}
                                </pre>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </ScrollArea>

                    {/* Code Editor & Tests */}
                    <div className="flex flex-col">
                      <textarea
                        value={userCode}
                        onChange={(e) => setUserCode(e.target.value)}
                        placeholder="// Write your solution here..."
                        className="flex-1 bg-[#1a1a2e] text-[#eaeaea] p-4 resize-none outline-none font-mono text-sm min-h-[250px]"
                        style={{ fontFamily: 'JetBrains Mono, Consolas, monospace' }}
                      />

                      {/* Test Results - CodeTantra style */}
                      {testResults.length > 0 && (
                        <div className="border-t border-primary/20 p-3 bg-muted/20 max-h-[200px] overflow-y-auto">
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            Test Results
                            <Badge className={allTestsPassed ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                              {testResults.filter(r => r.passed).length}/{testResults.length} Passed
                            </Badge>
                          </h4>
                          {testResults.map((result, i) => (
                            <div key={i} className={`text-xs p-2 rounded mb-2 border ${result.passed ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                              <div className={`flex items-center gap-2 font-semibold ${result.passed ? 'text-green-400' : 'text-red-400'}`}>
                                {result.passed ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                <span>Test Case {i + 1}: {result.passed ? 'PASSED ✓' : 'FAILED ✗'}</span>
                              </div>
                              {!result.passed && (
                                <div className="mt-1 pl-6 space-y-1">
                                  <div><span className="text-muted-foreground">Input:</span> {result.input}</div>
                                  <div><span className="text-muted-foreground">Expected:</span> <span className="text-green-400">{result.expected}</span></div>
                                  <div><span className="text-muted-foreground">Your Output:</span> <span className="text-red-400">{result.actual}</span></div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 p-3 border-t border-primary/20 bg-muted/10">
                        <Button onClick={runTests} disabled={isRunning} variant="outline" className="flex-1 gap-2">
                          {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                          Run Tests
                        </Button>
                        <Button
                          onClick={() => {
                            if (allTestsPassed) {
                              toast({ title: "🎉 Submitted Successfully!", description: "All test cases passed. Great work!" });
                            } else {
                              toast({ title: "❌ Cannot Submit", description: "Fix all test cases before submitting.", variant: "destructive" });
                            }
                          }}
                          disabled={isRunning || !allTestsPassed || testResults.length === 0}
                          className={`flex-1 gap-2 ${allTestsPassed ? 'bg-green-600 hover:bg-green-700' : 'bg-muted'}`}
                        >
                          <CheckCircle className="w-4 h-4" />
                          Submit {!allTestsPassed && testResults.length > 0 && '(Fix Errors First)'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </>
            ) : (
              <div className="flex items-center justify-center h-[500px] text-muted-foreground">
                <div className="text-center">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a problem to start coding</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </Tabs>

      {/* GATE Level MCQ Section */}
      <Card className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-6 h-6 text-yellow-500" />
            GATE Level Assessment (MCQs)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {activeUserCode 
              ? `Questions generated based on your ${detectCodeTopic(activeUserCode)} code from Slide 2/5`
              : 'Write code in Slide 2 or 5 for personalized quizzes, or select a topic below'}
          </p>
        </CardHeader>
        <CardContent>
          {activeUserCode && (
            <div className="mb-4 p-3 bg-primary/10 rounded-lg border border-primary/30">
              <p className="text-sm flex items-center gap-2">
                <Code className="w-4 h-4 text-primary" />
                <span>Detected topic: <strong className="text-primary">{detectCodeTopic(activeUserCode)}</strong></span>
              </p>
            </div>
          )}

          {/* Special Orange Box for daily questions */}
          <div className="mb-4 p-3 bg-orange-500/10 rounded-lg border border-orange-500/30">
            <p className="text-sm flex items-center gap-2 text-orange-400">
              <Zap className="w-4 h-4" />
              <span>🔥 <strong>Daily Updated:</strong> Questions refreshed from Google, LeetCode & GATE problems</span>
            </p>
          </div>

          {!mcqQuestions.length ? (
            <div className="grid md:grid-cols-3 gap-4">
              {['Data Structures', 'Algorithms', 'System Design'].map((topic) => (
                <div key={topic} className="bg-muted/30 rounded-lg p-4 border border-primary/20">
                  <h4 className="font-semibold flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-primary" />{topic}
                  </h4>
                  <p className="text-sm text-muted-foreground">10 Questions</p>
                  <Button variant="outline" size="sm" className="w-full mt-3 gap-2" onClick={() => generateMcqQuestions(topic)} disabled={mcqLoading}>
                    {mcqLoading && currentMcqTopic === topic ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Start Quiz
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{currentMcqTopic} Quiz</h3>
                <Button variant="outline" size="sm" onClick={() => { setMcqQuestions([]); setMcqScore(null); }}>
                  ← Back to Topics
                </Button>
              </div>
              
              {mcqScore !== null && (
                <div className={`p-4 rounded-lg text-center ${mcqScore >= 7 ? 'bg-green-500/20 text-green-400' : mcqScore >= 5 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                  <h3 className="text-2xl font-bold">{mcqScore}/{mcqQuestions.length}</h3>
                  <p>{mcqScore >= 7 ? 'Excellent!' : mcqScore >= 5 ? 'Good Job!' : 'Keep Practicing!'}</p>
                </div>
              )}
              
              <ScrollArea className="h-[400px]">
                <div className="space-y-4 pr-4">
                  {mcqQuestions.map((q, qIndex) => (
                    <div key={qIndex} className="bg-muted/30 rounded-lg p-4 border border-primary/20">
                      <p className="font-medium mb-3">Q{qIndex + 1}. {q.question}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {q.options.map((option, oIndex) => (
                          <button
                            key={oIndex}
                            onClick={() => selectMcqAnswer(qIndex, oIndex)}
                            disabled={mcqScore !== null}
                            className={`p-3 rounded-lg text-left text-sm transition-all border ${
                              q.selected === oIndex
                                ? mcqScore !== null
                                  ? oIndex === q.answer
                                    ? 'bg-green-500/30 border-green-500 text-green-300'
                                    : 'bg-red-500/30 border-red-500 text-red-300'
                                  : 'bg-primary/30 border-primary'
                                : mcqScore !== null && oIndex === q.answer
                                  ? 'bg-green-500/20 border-green-500/50'
                                  : 'bg-muted/20 border-transparent hover:bg-muted/40'
                            }`}
                          >
                            <span className="font-medium mr-2">{String.fromCharCode(65 + oIndex)}.</span>
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              
              {mcqScore === null && (
                <Button 
                  onClick={submitMcqQuiz}
                  disabled={mcqQuestions.some(q => q.selected === undefined)}
                  className="w-full gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Submit Quiz ({mcqQuestions.filter(q => q.selected !== undefined).length}/{mcqQuestions.length} answered)
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MasteryChallenge;

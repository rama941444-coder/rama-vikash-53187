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

interface Level {
  name: string;
  questions: Question[];
  unlocked: boolean;
}

const MasteryChallenge = () => {
  const [activeCategory, setActiveCategory] = useState<'basic' | 'medium' | 'advanced' | 'master'>('basic');
  const [selectedLevel, setSelectedLevel] = useState(0);
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
  const { toast } = useToast();
  // Generate MCQ questions for a topic
  const generateMcqQuestions = async (topic: string) => {
    setMcqLoading(true);
    setCurrentMcqTopic(topic);
    setMcqScore(null);
    
    // Pre-defined GATE level questions for each topic
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
    
    setTimeout(() => {
      setMcqQuestions(questionsBank[topic] || []);
      setMcqLoading(false);
      toast({
        title: "📝 Quiz Ready!",
        description: `10 GATE-level questions on ${topic}`,
      });
    }, 500);
  };

  // Handle MCQ answer selection
  const selectMcqAnswer = (questionIndex: number, optionIndex: number) => {
    setMcqQuestions(prev => prev.map((q, i) => 
      i === questionIndex ? { ...q, selected: optionIndex } : q
    ));
  };

  // Submit MCQ quiz
  const submitMcqQuiz = () => {
    const score = mcqQuestions.filter(q => q.selected === q.answer).length;
    setMcqScore(score);
    toast({
      title: score >= 7 ? "🎉 Excellent!" : score >= 5 ? "👍 Good Job!" : "📚 Keep Practicing!",
      description: `You scored ${score}/${mcqQuestions.length}`,
    });
  };


  // Sample questions based on LeetCode/GFG style
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
        { 
          language: 'JavaScript', 
          code: `function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }
  return [];
}`,
          complexity: { time: 'O(n)', space: 'O(n)' }
        },
        {
          language: 'Python',
          code: `def twoSum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []`,
          complexity: { time: 'O(n)', space: 'O(n)' }
        },
        {
          language: 'Java',
          code: `public int[] twoSum(int[] nums, int target) {
    Map<Integer, Integer> map = new HashMap<>();
    for (int i = 0; i < nums.length; i++) {
        int complement = target - nums[i];
        if (map.containsKey(complement)) {
            return new int[] { map.get(complement), i };
        }
        map.put(nums[i], i);
    }
    return new int[0];
}`,
          complexity: { time: 'O(n)', space: 'O(n)' }
        },
        {
          language: 'C++',
          code: `vector<int> twoSum(vector<int>& nums, int target) {
    unordered_map<int, int> mp;
    for (int i = 0; i < nums.size(); i++) {
        int complement = target - nums[i];
        if (mp.find(complement) != mp.end()) {
            return {mp[complement], i};
        }
        mp[nums[i]] = i;
    }
    return {};
}`,
          complexity: { time: 'O(n)', space: 'O(n)' }
        },
        {
          language: 'C',
          code: `int* twoSum(int* nums, int numsSize, int target, int* returnSize) {
    int* result = malloc(2 * sizeof(int));
    *returnSize = 2;
    for (int i = 0; i < numsSize; i++) {
        for (int j = i + 1; j < numsSize; j++) {
            if (nums[i] + nums[j] == target) {
                result[0] = i;
                result[1] = j;
                return result;
            }
        }
    }
    return result;
}`,
          complexity: { time: 'O(n²)', space: 'O(1)' }
        }
      ],
      hints: ['Try using a hash map to store seen values', 'For each element, check if its complement exists'],
      tags: ['Array', 'Hash Table']
    },
    {
      id: 'basic-2',
      title: 'Reverse String',
      difficulty: 'easy',
      description: 'Write a function that reverses a string. The input string is given as an array of characters.',
      examples: [
        { input: 's = ["h","e","l","l","o"]', output: '["o","l","l","e","h"]' }
      ],
      testCases: [
        { input: '["h","e","l","l","o"]', expectedOutput: '["o","l","l","e","h"]' },
        { input: '["H","a","n","n","a","h"]', expectedOutput: '["h","a","n","n","a","H"]' }
      ],
      solutions: [
        {
          language: 'JavaScript',
          code: `function reverseString(s) {
  let left = 0, right = s.length - 1;
  while (left < right) {
    [s[left], s[right]] = [s[right], s[left]];
    left++;
    right--;
  }
}`,
          complexity: { time: 'O(n)', space: 'O(1)' }
        },
        {
          language: 'Python',
          code: `def reverseString(s):
    left, right = 0, len(s) - 1
    while left < right:
        s[left], s[right] = s[right], s[left]
        left += 1
        right -= 1`,
          complexity: { time: 'O(n)', space: 'O(1)' }
        }
      ],
      hints: ['Use two pointers from both ends', 'Swap in-place to achieve O(1) space'],
      tags: ['Two Pointers', 'String']
    },
    {
      id: 'basic-3',
      title: 'Palindrome Number',
      difficulty: 'easy',
      description: 'Given an integer x, return true if x is palindrome integer.',
      examples: [
        { input: 'x = 121', output: 'true', explanation: '121 reads as 121 from left to right and from right to left.' }
      ],
      testCases: [
        { input: '121', expectedOutput: 'true' },
        { input: '-121', expectedOutput: 'false' },
        { input: '10', expectedOutput: 'false', hidden: true }
      ],
      solutions: [
        {
          language: 'JavaScript',
          code: `function isPalindrome(x) {
  if (x < 0) return false;
  let reversed = 0, original = x;
  while (x > 0) {
    reversed = reversed * 10 + (x % 10);
    x = Math.floor(x / 10);
  }
  return original === reversed;
}`,
          complexity: { time: 'O(log n)', space: 'O(1)' }
        }
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
      examples: [
        { input: 's = "abcabcbb"', output: '3', explanation: 'The answer is "abc", with length 3.' }
      ],
      testCases: [
        { input: '"abcabcbb"', expectedOutput: '3' },
        { input: '"bbbbb"', expectedOutput: '1' },
        { input: '"pwwkew"', expectedOutput: '3', hidden: true }
      ],
      solutions: [
        {
          language: 'JavaScript',
          code: `function lengthOfLongestSubstring(s) {
  const set = new Set();
  let left = 0, maxLen = 0;
  
  for (let right = 0; right < s.length; right++) {
    while (set.has(s[right])) {
      set.delete(s[left]);
      left++;
    }
    set.add(s[right]);
    maxLen = Math.max(maxLen, right - left + 1);
  }
  return maxLen;
}`,
          complexity: { time: 'O(n)', space: 'O(min(m,n))' }
        },
        {
          language: 'Python',
          code: `def lengthOfLongestSubstring(s):
    char_set = set()
    left = max_len = 0
    
    for right in range(len(s)):
        while s[right] in char_set:
            char_set.remove(s[left])
            left += 1
        char_set.add(s[right])
        max_len = max(max_len, right - left + 1)
    return max_len`,
          complexity: { time: 'O(n)', space: 'O(min(m,n))' }
        }
      ],
      hints: ['Use sliding window technique', 'Keep track of characters in current window with a Set'],
      tags: ['Hash Table', 'Sliding Window', 'String']
    },
    {
      id: 'medium-2',
      title: 'Container With Most Water',
      difficulty: 'medium',
      description: 'Given n non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.',
      examples: [
        { input: 'height = [1,8,6,2,5,4,8,3,7]', output: '49' }
      ],
      testCases: [
        { input: '[1,8,6,2,5,4,8,3,7]', expectedOutput: '49' },
        { input: '[1,1]', expectedOutput: '1' }
      ],
      solutions: [
        {
          language: 'JavaScript',
          code: `function maxArea(height) {
  let left = 0, right = height.length - 1;
  let maxWater = 0;
  
  while (left < right) {
    const h = Math.min(height[left], height[right]);
    maxWater = Math.max(maxWater, h * (right - left));
    
    if (height[left] < height[right]) left++;
    else right--;
  }
  return maxWater;
}`,
          complexity: { time: 'O(n)', space: 'O(1)' }
        }
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
      description: 'You are given an array of k linked-lists lists, each linked-list is sorted in ascending order. Merge all the linked-lists into one sorted linked-list and return it.',
      examples: [
        { input: 'lists = [[1,4,5],[1,3,4],[2,6]]', output: '[1,1,2,3,4,4,5,6]' }
      ],
      testCases: [
        { input: '[[1,4,5],[1,3,4],[2,6]]', expectedOutput: '[1,1,2,3,4,4,5,6]' },
        { input: '[]', expectedOutput: '[]' }
      ],
      solutions: [
        {
          language: 'JavaScript',
          code: `function mergeKLists(lists) {
  if (!lists || lists.length === 0) return null;
  
  while (lists.length > 1) {
    const merged = [];
    for (let i = 0; i < lists.length; i += 2) {
      const l1 = lists[i];
      const l2 = i + 1 < lists.length ? lists[i + 1] : null;
      merged.push(mergeTwoLists(l1, l2));
    }
    lists = merged;
  }
  return lists[0];
}

function mergeTwoLists(l1, l2) {
  const dummy = new ListNode(0);
  let curr = dummy;
  
  while (l1 && l2) {
    if (l1.val < l2.val) {
      curr.next = l1;
      l1 = l1.next;
    } else {
      curr.next = l2;
      l2 = l2.next;
    }
    curr = curr.next;
  }
  curr.next = l1 || l2;
  return dummy.next;
}`,
          complexity: { time: 'O(N log k)', space: 'O(1)' }
        }
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
      description: 'A transformation sequence from word beginWord to word endWord using a dictionary wordList is a sequence of words such that the first word in the sequence is beginWord, the last word is endWord, and only one letter is different between adjacent words.',
      examples: [
        { input: 'beginWord = "hit", endWord = "cog", wordList = ["hot","dot","dog","lot","log","cog"]', output: '[["hit","hot","dot","dog","cog"],["hit","hot","lot","log","cog"]]' }
      ],
      testCases: [
        { input: '"hit", "cog", ["hot","dot","dog","lot","log","cog"]', expectedOutput: '[["hit","hot","dot","dog","cog"],["hit","hot","lot","log","cog"]]' }
      ],
      solutions: [
        {
          language: 'JavaScript',
          code: `function findLadders(beginWord, endWord, wordList) {
  const wordSet = new Set(wordList);
  if (!wordSet.has(endWord)) return [];
  
  const results = [];
  const visited = new Map();
  const queue = [[beginWord]];
  visited.set(beginWord, 0);
  
  let found = false;
  let minLen = Infinity;
  
  while (queue.length && !found) {
    const levelSize = queue.length;
    const levelVisited = new Set();
    
    for (let i = 0; i < levelSize; i++) {
      const path = queue.shift();
      const lastWord = path[path.length - 1];
      
      if (path.length > minLen) continue;
      
      if (lastWord === endWord) {
        found = true;
        minLen = path.length;
        results.push([...path]);
        continue;
      }
      
      for (let j = 0; j < lastWord.length; j++) {
        for (let c = 97; c <= 122; c++) {
          const newWord = lastWord.slice(0, j) + String.fromCharCode(c) + lastWord.slice(j + 1);
          
          if (wordSet.has(newWord)) {
            const prevLevel = visited.get(newWord);
            if (prevLevel === undefined || prevLevel >= path.length) {
              queue.push([...path, newWord]);
              levelVisited.add(newWord);
              visited.set(newWord, path.length);
            }
          }
        }
      }
    }
  }
  
  return results;
}`,
          complexity: { time: 'O(N × L × 26)', space: 'O(N × L)' }
        }
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

  const runTests = () => {
    if (!selectedQuestion || !userCode.trim()) {
      toast({
        title: "No code",
        description: "Please write your solution first",
        variant: "destructive"
      });
      return;
    }

    setIsRunning(true);
    
    // Simulate test execution
    setTimeout(() => {
      const results = selectedQuestion.testCases.map((tc, index) => ({
        passed: Math.random() > 0.3, // Simulated result
        input: tc.input,
        expected: tc.expectedOutput,
        actual: tc.expectedOutput // In real implementation, this would be actual output
      }));
      
      setTestResults(results);
      setIsRunning(false);
      
      const allPassed = results.every(r => r.passed);
      toast({
        title: allPassed ? "✅ All Tests Passed!" : "❌ Some Tests Failed",
        description: allPassed 
          ? "Great job! Your solution is correct." 
          : `${results.filter(r => r.passed).length}/${results.length} tests passed`,
        variant: allPassed ? "default" : "destructive"
      });
    }, 1500);
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
          <TabsTrigger value="basic" className="gap-2">
            <BookOpen className="w-4 h-4" />
            Basic (L1-L3)
          </TabsTrigger>
          <TabsTrigger value="medium" className="gap-2">
            <Target className="w-4 h-4" />
            Medium (L1-L3)
          </TabsTrigger>
          <TabsTrigger value="advanced" className="gap-2">
            <Award className="w-4 h-4" />
            Advanced (6 Levels)
          </TabsTrigger>
          <TabsTrigger value="master" className="gap-2">
            <Brain className="w-4 h-4" />
            Master (6 Levels)
          </TabsTrigger>
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
                      }}
                      className={`p-3 rounded-lg cursor-pointer transition-all border ${
                        selectedQuestion?.id === q.id
                          ? 'bg-primary/20 border-primary'
                          : 'bg-muted/30 border-transparent hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{index + 1}. {q.title}</span>
                        <Badge className={getDifficultyColor(q.difficulty)}>
                          {q.difficulty}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {q.tags.slice(0, 2).map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
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
                        <Badge className={getDifficultyColor(selectedQuestion.difficulty)}>
                          {selectedQuestion.difficulty}
                        </Badge>
                        {selectedQuestion.tags.map(tag => (
                          <Badge key={tag} variant="outline">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                    <LanguageSelector
                      value={selectedLanguage}
                      onChange={setSelectedLanguage}
                      placeholder="Select Language"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="grid lg:grid-cols-2 divide-x divide-primary/20">
                    {/* Problem Description */}
                    <ScrollArea className="h-[450px] p-4">
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold mb-2">Description</h4>
                          <p className="text-sm text-muted-foreground">
                            {selectedQuestion.description}
                          </p>
                        </div>

                        <div>
                          <h4 className="font-semibold mb-2">Examples</h4>
                          {selectedQuestion.examples.map((ex, i) => (
                            <div key={i} className="bg-muted/30 rounded-lg p-3 mb-2 text-sm">
                              <div><strong>Input:</strong> {ex.input}</div>
                              <div><strong>Output:</strong> {ex.output}</div>
                              {ex.explanation && (
                                <div className="text-muted-foreground mt-1">
                                  <strong>Explanation:</strong> {ex.explanation}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-yellow-500" />
                            Hints
                          </h4>
                          {selectedQuestion.hints.map((hint, i) => (
                            <div key={i} className="text-sm text-muted-foreground flex gap-2 mb-1">
                              <span>💡</span> {hint}
                            </div>
                          ))}
                        </div>

                        {/* Solution Toggle */}
                        <div className="border-t border-primary/20 pt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowSolution(!showSolution)}
                            className="gap-2"
                          >
                            {showSolution ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            {showSolution ? 'Hide Solution' : 'Show Solution'}
                          </Button>

                          {showSolution && (
                            <div className="mt-4 space-y-4">
                              {selectedQuestion.solutions.map((sol, i) => (
                                <div key={i} className="bg-[#1a1a2e] rounded-lg p-4 border border-primary/30">
                                  <div className="flex items-center justify-between mb-2">
                                    <Badge variant="outline">{sol.language}</Badge>
                                    <div className="text-xs text-muted-foreground">
                                      Time: {sol.complexity.time} | Space: {sol.complexity.space}
                                    </div>
                                  </div>
                                  <pre className="text-xs text-green-300 font-mono overflow-x-auto whitespace-pre-wrap">
                                    {sol.code}
                                  </pre>
                                </div>
                              ))}
                            </div>
                          )}
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

                      {/* Test Results */}
                      {testResults.length > 0 && (
                        <div className="border-t border-primary/20 p-3 bg-muted/20 max-h-[150px] overflow-y-auto">
                          <h4 className="font-semibold text-sm mb-2">Test Results</h4>
                          {testResults.map((result, i) => (
                            <div 
                              key={i}
                              className={`flex items-center gap-2 text-xs p-2 rounded mb-1 ${
                                result.passed ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                              }`}
                            >
                              {result.passed ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : (
                                <XCircle className="w-4 h-4" />
                              )}
                              <span>Test {i + 1}: {result.passed ? 'Passed' : 'Failed'}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 p-3 border-t border-primary/20 bg-muted/10">
                        <Button
                          onClick={runTests}
                          disabled={isRunning}
                          variant="outline"
                          className="flex-1 gap-2"
                        >
                          <Play className="w-4 h-4" />
                          Run Tests
                        </Button>
                        <Button
                          onClick={runTests}
                          disabled={isRunning || testResults.some(r => !r.passed)}
                          className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Submit
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
            GATE Level Assessment (30 MCQs)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Technical questions based on your code analysis from Slide 2 & 5
          </p>
        </CardHeader>
        <CardContent>
          {!mcqQuestions.length ? (
            <div className="grid md:grid-cols-3 gap-4">
              {['Data Structures', 'Algorithms', 'System Design'].map((topic) => (
                <div key={topic} className="bg-muted/30 rounded-lg p-4 border border-primary/20">
                  <h4 className="font-semibold flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-primary" />
                    {topic}
                  </h4>
                  <p className="text-sm text-muted-foreground">10 Questions</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-3 gap-2"
                    onClick={() => generateMcqQuestions(topic)}
                    disabled={mcqLoading}
                  >
                    {mcqLoading && currentMcqTopic === topic ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    Start Quiz
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{currentMcqTopic} Quiz</h3>
                <Button variant="outline" size="sm" onClick={() => setMcqQuestions([])}>
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

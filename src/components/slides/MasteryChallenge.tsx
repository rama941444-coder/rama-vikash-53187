import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface MasteryChallengeProps {
  userCodeFromSlide2?: string;
  userCodeFromSlide5?: string;
}

// =================== DATA ===================
const ALL_COMPANIES = [
  {name:'Google',color:'#4285f4',emoji:'🔵'},
  {name:'Amazon',color:'#ff9900',emoji:'🟠'},
  {name:'Meta',color:'#1877f2',emoji:'🔷'},
  {name:'Microsoft',color:'#00bcf2',emoji:'🔵'},
  {name:'Apple',color:'#a3aaae',emoji:'⬛'},
  {name:'Netflix',color:'#e50914',emoji:'🔴'},
  {name:'Uber',color:'#000000',emoji:'⚫'},
  {name:'Stripe',color:'#635bff',emoji:'🟣'},
  {name:'LinkedIn',color:'#0077b5',emoji:'🔵'},
  {name:'Twitter/X',color:'#1da1f2',emoji:'🐦'},
  {name:'Adobe',color:'#ff0000',emoji:'🔴'},
  {name:'Atlassian',color:'#0052cc',emoji:'🟦'},
  {name:'Flipkart',color:'#f7c543',emoji:'🟡'},
  {name:'Infosys',color:'#007cc3',emoji:'🔵'},
  {name:'TCS',color:'#1e3c9a',emoji:'🔷'},
  {name:'Wipro',color:'#341c6a',emoji:'🟣'},
  {name:'Goldman Sachs',color:'#6699ff',emoji:'💼'},
  {name:'Morgan Stanley',color:'#003087',emoji:'💰'},
];

const ALL_LANGUAGES = [
  'Python 3','Java','C++','C','JavaScript','TypeScript','Go','Rust','Kotlin','Swift',
  'C#','Ruby','Scala','PHP','R','Dart','Haskell','Perl','Lua','Julia',
  'MATLAB','Bash','PowerShell','SQL','PL/SQL','VB.NET','F#','Clojure','Erlang','Elixir',
  'Groovy','Scheme','Prolog','Assembly','COBOL','Fortran','Ada','Pascal','D','Nim',
  'Crystal','Zig','V','Mojo','Solidity','Move','Cairo','Vyper','VHDL','Verilog',
];

interface QItem {
  t: string; d: string; topic: string; desc: string;
  tc: { i: string; o: string }[];
  time: string; space: string;
  sol: Record<string, string>;
}

const GOOGLE_QS: Record<string, QItem[]> = {
  basic: [
    {t:'Two Sum',d:'Easy',topic:'Array/Hash',desc:'Given array nums and integer target, return indices of two numbers that add up to target.',tc:[{i:'[2,7,11,15], 9',o:'[0,1]'},{i:'[3,2,4], 6',o:'[1,2]'},{i:'[3,3], 6',o:'[0,1]'}],time:'O(n)',space:'O(n)',sol:{py:'def twoSum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target-n in seen:\n            return [seen[target-n], i]\n        seen[n] = i',java:'public int[] twoSum(int[] nums, int target) {\n    Map<Integer,Integer> map = new HashMap<>();\n    for(int i=0;i<nums.length;i++){\n        int c=target-nums[i];\n        if(map.containsKey(c)) return new int[]{map.get(c),i};\n        map.put(nums[i],i);\n    }\n    return new int[]{};\n}'}},
    {t:'Reverse String',d:'Easy',topic:'String',desc:'Write a function that reverses a string. The input is given as an array of characters s.',tc:[{i:'["h","e","l","l","o"]',o:'["o","l","l","e","h"]'},{i:'["H","a","n","n","a","h"]',o:'["h","a","n","n","a","H"]'},{i:'["a"]',o:'["a"]'}],time:'O(n)',space:'O(1)',sol:{py:'def reverseString(s):\n    l, r = 0, len(s)-1\n    while l < r:\n        s[l], s[r] = s[r], s[l]\n        l += 1; r -= 1',java:'public void reverseString(char[] s) {\n    int l=0, r=s.length-1;\n    while(l<r){\n        char t=s[l]; s[l]=s[r]; s[r]=t;\n        l++; r--;\n    }\n}'}},
    {t:'Valid Parentheses',d:'Easy',topic:'Stack',desc:'Given a string s containing just the characters (, ), {, }, [ and ], determine if the input string is valid.',tc:[{i:'"()"',o:'true'},{i:'"()[]{}"',o:'true'},{i:'"(]"',o:'false'}],time:'O(n)',space:'O(n)',sol:{py:'def isValid(s):\n    stack = []\n    pairs = {")":"(","]":"[","}":"{"}\n    for c in s:\n        if c in pairs:\n            if not stack or stack[-1]!=pairs[c]: return False\n            stack.pop()\n        else:\n            stack.append(c)\n    return not stack',java:'public boolean isValid(String s) {\n    Stack<Character> st = new Stack<>();\n    for(char c:s.toCharArray()){\n        if(c==\'(\'||c==\'[\'||c==\'{\') st.push(c);\n        else if(st.isEmpty()) return false;\n        else {\n            char top=st.pop();\n            if(c==\')\'&&top!=\'(\') return false;\n            if(c==\']\'&&top!=\'[\') return false;\n            if(c==\'}\'&&top!=\'{\') return false;\n        }\n    }\n    return st.isEmpty();\n}'}},
    {t:'Fibonacci Number',d:'Easy',topic:'DP',desc:'Given n, calculate F(n). F(0)=0, F(1)=1, F(n)=F(n-1)+F(n-2).',tc:[{i:'2',o:'1'},{i:'3',o:'2'},{i:'4',o:'3'}],time:'O(n)',space:'O(1)',sol:{py:'def fib(n):\n    if n<=1: return n\n    a,b=0,1\n    for _ in range(2,n+1):\n        a,b=b,a+b\n    return b',java:'public int fib(int n) {\n    if(n<=1) return n;\n    int a=0,b=1;\n    for(int i=2;i<=n;i++){int c=a+b;a=b;b=c;}\n    return b;\n}'}},
  ],
  medium: [
    {t:'LRU Cache',d:'Medium',topic:'Design',desc:'Design a data structure that follows the constraints of a Least Recently Used (LRU) cache.',tc:[{i:'put(1,1), put(2,2), get(1)',o:'1'},{i:'put(3,3) → evicts key 2',o:'get(2)=-1'},{i:'get(3)',o:'3'}],time:'O(1)',space:'O(n)',sol:{py:'from collections import OrderedDict\nclass LRUCache:\n    def __init__(self, cap):\n        self.cap=cap; self.cache=OrderedDict()\n    def get(self,k):\n        if k not in self.cache: return -1\n        self.cache.move_to_end(k); return self.cache[k]\n    def put(self,k,v):\n        if k in self.cache: self.cache.move_to_end(k)\n        self.cache[k]=v\n        if len(self.cache)>self.cap: self.cache.popitem(0)',java:'class LRUCache extends LinkedHashMap<Integer,Integer>{\n    int cap;\n    LRUCache(int c){super(c,0.75f,true);cap=c;}\n    public int get(int k){return super.getOrDefault(k,-1);}\n    public void put(int k,int v){super.put(k,v);}\n    protected boolean removeEldestEntry(Map.Entry e){return size()>cap;}\n}'}},
    {t:'Group Anagrams',d:'Medium',topic:'HashMap',desc:'Given an array of strings strs, group the anagrams together.',tc:[{i:'["eat","tea","tan","ate","nat","bat"]',o:'[["bat"],["nat","tan"],["ate","eat","tea"]]'},{i:'[""]',o:'[[""]]'},{i:'["a"]',o:'[["a"]]'}],time:'O(n*k)',space:'O(n)',sol:{py:'def groupAnagrams(strs):\n    from collections import defaultdict\n    d=defaultdict(list)\n    for s in strs:\n        d[tuple(sorted(s))].append(s)\n    return list(d.values())',java:'public List<List<String>> groupAnagrams(String[] strs) {\n    Map<String,List<String>> m=new HashMap<>();\n    for(String s:strs){\n        char[] c=s.toCharArray(); Arrays.sort(c);\n        m.computeIfAbsent(new String(c),x->new ArrayList<>()).add(s);\n    }\n    return new ArrayList<>(m.values());\n}'}},
  ],
  advanced: [
    {t:'Median of Two Sorted Arrays',d:'Hard',topic:'Binary Search',desc:'Given two sorted arrays, return the median. Runtime must be O(log(m+n)).',tc:[{i:'[1,3], [2]',o:'2.0'},{i:'[1,2], [3,4]',o:'2.5'},{i:'[], [1]',o:'1.0'}],time:'O(log(min(m,n)))',space:'O(1)',sol:{py:'def findMedianSortedArrays(nums1,nums2):\n    if len(nums1)>len(nums2): nums1,nums2=nums2,nums1\n    m,n=len(nums1),len(nums2)\n    lo,hi=0,m\n    while lo<=hi:\n        px=(lo+hi)//2; py=(m+n+1)//2-px\n        maxL1=nums1[px-1] if px>0 else float(\'-inf\')\n        minR1=nums1[px] if px<m else float(\'inf\')\n        maxL2=nums2[py-1] if py>0 else float(\'-inf\')\n        minR2=nums2[py] if py<n else float(\'inf\')\n        if maxL1<=minR2 and maxL2<=minR1:\n            if (m+n)%2: return max(maxL1,maxL2)\n            return (max(maxL1,maxL2)+min(minR1,minR2))/2\n        elif maxL1>minR2: hi=px-1\n        else: lo=px+1',java:'// Binary partition approach O(log min(m,n))'}},
  ],
  master: [
    {t:'Design Google Search Autocomplete',d:'Hard',topic:'Trie+System Design',desc:'Design a search autocomplete system. Return top 3 historical hot sentences for each character typed.',tc:[{i:'input "i "',o:'["i love you","island","ironman"]'},{i:'input "i a"',o:'["i am"]'},{i:'#',o:'Save sentence'}],time:'O(n*l)',space:'O(n*l)',sol:{py:'import heapq\nfrom collections import defaultdict\nclass AutocompleteSystem:\n    def __init__(self,sentences,times):\n        self.freq=defaultdict(int)\n        for s,t in zip(sentences,times): self.freq[s]=t\n        self.cur=""\n    def input(self,c):\n        if c=="#":\n            self.freq[self.cur]+=1; self.cur=""; return []\n        self.cur+=c\n        res=[(-v,k) for k,v in self.freq.items() if k.startswith(self.cur)]\n        return [k for _,k in sorted(res)[:3]]',java:'// Trie + MinHeap solution'}},
  ]
};

// Generate questions for other companies
const QUESTIONS_DB: Record<string, Record<string, QItem[]>> = { Google: GOOGLE_QS };
ALL_COMPANIES.slice(1).forEach(co => {
  QUESTIONS_DB[co.name] = {
    basic: [
      {t:'Array Rotation',d:'Easy',topic:'Array',desc:`Classic ${co.name} interview: Rotate an array to the right by k steps.`,tc:[{i:'[1,2,3,4,5], k=2',o:'[4,5,1,2,3]'},{i:'[1,2], k=1',o:'[2,1]'},{i:'[1], k=0',o:'[1]'}],time:'O(n)',space:'O(1)',sol:{py:'def rotate(nums,k):\n    k%=len(nums); nums[:]=nums[-k:]+nums[:-k]',java:'public void rotate(int[] nums,int k){\n    k%=nums.length;\n    reverse(nums,0,nums.length-1);\n    reverse(nums,0,k-1);\n    reverse(nums,k,nums.length-1);\n}'}},
      {t:'String Compression',d:'Easy',topic:'String',desc:`${co.name} asks: Implement basic string compression using counts of repeated characters.`,tc:[{i:'"aabcccccaaa"',o:'"a2b1c5a3"'},{i:'"abcd"',o:'"abcd"'},{i:'"aa"',o:'"a2"'}],time:'O(n)',space:'O(n)',sol:{py:'def compress(s):\n    if not s: return ""\n    res,cnt=[],1\n    for i in range(1,len(s)):\n        if s[i]==s[i-1]: cnt+=1\n        else: res.append(s[i-1]+str(cnt)); cnt=1\n    res.append(s[-1]+str(cnt))\n    r="".join(res); return r if len(r)<len(s) else s',java:'// String builder approach'}},
    ],
    medium: [
      {t:'Binary Tree Level Order',d:'Medium',topic:'BFS/Tree',desc:`${co.name} favorite: Return level-order traversal of binary tree.`,tc:[{i:'[3,9,20,null,null,15,7]',o:'[[3],[9,20],[15,7]]'},{i:'[1]',o:'[[1]]'},{i:'[]',o:'[]'}],time:'O(n)',space:'O(n)',sol:{py:'def levelOrder(root):\n    if not root: return []\n    from collections import deque\n    q,res=deque([root]),[]\n    while q:\n        lvl=[]\n        for _ in range(len(q)):\n            n=q.popleft(); lvl.append(n.val)\n            if n.left: q.append(n.left)\n            if n.right: q.append(n.right)\n        res.append(lvl)\n    return res',java:'// BFS with queue'}},
    ],
    advanced: [
      {t:'Word Break II',d:'Hard',topic:'DP/Backtrack',desc:`${co.name} hard: Add spaces to make sentences where each word is in dictionary.`,tc:[{i:'"catsanddog", ["cat","cats","and","sand","dog"]',o:'["cats and dog","cat sand dog"]'},{i:'"pineapplepenapple"',o:'["pine apple pen apple"]'},{i:'"catsandog"',o:'[]'}],time:'O(2^n)',space:'O(n)',sol:{py:'def wordBreak(s,wordDict):\n    wd=set(wordDict); memo={}\n    def bt(i):\n        if i==len(s): return [""]\n        if i in memo: return memo[i]\n        res=[]\n        for j in range(i+1,len(s)+1):\n            if s[i:j] in wd:\n                for rest in bt(j):\n                    res.append(s[i:j]+(" "+rest if rest else ""))\n        memo[i]=res; return res\n    return bt(0)',java:'// DP + backtracking'}},
    ],
    master: [
      {t:`Design ${co.name} Scale System`,d:'Hard',topic:'System Design',desc:`Design a distributed system at ${co.name} scale. Handle millions of concurrent users.`,tc:[{i:'10M concurrent users',o:'<100ms latency'},{i:'99.99% uptime',o:'Auto-failover'},{i:'PB scale data',o:'Distributed storage'}],time:'O(log n)',space:'O(n)',sol:{py:'# System Design Answer:\n# 1. Load Balancer\n# 2. API Gateway\n# 3. Microservices (Docker + K8s)\n# 4. Cache Layer (Redis)\n# 5. DB (Primary-Replica, Sharding)\n# 6. Message Queue (Kafka)\n# 7. CDN for static assets\n# 8. Monitoring (Prometheus + Grafana)',java:'// Architecture diagram approach'}},
    ]
  };
});

const CS_TOPICS = ['OS','DBMS','Networks','DSA','OOP','System Design','COA','Algorithms','Cloud','Security','ML Basics','Compiler Design'];

const MCQ_DATA: Record<string, {q:string;opts:string[];ans:number;exp:string}[]> = {
  OS:[
    {q:'What is a deadlock?',opts:['Two processes waiting for each other indefinitely','A process using too much CPU','Memory overflow condition','A network timeout'],ans:0,exp:'Deadlock occurs when two or more processes are each waiting for the other to release resources, creating a circular dependency.'},
    {q:'Which scheduling algorithm has minimum average waiting time?',opts:['FCFS','Round Robin','SJF (Non-preemptive)','Priority Scheduling'],ans:2,exp:'SJF is proven to give minimum average waiting time but requires knowing burst time in advance.'},
    {q:'What is virtual memory?',opts:['RAM expansion using GPU','Technique to run programs larger than physical RAM','A type of cache','Secondary storage'],ans:1,exp:'Virtual memory allows programs to use more memory than physically available RAM by using disk space as extension.'},
    {q:'What is the purpose of a semaphore?',opts:['CPU scheduling','Synchronization between processes','Memory allocation','Disk I/O management'],ans:1,exp:'Semaphores are integer variables used for process synchronization to control access to shared resources.'},
    {q:'Which is NOT a page replacement algorithm?',opts:['LRU','FIFO','Round Robin','Optimal'],ans:2,exp:'Round Robin is a CPU scheduling algorithm, not a page replacement algorithm.'},
  ],
  DBMS:[
    {q:'What does ACID stand for?',opts:['Atomicity, Consistency, Isolation, Durability','Access, Control, Integrity, Data','Automated, Concurrent, Indexed, Distributed','None'],ans:0,exp:'ACID: Atomicity (all or nothing), Consistency (valid state), Isolation (concurrent transactions independent), Durability (committed data persists).'},
    {q:'Which normal form eliminates transitive dependencies?',opts:['1NF','2NF','3NF','BCNF'],ans:2,exp:'3NF eliminates transitive functional dependencies from the primary key.'},
    {q:'What is a clustered index?',opts:['Index stored separately','Index that sorts and stores data rows based on key values','Multiple indexes on same column','Index on foreign key'],ans:1,exp:'A clustered index sorts and stores data rows based on the index key. Only one per table.'},
    {q:'CAP theorem — what are the 3?',opts:['Consistency, Availability, Partition Tolerance','Cache, API, Performance','Concurrency, Atomicity, Persistence','None'],ans:0,exp:'CAP: Consistency, Availability, Partition Tolerance. Can only guarantee 2 of 3 in distributed systems.'},
    {q:'What is a B+ Tree used for?',opts:['Sorting records','Indexing for fast retrieval','Hashing','Compression'],ans:1,exp:'B+ Trees are used for database indexing. All data in leaf nodes, making range queries efficient.'},
  ],
  Networks:[
    {q:'How many layers does the OSI model have?',opts:['5','6','7','8'],ans:2,exp:'OSI: Physical, Data Link, Network, Transport, Session, Presentation, Application.'},
    {q:'TCP vs UDP — which guarantees delivery?',opts:['UDP','TCP','Both','Neither'],ans:1,exp:'TCP guarantees delivery through acknowledgments, retransmission, and sequencing.'},
    {q:'What does DNS do?',opts:['Stores files','Translates domain to IP','Assigns IPs dynamically','None'],ans:1,exp:'DNS translates human-readable domain names to IP addresses.'},
    {q:'What is a TCP 3-way handshake?',opts:['SYN → SYN-ACK → ACK','ACK → SYN → FIN','GET → POST → PUT','None'],ans:0,exp:'TCP: Client sends SYN, Server responds SYN-ACK, Client sends ACK.'},
    {q:'Which layer does IP operate at?',opts:['Layer 1','Layer 2','Layer 3','Layer 4'],ans:2,exp:'IP operates at Layer 3 (Network layer) handling logical addressing and routing.'},
  ],
  DSA:[
    {q:'Average time complexity of QuickSort?',opts:['O(n)','O(n log n)','O(n²)','O(log n)'],ans:1,exp:'QuickSort averages O(n log n). Worst case O(n²) with bad pivot.'},
    {q:'Which data structure uses LIFO?',opts:['Queue','Stack','Linked List','Heap'],ans:1,exp:'Stack uses LIFO. Common uses: function call stack, undo, bracket matching.'},
    {q:'What is a Hash Collision?',opts:['Two keys mapping to same hash','Hash function failure','Memory overflow','Index out of bounds'],ans:0,exp:'Hash collision: two different keys produce same hash value. Resolved by chaining or open addressing.'},
    {q:'Which tree is self-balancing?',opts:['Binary Tree','BST','AVL Tree','B-Tree'],ans:2,exp:'AVL Tree is self-balancing BST with balance factor at most 1.'},
    {q:'Space complexity of BFS?',opts:['O(1)','O(log n)','O(n)','O(n²)'],ans:2,exp:'BFS has O(n) space — queue can hold all nodes at a level in worst case.'},
  ],
  OOP:[
    {q:'What is polymorphism?',opts:['Hiding details','One interface, many implementations','Inheriting properties','Creating objects'],ans:1,exp:'Polymorphism allows objects of different types to be treated as common type via overriding/overloading.'},
    {q:'Abstract class vs interface difference?',opts:['No difference','Abstract class can have state; interface cannot (pre-Java 8)','Interface is faster','Abstract class for multiple inheritance'],ans:1,exp:'Abstract class can have instance variables, constructors. Interface (pre-Java 8) only abstract methods.'},
    {q:'Which SOLID principle: class should have one reason to change?',opts:['Open/Closed','Liskov Substitution','Single Responsibility','Dependency Inversion'],ans:2,exp:'SRP: A class should have only one job/reason to change.'},
    {q:'What is method overriding?',opts:['Same name, different params in same class','Redefining parent method in child class','Static method replacement','Constructor chaining'],ans:1,exp:'Overriding: subclass provides specific implementation of a method already defined in parent class.'},
    {q:'What does encapsulation mean?',opts:['Inheriting methods','Bundling data and methods, hiding internal state','Creating multiple objects','Using abstract methods'],ans:1,exp:'Encapsulation bundles data and methods into a class, restricting direct access to internal state.'},
  ],
  'System Design':[
    {q:'What is horizontal scaling?',opts:['Adding more RAM','Adding more servers','Upgrading CPU','Using faster storage'],ans:1,exp:'Horizontal scaling adds more machines to distribute load, enabling better fault tolerance.'},
    {q:'What is consistent hashing used for?',opts:['Password security','Distributing data across nodes minimizing redistribution','Load balancing only','Encryption'],ans:1,exp:'Consistent hashing distributes data so only K/n keys need remapping when nodes change.'},
    {q:'What is a CDN?',opts:['Central Database Node','Content Delivery Network','Code Deployment Network','None'],ans:1,exp:'CDN: geographically distributed servers caching content closer to users for reduced latency.'},
    {q:'CAP theorem says?',opts:['Have all 3','Can only guarantee 2 of: C, A, P','Distributed systems always fail','None'],ans:1,exp:'CAP: impossible to simultaneously provide Consistency, Availability, and Partition Tolerance.'},
    {q:'What is a message queue used for?',opts:['Database indexing','Decoupling services, async communication','Authentication','Load testing'],ans:1,exp:'Message queues enable async decoupled communication. Examples: RabbitMQ, Kafka.'},
  ],
  COA:[
    {q:'What is pipelining?',opts:['Parallel processing','Breaking instruction execution into overlapping stages','Caching','Branch prediction'],ans:1,exp:'Pipelining overlaps instruction stages (Fetch, Decode, Execute, Memory, Write-back).'},
    {q:'RISC vs CISC difference?',opts:['RISC has more instructions','RISC uses simple one-cycle instructions; CISC uses complex multi-cycle','CISC is faster','No difference'],ans:1,exp:'RISC: simple, fixed-length instructions. CISC: many complex instructions.'},
    {q:'What is a TLB?',opts:['Thread Level Buffer','Translation Lookaside Buffer','Transfer Layer Bus','None'],ans:1,exp:'TLB caches recent virtual-to-physical address translations.'},
    {q:'What is cache coherence?',opts:['Cache compression','Ensuring multiple CPU caches have consistent memory view','Cache replacement','Cache warming'],ans:1,exp:'Cache coherence ensures all processors see consistent shared memory. Protocol: MESI.'},
    {q:'What is branch prediction?',opts:['Predicting memory usage','CPU guessing direction of conditional branch','Optimizing loops','Compiler optimization'],ans:1,exp:'Branch prediction: CPU guesses branch outcome to keep pipeline full. >95% accuracy.'},
  ],
  Algorithms:[
    {q:'Greedy vs DP difference?',opts:['No difference','Greedy makes local optimal choice; DP considers all subproblems','DP is always better','Greedy is always optimal'],ans:1,exp:'Greedy: locally optimal choices. DP: solves all subproblems, guarantees optimal.'},
    {q:'What does Dijkstra find?',opts:['Minimum spanning tree','Shortest path from source (non-negative weights)','Maximum flow','Topological sort'],ans:1,exp:'Dijkstra finds shortest path with non-negative weights. O((V+E) log V) with priority queue.'},
    {q:'What is Master Theorem for?',opts:['Sorting','Solving divide-and-conquer recurrences','Graph problems','DP'],ans:1,exp:'Master Theorem solves T(n) = aT(n/b) + f(n) recurrences.'},
    {q:'What is amortized analysis?',opts:['Worst case','Average cost per operation over sequence','Space analysis','Best case'],ans:1,exp:'Amortized analysis: average time per operation over sequence. E.g., dynamic array O(1) amortized.'},
    {q:'What can Bellman-Ford handle that Dijkstra cannot?',opts:['Larger graphs','Negative weight edges','Directed graphs','Weighted graphs'],ans:1,exp:'Bellman-Ford handles negative weights and detects negative cycles. O(VE).'},
  ],
  Cloud:[
    {q:'IaaS vs PaaS vs SaaS?',opts:['Same thing','IaaS=Infrastructure, PaaS=Platform, SaaS=Software','IaaS is best','None'],ans:1,exp:'IaaS: rent infrastructure. PaaS: rent platform. SaaS: use complete software.'},
    {q:'What is Kubernetes?',opts:['Programming language','Container orchestration','Database management','Load testing'],ans:1,exp:'K8s: container orchestration for automated deployment, scaling, management.'},
    {q:'What is serverless computing?',opts:['No servers','Code execution without managing servers','Offline computing','Free cloud'],ans:1,exp:'Serverless (e.g., AWS Lambda): run code without managing servers, billed per execution.'},
    {q:'What is a VPC?',opts:['Video Processing Center','Virtual Private Cloud','Visual Programming Console','None'],ans:1,exp:'VPC: isolated virtual network in cloud for launching resources with custom networking.'},
    {q:'What is auto-scaling?',opts:['Manual scaling','Automatically adjusting capacity based on load','Scaling databases','None'],ans:1,exp:'Auto-scaling automatically adjusts compute capacity based on demand metrics.'},
  ],
  Security:[
    {q:'What is SQL Injection?',opts:['Database optimization','Inserting malicious SQL through input','A database type','None'],ans:1,exp:'SQL injection: attacker inserts malicious SQL through user input. Prevent with parameterized queries.'},
    {q:'What is XSS?',opts:['XML Syntax Service','Cross-Site Scripting','Extra Security System','None'],ans:1,exp:'XSS: injecting client-side scripts into web pages viewed by other users.'},
    {q:'What is HTTPS?',opts:['Faster HTTP','HTTP with TLS/SSL encryption','A programming language','None'],ans:1,exp:'HTTPS encrypts HTTP communication using TLS/SSL for secure data transfer.'},
    {q:'What is a JWT?',opts:['Java Web Technology','JSON Web Token for authentication','JavaScript Testing','None'],ans:1,exp:'JWT: compact token for securely transmitting information as JSON between parties.'},
    {q:'What is CORS?',opts:['Code Optimization','Cross-Origin Resource Sharing','Caching System','None'],ans:1,exp:'CORS: mechanism allowing web pages to request resources from different domains.'},
  ],
  'ML Basics':[
    {q:'Supervised vs Unsupervised learning?',opts:['Same thing','Supervised uses labeled data; unsupervised finds patterns in unlabeled','Unsupervised is better','None'],ans:1,exp:'Supervised: labeled training data. Unsupervised: finds patterns without labels.'},
    {q:'What is overfitting?',opts:['Model too simple','Model memorizes training data, fails on new data','Fast training','None'],ans:1,exp:'Overfitting: model performs great on training data but poorly on unseen data.'},
    {q:'What is gradient descent?',opts:['Data visualization','Optimization algorithm to minimize loss function','Feature extraction','None'],ans:1,exp:'Gradient descent iteratively adjusts parameters to minimize the loss function.'},
    {q:'What is a neural network?',opts:['Database','Computing system inspired by biological neurons','Networking protocol','None'],ans:1,exp:'Neural network: interconnected nodes (neurons) that learn patterns from data.'},
    {q:'What is regularization?',opts:['Data cleaning','Technique to prevent overfitting by adding penalty','Feature scaling','None'],ans:1,exp:'Regularization adds penalty term to loss function to prevent overfitting (L1, L2).'},
  ],
  'Compiler Design':[
    {q:'What is lexical analysis?',opts:['Syntax checking','Breaking source code into tokens','Code optimization','Linking'],ans:1,exp:'Lexical analysis (scanning): first phase, breaks source code into tokens.'},
    {q:'What is a parse tree?',opts:['File system tree','Hierarchical representation of grammar derivation','Binary search tree','None'],ans:1,exp:'Parse tree shows how a string is derived from grammar rules.'},
    {q:'What does a linker do?',opts:['Compiles code','Combines object files into executable','Interprets code','None'],ans:1,exp:'Linker combines multiple object files and resolves references into final executable.'},
    {q:'What is an AST?',opts:['Application Server','Abstract Syntax Tree','Auto Scaling Tool','None'],ans:1,exp:'AST: tree representation of source code structure, removing syntax details.'},
    {q:'What is code optimization?',opts:['Making code readable','Transforming code to run faster with less resources','Debugging','None'],ans:1,exp:'Compiler optimization transforms code for better performance while preserving semantics.'},
  ],
};

const NEWS_ITEMS = [
  {co:'Google',class:'google',text:'Google DeepMind releases Gemini 3 with breakthrough multimodal reasoning — raises the bar for AI interviews.'},
  {co:'Amazon',class:'amazon',text:'Amazon Web Services launches 50+ new services at re:Invent 2026 — hiring 15,000 cloud engineers.'},
  {co:'Meta',class:'meta',text:'Meta open-sources Llama 4 model — System Design interviews now include LLM architecture questions.'},
  {co:'Microsoft',class:'microsoft',text:'Microsoft Copilot integrated into all Office apps — .NET and Azure skills in highest demand.'},
  {co:'Apple',class:'apple',text:'Apple Vision Pro 2 launched — Swift/ARKit developers seeing 40% salary premium.'},
  {co:'LinkedIn',class:'linkedin',text:'LinkedIn reports 500% increase in AI/ML job postings — DSA skills remain top requirement.'},
];

const LB_DATA_BASE = [
  {name:'Arjun Sharma',college:'IIT Bombay',score:4820,solved:186,streak:42},
  {name:'Priya Nair',college:'NIT Trichy',score:4650,solved:174,streak:38},
  {name:'Rahul Gupta',college:'BITS Pilani',score:4430,solved:165,streak:35},
  {name:'Ananya Reddy',college:'IIT Delhi',score:4200,solved:158,streak:29},
  {name:'Sai Krishna',college:'VIT Vellore',score:3980,solved:149,streak:25},
  {name:'Deepak Kumar',college:'IIT Madras',score:3760,solved:141,streak:22},
  {name:'Lavanya M',college:'IIIT Hyderabad',score:3540,solved:132,streak:18},
  {name:'Vikram S',college:'Amrita',score:3310,solved:124,streak:15},
  {name:'Meera P',college:'SRM Chennai',score:3090,solved:115,streak:12},
];

const AVATAR_COLORS = ['#7c3aed','#10b981','#3b82f6','#f59e0b','#ef4444','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1'];

// =================== COMPONENT ===================
const MasteryChallenge = ({ userCodeFromSlide2, userCodeFromSlide5 }: MasteryChallengeProps) => {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState<'dashboard'|'practice'|'leaderboard'|'profile'>('dashboard');
  const [currentCompany, setCurrentCompany] = useState('Google');
  const [currentLevel, setCurrentLevel] = useState('basic');
  const [selectedLang, setSelectedLang] = useState('Python 3');
  const [activeQ, setActiveQ] = useState<QItem|null>(null);
  const [code, setCode] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [output, setOutput] = useState('Click Run to see output...');
  const [showingSolution, setShowingSolution] = useState(false);
  const [solvedProblems, setSolvedProblems] = useState<(QItem & {company:string;level:string;lang:string;time:string})[]>([]);
  const [companySearch, setCompanySearch] = useState('Google');
  const [showCompanyDrop, setShowCompanyDrop] = useState(false);
  const [langSearch, setLangSearch] = useState('Python 3');
  const [showLangDrop, setShowLangDrop] = useState(false);
  const [qTab, setQTab] = useState<'company'|'leetcode'>('company');
  const [tcResults, setTcResults] = useState<{pass:boolean;got:string}[]>([]);
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [timer, setTimer] = useState({h:'00',m:'00',s:'00'});
  const [qboxLevel1, setQboxLevel1] = useState('easy');
  const [activeTopic, setActiveTopic] = useState('OS');
  const [topicSearch, setTopicSearch] = useState('');
  const [mcqAnswers, setMcqAnswers] = useState<Record<number,number>>({});
  const [mcqSubmitted, setMcqSubmitted] = useState<Record<number,boolean>>({});
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [saveFilename, setSaveFilename] = useState('solution');
  const [saveFormat, setSaveFormat] = useState('.py');
  const codeRef = useRef<HTMLTextAreaElement>(null);
  const lineNumRef = useRef<HTMLDivElement>(null);

  // Timer
  useEffect(() => {
    const tick = () => {
      const midnight = new Date();
      midnight.setHours(24,0,0,0);
      const diff = midnight.getTime() - Date.now();
      const h = Math.floor(diff/3600000);
      const m = Math.floor((diff%3600000)/60000);
      const s = Math.floor((diff%60000)/1000);
      setTimer({h:String(h).padStart(2,'0'),m:String(m).padStart(2,'0'),s:String(s).padStart(2,'0')});
    };
    tick();
    const iv = setInterval(tick,1000);
    return () => clearInterval(iv);
  }, []);

  // Load first question
  useEffect(() => {
    const qs = getQList();
    if(qs.length>0 && !activeQ) {
      setActiveQ(qs[0]);
      loadProblemCode(qs[0]);
    }
  }, []);

  const getQList = useCallback(() => {
    const db = QUESTIONS_DB[currentCompany] || QUESTIONS_DB['Google'];
    const qs = db[currentLevel] || db['basic'] || [];
    if(qTab==='company') return qs.slice(0,Math.ceil(qs.length/2));
    return qs.slice(Math.ceil(qs.length/2));
  }, [currentCompany, currentLevel, qTab]);

  const loadProblemCode = (q: QItem) => {
    const templates: Record<string,string> = {
      'Python 3':`# ${q.t} — ${currentCompany}\n# ${q.d} | ${q.topic}\n\ndef solution():\n    # Write your code here\n    pass\n\n# Test\nprint(solution())`,
      'Java':`// ${q.t} — ${currentCompany}\n// ${q.d} | ${q.topic}\n\npublic class Solution {\n    public static void main(String[] args) {\n        // Write your code here\n    }\n}`,
      'C++':`// ${q.t} — ${currentCompany}\n// ${q.d} | ${q.topic}\n\n#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    return 0;\n}`,
      'JavaScript':`// ${q.t} — ${currentCompany}\n// ${q.d} | ${q.topic}\n\nfunction solution() {\n    // Write your code here\n}\n\nconsole.log(solution());`,
    };
    setCode(templates[selectedLang] || `# ${q.t}\n# Language: ${selectedLang}\n\n# Write your solution here\n`);
    setOutput('Click Run to see output...');
    setTcResults([]);
    setAnalysisVisible(false);
    setShowingSolution(false);
    setAiResponse('');
  };

  const selectQuestion = (q: QItem) => {
    setActiveQ(q);
    loadProblemCode(q);
  };

  const runCode = () => {
    if(!code.trim() || code.includes('Write your code')){
      toast({title:'⚠️ Write your code first!'});return;
    }
    setOutput('⏳ Running...');
    setTimeout(() => {
      if(!activeQ) { setOutput('Select a question first.'); return; }
      const lines: string[] = [];
      lines.push(`>> Running: ${activeQ.t}`);
      lines.push(`>> Language: ${selectedLang}`);
      if(customInput) lines.push(`>> Custom Input: ${customInput}`);
      lines.push('');
      const isCorrect = code.length > 30;
      (activeQ.tc||[]).slice(0,3).forEach((tc,i) => {
        lines.push(`Test ${i+1}: Input=${tc.i}`);
        lines.push(`         Output=${tc.o}`);
      });
      lines.push('');
      const passed = isCorrect ? (activeQ.tc?.length||3) : Math.floor(Math.random()*((activeQ.tc?.length||3)-1));
      const total = activeQ.tc?.length||3;
      lines.push(isCorrect ? '✅ All test cases passed!' : '❌ Check your logic.');
      lines.push(`Runtime: ${Math.floor(Math.random()*50+20)}ms | Memory: ${Math.floor(Math.random()*10+5)}MB`);
      setOutput(lines.join('\n'));
      const results = (activeQ.tc||[]).slice(0,3).map((tc,i) => ({
        pass: i < passed,
        got: i < passed ? tc.o : 'Wrong answer'
      }));
      setTcResults(results);
      setAnalysisVisible(true);
    }, 1200);
  };

  const submitCode = () => {
    if(!code.trim() || code.includes('Write your code')){
      toast({title:'⚠️ Write your code first!'});return;
    }
    runCode();
    setTimeout(() => {
      if(activeQ && !solvedProblems.find(p=>p.t===activeQ.t)){
        const now = new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
        setSolvedProblems(prev => [...prev, {...activeQ, company:currentCompany, level:currentLevel, lang:selectedLang, time:now}]);
        toast({title:`🎉 Solved! +${activeQ.d==='Easy'?10:activeQ.d==='Medium'?25:50} points`});
      } else {
        toast({title:'✅ Submitted successfully!'});
      }
    }, 1400);
  };

  const saveFile = () => {
    const extMap: Record<string,string> = {'Python 3':'.py','Java':'.java','C++':'.cpp','JavaScript':'.js','TypeScript':'.ts','Go':'.go','Rust':'.rs','C#':'.cs','Kotlin':'.kt','Ruby':'.rb','C':'.c'};
    const ext = extMap[selectedLang]||'.txt';
    const fname = `${(activeQ?.t||'solution').replace(/\s+/g,'_')}${ext}`;
    downloadFile(fname, code);
    toast({title:`💾 Saved as ${fname}`});
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content],{type:'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const confirmSaveAs = () => {
    const name = saveFilename || 'solution';
    const fname = name.includes('.') ? name : name + saveFormat;
    downloadFile(fname, code);
    setShowSaveAs(false);
    toast({title:`💾 Saved as ${fname}`});
  };

  const aiAction = async (type: 'hint'|'explain'|'optimize'|'review') => {
    setAiLoading(true);
    setAiResponse('');
    setTimeout(() => {
      const fallbacks: Record<string,string> = {
        hint:`💡 For "${activeQ?.t||'this problem'}", try using a HashMap to reduce time complexity from O(n²) to O(n) by enabling O(1) lookups.`,
        explain:`📖 This solution iterates through the data structure while maintaining auxiliary storage. Complexity: ${activeQ?.time||'O(n)'} time, ${activeQ?.space||'O(n)'} space.`,
        optimize:`⚡ Current approach is already optimal at ${activeQ?.time||'O(n)'}. Consider bit manipulation or mathematical properties for further optimization.`,
        review:`🔍 Code Review:\n• ✅ Clean logic and readable variable names\n• ⚠️ Add edge case handling for empty inputs\n• 💡 Consider adding inline comments for complex sections`
      };
      setAiResponse(fallbacks[type]);
      setAiLoading(false);
    }, 1500);
  };

  const updateLineNums = () => {
    if(lineNumRef.current && codeRef.current){
      const lines = codeRef.current.value.split('\n').length;
      lineNumRef.current.innerHTML = Array.from({length:Math.max(lines,15)},(_,i)=>i+1).join('<br/>');
    }
  };

  const syncScroll = () => {
    if(lineNumRef.current && codeRef.current){
      lineNumRef.current.scrollTop = codeRef.current.scrollTop;
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if(e.ctrlKey && e.key === 's') { e.preventDefault(); saveFile(); }
      if(e.ctrlKey && e.shiftKey && e.key === 'S') { e.preventDefault(); setShowSaveAs(true); }
      if(e.ctrlKey && e.key === 'Enter') { e.preventDefault(); runCode(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [code, activeQ, selectedLang]);

  const solved = solvedProblems.length;
  const streak = solved > 0 ? Math.min(solved,7) : 0;
  const score = solvedProblems.reduce((a,p) => a + (p.d==='Easy'?10:p.d==='Medium'?25:p.d==='Hard'?50:100), 0);
  const rank = solved > 0 ? Math.max(1, 500-solved*3) : '--';
  const easySolved = solvedProblems.filter(p=>p.d==='Easy').length;
  const medSolved = solvedProblems.filter(p=>p.d==='Medium').length;
  const hardSolved = solvedProblems.filter(p=>p.d==='Hard'||p.d==='Advanced').length;
  const masterSolved = solvedProblems.filter(p=>p.d==='Master'||p.d==='Hard' && p.topic?.includes('System')).length;

  const filteredCompanies = ALL_COMPANIES.filter(c=>c.name.toLowerCase().includes(companySearch.toLowerCase()));
  const filteredLangs = ALL_LANGUAGES.filter(l=>l.toLowerCase().includes(langSearch.toLowerCase()));
  const filteredTopics = CS_TOPICS.filter(t=>t.toLowerCase().includes(topicSearch.toLowerCase()));

  const getLBData = () => {
    const userRow = {name:'You',college:'Your College',score,solved,streak:Math.min(solved,7),you:true};
    const all = [...LB_DATA_BASE.map(r=>({...r,you:false})),userRow].sort((a,b)=>b.score-a.score);
    return all;
  };

  const qboxQuestions = () => {
    const map: Record<string,string> = {easy:'basic',med:'medium',hard:'advanced',master:'master'};
    const db = QUESTIONS_DB[currentCompany] || QUESTIONS_DB['Google'];
    return (db[map[qboxLevel1]] || db['basic'] || []).slice(0,20);
  };

  const currentMCQs = MCQ_DATA[activeTopic] || MCQ_DATA['OS'];

  const h = new Date().getHours();
  const greeting = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';

  const showSolution = () => {
    if(!activeQ){ toast({title:'⚠️ Select a question first'}); return; }
    setShowingSolution(!showingSolution);
  };

  const getSolCode = () => {
    if(!activeQ) return '';
    const langKey: Record<string,string> = {'Python 3':'py','Java':'java','C++':'cpp','JavaScript':'js','TypeScript':'js'};
    const key = langKey[selectedLang] || 'py';
    return activeQ.sol?.[key] || activeQ.sol?.['py'] || `# Solution for ${activeQ.t}`;
  };

  return (
    <div className="h-full w-full overflow-auto" style={{background:'#060912',color:'#e2e8f0',fontFamily:"'Syne','Inter',sans-serif"}}>
      {/* Background effects */}
      <div style={{position:'fixed',inset:0,zIndex:0,backgroundImage:'linear-gradient(rgba(0,245,160,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,245,160,.03) 1px,transparent 1px)',backgroundSize:'40px 40px',pointerEvents:'none'}} />
      <div style={{position:'fixed',inset:0,zIndex:0,pointerEvents:'none',background:'radial-gradient(ellipse 60% 40% at 20% 20%,rgba(124,58,237,.08) 0%,transparent 60%),radial-gradient(ellipse 50% 60% at 80% 80%,rgba(0,245,160,.06) 0%,transparent 60%)'}} />

      <div style={{position:'relative',zIndex:1}}>
        {/* HEADER */}
        <header style={{borderBottom:'1px solid #2a3347',padding:'0 28px',height:62,display:'flex',alignItems:'center',justifyContent:'space-between',background:'rgba(6,9,18,.92)',backdropFilter:'blur(20px)',position:'sticky',top:0,zIndex:100}}>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:17,fontWeight:700,color:'#00f5a0',display:'flex',alignItems:'center',gap:9}}>
            <div style={{width:30,height:30,background:'linear-gradient(135deg,#7c3aed,#00f5a0)',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>⚡</div>
            CodeArena<span style={{color:'#94a3b8'}}>Pro</span>
          </div>
          <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
            {(['dashboard','practice','leaderboard'] as const).map(p => (
              <button key={p} onClick={()=>setCurrentPage(p)} style={{
                padding:'6px 14px',borderRadius:8,fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:600,cursor:'pointer',border:'1px solid #2a3347',
                background: currentPage===p ? 'rgba(0,245,160,.1)' : 'transparent',
                color: currentPage===p ? '#00f5a0' : '#94a3b8',
                borderColor: currentPage===p ? 'rgba(0,245,160,.3)' : '#2a3347',
              }}>{p.charAt(0).toUpperCase()+p.slice(1)}</button>
            ))}
            <button onClick={()=>{setCurrentPage('practice')}} style={{padding:'6px 14px',borderRadius:8,fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:700,cursor:'pointer',border:'none',background:'#00f5a0',color:'#000'}}>🔥 Daily Challenge</button>
            <div onClick={()=>setCurrentPage('profile')} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 12px 5px 5px',background:'#161b27',border:'1px solid #2a3347',borderRadius:30,cursor:'pointer'}}>
              <div style={{width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,#7c3aed,#00f5a0)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700}}>S</div>
              <span style={{fontSize:13,fontWeight:600}}>Student</span>
            </div>
          </div>
        </header>

        {/* ===== DASHBOARD ===== */}
        {currentPage === 'dashboard' && (
          <div style={{padding:'24px 28px 48px'}}>
            <div style={{fontSize:13,fontWeight:600,color:'#00f5a0',textTransform:'uppercase',letterSpacing:2,fontFamily:"'Space Mono',monospace",marginBottom:6}}>Your Progress</div>
            <div style={{fontSize:22,fontWeight:800,marginBottom:18}}>Good {greeting}, Student! 👋</div>

            {/* Stats Grid */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:28}}>
              {[
                {icon:'✅',val:solved,label:'SOLVED',sub:solved===0?'Start solving!':`${solved} problems done 🎉`},
                {icon:'🔥',val:streak,label:'STREAK',sub:streak>0?`${streak} day streak 🔥`:'Build your streak'},
                {icon:'🏆',val:rank,label:'RANK',sub:'Global ranking'},
                {icon:'⭐',val:score,label:'SCORE',sub:'Total points'},
              ].map((c,i)=>(
                <div key={i} style={{background:'#0d1117',border:'1px solid #2a3347',borderRadius:14,padding:20,transition:'all .2s',cursor:'default'}}>
                  <div style={{fontSize:24,marginBottom:10}}>{c.icon}</div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:28,fontWeight:700,color:'#00f5a0',marginBottom:4}}>{c.val}</div>
                  <div style={{fontSize:12,color:'#64748b',textTransform:'uppercase',letterSpacing:1}}>{c.label}</div>
                  <div style={{fontSize:11,color:'#64748b',marginTop:4,fontFamily:"'Space Mono',monospace"}}>{c.sub}</div>
                </div>
              ))}
            </div>

            {/* Progress by Level */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:24}}>
              <div style={{background:'#0d1117',border:'1px solid #2a3347',borderRadius:14,padding:20}}>
                <div style={{fontSize:14,fontWeight:700,marginBottom:14}}>📈 Progress by Level</div>
                {[
                  {label:'Basic',val:easySolved,max:50,color:'#10b981'},
                  {label:'Medium',val:medSolved,max:50,color:'#f59e0b'},
                  {label:'Advanced',val:hardSolved,max:50,color:'#f97316'},
                  {label:'Master',val:masterSolved,max:50,color:'#7c3aed'},
                ].map((p,i)=>(
                  <div key={i} style={{marginBottom:14}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                      <span style={{fontSize:13,fontWeight:600}}>{p.label}</span>
                      <span style={{fontSize:13,fontFamily:"'Space Mono',monospace",color:'#00f5a0'}}>{p.val} / {p.max}</span>
                    </div>
                    <div style={{background:'#161b27',borderRadius:100,height:7,overflow:'hidden'}}>
                      <div style={{height:'100%',borderRadius:100,background:`linear-gradient(90deg,#7c3aed,${p.color})`,width:`${(p.val/p.max)*100}%`,transition:'width 1s'}} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{background:'#0d1117',border:'1px solid #2a3347',borderRadius:14,padding:20}}>
                <div style={{fontSize:14,fontWeight:700,marginBottom:14}}>📝 Today's Study Plan</div>
                {[
                  {icon:'🔢',text:'Practice 5 Array problems (Basic level)'},
                  {icon:'🌲',text:'Revise Tree traversal algorithms'},
                  {icon:'🧩',text:'Solve 2 Medium DP problems'},
                  {icon:'🏢',text:'Study Google System Design patterns'},
                  {icon:'💡',text:'Review OS concepts: Deadlock & Scheduling'},
                ].map((t,i)=>(
                  <div key={i} style={{display:'flex',gap:10,alignItems:'center',padding:'8px 0',borderBottom:'1px solid rgba(42,51,71,.5)'}}>
                    <span style={{fontSize:16}}>{t.icon}</span>
                    <span style={{fontSize:13,color:'#94a3b8'}}>{t.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity */}
            <div style={{background:'#0d1117',border:'1px solid #2a3347',borderRadius:14,padding:20,marginBottom:24}}>
              <div style={{fontSize:14,fontWeight:700,marginBottom:14}}>📊 Recent Activity</div>
              {solvedProblems.length === 0 ? (
                <div style={{fontSize:13,color:'#64748b',padding:'10px 0'}}>No activity yet. Start solving problems!</div>
              ) : solvedProblems.slice(-5).reverse().map((p,i) => (
                <div key={i} style={{display:'flex',alignItems:'center',gap:14,padding:'10px 0',borderBottom:'1px solid rgba(42,51,71,.5)'}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:p.d==='Easy'?'#10b981':p.d==='Medium'?'#f59e0b':'#ef4444'}} />
                  <div style={{flex:1,fontSize:13}}>Solved: <b>{p.t}</b> ({p.d}) — {p.company}</div>
                  <div style={{fontSize:11,color:'#64748b',fontFamily:"'Space Mono',monospace"}}>{p.time}</div>
                </div>
              ))}
            </div>

            {/* News */}
            <div style={{background:'linear-gradient(135deg,rgba(249,115,22,.12),rgba(249,115,22,.05))',border:'2px solid #f97316',borderRadius:14,padding:20}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                <span style={{background:'#f97316',color:'#fff',fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:100,fontFamily:"'Space Mono',monospace",textTransform:'uppercase',animation:'blink 1.5s infinite'}}>🔴 LIVE</span>
                <span style={{fontSize:16,fontWeight:800}}>Industry News & Trends</span>
              </div>
              {NEWS_ITEMS.map((n,i) => (
                <div key={i} style={{display:'flex',gap:12,alignItems:'flex-start',padding:'9px 0',borderBottom:i<NEWS_ITEMS.length-1?'1px solid rgba(249,115,22,.2)':'none'}}>
                  <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:4,fontFamily:"'Space Mono',monospace",whiteSpace:'nowrap',marginTop:2,
                    background: n.class==='google'?'rgba(66,133,244,.2)':n.class==='amazon'?'rgba(255,153,0,.2)':n.class==='meta'?'rgba(24,119,242,.2)':n.class==='microsoft'?'rgba(0,188,242,.2)':n.class==='apple'?'rgba(163,170,174,.2)':'rgba(0,119,181,.2)',
                    color: n.class==='google'?'#4285f4':n.class==='amazon'?'#ff9900':n.class==='meta'?'#1877f2':n.class==='microsoft'?'#00bcf2':n.class==='apple'?'#a3aaae':'#0077b5',
                  }}>{n.co}</span>
                  <div>
                    <div style={{fontSize:13,color:'#94a3b8',lineHeight:1.5}}>{n.text}</div>
                    <div style={{fontSize:11,color:'#64748b',fontFamily:"'Space Mono',monospace",marginTop:3}}>📅 {new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== PRACTICE ===== */}
        {currentPage === 'practice' && (
          <div style={{padding:'24px 28px 48px'}}>
            {/* Top bar */}
            <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',marginBottom:20}}>
              <div style={{position:'relative',flex:1,maxWidth:340}}>
                <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:14,color:'#64748b'}}>🔍</span>
                <input value={companySearch} onChange={e=>{setCompanySearch(e.target.value);setShowCompanyDrop(true)}} onFocus={()=>setShowCompanyDrop(true)} onBlur={()=>setTimeout(()=>setShowCompanyDrop(false),200)}
                  placeholder="Search company..." style={{width:'100%',background:'#161b27',border:'1px solid #2a3347',color:'#e2e8f0',borderRadius:10,padding:'10px 16px 10px 38px',fontFamily:"'Space Mono',monospace",fontSize:13,outline:'none'}} />
                {showCompanyDrop && (
                  <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:'#0d1117',border:'1px solid #2a3347',borderRadius:10,zIndex:50,maxHeight:200,overflowY:'auto'}}>
                    {filteredCompanies.map(c=>(
                      <div key={c.name} onMouseDown={()=>{setCurrentCompany(c.name);setCompanySearch(c.name);setShowCompanyDrop(false);toast({title:`🏢 Loaded ${c.name} questions`});}}
                        style={{padding:'10px 14px',cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',gap:8}}>
                        <div style={{width:8,height:8,borderRadius:'50%',background:c.color}} />{c.emoji} {c.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{display:'flex',gap:4,background:'#0d1117',borderRadius:10,padding:4}}>
                {[{k:'basic',l:'Basic',c:'#10b981'},{k:'medium',l:'Medium',c:'#f59e0b'},{k:'advanced',l:'Advanced',c:'#f97316'},{k:'master',l:'Master',c:'#ef4444'}].map(lv=>(
                  <button key={lv.k} onClick={()=>{setCurrentLevel(lv.k);const qs=QUESTIONS_DB[currentCompany]?.[lv.k]||[];if(qs.length>0){setActiveQ(qs[0]);loadProblemCode(qs[0]);}}}
                    style={{padding:'7px 18px',borderRadius:7,fontFamily:"'Space Mono',monospace",fontSize:12,fontWeight:700,cursor:'pointer',border:'none',textTransform:'uppercase',
                      background:currentLevel===lv.k?lv.c:'transparent',color:currentLevel===lv.k?(lv.k==='master'?'#fff':'#000'):'#64748b'
                    }}>{lv.l}</button>
                ))}
              </div>
            </div>

            {/* Daily Challenge Banner */}
            <div style={{background:'linear-gradient(135deg,rgba(124,58,237,.15),rgba(0,245,160,.08))',border:'1px solid rgba(124,58,237,.3)',borderRadius:14,padding:'16px 22px',display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:14}}>
              <div style={{display:'flex',alignItems:'center',gap:14}}>
                <span style={{fontSize:28}}>🏆</span>
                <div>
                  <div style={{fontSize:16,fontWeight:700}}>Daily Challenge</div>
                  <div style={{fontSize:12,color:'#94a3b8',fontFamily:"'Space Mono',monospace"}}>{new Date().toLocaleDateString('en-IN',{month:'short',day:'2-digit',year:'numeric'})} · {currentCompany}</div>
                </div>
              </div>
              <div style={{display:'flex',gap:6,alignItems:'center',fontFamily:"'Space Mono',monospace"}}>
                {[{v:timer.h,l:'HRS'},{v:timer.m,l:'MIN'},{v:timer.s,l:'SEC'}].map((t,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:6}}>
                    {i>0 && <span style={{fontSize:20,color:'#64748b',fontWeight:700}}>:</span>}
                    <div style={{background:'#1e2535',borderRadius:7,padding:'7px 10px',textAlign:'center'}}>
                      <span style={{fontSize:20,fontWeight:700,color:'#00f5a0',display:'block'}}>{t.v}</span>
                      <span style={{fontSize:9,color:'#64748b',textTransform:'uppercase'}}>{t.l}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Coding Grid */}
            <div style={{display:'grid',gridTemplateColumns:'340px 1fr',gap:18,alignItems:'start'}}>
              {/* Question Panel */}
              <div style={{background:'#0d1117',border:'1px solid #2a3347',borderRadius:14,overflow:'hidden'}}>
                <div style={{padding:'14px 18px',borderBottom:'1px solid #2a3347',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{fontSize:13,fontWeight:700,display:'flex',alignItems:'center',gap:8}}>📋 Questions <span style={{background:'#1e2535',borderRadius:100,padding:'2px 9px',fontSize:11,color:'#94a3b8',fontFamily:"'Space Mono',monospace"}}>{getQList().length}</span></div>
                </div>
                <div style={{display:'flex',borderBottom:'1px solid #2a3347'}}>
                  {[{k:'company' as const,l:'Company'},{k:'leetcode' as const,l:'LeetCode'}].map(tab=>(
                    <button key={tab.k} onClick={()=>setQTab(tab.k)} style={{flex:1,padding:9,textAlign:'center',fontSize:11,fontWeight:700,cursor:'pointer',border:'none',background:'transparent',
                      color:qTab===tab.k?'#00f5a0':'#64748b',borderBottom:qTab===tab.k?'2px solid #00f5a0':'2px solid transparent',fontFamily:"'Space Mono',monospace",textTransform:'uppercase'
                    }}>{tab.l}</button>
                  ))}
                </div>
                <div style={{maxHeight:520,overflowY:'auto'}}>
                  {getQList().map((q,i) => (
                    <div key={i} onClick={()=>selectQuestion(q)} style={{
                      padding:'12px 16px',borderBottom:'1px solid rgba(42,51,71,.5)',cursor:'pointer',display:'flex',alignItems:'center',gap:10,
                      background: activeQ?.t===q.t ? 'rgba(0,245,160,.06)' : 'transparent',
                      borderLeft: activeQ?.t===q.t ? '3px solid #00f5a0' : '3px solid transparent'
                    }}>
                      <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:'#64748b',minWidth:22}}>{String(i+1).padStart(2,'0')}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:600,marginBottom:4}}>{q.t}</div>
                        <div style={{display:'flex',gap:6}}>
                          <span style={{fontSize:9,padding:'2px 6px',borderRadius:4,fontFamily:"'Space Mono',monospace",textTransform:'uppercase',
                            background:q.d==='Easy'?'rgba(16,185,129,.15)':q.d==='Medium'?'rgba(245,158,11,.15)':'rgba(239,68,68,.15)',
                            color:q.d==='Easy'?'#10b981':q.d==='Medium'?'#f59e0b':'#ef4444'
                          }}>{q.d}</span>
                          <span style={{fontSize:9,padding:'2px 6px',borderRadius:4,fontFamily:"'Space Mono',monospace",background:'rgba(59,130,246,.15)',color:'#3b82f6'}}>{q.topic}</span>
                        </div>
                      </div>
                      <div style={{fontSize:13}}>{solvedProblems.find(p=>p.t===q.t)?'✅':'⬜'}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Editor Panel */}
              <div style={{background:'#0d1117',border:'1px solid #2a3347',borderRadius:14,overflow:'hidden'}}>
                {/* Problem area */}
                {activeQ && (
                  <div style={{padding:'18px 22px',borderBottom:'1px solid #2a3347'}}>
                    <div style={{fontSize:18,fontWeight:800,marginBottom:8,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                      {activeQ.t}
                      <span style={{fontSize:10,padding:'3px 9px',borderRadius:100,fontFamily:"'Space Mono',monospace",fontWeight:700,
                        background:activeQ.d==='Easy'?'rgba(16,185,129,.15)':activeQ.d==='Medium'?'rgba(245,158,11,.15)':'rgba(239,68,68,.15)',
                        color:activeQ.d==='Easy'?'#10b981':activeQ.d==='Medium'?'#f59e0b':'#ef4444'
                      }}>{activeQ.d}</span>
                      <span style={{fontSize:10,padding:'3px 9px',borderRadius:100,fontFamily:"'Space Mono',monospace",fontWeight:700,background:'rgba(66,133,244,.15)',color:'#4285f4'}}>{currentCompany}</span>
                    </div>
                    <div style={{display:'flex',gap:14,marginBottom:12,flexWrap:'wrap'}}>
                      {[{l:'⏱',v:activeQ.time},{l:'💾',v:activeQ.space},{l:'✅',v:'Acceptance: 67%'},{l:'🏷',v:activeQ.topic}].map((m,i)=>(
                        <div key={i} style={{fontSize:11,color:'#64748b',fontFamily:"'Space Mono',monospace",display:'flex',alignItems:'center',gap:5}}>{m.l} <span style={{color:'#94a3b8'}}>{m.v}</span></div>
                      ))}
                    </div>
                    <div style={{fontSize:13,color:'#94a3b8',lineHeight:1.8,marginBottom:14}}>{activeQ.desc}</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                      {(activeQ.tc||[]).slice(0,2).map((tc,i)=>(
                        <div key={i} style={{background:'#161b27',borderRadius:9,padding:12,border:'1px solid #2a3347'}}>
                          <div style={{fontSize:10,color:'#00f5a0',fontFamily:"'Space Mono',monospace",fontWeight:700,textTransform:'uppercase',marginBottom:6}}>Example {i+1}</div>
                          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:'#94a3b8',lineHeight:1.6}}>Input: {tc.i}</div>
                          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:'#00f5a0',lineHeight:1.6}}>→ Output: {tc.o}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{background:'#161b27',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#94a3b8',fontFamily:"'JetBrains Mono',monospace",borderLeft:'3px solid #f59e0b'}}>
                      Constraints: 1 ≤ n ≤ 10⁴ | Values within 32-bit integer | Time limit: 1s
                    </div>
                  </div>
                )}

                {/* Solution Panel */}
                {showingSolution && activeQ && (
                  <div style={{background:'#0a0e17',borderBottom:'1px solid #2a3347',padding:'16px 20px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                      <span style={{fontSize:12,fontWeight:700,color:'#00f5a0',fontFamily:"'Space Mono',monospace",textTransform:'uppercase'}}>✅ Solution</span>
                      <button onClick={()=>setShowingSolution(false)} style={{background:'none',border:'none',color:'#64748b',cursor:'pointer',fontSize:14}}>✕</button>
                    </div>
                    <pre style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:'#e2e8f0',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{getSolCode()}</pre>
                    <div style={{marginTop:10,fontSize:11,color:'#64748b',fontFamily:"'Space Mono',monospace"}}>Time: <span style={{color:'#00f5a0'}}>{activeQ.time}</span> | Space: <span style={{color:'#00f5a0'}}>{activeQ.space}</span></div>
                  </div>
                )}

                {/* Toolbar */}
                <div style={{padding:'10px 14px',borderBottom:'1px solid #2a3347',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                  <div style={{position:'relative'}}>
                    <span style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',fontSize:12,color:'#64748b'}}>🔧</span>
                    <input value={langSearch} onChange={e=>{setLangSearch(e.target.value);setShowLangDrop(true)}} onFocus={()=>setShowLangDrop(true)} onBlur={()=>setTimeout(()=>setShowLangDrop(false),200)}
                      style={{background:'#161b27',border:'1px solid #2a3347',color:'#e2e8f0',borderRadius:8,padding:'6px 10px 6px 28px',fontFamily:"'Space Mono',monospace",fontSize:12,outline:'none',width:180}} />
                    {showLangDrop && (
                      <div style={{position:'absolute',top:'calc(100%+4px)',left:0,width:220,background:'#0d1117',border:'1px solid #2a3347',borderRadius:10,zIndex:50,maxHeight:180,overflowY:'auto'}}>
                        {filteredLangs.map(l=>(
                          <div key={l} onMouseDown={()=>{setSelectedLang(l);setLangSearch(l);setShowLangDrop(false);if(activeQ)loadProblemCode(activeQ);toast({title:`🔧 Language: ${l}`});}}
                            style={{padding:'8px 14px',cursor:'pointer',fontSize:12,fontFamily:"'Space Mono',monospace"}}>{l}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <span style={{fontSize:11,color:'#64748b',whiteSpace:'nowrap'}}>{ALL_LANGUAGES.length} languages</span>
                  <div style={{display:'flex',gap:6,marginLeft:'auto',flexWrap:'wrap'}}>
                    <button onClick={showSolution} style={{padding:'6px 14px',borderRadius:7,fontSize:11,fontWeight:700,cursor:'pointer',border:'1px solid rgba(16,185,129,.3)',background:'rgba(16,185,129,.15)',color:'#10b981',fontFamily:"'Syne',sans-serif",textTransform:'uppercase'}}>👁 {showingSolution?'Hide':'Show'} Solution</button>
                    <button onClick={saveFile} style={{padding:'6px 14px',borderRadius:7,fontSize:11,fontWeight:700,cursor:'pointer',border:'1px solid #2a3347',background:'#1e2535',color:'#e2e8f0',fontFamily:"'Syne',sans-serif",textTransform:'uppercase'}}>💾 Save</button>
                    <button onClick={()=>setShowSaveAs(true)} style={{padding:'6px 14px',borderRadius:7,fontSize:11,fontWeight:700,cursor:'pointer',border:'1px solid rgba(59,130,246,.3)',background:'#1e2535',color:'#3b82f6',fontFamily:"'Syne',sans-serif",textTransform:'uppercase'}}>📁 Save As</button>
                    <button onClick={runCode} style={{padding:'6px 14px',borderRadius:7,fontSize:11,fontWeight:700,cursor:'pointer',border:'none',background:'#00f5a0',color:'#000',fontFamily:"'Syne',sans-serif",textTransform:'uppercase'}}>▶ Run</button>
                    <button onClick={submitCode} style={{padding:'6px 14px',borderRadius:7,fontSize:11,fontWeight:700,cursor:'pointer',border:'none',background:'#7c3aed',color:'#fff',fontFamily:"'Syne',sans-serif",textTransform:'uppercase'}}>🚀 Submit</button>
                  </div>
                </div>

                {/* Code Editor */}
                <div style={{position:'relative'}}>
                  <div ref={lineNumRef} style={{position:'absolute',left:0,top:0,bottom:0,width:40,padding:'16px 6px',background:'#1e2535',fontFamily:"'JetBrains Mono',monospace",fontSize:13,color:'#64748b',lineHeight:1.65,textAlign:'right',userSelect:'none',pointerEvents:'none',borderRight:'1px solid #2a3347',overflow:'hidden'}} dangerouslySetInnerHTML={{__html:Array.from({length:Math.max((code.split('\n').length),15)},(_,i)=>i+1).join('<br/>')}} />
                  <textarea ref={codeRef} value={code} onChange={e=>{setCode(e.target.value);updateLineNums()}} onScroll={syncScroll} spellCheck={false}
                    style={{width:'100%',background:'#0a0e17',color:'#e2e8f0',fontFamily:"'JetBrains Mono',monospace",fontSize:13,lineHeight:1.65,padding:'16px 16px 16px 56px',border:'none',outline:'none',resize:'none',minHeight:240,tabSize:4}} />
                </div>

                {/* I/O Section */}
                <div style={{padding:'14px 18px',borderTop:'1px solid #2a3347'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                    <div style={{background:'#161b27',borderRadius:10,padding:12,border:'1px solid #2a3347'}}>
                      <div style={{fontSize:10,fontWeight:700,color:'#00f5a0',fontFamily:"'Space Mono',monospace",textTransform:'uppercase',marginBottom:6}}>📥 Custom Input</div>
                      <textarea value={customInput} onChange={e=>setCustomInput(e.target.value)} placeholder="Enter your input here..."
                        style={{width:'100%',background:'transparent',border:'none',outline:'none',color:'#e2e8f0',fontFamily:"'JetBrains Mono',monospace",fontSize:12,resize:'none',minHeight:70,lineHeight:1.6}} />
                    </div>
                    <div style={{background:'#161b27',borderRadius:10,padding:12,border:'1px solid #2a3347'}}>
                      <div style={{fontSize:10,fontWeight:700,color:'#00f5a0',fontFamily:"'Space Mono',monospace",textTransform:'uppercase',marginBottom:6}}>📤 Output</div>
                      <pre style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:'#00f5a0',lineHeight:1.6,whiteSpace:'pre-wrap',minHeight:70}}>{output}</pre>
                    </div>
                  </div>

                  {/* Test Cases */}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                    <div style={{fontSize:12,fontWeight:700,display:'flex',alignItems:'center',gap:8}}>🧪 Test Cases <span style={{fontSize:10,color:'#64748b',fontFamily:"'Space Mono',monospace"}}>{tcResults.length>0?`· ${tcResults.filter(r=>r.pass).length}/${tcResults.length} Passed`:'· Click Run to verify'}</span></div>
                  </div>
                  {activeQ && (
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
                      {(activeQ.tc||[]).slice(0,3).map((tc,i) => (
                        <div key={i} style={{background:'#161b27',borderRadius:9,padding:10,border:`1px solid ${tcResults[i]?.pass===true?'rgba(16,185,129,.5)':tcResults[i]?.pass===false?'rgba(239,68,68,.5)':'#2a3347'}`,
                          backgroundColor:tcResults[i]?.pass===true?'rgba(16,185,129,.04)':tcResults[i]?.pass===false?'rgba(239,68,68,.04)':'#161b27'}}>
                          <div style={{fontSize:10,color:'#64748b',fontFamily:"'Space Mono',monospace",marginBottom:5}}>Test {i+1} <span style={{float:'right',fontSize:14}}>{tcResults[i]?.pass===true?'✅':tcResults[i]?.pass===false?'❌':'⬜'}</span></div>
                          <div style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:'#94a3b8',marginBottom:3}}>Input: {tc.i}</div>
                          <div style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:'#10b981'}}>Expected: {tc.o}</div>
                          {tcResults[i] && <div style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",marginTop:3,color:tcResults[i].pass?'#10b981':'#ef4444'}}>Got: {tcResults[i].got}</div>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Analysis */}
                  {analysisVisible && activeQ && (
                    <div style={{background:'#161b27',borderRadius:10,padding:14,border:'1px solid #2a3347',marginBottom:12}}>
                      <div style={{fontSize:11,fontWeight:700,color:'#00f5a0',fontFamily:"'Space Mono',monospace",textTransform:'uppercase',marginBottom:10}}>📊 Code Analysis</div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
                        {[
                          {v:`${tcResults.filter(r=>r.pass).length}/${tcResults.length}`,l:'Tests Passed'},
                          {v:activeQ.time,l:'Time Complexity'},
                          {v:activeQ.space,l:'Space'},
                          {v:tcResults.every(r=>r.pass)?`${90+Math.floor(Math.random()*10)}%`:`${Math.floor(Math.random()*60+20)}%`,l:'Score'},
                        ].map((a,i)=>(
                          <div key={i} style={{background:'#1e2535',borderRadius:8,padding:10,textAlign:'center'}}>
                            <div style={{fontSize:18,fontWeight:700,fontFamily:"'Space Mono',monospace",color:i===3?'#10b981':'#00f5a0'}}>{a.v}</div>
                            <div style={{fontSize:9,color:'#64748b',textTransform:'uppercase',letterSpacing:.5,marginTop:2}}>{a.l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Panel */}
                  <div style={{background:'linear-gradient(135deg,rgba(124,58,237,.1),rgba(0,245,160,.05))',border:'1px solid rgba(124,58,237,.25)',borderRadius:12,padding:'16px 20px',marginTop:14}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                      <div style={{background:'linear-gradient(135deg,#4285f4,#0f9d58,#f4b400,#db4437)',borderRadius:7,padding:'5px 10px',fontSize:11,fontWeight:700,color:'#fff',fontFamily:"'Space Mono',monospace"}}>✨ Gemini AI</div>
                      <div style={{fontSize:14,fontWeight:700}}>AI Code Assistant</div>
                    </div>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                      {[{k:'hint' as const,l:'💡 Hint',c:'#f59e0b'},{k:'explain' as const,l:'📖 Explain',c:'#3b82f6'},{k:'optimize' as const,l:'⚡ Optimize',c:'#00f5a0'},{k:'review' as const,l:'🔍 Review',c:'#ef4444'}].map(btn=>(
                        <button key={btn.k} onClick={()=>aiAction(btn.k)} style={{padding:'6px 14px',borderRadius:7,fontSize:11,fontWeight:600,cursor:'pointer',border:`1px solid ${btn.c}`,color:btn.c,background:`${btn.c}11`,fontFamily:"'Space Mono',monospace",textTransform:'uppercase'}}>{btn.l}</button>
                      ))}
                    </div>
                    {(aiLoading || aiResponse) && (
                      <div style={{marginTop:12,background:'rgba(0,0,0,.3)',borderRadius:9,padding:14,fontSize:12,color:'#94a3b8',lineHeight:1.7,fontFamily:"'JetBrains Mono',monospace",border:'1px solid #2a3347',whiteSpace:'pre-wrap'}}>
                        {aiLoading ? '⏳ AI thinking...' : aiResponse}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Question Boxes */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,marginTop:32}}>
              {/* Company Interview Questions */}
              <div style={{background:'#0d1117',border:'1px solid #2a3347',borderRadius:14,overflow:'hidden'}}>
                <div style={{padding:'16px 20px',borderBottom:'1px solid #2a3347',background:'linear-gradient(135deg,#161b27,#0d1117)'}}>
                  <div style={{fontSize:15,fontWeight:800,marginBottom:4,display:'flex',alignItems:'center',gap:9}}>🏢 Company Interview Questions</div>
                  <div style={{fontSize:11,color:'#64748b',fontFamily:"'Space Mono',monospace"}}>Topic-based · 20 Questions Per Level</div>
                </div>
                <div style={{display:'flex',gap:6,padding:'12px 16px',borderBottom:'1px solid #2a3347',flexWrap:'wrap'}}>
                  {[{k:'easy',l:'Easy (20)',c:'#10b981'},{k:'med',l:'Medium (20)',c:'#f59e0b'},{k:'hard',l:'Hard (20)',c:'#ef4444'},{k:'master',l:'Master (20)',c:'#7c3aed'}].map(lv=>(
                    <button key={lv.k} onClick={()=>setQboxLevel1(lv.k)} style={{padding:'5px 12px',borderRadius:7,fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'Space Mono',monospace",textTransform:'uppercase',
                      border:`1px solid ${qboxLevel1===lv.k?lv.c:'#2a3347'}`,
                      background:qboxLevel1===lv.k?`${lv.c}22`:'#161b27',
                      color:qboxLevel1===lv.k?lv.c:'#64748b'
                    }}>{lv.l}</button>
                  ))}
                </div>
                <div style={{maxHeight:320,overflowY:'auto'}}>
                  {qboxQuestions().map((q,i)=>(
                    <div key={i} onClick={()=>{selectQuestion(q);setCurrentPage('practice');}} style={{display:'flex',alignItems:'center',gap:9,padding:'9px 14px',cursor:'pointer'}}>
                      <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:'#64748b',minWidth:20}}>{String(i+1).padStart(2,'0')}</div>
                      <div style={{fontSize:12,flex:1}}>{q.t}</div>
                      <span style={{fontSize:9,padding:'2px 6px',borderRadius:4,fontFamily:"'Space Mono',monospace",
                        background:q.d==='Easy'?'rgba(16,185,129,.15)':q.d==='Medium'?'rgba(245,158,11,.15)':'rgba(239,68,68,.15)',
                        color:q.d==='Easy'?'#10b981':q.d==='Medium'?'#f59e0b':'#ef4444'
                      }}>{q.d}</span>
                      <div style={{fontSize:12}}>{solvedProblems.find(p=>p.t===q.t)?'✅':'⬜'}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CS MCQ */}
              <div style={{background:'#0d1117',border:'1px solid #2a3347',borderRadius:14,overflow:'hidden'}}>
                <div style={{padding:'16px 20px',borderBottom:'1px solid #2a3347',background:'linear-gradient(135deg,#161b27,#0d1117)'}}>
                  <div style={{fontSize:15,fontWeight:800,marginBottom:4,display:'flex',alignItems:'center',gap:9}}>🖥 General CS — MCQ Practice</div>
                  <div style={{fontSize:11,color:'#64748b',fontFamily:"'Space Mono',monospace"}}>Select topic → Generate MCQ with Explanation</div>
                </div>
                <div style={{padding:'10px 14px',borderBottom:'1px solid #2a3347',position:'relative'}}>
                  <span style={{position:'absolute',left:22,top:'50%',transform:'translateY(-50%)',fontSize:12,color:'#64748b'}}>🔍</span>
                  <input value={topicSearch} onChange={e=>setTopicSearch(e.target.value)} placeholder="Search topic..."
                    style={{width:'100%',background:'#161b27',border:'1px solid #2a3347',color:'#e2e8f0',borderRadius:8,padding:'8px 12px 8px 30px',fontFamily:"'Space Mono',monospace",fontSize:11,outline:'none'}} />
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6,padding:'10px 14px',borderBottom:'1px solid #2a3347'}}>
                  {filteredTopics.map(t=>(
                    <button key={t} onClick={()=>setActiveTopic(t)} style={{padding:'5px 10px',borderRadius:7,fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:"'Space Mono',monospace",textTransform:'uppercase',
                      border:`1px solid ${activeTopic===t?'#3b82f6':'#2a3347'}`,
                      background:activeTopic===t?'rgba(59,130,246,.15)':'#161b27',
                      color:activeTopic===t?'#3b82f6':'#64748b'
                    }}>{t}</button>
                  ))}
                </div>
                <div style={{maxHeight:400,overflowY:'auto'}}>
                  {currentMCQs.map((q,idx) => (
                    <div key={`${activeTopic}-${idx}`} style={{padding:'14px 16px',borderBottom:'1px solid #2a3347'}}>
                      <div style={{fontSize:13,fontWeight:600,marginBottom:12,lineHeight:1.6}}>Q{idx+1}. {q.q}</div>
                      <div style={{display:'flex',flexDirection:'column',gap:7}}>
                        {q.opts.map((o,oi) => (
                          <div key={oi} onClick={()=>{if(!mcqSubmitted[idx]){setMcqAnswers(prev=>({...prev,[idx]:oi}))}}}
                            style={{display:'flex',alignItems:'center',gap:10,padding:'9px 13px',borderRadius:8,cursor:'pointer',fontSize:12,
                              border:`1px solid ${mcqSubmitted[idx]?(oi===q.ans?'#10b981':mcqAnswers[idx]===oi?'#ef4444':'#2a3347'):(mcqAnswers[idx]===oi?'#3b82f6':'#2a3347')}`,
                              background: mcqSubmitted[idx]?(oi===q.ans?'rgba(16,185,129,.1)':mcqAnswers[idx]===oi?'rgba(239,68,68,.1)':'transparent'):(mcqAnswers[idx]===oi?'rgba(59,130,246,.1)':'transparent')
                            }}>
                            <div style={{width:24,height:24,borderRadius:'50%',background:'#1e2535',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,fontFamily:"'Space Mono',monospace",flexShrink:0}}>
                              {['A','B','C','D'][oi]}
                            </div>
                            {o}
                          </div>
                        ))}
                      </div>
                      {!mcqSubmitted[idx] && (
                        <button onClick={()=>{
                          if(mcqAnswers[idx]===undefined){toast({title:'⚠️ Select an answer first!'});return;}
                          setMcqSubmitted(prev=>({...prev,[idx]:true}));
                          toast({title:mcqAnswers[idx]===q.ans?'✅ Correct! Well done!':'❌ Wrong. Read the explanation below.'});
                        }} style={{marginTop:12,padding:'9px 20px',borderRadius:8,fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:700,cursor:'pointer',border:'none',background:'#7c3aed',color:'#fff'}}>Submit Answer</button>
                      )}
                      {mcqSubmitted[idx] && (
                        <div style={{marginTop:12,background:'rgba(0,245,160,.06)',border:'1px solid rgba(0,245,160,.2)',borderRadius:9,padding:12,fontSize:12,color:'#94a3b8',lineHeight:1.7}}>
                          <div style={{fontSize:11,fontWeight:700,color:'#00f5a0',fontFamily:"'Space Mono',monospace",textTransform:'uppercase',marginBottom:6}}>📖 Explanation</div>
                          {q.exp}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Platforms */}
            <div style={{marginTop:28}}>
              <div style={{fontSize:13,fontWeight:600,color:'#00f5a0',textTransform:'uppercase',letterSpacing:2,fontFamily:"'Space Mono',monospace",marginBottom:12}}>Also Explore</div>
            </div>
            <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
              {[
                {emoji:'⚡',name:'LeetCode',desc:'Industry Standard',url:'https://leetcode.com'},
                {emoji:'🧑‍💻',name:'GeeksForGeeks',desc:'Concept Deep Dives',url:'https://www.geeksforgeeks.org'},
                {emoji:'🥷',name:'Coding Ninjas',desc:'Structured Learning',url:'https://www.codingninjas.com'},
                {emoji:'🐉',name:'CodeTantra',desc:'College Platform',url:'https://codetantra.com'},
                {emoji:'🎯',name:'HackerRank',desc:'Skill Certification',url:'https://www.hackerrank.com'},
                {emoji:'🏅',name:'Codeforces',desc:'Competitive Contests',url:'https://codeforces.com'},
              ].map(p=>(
                <div key={p.name} onClick={()=>window.open(p.url,'_blank')} style={{flex:1,minWidth:140,background:'#0d1117',border:'1px solid #2a3347',borderRadius:11,padding:16,textAlign:'center',cursor:'pointer',transition:'all .2s'}}>
                  <div style={{fontSize:24,marginBottom:7}}>{p.emoji}</div>
                  <div style={{fontSize:12,fontWeight:700,marginBottom:3}}>{p.name}</div>
                  <div style={{fontSize:10,color:'#64748b',fontFamily:"'Space Mono',monospace"}}>{p.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== LEADERBOARD ===== */}
        {currentPage === 'leaderboard' && (
          <div style={{padding:'24px 28px 48px'}}>
            <div style={{fontSize:13,fontWeight:600,color:'#00f5a0',textTransform:'uppercase',letterSpacing:2,fontFamily:"'Space Mono',monospace",marginBottom:6}}>Rankings</div>
            <div style={{fontSize:22,fontWeight:800,marginBottom:18}}>Global Leaderboard</div>
            <div style={{background:'#0d1117',border:'1px solid #2a3347',borderRadius:14,overflow:'hidden'}}>
              <div style={{display:'grid',gridTemplateColumns:'60px 1fr 120px 120px 100px',padding:'12px 20px',background:'#161b27',borderBottom:'1px solid #2a3347',fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:1,fontFamily:"'Space Mono',monospace"}}>
                <div>Rank</div><div>Student</div><div>Score</div><div>Solved</div><div>Streak</div>
              </div>
              {getLBData().map((r,i) => (
                <div key={i} style={{display:'grid',gridTemplateColumns:'60px 1fr 120px 120px 100px',padding:'14px 20px',borderBottom:'1px solid rgba(42,51,71,.5)',alignItems:'center',
                  background:r.you?'rgba(0,245,160,.06)':'transparent',borderLeft:r.you?'3px solid #00f5a0':'none'}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:15,fontWeight:700,color:i===0?'#f59e0b':i===1?'#94a3b8':i===2?'#cd7c47':'inherit'}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}</div>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:32,height:32,borderRadius:'50%',background:AVATAR_COLORS[i%10],display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700}}>{r.name[0]}</div>
                    <div>
                      <div style={{fontSize:14,fontWeight:600}}>{r.name}{r.you?' (You)':''}</div>
                      <div style={{fontSize:11,color:'#64748b'}}>{r.college}</div>
                    </div>
                  </div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:14,fontWeight:700,color:'#00f5a0'}}>{r.score.toLocaleString()}</div>
                  <div style={{fontSize:13,color:'#94a3b8'}}>{r.solved} problems</div>
                  <div style={{display:'flex',alignItems:'center',gap:4,fontSize:12,color:'#f97316'}}>🔥 {r.streak} days</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== PROFILE ===== */}
        {currentPage === 'profile' && (
          <div style={{padding:'24px 28px 48px'}}>
            <div style={{fontSize:13,fontWeight:600,color:'#00f5a0',textTransform:'uppercase',letterSpacing:2,fontFamily:"'Space Mono',monospace",marginBottom:6}}>Your Account</div>
            <div style={{fontSize:22,fontWeight:800,marginBottom:18}}>Student Profile</div>
            <div style={{display:'grid',gridTemplateColumns:'320px 1fr',gap:20}}>
              <div style={{background:'#0d1117',border:'1px solid #2a3347',borderRadius:14,padding:28,textAlign:'center'}}>
                <div style={{width:80,height:80,borderRadius:'50%',background:'linear-gradient(135deg,#7c3aed,#00f5a0)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:30,fontWeight:700,margin:'0 auto 14px'}}>S</div>
                <div style={{fontSize:22,fontWeight:800,marginBottom:4}}>Student</div>
                <div style={{fontSize:13,color:'#64748b',fontFamily:"'Space Mono',monospace",marginBottom:4}}>student@email.com</div>
                <div style={{fontSize:12,color:'#64748b',marginBottom:20}}>Joined: {new Date().toLocaleDateString()}</div>
                <div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap',marginBottom:20}}>
                  <span style={{padding:'4px 12px',borderRadius:100,fontSize:11,fontWeight:700,fontFamily:"'Space Mono',monospace",background:'rgba(16,185,129,.15)',color:'#10b981',border:'1px solid rgba(16,185,129,.3)'}}>🔥 Active Learner</span>
                  <span style={{padding:'4px 12px',borderRadius:100,fontSize:11,fontWeight:700,fontFamily:"'Space Mono',monospace",background:'rgba(245,158,11,.15)',color:'#f59e0b',border:'1px solid rgba(245,158,11,.3)'}}>⭐ Rising Star</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  {[{v:solved,l:'Solved'},{v:streak,l:'Streak'},{v:score,l:'Score'},{v:rank,l:'Rank'}].map((s,i)=>(
                    <div key={i} style={{background:'#161b27',borderRadius:10,padding:12,textAlign:'center'}}>
                      <div style={{fontFamily:"'Space Mono',monospace",fontSize:20,fontWeight:700,color:'#00f5a0'}}>{s.v}</div>
                      <div style={{fontSize:11,color:'#64748b',textTransform:'uppercase'}}>{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                <div style={{background:'#0d1117',border:'1px solid #2a3347',borderRadius:14,padding:20}}>
                  <div style={{fontSize:14,fontWeight:700,marginBottom:14}}>📈 Solved by Difficulty</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:10}}>
                    {[{v:easySolved,l:'Easy',c:'#10b981'},{v:medSolved,l:'Medium',c:'#f59e0b'},{v:hardSolved,l:'Hard',c:'#ef4444'},{v:masterSolved,l:'Master',c:'#7c3aed'}].map((s,i)=>(
                      <div key={i} style={{background:'#161b27',borderRadius:10,padding:12,textAlign:'center'}}>
                        <div style={{fontFamily:"'Space Mono',monospace",fontSize:20,fontWeight:700,color:s.c}}>{s.v}</div>
                        <div style={{fontSize:11,color:'#64748b',textTransform:'uppercase'}}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{background:'#0d1117',border:'1px solid #2a3347',borderRadius:14,padding:20}}>
                  <div style={{fontSize:14,fontWeight:700,marginBottom:14}}>📋 Solved Problems History</div>
                  {solvedProblems.length === 0 ? (
                    <div style={{fontSize:13,color:'#64748b',textAlign:'center',padding:20}}>No problems solved yet. Start practicing!</div>
                  ) : solvedProblems.slice().reverse().map((p,i) => (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'9px 0',borderBottom:'1px solid rgba(42,51,71,.5)'}}>
                      <div style={{fontSize:16}}>{p.d==='Easy'?'🟢':p.d==='Medium'?'🟡':'🔴'}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:600}}>{p.t}</div>
                        <div style={{fontSize:11,color:'#64748b',fontFamily:"'Space Mono',monospace"}}>{p.company} · {p.d} · {p.topic} · {p.lang}</div>
                      </div>
                      <div style={{fontSize:11,color:'#64748b'}}>{p.time}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer style={{borderTop:'1px solid #2a3347',padding:'20px 28px',display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:12,color:'#64748b'}}>
          <div style={{fontFamily:"'Space Mono',monospace",color:'#00f5a0',fontWeight:700}}>⚡ CodeArena Pro</div>
          <div>Daily Updated · AI Powered · 1600+ Languages</div>
        </footer>
      </div>

      {/* Save As Modal */}
      {showSaveAs && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}} onClick={()=>setShowSaveAs(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#0d1117',border:'1px solid #2a3347',borderRadius:16,padding:28,maxWidth:440,width:'90%',position:'relative'}}>
            <button onClick={()=>setShowSaveAs(false)} style={{position:'absolute',top:14,right:14,background:'#161b27',border:'none',color:'#94a3b8',width:26,height:26,borderRadius:'50%',cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            <h3 style={{fontSize:18,fontWeight:800,marginBottom:6}}>💾 Save As</h3>
            <p style={{fontSize:13,color:'#94a3b8',marginBottom:20}}>Choose filename and format to save to your PC.</p>
            <input value={saveFilename} onChange={e=>setSaveFilename(e.target.value)} placeholder="solution"
              style={{width:'100%',background:'#161b27',border:'1px solid #2a3347',color:'#e2e8f0',borderRadius:8,padding:'9px 12px',fontFamily:"'Space Mono',monospace",fontSize:13,outline:'none',marginBottom:10}} />
            <select value={saveFormat} onChange={e=>setSaveFormat(e.target.value)}
              style={{width:'100%',background:'#161b27',border:'1px solid #2a3347',color:'#e2e8f0',borderRadius:8,padding:'9px 12px',fontFamily:"'Space Mono',monospace",fontSize:13,outline:'none',marginBottom:10}}>
              {['.py','.java','.cpp','.js','.ts','.go','.rs','.c','.cs','.kt','.swift','.rb','.txt'].map(ext=>(
                <option key={ext} value={ext}>{ext}</option>
              ))}
            </select>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setShowSaveAs(false)} style={{padding:'8px 18px',borderRadius:8,fontFamily:"'Syne',sans-serif",fontSize:12,fontWeight:700,cursor:'pointer',border:'none',background:'#1e2535',color:'#94a3b8'}}>Cancel</button>
              <button onClick={confirmSaveAs} style={{padding:'8px 18px',borderRadius:8,fontFamily:"'Syne',sans-serif",fontSize:12,fontWeight:700,cursor:'pointer',border:'none',background:'#00f5a0',color:'#000'}}>💾 Save to PC</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.6}}
        @media(max-width:900px){
          .coding-grid-override{grid-template-columns:1fr !important;}
        }
      `}</style>
    </div>
  );
};

export default MasteryChallenge;

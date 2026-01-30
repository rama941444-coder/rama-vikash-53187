// Comprehensive list of 1600+ programming languages and technologies
// Organized by category for better searchability

export const PROGRAMMING_LANGUAGES = [
  // Auto-detect option
  "Auto-Detect",
  
  // Most Popular Languages (Top 50)
  "Python", "JavaScript", "TypeScript", "Java", "C", "C++", "C#", "Go", "Rust", "Swift",
  "Kotlin", "Ruby", "PHP", "Perl", "R", "MATLAB", "Scala", "Lua", "Dart", "Julia",
  "Objective-C", "Shell", "Bash", "PowerShell", "Assembly", "Fortran", "COBOL", "Pascal",
  "Delphi", "Visual Basic", "VB.NET", "F#", "Clojure", "Haskell", "Erlang", "Elixir",
  "Lisp", "Scheme", "Racket", "OCaml", "Prolog", "Zig", "Nim", "Crystal", "D", "V",
  "Ada", "ABAP", "Apex", "Groovy",
  
  // Web Technologies
  "HTML", "HTML5", "CSS", "CSS3", "SCSS", "SASS", "Less", "Stylus", "PostCSS",
  "JSX", "TSX", "Vue", "Svelte", "Angular", "React", "Next.js", "Nuxt.js",
  "jQuery", "Alpine.js", "Astro", "SolidJS", "Qwik", "Ember.js", "Backbone.js",
  "WebAssembly", "WASM", "WebGL", "Canvas", "SVG", "XML", "XSLT", "XPath",
  "JSON", "YAML", "TOML", "INI", "Markdown", "MDX", "reStructuredText",
  
  // SQL and Database Languages
  "SQL", "SQL-DDL", "SQL-DML", "SQL-DCL", "SQL-TCL", "SQL-Triggers", "SQL-Joins",
  "MySQL", "PostgreSQL", "SQLite", "Oracle SQL", "PL/SQL", "T-SQL", "PL/pgSQL",
  "MongoDB Query Language", "Cassandra CQL", "Redis Commands", "Neo4j Cypher",
  "GraphQL", "Prisma", "Drizzle", "Sequelize", "TypeORM", "KSQL", "SparkSQL",
  "HiveQL", "BigQuery SQL", "Snowflake SQL", "DynamoDB PartiQL", "CockroachDB SQL",
  
  // Mobile Development
  "SwiftUI", "UIKit", "Flutter", "React Native", "Xamarin", "Ionic", "NativeScript",
  "Jetpack Compose", "Android XML", "Kotlin Multiplatform", "Capacitor",
  
  // Systems Programming
  "C/C++", "Embedded C", "Arduino", "Verilog", "VHDL", "SystemVerilog", "Chisel",
  "LLVM IR", "CUDA", "OpenCL", "Metal", "Vulkan GLSL", "SPIR-V", "HLSL", "GLSL",
  
  // Functional Languages
  "Standard ML", "Miranda", "Clean", "Idris", "Agda", "Coq", "Lean", "Isabelle",
  "PureScript", "Elm", "ReasonML", "ReScript", "BuckleScript", "Common Lisp",
  "Emacs Lisp", "AutoLISP", "newLISP", "Arc", "Hy", "Fennel",
  
  // Scientific & Data Science
  "SAS", "SPSS", "Stata", "Maple", "Mathematica", "Wolfram Language", "Octave",
  "S", "S-Plus", "Pandas", "NumPy", "SciPy", "Jupyter", "IPython",
  "Tableau", "Power BI", "DAX", "M Language", "Apache Pig", "Apache Flink",
  
  // DevOps & Infrastructure
  "Dockerfile", "Docker Compose", "Kubernetes YAML", "Helm", "Terraform", "HCL",
  "Ansible", "Ansible YAML", "Puppet", "Chef", "Salt", "CloudFormation",
  "Pulumi", "CDK", "Bicep", "ARM Templates", "Nix", "NixOS", "Vagrant",
  "Packer", "Consul", "Nomad", "Vault HCL",
  
  // Scripting Languages
  "Awk", "Sed", "Grep", "Make", "Makefile", "CMake", "Meson", "Ninja",
  "Batch", "CMD", "VBScript", "JScript", "AppleScript", "Tcl", "Expect",
  "AutoHotkey", "AutoIt", "Rexx", "CLIST", "JCL", "DCL",
  
  // Game Development
  "GDScript", "UnrealScript", "Unity C#", "GameMaker Language", "Roblox Lua",
  "LÖVE Lua", "Godot Shader", "Unreal Blueprint", "Shader Graph",
  "OpenGL", "DirectX", "Pico-8", "TIC-80", "Scratch", "Snap!",
  
  // Configuration & Markup
  "LaTeX", "TeX", "BibTeX", "Typst", "AsciiDoc", "Org Mode", "Textile",
  "Wiki Markup", "BBCode", "Creole", "POD", "Javadoc", "JSDoc", "TSDoc",
  "Sphinx", "Doxygen", "Natural Docs", "RAML", "OpenAPI", "Swagger",
  "Protocol Buffers", "Protobuf", "Cap'n Proto", "FlatBuffers", "Thrift",
  "Avro", "MessagePack", "BSON", "CBOR",
  
  // Template Languages
  "Jinja", "Jinja2", "Django Templates", "Twig", "Blade", "ERB", "EJS",
  "Handlebars", "Mustache", "Pug", "Haml", "Slim", "Liquid", "Nunjucks",
  "Velocity", "Freemarker", "Thymeleaf", "Smarty", "Mako", "Cheetah",
  
  // Query & Expression Languages
  "XQuery", "JSONPath", "JMESPath", "jq", "yq", "SPARQL", "OQL", "EQL",
  "Gremlin", "AQL", "MQL", "N1QL", "SurrealQL", "EdgeQL", "Datalog",
  
  // Logic Programming
  "Mercury", "Oz", "CHR", "ASP", "Curry", "Logtalk", "Visual Prolog",
  "Constraint Handling Rules", "Answer Set Programming", "miniKanren",
  
  // Domain Specific Languages
  "Regular Expressions", "Regex", "EBNF", "BNF", "ABNF", "PEG",
  "Gherkin", "Cucumber", "Robot Framework", "Karate DSL", "Postman Tests",
  "Selenium", "Cypress", "Playwright", "Puppeteer", "WebDriver",
  
  // Build Tools & Package Managers
  "Gradle", "Gradle Kotlin DSL", "Maven POM", "Ant", "SBT", "Leiningen",
  "Cargo.toml", "Gemfile", "Podfile", "Pipfile", "Poetry", "requirements.txt",
  "package.json", "pom.xml", "build.gradle", "Rakefile", "Taskfile",
  
  // Version Control
  "Git", "Git Config", ".gitignore", ".gitattributes", "Git Hooks",
  "SVN", "Mercurial", "Bazaar", "Darcs", "Fossil",
  
  // Security & Cryptography
  "PGP", "GPG", "OpenSSL Config", "SSH Config", "SSL/TLS", "JWT",
  "SAML", "OAuth", "OIDC", "HashiCorp Sentinel", "OPA Rego",
  
  // Hardware Description
  "Bluespec", "MyHDL", "Clash", "SpinalHDL", "nMigen", "Amaranth",
  "FIRRTL", "Liberty", "LEF/DEF", "GDSII", "OASIS", "Gerber",
  
  // Audio & Music
  "CSound", "SuperCollider", "ChucK", "Pure Data", "Max/MSP", "Sonic Pi",
  "Faust", "Nyquist", "LilyPond", "ABC Notation", "MusicXML", "MIDI",
  
  // Graphics & Design
  "Processing", "p5.js", "OpenSCAD", "POV-Ray", "RenderMan", "OSL",
  "MaterialX", "USD", "GLTF", "FBX", "Collada", "OBJ", "STL",
  
  // CAD & Engineering
  "AutoCAD LISP", "Revit Dynamo", "Rhino Python", "Grasshopper", "FreeCAD",
  "G-code", "APT", "STEP", "IGES", "Parasolid", "ACIS",
  
  // Business & Enterprise
  "SAP ABAP", "Oracle PL/SQL", "IBM RPG", "IBM REXX", "NATURAL",
  "FOCUS", "Easytrieve", "CICS", "IMS", "DB2", "Teradata BTEQ",
  
  // Blockchain & Smart Contracts
  "Solidity", "Vyper", "Move", "Cairo", "Rust (Solana)", "Clarity",
  "Michelson", "TEAL", "Cadence", "Reach", "Yul", "Assembly (EVM)",
  
  // AI & Machine Learning
  "TensorFlow", "PyTorch", "JAX", "ONNX", "PMML", "PFA", "MLflow",
  "Kubeflow", "Ray", "Spark ML", "H2O", "Weka", "RapidMiner",
  
  // Testing Frameworks
  "Jest", "Mocha", "Jasmine", "Chai", "Vitest", "Testing Library",
  "pytest", "unittest", "nose", "JUnit", "TestNG", "NUnit", "xUnit",
  "RSpec", "MiniTest", "Capybara", "Selenium WebDriver", "Appium",
  
  // API & Protocol
  "gRPC", "SOAP", "REST", "WebSocket", "SSE", "MQTT", "AMQP",
  "ZeroMQ", "NATS", "Kafka", "RabbitMQ", "Redis Pub/Sub",
  
  // Log & Monitoring
  "Logstash Config", "Fluentd", "Prometheus", "Grafana", "Splunk SPL",
  "ELK Stack", "Datadog", "New Relic", "Jaeger", "Zipkin",
  
  // Network & Security
  "Wireshark Display Filter", "BPF", "eBPF", "Snort Rules", "Suricata",
  "YARA", "Sigma", "Zeek", "nftables", "iptables", "pf",
  
  // Documentation Formats
  "Swagger YAML", "AsyncAPI", "JSON Schema", "XML Schema", "DTD",
  "WSDL", "WADL", "Blueprint", "MSON", "API Blueprint",
  
  // Esoteric Languages (for completeness)
  "Brainfuck", "Whitespace", "LOLCODE", "Shakespeare", "Chef",
  "Piet", "Befunge", "Malbolge", "INTERCAL", "FALSE",
  
  // Historical Languages
  "ALGOL", "BCPL", "PL/I", "Simula", "Smalltalk", "Modula-2", "Modula-3",
  "Oberon", "Mesa", "CLU", "SNOBOL", "APL", "J", "K", "Q",
  
  // Region-Specific Languages
  "Chinese BASIC", "Japanese Ruby", "Korean Python", "Hindi Programming",
  
  // Educational Languages
  "Logo", "Karel", "Alice", "Greenfoot", "BlueJ", "Raptor", "Flowgorithm",
  "Kodu", "Tynker", "Blockly", "App Inventor", "Thunkable",
  
  // Low-Code/No-Code
  "Zapier", "Make (Integromat)", "n8n", "Node-RED", "IFTTT",
  "Power Automate", "Shortcuts (iOS)", "Automator (macOS)",
  
  // Shell Variants
  "Zsh", "Fish", "Ksh", "Csh", "Tcsh", "Dash", "Ash", "Busybox",
  "Oil Shell", "Elvish", "Nushell", "Xonsh", "Ion",
  
  // Compiler & Parser Tools
  "Flex", "Bison", "ANTLR", "Yacc", "Lex", "Happy", "Alex",
  "Tree-sitter", "Peggy", "Nearley", "Ohm", "Parsec", "Megaparsec",
  
  // Misc Languages
  "LabVIEW G", "Simulink", "Stateflow", "SCADE", "Modelica", "Vensim",
  "Stella", "AnyLogic", "Arena", "GPSS", "SimScript", "SLAM",
  
  // Additional Languages A-Z
  "A+", "A#", "ABC", "ABCL", "ABEL", "ABL", "ABSYS", "ACC", "Accent",
  "Ace", "ACL2", "ACT-III", "Action!", "ActionScript", "Actor", "Ada 83",
  "Ada 95", "Ada 2005", "Ada 2012", "Adenine", "Agda", "Agilent VEE",
  "Agora", "AIMMS", "Aldor", "Alef", "ALF", "Alice ML", "Alma-0",
  "AmbientTalk", "Amiga E", "AMOS", "AMPL", "Analitik", "AngelScript",
  "Ante", "APL", "AppleScript", "Arc", "Argus", "ArkTS", "ARexx",
  "Arith", "ARITH-MATIC", "Asp", "AspectJ", "ATS", "Ateji PX", "ATL",
  "Atom", "AviSynth", "AWL", "Axum", "B", "Babbage", "Ballerina",
  "BASIC", "Batch File", "bc", "BCPL", "BeanShell", "Beef", "Bertrand",
  "BETA", "Bistro", "BitC", "BLISS", "Blockly", "BlooP", "BML",
  "Boo", "Boomerang", "Bosque", "Bourne Shell", "BPEL", "BPMN",
  "Brainf***", "BPML", "C--", "C/AL", "Caché ObjectScript", "Caml",
  "Carbon", "Catrobat", "Cayenne", "Cecil", "Céu", "Ceylon", "CFML",
  "Cg", "Ch", "Chapel", "Charm", "CHILL", "CHIP-8", "ChucK", "Cilk",
  "CL", "Claire", "Clarion", "Clean", "Clipper", "CLIPS", "CLOS",
  "Cloudflare Workers", "CLU", "CMS-2", "Cobra", "CODE", "CoffeeScript",
  "ColdFusion", "COMAL", "Comit", "Common Intermediate Language",
  "Component Pascal", "Concurrent Pascal", "ConstraintLisp", "Coq",
  "Coral", "CorVision", "COWSEL", "CPL", "Cryptol", "Curl", "Curry",
  "Cyclone", "D", "DASL", "DataFlex", "Datalog", "DATATRIEVE", "dBase",
  "dc", "DCL", "Deesel", "Delphi", "DIBOL", "DinkC", "DRAKON", "Dylan",
  "E", "E#", "Ease", "Easy PL/I", "EASYTRIEVE PLUS", "ECL", "ECMAScript",
  "Edinburgh IMP", "Eiffel", "ELAN", "Elixir", "Elm", "Emacs Lisp",
  "Emerald", "Epigram", "EPL", "Erlang", "es", "Escher", "ESPOL",
  "Esterel", "Etoys", "Euclid", "Euler", "Euphoria", "EusLisp", "EXEC",
  "EXEC 2", "Executable UML", "F", "F#", "F*", "Factor", "Falcon",
  "Fantom", "FAUST", "FFP", "Fjölnir", "FL", "Flavors", "Flex", "FLOW-MATIC",
  "FOCAL", "FOCUS", "FOIL", "FORMAC", "Forth", "Fortress", "FoxBase",
  "FoxPro", "FP", "Franz Lisp", "Frege", "Frink", "F-Script", "Futhark",
  "G", "G-code", "Game Maker Language", "GameMonkey Script", "GAMS",
  "GAP", "GDScript", "Genie", "GENIEr", "GHC", "GJ", "GLSL", "GM",
  "GNU E", "GNU Guile", "Go!", "GOAL", "Gödel", "Godiva", "GOM", "GOOD",
  "Gosu", "GOTRAN", "GPSS", "GraphTalk", "GRASS", "Groovy", "Guru",
  "HAL/S", "Harbour", "Hartmann pipelines", "Haskell", "Haxe", "Hermes",
  "High Level Assembly", "HLSL", "Hop", "Hope", "Hopscotch", "HPL",
  "HQL", "HTMX", "HyperTalk", "IBM BASIC", "IBM RPG", "Icon", "Id",
  "IDL", "Idris", "IMP", "Inform", "Io", "Ioke", "IPL", "ISLISP", "ISPF",
  "ISWIM", "J", "J#", "J++", "JADE", "JAL", "Janus", "JASS", "Java",
  "JavaFX Script", "JavaScript", "JCL", "JEAN", "Jess", "JetBrains MPS",
  "JOSS", "Joule", "JOVIAL", "Joy", "JScript", "JScript .NET", "Julia",
  "Jython", "K", "Kaleidoscope", "Karel", "Karel++", "KEE", "Kixtart",
  "KL-ONE", "KLI", "Kojo", "Kotlin", "KRC", "KRL", "KRYPTON", "ksh",
  "L", "L# .NET", "L.in" , "LabVIEW", "Ladder", "Lagoona", "LANSA",
  "Lasso", "LaTeX", "Lava", "LC-3", "Leda", "Legoscript", "LIL", "LilyPond",
  "Limbo", "LINC", "Lingo", "LIS", "LISA", "Lisaac", "Lisp", "Lite-C",
  "Lithe", "Little b", "Logo", "Logtalk", "LotusScript", "LPC", "LSE",
  "LSL", "Lua", "Lucid", "Lustre", "LYaPAS", "Lynx", "M", "M2001",
  "M4", "Machine code", "MAD", "Magik", "Magma", "Maple", "MAPPER",
  "MARK-IV", "Mary", "MASM", "MATLAB", "Maxima", "Max/MSP", "Maya",
  "MCL", "MDL", "Mercury", "Mesa", "Metacard", "Metafont", "MetaPost",
  "MHEG-5", "Microcode", "MicroScript", "MIIS", "Milk", "MIMIC", "Mindscript",
  "MIVA", "ML", "Moby", "Model 204", "Modelica", "Modula", "Modula-2",
  "Modula-3", "Mojo", "Mohol", "MOO", "Mortran", "Mouse", "MPD", "MSIL",
  "MSL", "MUMPS", "Mutan", "Mystic Programming Language", "NASM", "NATURAL",
  "Neko", "Nemerle", "NESL", "Net.Data", "NetLogo", "NetRexx", "NewLISP",
  "NEWP", "Newspeak", "NewtonScript", "NGL", "Nial", "Nice", "Nickle",
  "Nim", "Nix", "NPL", "NSIS", "Nu", "NWScript", "NXC", "O", "o:XML",
  "Oak", "Oberon", "Object Lisp", "ObjectLOGO", "Object Pascal", "Object REXX",
  "Object-Z", "Objective-C", "Objective-J", "Obliq", "Obol", "OCaml",
  "occam", "occam-π", "Octave", "OmniMark", "Onyx", "Opa", "Opal",
  "OpenCL", "OpenEdge ABL", "OPL", "OPS5", "OptimJ", "Orc", "ORCA/Modula-2",
  "Oriel", "Orwell", "Oxygene", "Oz", "P", "P#", "P4", "Pact", "PARI/GP",
  "ParaSail", "PARSEC", "PBASIC", "PCC", "PCF", "PEARL", "PeopleCode",
  "Perl", "Perl 6", "Pharo", "PHP", "Pico", "Picolisp", "Pict", "Pike",
  "PILOT", "Pipelines", "Pizza", "PL/0", "PL/B", "PL/C", "PL/I", "PL/M",
  "PL/P", "PL/S", "PL/SQL", "PL360", "PL-11", "PLANC", "Planner", "PLEX",
  "PLEXIL", "Plus", "Pluscal", "POP-11", "PostScript", "PortablE", "Powerhouse",
  "PowerShell", "PPL", "Pro*C", "Processing", "Processing.js", "Prograph",
  "PROIV", "Prolog", "PROMAL", "Promela", "PROSE", "PROTEL", "ProvideX",
  "PS-algol", "Puppet", "Pure", "Pure Data", "PureBasic", "PureScript",
  "Python", "Q", "Q#", "Q-BASICs", "Qalb", "QtScript", "QuakeC", "QPL",
  "R", "R++", "Racket", "RAPID", "Rapira", "Ratfiv", "Ratfor", "rc",
  "REBOL", "Red", "Redcode", "REFAL", "Reia", "Revolution", "REXX",
  "Rlab", "RobotC", "ROOP", "RPG", "RPL", "RSL", "RTL/2", "Ruby", "RuneScript",
  "Rust", "S", "S2", "S3", "S-Lang", "S-PLUS", "SA-C", "SabreTalk", "SAIL",
  "SALSA", "SAM76", "SAS", "SASL", "Sather", "Sawzall", "Scala", "Scheme",
  "Scilab", "Scratch", "Script.NET", "Sed", "Seed7", "Self", "SenseTalk",
  "SequenceL", "Serpent", "SETL", "SIMPOL", "SIGNAL", "Simula", "Simulink",
  "Simlab", "SISAL", "SKILL", "SLIP", "SMALL", "Smalltalk", "SML", "Snap!",
  "SNOBOL", "SNOBOL4", "Snowball", "SOL", "Solidity", "SOPHAEROS", "SPARK",
  "Speedcode", "SPIN", "SP/k", "SPS", "SQL", "SQL/PSM", "SQR", "Squeak",
  "Squirrel", "SR", "S/SL", "Stackless Python", "Starlogo", "Stata",
  "Stateflow", "Strand", "Strongtalk", "Structured Text", "Stylus", "SugarJ",
  "SuperCollider", "SuperTalk", "SYMPL", "SyncCharts", "SystemVerilog", "T",
  "TACL", "TACPOL", "TADS", "TAL", "Tcl", "Tea", "TECO", "TELCOMP", "TeX",
  "Text Executive Programming Language", "TIE", "Timber", "TMG", "Tom", "TOM",
  "Touch", "TXL", "Turing", "TUTOR", "TXL", "TypeScript", "Ubercode", "UCSD Pascal",
  "Umple", "Unicon", "UNIFACE", "UNITY", "Unix shell", "UnrealScript", "Urbiscript",
  "V", "Vala", "VBA", "VBScript", "Verilog", "Verilog-A", "Verilog-AMS", "VHDL",
  "Visual Basic", "Visual Basic .NET", "Visual DataFlex", "Visual DialogScript",
  "Visual FoxPro", "Visual J++", "Visual J#", "Visual Objects", "Visual Prolog",
  "VSXu", "Vvvv", "WATFIV", "WebAssembly", "WebDNA", "Whiley", "Winbatch", "Wolfram",
  "Wyvern", "X++", "X10", "XBL", "xBase", "xBase++", "XBasic", "XC", "xHarbour",
  "XL", "Xojo", "XOTcl", "XPath", "XPL", "XPL0", "XQuery", "XSB", "XSLT", "Xtend",
  "Y", "Yorick", "YQL", "Z", "Z notation", "Zeno", "ZOPL", "ZPL", "Z++",
  
  // Additional Modern Languages
  "Mojo", "Carbon", "Vale", "Jai", "Odin", "Pony", "Unison", "Gleam", "Roc",
  "Koka", "Flix", "Kind", "Dafny", "Whiley", "P4", "Bel", "Janet", "Wren",
  "Arturo", "Lobster", "Cue", "Pkl", "Nickel", "Dhall", "Jsonnet", "Starlark",
  
  // Analysis Types
  "DSA & Algorithms", "Data Structures", "Algorithm Analysis", "Time Complexity",
  "Space Complexity", "Big O Notation", "Flowchart Analysis", "Pseudocode",
  "UML Diagrams", "Entity Relationship", "State Machines", "Finite Automata",
  "Regular Expressions", "Context-Free Grammar", "Compiler Design",
  "Operating Systems", "Computer Networks", "Database Management", "DBMS",
  "System Design", "Design Patterns", "Software Architecture", "Clean Code",
  "Code Review", "Bug Analysis", "Security Analysis", "Performance Analysis",
  
  // Document Types
  "General Document", "Handwritten Notes", "Text Document", "Technical Documentation",
  "API Documentation", "Code Comments", "README", "Changelog", "License",
  "Universal File/Document", "General Analysis"
];

// Get unique languages and sort alphabetically (keeping Auto-Detect first)
export const getUniqueLanguages = () => {
  const uniqueSet = new Set(PROGRAMMING_LANGUAGES);
  const unique = Array.from(uniqueSet);
  const autoDetect = unique.find(l => l === "Auto-Detect");
  const rest = unique.filter(l => l !== "Auto-Detect").sort((a, b) => a.localeCompare(b));
  return autoDetect ? [autoDetect, ...rest] : rest;
};

export const UNIQUE_LANGUAGES = getUniqueLanguages();

// Language detection patterns for auto-detection
export const LANGUAGE_PATTERNS: Record<string, RegExp[]> = {
  "Python": [/^import\s+\w+/m, /^from\s+\w+\s+import/m, /def\s+\w+\s*\(/m, /print\s*\(/m, /__name__\s*==\s*['"]__main__['"]/m],
  "JavaScript": [/const\s+\w+\s*=/m, /let\s+\w+\s*=/m, /function\s+\w+\s*\(/m, /=>\s*{/m, /console\.log/m, /require\s*\(/m],
  "TypeScript": [/: \s*(string|number|boolean|any|void)/m, /interface\s+\w+/m, /<\w+>/m, /as\s+\w+/m],
  "Java": [/public\s+(class|interface|enum)/m, /private\s+\w+/m, /System\.out\.println/m, /import\s+java\./m],
  "C": [/#include\s*<\w+\.h>/m, /int\s+main\s*\(/m, /printf\s*\(/m, /scanf\s*\(/m],
  "C++": [/#include\s*<iostream>/m, /using\s+namespace\s+std/m, /cout\s*</m, /cin\s*>>/m, /std::/m],
  "C#": [/using\s+System/m, /namespace\s+\w+/m, /class\s+\w+\s*:/m, /Console\.(Write|Read)/m],
  "Go": [/package\s+\w+/m, /func\s+\w+/m, /import\s+\(/m, /fmt\.(Print|Scan)/m],
  "Rust": [/fn\s+\w+/m, /let\s+mut\s+/m, /impl\s+\w+/m, /use\s+\w+::/m, /println!\s*\(/m],
  "Swift": [/import\s+Foundation/m, /var\s+\w+\s*:/m, /let\s+\w+\s*:/m, /func\s+\w+/m, /print\s*\(/m],
  "Kotlin": [/fun\s+\w+/m, /val\s+\w+/m, /var\s+\w+/m, /println\s*\(/m, /package\s+\w+/m],
  "Ruby": [/def\s+\w+/m, /end\s*$/m, /puts\s+/m, /require\s+['"]/m, /class\s+\w+/m],
  "PHP": [/<\\?php/m, /\$\w+\s*=/m, /echo\s+/m, /function\s+\w+/m],
  "HTML": [/<!DOCTYPE\s+html/i, /<html/i, /<head>/i, /<body>/i, /<div/i],
  "CSS": [/\{[\s\S]*?\}/m, /\.\w+\s*\{/m, /#\w+\s*\{/m, /@media/m],
  "SQL": [/SELECT\s+/i, /INSERT\s+INTO/i, /UPDATE\s+/i, /DELETE\s+FROM/i, /CREATE\s+TABLE/i],
  "Bash": [/^#!/m, /\$\(\(/m, /\[\[\s+/m, /echo\s+/m],
  "PowerShell": [/\$\w+\s*=/m, /Get-\w+/m, /Set-\w+/m, /Write-Host/m],
  "R": [/<-\s*/m, /library\s*\(/m, /data\.frame/m, /ggplot/m],
  "MATLAB": [/function\s*\[/m, /end\s*$/m, /fprintf/m, /plot\s*\(/m],
  "Scala": [/object\s+\w+/m, /def\s+\w+/m, /val\s+\w+/m, /case\s+class/m],
  "Haskell": [/^module\s+\w+/m, /::\s*/m, /\w+\s*<-/m, /import\s+\w+/m],
  "Lua": [/function\s+\w+/m, /local\s+\w+/m, /end\s*$/m, /print\s*\(/m],
  "Perl": [/use\s+strict/m, /my\s+\$/m, /sub\s+\w+/m, /print\s+/m],
};

// Auto-detect language from code
export const detectLanguage = (code: string): string => {
  if (!code || code.trim().length === 0) return "Auto-Detect";
  
  let bestMatch = "Auto-Detect";
  let maxMatches = 0;
  
  for (const [language, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
    const matches = patterns.filter(pattern => pattern.test(code)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      bestMatch = language;
    }
  }
  
  return maxMatches >= 2 ? bestMatch : "Auto-Detect";
};

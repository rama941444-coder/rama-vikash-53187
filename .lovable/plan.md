
# Scope of changes

Only Slides 2, 5, 6, 7 are touched. Slides 1, 3, 4, 8 stay exactly as they are. All existing surrounding UI (toolbars, buttons, popovers, status bars, tabs, colors, layout) is preserved — the internal editor is swapped, not the chrome.

---

## 1. Real Monaco Editor in Slides 2, 5, 6

**Install:** `monaco-editor` + `@monaco-editor/react`.

Create one shared wrapper `src/components/MonacoNotepad.tsx` that keeps the **exact same props** as today's `EnhancedCodeEditor` (`value`, `onChange`, `placeholder`, `maxLines`, `language`) and renders the same outer chrome (theme toggle, font popover, copy, PDF download + PDF settings popover, clear, minimize, status bar with Ln/Col/lines/characters). Only the inner `<textarea>` + syntax overlay is replaced with `<Editor />` from `@monaco-editor/react`.

Monaco config:
- `theme`: `vs-dark` (default) / `vs` when the user toggles light — keeps the existing dark-default rule.
- `automaticLayout: true`, `minimap.enabled: true`, `bracketPairColorization.enabled: true`, `guides.bracketPairs: true`, `wordWrap: 'off'`, `tabSize: 4`, `renderWhitespace: 'selection'`.
- Font size and font family come from the same localStorage keys we already use.
- `language` prop maps the app's language name → Monaco's language id (`Python` → `python`, `C++` → `cpp`, `Auto-Detect` → detected id, etc.). Unknown → `plaintext`.
- Persist PDF popover choices (`pdf.pageSize`, `pdf.fontScale`, `pdf.lineNumbers`) — same keys already in use so nothing breaks.

Wire it into:
- Slide 2 (`CodeInput.tsx`)
- Slide 5 (`LiveCodeIDE.tsx`)
- Slide 6 (`MasteryChallenge.tsx`)

`EnhancedCodeEditor.tsx` stays in the repo (still referenced elsewhere / fallback), but the three slides above import `MonacoNotepad`.

---

## 2. Slide 5 — per-character offline diagnostics + heuristic runtime-risk warnings

Extend `src/lib/liveSyntaxValidator.ts` and add a new sibling module `src/lib/runtimeRiskHeuristics.ts`.

**A. Syntax + semantic (fires on every keystroke, ~1–3 ms):**
Existing case rules stay. Add:
- Unbalanced `()`, `[]`, `{}` per line and file-wide, with line/column of the offender.
- Missing `;` (C/C++/Java/C#/JS) after declarations / statements — already partly there, extend to more statement forms.
- Unclosed string / char literal on a line.
- Undeclared identifiers (very cheap: identifiers used but never assigned in the same file, whitelisted per language stdlib set).
- Python indentation jumps that don't match the enclosing block.

**B. Runtime-risk heuristics (same debounce, still 100% offline):**
- `malloc`/`calloc`/`new` with no matching `free`/`delete` in scope → "possible memory leak".
- `while(true)` / `while(1)` / `for(;;)` with no `break`/`return` inside → "possible infinite loop".
- Recursive function calling itself with no base-case `return` reachable before the recursive call → "possible unbounded recursion / stack overflow".
- Array literals or `new int[N]` with N > 10⁷ → "possible stack/heap overflow".
- `strcpy`/`gets`/`scanf("%s", …)` → "buffer overflow risk".
- `fopen` with no matching `fclose` → "file handle leak".
- Division literal by 0.
- Integer overflow patterns (`a * b` where both look near `INT_MAX`).

Each finding is surfaced through Monaco as a **red wavy underline** (severity 8) for errors and **amber wavy underline** (severity 4) for warnings, using `monaco.editor.setModelMarkers(model, 'live', markers)`. The existing errors list panel below the editor keeps rendering — we push the same finding list into React state so both surfaces update together.

If the selected language is not in the local registry and not in the Tree-sitter set, we log the existing "AI required" console notice — unchanged from today.

---

## 3. Slide 7 — real independent deploy via Netlify Drop

Replace the fake `https://www.<name>.com` in `WebPreview.tsx` with a real anonymous **Netlify Drop** upload.

Because Netlify Drop's endpoint is CORS-restricted, we add a thin edge function `supabase/functions/netlify-deploy/index.ts` that:
1. Accepts `{ html, siteName? }`.
2. POSTs the HTML as a zip to `https://api.netlify.com/api/v1/sites` (anonymous drop endpoint — no key needed) with a generated site subdomain.
3. Returns `{ url }` — the real `https://<name>.netlify.app` URL that works on any device, forever, with no Lovable dependency.

The Slide 7 Deploy button:
- Calls this edge function.
- On success, shows the real URL in the same green banner that exists today, keeps the copy / open-in-new-tab buttons, keeps the inline name form.
- On failure (Netlify rate-limit / offline), falls back to the current in-tab simulation and shows a toast explaining "deployed as local preview".

No UI move; only the network call underneath the button changes.

---

## 4. Slide 6 — CodeArena Pro fixes

Two things fixed inside `MasteryChallenge.tsx` + its edge function `supabase/functions/mastery-execute/index.ts`:

**A. Wrong solutions:** The current answer-check compares raw stdout string. Update the edge function to:
- Normalize whitespace, trailing newline, and case where the problem allows.
- For MCQs, compare against the canonical option id, not the label text.
- For coding problems, run all hidden test cases (not just the first) and only mark correct when every case passes; show which case failed.

**B. Interactive stdin — both modes** (user asked for both):
- Add a **pre-run stdin textarea** (LeetCode style). Lines are fed to `stdin` in order when Run is clicked.
- Also add a **live interactive prompt**: when the running program reads more input than the pre-supplied buffer contains, execution pauses and a terminal-style input field appears; each Enter sends one line and resumes. Implemented by streaming the edge function response and buffering stdout until an input request marker is emitted, then re-invoking with the appended input.

UI in Slide 6: a small "Input" panel above Run; when the program blocks for more input, the same panel gets a blinking caret and focused input — no new page, no layout shift.

---

# Technical notes

- Vite already dedupes React, so Monaco's peer install won't create a double React instance. Existing runtime tooltip error is unrelated to this plan and will be checked separately if it persists after the Monaco install.
- `monaco-editor` adds ~2 MB gzipped. Loaded via `@monaco-editor/react` which lazy-loads on first mount, so Slides 1/3/4/7/8 don't pay the cost.
- All heuristics are pure functions in `runtimeRiskHeuristics.ts` — unit-testable, no network, no worker.
- The Netlify Drop edge function uses only `fetch` + `Deno.readAll` — no extra deps.
- No changes to Slides 1, 3, 4, 8. No changes to auth, memory, or design tokens.
- Memory `mem://constraints/slide-5-only-live-diagnostics` continues to hold — diagnostics engine changes remain scoped to Slide 5.

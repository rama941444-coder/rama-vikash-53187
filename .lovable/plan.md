
I'll make these focused updates only. Nothing else in the app will change.

## 1. Auto-detect language (Slides 2, 4, 5)
In the language selector search box, when the user leaves it on "Auto-Detect" (or empty), detect the language from the notepad content using a lightweight heuristic detector (checks for `def`/`print(` → Python, `#include` → C/C++, `public class` → Java, `fn ` → Rust, `<html` → HTML, `SELECT ` → SQL, etc., ~40 signatures). Runs on every code change, debounced 300ms. Shows a small "Detected: Python" chip next to the selector.

## 2. Notepad upgrades (Slides 2 and 5 editors)
Add a small toolbar control group:
- Font size slider (10px – 28px, default 14px) — persisted in localStorage.
- Font family dropdown (Consolas, Fira Code, JetBrains Mono, Monaco, Courier New) — persisted.
- VS Code–style keyword highlighting: overlay a syntax-highlighted `<pre>` behind the transparent `<textarea>` (classic technique, no Monaco swap) using Prism.js with the language matching the current selection. Highlights keywords, strings, comments, numbers for all 200+ languages Prism supports; falls back to plain text otherwise.

## 3. Save → Download as PDF
Replace the existing Save (.txt) button in `EnhancedCodeEditor` with a **Download PDF** button. Uses `jspdf` to render the current code (with line numbers, monospaced font, wrapped) into a multi-page A4 PDF named `code-<timestamp>.pdf`. Copy and Print buttons remain unchanged.

## 4. Run / Analyze speed
- Pre-warm the analyze edge function with a no-op ping on slide mount so the first real click avoids cold-start.
- Cache last identical (code + language) analysis result in memory for 60s so repeated clicks return instantly.
- Run button: debounce duplicate clicks (200ms) and start the iframe write synchronously before awaiting any async setup.

## 5. Slide 3 + Slide 4 red error box translation
On the existing red "Errors & Execution Analysis" panel (slide 3 `DiagnosticResults`, and the equivalent red box in slide 4 `UniversalAnalyzer`):
- Add a compact language dropdown at the top-right of that box.
- Options: English (default) + all 22 Indian scheduled languages (Hindi, Telugu, Tamil, Kannada, Malayalam, Bengali, Gujarati, Marathi, Punjabi, Odia, Assamese, Urdu, Sanskrit, Nepali, Konkani, Maithili, Sindhi, Kashmiri, Manipuri, Bodo, Santali, Dogri) + major foreign languages (Spanish, French, German, Portuguese, Italian, Russian, Arabic, Chinese, Japanese, Korean, Turkish, Vietnamese, Indonesian, Thai, Dutch, Polish, Swedish).
- On change, call the existing `translate-explanation` edge function (extending its enum to include the foreign languages) and replace the red-box text in place. English shows the original.
- A 🔊 "Read aloud" button beside the dropdown uses `speechSynthesis` with a `lang` tag matched to the selected language (e.g. `te-IN` for Telugu, `hi-IN` for Hindi) and reads the translated text fully, no skipping.

## Files touched
- `src/components/EnhancedCodeEditor.tsx` — font size/family controls, Prism highlight overlay, Save → Download PDF.
- `src/components/LanguageSelector.tsx` — auto-detect chip + detection hook.
- `src/lib/languageDetect.ts` — new heuristic detector.
- `src/components/slides/CodeInput.tsx`, `LiveCodeIDE.tsx`, `UniversalAnalyzer.tsx` — wire auto-detect; pre-warm analyze; Run debounce + cache.
- `src/components/slides/DiagnosticResults.tsx`, `UniversalAnalyzer.tsx` — translatable red box + TTS.
- `supabase/functions/translate-explanation/index.ts` — add foreign languages to the allowed enum.
- New deps: `jspdf`, `prismjs` (+ `@types/prismjs`).

## Strictly NOT changing
- No layout/UI changes outside the items above. No changes to slides 1, 6, 7, 8. No removal of any existing button (Copy, Print, Clear, Minimize all stay). No business-logic or schema changes.

Approve and I'll implement.

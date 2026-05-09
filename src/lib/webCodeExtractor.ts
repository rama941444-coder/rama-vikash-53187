// Utilities to extract & assemble HTML/CSS/JS from mixed user input
// (markdown fences, prose, separate ```css / ```js blocks, etc.).

export interface SplitWeb {
  html: string;
  css: string;
  js: string;
  combined: string; // ready-to-render document
}

const stripProse = (s: string) =>
  s.replace(/^\s*(?:COMPLETE\s+)?corrected\s+code(?:\s+in\s+TEXT\s+format)?\s*:\s*-?\s*/i, '').trim();

const grabFences = (raw: string) => {
  const blocks: { lang: string; code: string }[] = [];
  const re = /```(\w+)?\s*([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    blocks.push({ lang: (m[1] || '').toLowerCase(), code: m[2] });
  }
  return blocks;
};

export function splitMixedWebCode(raw: string): SplitWeb {
  if (!raw) return { html: '', css: '', js: '', combined: '' };
  const text = stripProse(raw);

  let html = '';
  let css = '';
  let js = '';

  const fences = grabFences(text);
  if (fences.length) {
    for (const b of fences) {
      if (['html', 'markup', 'xml', ''].includes(b.lang) && /<[a-zA-Z!]/.test(b.code)) html += b.code + '\n';
      else if (b.lang === 'css') css += b.code + '\n';
      else if (['js', 'javascript', 'ts', 'typescript'].includes(b.lang)) js += b.code + '\n';
      else if (!html && /<[a-zA-Z!]/.test(b.code)) html += b.code + '\n';
    }
  }

  // Fallback: no fences — treat entire text. Pull <style> & <script> if any.
  if (!html && !css && !js) {
    const idx = text.search(/<!DOCTYPE html|<html[\s>]|<body[\s>]|<head[\s>]|<div[\s>]|<style[\s>]|<script[\s>]/i);
    html = idx >= 0 ? text.slice(idx) : text;
  }

  // If html already has a full document, just return it. Otherwise build one.
  const hasDoc = /<html[\s>]|<!DOCTYPE/i.test(html);
  let combined: string;
  if (hasDoc) {
    combined = html;
    if (css) {
      combined = combined.replace(/<\/head>/i, `<style>${css}</style></head>`);
      if (!/<style>[\s\S]*?<\/style>/i.test(combined)) combined = `<style>${css}</style>` + combined;
    }
    if (js) {
      combined = combined.replace(/<\/body>/i, `<script>${js}<\/script></body>`);
      if (!/<script>/i.test(combined)) combined = combined + `<script>${js}<\/script>`;
    }
  } else {
    combined = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Preview</title>${css ? `<style>${css}</style>` : ''}</head><body>${html}${js ? `<script>${js}<\/script>` : ''}</body></html>`;
  }

  return { html: html.trim(), css: css.trim(), js: js.trim(), combined };
}

export function isWebCode(s: string): boolean {
  if (!s) return false;
  return /<html|<!DOCTYPE|<body|<div|<style>|<script>|<head/i.test(s) || /```(html|css|js|javascript)/i.test(s);
}

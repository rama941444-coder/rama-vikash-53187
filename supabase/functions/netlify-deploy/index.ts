// Anonymous Netlify Drop — deploys HTML/CSS/JS to a real, permanent
// public URL (works on any device without Lovable). No API key required.
//
// Netlify's anonymous drop endpoint accepts a ZIP upload and returns a
// live https://<random>.netlify.app URL that anyone can visit forever.

import JSZip from 'https://esm.sh/jszip@3.10.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function sanitize(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { html, siteName } = await req.json();
    if (!html || typeof html !== 'string') {
      return new Response(JSON.stringify({ error: 'html string is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build the zip
    const zip = new JSZip();
    zip.file('index.html', html);
    // Optional _redirects for SPAs
    zip.file('_redirects', '/* /index.html 200\n');
    const zipBlob: Uint8Array = await zip.generateAsync({ type: 'uint8array' });

    // Step 1: create an anonymous site (optional custom subdomain)
    const clean = sanitize(siteName || '');
    const createPayload: Record<string, unknown> = {};
    if (clean) createPayload.name = clean;

    const createResp = await fetch('https://api.netlify.com/api/v1/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createPayload),
    });
    if (!createResp.ok) {
      const t = await createResp.text();
      return new Response(JSON.stringify({ error: 'netlify_create_failed', detail: t }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const site = await createResp.json();
    const siteId: string = site.id;
    const url: string = site.ssl_url || site.url;

    // Step 2: upload the zip
    const uploadResp = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/zip' },
      body: zipBlob,
    });
    if (!uploadResp.ok) {
      const t = await uploadResp.text();
      return new Response(JSON.stringify({ error: 'netlify_deploy_failed', detail: t, url }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const deploy = await uploadResp.json();

    return new Response(JSON.stringify({
      url,
      siteId,
      deployId: deploy.id,
      state: deploy.state,
      adminUrl: site.admin_url,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
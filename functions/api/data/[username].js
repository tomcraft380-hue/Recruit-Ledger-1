// Cloudflare Pages Function: /api/data/<username>
//
// GET  /api/data/alice  -> returns alice's JSON (or an empty default)
// PUT  /api/data/alice  -> overwrites alice's JSON with the request body
//
// The KV namespace must be bound to the variable `KV` in your Pages
// project settings (Settings -> Bindings -> KV namespace binding).
 
const EMPTY = { entries: [] };
 
function normaliseUsername(raw) {
  if (!raw) return null;
  // Lowercase, trim, allow only letters/numbers/dash/underscore, cap length.
  const cleaned = String(raw).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!cleaned || cleaned.length > 40) return null;
  return cleaned;
}
 
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
 
export async function onRequestGet({ params, env }) {
  const username = normaliseUsername(params.username);
  if (!username) return jsonResponse({ error: "Invalid username" }, 400);
 
  try {
    const raw = await env.KV.get(`user:${username}`);
    if (!raw) return jsonResponse(EMPTY);
    // KV stores strings; parse back into JSON before returning.
    return jsonResponse(JSON.parse(raw));
  } catch (e) {
    return jsonResponse({ error: "Failed to load: " + e.message }, 500);
  }
}
 
export async function onRequestPut({ params, env, request }) {
  const username = normaliseUsername(params.username);
  if (!username) return jsonResponse({ error: "Invalid username" }, 400);
 
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Request body must be valid JSON" }, 400);
  }
 
  // Light shape check so the KV doesn't fill with garbage.
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.entries)) {
    return jsonResponse({ error: "Payload must be an object with an 'entries' array" }, 400);
  }
 
  try {
    await env.KV.put(`user:${username}`, JSON.stringify(payload));
    return jsonResponse({ ok: true, count: payload.entries.length });
  } catch (e) {
    return jsonResponse({ error: "Failed to save: " + e.message }, 500);
  }
}
 
// Anything else (POST, DELETE, etc.) returns 405.
export async function onRequest({ request }) {
  return jsonResponse({ error: `Method ${request.method} not allowed` }, 405);
}

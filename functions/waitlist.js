// Cloudflare Pages Function for POST /waitlist
// Optional bindings in Cloudflare Pages Settings:
//   TURNSTILE_SECRET_KEY (secret) - verifies cf-turnstile-response when configured
//   WAITLIST_KV (KV namespace)    - fallback store if origin is unreachable
const DEFAULT_BACKEND = 'https://arapod.hellodigital.co';

export async function onRequestPost(context) {
  const { request, env } = context;
  const formData = await request.formData();
  const email = String(formData.get("email") || "").trim();
  if (!email || !email.includes("@")) {
    return Response.redirect(new URL("/?waitlist=invalid#waitlist", request.url).toString(), 303);
  }

  if (env.TURNSTILE_SECRET_KEY) {
    const token = String(formData.get("cf-turnstile-response") || "").trim();
    if (!token) {
      return Response.redirect(new URL("/?waitlist=verify#waitlist", request.url).toString(), 303);
    }
    const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token }),
    });
    const verifyJson = await verifyRes.json();
    if (!verifyJson.success) {
      return Response.redirect(new URL("/?waitlist=verify#waitlist", request.url).toString(), 303);
    }
  }

  const backend = (env.BACKEND_URL || DEFAULT_BACKEND).replace(/\/+$/, "");
  let forwarded = false;
  try {
    const res = await fetch(`${backend}/waitlist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: new URLSearchParams({ email }),
    });
    forwarded = res.ok;
  } catch (_err) {
    forwarded = false;
  }

  if (!forwarded && env.WAITLIST_KV) {
    await env.WAITLIST_KV.put(`waitlist:${email.toLowerCase()}`, new Date().toISOString());
  }

  return Response.redirect(new URL("/?waitlist=1#waitlist", request.url).toString(), 303);
}

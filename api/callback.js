// Step 2 of GitHub sign-in for the website editor (/admin).
// GitHub sends the editor back here; we swap the one-time code for a token and hand it
// to the editor window that opened the sign-in popup (same site only).
module.exports = async (req, res) => {
  const url = new URL(req.url, "https://placeholder.local");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith("decap_oauth_state="));
  const expected = cookie ? cookie.split("=")[1] : null;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";

  let status = "error", payload;
  try {
    if (!code) throw new Error(url.searchParams.get("error_description") || "GitHub did not return a code.");
    if (!state || state !== expected) throw new Error("Sign-in expired or was started elsewhere. Close this window and try again.");
    const r = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${proto}://${host}/api/callback`,
      }),
    });
    const data = await r.json();
    if (!data.access_token) throw new Error(data.error_description || data.error || "No token from GitHub.");
    status = "success";
    payload = { token: data.access_token, provider: "github" };
  } catch (e) {
    payload = { message: e.message };
  }

  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  res.setHeader("Set-Cookie", "decap_oauth_state=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(`<!doctype html><html><body><p>Signing you in…</p><script>
(function () {
  var message = ${JSON.stringify(message).replace(/</g, "\\u003c")};
  function receive(e) {
    if (e.origin !== window.location.origin) return;
    window.opener.postMessage(message, e.origin);
    window.removeEventListener("message", receive, false);
    setTimeout(function () { window.close(); }, 300);
  }
  if (!window.opener) { document.body.textContent = "Open the editor at /admin and sign in from there."; return; }
  window.addEventListener("message", receive, false);
  window.opener.postMessage("authorizing:github", window.location.origin);
})();
</script></body></html>`);
};

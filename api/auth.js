// Step 1 of GitHub sign-in for the website editor (/admin).
// Sends the editor to GitHub to approve access. Needs two environment variables in Vercel:
//   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET  (from a GitHub OAuth App)
// Optional: OAUTH_SCOPE (default "repo,user").
const crypto = require("crypto");

module.exports = (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end("GITHUB_CLIENT_ID is not set in Vercel → Project → Settings → Environment Variables.");
  }
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const state = crypto.randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${proto}://${host}/api/callback`,
    scope: process.env.OAUTH_SCOPE || "repo,user",
    state,
  });
  res.setHeader("Set-Cookie", `decap_oauth_state=${state}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  res.statusCode = 302;
  res.setHeader("Location", `https://github.com/login/oauth/authorize?${params}`);
  res.end();
};

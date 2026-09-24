# QOL Works — website

Single-page marketing site for **QOL Works** (formerly WebContentor), with a visual editor for the copy.

```
src/index.html      page template — layout, styles and scripts (the copy is pulled in from content/)
content/*.json      every piece of text on the site, one file per section
admin/              the copy editor (Decap CMS), served at /admin
api/                GitHub sign-in for the editor (two small Vercel functions)
assets/             logos, favicons, imagery
build.mjs           renders src/index.html + content/ into dist/ — no dependencies
vercel.json         tells Vercel to run the build and serve dist/
```

## How editing works

1. An editor opens **`/admin`** on the site (for example `https://your-site.vercel.app/admin`) and signs in with GitHub.
2. They pick a section — Hero, What we do, FAQ… — change the text in the form, and click **Save**.
   The change becomes a **draft**: a branch and pull request on GitHub.
3. Vercel builds that draft automatically and posts a **preview link** on the pull request
   (and in the Vercel dashboard). The live site is untouched.
4. When the preview reads right, click **Publish** in the editor (or merge the pull request).
   Vercel then updates the live site.

Some copy appears in more than one place and is edited once:
the service groups drive the Solutions menu, the What we do cards and the footer;
products and engagements drive their menus; the contact email appears in Contact and the footer.

If a change would break the page (for example a required field left empty), the Vercel build fails
with a message naming the field, and nothing is published.

## One-time setup

### 1. Vercel
The repo is ready as it is: `vercel.json` sets the build command (`node build.mjs`) and the output folder (`dist`).
In **Vercel → Project → Settings → General**, keep Framework Preset **Other** and Root Directory empty.

### 2. A GitHub OAuth App (lets editors sign in)
GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**
- **Homepage URL:** the site address, e.g. `https://your-site.vercel.app`
- **Authorization callback URL:** the same address + `/api/callback`, e.g. `https://your-site.vercel.app/api/callback`

Create it, copy the **Client ID**, and click **Generate a new client secret**.

### 3. Vercel environment variables
**Vercel → Project → Settings → Environment Variables**, for Production and Preview:
- `GITHUB_CLIENT_ID` = the Client ID
- `GITHUB_CLIENT_SECRET` = the client secret

Then redeploy (Deployments → ⋯ → Redeploy).

### 4. Give editors access
GitHub repo → **Settings → Collaborators → Add people**, with **Write** access. Each editor needs a GitHub account.

### 5. When the main domain is connected
Add it in **Vercel → Project → Settings → Domains** and set the DNS records Vercel shows at your domain registrar.
Then change both URLs in the GitHub OAuth App to the new domain. Editors then use `https://yourdomain.com/admin`.
(Sign-in works on the address registered in the OAuth App; preview links are for reviewing, not editing.)

## Working locally

```bash
node build.mjs                                   # writes dist/
cd dist && python3 -m http.server 8080           # site at http://localhost:8080
```

To try the editor locally without GitHub, run `npx decap-server` in the repo root and open
`http://localhost:8080/admin` — changes are written straight to `content/`. Run `node build.mjs` again to see them.

## Notes

- **Imagery is temporary.** Replace any file in `assets/` by saving over it with the same name.
- **Review mode.** Draft labels and placeholder-only blocks (testimonials, unconfirmed figures, placeholder contact details)
  are hidden from visitors. Show them with `#drafts` in the URL, or press Shift+D.
- **Contact form** does not send anything yet — it needs a form endpoint.

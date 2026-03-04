# ArcLearn Cloudflare API Setup (single worker.js)

Architecture:
- Frontend: GitHub Pages
- Risky API calls: Cloudflare Worker (`worker.js`)
  - `/api/lesson` (Groq)
  - `/api/chat` (Groq)
  - `/api/rtdb/update` (Firebase RTDB write proxy)

## 1) Deploy Worker

```bash
npm i -g wrangler
wrangler login
wrangler secret put GROQ_API_KEY
wrangler deploy
```

## 2) Configure Worker vars in `wrangler.toml`

Required:
- `FIREBASE_DB_URL = "https://<your-project>-default-rtdb.firebaseio.com"`

Recommended:
- `ALLOWED_ORIGIN = "https://<your-username>.github.io"`

Optional:
- `GROQ_GEN_MODEL`
- `GROQ_GUARD_MODEL`
- `TEACHING_SLIDES`
- `FIREBASE_DB_SECRET` (only if you want admin-style DB patches without user idToken)

Redeploy after changes:

```bash
wrangler deploy
```

## 3) Point GitHub Pages frontend to Worker URL

Either open once with query param:

`https://<your-username>.github.io/<repo>/?apiBase=https://<your-worker>.workers.dev`

Or set manually:

```js
localStorage.setItem("arclearn_api_base_v1", "https://<your-worker>.workers.dev");
location.reload();
```

## 4) Verify in browser network tab

- `POST https://<your-worker>.workers.dev/api/lesson`
- `POST https://<your-worker>.workers.dev/api/chat`
- `POST https://<your-worker>.workers.dev/api/rtdb/update`

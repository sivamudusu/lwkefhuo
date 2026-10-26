# REint web app

Next.js 16 App Router client for the GB wind decision desk. See the repository
[`README.md`](../README.md) for setup, data, deployment, and the API contract.

Local development expects the FastAPI service on `http://localhost:8000` (or
`BACKEND_ORIGIN` if set):

```bash
npm install
npm run dev
```

The app reads relative `/api/*` paths; `next.config.ts` rewrites them to
`BACKEND_ORIGIN`.

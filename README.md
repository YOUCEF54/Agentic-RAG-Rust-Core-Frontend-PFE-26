# Agentic-RAG-Rust-Core-Frontend-PFE-26

Frontend workspace that lets you choose between:
- **Langflow Console** (existing chat + knowledge UI)
- **Python/Rust RAG Engine** (custom `/documents`, `/index`, `/query` endpoints)

## Local Development
1. Install dependencies:
   - `cd frontend`
   - `npm install`
2. Start the dev server:
   - `npm run dev`
3. Open the UI at `http://localhost:3000`.

## Environment Variables
Create `frontend/.env` if you need custom API URLs.

```
VITE_API_URL=http://localhost:8000
VITE_ENGINE_API_URL=http://localhost:8000
```

Optional (only if using Firebase persistence):
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

## Notes
- The Langflow console uses `VITE_API_URL`.
- The Engine console uses `VITE_ENGINE_API_URL`.

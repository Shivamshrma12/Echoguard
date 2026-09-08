# EchoGuard Frontend Client

This directory contains the React 19 + TypeScript + Vite frontend client for the **EchoGuard** voice reliability system.

Please refer to the authoritative documentation in the root directory:
- [Root README](../README.md)
- [Rime Evidence Dossier](../RIME_EVIDENCE.md)

### Building the Frontend

To build the static distribution bundle served by FastAPI:

```bash
npm install
npm run build
```

The compiled assets are placed in `frontend/dist/` and served automatically by FastAPI when starting the server.


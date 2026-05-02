# Voltix Android HTML Response Diagnosis

The Android server-selection screen fails because the deployed `https://voltixstudio.com` host returns an HTML document for the expected tRPC JSON API route.

The Android app calls `GET https://voltixstudio.com/api/trpc/voltix.servers`. The endpoint probe confirms this route returns `HTTP/1.1 200 OK` with `Content-Type: text/html` and a body beginning with `<!doctype html>`. The Android JSON parser then correctly fails because it was asked to parse an HTML page as JSON.

The repository backend is designed to mount the tRPC API at `/api/trpc` in `server/_core/index.ts`, before the frontend static fallback is registered. Therefore, a correct production deployment should run the Node/Express server using `pnpm build` followed by `pnpm start` or an equivalent `NODE_ENV=production node dist/index.js` command. The current live host appears to be served directly by nginx as a static Vite frontend, not by the Express+tRPC server, because both `/api/trpc/voltix.servers` and `/api/trpc/system.health` return the frontend `index.html`.

This is primarily a deployment/routing issue, not a Kotlin JSON model issue. The Android app can be improved to show a clearer error, but it cannot obtain the server list until `voltixstudio.com` routes `/api/trpc/*` to the backend process.

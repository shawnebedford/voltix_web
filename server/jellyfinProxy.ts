/**
 * Jellyfin Reverse Proxy
 * ──────────────────────
 * Mounts at  /api/jellyfin/:serverId/*
 *
 * Every request must carry the Voltix session cookie.  The server looks up:
 *   1. The Voltix session → retrieves the stored Jellyfin access token
 *   2. The target server URL from the servers table
 *
 * It then forwards the request to the real Jellyfin server, injecting the
 * stored token as the Authorization header.  The client never sees the
 * Jellyfin token or the real Lumistream URL.
 */

import type { Express, Request, Response } from "express";
import { getSessionByToken, listServers } from "./db";

const VOLTIX_SESSION_COOKIE = "voltix_session";

export function registerJellyfinProxy(app: Express): void {
  // Match any path under /api/jellyfin/:serverId/
  app.all("/api/jellyfin/:serverId/*", async (req: Request, res: Response) => {
    try {
      // ── 1. Authenticate the Voltix session ──────────────────────────────
      const sessionToken = (req.cookies as Record<string, string>)?.[VOLTIX_SESSION_COOKIE];
      if (!sessionToken) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const session = await getSessionByToken(sessionToken);
      if (!session || !session.isValid) {
        res.status(401).json({ error: "Invalid or expired session" });
        return;
      }

      if (!session.jellyfinToken) {
        res.status(403).json({
          error: "No Jellyfin token on session. Please re-authenticate.",
        });
        return;
      }

      // ── 2. Resolve the target server ────────────────────────────────────
      const serverId = parseInt(req.params.serverId, 10);
      if (isNaN(serverId)) {
        res.status(400).json({ error: "Invalid serverId" });
        return;
      }

      const servers = await listServers();
      const server = servers.find((s) => s.id === serverId);
      if (!server) {
        res.status(404).json({ error: "Server not found" });
        return;
      }

      // ── 3. Build the upstream URL ────────────────────────────────────────
      // req.params[0] captures everything after /:serverId/
      const upstreamPath = (req.params as Record<string, string>)[0] ?? "";
      const upstreamBase = server.url.replace(/\/+$/, "");
      const upstreamUrl = `${upstreamBase}/${upstreamPath}${
        req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""
      }`;

      // ── 4. Forward the request ───────────────────────────────────────────
      const forwardHeaders: Record<string, string> = {
        Authorization: `MediaBrowser Token="${session.jellyfinToken}"`,
        "Content-Type": req.headers["content-type"] ?? "application/json",
        "X-Emby-Authorization": `MediaBrowser Client="Voltix", Device="${
          session.deviceName ?? "Voltix Web"
        }", DeviceId="${session.id}", Version="10.9.0", Token="${session.jellyfinToken}"`,
      };

      // Pass through safe headers from the original request
      const passThrough = ["accept", "range", "accept-encoding", "accept-language"];
      for (const h of passThrough) {
        const v = req.headers[h];
        if (v) forwardHeaders[h] = Array.isArray(v) ? v.join(", ") : v;
      }

      const body =
        req.method !== "GET" && req.method !== "HEAD"
          ? JSON.stringify(req.body)
          : undefined;

      const upstream = await fetch(upstreamUrl, {
        method: req.method,
        headers: forwardHeaders,
        body,
      });

      // ── 5. Stream the response back ──────────────────────────────────────
      res.status(upstream.status);

      // Forward safe response headers
      const fwdResponseHeaders = [
        "content-type",
        "content-length",
        "content-range",
        "accept-ranges",
        "cache-control",
        "etag",
        "last-modified",
      ];
      for (const h of fwdResponseHeaders) {
        const v = upstream.headers.get(h);
        if (v) res.setHeader(h, v);
      }

      const buffer = await upstream.arrayBuffer();
      res.end(Buffer.from(buffer));
    } catch (err) {
      console.error("[JellyfinProxy] Error:", err);
      res.status(502).json({ error: "Proxy error" });
    }
  });
}

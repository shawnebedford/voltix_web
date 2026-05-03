# Voltix Streaming Platform - TODO (Last Deployment Trigger: 2026-05-03)

## Backend / Schema
- [x] Extend drizzle schema: voltixUsers, sessions, deviceLogs, servers tables
- [x] Generate and apply DB migration
- [x] Auth gateway: voltix credentials → hidden Jellyfin credentials mapping
- [x] Session creation with device name logging
- [x] Subscription ping endpoint (voltix.ping tRPC mutation)
- [x] Force-logout mechanism when subscription inactive
- [x] Admin procedures: list users, toggle active/inactive, view sessions
- [x] Pre-configured server list seeded in DB (3 Lumistream servers)

## Frontend
- [x] Dark premium theme in index.css (deep navy/black, cyan/teal accents)
- [x] Splash screen with Voltix logo + loading animation
- [x] Custom login page (Voltix credentials only, no Manus OAuth)
- [x] Server selection page (pre-configured, no manual entry)
- [x] User dashboard: subscription status, active devices, connected servers
- [x] 5-minute subscription ping loop (useEffect interval in VoltixAuthContext)
- [x] Force-logout redirect when ping returns inactive (ForceLogoutBanner)
- [x] Admin panel: user list, subscription toggle, session viewer
- [x] Navigation / routing wired in App.tsx

## Testing
- [x] Vitest: auth gateway credential mapping
- [x] Vitest: subscription ping logic
- [x] Vitest: force-logout on inactive subscription
- [x] All 10 tests passing

## Delivery
- [x] Final checkpoint saved
- [x] Delivered to user

## Change Set 2 — Device Auto-Detection & Server Proxy (superseded by Change Set 2 DB-backed below)
- [x] Remove Device Name input from Login.tsx; auto-detect silently from UA + platform API
- [x] Create client/src/lib/deviceInfo.ts utility for rich device name detection
- [x] Add /api/proxy/:serverId/* Express route that forwards Jellyfin requests server-side
- [x] Store Jellyfin auth token server-side per session (not exposed to client)
- [x] Update Servers.tsx to launch via proxy URL instead of direct Lumistream URL
- [x] Update routers.ts to handle Jellyfin token exchange server-side
- [x] Run tests and save checkpoint

## Change Set 2 — DB-backed Auth, Device Auto-Detection & Server Proxy
- [x] Remove Device Name input from Login.tsx; auto-detect silently via deviceInfo utility
- [x] Create client/src/lib/deviceInfo.ts: UA parsing + navigator.userAgentData for rich device name
- [x] Add jellyfinToken column to voltix_sessions (store Jellyfin auth token server-side)
- [x] Add /api/jellyfin/:serverId/* Express proxy route (forwards all Jellyfin HTTP traffic server-side)
- [x] routers.ts: perform Jellyfin /Users/AuthenticateByName server-side at login, store token in session
- [x] routers.ts: never return jellyfinPassword to client; return only a proxyBaseUrl per server
- [x] Servers.tsx: connect button opens proxy URL (/api/jellyfin/:serverId/) not raw Lumistream URL
- [x] Update ping to also verify Jellyfin token validity server-side
- [x] Run tests and save checkpoint

## Change Set 3 — Full Activity Control
- [x] Add maxConcurrentDevices (default 1) and tokenRefreshedAt columns to voltix_users / voltix_sessions
- [x] Run schema migration
- [x] Backend: enforce maxConcurrentDevices at login — reject if active session count >= limit
- [x] Backend: token refresh in ping — re-auth against Jellyfin if token age > 6h, update session
- [x] Backend: admin.updateUser procedure — edit display name, email, password, Jellyfin creds, maxDevices, isActive
- [x] Frontend: Admin Edit User dialog with all editable fields
- [x] Frontend: Login error message for device limit exceeded
- [x] Frontend: Account page shows device slot usage (X of Y devices)
- [x] Tests for device limit, token refresh, updateUser
- [x] Checkpoint and deliver

## Change Set 4 — Server-First Flow & Android Client Integration
- [x] Move android-client/ into voltix-streaming project root
- [x] Backend: add optional serverId to voltix.login — authenticate against chosen server
- [x] Backend: seed servers returns id so client can pass it at login time
- [x] Web: new ServerSelect page shown after splash, before login (3 server cards with icons)
- [x] Web: login page receives selectedServerId from route state, passes to login mutation
- [x] Web: App.tsx routing — /select-server → /login/:serverId → /servers
- [x] Web: after login, show server dashboard with active server indicator
- [x] Android: update LoginRequest to include serverId field
- [x] Android: ServerListActivity routes to login with serverId before auth
- [x] Tests updated for server-first login flow (18 passing)
- [x] Checkpoint and deliver with sync documentation

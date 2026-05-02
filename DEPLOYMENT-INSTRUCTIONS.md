# Voltix Split Deployment Instructions

The previous all-in-one archive has been split into two clean project archives. Each zip opens directly to the actual project files, without an extra outer folder before the project root.

| Archive | Contains | Deploy to GitHub/App Service? | Purpose |
|---|---|---:|---|
| `voltix-web-backend-project-root.zip` | The web frontend, Node/Express backend, tRPC API, shared code, Drizzle schema, and package files at the archive root. | Yes. Deploy this as the website/app-service project. | This is the live `https://voltixstudio.com` service and must serve both the website and `/api/trpc/*` API routes. |
| `voltix-android-client-project-root.zip` | The Android Gradle project at the archive root, plus the rebuilt `app-debug.apk` at the root for installation/testing. | Only if you want the Android source in a separate GitHub repo. Do not deploy this to the website app service. | This is the native mobile app source and APK. It calls the deployed web/backend API. |

The two projects should be kept separate because the web/backend project is a Node deployment target, while the Android project is a Gradle/mobile project. The website/app service should receive only the web/backend archive. The Android archive is for Android Studio, GitHub source tracking, APK builds, and device installation.

For the mobile app authorization and server list to work, deploy the web/backend archive first and confirm that `https://voltixstudio.com/api/trpc/voltix.servers` returns JSON instead of the Vite `index.html` page. If that route still returns `Content-Type: text/html` and starts with `<!doctype html>`, the app service is serving only the static frontend and has not routed `/api/trpc/*` to the backend server.

Recommended deployment order is therefore: deploy `voltix-web-backend-project-root.zip` to the app service first; verify the `/api/trpc/*` routes return JSON; then install or rebuild the Android app from `voltix-android-client-project-root.zip`.

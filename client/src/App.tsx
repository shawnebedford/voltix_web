import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { VoltixAuthProvider } from "./contexts/VoltixAuthContext";
import { useState } from "react";
import Home from "./pages/Home";
import ServerSelect from "./pages/ServerSelect";
import Login from "./pages/Login";
import Servers from "./pages/Servers";
import Account from "./pages/Account";
import Admin from "./pages/Admin";
import Splash from "./pages/Splash";

/**
 * Voltix Streaming — Route Map
 * ─────────────────────────────
 * /                   → Home (redirects based on auth state)
 * /select-server      → ServerSelect (3 server cards, pre-login)
 * /login/:serverId    → Login (Voltix credentials + chosen server)
 * /login              → Login (defaults to server 1)
 * /servers            → Servers (post-login server switcher / dashboard)
 * /account            → Account (subscription, devices, sessions)
 * /admin              → Admin panel (Manus OAuth required)
 */
function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/select-server" component={ServerSelect} />
      <Route path="/login/:serverId" component={Login} />
      <Route path="/login" component={Login} />
      <Route path="/servers" component={Servers} />
      <Route path="/account" component={Account} />
      <Route path="/admin" component={Admin} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster
            theme="dark"
            toastOptions={{
              style: {
                background: "oklch(0.11 0.015 240)",
                border: "1px solid oklch(0.25 0.02 240)",
                color: "oklch(0.95 0.01 240)",
              },
            }}
          />
          {!splashDone && <Splash onComplete={() => setSplashDone(true)} />}
          <VoltixAuthProvider>
            <Router />
          </VoltixAuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

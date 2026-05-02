import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

export interface VoltixUser {
  id: number;
  username: string;
  displayName: string | null;
  email: string | null;
  isActive: boolean;
  maxConcurrentDevices: number;
}

export interface VoltixServer {
  id: number;
  name: string;
  proxyUrl: string;
}

export interface ActiveServer {
  id: number;
  name: string;
  proxyUrl: string;
}

interface VoltixAuthState {
  user: VoltixUser | null;
  servers: VoltixServer[];
  /** The server the user authenticated against */
  activeServer: ActiveServer | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  jellyfinReady: boolean;
}

interface VoltixAuthContextValue extends VoltixAuthState {
  login: (username: string, password: string, deviceName?: string, serverId?: number) => Promise<void>;
  logout: () => Promise<void>;
  forceLogout: (reason?: string) => void;
}

const VoltixAuthContext = createContext<VoltixAuthContextValue | null>(null);

export function VoltixAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<VoltixAuthState>({
    user: null,
    servers: [],
    activeServer: null,
    isLoading: true,
    isAuthenticated: false,
    jellyfinReady: false,
  });
  const [forceLogoutReason, setForceLogoutReason] = useState<string | null>(null);

  const utils = trpc.useUtils();

  // Restore session on mount
  const { data: sessionData, isLoading: sessionLoading } = trpc.voltix.session.useQuery(
    undefined,
    { retry: false }
  );

  useEffect(() => {
    if (!sessionLoading) {
      if (sessionData) {
        setState({
          user: sessionData.user,
          servers: sessionData.servers,
          activeServer: sessionData.activeServer,
          isLoading: false,
          isAuthenticated: true,
          jellyfinReady: sessionData.jellyfinReady,
        });
      } else {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    }
  }, [sessionData, sessionLoading]);

  const loginMutation = trpc.voltix.login.useMutation();
  const logoutMutation = trpc.voltix.logout.useMutation();
  const pingMutation = trpc.voltix.ping.useMutation();

  const login = useCallback(
    async (username: string, password: string, deviceName?: string, serverId?: number) => {
      const result = await loginMutation.mutateAsync({
        username,
        password,
        deviceName,
        serverId,
      });
      setState({
        user: result.user,
        servers: result.servers,
        activeServer: result.activeServer,
        isLoading: false,
        isAuthenticated: true,
        jellyfinReady: result.jellyfinReady,
      });
      await utils.voltix.session.invalidate();
    },
    [loginMutation, utils]
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
    setState({
      user: null,
      servers: [],
      activeServer: null,
      isLoading: false,
      isAuthenticated: false,
      jellyfinReady: false,
    });
    await utils.voltix.session.invalidate();
  }, [logoutMutation, utils]);

  const [, navigate] = useLocation();

  const forceLogout = useCallback(
    (reason?: string) => {
      setForceLogoutReason(reason ?? "subscription_inactive");
      setState({
        user: null,
        servers: [],
        activeServer: null,
        isLoading: false,
        isAuthenticated: false,
        jellyfinReady: false,
      });
      setTimeout(() => navigate("/select-server"), 4000);
    },
    [navigate]
  );

  // ── 5-minute subscription ping ────────────────────────────────────────────
  useEffect(() => {
    if (!state.isAuthenticated) return;

    const interval = setInterval(async () => {
      try {
        const result = await pingMutation.mutateAsync();
        if (!result.active) {
          forceLogout(result.reason);
        }
      } catch {
        console.warn("[Voltix] Subscription ping failed (network error)");
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [state.isAuthenticated, pingMutation, forceLogout]);

  return (
    <VoltixAuthContext.Provider value={{ ...state, login, logout, forceLogout }}>
      {forceLogoutReason && (
        <ForceLogoutBanner
          reason={forceLogoutReason}
          onDismiss={() => setForceLogoutReason(null)}
        />
      )}
      {children}
    </VoltixAuthContext.Provider>
  );
}

function ForceLogoutBanner({ reason, onDismiss }: { reason: string; onDismiss: () => void }) {
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(interval); onDismiss(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onDismiss]);

  const message =
    reason === "subscription_inactive"
      ? "Your subscription has expired. Please renew your plan to continue streaming."
      : reason === "invalid_session"
      ? "Your session has been invalidated. Please log in again."
      : "You have been logged out. Please contact support if this was unexpected.";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="max-w-md w-full mx-4 rounded-2xl border border-red-500/30 bg-card p-8 text-center shadow-2xl">
        <div className="mb-4 text-5xl">⚠️</div>
        <h2 className="mb-2 text-2xl font-bold text-red-400" style={{ fontFamily: "Rajdhani, sans-serif" }}>Access Suspended</h2>
        <p className="mb-6 text-muted-foreground text-sm leading-relaxed">{message}</p>
        <p className="mb-4 text-xs text-muted-foreground">Redirecting in {countdown}s...</p>
        <button onClick={onDismiss} className="w-full rounded-lg bg-red-500/20 border border-red-500/40 px-4 py-2 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors">
          Go to Server Selection Now
        </button>
      </div>
    </div>
  );
}

export function useVoltixAuth() {
  const ctx = useContext(VoltixAuthContext);
  if (!ctx) throw new Error("useVoltixAuth must be used within VoltixAuthProvider");
  return ctx;
}

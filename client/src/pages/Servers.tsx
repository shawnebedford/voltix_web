import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useVoltixAuth } from "@/contexts/VoltixAuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, Server, ExternalLink, Zap, LogOut, ChevronRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const SERVER_ICONS: Record<string, string> = {
  "Main Server": "🏆",
  "Extra Server": "🌐",
  "4K Server": "🎬",
};

function getServerIcon(name: string): string {
  for (const [key, icon] of Object.entries(SERVER_ICONS)) {
    if (name.includes(key)) return icon;
  }
  return "📡";
}

function getServerBadge(name: string): { label: string; color: string } | null {
  if (name.includes("Main")) return { label: "Primary", color: "oklch(0.72 0.18 195)" };
  if (name.includes("4K")) return { label: "4K Ultra HD", color: "oklch(0.75 0.18 60)" };
  if (name.includes("Shared")) return { label: "Shared", color: "oklch(0.65 0.15 280)" };
  return null;
}

export default function Servers() {
  const { user, activeServer, logout } = useVoltixAuth();
  const [, navigate] = useLocation();
  const { data: servers, isLoading } = trpc.voltix.servers.useQuery();
  const connectServer = trpc.voltix.connectServer.useMutation();
  const [connecting, setConnecting] = useState<number | null>(null);

  const handleConnect = async (server: { id: number; name: string; proxyUrl: string }) => {
    setConnecting(server.id);
    try {
      const result = await connectServer.mutateAsync({ serverId: server.id });
      const proxyBase = window.location.origin + result.proxyUrl;
      window.open(proxyBase, "_blank", "noopener,noreferrer");
      toast.success(`Connected to ${result.serverName}`, {
        description: "Your session is authenticated through Voltix.",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection failed.";
      if (msg.includes("inactive") || msg.includes("subscription")) {
        toast.error("Your subscription is inactive. Please renew to continue.");
      } else {
        toast.error("Could not connect to server. Please try again.");
      }
    } finally {
      setConnecting(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.info("You have been signed out.");
    navigate("/select-server");
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 20% 20%, oklch(0.12 0.04 220) 0%, oklch(0.08 0.01 240) 50%, oklch(0.05 0.005 240) 100%)" }}
    >
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "linear-gradient(oklch(0.72 0.18 195 / 0.03) 1px, transparent 1px), linear-gradient(90deg, oklch(0.72 0.18 195 / 0.03) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <img src="/manus-storage/voltix-logo_19225241.png" alt="Voltix" style={{ height: "40px", filter: "drop-shadow(0 0 10px oklch(0.72 0.18 195 / 0.4))" }} />
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-foreground">{user?.displayName ?? user?.username}</p>
              <div className="flex items-center gap-1 justify-end">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "oklch(0.72 0.22 145)" }} />
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/account")} className="text-muted-foreground hover:text-foreground text-xs">Account</Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>

        {/* Active server banner */}
        {activeServer && (
          <div className="mb-6 rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "oklch(0.72 0.22 145 / 0.06)", border: "1px solid oklch(0.72 0.22 145 / 0.2)" }}>
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: "oklch(0.72 0.22 145)" }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">Authenticated: {activeServer.name}</p>
              <p className="text-xs text-muted-foreground">Switch to another server below</p>
            </div>
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2" style={{ fontFamily: "Rajdhani, sans-serif", letterSpacing: "0.05em" }}>Streaming Servers</h1>
          <p className="text-muted-foreground text-sm">Connect to any server. Authentication is handled automatically.</p>
        </div>

        {/* Server list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: "oklch(0.72 0.18 195)" }} />
          </div>
        ) : (
          <div className="space-y-4">
            {servers?.map((server) => {
              const icon = getServerIcon(server.name);
              const badge = getServerBadge(server.name);
              const isActive = activeServer?.id === server.id;

              return (
                <div
                  key={server.id}
                  className="rounded-2xl p-5 transition-all duration-300"
                  style={{
                    background: "oklch(0.10 0.015 240 / 0.9)",
                    backdropFilter: "blur(20px)",
                    border: isActive ? "1px solid oklch(0.72 0.22 145 / 0.4)" : "1px solid oklch(0.22 0.02 240 / 0.6)",
                    boxShadow: isActive ? "0 0 20px oklch(0.72 0.22 145 / 0.08)" : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLDivElement).style.borderColor = "oklch(0.72 0.18 195 / 0.4)";
                      (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 20px oklch(0.72 0.18 195 / 0.1)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLDivElement).style.borderColor = "oklch(0.22 0.02 240 / 0.6)";
                      (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                    }
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center text-2xl" style={{ background: "oklch(0.15 0.02 240)", border: "1px solid oklch(0.25 0.02 240)" }}>
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-foreground text-base leading-tight">{server.name}</h3>
                        {badge && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: `${badge.color}20`, color: badge.color, border: `1px solid ${badge.color}40` }}>
                            {badge.label}
                          </span>
                        )}
                        {isActive && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "oklch(0.72 0.22 145 / 0.12)", color: "oklch(0.72 0.22 145)", border: "1px solid oklch(0.72 0.22 145 / 0.3)" }}>
                            ✓ Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Server className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <p className="text-xs text-muted-foreground truncate font-mono">{server.proxyUrl}</p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "oklch(0.72 0.22 145)" }} />
                        <p className="text-xs" style={{ color: "oklch(0.72 0.22 145)" }}>Online</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleConnect(server)}
                      disabled={connecting === server.id}
                      size="sm"
                      className="flex-shrink-0 gap-1.5 font-semibold"
                      style={{
                        background: connecting === server.id ? undefined : "linear-gradient(135deg, oklch(0.72 0.18 195), oklch(0.65 0.22 185))",
                        color: "oklch(0.08 0.01 240)",
                        boxShadow: connecting === server.id ? undefined : "0 4px 12px oklch(0.72 0.18 195 / 0.3)",
                      }}
                    >
                      {connecting === server.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <><Zap className="h-3.5 w-3.5" />Connect<ChevronRight className="h-3.5 w-3.5" /></>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 rounded-xl p-4 flex items-start gap-3" style={{ background: "oklch(0.72 0.18 195 / 0.05)", border: "1px solid oklch(0.72 0.18 195 / 0.15)" }}>
          <ExternalLink className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "oklch(0.72 0.18 195)" }} />
          <p className="text-xs text-muted-foreground leading-relaxed">
            All connections route securely through Voltix Web. Your streaming credentials are never exposed to your device.
          </p>
        </div>
      </div>
    </div>
  );
}

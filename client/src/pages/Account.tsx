import { trpc } from "@/lib/trpc";
import { useVoltixAuth } from "@/contexts/VoltixAuthContext";
import { Button } from "@/components/ui/button";
import { Monitor, Server, Shield, LogOut, ArrowLeft, Smartphone, Tv, Globe, Clock, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

function DeviceIcon({ name }: { name: string | null }) {
  const n = (name ?? "").toLowerCase();
  if (n.includes("tv") || n.includes("android tv") || n.includes("fire")) return <Tv className="h-4 w-4" />;
  if (n.includes("phone") || n.includes("iphone") || n.includes("android")) return <Smartphone className="h-4 w-4" />;
  if (n.includes("mac") || n.includes("windows") || n.includes("linux") || n.includes("chromebook")) return <Monitor className="h-4 w-4" />;
  return <Globe className="h-4 w-4" />;
}

function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "Never";
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Account() {
  const { user, logout } = useVoltixAuth();
  const [, navigate] = useLocation();
  const { data: devicesData, isLoading } = trpc.voltix.myDevices.useQuery();
  const { data: servers } = trpc.voltix.servers.useQuery();

  const handleLogout = async () => {
    await logout();
    toast.info("Signed out successfully.");
    navigate("/");
  };

  const activeCount = devicesData?.activeCount ?? 0;
  const maxDevices = devicesData?.maxDevices ?? 1;
  const deviceSlotPct = Math.min((activeCount / maxDevices) * 100, 100);

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "radial-gradient(ellipse at 70% 20%, oklch(0.12 0.04 220) 0%, oklch(0.08 0.01 240) 50%, oklch(0.05 0.005 240) 100%)" }}>
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "linear-gradient(oklch(0.72 0.18 195 / 0.03) 1px, transparent 1px), linear-gradient(90deg, oklch(0.72 0.18 195 / 0.03) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate("/servers")} className="text-muted-foreground hover:text-foreground gap-1.5">
            <ArrowLeft className="h-4 w-4" />Back
          </Button>
          <div className="flex-1" />
          <img src="/manus-storage/voltix-logo_19225241.png" alt="Voltix" style={{ height: "32px", filter: "drop-shadow(0 0 8px oklch(0.72 0.18 195 / 0.4))" }} />
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-6" style={{ fontFamily: "Rajdhani, sans-serif", letterSpacing: "0.05em" }}>My Account</h1>

        {/* Profile card */}
        <div className="rounded-2xl p-6 mb-5" style={{ background: "oklch(0.10 0.015 240 / 0.9)", backdropFilter: "blur(20px)", border: "1px solid oklch(0.22 0.02 240 / 0.6)" }}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold" style={{ background: "linear-gradient(135deg, oklch(0.72 0.18 195), oklch(0.65 0.22 185))", color: "oklch(0.08 0.01 240)" }}>
              {(user?.displayName ?? user?.username ?? "?")[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-foreground">{user?.displayName ?? user?.username}</h2>
              <p className="text-sm text-muted-foreground">@{user?.username}</p>
              {user?.email && <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>}
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5 justify-end mb-1">
                <div className="w-2 h-2 rounded-full" style={{ background: user?.isActive ? "oklch(0.72 0.22 145)" : "oklch(0.65 0.22 25)" }} />
                <span className="text-sm font-medium" style={{ color: user?.isActive ? "oklch(0.72 0.22 145)" : "oklch(0.65 0.22 25)" }}>{user?.isActive ? "Active" : "Inactive"}</span>
              </div>
              <p className="text-xs text-muted-foreground">Subscription</p>
            </div>
          </div>
        </div>

        {/* Subscription status */}
        <div className="rounded-2xl p-5 mb-5" style={{ background: user?.isActive ? "oklch(0.72 0.22 145 / 0.06)" : "oklch(0.65 0.22 25 / 0.06)", border: `1px solid ${user?.isActive ? "oklch(0.72 0.22 145 / 0.2)" : "oklch(0.65 0.22 25 / 0.2)"}` }}>
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 flex-shrink-0" style={{ color: user?.isActive ? "oklch(0.72 0.22 145)" : "oklch(0.65 0.22 25)" }} />
            <div>
              <p className="font-semibold text-foreground text-sm">{user?.isActive ? "Subscription Active" : "Subscription Inactive"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{user?.isActive ? "You have full access to all Voltix streaming servers." : "Your subscription has expired. Contact support to renew."}</p>
            </div>
          </div>
        </div>

        {/* Device slot usage */}
        <div className="rounded-2xl p-6 mb-5" style={{ background: "oklch(0.10 0.015 240 / 0.9)", backdropFilter: "blur(20px)", border: "1px solid oklch(0.22 0.02 240 / 0.6)" }}>
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2" style={{ fontFamily: "Rajdhani, sans-serif" }}>
            <Smartphone className="h-5 w-5" style={{ color: "oklch(0.72 0.18 195)" }} />
            Device Slots
          </h3>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">{activeCount} of {maxDevices} device{maxDevices !== 1 ? "s" : ""} in use</p>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: activeCount >= maxDevices ? "oklch(0.65 0.22 25 / 0.15)" : "oklch(0.72 0.22 145 / 0.15)", color: activeCount >= maxDevices ? "oklch(0.65 0.22 25)" : "oklch(0.72 0.22 145)" }}>
              {activeCount >= maxDevices ? "Limit reached" : `${maxDevices - activeCount} slot${maxDevices - activeCount !== 1 ? "s" : ""} free`}
            </span>
          </div>
          <div className="w-full rounded-full overflow-hidden" style={{ height: "6px", background: "oklch(0.18 0.015 240)" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${deviceSlotPct}%`, background: activeCount >= maxDevices ? "oklch(0.65 0.22 25)" : "linear-gradient(90deg, oklch(0.72 0.18 195), oklch(0.65 0.22 185))" }} />
          </div>
        </div>

        {/* Active sessions */}
        <div className="rounded-2xl p-6 mb-5" style={{ background: "oklch(0.10 0.015 240 / 0.9)", backdropFilter: "blur(20px)", border: "1px solid oklch(0.22 0.02 240 / 0.6)" }}>
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2" style={{ fontFamily: "Rajdhani, sans-serif" }}>
            <Monitor className="h-5 w-5" style={{ color: "oklch(0.72 0.18 195)" }} />
            Active Sessions
          </h3>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading sessions...</p>
          ) : devicesData?.sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active sessions found.</p>
          ) : (
            <div className="space-y-3">
              {devicesData?.sessions.map(session => (
                <div key={session.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "oklch(0.15 0.02 240)", color: "oklch(0.72 0.18 195)" }}>
                    <DeviceIcon name={session.deviceName} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{session.deviceName ?? "Unknown Device"}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Ping: {timeAgo(session.lastPingAt)}</p>
                      </div>
                      {session.tokenRefreshedAt && (
                        <div className="flex items-center gap-1">
                          <RefreshCw className="h-3 w-3 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Token: {timeAgo(session.tokenRefreshedAt)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: session.jellyfinReady ? "oklch(0.72 0.22 145)" : "oklch(0.65 0.22 25)" }} />
                    <span className="text-xs text-muted-foreground">{session.jellyfinReady ? "Ready" : "No token"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Connected servers */}
        <div className="rounded-2xl p-6 mb-8" style={{ background: "oklch(0.10 0.015 240 / 0.9)", backdropFilter: "blur(20px)", border: "1px solid oklch(0.22 0.02 240 / 0.6)" }}>
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2" style={{ fontFamily: "Rajdhani, sans-serif" }}>
            <Server className="h-5 w-5" style={{ color: "oklch(0.72 0.18 195)" }} />
            Available Servers
          </h3>
          <div className="space-y-2">
            {servers?.map(server => (
              <div key={server.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "oklch(0.72 0.22 145)" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{server.name}</p>
                  <p className="text-xs text-muted-foreground truncate font-mono">{server.proxyUrl}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sign out */}
        <Button variant="outline" onClick={handleLogout} className="w-full h-11 gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300">
          <LogOut className="h-4 w-4" />Sign Out
        </Button>
      </div>
    </div>
  );
}

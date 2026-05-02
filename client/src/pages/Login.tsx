import { useEffect, useState } from "react";
import { useVoltixAuth } from "@/contexts/VoltixAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Zap, Smartphone, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { detectDeviceName } from "@/lib/deviceInfo";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";

export default function Login() {
  const { login } = useVoltixAuth();
  const params = useParams<{ serverId: string }>();
  const [, navigate] = useLocation();
  const serverId = params.serverId ? parseInt(params.serverId, 10) : undefined;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [deviceLimitError, setDeviceLimitError] = useState<string | null>(null);
  const [detectedDevice, setDetectedDevice] = useState<string>("Web Browser");

  // Fetch the selected server info for display
  const { data: servers } = trpc.voltix.servers.useQuery();
  const selectedServer = serverId ? servers?.find((s) => s.id === serverId) : servers?.[0];

  useEffect(() => {
    detectDeviceName().then(setDetectedDevice).catch(() => setDetectedDevice("Web Browser"));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeviceLimitError(null);
    if (!username.trim() || !password.trim()) {
      toast.error("Please enter your username and password.");
      return;
    }
    setIsLoading(true);
    try {
      // Pass the selected serverId so Voltix Web authenticates against the right server
      await login(username.trim(), password, detectedDevice, serverId);
      toast.success("Welcome back to Voltix Studios!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed.";
      if (msg.includes("Device limit") || msg.includes("device")) {
        setDeviceLimitError(msg);
      } else if (msg.includes("inactive") || msg.includes("subscription")) {
        toast.error("Your subscription is inactive. Please renew your plan.", { duration: 6000 });
      } else {
        toast.error("Invalid username or password.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 30% 50%, oklch(0.12 0.04 220) 0%, oklch(0.08 0.01 240) 50%, oklch(0.05 0.005 240) 100%)",
      }}
    >
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute rounded-full" style={{ width: "600px", height: "600px", top: "-200px", left: "-200px", background: "radial-gradient(circle, oklch(0.72 0.18 195 / 0.06) 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute rounded-full" style={{ width: "400px", height: "400px", bottom: "-100px", right: "-100px", background: "radial-gradient(circle, oklch(0.65 0.22 185 / 0.06) 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(oklch(0.72 0.18 195 / 0.03) 1px, transparent 1px), linear-gradient(90deg, oklch(0.72 0.18 195 / 0.03) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Back button */}
        <button
          onClick={() => navigate("/select-server")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Choose a different server
        </button>

        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <img src="/manus-storage/voltix-logo_19225241.png" alt="Voltix Streaming Service" className="mb-4" style={{ width: "240px", filter: "drop-shadow(0 0 20px oklch(0.72 0.18 195 / 0.4))" }} />
          <p className="text-xs font-medium tracking-[0.3em] uppercase" style={{ color: "oklch(0.72 0.18 195 / 0.7)" }}>Member Access</p>
        </div>

        {/* Selected server indicator */}
        {selectedServer && (
          <div
            className="mb-5 rounded-xl px-4 py-3 flex items-center gap-3"
            style={{ background: "oklch(0.72 0.18 195 / 0.06)", border: "1px solid oklch(0.72 0.18 195 / 0.2)" }}
          >
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "oklch(0.72 0.22 145)" }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{selectedServer.name}</p>
              <p className="text-xs text-muted-foreground">Signing in to this server</p>
            </div>
            {selectedServer.badge && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "oklch(0.72 0.18 195 / 0.12)", color: "oklch(0.72 0.18 195)", border: "1px solid oklch(0.72 0.18 195 / 0.3)" }}>
                {selectedServer.badge}
              </span>
            )}
          </div>
        )}

        {/* Device limit error banner */}
        {deviceLimitError && (
          <div className="mb-4 rounded-xl p-4 flex items-start gap-3" style={{ background: "oklch(0.75 0.18 60 / 0.08)", border: "1px solid oklch(0.75 0.18 60 / 0.3)" }}>
            <Smartphone className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "oklch(0.75 0.18 60)" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "oklch(0.75 0.18 60)" }}>Device Limit Reached</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{deviceLimitError}</p>
            </div>
          </div>
        )}

        {/* Login card */}
        <div className="rounded-2xl p-8" style={{ background: "oklch(0.10 0.015 240 / 0.9)", backdropFilter: "blur(20px)", border: "1px solid oklch(0.25 0.02 240 / 0.5)", boxShadow: "0 25px 60px oklch(0 0 0 / 0.5), inset 0 1px 0 oklch(0.72 0.18 195 / 0.1)" }}>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-1" style={{ fontFamily: "Rajdhani, sans-serif", letterSpacing: "0.05em" }}>Sign In</h1>
            <p className="text-sm text-muted-foreground">Enter your Voltix credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium text-foreground/80">Username</Label>
              <Input id="username" type="text" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="your_username" disabled={isLoading} className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30 h-11" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground/80">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" disabled={isLoading} className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30 h-11 pr-10" />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={isLoading} className="w-full h-11 font-semibold text-sm tracking-wide" style={{ background: isLoading ? undefined : "linear-gradient(135deg, oklch(0.72 0.18 195), oklch(0.65 0.22 185))", boxShadow: isLoading ? undefined : "0 4px 20px oklch(0.72 0.18 195 / 0.3)" }}>
              {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Authenticating...</>) : (<><Zap className="mr-2 h-4 w-4" />Sign In to Voltix</>)}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Don't have an account? Contact{" "}
          <span style={{ color: "oklch(0.72 0.18 195)" }}>Voltix Studios support</span> to get access.
        </p>
      </div>
    </div>
  );
}

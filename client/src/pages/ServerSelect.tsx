import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";

// ─── Server icon image URLs ───────────────────────────────────────────────────
const SERVER_ICON_URLS: Record<string, string> = {
  main:  "https://d2xsxph8kpxj0f.cloudfront.net/310519663620046853/Ud8motDaptwyKTemR5vajx/voltix-icon-main-diNBhW9EnXo3uCGWhfxcmn.webp",
  extra: "https://d2xsxph8kpxj0f.cloudfront.net/310519663620046853/Ud8motDaptwyKTemR5vajx/voltix-icon-extra-NgHawDqdsRhXy3mQTxEGzm.webp",
  "4k":  "https://d2xsxph8kpxj0f.cloudfront.net/310519663620046853/Ud8motDaptwyKTemR5vajx/voltix-icon-4k-DaqWp3N8pqq5PL5fbnmNsT.webp",
};

const SERVER_GRADIENT: Record<string, string> = {
  main:  "linear-gradient(135deg, oklch(0.72 0.18 195), oklch(0.55 0.2 240))",
  extra: "linear-gradient(135deg, oklch(0.65 0.22 295), oklch(0.55 0.2 270))",
  "4k":  "linear-gradient(135deg, oklch(0.75 0.18 60), oklch(0.65 0.22 25))",
};

const SERVER_GLOW: Record<string, string> = {
  main:  "oklch(0.72 0.18 195 / 0.25)",
  extra: "oklch(0.65 0.22 295 / 0.25)",
  "4k":  "oklch(0.75 0.18 60 / 0.25)",
};

type CardState = "idle" | "connecting" | "error";

// ─── Main component ───────────────────────────────────────────────────────────

export default function ServerSelect() {
  const [, navigate] = useLocation();
  const { data: servers, isLoading } = trpc.voltix.servers.useQuery();

  /** Per-card state map: id → "idle" | "connecting" | "error" */
  const [cardStates, setCardStates] = useState<Record<number, CardState>>({});
  /** Full-screen fade-to-black overlay */
  const [transitioning, setTransitioning] = useState(false);

  const setCardState = (id: number, state: CardState) =>
    setCardStates((prev) => ({ ...prev, [id]: state }));

  const anyConnecting = Object.values(cardStates).some((s) => s === "connecting");

  const handleSelectServer = (serverId: number) => {
    if (anyConnecting) return;

    setCardState(serverId, "connecting");

    // Simulate a connection check — in production this would be a real health
    // check or the first step of the auth flow. Here we attempt to reach the
    // proxy endpoint; if it fails we surface the error state.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    fetch(`/api/jellyfin/${serverId}/System/Info/Public`, {
      signal: controller.signal,
    })
      .then((res) => {
        clearTimeout(timeout);
        // Any response (even 401/403) means the proxy is reachable
        if (res.status < 500) {
          // Success — fade out and navigate
          setTimeout(() => {
            setTransitioning(true);
            setTimeout(() => navigate(`/login/${serverId}`), 400);
          }, 300);
        } else {
          setCardState(serverId, "error");
        }
      })
      .catch(() => {
        clearTimeout(timeout);
        // Network error or abort — show error state
        setCardState(serverId, "error");
      });
  };

  const handleRetry = (serverId: number) => {
    setCardState(serverId, "idle");
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% 30%, oklch(0.12 0.04 220) 0%, oklch(0.08 0.01 240) 55%, oklch(0.05 0.005 240) 100%)",
      }}
    >
      {/* Full-screen fade-to-black transition overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50 bg-black"
        style={{
          opacity: transitioning ? 1 : 0,
          transition: "opacity 0.4s ease",
        }}
      />

      {/* Background grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.72 0.18 195 / 0.03) 1px, transparent 1px), linear-gradient(90deg, oklch(0.72 0.18 195 / 0.03) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute rounded-full" style={{ width: "500px", height: "500px", top: "-150px", left: "-150px", background: "radial-gradient(circle, oklch(0.72 0.18 195 / 0.05) 0%, transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute rounded-full" style={{ width: "400px", height: "400px", bottom: "-100px", right: "-100px", background: "radial-gradient(circle, oklch(0.65 0.22 295 / 0.05) 0%, transparent 70%)", filter: "blur(80px)" }} />
      </div>

      <div className="relative z-10 w-full max-w-4xl px-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-12">
          <img
            src="/manus-storage/voltix-logo_19225241.png"
            alt="Voltix Streaming Service"
            style={{ width: "240px", filter: "drop-shadow(0 0 20px oklch(0.72 0.18 195 / 0.4))", marginBottom: "16px" }}
          />
          <h1
            className="text-3xl font-bold text-foreground mb-2"
            style={{ fontFamily: "Rajdhani, sans-serif", letterSpacing: "0.08em" }}
          >
            Choose Your Server
          </h1>
          <p className="text-sm text-muted-foreground">
            Select a streaming server to sign in to
          </p>
        </div>

        {/* Server cards */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: "oklch(0.72 0.18 195)" }} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {servers?.map((server) => {
              const iconUrl  = SERVER_ICON_URLS[server.iconKey] ?? SERVER_ICON_URLS.main;
              const gradient = SERVER_GRADIENT[server.iconKey]  ?? SERVER_GRADIENT.main;
              const glow     = SERVER_GLOW[server.iconKey]      ?? SERVER_GLOW.main;
              const state: CardState = cardStates[server.id] ?? "idle";
              const isConnecting = state === "connecting";
              const isError      = state === "error";
              const isOtherBusy  = anyConnecting && !isConnecting;

              return (
                <div
                  key={server.id}
                  className="flex flex-col items-center gap-5 rounded-3xl p-8 transition-all duration-300 relative overflow-hidden"
                  style={{
                    background: isError
                      ? "oklch(0.12 0.02 15 / 0.9)"
                      : isConnecting
                      ? "oklch(0.13 0.02 240 / 0.95)"
                      : "oklch(0.10 0.015 240 / 0.9)",
                    backdropFilter: "blur(20px)",
                    border: isError
                      ? "1px solid oklch(0.65 0.22 25 / 0.6)"
                      : isConnecting
                      ? `1px solid ${glow.replace("/ 0.25", "/ 0.8")}`
                      : "1px solid oklch(0.22 0.02 240 / 0.6)",
                    boxShadow: isError
                      ? "0 0 40px oklch(0.65 0.22 25 / 0.2)"
                      : isConnecting
                      ? `0 0 40px ${glow}, 0 0 80px ${glow.replace("/ 0.25", "/ 0.15")}`
                      : "none",
                    opacity: isOtherBusy ? 0.4 : 1,
                    cursor: isOtherBusy ? "default" : "default",
                  }}
                  onMouseEnter={(e) => {
                    if (state !== "idle" || isOtherBusy) return;
                    const el = e.currentTarget;
                    el.style.borderColor = `${glow.replace("/ 0.25", "/ 0.6")}`;
                    el.style.boxShadow = `0 0 40px ${glow}, 0 0 80px ${glow.replace("/ 0.25", "/ 0.1")}`;
                    el.style.transform = "translateY(-4px)";
                    const img = el.querySelector("img");
                    if (img) {
                      img.style.transform = "scale(1.12)";
                      img.style.boxShadow = `0 8px 40px ${glow.replace("/ 0.25", "/ 0.7")}, 0 0 60px ${glow.replace("/ 0.25", "/ 0.4")}`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (state !== "idle" || isOtherBusy) return;
                    const el = e.currentTarget;
                    el.style.borderColor = "oklch(0.22 0.02 240 / 0.6)";
                    el.style.boxShadow = "none";
                    el.style.transform = "translateY(0)";
                    const img = el.querySelector("img");
                    if (img) {
                      img.style.transform = "scale(1)";
                      img.style.boxShadow = `0 4px 24px ${glow}`;
                    }
                  }}
                >
                  {/* Icon area */}
                  <div className="relative w-24 h-24">
                    <img
                      src={iconUrl}
                      alt={server.shortLabel}
                      className="w-24 h-24 rounded-2xl object-cover transition-all duration-300"
                      style={{
                        boxShadow: isError
                          ? "0 4px 24px oklch(0.65 0.22 25 / 0.4)"
                          : isConnecting
                          ? `0 8px 40px ${glow.replace("/ 0.25", "/ 0.7")}, 0 0 60px ${glow.replace("/ 0.25", "/ 0.4")}`
                          : `0 4px 24px ${glow}`,
                        opacity: isConnecting || isError ? 0.3 : 1,
                        transform: isConnecting ? "scale(1.08)" : "scale(1)",
                      }}
                    />

                    {/* Connecting spinner (colour-matched) */}
                    {isConnecting && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2
                          className="h-10 w-10 animate-spin"
                          style={{ color: glow.replace("/ 0.25", "/ 1") }}
                        />
                      </div>
                    )}

                    {/* Error icon (red) */}
                    {isError && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <AlertCircle
                          className="h-10 w-10"
                          style={{ color: "oklch(0.65 0.22 25)" }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Server name */}
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1 flex-wrap">
                      <h3
                        className="text-lg font-bold transition-colors duration-300"
                        style={{
                          fontFamily: "Rajdhani, sans-serif",
                          letterSpacing: "0.05em",
                          color: isError ? "oklch(0.65 0.22 25)" : "oklch(0.95 0.01 240)",
                        }}
                      >
                        {server.shortLabel}
                      </h3>
                      {server.badge && !isError && (
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background: `${gradient.split(",")[0].replace("linear-gradient(135deg, ", "")}20`,
                            color: gradient.split(",")[0].replace("linear-gradient(135deg, ", ""),
                            border: `1px solid ${gradient.split(",")[0].replace("linear-gradient(135deg, ", "")}40`,
                          }}
                        >
                          {server.badge}
                        </span>
                      )}
                    </div>

                    {/* Error message */}
                    {isError && (
                      <p className="text-xs mt-1 leading-snug" style={{ color: "oklch(0.65 0.22 25 / 0.8)" }}>
                        Could not reach server.<br />Check your connection.
                      </p>
                    )}
                  </div>

                  {/* CTA / Retry button */}
                  {isError ? (
                    <button
                      onClick={() => handleRetry(server.id)}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold text-center flex items-center justify-center gap-2 transition-all duration-200 hover:opacity-90 active:scale-95"
                      style={{
                        background: "oklch(0.65 0.22 25 / 0.15)",
                        color: "oklch(0.65 0.22 25)",
                        border: "1px solid oklch(0.65 0.22 25 / 0.4)",
                      }}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Try Again
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSelectServer(server.id)}
                      disabled={isOtherBusy || isConnecting}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold text-center flex items-center justify-center gap-2 transition-all duration-300 hover:opacity-90 active:scale-95 disabled:cursor-default"
                      style={{
                        background: gradient,
                        color: "oklch(0.08 0.01 240)",
                        boxShadow: `0 4px 16px ${glow}`,
                        opacity: isConnecting ? 0.7 : 1,
                      }}
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Connecting…
                        </>
                      ) : (
                        "Sign In Here"
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

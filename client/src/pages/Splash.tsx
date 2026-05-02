import { useEffect, useState } from "react";

interface SplashProps {
  onComplete: () => void;
}

export default function Splash({ onComplete }: SplashProps) {
  const [phase, setPhase] = useState<"logo" | "tagline" | "fade">("logo");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("tagline"), 800);
    const t2 = setTimeout(() => setPhase("fade"), 2200);
    const t3 = setTimeout(() => onComplete(), 2800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, oklch(0.12 0.04 220) 0%, oklch(0.08 0.01 240) 60%, oklch(0.05 0.005 240) 100%)",
        transition: "opacity 0.6s ease",
        opacity: phase === "fade" ? 0 : 1,
      }}
    >
      {/* Background particle dots */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 3 + 1}px`,
              background: `oklch(0.72 0.18 195 / ${Math.random() * 0.4 + 0.1})`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `voltix-pulse ${Math.random() * 3 + 2}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Glow ring behind logo */}
      <div
        className="absolute rounded-full"
        style={{
          width: "400px",
          height: "400px",
          background:
            "radial-gradient(circle, oklch(0.72 0.18 195 / 0.12) 0%, transparent 70%)",
          filter: "blur(40px)",
          transform: "translateY(-20px)",
        }}
      />

      {/* Logo */}
      <div
        style={{
          transform: phase === "logo" ? "scale(0.85) translateY(10px)" : "scale(1) translateY(0)",
          opacity: phase === "logo" ? 0 : 1,
          transition: "all 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <img
          src="/manus-storage/voltix-logo_19225241.png"
          alt="Voltix Streaming Service"
          style={{ width: "380px", maxWidth: "80vw", filter: "drop-shadow(0 0 30px oklch(0.72 0.18 195 / 0.5))" }}
        />
      </div>

      {/* Tagline */}
      <div
        style={{
          opacity: phase === "tagline" || phase === "fade" ? 1 : 0,
          transform: phase === "tagline" || phase === "fade" ? "translateY(0)" : "translateY(12px)",
          transition: "all 0.5s ease",
          marginTop: "24px",
        }}
      >
        <p
          className="text-center text-sm font-medium tracking-[0.3em] uppercase"
          style={{ color: "oklch(0.72 0.18 195 / 0.8)" }}
        >
          Premium Streaming Experience
        </p>
      </div>

      {/* Loading bar */}
      <div
        className="absolute bottom-16"
        style={{
          opacity: phase === "tagline" ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      >
        <div
          className="rounded-full overflow-hidden"
          style={{ width: "200px", height: "2px", background: "oklch(0.2 0.015 240)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              background: "linear-gradient(90deg, oklch(0.72 0.18 195), oklch(0.65 0.22 185))",
              animation: "loadBar 1.5s ease-in-out forwards",
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes loadBar {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        @keyframes voltix-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

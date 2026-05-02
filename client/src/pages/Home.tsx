import { useEffect } from "react";
import { useVoltixAuth } from "@/contexts/VoltixAuthContext";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { isAuthenticated, isLoading } = useVoltixAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        navigate("/servers");
      } else {
        // Server-first flow: always start at server selection
        navigate("/select-server");
      }
    }
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, oklch(0.12 0.04 220) 0%, oklch(0.08 0.01 240) 60%, oklch(0.05 0.005 240) 100%)",
      }}
    >
      <div className="flex flex-col items-center gap-4">
        <img
          src="/manus-storage/voltix-logo_19225241.png"
          alt="Voltix"
          style={{ width: "200px", filter: "drop-shadow(0 0 20px oklch(0.72 0.18 195 / 0.4))" }}
        />
        <Loader2 className="h-6 w-6 animate-spin mt-2" style={{ color: "oklch(0.72 0.18 195)" }} />
      </div>
    </div>
  );
}

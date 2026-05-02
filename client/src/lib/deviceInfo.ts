/**
 * deviceInfo.ts
 * Silently detects the device name from browser APIs.
 * This is sent to the server at login time and never shown to the user.
 */

interface NavigatorUAData {
  platform?: string;
  brands?: Array<{ brand: string; version: string }>;
  mobile?: boolean;
  getHighEntropyValues?: (hints: string[]) => Promise<{
    platform?: string;
    platformVersion?: string;
    model?: string;
    mobile?: boolean;
  }>;
}

/**
 * Returns a human-readable device name derived from the browser environment.
 * Tries the modern User-Agent Client Hints API first, then falls back to
 * legacy UA string parsing.
 */
export async function detectDeviceName(): Promise<string> {
  try {
    // Modern API: navigator.userAgentData (Chrome 90+, Edge 90+)
    const uaData = (navigator as unknown as { userAgentData?: NavigatorUAData }).userAgentData;
    if (uaData?.getHighEntropyValues) {
      const hints = await uaData.getHighEntropyValues([
        "platform",
        "platformVersion",
        "model",
        "mobile",
      ]);
      const platform = hints.platform ?? uaData.platform ?? "";
      const model = hints.model ?? "";
      const mobile = hints.mobile ?? uaData.mobile ?? false;

      if (model && model !== "") {
        // e.g. "Pixel 7", "Galaxy S23"
        return model;
      }
      if (platform) {
        const version = hints.platformVersion ?? "";
        if (mobile) return `${platform} Mobile${version ? ` (${version})` : ""}`;
        return `${platform}${version ? ` ${version}` : ""}`;
      }
    }
  } catch {
    // Fall through to UA string parsing
  }

  // Legacy fallback: parse the user-agent string
  return parseUAString(navigator.userAgent);
}

function parseUAString(ua: string): string {
  // Android TV / Fire TV
  if (/AFT/i.test(ua)) return "Amazon Fire TV";
  if (/Android.*TV|TV.*Android/i.test(ua)) return "Android TV";

  // Android phones/tablets
  const androidMatch = ua.match(/Android[^;]*;\s*([^)]+)\)/);
  if (androidMatch) {
    const model = androidMatch[1].trim();
    // Clean up common noise
    const clean = model.replace(/Build\/[^\s)]+/, "").trim();
    if (clean) return clean;
    return "Android Device";
  }

  // iOS
  if (/iPad/i.test(ua)) {
    const match = ua.match(/OS (\d+_\d+)/);
    return match ? `iPad (iOS ${match[1].replace("_", ".")})` : "iPad";
  }
  if (/iPhone/i.test(ua)) {
    const match = ua.match(/OS (\d+_\d+)/);
    return match ? `iPhone (iOS ${match[1].replace("_", ".")})` : "iPhone";
  }

  // Desktop OS
  if (/Windows NT 10/i.test(ua)) return "Windows 10/11 PC";
  if (/Windows NT 6\.3/i.test(ua)) return "Windows 8.1 PC";
  if (/Windows NT 6\.1/i.test(ua)) return "Windows 7 PC";
  if (/Windows/i.test(ua)) return "Windows PC";

  if (/Mac OS X/i.test(ua)) {
    const match = ua.match(/Mac OS X (\d+[._]\d+)/);
    return match ? `Mac (macOS ${match[1].replace("_", ".")})` : "Mac";
  }

  if (/CrOS/i.test(ua)) return "Chromebook";
  if (/Linux/i.test(ua)) return "Linux PC";

  // Browser fallback
  if (/Chrome/i.test(ua)) return "Chrome Browser";
  if (/Firefox/i.test(ua)) return "Firefox Browser";
  if (/Safari/i.test(ua)) return "Safari Browser";

  return "Web Browser";
}

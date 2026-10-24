import type { NextConfig } from "next";

// The PDF fonts (src/lib/pdf-fonts.ts: DejaVu Sans and Tinos) are read from disk at runtime.
const PDF_FONT_FILES = [
  "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf",
  "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf",
  "./node_modules/@expo-google-fonts/tinos/400Regular/Tinos_400Regular.ttf",
  "./node_modules/@expo-google-fonts/tinos/700Bold/Tinos_700Bold.ttf",
  "./node_modules/@expo-google-fonts/tinos/400Regular_Italic/Tinos_400Regular_Italic.ttf",
];

const isDev = process.env.NODE_ENV === "development";

// Content-Security-Policy without nonces (Next's "Without Nonces" guide): sign-in and sign-up are
// static pages, which can't carry a per-request nonce. Everything Tiba loads is its own: scripts,
// fonts (next/font serves them), the practice logo route, signatures as data: URLs. Development
// also needs 'unsafe-eval' for React's debugging. No upgrade-insecure-requests: it would break
// testing over plain HTTP (localhost, a phone on the Wi-Fi); HSTS enforces HTTPS in production.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// Sent with every response. Tiba holds patient information, so it is never framed, never leaks
// its URLs to other sites, and asks browsers for HTTPS only.
const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // HTTPS only, for two years, subdomains too. Browsers ignore it on plain-HTTP localhost.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // No other site may show Tiba in a frame (click-jacking); frame-ancestors covers newer browsers.
  { key: "X-Frame-Options", value: "DENY" },
  // Files are served with the type Tiba checked; browsers mustn't guess another.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Never send page addresses (which can name a patient record) to other sites.
  { key: "Referrer-Policy", value: "no-referrer" },
  // Device features Tiba never uses stay off.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  // Keep other windows and sites from reaching into Tiba's pages and responses.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  // PGlite ships WASM and reads files at runtime, so it must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Deployments ship the PDF fonts with the routes that make PDFs: the API routes, and Invoices
  // (which emails them).
  outputFileTracingIncludes: {
    "/api/**": PDF_FONT_FILES,
    "/invoices": PDF_FONT_FILES,
  },
  // Keep the dev-only badge clear of the sidebar's Sign out button.
  devIndicators: { position: "bottom-right" },
  // Dev mode logs every Server Action's arguments by default. Those carry patient data
  // (names, dates of birth, notes), which must never reach logs.
  logging: { serverFunctions: false },
  // Let the dev server be opened from 127.0.0.1 or a phone on the same Wi-Fi.
  allowedDevOrigins: ["127.0.0.1", "192.168.*.*", "10.*.*.*"],
};

export default nextConfig;

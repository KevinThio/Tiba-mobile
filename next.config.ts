import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM and reads files at runtime, so it must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  // PDFs read the DejaVu font files at runtime (src/lib/pdf-fonts.ts), so deployments must ship
  // them with the routes that make PDFs: the API routes, and Invoices (which emails them).
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf", "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf"],
    "/invoices": ["./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf", "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf"],
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

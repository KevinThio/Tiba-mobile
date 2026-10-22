import type { NextConfig } from "next";

// The PDF fonts (src/lib/pdf-fonts.ts: DejaVu Sans and Tinos) are read from disk at runtime.
const PDF_FONT_FILES = [
  "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf",
  "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf",
  "./node_modules/@expo-google-fonts/tinos/400Regular/Tinos_400Regular.ttf",
  "./node_modules/@expo-google-fonts/tinos/700Bold/Tinos_700Bold.ttf",
  "./node_modules/@expo-google-fonts/tinos/400Regular_Italic/Tinos_400Regular_Italic.ttf",
];

const nextConfig: NextConfig = {
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

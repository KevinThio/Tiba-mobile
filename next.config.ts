import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM and reads files at runtime, so it must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;

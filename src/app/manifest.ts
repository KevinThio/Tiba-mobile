import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tiba",
    short_name: "Tiba",
    description: "Your visit notes, signed and in one place.",
    // "/" sends each account to its own home (homeFor): admins, clinicians, patients and referral sources.
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FBFAFD",
    theme_color: "#2D6A4F",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

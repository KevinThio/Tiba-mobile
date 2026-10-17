import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tiba",
    short_name: "Tiba",
    description: "Your visit notes, signed and in one place.",
    start_url: "/appointments",
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

import "server-only";
import path from "node:path";
import { Font } from "@react-pdf/renderer";

// One font for every PDF (invoices, notes, contracts, agreements, patient records). DejaVu Sans
// (free licence, from the pinned dejavu-fonts-ttf package) has the symbols the built-in Helvetica
// lacks, so every currency prints with its own symbol (₦, ₹, ₱, ₩…). Registered once per process.

export const PDF_FONT = "TibaSans";

const dir = path.join(process.cwd(), "node_modules", "dejavu-fonts-ttf", "ttf");
const g = globalThis as unknown as { __tibaPdfFont?: boolean };
if (!g.__tibaPdfFont) {
  Font.register({
    family: PDF_FONT,
    fonts: [
      { src: path.join(dir, "DejaVuSans.ttf") },
      { src: path.join(dir, "DejaVuSans-Bold.ttf"), fontWeight: "bold" },
    ],
  });
  // Long words wrap instead of being split with hyphens.
  Font.registerHyphenationCallback((word) => [word]);
  g.__tibaPdfFont = true;
}

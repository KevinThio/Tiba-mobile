import "server-only";
import path from "node:path";
import { Font } from "@react-pdf/renderer";

// Two fonts for the PDFs, registered once per process:
// - Sans (DejaVu Sans, from the pinned dejavu-fonts-ttf package) for clinical and money documents:
//   notes, patient records, invoices. It has the symbols the built-in Helvetica lacks, so every
//   currency prints with its own symbol (₦, ₹, ₱, ₩…).
// - Serif (Tinos, from the pinned @expo-google-fonts/tinos package; free OFL licence and the same
//   letter widths as Times New Roman, which can't be bundled) for legal documents: contracts and
//   service agreements. Tinos lacks ؋, ৳ and ฿, so SERIF_STACK falls back to the sans font for them.

export const PDF_FONT = "TibaSans";
export const PDF_SERIF = "TibaSerif";
export const SERIF_STACK = [PDF_SERIF, PDF_FONT];

const dejavu = path.join(process.cwd(), "node_modules", "dejavu-fonts-ttf", "ttf");
const tinos = path.join(process.cwd(), "node_modules", "@expo-google-fonts", "tinos");
const g = globalThis as unknown as { __tibaPdfFonts?: boolean };
if (!g.__tibaPdfFonts) {
  Font.register({
    family: PDF_FONT,
    fonts: [
      { src: path.join(dejavu, "DejaVuSans.ttf") },
      { src: path.join(dejavu, "DejaVuSans-Bold.ttf"), fontWeight: "bold" },
    ],
  });
  Font.register({
    family: PDF_SERIF,
    fonts: [
      { src: path.join(tinos, "400Regular", "Tinos_400Regular.ttf") },
      { src: path.join(tinos, "700Bold", "Tinos_700Bold.ttf"), fontWeight: "bold" },
      { src: path.join(tinos, "400Regular_Italic", "Tinos_400Regular_Italic.ttf"), fontStyle: "italic" },
    ],
  });
  // Long words wrap instead of being split with hyphens.
  Font.registerHyphenationCallback((word) => [word]);
  g.__tibaPdfFonts = true;
}

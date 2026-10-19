/**
 * Top of a finished visit note (on screen and, later, in the PDF): the practice logo
 * if there is one, the practice name, and the clinician. Mirror this layout in the PDF.
 */
export function NoteLetterhead({
  practiceName,
  clinicianName,
  logoUrl,
}: {
  practiceName: string;
  clinicianName: string;
  logoUrl: string | null;
}) {
  return (
    <header className="flex items-center gap-4 border-b pb-5 sm:gap-5">
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- private route, not optimisable
        <img src={logoUrl} alt={`${practiceName} logo`} className="h-14 w-auto max-w-[8rem] shrink-0 object-contain sm:h-16" />
      )}
      <div className="min-w-0">
        <p className="font-heading text-xl leading-tight text-primary sm:text-2xl">{practiceName}</p>
        <p className="text-sm text-muted-foreground">{clinicianName}</p>
      </div>
    </header>
  );
}

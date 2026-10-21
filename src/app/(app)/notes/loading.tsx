/** Loading state (spec v2): grey placeholder rows shaped like the lists. */
export default function NotesLoading() {
  return (
    <div className="grid grid-cols-1 gap-8" aria-busy="true">
      <div className="grid gap-2">
        <span className="h-3 w-16 animate-pulse rounded-xs bg-sunken" />
        <span className="h-9 w-64 max-w-full animate-pulse rounded-sm bg-sunken" />
      </div>
      <div className="grid grid-cols-1 rounded-lg border border-border-subtle bg-card shadow-sm">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border-subtle px-5 py-4 last:border-b-0">
            <span className="size-11 shrink-0 animate-pulse rounded-full bg-sunken" />
            <span className="grid flex-1 gap-2">
              <span className="h-4 w-2/5 animate-pulse rounded-xs bg-sunken" />
              <span className="h-3 w-3/5 animate-pulse rounded-xs bg-sunken" />
            </span>
          </div>
        ))}
      </div>
      <p className="sr-only">Loading your notes…</p>
    </div>
  );
}

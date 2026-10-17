export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <svg viewBox="0 0 96 96" className="size-8" aria-hidden>
        <path d="M30 0H66A30 30 0 0 1 96 30V66A30 30 0 0 1 66 96H8A8 8 0 0 1 0 88V30A30 30 0 0 1 30 0Z" fill="#2D6A4F" />
        <path d="M27 44C33 60 40 67 48 67S63 60 69 44" fill="none" stroke="#CDBDF4" strokeWidth="10" strokeLinecap="round" />
      </svg>
      <span className="font-heading text-2xl text-primary">Tiba</span>
    </span>
  );
}

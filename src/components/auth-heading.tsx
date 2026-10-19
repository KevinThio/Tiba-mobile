export function AuthHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 grid gap-2 text-center lg:text-left">
      <h1 className="text-3xl leading-tight">{title}</h1>
      {children && <p className="text-muted-foreground">{children}</p>}
    </div>
  );
}

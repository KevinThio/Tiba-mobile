import type { LucideIcon } from "lucide-react";

/** Friendly placeholder for "nothing here yet". Copy should say what to do next. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed bg-card px-6 py-14 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
        <Icon className="size-7" aria-hidden />
      </span>
      <h2 className="mt-5 text-xl">{title}</h2>
      {children && <p className="mt-2 max-w-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

import { CircleAlert } from "lucide-react";

/** Form-level problem message. Copy should say what to do next, never scold. */
export function FormAlert({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="flex gap-3 rounded-md bg-danger px-4 py-3 text-sm text-danger-foreground">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>{children}</p>
    </div>
  );
}

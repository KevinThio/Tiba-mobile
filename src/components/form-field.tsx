import type { LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Label, input and an optional hint line. Pass `input` to swap in a different control,
 * `icon` for a leading icon (as on sign-in), and `error` to show a field error that
 * says what to do next (it replaces the hint and marks the field invalid).
 */
export function FormField({
  label,
  hint,
  error,
  icon: Icon,
  input,
  className,
  ...props
}: {
  label: string;
  hint?: string;
  error?: React.ReactNode;
  icon?: LucideIcon;
  input?: React.ReactNode;
} & React.ComponentProps<typeof Input>) {
  const noteId = hint || error ? `${props.name}-hint` : undefined;
  const field = (
    <Input
      id={props.name}
      aria-describedby={noteId}
      aria-invalid={error ? true : undefined}
      className={cn(Icon && "pl-11", className)}
      {...props}
    />
  );
  return (
    <div className="grid gap-2">
      <Label htmlFor={props.name}>{label}</Label>
      {input ??
        (Icon ? (
          <div className="relative">
            <Icon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            {field}
          </div>
        ) : (
          field
        ))}
      {(error || hint) && (
        <p id={noteId} className={cn("text-sm", error ? "text-destructive" : "text-muted-foreground")}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

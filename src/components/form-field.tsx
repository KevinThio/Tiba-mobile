import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Label, input and an optional hint line. Pass `input` to swap in a different control. */
export function FormField({
  label,
  hint,
  input,
  ...props
}: { label: string; hint?: string; input?: React.ReactNode } & React.ComponentProps<typeof Input>) {
  const hintId = hint ? `${props.name}-hint` : undefined;
  return (
    <div className="grid gap-2">
      <Label htmlFor={props.name}>{label}</Label>
      {input ?? <Input id={props.name} aria-describedby={hintId} {...props} />}
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

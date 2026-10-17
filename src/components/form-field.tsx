import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FormField({ label, ...props }: { label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={props.name}>{label}</Label>
      <Input id={props.name} {...props} />
    </div>
  );
}

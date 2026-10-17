import { requireClinician } from "@/lib/auth";

export default async function AppointmentsPage() {
  const clinician = await requireClinician();
  return (
    <section className="grid gap-4">
      <h1 className="text-3xl">Appointments</h1>
      <p className="text-muted-foreground">Welcome, {clinician.name}. The calendar will live here.</p>
    </section>
  );
}

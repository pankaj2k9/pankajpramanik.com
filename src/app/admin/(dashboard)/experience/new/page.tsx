import ExperienceForm from "@/components/admin/ExperienceForm";

export default function NewExperiencePage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold">New experience</h1>
      <div className="mt-6">
        <ExperienceForm />
      </div>
    </div>
  );
}

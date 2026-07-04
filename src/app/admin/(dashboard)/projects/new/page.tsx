import ProjectForm from "@/components/admin/ProjectForm";

export default function NewProjectPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold">New project</h1>
      <div className="mt-6">
        <ProjectForm />
      </div>
    </div>
  );
}

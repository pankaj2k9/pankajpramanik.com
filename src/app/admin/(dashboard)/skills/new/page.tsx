import SkillGroupForm from "@/components/admin/SkillGroupForm";

export default function NewSkillGroupPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold">New skill group</h1>
      <div className="mt-6">
        <SkillGroupForm />
      </div>
    </div>
  );
}

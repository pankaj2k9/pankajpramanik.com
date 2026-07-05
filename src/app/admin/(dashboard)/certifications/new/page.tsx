import CertificationForm from "@/components/admin/CertificationForm";

export default function NewCertificationPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold">New certification</h1>
      <div className="mt-6">
        <CertificationForm />
      </div>
    </div>
  );
}

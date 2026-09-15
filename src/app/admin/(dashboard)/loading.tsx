export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="py-8">
      <p className="eyebrow text-muted">Workspace</p>
      <h2 className="mt-3 text-2xl">Loading your content…</h2>
      <div aria-hidden="true" className="mt-8 grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 rounded-xl border border-border bg-surface-raised"
          />
        ))}
      </div>
    </div>
  );
}

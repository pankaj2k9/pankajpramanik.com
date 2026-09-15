"use client";
export default function AdminError({
  unstable_retry,
}: {
  unstable_retry: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl p-8" role="alert">
      <h1 className="text-2xl font-semibold">The workspace couldn’t load.</h1>
      <p className="my-5 text-muted">
        Your changes may not have been saved. Check your connection, then try
        again. If this continues, check the database connection and server logs.
      </p>
      <button className="button-primary" onClick={() => unstable_retry()}>
        Try again ↻
      </button>
      <a className="ml-5 text-link" href="/admin/login">
        Return to sign in
      </a>
    </div>
  );
}

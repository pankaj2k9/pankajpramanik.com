"use client";
export default function SiteError({
  unstable_retry,
}: {
  unstable_retry: () => void;
}) {
  return (
    <section className="container-site py-20">
      <h1 className="text-3xl">This page couldn’t load.</h1>
      <p className="mt-4 text-muted">
        Please try again. You can also contact me directly on WhatsApp.
      </p>
      <div className="mt-6 flex gap-5">
        <button className="button-primary" onClick={() => unstable_retry()}>
          Try again ↻
        </button>
        <a href="https://wa.me/8801716121009" className="text-link">
          WhatsApp ↗
        </a>
      </div>
    </section>
  );
}

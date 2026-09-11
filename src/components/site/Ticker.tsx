/**
 * Full-width marquee of short statements, separated by a diamond.
 *
 * The track is rendered twice and translated by -50%, so the loop is seamless.
 * `marquee-track` and its reduced-motion opt-out already live in globals.css.
 *
 * A server component: there is nothing interactive here, and the animation is
 * pure CSS.
 */
export default function Ticker({
  items,
  className = "",
}: {
  items: string[];
  className?: string;
}) {
  const run = (key: string) => (
    <div className="flex shrink-0 items-center" key={key} aria-hidden={key === "b"}>
      {items.map((item) => (
        <span key={item} className="flex items-center">
          <span className="px-5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            {item}
          </span>
          <span className="text-accent" aria-hidden>
            ✦
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <div
      className={`overflow-hidden border-y border-border bg-surface/40 py-3 ${className}`}
    >
      <div className="marquee-track">
        {run("a")}
        {run("b")}
      </div>
    </div>
  );
}

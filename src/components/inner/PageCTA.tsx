import Link from "next/link";

/** Closing call to action, matching the homepage's final section. */
export default function PageCTA({
  label,
  lines,
  copy,
  href = "/contact",
  cta,
}: {
  label: string;
  lines: [string, string];
  copy: string;
  href?: string;
  cta: string;
}) {
  return (
    <section id="contact" className="hm-section hm-cta" aria-labelledby="cta-heading">
      <div className="hm-cta-glow" aria-hidden />
      <div className="hm-container hm-cta-inner" data-hm-stagger>
        <p className="hm-label" data-hm="up">
          {label}
        </p>
        <h2 id="cta-heading" className="hm-title hm-cta-title">
          <span className="hm-line" data-hm="up">
            {lines[0]}
          </span>
          <span className="hm-line hm-line-soft" data-hm="up">
            {lines[1]}
          </span>
        </h2>
        <p className="hm-cta-copy" data-hm="up">
          {copy}
        </p>
        <div data-hm="up">
          <Link href={href} className="hm-button hm-button-lg" data-hm-magnetic>
            {cta} <span aria-hidden>↗</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

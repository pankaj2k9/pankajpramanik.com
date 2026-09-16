import Link from "next/link";
import { site } from "@/lib/site";
import SocialLinks from "@/components/site/SocialLinks";

const EXPLORE = [
  { href: "/services", label: "Services" },
  { href: "/portfolio", label: "Projects" },
  { href: "/experience", label: "Experience" },
  { href: "/skills", label: "Skills" },
  { href: "/blog", label: "Blog" },
];
const SITE = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/booking", label: "Book a meeting" },
  { href: "/privacy-policy", label: "Privacy Policy" },
];
const CONNECT = [
  { href: site.github, label: "GitHub" },
  { href: site.linkedin, label: "LinkedIn" },
  { href: site.youtube, label: "YouTube" },
  { href: site.facebook, label: "Facebook" },
  { href: site.leetcode, label: "LeetCode" },
  { href: site.kaggle, label: "Kaggle" },
  { href: site.huggingface, label: "Hugging Face" },
  { href: `mailto:${site.email}`, label: "Email" },
];

function Column({
  title,
  links,
  external = false,
}: {
  title: string;
  links: { href: string; label: string }[];
  external?: boolean;
}) {
  return (
    <nav className="hf-col" aria-label={title}>
      <p className="hf-heading">{title}</p>
      <ul>
        {links.map((l) => {
          const outbound = external && !l.href.startsWith("mailto:");
          const content = (
            <>
              {l.label}
              <span className="hf-arrow" aria-hidden>
                {outbound ? "↗" : "→"}
              </span>
            </>
          );
          return (
            <li key={l.label}>
              {external ? (
                <a
                  className="hf-link"
                  href={l.href}
                  target={outbound ? "_blank" : undefined}
                  rel={outbound ? "noopener noreferrer" : undefined}
                >
                  {content}
                </a>
              ) : (
                <Link className="hf-link" href={l.href}>
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Homepage footer: brand and contact, three link columns, copyright row. */
export default function HomeFooter() {
  return (
    <footer className="home-footer">
      <div className="hm-container">
        <div className="hf-grid">
          <div className="hf-brand">
            <p className="hf-logo">
              Pankaj<span>.</span>
            </p>
            <p className="hf-about">
              AI &amp; Data Engineer - building agentic systems, LLM/RAG
              applications, data platforms, analytics systems, automation,
              LLMOps and MLOps.
            </p>
            <div className="hf-contact">
              <a href={site.whatsapp} target="_blank" rel="noopener noreferrer">
                <span className="hf-heading">WhatsApp</span>
                <span>
                  {site.phone} <i aria-hidden>↗</i>
                </span>
              </a>
              <Link href="/contact">
                <span className="hf-heading">Project brief</span>
                <span>
                  Start a conversation <i aria-hidden>→</i>
                </span>
              </Link>
            </div>
            <SocialLinks className="hf-socials" />
          </div>
          <Column title="Explore" links={EXPLORE} />
          <Column title="Site" links={SITE} />
          <Column title="Connect" links={CONNECT} external />
        </div>
        <div className="hf-bottom">
          <p>© 2026 Pankaj Kumar Pramanik. All rights reserved.</p>
          <a href="#intro" className="hf-top">
            Back to top <span aria-hidden>↑</span>
          </a>
        </div>
      </div>
    </footer>
  );
}

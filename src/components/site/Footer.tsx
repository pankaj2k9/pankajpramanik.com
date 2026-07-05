import Link from "next/link";
import { site } from "@/lib/site";
import SocialLinks from "./SocialLinks";

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="container-site grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <p className="font-display text-lg font-bold">
            Pankaj<span className="text-gradient">.</span>
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
            AI &amp; Data Engineer — building agentic systems, LLM/RAG
            applications, and production data platforms.
          </p>
          <SocialLinks className="mt-5" />
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground">Explore</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link className="hover:text-foreground" href="/services">Services</Link></li>
            <li><Link className="hover:text-foreground" href="/portfolio">Portfolio</Link></li>
            <li><Link className="hover:text-foreground" href="/experience">Experience</Link></li>
            <li><Link className="hover:text-foreground" href="/skills">Skills</Link></li>
            <li><Link className="hover:text-foreground" href="/blog">Blog</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground">Site</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link className="hover:text-foreground" href="/about">About</Link></li>
            <li><Link className="hover:text-foreground" href="/contact">Contact</Link></li>
            <li><Link className="hover:text-foreground" href="/privacy-policy">Privacy Policy</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground">Connect</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>
              <a
                className="hover:text-foreground"
                href={site.github}
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
            </li>
            <li>
              <a
                className="hover:text-foreground"
                href={site.linkedin}
                target="_blank"
                rel="noopener noreferrer"
              >
                LinkedIn
              </a>
            </li>
            <li>
              <a
                className="hover:text-foreground"
                href={site.facebook}
                target="_blank"
                rel="noopener noreferrer"
              >
                Facebook
              </a>
            </li>
            <li>
              <a
                className="hover:text-foreground"
                href={site.leetcode}
                target="_blank"
                rel="noopener noreferrer"
              >
                LeetCode
              </a>
            </li>
            <li>
              <a
                className="hover:text-foreground"
                href={site.kaggle}
                target="_blank"
                rel="noopener noreferrer"
              >
                Kaggle
              </a>
            </li>
            <li>
              <a
                className="hover:text-foreground"
                href={site.huggingface}
                target="_blank"
                rel="noopener noreferrer"
              >
                Hugging Face
              </a>
            </li>
            <li>
              <a className="hover:text-foreground" href={`mailto:${site.email}`}>
                {site.email}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border py-6">
        <p className="container-site text-xs text-faint">
          © {new Date().getFullYear()} {site.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

const socials = [
  {
    label: "GitHub",
    href: site.github,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.16 1.18a11 11 0 0 1 5.75 0c2.2-1.49 3.16-1.18 3.16-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.26 5.66.41.36.78 1.06.78 2.14 0 1.55-.02 2.79-.02 3.17 0 .31.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: site.linkedin,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    href: site.facebook,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07Z" />
      </svg>
    ),
  },
  {
    label: "LeetCode",
    href: site.leetcode,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M13.48 3.65a1.37 1.37 0 0 1 1.94 0 1.4 1.4 0 0 1 0 1.96l-6.4 6.47a2.6 2.6 0 0 0 0 3.64l3.61 3.65c.5.5 1.15.76 1.85.76h.02c.7 0 1.35-.27 1.83-.76l2.35-2.36a1.37 1.37 0 0 1 1.94 0 1.4 1.4 0 0 1 0 1.96l-2.35 2.36A5.24 5.24 0 0 1 14.5 23h-.03a5.2 5.2 0 0 1-3.78-1.59L7.08 17.7a5.4 5.4 0 0 1 0-7.56l6.4-6.48Zm1.35 4.05a1.37 1.37 0 0 1 1.94 0l3.6 3.66a1.4 1.4 0 0 1 0 1.96 1.37 1.37 0 0 1-1.95 0l-3.6-3.65a1.4 1.4 0 0 1 0-1.97Zm-4.36 5.5c0-.77.61-1.39 1.37-1.39h9.79c.76 0 1.37.62 1.37 1.39 0 .76-.61 1.38-1.37 1.38h-9.79c-.76 0-1.37-.62-1.37-1.38Z" />
      </svg>
    ),
  },
  {
    label: "Kaggle",
    href: site.kaggle,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M6.5 1.5h3.1v12.06l5.94-6.06h4.06l-6.75 6.75L20 22.5h-4.06l-5.06-6.19-1.28 1.28v4.91H6.5V1.5Z" />
      </svg>
    ),
  },
  {
    label: "Hugging Face",
    href: site.huggingface,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
        <circle cx="12" cy="12" r="9.2" />
        <circle cx="8.6" cy="9.6" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="15.4" cy="9.6" r="0.9" fill="currentColor" stroke="none" />
        <path d="M7.8 13.4c1 2 2.5 3 4.2 3s3.2-1 4.2-3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Email",
    href: `mailto:${site.email}`,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-10 6L2 7" />
      </svg>
    ),
  },
];

export default function SocialLinks({
  className,
  size = "md",
}: {
  className?: string;
  size?: "md" | "lg";
}) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-2", className)}>
      {socials.map((s) => (
        <li key={s.label}>
          <a
            href={s.href}
            target={s.href.startsWith("mailto") ? undefined : "_blank"}
            rel="noopener noreferrer"
            aria-label={s.label}
            title={s.label}
            className={cn(
              "flex items-center justify-center rounded-lg border border-border text-muted transition hover:border-accent hover:text-accent",
              size === "lg" ? "h-11 w-11 [&_svg]:h-5 [&_svg]:w-5" : "h-9 w-9 [&_svg]:h-4 [&_svg]:w-4"
            )}
          >
            {s.icon}
          </a>
        </li>
      ))}
    </ul>
  );
}

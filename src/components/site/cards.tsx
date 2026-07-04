import Link from "next/link";
import Image from "next/image";
import { formatDate } from "@/lib/utils";

type PostCardPost = {
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  publishedAt: Date | null;
  categories: { name: string; slug: string }[];
};

export function PostCard({ post }: { post: PostCardPost }) {
  return (
    <article className="card card-hover group overflow-hidden">
      <Link href={`/blog/${post.slug}`} className="block">
        {post.coverImage && (
          <div className="relative aspect-[16/9] overflow-hidden border-b border-border">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </div>
        )}
        <div className="p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-faint">
            {post.categories[0] && (
              <span className="rounded-full border border-border px-2.5 py-0.5 text-accent">
                {post.categories[0].name}
              </span>
            )}
            <time dateTime={post.publishedAt?.toISOString()}>
              {formatDate(post.publishedAt)}
            </time>
          </div>
          <h3 className="mt-3 font-display text-lg font-semibold leading-snug group-hover:text-accent">
            {post.title}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
            {post.excerpt}
          </p>
        </div>
      </Link>
    </article>
  );
}

type ProjectCardProject = {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  techStack: string[];
  category: string;
  featured: boolean;
};

export function ProjectCard({ project }: { project: ProjectCardProject }) {
  return (
    <article className="card card-hover group relative overflow-hidden p-6">
      {project.featured && (
        <span className="absolute right-4 top-4 rounded-full bg-accent-strong/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
          Featured
        </span>
      )}
      <p className="text-xs font-medium uppercase tracking-wider text-faint">
        {project.category}
      </p>
      <h3 className="mt-2 font-display text-lg font-semibold leading-snug">
        <Link
          href={`/portfolio/${project.slug}`}
          className="after:absolute after:inset-0 group-hover:text-accent"
        >
          {project.title}
        </Link>
      </h3>
      <p className="mt-1 text-sm text-accent/90">{project.tagline}</p>
      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted">
        {project.description}
      </p>
      <ul className="mt-4 flex flex-wrap gap-1.5">
        {project.techStack.slice(0, 5).map((t) => (
          <li
            key={t}
            className="rounded-md border border-border bg-surface-raised px-2 py-0.5 text-[11px] text-muted"
          >
            {t}
          </li>
        ))}
      </ul>
    </article>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">
          {eyebrow}
        </p>
        <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h2>
      </div>
      {action && (
        <Link
          href={action.href}
          className="text-sm font-medium text-muted transition-colors hover:text-accent"
        >
          {action.label} →
        </Link>
      )}
    </div>
  );
}

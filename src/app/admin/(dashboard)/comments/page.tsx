import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { deleteComment, setCommentStatus } from "@/actions/comments";
import { DeleteButton } from "@/components/admin/ui";

const TABS = [
  { status: "PENDING", label: "Pending" },
  { status: "APPROVED", label: "Approved" },
  { status: "SPAM", label: "Spam" },
] as const;

export default async function AdminCommentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const requested = (await searchParams).status;
  const status = TABS.find((t) => t.status === requested)?.status ?? "PENDING";

  const [comments, counts] = await Promise.all([
    prisma.comment.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { post: { select: { title: true, slug: true } } },
    }),
    prisma.comment.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Comments</h1>
      <nav className="mt-4 flex gap-2" aria-label="Comment status">
        {TABS.map((t) => (
          <Link
            key={t.status}
            href={`/admin/comments?status=${t.status}`}
            aria-current={t.status === status ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-sm ${t.status === status ? "border-accent text-accent" : "border-border text-muted"}`}
          >
            {t.label} ({count(t.status)})
          </Link>
        ))}
      </nav>

      {comments.length === 0 ? (
        <p className="mt-6 text-muted">Nothing here.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-semibold">
                  {c.name}{" "}
                  <span className="font-normal text-faint">&lt;{c.email}&gt;</span>
                </p>
                <p className="text-xs text-faint">{formatDate(c.createdAt)}</p>
              </div>
              <p className="mt-1 text-sm">
                on{" "}
                <Link href={`/blog/${c.post.slug}#comments`} className="text-accent hover:underline">
                  {c.post.title}
                </Link>
              </p>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted">{c.body}</p>
              <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-3 text-sm">
                {c.status !== "APPROVED" && (
                  <form action={setCommentStatus.bind(null, c.id, "APPROVED")}>
                    <button className="font-medium text-accent hover:underline">Approve</button>
                  </form>
                )}
                {c.status === "APPROVED" && (
                  <form action={setCommentStatus.bind(null, c.id, "PENDING")}>
                    <button className="text-muted hover:text-accent">Unpublish</button>
                  </form>
                )}
                {c.status !== "SPAM" && (
                  <form action={setCommentStatus.bind(null, c.id, "SPAM")}>
                    <button className="text-muted hover:text-accent">Mark spam</button>
                  </form>
                )}
                <DeleteButton action={deleteComment.bind(null, c.id)} confirmText="Delete this comment permanently?" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

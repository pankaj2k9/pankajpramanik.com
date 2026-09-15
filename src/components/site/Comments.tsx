import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import CommentForm from "./CommentForm";

/**
 * Approved comments + the form. Bodies render as plain text (React escapes
 * them); no HTML or markdown from readers is ever interpreted. Emails are not
 * selected, so they cannot reach the page.
 */
export default async function Comments({ postId }: { postId: string }) {
  const comments = await prisma.comment.findMany({
    where: { postId, status: "APPROVED" },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, body: true, createdAt: true },
  });

  return (
    <section id="comments" aria-labelledby="comments-title" className="mt-14 border-t border-border pt-10">
      <h2 id="comments-title" className="font-display text-2xl font-bold">
        {comments.length ? `${comments.length} comment${comments.length === 1 ? "" : "s"}` : "Comments"}
      </h2>
      {comments.length === 0 ? (
        <p className="mt-3 text-muted">No comments yet. Start the conversation.</p>
      ) : (
        <ol className="mt-6 space-y-5">
          {comments.map((c) => (
            <li key={c.id} className="card p-5">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-strong/15 font-semibold text-accent"
                >
                  {c.name.trim().charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <time dateTime={c.createdAt.toISOString()} className="text-xs text-faint">
                    {formatDate(c.createdAt)}
                  </time>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted">
                {c.body}
              </p>
            </li>
          ))}
        </ol>
      )}
      <h3 className="mt-10 mb-4 font-display text-lg font-semibold">Leave a comment</h3>
      <CommentForm postId={postId} />
    </section>
  );
}

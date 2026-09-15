import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { deleteMessage, markMessageRead } from "@/actions/messages";
import { DeleteButton } from "@/components/admin/ui";

export default async function AdminMessagesPage() {
  await requireAdmin();
  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Contact messages</h1>

      {messages.length === 0 ? (
        <p className="mt-6 text-muted">No messages yet.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {messages.map((m) => (
            <li key={m.id} className={`card p-5 ${m.read ? "opacity-70" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {m.name}{" "}
                    <a
                      href={`mailto:${m.email}`}
                      className="font-normal text-accent hover:underline"
                    >
                      &lt;{m.email}&gt;
                    </a>
                    {!m.read && (
                      <span className="ml-2 rounded-full bg-accent-strong/20 px-2 py-0.5 text-[11px] text-accent">
                        new
                      </span>
                    )}
                  </p>
                  {m.subject && (
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {m.subject}
                    </p>
                  )}
                </div>
                <p className="text-xs text-faint">{formatDate(m.createdAt)}</p>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                {m.message}
              </p>

              <div className="mt-4 flex items-center gap-4 border-t border-border pt-3">
                <form action={markMessageRead.bind(null, m.id, !m.read)}>
                  <button className="text-sm text-muted hover:text-accent">
                    Mark as {m.read ? "unread" : "read"}
                  </button>
                </form>
                <a
                  href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject || "your message")}`}
                  className="text-sm text-muted hover:text-accent"
                >
                  Reply
                </a>
                <DeleteButton action={deleteMessage.bind(null, m.id)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

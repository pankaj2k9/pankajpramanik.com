import { ViewTransition } from "react";

/**
 * Remounts on every navigation: the old page fades up and out, the new one
 * rises in, and a thin accent line sweeps the top edge. Browsers without view
 * transitions still get the line and an instant swap.
 */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span className="page-line" aria-hidden />
      <ViewTransition enter="page-enter" exit="page-exit" default="none">
        <div>{children}</div>
      </ViewTransition>
    </>
  );
}

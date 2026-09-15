// Auth.js may supply an absolute callback URL. Only its private local path is used.
export function adminReturnPath(value: unknown): string {
  if (typeof value !== "string") return "/admin";
  try {
    const url = new URL(value, "http://localhost");
    if (
      (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) &&
      !url.pathname.startsWith("/admin/login") &&
      !url.pathname.includes("\\")
    )
      return `${url.pathname}${url.search}`;
  } catch {
    /* Invalid or missing return path defaults to the overview. */
  }
  return "/admin";
}

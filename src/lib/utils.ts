export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatMonthYear(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Serialise a value for embedding in a `<script type="application/ld+json">`.
 *
 * `JSON.stringify` does NOT escape `<`, so a database field containing
 * `</script><img src=x onerror=...>` closes the script element early and the
 * rest executes as markup. Post titles and descriptions reach these blocks
 * straight from the database and from migrated WordPress content, so that is a
 * reachable stored-XSS path, not a theoretical one.
 *
 * Escaping `<` to `<` is enough: it neutralises both `</script>` and the
 * `<!--` comment-start that HTML's legacy script parsing also honours. The
 * result stays valid JSON, and JSON-LD consumers decode the escape.
 */
export function jsonLdScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

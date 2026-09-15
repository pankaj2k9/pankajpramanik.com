/** Uploads one file to persistent storage and returns its /uploads/… URL. */
export async function uploadMedia(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/admin/uploads", { method: "POST", body });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error || `Upload failed (${res.status}).`);
  return data.url;
}

export const UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif";

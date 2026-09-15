"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

type Moderation = "PENDING" | "APPROVED" | "SPAM";
const STATUSES: Moderation[] = ["PENDING", "APPROVED", "SPAM"];

async function refresh(postId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { slug: true } });
  if (post) revalidatePath(`/blog/${post.slug}`);
  revalidatePath("/admin/comments");
  revalidatePath("/admin");
}

export async function setCommentStatus(id: string, status: Moderation) {
  await requireAdmin();
  if (!STATUSES.includes(status)) throw new Error("Invalid status");
  const comment = await prisma.comment.update({ where: { id }, data: { status }, select: { postId: true } });
  await refresh(comment.postId);
}

export async function deleteComment(id: string) {
  await requireAdmin();
  const comment = await prisma.comment.delete({ where: { id }, select: { postId: true } });
  await refresh(comment.postId);
}

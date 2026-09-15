import type {
  Category,
  Certification,
  Education,
  Experience,
  Page,
  Post,
  Project,
  SkillGroup,
  Tag,
  Testimonial,
} from "@prisma/client";
import { createHash } from "node:crypto";
import path from "node:path";

/**
 * Content snapshot shared by content-export (local DB → file) and
 * content-import (file → any DB, including production on deploy).
 *
 * Covers every table an editor authors. Users and contact messages are
 * deliberately excluded: production keeps its own admin credentials and its
 * own inbox.
 */
export const SNAPSHOT_VERSION = 1;
export const SYNC_ID = "content";

type Row<T> = Omit<T, "id" | "updatedAt">;

export type SnapshotPost = Omit<Row<Post>, "authorId"> & {
  authorEmail: string | null;
  categories: string[];
  tags: string[];
};

export type Snapshot = {
  version: number;
  categories: Omit<Category, "id">[];
  tags: Omit<Tag, "id">[];
  posts: SnapshotPost[];
  projects: Row<Project>[];
  pages: Omit<Page, "id" | "updatedAt">[];
  skillGroups: Omit<SkillGroup, "id">[];
  experiences: Row<Experience>[];
  education: Omit<Education, "id">[];
  certifications: Omit<Certification, "id">[];
  testimonials: Omit<Testimonial, "id">[];
};

export const snapshotPath = () =>
  path.resolve(
    process.env.CONTENT_SNAPSHOT ||
      path.join(process.cwd(), "prisma", "content", "snapshot.json"),
  );

export const hashSnapshot = (raw: string) =>
  createHash("sha256").update(raw).digest("hex");

/** Loads .env when present; production and CI pass variables directly. */
export function loadEnv() {
  try {
    process.loadEnvFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

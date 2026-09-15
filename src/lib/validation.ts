import { z } from "zod";
export const slugSchema = z
  .string()
  .trim()
  .max(120)
  .regex(
    /^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/,
    "Use lowercase letters, numbers, and single hyphens in the slug.",
  )
  .default("");
export const publicUrlSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "Use a full http:// or https:// URL.")
  .default("");
export const coverImageSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (!value) return true;
    if (
      /^\/(?:uploads|services-art)\/[^\\\s?#]+$/i.test(value) &&
      !value.split("/").includes("..")
    )
      return true;
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        [
          "pankajpramanik.com",
          "github.com",
          "avatars.githubusercontent.com",
          "opengraph.githubassets.com",
          "raw.githubusercontent.com",
        ].includes(url.hostname)
      );
    } catch {
      return false;
    }
  }, "Use a local /uploads/ or /services-art/ path, or an allowed HTTPS image host from next.config.ts.")
  .default("");

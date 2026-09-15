import { Prisma } from "@prisma/client";
import { unstable_rethrow } from "next/navigation";
export function formError(error: unknown) {
  unstable_rethrow(error);
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002")
      return {
        error:
          "This value is already in use. Choose a unique slug or name and try again.",
      };
    if (error.code === "P2025")
      return {
        error: "This item no longer exists. Return to the list and refresh it.",
      };
  }
  console.error("Dashboard save failed.");
  return {
    error:
      "We couldn't save your changes. Keep this form open, check the database connection, and try again.",
  };
}

"use server";

import { adminReturnPath } from "@/lib/admin-return";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";

export async function login(
  _prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: adminReturnPath(formData.get("returnTo")),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return error.type === "CredentialsSignin"
        ? "Invalid email or password."
        : "Sign-in is temporarily unavailable. Please try again.";
    }
    throw error; // NEXT_REDIRECT on success
  }
}

export async function logout() {
  await signOut({ redirectTo: "/admin/login" });
}

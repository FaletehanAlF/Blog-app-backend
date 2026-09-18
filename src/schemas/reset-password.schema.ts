import { z } from "zod";

export const resetPasswordSchema = z
  .object({
    token: z
      .string({ error: "Token wajib diisi" })
      .min(1, "Token wajib diisi"),
    new_password: z
      .string({ error: "Password baru minimal 8 karakter" })
      .min(8, "Password baru minimal 8 karakter"),
    confirm_password: z
      .string({ error: "Konfirmasi password wajib diisi" })
      .min(1, "Konfirmasi password wajib diisi"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    path: ["confirm_password"],
    message: "Konfirmasi password tidak sesuai",
  });

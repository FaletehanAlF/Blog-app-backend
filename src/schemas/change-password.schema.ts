import { z } from "zod";

export const changePasswordSchema = z
  .object({
    current_password: z
      .string({ error: "Password lama wajib diisi" })
      .min(1, "Password lama wajib diisi"),
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

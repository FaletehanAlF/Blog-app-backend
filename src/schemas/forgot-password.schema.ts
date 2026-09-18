import { z } from "zod";

export const forgotPasswordSchema = z.object({
  email: z
    .string({ error: "Email tidak valid" })
    .min(1, "Email tidak valid")
    .email("Email tidak valid"),
});

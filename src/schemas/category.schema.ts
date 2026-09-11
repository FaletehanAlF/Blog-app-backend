import { z } from "zod";

export const categorySchema = z.object({
    name: z
        .string()
        .min(3, "Nama kategori minimal 3 karakter")
        .max(100, "Nama kategori maksimal 100 karakter"),
});
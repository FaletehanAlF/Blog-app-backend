import { z } from "zod";

export const postSchema = z.object({
    title: z.string().min(3, "Judul minimal 3 karakter"),
    content: z.string().min(10, "Konten minimal 10 karakter"),
    category_id: z.number().int().positive("Category ID harus berupa angka positif")
});
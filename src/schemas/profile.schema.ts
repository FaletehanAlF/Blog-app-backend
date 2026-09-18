import { z } from "zod";

export const profileUpdateSchema = z.object({
    name: z.string().min(3, "Nama minimal 3 karakter").max(100, "Nama maksimal 100 karakter"),
});

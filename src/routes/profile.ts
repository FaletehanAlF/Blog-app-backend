import { Router } from "express";
import db from "../config/database.js";
import authMiddleware from "../middleware/authMiddleware.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { profileUpdateSchema } from "../schemas/profile.schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "..", "..", "uploads");

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        cb(null, uniqueName);
    },
});

const allowedExts = [".jpg", ".jpeg", ".png", ".webp"];
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedExts.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error("Hanya file gambar (jpg, jpeg, png, webp) yang diperbolehkan"));
        }
    },
});

const router = Router();

function parsePositiveInt(value: unknown): number | null {
    const raw = Array.isArray(value) ? value[0] : value;
    const parsed = Number.parseInt(typeof raw === "string" ? raw : "", 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
}

// GET /profile/:userId — profil publik user.
router.get("/:userId", async (req, res) => {
    try {
        const userId = parsePositiveInt(req.params.userId);

        if (userId === null) {
            return res.status(400).json({
                success: false,
                message: "ID user tidak valid",
            });
        }

        const [userRows] = await db.query(
            "SELECT id, name, profile_image, created_at, role FROM users WHERE id = ?",
            [userId],
        );

        if ((userRows as any[]).length === 0) {
            return res.status(404).json({
                success: false,
                message: "User tidak ditemukan",
            });
        }

        const user = (userRows as any[])[0];

        const [postRows] = await db.query(
            `SELECT
                posts.id,
                posts.title,
                posts.image,
                categories.name AS category,
                COALESCE(like_counts.like_count, 0) AS like_count
             FROM posts
             JOIN categories ON posts.category_id = categories.id
             LEFT JOIN (
                 SELECT post_id, COUNT(*) AS like_count FROM likes GROUP BY post_id
             ) AS like_counts ON like_counts.post_id = posts.id
             WHERE posts.user_id = ?
             ORDER BY posts.id DESC`,
            [userId],
        );

        return res.status(200).json({
            success: true,
            message: "Berhasil mengambil profil publik",
            data: {
                id: user.id,
                name: user.name,
                profile_image: user.profile_image,
                created_at: user.created_at,
                role: user.role,
                posts: (postRows as any[]).map((row: any) => ({
                    ...row,
                    like_count: Number(row.like_count ?? 0),
                    image: row.image ? `/uploads/${row.image}` : null,
                })),
            },
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Gagal mengambil profil publik",
        });
    }
});

// PUT /profile — ubah profil user sendiri.
router.put("/", authMiddleware, upload.single("profile_image"), async (req, res) => {
    try {
        const userId = Number((req as any).user.id);

        const validation = profileUpdateSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                success: false,
                message: "Data tidak valid",
                errors: validation.error.issues,
            });
        }

        const { name } = validation.data;

        let profileImage = req.file ? `/uploads/${req.file.filename}` : undefined;

        const [existingUser] = await db.query(
            "SELECT name, profile_image FROM users WHERE id = ?",
            [userId],
        );

        if ((existingUser as any[]).length === 0) {
            return res.status(404).json({
                success: false,
                message: "User tidak ditemukan",
            });
        }

        const currentUser = (existingUser as any[])[0];

        if (profileImage && currentUser.profile_image) {
            const oldImagePath = path.join(
                __dirname,
                "..",
                currentUser.profile_image.replace(/^\/uploads\//, "uploads/"),
            );
            if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath);
            }
        }

        const updateFields: string[] = [];
        const updateParams: any[] = [];

        updateFields.push("name = ?");
        updateParams.push(name);

        if (profileImage) {
            updateFields.push("profile_image = ?");
            updateParams.push(profileImage);
        }

        updateParams.push(userId);

        const [result] = await db.query(
            `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`,
            updateParams,
        );

        return res.status(200).json({
            success: true,
            message: "Profil berhasil diperbarui",
            data: result,
        });
    } catch (error: any) {
        if (error instanceof multer.MulterError) {
            if (error.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({
                    success: false,
                    message: "Ukuran file maksimal 5 MB",
                });
            }
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }

        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Gagal memperbarui profil",
        });
    }
});

export default router;

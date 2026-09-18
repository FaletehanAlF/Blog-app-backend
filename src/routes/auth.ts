import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import crypto from "crypto";
import db from "../config/database.js";
import jwt from "jsonwebtoken";
import authMiddleware from "../middleware/authMiddleware.js";
import { changePasswordSchema } from "../schemas/change-password.schema.js";
import { forgotPasswordSchema } from "../schemas/forgot-password.schema.js";
import { resetPasswordSchema } from "../schemas/reset-password.schema.js";

const router = Router();

const registerSchema = z.object({
  name: z.string().min(3, "Nama minimal 3 karakter"),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
});

router.post("/register", async (req, res) => {
  try {
    const validation = registerSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Data tidak valid",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const { name, email, password } = validation.data;

    const [existingUsers] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if ((existingUsers as any[]).length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email sudah terdaftar",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashedPassword]
    );

    return res.status(201).json({
      success: true,
      message: "Registrasi berhasil",
    });
  } catch (error) {
    console.error(error);

        return res.status(500).json({
            success: false,
            message: "Terjadi kesalahan pada server",
        });
    }
});

router.post("/login", async (req, res) => {
    try {
        const validation = z
            .object({
                email: z.string().email("Email tidak valid"),
                password: z.string().min(1, "Password wajib diisi"),
            })
            .safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                success: false,
                message: "Data tidak valid",
                errors: validation.error.issues,
            });
        }

        const { email, password } = validation.data;

        const [rows] = await db.query(
            "SELECT id, name, email, password, role FROM users WHERE email = ?",
            [email]
        );

        const users = rows as any[];

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Email atau password salah",
            });
        }

        const user = users[0];

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Email atau password salah",
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
            },
            process.env.JWT_SECRET as string,
            {
                expiresIn: "1d",
            }
        );

        return res.status(200).json({
            success: true,
            message: "Login berhasil",
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
                token,
            },
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Terjadi kesalahan pada server",
        });
    }
});

router.get("/me", authMiddleware, async (req, res) => {
    try {
        const userId = Number((req as any).user.id);

        const [rows] = await db.query(
            "SELECT id, name, email, profile_image, role FROM users WHERE id = ?",
            [userId]
        );

        const users = rows as any[];

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User tidak ditemukan",
            });
        }

        const [countRows] = await db.query(
            "SELECT COUNT(*) AS article_count FROM posts WHERE user_id = ?",
            [userId]
        );

        return res.status(200).json({
            success: true,
            message: "Berhasil mengambil profil",
            data: {
                ...users[0],
                article_count: Number((countRows as any[])[0].article_count),
            },
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Terjadi kesalahan pada server",
        });
    }
});

router.patch("/change-password", authMiddleware, async (req, res) => {
    try {
        const userId = Number((req as any).user.id);

        const validation = changePasswordSchema.safeParse(req.body);

        if (!validation.success) {
            const firstIssue = validation.error.issues[0];

            // Prioritaskan pesan yang harus sesuai spec — urutan prioritas konsisten
            const newPasswordIssue = validation.error.issues.find(
                (i) => i.path[0] === "new_password",
            );
            if (newPasswordIssue) {
                return res.status(400).json({
                    success: false,
                    message: "Password baru minimal 8 karakter",
                });
            }

            const currentPasswordIssue = validation.error.issues.find(
                (i) => i.path[0] === "current_password",
            );
            if (currentPasswordIssue) {
                return res.status(400).json({
                    success: false,
                    message: "Password lama wajib diisi",
                });
            }

            const confirmMismatchIssue = validation.error.issues.find(
                (i) =>
                    i.path[0] === "confirm_password" &&
                    i.message === "Konfirmasi password tidak sesuai",
            );
            if (confirmMismatchIssue) {
                return res.status(400).json({
                    success: false,
                    message: "Konfirmasi password tidak sesuai",
                });
            }

            const confirmRequiredIssue = validation.error.issues.find(
                (i) => i.path[0] === "confirm_password",
            );
            if (confirmRequiredIssue) {
                return res.status(400).json({
                    success: false,
                    message: "Konfirmasi password wajib diisi",
                });
            }

            return res.status(400).json({
                success: false,
                message: firstIssue?.message || "Data tidak valid",
                errors: validation.error.issues,
            });
        }

        const { current_password, new_password } = validation.data;

        // Jangan izinkan password baru sama dengan lama (plaintext check)
        if (current_password === new_password) {
            return res.status(400).json({
                success: false,
                message: "Password baru harus berbeda dari password lama",
            });
        }

        const [rows] = await db.query(
            "SELECT id, password FROM users WHERE id = ?",
            [userId],
        );

        const users = rows as any[];

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User tidak ditemukan",
            });
        }

        const user = users[0];

        const isCurrentValid = await bcrypt.compare(
            current_password,
            user.password,
        );

        if (!isCurrentValid) {
            return res.status(400).json({
                success: false,
                message: "Password lama salah",
            });
        }

        // Double-check via hash (jika plaintext sama tapi lolos, tetap tolak)
        const isSameAsOld = await bcrypt.compare(new_password, user.password);

        if (isSameAsOld) {
            return res.status(400).json({
                success: false,
                message: "Password baru harus berbeda dari password lama",
            });
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);

        await db.query("UPDATE users SET password = ? WHERE id = ?", [
            hashedPassword,
            userId,
        ]);

        return res.status(200).json({
            success: true,
            message: "Password berhasil diubah",
        });
    } catch (error) {
        console.error("PATCH /auth/change-password ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Terjadi kesalahan pada server",
        });
    }
});

router.post("/forgot-password", async (req, res) => {
    try {
        const validation = forgotPasswordSchema.safeParse(req.body);

        if (!validation.success) {
            const firstIssue = validation.error.issues[0];

            return res.status(400).json({
                success: false,
                message: firstIssue?.message || "Data tidak valid",
                errors: validation.error.issues,
            });
        }

        const { email } = validation.data;
        const normalizedEmail = email.trim();

        const genericResponse = () =>
            res.status(200).json({
                success: true,
                message: "Jika email terdaftar, instruksi reset password akan diproses",
            });

        const [rows] = await db.query("SELECT id FROM users WHERE email = ?", [
            normalizedEmail,
        ]);

        const users = rows as any[];

        if (users.length === 0) {
            return genericResponse();
        }

        const userId = users[0].id;

        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto
            .createHash("sha256")
            .update(rawToken)
            .digest("hex");
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await db.query(
            "UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL AND expires_at > NOW()",
            [userId],
        );

        await db.query(
            "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
            [userId, tokenHash, expiresAt],
        );

        if (process.env.NODE_ENV !== "production") {
            const baseUrl =
                process.env.PASSWORD_RESET_URL ||
                "http://localhost:3000/reset-password";
            const resetLink = `${baseUrl}?token=${rawToken}`;

            console.log(
                "[DEVELOPMENT ONLY] Password reset link for",
                normalizedEmail,
                ":",
                resetLink,
            );
            console.log(
                "[DEVELOPMENT ONLY] Token expires at:",
                expiresAt.toISOString(),
            );
        }

        return genericResponse();
    } catch (error) {
        console.error("POST /auth/forgot-password ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Terjadi kesalahan pada server",
        });
    }
});

router.post("/reset-password", async (req, res) => {
    try {
        const validation = resetPasswordSchema.safeParse(req.body);

        if (!validation.success) {
            const newPasswordIssue = validation.error.issues.find(
                (i) => i.path[0] === "new_password",
            );
            if (newPasswordIssue) {
                return res.status(400).json({
                    success: false,
                    message: "Password baru minimal 8 karakter",
                });
            }

            const confirmMismatchIssue = validation.error.issues.find(
                (i) =>
                    i.path[0] === "confirm_password" &&
                    i.message === "Konfirmasi password tidak sesuai",
            );
            if (confirmMismatchIssue) {
                return res.status(400).json({
                    success: false,
                    message: "Konfirmasi password tidak sesuai",
                });
            }

            const confirmRequiredIssue = validation.error.issues.find(
                (i) => i.path[0] === "confirm_password",
            );
            if (confirmRequiredIssue) {
                return res.status(400).json({
                    success: false,
                    message: "Konfirmasi password wajib diisi",
                });
            }

            const tokenIssue = validation.error.issues.find(
                (i) => i.path[0] === "token",
            );
            if (tokenIssue) {
                return res.status(400).json({
                    success: false,
                    message: tokenIssue.message || "Token wajib diisi",
                });
            }

            const firstIssue = validation.error.issues[0];

            return res.status(400).json({
                success: false,
                message: firstIssue?.message || "Data tidak valid",
                errors: validation.error.issues,
            });
        }

        const { token, new_password } = validation.data;

        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const [rows] = await db.query(
            "SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ? LIMIT 1",
            [tokenHash],
        );

        const tokens = rows as any[];

        const genericTokenError = () =>
            res.status(400).json({
                success: false,
                message: "Token reset password tidak valid atau sudah kedaluwarsa",
            });

        if (tokens.length === 0) {
            return genericTokenError();
        }

        const tokenRow = tokens[0];

        if (tokenRow.used_at !== null) {
            return genericTokenError();
        }

        const expiresAt = new Date(tokenRow.expires_at);

        if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
            return genericTokenError();
        }

        const [userRows] = await db.query("SELECT id FROM users WHERE id = ?", [
            tokenRow.user_id,
        ]);

        if ((userRows as any[]).length === 0) {
            return genericTokenError();
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);

        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            await connection.query("UPDATE users SET password = ? WHERE id = ?", [
                hashedPassword,
                tokenRow.user_id,
            ]);

            await connection.query(
                "UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?",
                [tokenRow.id],
            );

            await connection.commit();
        } catch (txError) {
            try {
                await connection.rollback();
            } catch (_rollbackError) {
                console.error("Rollback failed:", _rollbackError);
            }

            throw txError;
        } finally {
            connection.release();
        }

        return res.status(200).json({
            success: true,
            message: "Password berhasil direset",
        });
    } catch (error) {
        console.error("POST /auth/reset-password ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Terjadi kesalahan pada server",
        });
    }
});

export default router;
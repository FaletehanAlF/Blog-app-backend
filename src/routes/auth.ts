import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import db from "../config/database.js";
import jwt from "jsonwebtoken";

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

export default router;
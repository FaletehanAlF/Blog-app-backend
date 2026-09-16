import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const authMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Token tidak ditemukan",
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET as string
        );

        (req as any).user = decoded;

        next();
    } catch (error) {
        console.error("JWT ERROR:", error);

        return res.status(401).json({
            success: false,
            message: "Token tidak valid atau sudah expired",
        });
    }
};

export default authMiddleware;
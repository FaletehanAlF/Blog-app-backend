import type { Request, Response, NextFunction } from "express";

const roleMiddleware = (...allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User belum terautentikasi",
            });
        }

        if (!allowedRoles.includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: "Anda tidak memiliki akses",
            });
        }

        next();
    };
};

export default roleMiddleware;
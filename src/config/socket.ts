import { Server } from "socket.io";
import http from "http";
import jwt from "jsonwebtoken";
import { Server as HTTPServer } from "http";

const jwtSecret = process.env.JWT_SECRET as string;

let io: Server;

const socketUsers = new Map<number, string>();

export function initSocket(server: HTTPServer): Server {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.use((socket, next) => {
    const authHeader = socket.handshake.auth.token ||
      (socket.handshake.headers.authorization as string);

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(new Error("Token tidak ditemukan"));
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, jwtSecret);
      (socket as any).userId = (decoded as any).id;
      next();
    } catch (error) {
      return next(new Error("Token tidak valid atau sudah expired"));
    }
  });

  io.on("connection", (socket) => {
    const userId = (socket as any).userId as number;
    if (userId) {
      socketUsers.set(Number(userId), socket.id);
      console.log(`User ${userId} connected via Socket.IO`);
    }

    socket.on("disconnect", () => {
      for (const [uid, sid] of socketUsers.entries()) {
        if (sid === socket.id) {
          socketUsers.delete(uid);
          console.log(`User ${uid} disconnected from Socket.IO`);
          break;
        }
      }
    });
  });

  return io;
}

export function getIo(): Server {
  if (!io) {
    throw new Error("Socket.IO belum diinisialisasi. Panggil initSocket() terlebih dahulu.");
  }
  return io;
}

export function emitNotificationToUser(userId: number, notification: any): void {
  const socketId = socketUsers.get(userId);
  if (socketId && io) {
    io.to(socketId).emit("notification:new", notification);
  }
}

export function getSocketUsers(): Map<number, string> {
  return socketUsers;
}

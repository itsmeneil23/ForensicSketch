
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { spawn } from "child_process";

const upload = multer({ dest: "uploads/" });

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Upload sketch image
  app.post("/api/upload", upload.single("file"), (req, res) => {
    res.json({
      path: req.file?.path
    });
  });

  // Run face recognition
  app.post("/api/identify", async (req, res) => {

    const imagePath = req.body.path;

    const py = spawn("python", [
      "server/recognition.py",
      imagePath
    ]);

    let data = "";

    py.stdout.on("data", (chunk) => {
      data += chunk;
    });

    py.stderr.on("data", (err) => {
      console.error("Python Error:", err.toString());
    });

    py.on("close", () => {
      try {
        res.json(JSON.parse(data));
      } catch {
        res.json([]);
      }
    });

  });

  return httpServer;
}
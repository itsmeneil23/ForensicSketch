
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";

const upload = multer({ dest: "uploads/" });
const localPythonBin = resolve(process.cwd(), ".venv/bin/python");
const pythonBin = process.env.PYTHON_BIN || (existsSync(localPythonBin) ? localPythonBin : "python");

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Upload sketch image
  app.post("/api/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        error: "No file uploaded"
      });
    }

    res.json({
      path: req.file?.path
    });
  });

  // Run face recognition
  app.post("/api/identify", async (req, res) => {

    const imagePath = req.body.path;

    if (!imagePath) {
      return res.status(400).json({
        error: "Missing image path"
      });
    }

    const py = spawn(pythonBin, [
      "server/recognition.py",
      imagePath
    ]);

    let data = "";
    let pythonError = "";

    py.stdout.on("data", (chunk) => {
      data += chunk;
    });

    py.stderr.on("data", (err) => {
      const message = err.toString();
      pythonError += message;
      console.error("Python Error:", message);
    });

    py.on("error", (err) => {
      console.error("Failed to start Python process:", err.message);
      if (!res.headersSent) {
        res.status(500).json({
          error: "Failed to start recognition process"
        });
      }
    });

    py.on("close", (code) => {
      if (res.headersSent) {
        return;
      }

      if (code !== 0) {
        return res.status(500).json({
          error: "Face recognition process failed",
          details: pythonError.trim() || "Unknown Python error"
        });
      }

      try {
        res.json(JSON.parse(data));
      } catch {
        res.status(500).json({
          error: "Invalid response from recognition process"
        });
      }
    });

  });

  return httpServer;
}
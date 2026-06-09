import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import { aiRouter } from "./routes/ai.js";
import { pipelineRouter } from "./routes/pipeline.js";
import { errorHandler } from "./middleware/errorHandler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "16mb" }));

  // 前端 API 限流
  app.use("/api/ai", rateLimit({ windowMs: 60_000, max: 10, message: { error: "请求过于频繁" } }));
  app.use("/api/pipeline", rateLimit({ windowMs: 60_000, max: 60, message: { error: "流水线请求过于频繁" } }));

  app.get("/api/health", (_req, res) => res.json({ status: "ok", timestamp: Date.now() }));
  app.use("/api/ai", aiRouter);
  app.use("/api/pipeline", pipelineRouter);

  // 静态文件
  app.use("/data", express.static("output"));

  // PWA 生产文件
  const distPath = path.resolve(__dirname, "../../client/dist");
  app.use(express.static(distPath));

  // SPA fallback — 非 API 请求返回 index.html
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  app.use(errorHandler);
  return app;
}

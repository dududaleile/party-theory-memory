import type { Request, Response, NextFunction } from "express";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error(`[${new Date().toISOString()}] Error:`, err.message);

  res.status(500).json({
    error: "服务器内部错误",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
}

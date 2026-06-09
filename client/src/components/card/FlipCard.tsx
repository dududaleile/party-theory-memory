/**
 * FlipCard — 3D 翻转卡片容器
 *
 * 使用 CSS 3D transform 实现卡片翻转。
 * 正面 = 问题面，背面 = 答案面。
 * 翻转后背面可见，正面隐藏。
 */

import { type ReactNode } from "react";

interface FlipCardProps {
  front: ReactNode;
  back: ReactNode;
  isFlipped: boolean;
}

export function FlipCard({ front, back, isFlipped }: FlipCardProps) {
  return (
    <div
      className="w-full"
      style={{ perspective: "1200px" }}
    >
      <div
        className="relative w-full"
        style={{
          transformStyle: "preserve-3d",
          transition: "transform 0.4s ease",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* 正面 */}
        <div
          className="bg-white rounded-card shadow-card px-5 py-5"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            minHeight: "320px",
          }}
        >
          {front}
        </div>

        {/* 背面 — 绝对定位在正面之上，预先 rotateY(180deg) */}
        <div
          className="absolute inset-0 bg-white rounded-card shadow-card px-5 py-5"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            minHeight: "320px",
          }}
        >
          {back}
        </div>
      </div>
    </div>
  );
}

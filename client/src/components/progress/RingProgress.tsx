interface RingProgressProps {
  percentage: number;    // 0-100
  size?: number;         // 默认 28pt
  strokeWidth?: number;  // 默认 3pt
}

/**
 * 环形进度图 — 用于领域掌握度展示
 *
 * 颜色规则：
 *   0-40%   = 红色（需要努力）
 *   40-70%  = 橙色（稳步推进）
 *   70-90%  = 蓝色（接近掌握）
 *   90%+    = 绿色（已掌握）
 */
export function RingProgress({
  percentage,
  size = 28,
  strokeWidth = 3,
}: RingProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fillLength = (percentage / 100) * circumference;
  const emptyLength = circumference - fillLength;

  const color =
    percentage >= 90
      ? "#34C759"
      : percentage >= 70
        ? "#0071E3"
        : percentage >= 40
          ? "#FF9500"
          : "#FF3B30";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* 背景圆环 */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#E5E5EA"
        strokeWidth={strokeWidth}
      />
      {/* 进度圆环 */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${fillLength} ${emptyLength}`}
        strokeDashoffset={-circumference / 4}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
      {/* 中心百分比文字（仅在 size >= 40 时显示） */}
      {size >= 40 && (
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="text-label"
          fill="#1D1D1F"
          fontSize={size * 0.28}
        >
          {percentage}%
        </text>
      )}
    </svg>
  );
}

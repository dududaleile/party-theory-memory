/**
 * 4 级自评按钮组
 *
 * 按钮语义：
 *   完全忘记 = 红  (quality 0)
 *   模糊     = 橙  (quality 2)
 *   基本记住 = 蓝  (quality 4)
 *   完全掌握 = 绿  (quality 5)
 */

interface RatingButtonsProps {
  onRate: (rating: number) => void;
  disabled?: boolean;
}

const RATINGS = [
  { value: 1, label: "完全忘记", icon: "❌", color: "bg-red-50 text-semantic-danger border-red-200 hover:bg-red-100" },
  { value: 2, label: "模糊",     icon: "🤔", color: "bg-orange-50 text-semantic-warning border-orange-200 hover:bg-orange-100" },
  { value: 3, label: "基本记住", icon: "✓",  color: "bg-blue-50 text-brand-blue border-blue-200 hover:bg-blue-100" },
  { value: 4, label: "完全掌握", icon: "🌟", color: "bg-green-50 text-semantic-success border-green-200 hover:bg-green-100" },
];

export function RatingButtons({ onRate, disabled = false }: RatingButtonsProps) {
  return (
    <div className="mt-3">
      <p className="text-caption text-text-secondary text-center mb-2 select-none">
        你的记忆程度？
      </p>
      <div className="grid grid-cols-4 gap-2">
        {RATINGS.map((r) => (
          <button
            key={r.value}
            onClick={() => onRate(r.value)}
            disabled={disabled}
            className={`
              flex flex-col items-center justify-center gap-1
              py-2.5 px-1 rounded-button border
              text-label transition-all duration-150
              ${r.color}
              disabled:opacity-40 disabled:cursor-not-allowed
              tap-active
            `}
          >
            <span className="text-base">{r.icon}</span>
            <span>{r.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

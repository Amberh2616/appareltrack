"use client";

interface ReadinessBarProps {
  value: number; // 0-100
}

export function ReadinessBar({ value }: ReadinessBarProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));

  const barColor =
    clamped >= 80
      ? "bg-green-500"
      : clamped >= 50
      ? "bg-amber-500"
      : "bg-red-500";

  const textColor =
    clamped >= 80
      ? "text-green-700"
      : clamped >= 50
      ? "text-amber-700"
      : "text-red-700";

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className={`text-sm font-semibold tabular-nums ${textColor}`}>
        {clamped}%
      </span>
    </div>
  );
}

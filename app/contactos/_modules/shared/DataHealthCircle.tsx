// ============================================================================
// DataHealthCircle.tsx — Indicador circular de completitud de la ficha
//
// Renders a small SVG ring filled proportionally to the health score (0–100).
// Purely presentational — accepts a pre-computed score.
// Usable in RSC and Client components alike.
// ============================================================================

import { dataHealthColor } from "@/lib/utils/dataHealth";

interface DataHealthCircleProps {
  score: number;        // 0–100
  size?: number;        // px (default 40)
  strokeWidth?: number; // px (default 4)
  showLabel?: boolean;  // show numeric % inside (default true)
  className?: string;
}

export function DataHealthCircle({
  score,
  size = 40,
  strokeWidth = 4,
  showLabel = true,
  className,
}: DataHealthCircleProps) {
  const radius  = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled  = (score / 100) * circumference;
  const color   = dataHealthColor(score);
  const center  = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-label={`Completitud de ficha: ${score}%`}
      role="img"
    >
      {/* Track */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-zinc-700"
        opacity={0.3}
      />
      {/* Progress arc — starts at 12 o'clock (rotate -90°) */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        transform={`rotate(-90 ${center} ${center})`}
      />
      {/* Label */}
      {showLabel && (
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size * 0.28}
          fontWeight="600"
          fill={color}
        >
          {score}
        </text>
      )}
    </svg>
  );
}

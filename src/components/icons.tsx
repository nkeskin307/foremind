import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const baseProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function HomeIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3.5v-5a1.5 1.5 0 0 1 1.5-1.5v0a1.5 1.5 0 0 1 1.5 1.5v5H17a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function RoundIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M7 3v18" />
      <path d="M7 4h9l-2.5 3L16 10H7" />
      <path d="M4.5 21h5" />
    </svg>
  );
}

export function CoachIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M4 5.5h16v10H9.5L5 19v-3.5H4z" />
      <path d="M8 9.5h8" />
      <path d="M8 12h5" />
    </svg>
  );
}

export function InsightsIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="m6.5 15 3.5-4 3 2.5 4.5-6" />
    </svg>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="9" y="3.5" width="6" height="10" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0" />
      <path d="M12 17v3.5" />
      <path d="M9 20.5h6" />
    </svg>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" {...props}>
      <path d="M12 3c.45 3.1 2.6 5.25 5.6 5.6-3 .35-5.15 2.5-5.6 5.6-.45-3.1-2.6-5.25-5.6-5.6C9.4 8.25 11.55 6.1 12 3Z" />
      <path d="M18.7 15.4c.22 1.15.98 1.9 2.1 2.1-1.12.22-1.88.97-2.1 2.1-.22-1.13-.98-1.88-2.1-2.1 1.12-.2 1.88-.95 2.1-2.1Z" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

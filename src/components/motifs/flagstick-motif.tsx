export function FlagstickMotif({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 400"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="60" y1="16" x2="60" y2="378" />
      <path d="M60 20 L154 58 L60 96 Z" />
      <ellipse cx="60" cy="384" rx="46" ry="7" />
    </svg>
  );
}

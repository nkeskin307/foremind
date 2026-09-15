export function ScorecardIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9.5h18" />
      <path d="M7.5 13.5h3" />
      <path d="M7.5 17h3" />
      <path d="M14.5 13.5h2" />
      <path d="M14.5 17h2" />
    </svg>
  );
}

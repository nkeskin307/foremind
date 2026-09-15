export function HistoryIcon({ className }: { className?: string }) {
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
      <path d="M3.5 12a8.5 8.5 0 1 0 2.8-6.3" />
      <path d="M3 4.5v4.5h4.5" />
      <path d="M12 8v4.5l3 2" />
    </svg>
  );
}

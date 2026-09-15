export function RotateIcon({ className }: { className?: string }) {
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
      <path d="M20.5 11A8.5 8.5 0 1 0 18.5 16.5" />
      <path d="M20.5 5v6h-6" />
    </svg>
  );
}

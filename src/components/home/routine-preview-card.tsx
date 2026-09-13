import type { MentalCheckIn } from "@/types/check-in";

interface RoutinePreviewCardProps {
  checkIn: MentalCheckIn;
}

const SUMMARY_ITEMS: Array<{ key: keyof Omit<MentalCheckIn, "note">; label: string }> = [
  { key: "confidence", label: "Confidence" },
  { key: "focus", label: "Focus" },
  { key: "energy", label: "Energy" },
  { key: "nerves", label: "Nerves" },
];

export function RoutinePreviewCard({ checkIn }: RoutinePreviewCardProps) {
  return (
    <div className="mt-6 rounded-2xl border border-sage-soft bg-sage-soft/40 p-5 sm:p-6">
      <div className="flex flex-wrap gap-2">
        {SUMMARY_ITEMS.map(({ key, label }) => (
          <span
            key={key}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-medium text-charcoal-muted"
          >
            {label}
            <span className="font-semibold text-forest">{checkIn[key]}</span>
          </span>
        ))}
      </div>

      <p className="mt-4 text-base font-medium text-charcoal">
        Your routine will be personalized here.
      </p>
      <p className="mt-1 text-sm text-charcoal-muted">
        {"Later, ForeCalm's AI coach will use your check-in and previous rounds to build your routine."}
      </p>
    </div>
  );
}

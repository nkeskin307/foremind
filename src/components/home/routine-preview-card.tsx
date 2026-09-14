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
    <div className="mt-2 rounded-2xl bg-sage-soft p-4 sm:p-5">
      <div className="flex flex-wrap gap-2">
        {SUMMARY_ITEMS.map(({ key, label }) => (
          <span
            key={key}
            className="inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1 text-xs font-medium text-muted"
          >
            {label}
            <span className="font-semibold text-sage">{checkIn[key]}</span>
          </span>
        ))}
      </div>

      <p className="mt-3 text-sm font-medium text-foreground">
        Your routine will be personalized here.
      </p>
      <p className="mt-1 text-xs text-muted">
        {"Later, ForeCalm's AI coach will use your check-in and previous rounds to build your routine."}
      </p>
    </div>
  );
}

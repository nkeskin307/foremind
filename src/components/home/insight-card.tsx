import { SparkIcon } from "@/components/icons";

// SAMPLE DATA — placeholder insight until real round history and analysis exist.
const SAMPLE_INSIGHT =
  "Your best rounds happen when your pre-round confidence is 7 or higher.";

export function InsightCard() {
  return (
    <div className="rounded-2xl bg-sage-soft p-5">
      <div className="flex items-center gap-1.5">
        <SparkIcon className="h-3.5 w-3.5 text-sage" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-sage">
          Latest insight
        </span>
      </div>
      <p className="mt-2 text-sm text-foreground">{SAMPLE_INSIGHT}</p>
    </div>
  );
}

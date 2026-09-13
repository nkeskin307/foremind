// SAMPLE DATA — placeholder insight until real round history and analysis exist.
const SAMPLE_INSIGHT =
  "Your best rounds happen when your pre-round confidence is 7 or higher.";

export function InsightCard() {
  return (
    <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-semibold text-charcoal">Your latest insight</h2>
      <p className="mt-3 text-base text-charcoal-muted">{SAMPLE_INSIGHT}</p>
    </div>
  );
}

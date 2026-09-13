import { CheckInCard } from "@/components/home/check-in-card";
import { InsightCard } from "@/components/home/insight-card";
import { PlayingNowSection } from "@/components/home/playing-now-section";

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14 lg:max-w-3xl lg:px-8">
      <header className="mb-10 sm:mb-14">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-sage">ForeCalm</p>
        <p className="mt-2 text-lg italic text-charcoal-muted sm:text-xl">
          Your game starts before you swing.
        </p>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-charcoal sm:text-4xl">
          Good afternoon.
        </h1>
      </header>

      <div className="flex flex-col gap-10 sm:gap-12">
        <CheckInCard />
        <PlayingNowSection />
        <InsightCard />
      </div>
    </div>
  );
}

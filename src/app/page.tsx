import { CheckInCard } from "@/components/home/check-in-card";
import { InsightCard } from "@/components/home/insight-card";
import { PlayingNowSection } from "@/components/home/playing-now-section";

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10 lg:max-w-3xl lg:px-8">
      <header className="relative mb-8 md:pr-48">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Good afternoon.
        </h1>
        <p className="mt-1.5 text-sm text-muted">Your game starts before you swing.</p>

        <div className="hidden md:absolute md:right-0 md:top-0 md:block md:w-40">
          <PlayingNowSection />
        </div>
      </header>

      <InsightCard />

      <div className="mt-8">
        <CheckInCard />
      </div>

      <div className="mt-8 md:hidden">
        <PlayingNowSection />
      </div>
    </div>
  );
}

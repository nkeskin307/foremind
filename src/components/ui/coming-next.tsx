interface ComingNextProps {
  title: string;
  description: string;
}

export function ComingNext({ title, description }: ComingNextProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-20 text-center sm:px-6 lg:px-8">
      <span className="rounded-full bg-sage-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-forest">
        Coming next
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-charcoal sm:text-3xl">
        {title}
      </h1>
      <p className="mt-3 max-w-md text-base text-charcoal-muted">{description}</p>
    </div>
  );
}

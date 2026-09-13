interface MentalSliderProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export function MentalSlider({
  id,
  label,
  value,
  onChange,
  min = 1,
  max = 10,
}: MentalSliderProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-charcoal">
          {label}
        </label>
        <span className="min-w-8 rounded-full bg-sage-soft px-2.5 py-0.5 text-center text-sm font-semibold tabular-nums text-forest">
          {value}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-valuetext={`${value} out of ${max}`}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-sage-soft accent-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      />
    </div>
  );
}

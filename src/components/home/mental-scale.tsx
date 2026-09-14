"use client";

import type { KeyboardEvent } from "react";

interface MentalScaleProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export function MentalScale({ label, value, onChange, min = 1, max = 5 }: MentalScaleProps) {
  const options = Array.from({ length: max - min + 1 }, (_, index) => min + index);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onChange(options[Math.min(index + 1, options.length - 1)]);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onChange(options[Math.max(index - 1, 0)]);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <span className="w-[4.5rem] shrink-0 text-sm font-medium text-foreground">{label}</span>
      <div className="flex flex-1 justify-center">
        <div role="radiogroup" aria-label={`${label} rating`} className="flex gap-1">
          {options.map((option, index) => {
            const isSelected = option === value;

            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => onChange(option)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-light focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  isSelected
                    ? "bg-forest text-foreground"
                    : "bg-surface text-muted hover:bg-border hover:text-foreground"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
      <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums text-sage">
        {value}
      </span>
    </div>
  );
}

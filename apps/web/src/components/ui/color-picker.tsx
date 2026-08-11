'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORY_COLORS = [
  { name: 'Black', value: '#000000' },
  { name: 'Charcoal', value: '#2f4550' },
  { name: 'Blue Slate', value: '#2b3942' },
  { name: 'Slate', value: '#586f7c' },
  { name: 'Steel Blue', value: '#6f8a98' },
  { name: 'Light Blue', value: '#b8dbd9' },
  { name: 'Silver', value: '#dfe7ea' },
  { name: 'Ghost', value: '#f4f4f9' },
] as const;

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {CATEGORY_COLORS.map((color) => {
        const selected = value === color.value;
        return (
          <button
            key={color.value}
            type="button"
            title={color.name}
            aria-label={color.name}
            onClick={() => onChange(color.value)}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full border border-border transition-transform hover:scale-110',
              selected && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
            )}
            style={{ backgroundColor: color.value }}
          >
            {selected && (
              <Check
                className={cn(
                  'h-4 w-4',
                  ['#b8dbd9', '#dfe7ea', '#f4f4f9'].includes(color.value)
                    ? 'text-charcoal_blue'
                    : 'text-white',
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="Toggle theme"
      className="relative inline-flex h-8 w-14 items-center rounded-full bg-muted p-1 transition-colors"
    >
      <Sun className="absolute left-2 h-3.5 w-3.5 text-amber-500" />
      <Moon className="absolute right-2 h-3.5 w-3.5 text-indigo-400" />
      <span
        className={cn(
          'z-10 flex h-6 w-6 items-center justify-center rounded-full bg-background shadow transition-transform duration-200',
          isDark ? 'translate-x-6' : 'translate-x-0',
        )}
      >
        {isDark ? <Moon className="h-3.5 w-3.5 text-indigo-500" /> : <Sun className="h-3.5 w-3.5 text-amber-500" />}
      </span>
    </button>
  );
}

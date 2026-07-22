'use client';

import { LucideIcon } from 'lucide-react';

export interface StatCard {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  sub?: string;
  trend?: number;
  accent?: 'primary' | 'secondary' | 'success' | 'warning' | 'destructive';
  onClick?: () => void;
}

interface StatCardsProps {
  cards: StatCard[];
}

const accentMap = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  success: 'text-green-600',
  warning: 'text-yellow-600',
  destructive: 'text-red-600',
};

export function StatCards({ cards }: StatCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const color = accentMap[card.accent || 'primary'];
        const clickable = !!card.onClick;
        const Wrapper = clickable ? 'button' : 'div';
        return (
          <Wrapper
            key={card.label}
            onClick={card.onClick}
            className={`nm-raised p-4 sm:p-5 text-left w-full ${clickable ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
          >
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="stat-label">{card.label}</span>
              {Icon && (
                <div className="icon-box">
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
              )}
            </div>
            <div className="flex items-end gap-3">
              <span className="stat-value">{card.value}</span>
              {card.trend !== undefined && (
                <span className={`text-xs font-semibold ${card.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {card.trend >= 0 ? '+' : ''}{card.trend}%
                </span>
              )}
            </div>
            {card.sub && <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>}
          </Wrapper>
        );
      })}
    </div>
  );
}

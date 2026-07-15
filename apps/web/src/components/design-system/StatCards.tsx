'use client';

import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface StatCard {
  label: string;
  value: string | number;
  icon?: ReactNode;
}

interface StatCardsProps {
  cards: StatCard[];
}

export function StatCards({ cards }: StatCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-2xl font-semibold">{card.value}</p>
              </div>
              {card.icon && <div className="text-muted-foreground">{card.icon}</div>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

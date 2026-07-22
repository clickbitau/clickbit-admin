'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface PersonAvatarProps {
  name?: string | null;
  avatar_url?: string | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-sm',
  lg: 'h-12 w-12 text-base',
};

export function PersonAvatar({ name, avatar_url, className, size = 'md' }: PersonAvatarProps) {
  const initials = name
    ? name
        .split(' ')
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  return (
    <Avatar className={cn('shrink-0', sizeClasses[size], className)}>
      {avatar_url && <AvatarImage src={avatar_url} alt={name || ''} />}
      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

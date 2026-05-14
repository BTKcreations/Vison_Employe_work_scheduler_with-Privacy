'use client';

import { LucideIcon, Ghost } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  variant?: 'small' | 'large';
}

export default function EmptyState({ 
  icon: Icon = Ghost, 
  title, 
  description, 
  className,
  variant = 'large'
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center animate-in fade-in duration-500",
      variant === 'large' ? "py-16 px-4" : "py-8 px-2",
      className
    )}>
      <div className={cn(
        "rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 shadow-sm mb-4",
        variant === 'large' ? "w-16 h-16" : "w-12 h-12"
      )}>
        <Icon className={cn(
          "text-slate-300",
          variant === 'large' ? "w-8 h-8" : "w-6 h-6"
        )} />
      </div>
      <h3 className={cn(
        "font-bold text-slate-800",
        variant === 'large' ? "text-lg" : "text-sm"
      )}>
        {title}
      </h3>
      {description && (
        <p className={cn(
          "text-slate-400 mt-1 max-w-[200px]",
          variant === 'large' ? "text-sm" : "text-xs"
        )}>
          {description}
        </p>
      )}
    </div>
  );
}

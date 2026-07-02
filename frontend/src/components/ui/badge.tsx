import { cn } from '@/lib/utils';

export function Badge({
  className,
  children,
  variant = 'default',
}: {
  className?: string;
  children: React.ReactNode;
  variant?: 'default' | 'mint' | 'outline';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variant === 'default' && 'bg-zinc-100 text-zinc-700',
        variant === 'mint' && 'bg-mantle-mint/15 text-emerald-800 border border-mantle-mint/30',
        variant === 'outline' && 'border border-zinc-200 text-zinc-600',
        className,
      )}
    >
      {children}
    </span>
  );
}

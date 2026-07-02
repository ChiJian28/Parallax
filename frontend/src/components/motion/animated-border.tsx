'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function AnimatedBorderCard({
  children,
  className,
  pulse = false,
}: {
  children: React.ReactNode;
  className?: string;
  pulse?: boolean;
}) {
  return (
    <div className={cn('relative rounded-xl p-[1px]', pulse && 'animate-pulse-mint', className)}>
      <div
        className="absolute inset-0 rounded-xl opacity-80"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(0,229,168,0.5), transparent, rgba(0,229,168,0.3), transparent)',
          backgroundSize: '200% 100%',
          animation: pulse ? 'shimmer 3s linear infinite' : undefined,
        }}
      />
      <div className="relative rounded-[11px] bg-white">{children}</div>
    </div>
  );
}

export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

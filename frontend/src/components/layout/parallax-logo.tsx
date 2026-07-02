import Image from 'next/image';
import { cn } from '@/lib/utils';

interface ParallaxLogoProps {
  size?: number;
  showWordmark?: boolean;
  showTagline?: boolean;
  className?: string;
}

export function ParallaxLogo({
  size = 24,
  showWordmark = true,
  showTagline = false,
  className,
}: ParallaxLogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Image
        src="/favicon.ico"
        alt="Parallax"
        width={size}
        height={size}
        className="shrink-0 rounded-md object-contain"
        priority
        unoptimized
      />
      {showWordmark ? (
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-bold tracking-tight">Parallax</span>
        </div>
      ) : null}
    </div>
  );
}

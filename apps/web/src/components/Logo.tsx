import Image from 'next/image';

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
}

export function Logo({ width = 36, height = 36, className }: LogoProps) {
  return (
    <div className={`relative ${className || ''}`} style={{ width, height }}>
      <Image
        src="/logo.svg"
        alt="ClickBit"
        width={width}
        height={height}
        className="object-contain dark:hidden"
        priority
      />
      <Image
        src="/logo-dark.svg"
        alt="ClickBit"
        width={width}
        height={height}
        className="object-contain hidden dark:block"
        priority
      />
    </div>
  );
}

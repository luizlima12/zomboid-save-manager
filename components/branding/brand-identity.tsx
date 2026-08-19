import Image from "next/image";

import { cn } from "@/lib/utils";

export function BrandIcon({
  className,
  size = 42,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden border border-border bg-black",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="/images/project-zomboid-icon.png"
        alt="Project Zomboid"
        fill
        sizes={`${size}px`}
        className="object-cover"
      />
    </span>
  );
}

export function BrandIdentity() {
  return (
    <div className="flex items-center gap-3">
      <BrandIcon />
      <div>
        <div className="text-[12px] tracking-[0.14em]">ZOMBOID</div>
        <div className="text-[10px] tracking-[0.18em] text-muted-foreground">
          SAVE MANAGER
        </div>
      </div>
    </div>
  );
}

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-10 items-center justify-center gap-2 border px-4 text-[12px] uppercase tracking-[0.12em] transition-colors outline-none disabled:pointer-events-none disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default:
          "border-primary bg-primary text-primary-foreground hover:bg-primary/85",
        outline:
          "border-border bg-transparent text-foreground hover:border-muted-foreground hover:bg-surface-raised",
        ghost:
          "border-transparent bg-transparent text-muted-foreground hover:bg-surface-raised hover:text-foreground",
        danger:
          "border-danger/60 bg-danger/10 text-danger hover:bg-danger/20",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-[11px]",
        lg: "h-12 px-5 text-[13px]",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { buttonVariants };

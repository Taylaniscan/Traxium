"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md border border-transparent text-sm font-semibold tracking-[0.01em] transition-[background-color,border-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:bg-[var(--muted)] disabled:text-[var(--muted-foreground)] disabled:shadow-none",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_1px_2px_rgba(15,23,42,0.08)] hover:bg-[var(--primary-action-hover)]",
        secondary:
          "border-[var(--border)] bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--surface-elevated)]",
        ghost:
          "bg-transparent text-[var(--text-secondary)] hover:bg-[rgba(23,33,43,0.04)] hover:text-[var(--text-primary)]",
        outline:
          "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-5"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };

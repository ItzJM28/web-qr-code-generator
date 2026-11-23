import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold select-none touch-manipulation outline-none transition-[background-color,border-color,color,transform] duration-150 ease-out-soft active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        default:
          "border-[1.5px] border-primary bg-primary text-primary-foreground hover:border-[#0b5a4b] hover:bg-[#0b5a4b] disabled:border-[#d5dbd8] disabled:bg-[#d5dbd8] disabled:text-[#5f6b66]",
        outline:
          "border-[1.5px] border-primary bg-card text-primary hover:bg-[#0b5a4b] hover:text-white disabled:border-[#d5dbd8] disabled:bg-[#d5dbd8] disabled:text-[#5f6b66]",
        chip:
          "rounded-full border-[1.5px] border-input bg-card text-foreground hover:border-primary hover:text-primary disabled:border-border disabled:text-[#7d8984]",
        ghost: "text-primary hover:bg-accent",
      },
      size: {
        default: "min-h-11 rounded-md px-4 text-[0.95rem]",
        sm: "min-h-11 px-3.5 text-sm",
        lg: "min-h-13 rounded-xl px-4 text-base",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button"
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }

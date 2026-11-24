import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold select-none touch-manipulation outline-none transition-[background-color,border-color,color,transform] duration-150 ease-out-soft active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        default:
          "border-[1.5px] border-ink bg-ink text-white hover:border-[#2c2c33] hover:bg-[#2c2c33] disabled:border-[#d9d9de] disabled:bg-[#d9d9de] disabled:text-[#55555c]",
        outline:
          "border-[1.5px] border-ink bg-white text-ink hover:bg-ink hover:text-white disabled:border-[#d9d9de] disabled:bg-[#ececf0] disabled:text-[#55555c]",
        chip:
          "rounded-full border-[1.5px] border-orange bg-orange-tint text-orange-ink hover:bg-orange hover:text-ink disabled:border-border disabled:bg-white disabled:text-[#6b6b73]",
        ghost: "text-ink hover:bg-secondary",
      },
      size: {
        default: "min-h-11 rounded-md px-4 text-[0.95rem]",
        sm: "min-h-11 px-3.5 text-sm",
        lg: "min-h-13 rounded-2xl px-4 text-base",
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

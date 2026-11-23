import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-26 max-h-72 w-full min-w-0 resize-y rounded-[10px] border-[1.5px] border-input bg-card px-3.5 py-2.5 text-base leading-snug text-foreground outline-none transition-[border-color,box-shadow] duration-150 ease-out-soft placeholder:text-[#6f7b76] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/20 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }

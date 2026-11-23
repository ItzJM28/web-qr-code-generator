import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col", className)} {...props} />
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "flex w-full gap-1 overflow-x-auto overscroll-x-contain rounded-xl bg-secondary p-1",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex min-h-11 flex-[1_0_auto] items-center justify-center gap-2 whitespace-nowrap rounded-[9px] px-3 text-[0.95rem] font-semibold text-muted-foreground select-none touch-manipulation outline-none transition-[background-color,color,transform] duration-150 ease-out-soft active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:ring-[3px] focus-visible:ring-ring/40 data-[state=inactive]:hover:bg-white/60 data-[state=inactive]:hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-[0_1px_3px_rgba(20,40,33,0.14)] [&_svg]:size-[18px] [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("outline-none", className)} {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent }

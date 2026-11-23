import * as React from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-center"
      duration={3200}
      style={
        {
          "--normal-bg": "#1b2421",
          "--normal-text": "#ffffff",
          "--normal-border": "#1b2421",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }

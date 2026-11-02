import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-body transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-label file:text-foreground placeholder:text-placeholder read-only:border-strong read-only:bg-secondary hover:border-hover disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-disabled disabled:bg-disabled disabled:text-disabled in-data-invalid:border-danger-strong in-data-invalid:hover:border-danger-strong aria-invalid:border-danger-strong aria-invalid:hover:border-danger-strong",
        className
      )}
      {...props}
    />
  )
}

export { Input }

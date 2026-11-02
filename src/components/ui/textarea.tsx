import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-body transition-colors outline-none placeholder:text-placeholder hover:border-hover disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-disabled disabled:bg-disabled disabled:text-disabled in-data-invalid:border-danger-strong in-data-invalid:hover:border-danger-strong aria-invalid:border-danger-strong aria-invalid:hover:border-danger-strong",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }

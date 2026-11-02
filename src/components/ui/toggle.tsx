import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Toggle as TogglePrimitive } from "radix-ui"

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-transparent text-label whitespace-nowrap text-weak transition-[background-color,border-color,color] duration-160 ease-anfra-out outline-none select-none hover:bg-hover hover:text-default active:bg-active disabled:pointer-events-none disabled:text-disabled aria-invalid:border-danger-strong data-[state=on]:bg-active data-[state=on]:text-default [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border-strong bg-default hover:border-hover disabled:border-disabled disabled:bg-disabled",
      },
      size: {
        default: "h-8 min-w-8 px-2",
        sm: "h-7 min-w-7 px-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 min-w-9 px-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }

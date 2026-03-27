// components/auth/AuthInput.tsx
"use client"

import { useId, forwardRef } from "react"
import { cn } from "@/lib/utils"

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    // useId generates a globally unique, stable id per component instance —
    // eliminates the label-collision risk when two inputs share the same text
    // (e.g. two "Password" fields on the same page).
    const autoId = useId()
    const inputId = id ?? autoId

    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={inputId}
          className="text-[11px] font-medium tracking-widest text-muted-foreground uppercase"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-10 w-full rounded-lg border border-border bg-muted/40 px-3 text-sm",
            "placeholder:text-muted-foreground/40",
            "transition-all outline-none",
            "focus:border-primary/60 focus:ring-3 focus:ring-primary/20",
            error && "border-destructive/60 focus:ring-destructive/20",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }
)
AuthInput.displayName = "AuthInput"

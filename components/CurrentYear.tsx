// components/CurrentYear.tsx
// A client component so the year is evaluated at runtime, not frozen at
// build time. Use in server-component footers: <CurrentYear />
"use client"

export function CurrentYear() {
  return <>{new Date().getFullYear()}</>
}

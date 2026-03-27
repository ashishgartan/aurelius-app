// components/SwRegistrar.tsx
// Registers the service worker on first load.
// Must be "use client" — service workers are a browser API.
"use client"

import { useEffect } from "react"

export function SwRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          console.log("[SW] registered:", reg.scope)
        })
        .catch((err) => {
          console.warn("[SW] registration failed:", err)
        })
    }
  }, [])

  return null
}

// context/SidebarContext.tsx
// Tiny context that lets deeply nested children (e.g. ChatHeader) open the
// sidebar without prop-drilling through the entire layout tree.
"use client"

import { createContext, useContext } from "react"

const SidebarOpenerContext = createContext<() => void>(() => {})

export const SidebarOpenerProvider = SidebarOpenerContext.Provider

export function useSidebarOpener(): () => void {
  return useContext(SidebarOpenerContext)
}
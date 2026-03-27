// app/layout.tsx
import type { Metadata, Viewport } from "next"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/context/AuthContext"
import { ChatStoreProvider } from "@/context/ChatStoreContext"
import { SettingsProvider } from "@/context/SettingsContext"
import { SwRegistrar } from "@/components/SwRegistrar"
import "./globals.css"


export const metadata: Metadata = {
  title: "Aurelius — AI Assistant",
  description:
    "A sharp AI assistant with web search, tools, and document intelligence.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Aurelius",
    startupImage: "/appIcon.png",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/appIcon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/appIcon.png", sizes: "512x512", type: "image/png" }],
    shortcut: "/appIcon.png",
  },
  other: {
    // Microsoft tiles
    "msapplication-TileImage": "/appIcon.png",
    "msapplication-TileColor": "#0a0a0a",
  },
}

// Viewport is now a separate export in Next.js 14+
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // prevents double-tap zoom on iOS
  userScalable: false,
  viewportFit: "cover", // fills iPhone notch/dynamic island
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* iOS splash screen / standalone mode */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Aurelius" />
        <link rel="apple-touch-icon" href="/appIcon.png" />
      </head>
      <body>
        <SwRegistrar />
        <ThemeProvider>
          <AuthProvider>
            <ChatStoreProvider>
              <SettingsProvider>{children}</SettingsProvider>
            </ChatStoreProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

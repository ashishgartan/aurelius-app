// app/manifest.ts
// Next.js auto-serves this at /manifest.webmanifest
import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             "Aurelius — AI Assistant",
    short_name:       "Aurelius",
    description:      "A sharp AI assistant with web search, tools, and document intelligence.",
    start_url:        "/chat",
    scope:            "/",
    display:          "standalone",
    orientation:      "portrait-primary",
    background_color: "#0a0a0a",
    theme_color:      "#0a0a0a",
    categories:       ["productivity", "utilities"],
    icons: [
      {
        src:     "/appIcon.png",
        sizes:   "512x512",
        type:    "image/png",
        purpose: "any",
      },
      {
        src:     "/appIcon.png",
        sizes:   "512x512",
        type:    "image/png",
        purpose: "maskable",
      },
      {
        src:     "/icon-192.png",
        sizes:   "192x192",
        type:    "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name:      "New chat",
        short_name:"New",
        url:       "/chat",
        description: "Start a new conversation",
      },
    ],
  }
}
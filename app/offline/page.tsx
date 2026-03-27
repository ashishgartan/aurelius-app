// app/offline/page.tsx
"use client"
// Shown by the service worker when the user navigates offline
import Image from "next/image"

export default function OfflinePage() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Aurelius — Offline</title>
        <style>{`
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              background: #0a0a0a;
              color: #e2e8f0;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100dvh;
              text-align: center;
              padding: 2rem;
            }
            .icon {
              width: 64px; height: 64px;
              border-radius: 16px;
              margin: 0 auto 1.5rem;
            }
            h1 { font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem; }
            p  { font-size: 0.875rem; color: #64748b; line-height: 1.6; max-width: 280px; margin: 0 auto 1.5rem; }
            button {
              background: #6366f1; color: white;
              border: none; border-radius: 10px;
              padding: 0.625rem 1.5rem;
              font-size: 0.875rem; font-weight: 500;
              cursor: pointer;
            }
            button:hover { opacity: 0.9; }
          `}</style>
      </head>
      <body>
        <div>
          <Image
            src="/appIcon.png"
            alt="Aurelius"
            width={64}
            height={64}
            className="icon"
          />
          <h1>You&apos;re offline</h1>
          <p>
            Aurelius needs an internet connection to think. Connect and try
            again.
          </p>
          <button onClick={() => window.location.reload()}>Try again</button>
        </div>
      </body>
    </html>
  )
}

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Increase body size limit for file uploads (default 4MB is too small)
    experimental: {
      serverActions: {
        bodySizeLimit: "12mb",
      },
    },
    images: {
      remotePatterns: [
        // Dicebear avatars (generated avatars)
        {
          protocol: "https",
          hostname: "api.dicebear.com",
        },
        // Common avatar/image hosting services
        {
          protocol: "https",
          hostname: "avatars.githubusercontent.com",
        },
        {
          protocol: "https",
          hostname: "lh3.googleusercontent.com",
        },
        // Generic HTTPS images (user-supplied avatar URLs)
        {
          protocol: "https",
          hostname: "**",
        },
      ],
    },
  }
  
  export default nextConfig
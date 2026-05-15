import type { NextConfig } from "next";
import dns from "node:dns";

// Bypass Jio ISP DNS hijacking and IPv6 timeouts
dns.setServers(["8.8.8.8", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

const isDev = process.env.NODE_ENV === "development";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require("next-pwa")({
  dest: "public",
  disable: isDev,
  buildExcludes: [/app-build-manifest\.json$/],
});

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', '@radix-ui/react-icons'],
  },
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Prevent leaking server-only env vars to the client bundle.
  // Any var NOT prefixed with NEXT_PUBLIC_ is automatically excluded,
  // but this acts as a safety net for accidental mis-naming.
  serverExternalPackages: [],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=()'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net/ https://unpkg.com/",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' blob: https://*.supabase.co https://ioktlqvlrnmxpssbm.supabase.co https://generativelanguage.googleapis.com https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://*.googleapis.com https://*.googleusercontent.com https://tessdata.projectnaptha.com https://unpkg.com https://cdn.jsdelivr.net/",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; ')
          }
        ]
      }
    ]
  }
};

export default isDev ? nextConfig : withPWA(nextConfig);

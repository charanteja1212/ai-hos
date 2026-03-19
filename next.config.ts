import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["bullmq", "ioredis", "nodemailer", "pino", "pino-pretty"],
  async headers() {
    return [
      {
        // Static assets: long cache (hashed filenames auto-bust)
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Images and fonts: long cache
        source: "/:path(.*\\.(?:ico|png|jpg|jpeg|svg|webp|woff2?))",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Service worker: short cache, always check for updates
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        // Manifest: cache for 1 hour
        source: "/manifest.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600",
          },
        ],
      },
      {
        // HTML pages: short CDN cache, always revalidate
        source: "/:path((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=60, must-revalidate",
          },
        ],
      },
      {
        // Security headers on all routes
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.razorpay.com https://*.ingest.sentry.io; frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com;",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Only upload source maps if Sentry is configured
  silent: !process.env.NEXT_PUBLIC_SENTRY_DSN,
  disableLogger: true,
  // Automatically tree-shake Sentry SDK if DSN is not set
  tunnelRoute: "/monitoring",
});

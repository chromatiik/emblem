/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development';

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // `ws` (used by @neondatabase/serverless for its WebSocket connection)
  // relies on an optional native addon (bufferutil) for performance. When
  // webpack bundles it for the server instead of leaving it as a real
  // Node.js require(), that native addon loading breaks in a way that
  // throws "bufferUtil.mask is not a function" instead of cleanly falling
  // back to the pure-JS path. Excluding both packages from bundling here
  // fixes it.
  experimental: {
    serverComponentsExternalPackages: ['ws', '@neondatabase/serverless'],
  },
  async headers() {
    // Next.js's dev-mode client runtime (React Refresh / HMR) uses eval()
    // internally, and injects small inline bootstrap scripts on every
    // page — a strict 'self'-only script-src blocks BOTH of those, which
    // doesn't show up as an app error, it just makes every page silently
    // non-interactive (forms don't submit, buttons don't respond) with
    // only browser-console CSP violations to explain why. Production
    // doesn't need eval, but still needs 'unsafe-inline' for the App
        // Router's own streaming-hydration scripts (the reference site's own
    // CSP does the same — 'unsafe-inline' in script-src is normal here,
    // not a shortcut).
    const scriptSrc = isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self' 'unsafe-inline'";

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              isDev ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

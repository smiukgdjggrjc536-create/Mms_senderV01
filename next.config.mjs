/** @type {import('next').NextConfig} */
const nextConfig = {
  // Email-to-MMS Gateway Engine (Phase 1): allow the /models directory at the
  // repo root to be imported by server-side code (e.g. src/lib/core.js).
  // NON-DESTRUCTIVE: only transpiles the new folder, does not alter any
  // existing behavior or build output.
  transpilePackages: [],
  experimental: {
    // Permit importing files from outside /src via relative paths (../models).
    externalDir: true,
  },
  // ---------------------------------------------------------------------------
  // V7 P1.5 — Security Headers
  // CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
  // Permissions-Policy. 'unsafe-inline' is needed for script-src because
  // Next.js injects inline scripts for hydration + the admin panel uses
  // inline styles. This is the minimum viable secure header set.
  // ---------------------------------------------------------------------------
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://generativelanguage.googleapis.com https://api.twilio.com https://api.nexmo.com https://rest.messagebird.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
  // ---------------------------------------------------------------------------
  // Webpack: mark optional peer-dependencies as externals so the build never
  // fails on a missing optional package. `@valkey/valkey-glide` is an OPTIONAL
  // alternative Redis client that BullMQ references lazily — we use `ioredis`
  // exclusively, so we tell webpack to treat it as an empty external module.
  // This keeps `next build` warning-free without installing the package.
  // NON-DESTRUCTIVE: only affects how an unused optional import is resolved.
  // ---------------------------------------------------------------------------
  webpack: (config, { isServer }) => {
    const externals = Array.isArray(config.externals)
      ? config.externals
      : config.externals
        ? [config.externals]
        : [];
    externals.push({
      '@valkey/valkey-glide': 'commonjs @valkey/valkey-glide',
    });
    config.externals = externals;
    // Also provide a fallback empty module alias in case externals isn't
    // applied during the client build.
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias['@valkey/valkey-glide'] = false;
    return config;
  },
};

export default nextConfig;

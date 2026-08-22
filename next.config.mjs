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

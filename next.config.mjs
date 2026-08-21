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
};

export default nextConfig;

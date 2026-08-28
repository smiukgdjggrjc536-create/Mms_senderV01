// ============================================================================
// Next.js INSTRUMENTATION HOOK — src/instrumentation.ts
// ============================================================================
// Next.js automatically calls register() once on server startup (Node.js
// runtime only) when this file exists at the src root. We use it to start the
// Render free-tier keep-alive self-ping loop BEFORE the app begins serving
// requests, so the instance is kept warm from boot.
//
// The keep-alive module activates when NEXT_PUBLIC_PANEL_MODE is 'api'
// (legacy Render headless backend) OR 'admin' (Netlify — which now also
// hosts the gateway engine after the Render→Netlify consolidation).
// It is a complete no-op on Vercel (user panel).

export async function register() {
  // Only run on the Node.js server runtime — never on Edge.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const mode = process.env.NEXT_PUBLIC_PANEL_MODE;
    if (mode === 'api' || mode === 'admin') {
      try {
        const { startKeepAlive } = await import('./lib/keepAlive.js');
        startKeepAlive();
        // eslint-disable-next-line no-console
        console.log(`[instrumentation] keep-alive self-ping started (mode=${mode})`);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[instrumentation] failed to start keep-alive:', err);
      }
    } else {
      // eslint-disable-next-line no-console
      console.log(`[instrumentation] keep-alive skipped (mode=${mode}, runs on admin/api only)`);
    }
  }
}

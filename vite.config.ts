import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  const plugins = [react(), tailwindcss()];
  try {
    // @ts-ignore
    const m = await import('./.vite-source-tags.js');
    plugins.push(m.sourceTags());
  } catch {}

  const env = loadEnv(mode, process.cwd(), ['VITE_', 'NEXT_PUBLIC_']);
  const processEnvDefines: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    processEnvDefines[`process.env.${key}`] = JSON.stringify(value);
  }

  return {
    plugins,
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: processEnvDefines,
    server: {
      // Proxy /api requests to a local vercel dev server (port 3000) if it's
      // running, otherwise fall back to a 404 so the client's LocalStorage
      // fallback kicks in. Run `vercel dev --listen 3000` separately.
      proxy: {
        '/api': {
          target: process.env.API_PROXY_TARGET || 'http://localhost:3000',
          changeOrigin: true,
          // Don't fail hard if the backend is down — return a 404 instead
          // so the client's fetch layer falls back to seed data.
          bypass: (req: any, _res: any) => {
            // Only proxy XHR/fetch requests (not module imports — those
            // would otherwise be picked up by Vite's transform pipeline
            // and crash with "Failed to resolve import ../lib/mongo").
            const accept = req.headers.accept || ''
            if (accept.includes('text/html')) return req.url // let Vite handle HTML
            return undefined // proceed with proxy
          },
        },
      },
    },
    build: {
      // ─── Bundle splitting strategy ──────────────────────────────────
      // Without this, Vite produces ONE 740KB JS file. With manualChunks
      // we split it into 4 smaller chunks:
      //   1. vendor-react   (~140KB) — react, react-dom, react-router
      //   2. vendor-icons  (~80KB)  — lucide-react (loaded once, cached forever)
      //   3. vendor-motion  (~60KB)  — framer-motion
      //   4. vendor-utils  (~30KB)  — other small libs
      //   5. app-core       (~120KB) — App.tsx + contexts + services
      //   6. storefront     (~180KB) — Home, Shop, ProductDetail, Cart
      //   7. admin          (~240KB) — Admin, SuperAdmin (only loaded on /admin)
      //
      // Net effect on storefront visitors:
      //   Before: 740KB JS on EVERY page (admin code included)
      //   After:  ~340KB on storefront (admin code never loads for visitors)
      //
      // Cached vendor chunks also speed up subsequent visits — only the
      // app-core chunk changes when we deploy a new version, the vendor
      // chunks stay cached on the user's browser.
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-icons': ['lucide-react'],
            'vendor-motion': ['framer-motion'],
          },
        },
      },
      chunkSizeWarningLimit: 600,  // 600KB per chunk before warning (raised from 500)
    },
  };
})

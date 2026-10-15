import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      // Registration is done explicitly in src/pwa/register.ts so the app can
      // surface a non-interrupting "update available" prompt.
      injectRegister: false,
      includeAssets: ['favicon.ico', 'favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Shop Management',
        short_name: 'Shop',
        description: 'Offline-first shop and product management.',
        theme_color: '#1677FF',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // shop-icon.png is the high-resolution source artwork used to generate
        // the icons above; it is not needed at runtime, so keep it out of the
        // precache (the generated sizes are what the app/manifest reference).
        globIgnores: ['**/icons/shop-icon.png'],
        // The single app-shell chunk is intentionally large (antd + Refine);
        // it must be precached for the app to boot offline.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/functions\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // The app is offline-first through IndexedDB. Supabase requests
            // must never be served from the SW cache, or the UI could read
            // stale data that disagrees with the sync engine.
            urlPattern: ({ url }) => url.hostname.endsWith('supabase.co'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    // @refinedev/react-router declares react-router as a regular dependency, so
    // a nested copy can be installed alongside the app's copy. Two instances of
    // react-router mean two Router contexts, which breaks hooks like
    // useLocation inside Refine. Force a single copy.
    dedupe: ['react', 'react-dom', 'react-router'],
  },
})

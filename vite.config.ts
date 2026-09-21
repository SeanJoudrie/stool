import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// The app is deployed as a static bundle and must run with no network at all:
// everything (data, photos, analysis) stays on the device. Base is relative so
// it works from a subpath, a file server, or a home-screen install.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'favicon.ico'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // No runtime caching rules: there is nothing to fetch at runtime.
        navigateFallback: 'index.html',
      },
      manifest: {
        name: 'Stool — GI Journal',
        short_name: 'Stool',
        description:
          'A clinical stool and food journal for tracking GI symptoms, spotting dietary triggers, and preparing for a gastroenterology appointment.',
        theme_color: '#0f2733',
        background_color: '#0b1016',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        categories: ['health', 'medical', 'lifestyle'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})

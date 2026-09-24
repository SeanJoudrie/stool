import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// The app is deployed as a static bundle and must run with no network at all:
// everything (data, photos, analysis) stays on the device.
//
// GitHub Pages serves a project site from /<repo>/, so the deploy workflow sets
// APP_BASE. Locally it stays relative, which keeps `npm run preview`, a plain
// file server and a home-screen install all working from the root.
const base = process.env.APP_BASE ?? './'

export default defineConfig({
  base,
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
        name: 'Stool — a poop journal',
        short_name: 'Stool',
        description:
          'A poop journal. Log it in about fifteen seconds, see what keeps showing up before a bad one, and print something you can hand to a doctor.',
        theme_color: '#1f5c39',
        background_color: '#0c1410',
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

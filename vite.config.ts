import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './',
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      plugins: [
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'logo.png'],
          manifest: {
            name: 'QR Check-in Scanner',
            short_name: 'QR Scanner',
            description: 'Continuous QR code scanning for check-in operations',
            theme_color: '#0f172a',
            background_color: '#0f172a',
            display: 'standalone',
            scope: '/',
            start_url: '/',
            icons: [
              {
                src: 'icon-72x72.png',
                sizes: '72x72',
                type: 'image/png'
              },
              {
                src: 'icon-96x96.png',
                sizes: '96x96',
                type: 'image/png'
              },
              {
                src: 'icon-128x128.png',
                sizes: '128x128',
                type: 'image/png'
              },
              {
                src: 'icon-144x144.png',
                sizes: '144x144',
                type: 'image/png'
              },
              {
                src: 'icon-152x152.png',
                sizes: '152x152',
                type: 'image/png'
              },
              {
                src: 'icon-192x192.png',
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: 'icon-384x384.png',
                sizes: '384x384',
                type: 'image/png'
              },
              {
                src: 'icon-512x512.png',
                sizes: '512x512',
                type: 'image/png'
              },
              {
                src: 'icon-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable'
              },
              {
                src: 'icon-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable'
              }
            ]
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/.*\.(?:js|css|html|png|svg|ico)$/,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'static-resources',
                  expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
                  }
                }
              },
              {
                urlPattern: /^https:\/\/.*\/qr\.php/,
                handler: 'NetworkFirst',
                options: {
                  cacheName: 'api-cache',
                  expiration: {
                    maxEntries: 100,
                    maxAgeSeconds: 5 * 60 // 5 minutes
                  }
                }
              }
            ]
          }
        })
      ]
    };
});

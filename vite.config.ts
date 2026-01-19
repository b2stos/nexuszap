import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "pwa-192x192.png", "pwa-512x512.png"],
      manifest: {
        name: "Nexus Zap - WhatsApp Business Platform",
        short_name: "Nexus Zap",
        description: "Plataforma de atendimento e campanhas via WhatsApp Business. Desenvolvido pela B2 DIGITAL LTDA.",
        theme_color: "#0d9488",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/dashboard",
        scope: "/",
        categories: ["business", "productivity", "communication"],
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ],
        screenshots: [],
        shortcuts: [
          {
            name: "Inbox",
            short_name: "Inbox",
            url: "/dashboard/inbox",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }]
          },
          {
            name: "Campanhas",
            short_name: "Campanhas",
            url: "/dashboard/campaigns",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }]
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/xaypooqwcrhytkfqyzha\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5 // 5 minutes
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

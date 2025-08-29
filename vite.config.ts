import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Définir __dirname pour ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Fonction pour charger le plugin Cartographer seulement si nécessaire
function getCartographerPlugin() {
  if (process.env.NODE_ENV !== "production" && process.env.REPL_ID) {
    return import("@replit/vite-plugin-cartographer").then((m) => m.cartographer());
  }
  return null;
}

export default defineConfig(async () => {
  const cartographerPlugin = await getCartographerPlugin();

  return {
    plugins: [
      react(),
      runtimeErrorOverlay(),
      ...(cartographerPlugin ? [cartographerPlugin] : []),
    ],
    resolve: {
      alias: {
        "@": resolve(__dirname, "client", "src"),
        "@shared": resolve(__dirname, "shared"),
        "@assets": resolve(__dirname, "attached_assets"),
      },
    },
    root: resolve(__dirname, "client"),
    build: {
      outDir: resolve(__dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});

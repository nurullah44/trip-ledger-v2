import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// tanstackStart() must come before viteReact().
export default defineConfig({
  css: { transformer: "lightningcss" },
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  plugins: [tailwindcss(), tsConfigPaths(), tanstackStart(), viteReact()],
  server: {
    host: "::",
    port: 8080,
    // The API runs on :8000; proxying keeps the browser on one origin (and the
    // contract's `servers: [/]`) with no CORS in the way.
    proxy: {
      "/groups": "http://localhost:8000",
      "/auth": "http://localhost:8000",
    },
  },
  preview: {
    proxy: {
      "/groups": "http://localhost:8000",
      "/auth": "http://localhost:8000",
    },
  },
});

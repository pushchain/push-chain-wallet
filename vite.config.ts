import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { nodePolyfills } from "vite-plugin-node-polyfills";
//@ts-expect-error basePath is generated outside TypeScript source roots
import { getAppBasePath } from "./basePath";
import { resolve } from "path";
import viteTsconfigPaths from "vite-tsconfig-paths";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    allowedHosts: ["e1f9-2401-4900-1c88-1914-e89a-77ea-de1e-9a3c.ngrok-free.app"],
  },
  plugins: [
    nodePolyfills({
      // You can add options here if needed
      // For example, enable specific polyfills
      // include: ['path', 'fs', ...]
    }),
    react(),
    viteTsconfigPaths({
      root: "./src",
    }),
  ],
  resolve: {
    alias: {
      // Define your alias here
      blocks: resolve(__dirname, "src/blocks"),
      common: resolve(__dirname, "src/common"),
    },
  },
  base: getAppBasePath(),
  build: {
    outDir: "build",
    sourcemap: false,
  },
});

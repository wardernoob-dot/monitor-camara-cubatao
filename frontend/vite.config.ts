import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base relativa + HashRouter: o mesmo build funciona em github.io/<repo>/ e no dominio proprio.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: { outDir: "../docs", emptyOutDir: false, assetsDir: "assets", sourcemap: false },
  server: { fs: { allow: [".."] } },
});

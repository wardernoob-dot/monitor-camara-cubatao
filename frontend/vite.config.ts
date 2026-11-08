import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

// So no `npm run dev`: serve os dados e as fotos ja gerados em ../docs (no build eles ja estao em docs/).
const TIPOS: Record<string, string> = { ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
const dadosDoDocs = (): Plugin => ({
  name: "dados-do-docs",
  apply: "serve",
  configureServer(server) {
    const raiz = resolve(__dirname, "../docs");
    server.middlewares.use((req, res, next) => {
      const caminho = decodeURIComponent((req.url ?? "").split("?")[0]);
      if (!/^\/(data|fotos)\//.test(caminho)) return next();
      const arquivo = join(raiz, normalize(caminho));
      if (!arquivo.startsWith(raiz) || !existsSync(arquivo) || !statSync(arquivo).isFile()) return next();
      res.setHeader("Content-Type", TIPOS[extname(arquivo)] ?? "application/octet-stream");
      createReadStream(arquivo).pipe(res);
    });
  },
});

// base relativa + HashRouter: o mesmo build funciona em github.io/<repo>/ e no dominio proprio.
export default defineConfig({
  plugins: [react(), dadosDoDocs()],
  base: "./",
  build: { outDir: "../docs", emptyOutDir: false, assetsDir: "assets", sourcemap: false },
  server: { fs: { allow: [".."] } },
});

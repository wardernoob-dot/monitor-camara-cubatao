# Front (React)

App React + Vite + TypeScript que lê `docs/data/dados.json` (gerado todo dia pelo robô em Python,
`camara/site.py`) e mostra vereadores, votos, projetos e sessões.

- `npm install` e depois `npm run dev` para desenvolver (copie `docs/data` para `frontend/public/data` ou rode o export antes).
- `npm run build` compila em `../docs/` (só `index.html`, `assets/` e `favicon.svg`; não mexe em `docs/data`).

O build é commitado no repositório. O robô diário só atualiza `docs/data/`, então o Actions não precisa de Node.
Rotas usam `HashRouter` (`/#/vereadores/xuxa`): o mesmo build funciona em `github.io/<repo>/` e no domínio próprio.

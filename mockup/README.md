# Protótipo web — Risco e Cor

Mockup clicável do app: uma moldura de telefone com as telas do produto, para explorar
interface e comportamento antes de levar cada tela para `../android/`. Não é o app e não
roda no aparelho — é a bancada onde a decisão de tela fica visível e medível.

## Como rodar

Requer Node.js com `npm`.

```bash
cd mockup
npm ci
npm run dev
```

O endereço local aparece no terminal quando o servidor sobe.

## Portões

Medidos em 2026-10-28, na raiz desta pasta:

| Comando | O que mede | Resultado |
|---|---|---|
| `npm test` | 80 arquivos, 890 testes (Vitest + jsdom) | verde |
| `npm run tsc` | `tsc --noEmit` | verde |
| `npm run lint` | ESLint | verde |
| `npm run build` | build de produção (Vite + TanStack Start) | verde |

Nenhum dos quatro é opcional antes de commit de tela. O `npm test` leva cerca de 95 s
porque as telas renderizam centenas de nós — espere em vez de cortar o timeout.

## Como o código está organizado

- `src/mockup/` — as telas e o que elas usam. A navegação é um estado em memória, não
  rotas: a moldura do telefone é uma página só, como uma single-activity Android.
- A arte é uma lista de comandos (`src/mockup/history.ts`); desfazer, refazer, autosave e
  as miniaturas derivam dela — o mesmo modelo planejado para o app nativo.
- `src/components/` e `src/lib/` — peças compartilhadas.
- `src/routes/`, `src/router.tsx`, `src/start.ts`, `src/server.ts` — casca do TanStack Start.
- `public/` — favicon, marca e Baloo 2 (SIL OFL 1.1; atribuição em `CREDITS.md`).
- `tools/gen-tool-icons.mjs` — gerador dos ícones de ferramenta.

## Origem do projeto

O esqueleto veio do Lovable e continua conectado a ele: commits na branch conectada sobem
para lá. Não reescreva histórico já publicado — force push, rebase, amend ou squash de
commit publicado.

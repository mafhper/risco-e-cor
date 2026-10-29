# Créditos e licenças

Terceiros que este repositório distribui ou consome. Ordem: o que é nosso vem
depois, se houver; aqui só entra o que não é.

## Fontes distribuídas neste repositório

| Fonte   | Autor                                 | Arquivo local                   | Licença                   | Texto da licença       |
| ------- | ------------------------------------- | ------------------------------- | ------------------------- | ---------------------- |
| Baloo 2 | The Baloo 2 Project Authors (Ek Type) | `public/fonts/baloo2-var.woff2` | SIL Open Font License 1.1 | `public/fonts/OFL.txt` |

### Baloo 2

- **Autor:** The Baloo 2 Project Authors — <https://github.com/EkType/Baloo2>
- **Origem:** Google Fonts, família `baloo2` — <https://github.com/google/fonts/tree/main/ofl/baloo2>
- **Arquivo de origem:** `Baloo2[wght].ttf`, variável no eixo `wght` (400–800)
- **Uso aqui:** camada de voz do produto — wordmark e títulos. Texto de dado
  (rótulo, número, hex, contador) fica na fonte neutra da interface.
- **Licença:** SIL Open Font License 1.1, sem Reserved Font Name declarado. O
  texto completo viaja junto da fonte em `public/fonts/OFL.txt`, como a licença
  exige; o copyright é o do original:

  > Copyright 2019 The Baloo 2 Project Authors (https://github.com/EkType/Baloo2)

- **O que foi feito com o arquivo:** conversão de formato TTF → WOFF2. Sem
  subset, sem renomear a família e sem tocar contorno — o `.woff2` é o mesmo
  font software empacotado menor, então a atribuição acima vale para ele.

## Fontes consumidas de CDN (não distribuídas aqui)

`Fraunces`, `Geist` e `IBM Plex Mono` são carregadas do Google Fonts por
`<link>` em `src/routes/__root.tsx`, não são copiadas para este repositório e
por isso não têm arquivo nem `OFL.txt` local.

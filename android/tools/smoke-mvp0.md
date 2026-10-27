# Smoke MVP-0 — roteiro do script

`tools/smoke-mvp0.ps1` instala o APK debug (`--user 0`), limpa os dados e
percorre o fluxo por `content-desc`/texto (sem coordenada fixa de botão). A
única coordenada calculada é a da página: a captura é analisada por
`tools/paper-bounds.py`, que encontra o retângulo branco do papel; os centros das
regiões 6 e 4 vêm de `content/page_poc.json` (coordenadas em px da página 1024).

Passos provados:

1. Home: perfis no topo, mural e engrenagem.
2. Perfil Maria (9+): persona, Criar, Meus desenhos, mural "Só meus".
3. Criar → "Página para colorir".
4. Estúdio: balde + vermelho na região 6; balde + azul na região 4.
5. Desfazer/refazer (o azul sai e volta).
6. "Guardar" → "Publicar no mural".
7. Home: a peça aparece no mural com o autor.
8. Galeria: a peça publicada está listada e abre em modo leitura.
9. Rascunho: folha em branco, um traço, "Guardar" → "Guardar rascunho";
   na galeria o ícone de lixeira apaga o rascunho e "Desfazer" no snackbar
   restaura a peça.
10. Perfil Theo (3–5): dois portais sem texto funcional.
11. Estúdio kids: quatro ferramentas, seis cores de 56 dp, "Feito" só-ícone;
    voltar descarta a folha vazia e devolve ao perfil.

Saída em `.dev-evidence/` (local, ignorado): `01..15-*.png`, `badging.txt`,
`install.txt`, `logcat.txt`, `summary.txt`, `EVIDENCE.md` e `smoke-console.txt`.

O log `MeuDesenho` registra, por fill: rótulo, área, pixels pintados, retângulo
sujo, `leaks` (precisa ser 0) e milissegundos. É a prova de "não vaza" além da
inspeção visual. O aparelho de referência está em modo escuro; o app segue o
aparelho, então as capturas provam a paleta escura. As capturas da paleta clara
saem do `ScreenshotTest` (JVM), em `app/build/evidence/`.

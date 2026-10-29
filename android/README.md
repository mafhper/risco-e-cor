# Meu Desenho — app Android (MVP-0)

Aplicativo familiar de desenho e colorir, offline, sem conta e sem permissões.
Este módulo entrega o **MVP-0**: Home da família, Home do perfil (pro e kids),
estúdio com página para colorir, fill por toque, traço livre, desfazer/refazer,
autosave, galeria e publicação no mural.

Este documento descreve o que existe no código — não o que está planejado.

## Estado

- `assembleDebug` e `lintDebug` verdes; testes de unidade verdes.
- Instalado e exercitado no aparelho de referência (SM-N981B / Android 13):
  Home → perfil → criar → colorir → guardar/publicar → galeria, com log de
  `leaks=0` em cada fill.
- Tema claro/escuro segue o aparelho; a escolha manual fica nas configurações
  globais da Home.

## Escopo do MVP-0

Inclui:

- Home do app com até quatro perfis no topo e mural em grade das peças
  publicadas; a engrenagem é a única configuração global.
- Home do perfil: persona (avatar/emoji/tema), repertório, ação de criar,
  "Meus desenhos" e mural com escopo "Só meus / Todos".
- Perfil 3–5 em leitura zero: dois portais do tamanho de cartões, avatar e
  peças; nenhum texto funcional.
- Estúdio full-bleed com dock em três estados (mini, compacto, expandido),
  quatro ferramentas (lápis, ceras, balde, borracha), seis cores,
  desfazer/refazer e guardar.
- Fill por toque sobre o mapa de regiões pré-computado, sem vazar; traço livre
  com undo; borracha que remove o traço inteiro.
- Guardar com três saídas (publicar / rascunho / continuar); descarte de
  rascunho com desfazer.
- Autosave em `filesDir`, gravação atômica, galeria com rascunhos e publicados.

Fora do MVP-0 (não implementado de propósito): criação/edição de perfis, temas
customizados, desafio duo, backup SAF, exportação PNG, zoom/pan, áudio/voz,
replay, mais páginas e importação de conteúdo.

## Movimento e toque

O lote better-ui do mockup foi portado com os números medidos lá (`ui/Motion`,
`ui/Glyph`, `ui/Ui`):

- **Toque**: toda superfície clicável encolhe para `0.96` em 150 ms via
  `StateListAnimator` — o estado pressionado do framework dispara o movimento,
  então clique, ripple e acessibilidade continuam intocados. Ficam estáticas as
  superfícies onde o movimento distrai ou que não são alvo: o HUD de zoom do
  canvas, a barra de espectro e os scrims/corpos das folhas.
- **Traço dos ícones**: 1.5 regular e 2 semibold (mais, check e play), decidido
  em um lugar só (`Glyph.strokeFor`). O play é triângulo vazado com 1 unidade de
  correção óptica no eixo dele.
- **Folhas**: entram em 280 ms com `cubic-bezier(.22,1,.36,1)` e saem com 12 dp
  + fade em 150 ms `ease-out`; a view sai no fim da animação (`withEndAction`),
  nunca por um timer paralelo.
- **Troca de tema**: é um commit, não uma transição. Nada anima enquanto a paleta
  vira e o adulto continua na tela em que estava — a rota vai em `Prefs` e volta
  no `onCreate`.
- **Cross-fade**: o ícone da ferramenta na pílula e o tipo do readout do topo
  trocam com fade (escala `0.25 → 1`, desfoque `4 → 0` dp, 300 ms) em vez de
  pular. O readout que muda de número a cada gesto não passa por aí.
- **Primeira execução**: os dois portais do perfil 3–5 entram em sequência de
  100 ms, uma única vez (`Prefs.firstRun` marca a chave).
- **Sem animação**: com "remover animações" ligado no aparelho, todo movimento
  aplica o estado final de uma vez (`ValueAnimator.areAnimatorsEnabled`).

## Módulos

| Módulo | Papel |
|---|---|
| `:app` | Activity única, telas, dock, canvas, documentos e persistência |
| `:core:fill` | mapa de regiões e algoritmo de fill (Java puro, testado na JVM) |
| `:core:doc` | histórico de comandos com orçamento de undo (Java puro) |
| `:testkit` | gera `content/page_poc` (PNG + mapa + sidecar) e roda o portão de conteúdo |
| `content/` | página para colorir do MVP-0 (formas próprias, sem material de terceiros) |

O APK não tem AndroidX: a interface é `android.view`/`android.widget` e as
fontes são as do sistema (serifada no display, sans no texto, mono nos números).
Robolectric aparece apenas no classpath de teste, para rodar o fluxo na JVM; não
entra no APK.

## Como compilar e instalar

```bash
cd android
./gradlew :app:assembleDebug
adb install -r --user 0 app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.theomaria.draw/.AppActivity
```

Requisitos: JDK 17, SDK em `local.properties`, Android 10+ (minSdk 29,
targetSdk 36).

Testes e portões:

```bash
./gradlew :core:fill:testDebugUnitTest :core:doc:testDebugUnitTest
./gradlew :app:testDebugUnitTest :app:lintDebug
```

`FlowSmokeTest` percorre a navegação real, aplica fill na página, exercita
undo/redo, publica, abre a galeria e confere o descarte com desfazer.
`ScreenshotTest` renderiza as telas na JVM e grava PNGs em
`app/build/evidence/` para inspeção visual sem aparelho.
`PressCoverageTest` percorre Home, perfil (pro e kids), folha de criar, canvas
nos três estados, folha de guardar, galeria e configurações e falha apontando a
view de qualquer alvo clicável que tenha ficado sem press scale.
`MotionTest`, `GlyphTest`, `ThemeSwitchTest` e `PrefsTest` guardam os números do
better-ui, o peso do traço, o commit do tema e o "uma vez só" do stagger.

## Smoke no aparelho

```powershell
powershell -ExecutionPolicy Bypass -File tools/smoke-mvp0.ps1
```

O script instala, limpa os dados, percorre o fluxo por `content-desc` (sem
coordenada fixa de botão), localiza o papel na captura para tocar nas regiões
reais, confere `leaks=0` no logcat e grava capturas, log e um resumo em
`.evidence/` (pasta local, ignorada pelo controle de versão). O passo a
passo está em `tools/smoke-mvp0.md`.

## Arquitetura em uma tela

- **Documento por comandos.** Cada peça é uma lista de comandos (`fill`,
  `stroke`, `erase`). O bitmap é derivado: desfazer move o cursor e reaplica a
  lista. Não há snapshot de bitmap no histórico.
- **Composição.** papel branco → fills das regiões → contorno da página →
  traços do usuário. A cor nunca cobre o contorno, e o traço pode passar por
  cima dele, como em papel.
- **Undo 50.** A profundidade limita quantos passos o undo alcança; nenhum
  comando é descartado (descartar apagaria pintura de verdade). Um comando novo
  limpa a frente de redo.
- **Fill sem vazamento.** O motor decide (fill, snap no contorno, rejeição de
  fundo/área); o app confere no retângulo afetado se algum pixel mudou fora da
  região (contorno é permitido) e aborta o comando se vazar. O resultado vai
  para o log com `leaks=0`.
- **Persistência.** Um JSON por peça em `filesDir/artworks`, gravação atômica
  (tmp + rename) em uma fila única; o autosave enfileira depois de cada comando
  e uma gravação explícita espera a fila, para um rascunho antigo nunca
  sobrescrever uma publicação.
- **Privacidade.** Manifest sem `INTERNET` e sem nenhuma permissão;
  `allowBackup="false"`. Nada sai do aparelho.

## Limitações conhecidas

- Perfis são as duas seeds (Theo 3–5, Maria 9+); o modelo aceita quatro, mas a
  criação/edição de perfis é fase posterior.
- O lote tem uma página (`page_poc`); a galeria de páginas ainda não existe.
- O primeiro fill de uma região grande foi medido em ~210 ms no aparelho de
  referência (região de 265 mil px); fills seguintes na mesma sessão ficaram em
  ~16 ms. Não bloqueia o uso, mas é o ponto de otimização do próximo ciclo.
- Sem zoom, exportação, áudio ou compartilhamento — todos fora do MVP-0.
- O dock compacto mostra as seis cores; a borracha remove traços inteiros, não
  pixels.

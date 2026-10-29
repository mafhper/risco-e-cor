// Reviewer notes shown next to the phone on desktop: what each screen
// decides and which point of the reviews it answers.
export type Note = { title: string; points: string[] };

export const NOTES: Record<string, Note> = {
  home: {
    title: "Home — o mural da família",
    points: [
      "Pele neutra da paleta (linho, nanquim, pigmento): nenhuma criança vê personagem de outra faixa.",
      "Perfis em linha única (avatar + nome em Fraunces), sem card. À direita, o único botão das configurações globais, atrás do gate.",
      "O mural é uma parede: peças em duas colunas, cada uma com rotação fixa derivada do id e etiqueta manuscrita do autor.",
      "Busca filtra por autor ou desenho sem sair da Home; “Ver todas” expande a parede inteira no mesmo scroll.",
      "“+ nova peça” pergunta com quem vamos desenhar antes de criar: autoria nunca é implícita.",
    ],
  },
  profile: {
    title: "Perfil — uma pessoa, não um app",
    points: [
      "Entra pela Home e volta para a Home; não há atalho para outro perfil daqui.",
      "Persona grande: retrato do tema, faixa etária e o vocabulário da idade (objetos para 3–5, técnicas para 9+).",
      "Recentes do próprio perfil em faixa horizontal; o mural da família segue abaixo, com “Só meus / Todos”.",
      "Uma única ação principal, âmbar: “Começar a desenhar”. Desenhar e colorir são o mesmo estúdio.",
      "“Editar este perfil” abre só o que é daquela pessoa: nome, avatar, emoji, foto, tema e atividade favorita.",
      "Com “Temas do perfil” ligado, a própria pessoa troca de tema na Home: os temas são bolinhas com emoji, sem texto.",
      "Arquivos do perfil (meus desenhos, duplicar, arquivar) ficam ali; idade/modo/ferramentas são do tutor.",
    ],
  },
  pages: {
    title: "Páginas para colorir",
    points: [
      "É uma escolha dentro do fluxo de criação, não um modo paralelo.",
      "Tudo liberado: sem cadeado, sem “premium”, sem estrela de pagar.",
      "Temas por ícone (animais, família, festas, espaço, natureza).",
      "Ponto = desenho em andamento; tocar reabre de onde parou. Voltar retorna ao Perfil.",
    ],
  },
  canvasFill: {
    title: "Colorir — uma barra, no rodapé",
    points: [
      "A folha é full-bleed: o papel encosta nas bordas e a barra/HUD flutuam por cima, sem faixa vazia.",
      "A MESMA barra repousa sempre embaixo: nenhuma posição lateral, nem no pro.",
      "No pro a barra leva 5 ferramentas (o balde quando a página é de colorir); o resto da prateleira fica a um toque, no expandir.",
      "Compacto: preview + tamanho; abaixo, ferramentas só-ícone; por último, as 6 cores + o espectro. Sem abas, sem slider, sem “Mais”.",
      "O card de cor mostra a fileira de swatches; a cor ativa é o único indicador (sem faixa, sem nome). Criança: 6 círculos ≥56dp, zero texto, zero hex.",
      "Expandido: folha M3 encostada nas bordas, coleções com busca, parâmetros da ferramenta, preview 48×48 e a paleta completa (18 famílias × 11 passos + preto/branco). “Feito” desce para o compacto; tocar no scrim volta à barra.",
      "Começar um traço esconde a barra no mesmo toque; soltar devolve a barra sem reabrir nada.",
      "Nada bloqueado é desenhado: uma ferramenta fora do alcance do perfil simplesmente não existe.",
      "Toque numa área e ela pinta inteira; o contorno fica por cima, como num livro de colorir.",
      "Voltar com a peça já salva mostra a pílula “Salvo” + scrim antes da troca. Com traço novo, pergunta: Publicar (mural), Rascunho ou Jogar fora (rascunho do dono, com Desfazer 5s).",
    ],
  },
  canvasDraw: {
    title: "Desenhar — o mesmo estúdio, sem contorno",
    points: [
      "Papel do tamanho da tela (a folha nasce na proporção do celular) — nada de card sobre fundo.",
      "Cada ferramenta mostra o traço do próprio motor: largura, ponta e tracejado reais, não um thumbnail genérico.",
      "A barra tem três posições e dois estados (compacto/expandido); enquanto o dedo desenha ela sai da tela.",
      "No kids o ícone é o objeto + o traço (lápis, carvão, giz, marcador, pincel, aquarela): a criança reconhece a forma sem ler.",
      "Parâmetros contextuais: pincel (tamanho, opacidade), aquarela (água), lápis (dureza), borracha (tamanho), balde (nenhum slider falso).",
      "Água e dureza mudam a opacidade real do comando do traço, não só a UI.",
      "Pinça amplia; dois dedos movem a folha; um dedo desenha — sem conflito de gesto.",
      "Gradiente linear/radial com 8 ângulos; sombra e brilho viram filtros SVG no traço.",
      "Peça já publicada não oferece “despublicar” nem “jogar fora” para a criança — isso é na área do adulto.",
    ],
  },
  gallery: {
    title: "Meus desenhos",
    points: [
      "Só os desenhos do perfil atual, guardados no aparelho — sem nuvem, sem conta.",
      "Tocar um card abre o estúdio direto: o card cresce até virar a tela (elemento compartilhado).",
      "Selo ★ = publicado; a barra de cor embaixo mostra as cores que a peça usa.",
      "O contador separa o que está na grade do que está guardado: “12 peças + 3 guardadas”.",
      "“Guardados” fica recolhido no fim: fora da vista, não apagado.",
      "Apagar não existe aqui: a lixeira é da área do adulto.",
    ],
  },
  view: {
    title: "Ver desenho — a peça na parede",
    points: [
      "Dono: continuar, guardar foto (PNG), fazer uma cópia e — se for rascunho — jogar fora.",
      "“Jogar fora” não abre modal: vai para a lixeira e deixa “Desfazer” por 5s, mesmo se você navegar.",
      "Peça publicada não tem “jogar fora” para a criança: “só o adulto tira daqui”.",
      "A cópia nasce como rascunho e nunca mexe no original.",
      "Mural (leitura): só Voltar e o autor — sem editar o desenho dos outros.",
    ],
  },
  gate: {
    title: "Barreira do adulto",
    points: [
      "Segurar 2 segundos e resolver uma conta (ex.: 12 + 7).",
      "Errou? Aparece outra conta, sem castigo nem bloqueio.",
      "Evita toques acidentais — não é senha nem segurança forte.",
      "O destino decide o escopo: Home abre o tutor global; Perfil abre os ajustes daquela criança.",
    ],
  },
  adult: {
    title: "Área do adulto — perfis, temas, obras e lixeira",
    points: [
      "Perfis da família: listar, criar, ordenar, duplicar, guardar e remover — tudo atrás do gate, num lugar só.",
      "A cópia leva identidade e preferências, zero desenhos; remover exige galeria e lixeira vazias (nada vira órfão).",
      "Temas são dados do adulto: criar do zero (cor base) ou a partir de outro tema, duplicar, renomear, arquivar e escolher por perfil. Sem limite de três e sem tema preso a um perfil.",
      "Arquivar um tema só o tira do seletor: quem já veste o tema continua vestindo, e trocar de tema nunca toca nos desenhos.",
      "Idade, modo e as 7 capacidades de cada perfil são decisão do tutor: ficam aqui, no escopo global, com o perfil escolhido.",
      "Mural: “Tirar” vira rascunho de novo; “Guardar” esconde em Guardados, com Desfazer de 5s.",
      "Lixeira: Restaurar devolve ao lugar de origem; “Apagar de vez” pede confirmação com miniatura; esvaziar é em dois toques.",
      "Ajustes de {nome} (só pelo Perfil): identidade, arquivos do perfil e atividade favorita — nada global, nada de idade/modo.",
      "Exportar backup não leva a foto do perfil; importar nunca apaga a lixeira.",
      "Aparência do app (claro/escuro) é uma preferência única e segue o aparelho por padrão.",
    ],
  },
};

export const LATER = [
  "Carimbos e adesivos",
  "Replay do traço",
  "Camadas de traço",
  "Pacotes sazonais e importação de páginas",
  "Foto → página para colorir",
];

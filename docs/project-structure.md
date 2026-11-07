# Estrutura do projeto e decisões

Este documento explica **por que** o repositório é assim, para facilitar
mudanças futuras. Para o "como usar", veja o [README](../README.md).

## Como os arquivos "conversam"

Páginas HTML não se chamam diretamente. Elas se ligam de duas formas:

1. **Links** (`<a href="games/flag/index.html">`) levam de uma página a outra.
2. **Arquivos compartilhados**: cada página importa os mesmos CSS e JS, e é
   assim que todas ficam com a mesma cara e o mesmo tema.

Os caminhos são **sempre relativos ao arquivo que os escreve**. De
`games/flag/index.html`, `../../css/main.css` sobe duas pastas e entra em
`css/`. Caminhos que começam com `/` não são usados, porque quebram quando o
site fica numa subpasta (GitHub Pages de projeto).

## Pastas

| Pasta | Conteúdo | Quem usa |
|-------|----------|----------|
| `css/` | paleta e componentes da plataforma | todas as páginas |
| `js/` | tema, idioma, catálogo e ponto de entrada da home | home (`theme.js`, `lang.js` e `i18n.js` também nos jogos) |
| `i18n/` | textos de cada idioma (`pt.json`, `en.json`, `es.json`) | todas as páginas |
| `data/` | dados compartilhados entre jogos | jogos |
| `games/<id>/` | um jogo completo e independente | só o próprio jogo |
| `docs/` | documentação | pessoas |

Cada jogo traz o próprio `style.css` e `game.js`. Um jogo não importa código de
outro: se dois jogos precisam da mesma coisa, ela sobe para `css/`, `js/` ou
`data/`.

## Decisões

### Tema claro/escuro

- As cores da marca são variáveis `--ggeo-*` em `css/main.css`. O resto da
  interface usa **papéis** (`--bg`, `--fg`, `--accent`, `--surface`...) que
  apontam para elas. Trocar uma cor da marca troca tudo de uma vez.
- Superfície, borda e texto secundário são **calculados** com `color-mix()` a
  partir de fundo e texto, então funcionam nos dois temas sem valores à mão.
- O laranja é a cor de ação (botão principal e destaques). Texto sobre o laranja
  é preto. O verde aparece só em detalhes pequenos (como o ponto de
  "Disponível"), nunca como fundo de texto.
- No tema claro, o laranja `#C4761D` sobre o bege tem contraste baixo (≈2,4:1).
  Por isso o laranja é usado como fundo de botão com texto preto (≈6:1) e não
  como cor de texto, e a barra do cronômetro e o anel de foco do teclado usam a
  cor do texto nesse tema. No escuro, o laranja `#FF7700` sobre preto tem ≈7,9:1.
- `js/theme.js` é um script **comum** (não módulo) e fica na `<head>`, para o
  tema ser aplicado antes da página aparecer e não "piscar". A escolha fica em
  `localStorage` (`ggeo_theme`).

### Idiomas (i18n)

- Dicionários simples em `i18n/<codigo>.json` (chave → texto, com `{parametros}`).
  Sem biblioteca: são ~70 textos, e assim dá para entender e editar tudo.
- O HTML guarda o texto em **português**, que aparece sem JavaScript e no
  primeiro desenho. `js/lang.js` (script comum na `<head>`) decide o idioma
  cedo; se não for português, a página fica escondida por instantes
  (`i18n-loading`, com limite de 3 s) até os textos chegarem, para não piscar
  em português.
- O idioma vem de: escolha salva (`ggeo_lang`) → idioma do navegador → português.
- O que o JS monta (cartões, mensagens do jogo, dica) é guardado como **dados**
  e redesenhado ao trocar o idioma, até no meio de uma rodada.
- Nomes de países usam `Intl.DisplayNames` do navegador (cobre pt, en, es e zh
  sem tradução manual). Capitais usam `capitals` no `countries.json`.
- A resposta é aceita em qualquer idioma do site, ignorando acentos e
  maiúsculas. Verifiquei que nenhuma grafia aceita aponta para dois países.
- O nome "Flag" e o slogan "Play the World" não são traduzidos de propósito.
- Fica em aberto: o `<noscript>` continua só em português.

### Países em `data/countries.json`

A lista saiu do código do jogo para um arquivo de dados, porque o futuro jogo
Rotas vai precisar dos mesmos países. O jogo carrega o arquivo com `fetch`,
usando `import.meta.url` para achar o caminho a partir do próprio `game.js`.
O custo: o jogo não abre mais com duplo clique, só por servidor (ver README).

### Módulos JavaScript

`games/flag/game.js` é um módulo (`type="module"`). Em módulos as funções não
são globais, então os botões não usam `onclick="..."` no HTML; os cliques são
ligados no JS com `addEventListener`.

### Catálogo

`js/games.js` é a única lista de jogos. A home desenha os cartões a partir
dela, então adicionar um jogo não exige mexer em `index.html`.

## Dados salvos no navegador (`localStorage`)

| Chave | Conteúdo | Observação |
|-------|----------|------------|
| `ggeo_theme` | `dark` ou `light` | compartilhada por todas as páginas |
| `ggeo_lang` | `pt`, `en` ou `es` | só é gravada quando a pessoa escolhe no seletor |
| `ggeo_flag_records` | recorde por região do jogo Flag | |
| `ggeo_flag_font` | tamanho da fonte do jogo Flag | |

Quando o jogo se chamava Flagle, as chaves eram `flagle_theme`,
`flagle_records` e `flagle_font`. Na primeira visita os valores antigos são
**copiados** para as chaves novas, e as antigas ficam intactas. Dá para
apagá-las no futuro, quando ninguém mais precisar delas.

## O que mudou no jogo original

O código do Flagle foi preservado. As mudanças foram:

- Separação em `index.html`, `style.css` e `game.js` e extração dos países.
- **Correção:** enviar o campo vazio deixava de parar o cronômetro por engano
  (o `clearInterval` rodava antes da checagem de campo vazio).
- **Correção:** apertar Enter em "Próxima Bandeira" rodava a ação duas vezes.
- Falha ao carregar uma bandeira não zera a pontuação e oferece
  "Tentar outra bandeira".
- Som criado só no primeiro clique (evita aviso do navegador).
- Dados: "Ilhas Feroe" em português, apelidos repetidos removidos e a capital
  da Bolívia mostrada como "Sucre / La Paz".
- Mensagens de resultado e dica anunciadas por leitores de tela.
- Nome provisório **Flag**, no lugar de "Flagle".

## Pontos em aberto (decisões do produto)

- Nome definitivo do jogo de bandeiras.
- Logotipo oficial no cabeçalho e favicon.
- Recorde por dificuldade, e não só por região.
- Cobertura de países (128 de ~195).
- Capitais controversas: a Bolívia aparece como "Sucre / La Paz" (capital
  constitucional e sede do governo) e Israel como "Jerusalém", que não é
  reconhecida como capital por todos os países. O jogo só usa a capital como
  dica, mas vale decidir o critério para os futuros jogos de capitais.

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
| `css/` | paleta, componentes da plataforma e `game-shell.css` (esqueleto comum dos jogos) | todas as páginas / jogos |
| `js/` | tema, idioma, fonte, catálogo e ponto de entrada da home | home (`theme.js`, `lang.js`, `font.js` e `i18n.js` também nos jogos) |
| `i18n/` | textos de cada idioma (`pt.json`, `en.json`, `es.json`, `zh.json`) | todas as páginas |
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
- A resposta vale **só no idioma em que se joga** (nome do país nesse idioma +
  apelidos em `aliases`/`aliasesByLang`), ignorando acentos e maiúsculas. Em
  inglês, "Suíça" está errado. Para todos os 128 países e 4 idiomas, o nome
  exibido é aceito, nomes de outros idiomas são rejeitados e nenhuma resposta
  aponta para dois países.
- Mandarim: só escrita simplificada; pinyin e caracteres tradicionais não são aceitos.
- O nome "Flag" e o slogan "Play the World" não são traduzidos de propósito.
- Fica em aberto: o `<noscript>` continua só em português.

### Estrutura e fonte compartilhadas pelos jogos

- `css/game-shell.css` guarda o que todo jogo tem igual: cartão central, botões
  do topo, janela de configurações, campos e botão principal. Cada jogo só
  escreve no `style.css` o que é dele.
- `js/font.js` (script comum na `<head>`) aplica o tamanho da fonte
  (`<html data-font>`) antes de a página aparecer e liga qualquer
  `<select data-font-select>`. A preferência vale para todos os jogos
  (`ggeo_font`); a antiga do Flag (`ggeo_flag_font`) é copiada uma vez.

### Sugestões ao digitar e sons (Flag e Rotas)

- `js/autocomplete.js`: lista de sugestões com mouse, setas ↑ ↓, Enter e Esc,
  no padrão *combobox* de acessibilidade. Escolher uma sugestão **já envia** o
  palpite (nos dois jogos). Procura no nome do idioma atual e nos apelidos
  ("usa" sugere United States), ignorando acentos.
- `js/sound.js`: sons gerados pelo navegador, um liga/desliga único (`ggeo_sound`).

### Rotas

- **Dados dentro do repositório.** O protótipo original buscava fronteiras e
  mapa em sites externos a cada partida e carregava o Tailwind e o d3 por CDN.
  Aqui tudo é local (`data/world-borders.json`, `data/world-map.json`,
  `js/vendor/d3.min.js`): o jogo não quebra se um desses sites cair, nem
  depende de terceiros para carregar.
- **Países:** os 193 membros da ONU. Fronteiras terrestres vêm do projeto
  *mledoze/countries* (ODbL); contornos, do *Natural Earth* (domínio público),
  simplificados para ~450 KB. Kosovo, Palestina, Taiwan, Saara Ocidental e
  territórios não são sorteados nem aparecem no globo. O Vaticano ficou de
  fora. A "fronteira" Índia–Sri Lanka foi removida (é marítima).
- **Regras:** origem e destino ficam a 4 a 7 fronteiras de distância; o limite
  de palpites é o mínimo necessário + 10. Verde = numa das menores rotas,
  amarelo = conectado, mas em desvio, cinza = ainda sem ligação com a origem.
  Ilhas sem fronteira (Japão, Austrália...) podem ser chutadas, mas nunca
  entram na rota.
- **Nomes e respostas** usam as mesmas regras do Flag (só o idioma atual vale;
  `country-names.js`). Países fora do `countries.json` usam o nome do navegador
  e não têm apelidos.
- **Mudanças em relação ao protótipo:** tela de derrota (antes o jogo
  simplesmente travava), rota ideal mostrada no fim, mensagens para palpite
  repetido/desconhecido, dica 3 também por toque (antes só passando o mouse),
  símbolos ✓ ~ ✕ além das cores, autocompletar acessível por teclado, globo
  centralizado entre origem e destino, cores que seguem o tema claro/escuro.
- **Sorteio com memória:** cada rodada escolhe entre todos os pares válidos
  (3.075), dando menos chance a quem tem países que apareceram há pouco. A
  memória decai a cada rodada e fica no `localStorage` (`ggeo_rotas_recent`).
  Assim passagens obrigatórias (Panamá, Rússia) não dominam, sem limitar
  quantas partidas a pessoa joga. Ajuste em `RECENT_DECAY` e `RECENT_PENALTY`.
- **Fim da rodada:** em vez de um quadro por cima de tudo (como no protótipo),
  busca, palpites e dicas dão lugar a um painel de resultado (palpites, falhas,
  um quadradinho por palpite, sua rota, uma rota ideal, jogar novamente e
  compartilhar, no estilo do Travle). O mapa fica livre: mostra todos os
  contornos e o nome de qualquer país ao passar o mouse/tocar.
- **Gestos no globo:** um dedo (ou o mouse) gira, dois dedos fazem pinça
  (Pointer Events, sem pointer capture para não atrapalhar o toque nos países);
  roda do mouse e botões + e − também funcionam.
- **Sons:** `js/sound.js`, gerados no navegador (sem arquivos de áudio), com
  liga/desliga em ⚙️. Compartilhado com o Flag.
- **Fica em aberto:** sem recorde/estatísticas e sem rota diária.

### Países em `data/countries.json`

A lista saiu do código do jogo para um arquivo de dados, porque o Rotas também
usa os mesmos nomes. O jogo carrega o arquivo com `fetch`,
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
| `ggeo_lang` | `pt`, `en`, `es` ou `zh` | só é gravada quando a pessoa escolhe no seletor |
| `ggeo_font` | `small`, `medium`, `large` ou `xlarge` | tamanho da fonte, único para todos os jogos |
| `ggeo_rotas_recent` | objeto `{país: peso}` | memória do sorteio de rotas (pode ser apagada sem problema) |
| `ggeo_sound` | `off` | só existe se a pessoa desligou os sons (ausente = ligado); vale para todos os jogos |
| `ggeo_flag_records` | recorde por região do jogo Flag | |
| `ggeo_flag_font` | (antiga) fonte do Flag | só lida uma vez: o valor é copiado para `ggeo_font` |

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

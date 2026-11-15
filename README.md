<p align="center">
  <img src="assets/logo-globe.svg" alt="Logotipo do GGEO: um globo feito de quadradinhos" width="140">
</p>

<h1 align="center">GGEO — Play the World</h1>

<p align="center">
  Jogos de geografia para testar o que você sabe sobre países, bandeiras e mapas.<br>
  <a href="https://ggeo.io"><strong>ggeo.io</strong></a>
</p>

---

Plataforma de jogos de geografia. Os jogos são gratuitos, rodam no navegador
(computador, tablet e celular) e vivem todos neste repositório. Disponível em
português, inglês, espanhol e mandarim (o idioma é escolhido pelo navegador).

Feito só com **HTML, CSS e JavaScript puro**: sem framework, sem build, sem
backend. Qualquer hospedagem de arquivos estáticos serve.

## Jogos

| Jogo | Pasta | Estado |
|------|-------|--------|
| Flag (adivinhe a bandeira) | `games/flag/` | disponível: desafio diário, clássico e Rush (1 minuto) |
| Rotas (caminho entre países) | `games/rotas/` | disponível: desafio diário e modo treino infinito |

- **Flag:** 133 países, com nomes aceitos só no idioma em que se joga.
- **Rotas:** 198 países; só contam fronteiras que se cruzam a pé (ponte vale,
  trem e balsa não).
- Os nomes ainda são provisórios.

## Rodar no seu computador

Os jogos carregam arquivos com `fetch` e usam módulos JavaScript, e os
navegadores bloqueiam isso quando a página é aberta com duplo clique
(`file://`). Por isso é preciso um servidor local, que é simples:

```bash
cd GGEO
python -m http.server 8000
```

Depois abra <http://localhost:8000>. Alternativa: extensão **Live Server** do
VS Code (botão direito em `index.html` → *Open with Live Server*).

## Como o projeto é organizado

```text
GGEO/
├── index.html              página inicial (catálogo de jogos)
├── assets/                 favicon, logotipo do globo, imagem de prévia e bandeiras (flags/)
├── tools/make-logo.js      gera os SVGs do globo (node tools/make-logo.js)
├── tools/add-missing-map.py  acrescentou ao mapa os países que faltavam (uso único)
├── sitemap.xml, robots.txt   para os buscadores
├── wrangler.jsonc          configuração da publicação na Cloudflare
├── .assetsignore           o que NÃO vai ao ar na Cloudflare (docs, tools…)
├── css/
│   ├── main.css            paleta, tema claro/escuro e base (todas as páginas)
│   ├── components.css      cabeçalho, botões e cartões da plataforma
│   └── game-shell.css      esqueleto comum dos jogos (cartão, botões do topo, configurações)
├── js/
│   ├── theme.js            tema claro/escuro (todas as páginas)
│   ├── font.js             tamanho da fonte, preferência única dos jogos
│   ├── sound.js            efeitos sonoros (e o liga/desliga) compartilhados pelos jogos
│   ├── autocomplete.js     sugestões de países enquanto digita (Flag e Rotas)
│   ├── share.js            copiar o resultado para compartilhar (Flag e Rotas)
│   ├── lang.js             escolhe o idioma antes da página aparecer
│   ├── i18n.js             carrega os textos e troca o idioma
│   ├── country-names.js    nomes de países/capitais por idioma e validação das respostas
│   ├── games.js            LISTA dos jogos do catálogo
│   ├── catalog.js          desenha os cartões a partir da lista
│   ├── main.js             ponto de entrada da página inicial
│   └── vendor/d3.min.js    biblioteca d3 (globo do Rotas), guardada aqui de propósito
├── i18n/
│   ├── pt.json             textos em português (referência)
│   ├── en.json             textos em inglês
│   ├── es.json             textos em espanhol
│   └── zh.json             textos em mandarim
├── data/
│   ├── countries.json      países do Flag: nomes, capitais, apelidos
│   ├── world-borders.json  198 países e suas fronteiras terrestres (Rotas)
│   └── world-map.json      contornos dos países para o globo (Rotas)
├── games/
│   ├── flag/               um jogo = uma pasta independente
│   │   ├── index.html
│   │   ├── style.css
│   │   └── game.js
│   └── rotas/              idem
└── docs/
    └── project-structure.md   explicação detalhada das decisões
```

Detalhes e o porquê de cada escolha estão em
[`docs/project-structure.md`](docs/project-structure.md).

## Tarefas comuns

### Mudar uma cor da marca

Edite só os valores `--ggeo-*` no começo de `css/main.css`. Superfícies,
bordas e textos secundários são calculados a partir deles e acompanham.
O tema escuro está em `:root`; o claro sobrescreve só o que difere em
`:root[data-theme="light"]`.

### Adicionar um jogo

1. Crie `games/<id>/index.html` (copie a estrutura de `games/flag/`).
2. Na `<head>`, importe o que é compartilhado (o `lang.js` vem antes do `theme.js`):
   ```html
   <script src="../../js/lang.js"></script>
   <script src="../../js/font.js"></script>
   <script src="../../js/theme.js"></script>
   <link rel="stylesheet" href="../../css/main.css">
   <link rel="stylesheet" href="../../css/game-shell.css">
   ```
   Os botões do topo (idioma, tema, ⚙️ com tamanho da fonte e sons) são os
   mesmos do Flag: copie o bloco `top-controls` e o `settings-modal` do
   `games/flag/index.html`. Sons: `import { playSound } from '../../js/sound.js'`;
   sugestões ao digitar: `createAutocomplete` de `js/autocomplete.js`.
3. Acrescente um item em `js/games.js` com `status: 'available'`.
4. Acrescente `games.<id>.name` e `games.<id>.description` em cada arquivo de `i18n/`.

A home mostra o novo cartão sozinha. Use `../../` para chegar à raiz a partir
de `games/<id>/` e **nunca** caminhos que começam com `/`: eles quebram quando o
site é publicado numa subpasta (como no GitHub Pages).

### Idiomas

O site tem um seletor de idioma (🌐) ao lado do botão de tema, na home, e no
topo do jogo Flag, junto do botão de configurações. Cada idioma aparece com o
próprio nome: **Português**, **English**, **Español**, **中文** (mandarim simplificado).

- **Primeira visita:** o site usa o idioma do navegador, se for um dos
  suportados, e senão o português. Para desligar isso e começar sempre em
  português, mude a função de escolha em `js/lang.js`.
- **Escolha salva** em `localStorage` (`ggeo_lang`) e vale para todas as páginas.
- Textos ficam em `i18n/<codigo>.json`; o português é a referência e serve de
  reserva se faltar uma chave em outro idioma.
- Nos HTMLs, o texto escrito é o português padrão; elementos com
  `data-i18n="chave"` (ou `data-i18n-attr="placeholder:chave"`) são traduzidos.
  No JavaScript use `t('chave', { parametro })` de `js/i18n.js`.
- **Países:** o nome vem do próprio navegador (`Intl.DisplayNames`), sem lista
  manual. As capitais ficam em `capitals` no `countries.json` (em português,
  inglês, espanhol e chinês).
- **Resposta no jogo:** vale só o idioma em que se está jogando. Em inglês,
  "Suíça" está errado e "Switzerland" está certo; em chinês, vale "瑞士".
  Apelidos aceitos ("USA", "UK", "EE.UU.", "阿联酋"...) ficam em `aliases`
  (português) e `aliasesByLang` (`en`, `es`, `zh`).
- Os textos em inglês, espanhol e chinês foram escritos por mim (IA) e **vale
  uma revisão de falantes nativos**, principalmente as capitais. No chinês,
  só vale a escrita simplificada (繁體 e pinyin não são aceitos).

**Adicionar um idioma (o mandarim foi feito assim):**

1. Copie `i18n/en.json` para `i18n/<codigo>.json` e traduza os valores (não as chaves).
2. Em `js/lang.js`, acrescente na lista `{ code: 'zh', name: '中文', tag: 'zh-Hans' }`.
3. Em `data/countries.json`, acrescente o idioma em `capitals` de cada país (sem
   isso a dica mostra a capital em português) e, se quiser, apelidos em
   `aliasesByLang`.

### Corrigir ou acrescentar países

Edite `data/countries.json` (um país por linha). Campos: `name`, `code`
(ISO 3166-1 alfa-2 minúsculo, usado para buscar a bandeira), `continent`,
`capital` (português), `capitals` (capital em `en`, `es`, `zh`; só onde difere do
português, exceto `zh`, que tem todas), `aliases` (outras grafias aceitas em
português, sem acento e em minúsculas) e `aliasesByLang` (o mesmo para `en`,
`es`, `zh`).

## Publicação

O site é só uma pasta de arquivos: não há etapa de build. Hoje ele está no
ar em **<https://ggeo.io>**, na Cloudflare, ligado a este repositório: cada
`git push` na branch `main` publica sozinho em um ou dois minutos.

**Cloudflare (como está hoje)**

- `wrangler.jsonc` diz que o projeto é um site estático servido da raiz, e o
  `.assetsignore` deixa de fora o que não deve ir ao ar (`docs`, `tools`, `README`).
- Domínio: aba *Domains* / *Custom domains* do projeto, com `ggeo.io` e `www.ggeo.io`.

**Outras hospedagens** (GitHub Pages, Cloudflare Pages…) também servem: é só
apontar para a pasta raiz, sem comando de build.

**Ao mudar de endereço**, troque as URLs absolutas de `og:url` e `og:image`
nas três páginas (`index.html`, `games/flag/index.html`, `games/rotas/index.html`)
e no `sitemap.xml`/`robots.txt`.

Não há segredos no projeto. As bandeiras ficam no próprio site
(`assets/flags/`, SVG do projeto country-flags, proporção real de cada bandeira), sem depender de
serviços externos.

## Testes

Ainda não há testes automatizados no repositório. A cada mudança, o fluxo foi
verificado com scripts de navegador (Playwright, **Google Chrome**) fora do
repositório: abertura das páginas, navegação, tema, troca de idioma e nomes
aceitos por idioma, desafio diário e Rush do Flag, desafio diário e treino do
Rotas, regras de fronteira, persistência, publicação em subpasta e console sem
erros, em celular e desktop.

**Não testado:** Firefox e Safari. Vale abrir o site neles.

## Próximos passos possíveis

Decisões de produto são suas:

- Escolher o nome definitivo do Flag e do Rotas.
- Recorde separado por dificuldade no Flag (hoje é só por região).
- Completar a lista de países do Flag para todos os 198 (hoje 133).
- Páginas por idioma (`/en/`, `/es/`, `/zh/`) para os buscadores.
- Um futuro Rotas com oceanos.
- Só depois: contas, ranking, apoio voluntário.

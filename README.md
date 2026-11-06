# GGEO — Play the World

Plataforma de jogos de geografia. Os jogos são gratuitos, rodam no navegador
(computador, tablet e celular) e vivem todos neste repositório.

Feito só com **HTML, CSS e JavaScript puro**: sem framework, sem build, sem
backend. Qualquer hospedagem de arquivos estáticos serve.

## Jogos

| Jogo | Pasta | Estado |
|------|-------|--------|
| Flag (adivinhe a bandeira) | `games/flag/` | disponível |
| Rotas (caminho entre países) | `games/rotas/` | planejado |

Os nomes ainda são provisórios.

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
├── css/
│   ├── main.css            paleta, tema claro/escuro e base (todas as páginas)
│   └── components.css      cabeçalho, botões e cartões da plataforma
├── js/
│   ├── theme.js            tema claro/escuro (todas as páginas)
│   ├── games.js            LISTA dos jogos do catálogo
│   ├── catalog.js          desenha os cartões a partir da lista
│   └── main.js             ponto de entrada da página inicial
├── data/
│   └── countries.json      países (compartilhado entre os jogos)
├── games/
│   └── flag/               um jogo = uma pasta independente
│       ├── index.html
│       ├── style.css
│       └── game.js
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
2. Na `<head>`, importe o que é compartilhado:
   ```html
   <script src="../../js/theme.js"></script>
   <link rel="stylesheet" href="../../css/main.css">
   ```
3. Acrescente um item em `js/games.js` com `status: 'available'`.

A home mostra o novo cartão sozinha. Use `../../` para chegar à raiz a partir
de `games/<id>/` e **nunca** caminhos que começam com `/`: eles quebram quando o
site é publicado numa subpasta (como no GitHub Pages).

### Corrigir ou acrescentar países

Edite `data/countries.json` (um país por linha). Campos: `name`, `code`
(ISO 3166-1 alfa-2 minúsculo, usado para buscar a bandeira), `continent`,
`capital` e `aliases` (outras grafias aceitas, sem acento e em minúsculas).

## Publicação

O site é só uma pasta de arquivos: não há etapa de build.

**GitHub Pages**

1. No repositório: *Settings → Pages*.
2. *Source*: **Deploy from a branch**; branch `main`, pasta `/ (root)`.
3. Aguarde alguns minutos. O endereço será
   `https://<usuario>.github.io/GGEO/`.

**Cloudflare Pages**

1. *Workers & Pages → Create → Pages → Connect to Git* e escolha o repositório.
2. *Build command*: deixe vazio. *Build output directory*: `/` (raiz).
3. Para domínio próprio, use a aba *Custom domains*.

Os passos acima descrevem os painéis como eu os conheço; os nomes dos menus
podem mudar um pouco.

Não há segredos no projeto. As bandeiras vêm de `flagcdn.com`, então o jogo
precisa de internet para mostrá-las.

## Testes

Ainda não há testes automatizados no repositório. Na construção da base, estes
pontos foram verificados à mão no **Google Chrome** (celular e desktop, tema
claro e escuro, e publicação em subpasta): abertura das páginas, navegação
home ↔ jogo, tema e sua persistência, cronômetro, validação de respostas,
dicas, pontuação, recordes, migração dos dados do antigo Flagle, falha ao
carregar bandeira e console sem erros.

**Não testado:** Firefox e Safari. Vale abrir o site neles antes de divulgar.

## Próximos passos possíveis

Nada disso está feito, e as decisões de produto são suas:

- Escolher o nome definitivo do Flag e criar o jogo Rotas.
- Usar o logotipo oficial (hoje o cabeçalho tem a palavra GGEO em texto) e um
  favicon.
- Recorde separado por dificuldade (hoje é só por região).
- Completar a lista de países (hoje 128 de ~195).
- Só depois: contas, ranking, desafios diários, apoio voluntário.

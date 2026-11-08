/*
 * Catálogo de jogos da GGEO.
 *
 * Para ADICIONAR um jogo novo:
 *   1. crie a pasta games/<id>/ com um index.html;
 *   2. acrescente um item na lista abaixo;
 *   3. acrescente games.<id>.name e games.<id>.description em cada i18n/*.json.
 * A home monta os cartões sozinha a partir desta lista.
 *
 * Campos:
 *   id          nome curto, igual ao da pasta em games/
 *   (nome e descrição do cartão ficam em i18n/<idioma>.json, nas chaves
 *    games.<id>.name e games.<id>.description; os nomes ainda são PROVISÓRIOS)
 *   path        caminho do jogo, relativo à raiz do site (sem "/" no começo)
 *   status      "available" (jogável) ou "soon" (em breve)
 *   icon        SVG simples; usa currentColor, então acompanha o tema
 */

const ICON_FLAG = `
<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor"
     stroke-width="1.75" stroke-linecap="square" aria-hidden="true">
  <path d="M5 21V3"/><path d="M5 4h14l-3.5 4.5L19 13H5"/>
</svg>`;

const ICON_ROUTE = `
<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor"
     stroke-width="1.75" stroke-linecap="square" aria-hidden="true">
  <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="5.5" r="2.5"/>
  <path d="M8 18.5h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/>
</svg>`;

export const games = [
    {
        id: 'flag',
        path: 'games/flag/index.html',
        status: 'available',
        icon: ICON_FLAG,
    },
    {
        id: 'rotas',
        path: 'games/rotas/index.html',
        status: 'available',
        icon: ICON_ROUTE,
    },
];

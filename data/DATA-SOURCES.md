# Fontes dos dados do Rotas

- `world-borders.json`: fronteiras terrestres derivadas de **mledoze/countries**
  (https://github.com/mledoze/countries), licença **ODbL**. Este arquivo
  derivado também segue a ODbL: ao reutilizar, mantenha esta atribuição.
  Ajustes nossos: os 193 membros da ONU + Kosovo, Taiwan, Palestina, Saara
  Ocidental e Vaticano (198); relações simetrizadas; removidas a
  ligação marítima Índia–Sri Lanka e as ligações que só existem por Kaliningrado
  (Rússia–Polônia e Rússia–Lituânia), além de Espanha–Marrocos (Ceuta e
  Melilla) e Azerbaijão–Turquia (Nakhchivan): não dá para cruzá-las por terra
  a partir do resto do país. Os territórios ultramarinos da França (Guiana
  Francesa, Guadalupe, Martinica, Reunião, Mayotte) e das Antilhas Holandesas
  continuam desenhados no mapa, mas como terra neutra, sem fazer parte do país.
  Regra: duas fronteiras se ligam se dá para cruzar de um país ao outro a pé,
  inclusive por ponte (Dinamarca–Suécia, Bahrein–Arábia Saudita,
  Singapura–Malásia). Trem, túnel de trem e balsa não contam
  (França–Reino Unido). Dentro de um país, vale ir de qualquer vizinho a
  qualquer outro (ex.: Timor-Leste → Indonésia → Malásia). O campo opcional
  `parts` (vizinhos por pedaço de terra) existe no código, mas hoje não é usado.
  Novas ligações: Kosovo–(Albânia, Macedônia do Norte, Montenegro, Sérvia),
  Saara Ocidental–(Marrocos, Argélia, Mauritânia), Palestina–(Israel, Jordânia,
  Egito), Vaticano–Itália. Pontes, túneis e balsas (Dinamarca–Suécia,
  França–Reino Unido) não contam: só terra.
- `world-map.json`: contornos do **Natural Earth** (1:50m, domínio público,
  https://www.naturalearthdata.com), simplificados e reduzidos de tamanho. `tools/add-missing-map.py` acrescentou
  os países que faltavam; Somalilândia, Chipre do Norte, Hong Kong, Macau e Åland
  foram fundidos ao país de origem, e o resto (Groenlândia etc.) virou terra neutra.
- `../js/vendor/d3.min.js`: **d3** v7 (licença ISC, ver `d3-LICENSE.txt`).

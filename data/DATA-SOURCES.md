# Fontes dos dados do Rotas

- `world-borders.json`: fronteiras terrestres derivadas de **mledoze/countries**
  (https://github.com/mledoze/countries), licença **ODbL**. Este arquivo
  derivado também segue a ODbL: ao reutilizar, mantenha esta atribuição.
  Ajustes nossos: só os 193 membros da ONU; relações simetrizadas; removidas a
  ligação marítima Índia–Sri Lanka e as ligações que só existem por Kaliningrado
  (Rússia–Polônia e Rússia–Lituânia), além de Espanha–Marrocos (Ceuta e
  Melilla) e Azerbaijão–Turquia (Nakhchivan): não dá para cruzá-las por terra
  a partir do resto do país. Os territórios ultramarinos da França (Guiana
  Francesa, Guadalupe, Martinica, Reunião, Mayotte) e das Antilhas Holandesas
  continuam desenhados no mapa, mas como terra neutra, sem fazer parte do país.
- `world-map.json`: contornos do **Natural Earth** (1:50m, domínio público,
  https://www.naturalearthdata.com), simplificados e reduzidos de tamanho.
- `../js/vendor/d3.min.js`: **d3** v7 (licença ISC, ver `d3-LICENSE.txt`).

/*
 * Gera js/globe-data.js: os quadradinhos de terra do globo 3D da página inicial.
 * Uso:  node tools/make-globe-data.js
 *
 * É o mesmo método do logotipo (tools/make-logo.js): uma grade de latitude e
 * longitude, e cada célula cuja posição central cai em terra vira um quadradinho.
 * Perto dos polos as células ficam mais largas em longitude para continuarem
 * quase quadradas na esfera. A Antártida é aproximada à mão (o mapa do jogo só
 * tem países).
 *
 * Fica em tools/ (fora do site publicado): o navegador só carrega o resultado,
 * então a home não precisa do d3 nem do mapa inteiro.
 */
const fs = require('fs');
const path = require('path');
const d3 = require('../js/vendor/d3.min.js');
const root = path.join(__dirname, '..');
const land = JSON.parse(fs.readFileSync(path.join(root, 'data/world-map.json'), 'utf8'));

const STEP = 5; // graus por célula (o logotipo usa 7; um pouco menor dá mais definição num globo grande)

function antarctica(lon, lat) {
    const edge = -67 + 3 * Math.sin(lon * Math.PI / 60) + 2 * Math.sin(lon * Math.PI / 25);
    let e = edge;
    const dLon = Math.abs(((lon + 60 + 540) % 360) - 180);   // distância até -60°
    if (dLon < 14) e += (14 - dLon) * 0.55;                    // Península
    return lat < e;
}
const isLand = (lon, lat) => antarctica(lon, lat) || d3.geoContains(land, [lon, lat]);

// Larguras possíveis (em graus) que dividem os 360° exatamente, para a linha fechar sem sobra.
const WIDTHS = [5, 6, 8, 9, 10, 12, 15, 18, 20, 24, 30, 36, 40, 45, 60, 72, 90, 120, 180];

// Largura da célula numa latitude: a maior que ainda não passa de um quadrado na esfera
// (STEP / cos(lat), pois os meridianos se aproximam perto dos polos).
function widthAt(lat) {
    const square = STEP / Math.cos(lat * Math.PI / 180);
    let best = WIDTHS[0];
    for (const w of WIDTHS) if (w <= square * 1.12) best = w;
    return best;
}

const rows = [];
let total = 0;
for (let lat = -90 + STEP / 2; lat < 90; lat += STEP) {
    const lonStep = widthAt(lat);
    const lons = [];
    for (let lon = -180 + lonStep / 2; lon < 180; lon += lonStep) {
        if (isLand(lon, lat)) lons.push(lon);
    }
    if (lons.length) {
        rows.push([lat, lonStep, lons]);
        total += lons.length;
    }
}

const body = rows.map(([lat, lonStep, lons]) => `    [${lat}, ${lonStep}, [${lons.join(',')}]],`).join('\n');
fs.writeFileSync(path.join(root, 'js/globe-data.js'),
`/*
 * GERADO por tools/make-globe-data.js — não edite à mão.
 * Quadradinhos de terra do globo 3D: [latitude central, largura em graus, [longitudes centrais]].
 * STEP é a altura de cada célula em graus.
 */
export const STEP = ${STEP};
export const ROWS = [
${body}
];
`);
console.log('células de terra:', total, '| linhas:', rows.length);

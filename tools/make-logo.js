/*
 * Gera os desenhos do globo (favicon e logo) em assets/*.svg.
 * Uso:  node tools/make-logo.js
 * Vista de baixo (polo sul), continentes feitos de quadradinhos que seguem a curvatura.
 * Usa o d3 e os contornos que já estão no projeto (Antártida é aproximada à mão,
 * pois o mapa do jogo só tem países).
 */
const fs = require('fs');
const path = require('path');
const d3 = require('../js/vendor/d3.min.js');
const root = path.join(__dirname, '..');
const land = JSON.parse(fs.readFileSync(path.join(root, 'data/world-map.json'), 'utf8'));

// Antártida aproximada: uma borda irregular ao redor do polo + a Península.
function antarctica(lon, lat) {
    const edge = -67 + 3 * Math.sin(lon * Math.PI / 60) + 2 * Math.sin(lon * Math.PI / 25);
    let e = edge;
    const dLon = Math.abs(((lon + 60 + 540) % 360) - 180);   // distância até -60°
    if (dLon < 14) e += (14 - dLon) * 0.55;                    // Península
    return lat < e;
}
const isLand = (lon, lat) => antarctica(lon, lat) || d3.geoContains(land, [lon, lat]);

function build({ size, step, shrink, rotate, lineW, outlineW, colors, rows }) {
    const r = size / 2 - outlineW;
    const projection = d3.geoOrthographic().rotate(rotate).scale(r).translate([size / 2, size / 2]).clipAngle(90);
    const pathGen = d3.geoPath(projection);
    let cells = '';
    for (let lat = -90 + step / 2; lat < 90; lat += step) {
        const lonStep = Math.abs(lat) > 75 ? step * 3 : Math.abs(lat) > 60 ? step * 1.5 : step;
        for (let lon = -180 + lonStep / 2; lon < 180; lon += lonStep) {
            if (!isLand(lon, lat)) continue;
            const c = projection([lon, lat]);
            const vis = d3.geoDistance([lon, lat], [-rotate[0], -rotate[1]]) < 1.45;
            if (!c || !vis) continue;
            const hw = lonStep / 2 * shrink, hh = step / 2 * shrink;
            const ring = [[lon - hw, lat - hh], [lon - hw, lat + hh], [lon + hw, lat + hh], [lon + hw, lat - hh], [lon - hw, lat - hh]];   // sentido que o d3 espera
            const poly = { type: 'Polygon', coordinates: [ring] };
            cells += pathGen(poly) ? `<path d="${pathGen(poly)}"/>` : '';
        }
    }
    const grat = d3.geoGraticule().step([step, step]).extent([[-180, -88], [180, 88]]);
    return `<g fill="${colors.land}">${cells}</g>
${lineW ? `<path d="${pathGen(grat())}" fill="none" stroke="${colors.line}" stroke-width="${lineW}"/>` : ''}
<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${colors.outline}" stroke-width="${outlineW}"/>`;
}

const palette = { land: '#FF7700', line: '#E6D4BF', outline: '#E6D4BF' };

// Favicon: fundo preto arredondado + globo simples (poucos detalhes para ler em 16 px)
const fav = build({ size: 64, step: 8, shrink: 0.9, rotate: [20, 38, 0], lineW: 0, outlineW: 3, colors: palette });
fs.writeFileSync(path.join(root, 'assets/favicon.svg'),
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
<rect width="64" height="64" rx="14" fill="#000"/>
<g transform="translate(5.6 5.6) scale(0.825)">${fav}</g>
</svg>
`);

// Logo grande (usado na imagem de prévia)
const big = build({ size: 600, step: 7, shrink: 0.76, rotate: [20, 38, 0], lineW: 1.2, outlineW: 4, colors: palette });
fs.writeFileSync(path.join(root, 'assets/logo-globe.svg'),
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">${big}</svg>
`);
console.log('ok');

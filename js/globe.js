/*
 * Globo 3D da página inicial (Hero).
 *
 * Por que não Three.js/WebGL: o globo é só ~500 quadradinhos e algumas linhas.
 * Três.js pesa centenas de KB e abre um contexto WebGL (caro em celular fraco);
 * aqui cada quadradinho tem latitude e longitude de verdade, é girado em 3D e
 * projetado numa esfera (projeção ortográfica) com iluminação por face. O
 * resultado é o mesmo efeito com ~8 KB e Canvas 2D comum.
 *
 * Os quadradinhos vêm de js/globe-data.js (gerado por tools/make-globe-data.js,
 * com o mesmo método da logo). Cores vêm das variáveis do tema (--accent, --fg,
 * --bg), então acompanham claro/escuro. Nada aqui mexe em jogos, idiomas ou tema.
 *
 * Cuidados com desempenho e acessibilidade:
 *  - só começa quando o navegador está ocioso (não atrasa o primeiro desenho);
 *  - para sozinho quando a aba fica escondida ou o globo sai da tela;
 *  - com "reduzir movimento" ligado, desenha um quadro parado e não anima;
 *  - é decorativo: o canvas fica escondido de leitores de tela.
 */
import { STEP, ROWS } from './globe-data.js';

const DEG = Math.PI / 180;

/* ---------- Ajustes (mexa aqui para refinar o visual) ---------- */
const SPEED = 5;              // rotação, em graus por segundo (uma volta em ~72 s)
const START_LON = -45;        // longitude no centro ao abrir (e no quadro parado)
const TILT = 22 * DEG;        // inclinação do eixo: o polo norte "vira" para quem olha
const SHRINK = 0.78;          // tamanho do quadradinho dentro da célula (igual ao da logo)
const LINE_STEP = 10;         // graus entre as linhas de latitude e longitude
const RADIUS = 0.42;          // raio do globo, como fração do lado do canvas (o resto é brilho)
const BUCKETS = 14;           // níveis de brilho dos quadradinhos (agrupa os desenhos por cor)
const MAX_PIXELS = 1400;      // limite do lado do canvas em pixels reais

// Luz principal: vem de cima, da esquerda e de frente (x para a direita, y para cima, z para quem olha).
const LIGHT = (() => {
    const v = [-0.5, 0.5, 0.7];
    const n = Math.hypot(...v);
    return v.map((c) => c / n);
})();

/* ---------- Geometria pré-calculada (uma vez) ---------- */
// Cada ponto guarda [cos(lat), sen(lat), sen(lon), cos(lon)]; girar o globo vira só multiplicações.
const pointData = (latDeg, lonDeg) => [Math.cos(latDeg * DEG), Math.sin(latDeg * DEG), Math.sin(lonDeg * DEG), Math.cos(lonDeg * DEG)];

const cells = [];   // por célula: centro + 4 cantos (Float32Array de 5 pontos × 4 números)
for (const [lat, width, lons] of ROWS) {
    const hh = (STEP / 2) * SHRINK;
    const hw = (width / 2) * SHRINK;
    for (const lon of lons) {
        const points = [
            pointData(lat, lon),
            pointData(lat - hh, lon - hw), pointData(lat + hh, lon - hw),
            pointData(lat + hh, lon + hw), pointData(lat - hh, lon + hw),
        ];
        cells.push(Float32Array.from(points.flat()));
    }
}

const lines = []; // meridianos e paralelos como listas de pontos
for (let lon = 0; lon < 360; lon += LINE_STEP) {
    const pts = [];
    for (let lat = -90; lat <= 90; lat += 3) pts.push(...pointData(lat, lon));
    lines.push(Float32Array.from(pts));
}
for (let lat = -90 + LINE_STEP; lat < 90; lat += LINE_STEP) {
    const pts = [];
    for (let lon = 0; lon <= 360; lon += 3) pts.push(...pointData(lat, lon));
    lines.push(Float32Array.from(pts));
}

/* ---------- Projeção ---------- */
const cosA = Math.cos(TILT);
const sinA = Math.sin(TILT);
let vx = 0, vy = 0, vz = 0; // resultado de project(): x e y na tela (-1..1) e profundidade z (>0 = de frente)

function project(data, i, cosT, sinT) {
    const cp = data[i], sp = data[i + 1], sl = data[i + 2], cl = data[i + 3];
    const z0 = cp * (cl * cosT + sl * sinT); // gira em torno do eixo (longitude - theta)
    vx = cp * (sl * cosT - cl * sinT);
    vy = sp * cosA - z0 * sinA;              // inclina o eixo para o observador
    vz = sp * sinA + z0 * cosA;
}

/* ---------- Cores (do tema) ---------- */
function parseColor(text) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(text).trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

function readTheme() {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    const pick = (name, fallback) => parseColor(style.getPropertyValue(name)) || fallback;
    return {
        accent: pick('--accent', [255, 119, 0]),
        fg: pick('--fg', [230, 212, 191]),
        light: root.getAttribute('data-theme') === 'light',
    };
}

/* ---------- Globo ---------- */
export function initGlobe(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let size = 0, radius = 0, center = 0;
    let theme = readTheme();
    let styles = null;
    let theta = START_LON * DEG;
    let frameId = 0, lastTime = 0, onScreen = true;

    // Reaproveitados a cada quadro (evita criar objetos 60 vezes por segundo).
    const px = new Float32Array(cells.length * 4);
    const py = new Float32Array(cells.length * 4);
    const level = new Int8Array(cells.length);

    function buildStyles() {
        const { accent, fg, light } = theme;
        const bucketColors = [];
        for (let b = 0; b < BUCKETS; b++) {
            const s = (b + 0.5) / BUCKETS;
            // Nos quadradinhos mais iluminados o laranja esquenta um pouco para o bege (só no escuro).
            const color = light ? accent : mix(accent, fg, 0.3 * s * s * s);
            bucketColors.push(rgba(color, Math.max(0.1, s)));
        }

        const c = center, R = radius;
        const halo = ctx.createRadialGradient(c, c, R * 0.92, c, c, R * 1.22);
        halo.addColorStop(0, rgba(accent, light ? 0.2 : 0.24));
        halo.addColorStop(1, rgba(accent, 0));

        const body = ctx.createRadialGradient(c + LIGHT[0] * R * 0.5, c - LIGHT[1] * R * 0.5, R * 0.05, c, c, R);
        body.addColorStop(0, rgba(accent, light ? 0.2 : 0.16));
        body.addColorStop(0.55, rgba(accent, 0.05));
        body.addColorStop(1, rgba(fg, 0.03));

        // Fio de luz laranja no contorno, mais forte do lado da luz.
        const m = Math.hypot(LIGHT[0], LIGHT[1]);
        const dx = (LIGHT[0] / m) * R, dy = (-LIGHT[1] / m) * R;
        const rim = ctx.createLinearGradient(c + dx, c + dy, c - dx, c - dy);
        rim.addColorStop(0, rgba(accent, 0.95));
        rim.addColorStop(0.55, rgba(accent, 0.2));
        rim.addColorStop(1, rgba(accent, 0.05));

        styles = {
            bucketColors, halo, body, rim,
            grid: rgba(fg, light ? 0.13 : 0.13),
            outline: rgba(fg, 0.3),
        };
    }

    function drawCells(cosT, sinT) {
        const [lx, ly, lz] = LIGHT;
        for (let i = 0; i < cells.length; i++) {
            const data = cells[i];
            project(data, 0, cosT, sinT);
            if (vz < 0.04) { level[i] = -1; continue; } // atrás do globo (ou quase no horizonte)

            // Iluminação: quanto a face está voltada para a luz. O brilho some perto do horizonte.
            const diffuse = Math.max(0, vx * lx + vy * ly + vz * lz);
            const fade = vz > 0.3 ? 1 : (vz - 0.04) / 0.26;
            const brightness = (0.28 + 0.72 * Math.pow(diffuse, 0.85)) * fade;
            level[i] = Math.min(BUCKETS - 1, Math.floor(brightness * BUCKETS));

            for (let k = 0; k < 4; k++) {
                project(data, 4 * (k + 1), cosT, sinT);
                let x = vx, y = vy;
                if (vz < 0) { const m = Math.hypot(x, y) || 1; x /= m; y /= m; } // canto atrás do horizonte: gruda na borda
                px[i * 4 + k] = center + radius * x;
                py[i * 4 + k] = center - radius * y;
            }
        }

        for (let b = 0; b < BUCKETS; b++) {
            ctx.beginPath();
            let any = false;
            for (let i = 0; i < cells.length; i++) {
                if (level[i] !== b) continue;
                any = true;
                const o = i * 4;
                ctx.moveTo(px[o], py[o]);
                ctx.lineTo(px[o + 1], py[o + 1]);
                ctx.lineTo(px[o + 2], py[o + 2]);
                ctx.lineTo(px[o + 3], py[o + 3]);
                ctx.closePath();
            }
            if (any) {
                ctx.fillStyle = styles.bucketColors[b];
                ctx.fill();
            }
        }
    }

    function drawGrid(cosT, sinT) {
        ctx.beginPath();
        for (const line of lines) {
            let pen = false;
            for (let i = 0; i < line.length; i += 4) {
                project(line, i, cosT, sinT);
                if (vz > 0) {
                    const x = center + radius * vx, y = center - radius * vy;
                    if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); pen = true; }
                } else {
                    pen = false;
                }
            }
        }
        ctx.strokeStyle = styles.grid;
        ctx.lineWidth = Math.max(1, size / 900);
        ctx.stroke();
    }

    function draw() {
        if (!size) return;
        const cosT = Math.cos(theta), sinT = Math.sin(theta);
        ctx.clearRect(0, 0, size, size);

        ctx.fillStyle = styles.halo;
        ctx.fillRect(0, 0, size, size);

        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.fillStyle = styles.body;
        ctx.fill();

        drawGrid(cosT, sinT);
        drawCells(cosT, sinT);

        const line = Math.max(1, size / 700);
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.lineWidth = line;
        ctx.strokeStyle = styles.outline;
        ctx.stroke();
        ctx.lineWidth = line * 1.7;
        ctx.strokeStyle = styles.rim;
        ctx.stroke();
    }

    function resize() {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const next = Math.min(MAX_PIXELS, Math.round(rect.width * dpr));
        if (next === size) return;
        size = canvas.width = canvas.height = next;
        center = size / 2;
        radius = size * RADIUS;
        buildStyles();
        draw();
    }

    function tick(now) {
        frameId = requestAnimationFrame(tick);
        const dt = Math.min(64, now - lastTime); // depois de uma pausa, não dá um salto
        lastTime = now;
        theta -= SPEED * DEG * dt / 1000;        // a superfície passa da esquerda para a direita, como a Terra
        draw();
    }

    function start() {
        if (frameId || !onScreen || document.hidden || reduceMotion.matches) return;
        lastTime = performance.now();
        frameId = requestAnimationFrame(tick);
    }

    function stop() {
        cancelAnimationFrame(frameId);
        frameId = 0;
    }

    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        onScreen ? start() : stop();
    }).observe(canvas);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    reduceMotion.addEventListener('change', () => { if (reduceMotion.matches) { stop(); draw(); } else start(); });
    document.addEventListener('ggeo:themechange', () => {
        theme = readTheme();
        if (size) { buildStyles(); draw(); }
    });

    resize();
    canvas.parentElement?.classList.add('is-ready'); // libera a entrada suave (CSS)
    start();
}

/* ---------- Início ---------- */
const canvas = document.querySelector('[data-globe]');
if (canvas) {
    // Espera o navegador ficar ocioso: o texto do Hero aparece antes e o globo entra em seguida.
    const run = () => initGlobe(canvas);
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 1200 });
    else setTimeout(run, 80);
}

// Revelação por cores do Desafio diário do Flag.
//
// A bandeira do dia fica escondida. Cada palpite é "sobreposto" a ela: onde a bandeira
// palpitada tem, na mesma posição, uma cor parecida com a da bandeira do dia, aquele
// pedaço aparece. A porcentagem de cada palpite é a fatia da bandeira que ele revelou.
//
// Como funciona (tudo no navegador, sem servidor):
//   1. Cada bandeira é desenhada num canvas (a palpitada é esticada ao tamanho da do dia)
//      e reduzida a poucas cores (a "paleta"): cada pixel vira a cor mais próxima da paleta,
//      o que evita bordas serrilhadas.
//   2. Em cada posição, se as duas cores forem "parecidas", o pixel é revelado.
//   3. A revelação só cresce: soma de todos os palpites.

const WIDTH = 480;              // largura de análise e de desenho (a altura segue a proporção)
const MIN_SHARE = 0.012;        // uma cor precisa cobrir 1,2% da bandeira para entrar na paleta
const MERGE_DISTANCE = 52;      // cores mais próximas que isso são consideradas a mesma
export const MATCH_DISTANCE = 50;   // distância máxima para "mesma cor" entre duas bandeiras (laranja ≈ amarelo, verde ≈ verde)

// Distância entre cores (RGB ponderado, "redmean": perto da percepção humana).
export function colorDistance(a, b) {
    const rMean = (a[0] + b[0]) / 2;
    const dr = a[0] - b[0];
    const dg = a[1] - b[1];
    const db = a[2] - b[2];
    return Math.sqrt((2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db) / 3.2;
}

const flagCache = new Map();

// Lê as dimensões do SVG (viewBox ou width/height) para desenhar na proporção certa.
async function svgRatio(url) {
    const text = await (await fetch(url)).text();
    const viewBox = text.match(/viewBox="\s*[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)\s*"/);
    if (viewBox) return Number(viewBox[1]) / Number(viewBox[2]);
    const w = text.match(/<svg[^>]*\swidth="([\d.]+)/);
    const h = text.match(/<svg[^>]*\sheight="([\d.]+)/);
    return w && h ? Number(w[1]) / Number(h[1]) : 1.5;
}

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = url;
    });
}

// Desenha a bandeira e devolve { width, height, pixels (RGBA), palette, segment, share }.
// Se `size` for informado, a bandeira é esticada a esse tamanho (para sobrepor à do dia).
export async function analyzeFlag(url, size = null) {
    const cacheKey = size ? `${url}|${size.width}x${size.height}` : url;
    if (flagCache.has(cacheKey)) return flagCache.get(cacheKey);
    const job = (async () => {
        const width = size ? size.width : WIDTH;
        const height = size ? size.height : Math.max(1, Math.round(WIDTH / (await svgRatio(url))));
        const image = await loadImage(url);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height).data;
        return { width, height, pixels, ...buildPalette(pixels, width * height) };
    })();
    flagCache.set(cacheKey, job);
    return job;
}

function buildPalette(pixels, total) {
    // Histograma em cubos de 16 níveis por canal; guarda a média real de cada cubo.
    const buckets = new Map();
    let opaque = 0;
    for (let i = 0; i < total; i++) {
        const o = i * 4;
        if (pixels[o + 3] < 128) continue;
        opaque++;
        const key = ((pixels[o] >> 4) << 8) | ((pixels[o + 1] >> 4) << 4) | (pixels[o + 2] >> 4);
        const bucket = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
        bucket.n++;
        bucket.r += pixels[o];
        bucket.g += pixels[o + 1];
        bucket.b += pixels[o + 2];
        buckets.set(key, bucket);
    }
    const sorted = [...buckets.values()]
        .map((b) => ({ n: b.n, color: [b.r / b.n, b.g / b.n, b.b / b.n] }))
        .sort((x, y) => y.n - x.n);

    // Escolhe as cores principais: das mais frequentes às menos, pulando as parecidas.
    const palette = [];
    for (const item of sorted) {
        if (item.n < MIN_SHARE * opaque && palette.length > 0) break;
        if (palette.every((p) => colorDistance(p, item.color) > MERGE_DISTANCE)) palette.push(item.color);
        if (palette.length >= 8) break;
    }

    // Cada pixel vai para a cor mais próxima da paleta.
    const segment = new Uint8Array(total).fill(255);
    const counts = new Array(palette.length).fill(0);
    for (let i = 0; i < total; i++) {
        const o = i * 4;
        if (pixels[o + 3] < 128) continue;
        const color = [pixels[o], pixels[o + 1], pixels[o + 2]];
        let best = 0;
        let bestDistance = Infinity;
        for (let p = 0; p < palette.length; p++) {
            const d = colorDistance(palette[p], color);
            if (d < bestDistance) { bestDistance = d; best = p; }
        }
        segment[i] = best;
        counts[best]++;
    }
    return { palette, segment, share: counts.map((n) => n / Math.max(1, opaque)) };
}

// Pixels em que a bandeira palpitada (já no tamanho da do dia) tem cor parecida com a do dia.
// Devolve { mask: Uint8Array (1 = revelado), count } (count em pixels).
export function overlap(target, guess) {
    const total = target.width * target.height;
    const mask = new Uint8Array(total);
    // tabela alvo×palpite: evita recalcular a distância a cada pixel
    const close = target.palette.map((a) => guess.palette.map((b) => colorDistance(a, b) <= MATCH_DISTANCE));
    let count = 0;
    for (let i = 0; i < total; i++) {
        const t = target.segment[i];
        const g = guess.segment[i];
        if (t === 255 || g === 255 || !close[t][g]) continue;
        mask[i] = 1;
        count++;
    }
    return { mask, count };
}

// Fração (0 a 1) de pixels visíveis da bandeira em `count`.
export function fraction(target, count) {
    let visible = 0;
    for (let i = 0; i < target.segment.length; i++) if (target.segment[i] !== 255) visible++;
    return count / Math.max(1, visible);
}

// Soma uma máscara à revelação acumulada.
export function addMask(revealed, mask) {
    for (let i = 0; i < mask.length; i++) if (mask[i]) revealed[i] = 1;
    return revealed;
}

export function countMask(mask) {
    let n = 0;
    for (let i = 0; i < mask.length; i++) if (mask[i]) n++;
    return n;
}

// Desenha no canvas só as partes reveladas (as demais ficam transparentes).
export function drawRevealed(canvas, target, revealed) {
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext('2d');
    const output = context.createImageData(target.width, target.height);
    const total = target.width * target.height;
    for (let i = 0; i < total; i++) {
        if (!revealed[i]) continue;
        const o = i * 4;
        output.data[o] = target.pixels[o];
        output.data[o + 1] = target.pixels[o + 1];
        output.data[o + 2] = target.pixels[o + 2];
        output.data[o + 3] = 255;
    }
    context.putImageData(output, 0, 0);
}

// Mostra a bandeira inteira (fim do jogo).
export function drawFull(canvas, target) {
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext('2d');
    const full = context.createImageData(target.width, target.height);
    full.data.set(target.pixels);
    context.putImageData(full, 0, 0);
}

/*
 * GGEO — cartão de resultado em imagem (9:16, 1080×1920, formato dos Stories).
 *
 * O cartão é desenhado em um <canvas>, sem biblioteca. Há três layouts por jogo:
 *   Flag Rush:  a = Placar, b = Cartaz (fundo bege), c = Relógio (anel de progresso)
 *   Rotas:      a = Placar, b = Cartaz (fundo bege), c = Percurso (linha do tempo)
 *
 * Uso:
 *   openShareDialog({ kind: 'rush' | 'rotas', data, fileName })
 *     abre uma janela com a prévia, a escolha de layout e os botões Salvar e Compartilhar.
 *
 * Os dados de cada jogo (os campos de `data`) estão descritos em drawRush() e drawRotas().
 * Os textos vêm do i18n (chaves `card.*` e `share.*`), então o cartão sai no idioma do jogador.
 * As cores são as da marca e NÃO mudam com o tema do site: o cartão é sempre igual.
 */
import { t, applyTranslations } from './i18n.js';

const W = 1080;
const H = 1920;
const MARGIN = 84;                       // margem lateral; o miolo respeita a área segura dos Stories
const INNER = W - MARGIN * 2;            // 912

const DARK = {
    bg: '#000000', fg: '#E6D4BF', accent: '#FF7700', green: '#52723E', ink: '#000000',
    muted: 'rgba(230,212,191,0.62)', faint: 'rgba(230,212,191,0.14)', panel: 'rgba(230,212,191,0.05)',
    line: 'rgba(230,212,191,0.16)', outline: 'rgba(230,212,191,0.28)', watermark: '#FFFFFF', watermarkAlpha: 0.06,
    detour: '#C4761D',
};
const LIGHT = {
    bg: '#E6D4BF', fg: '#000000', accent: '#C4761D', green: '#52723E', ink: '#000000',
    muted: 'rgba(0,0,0,0.55)', faint: 'rgba(0,0,0,0.12)', panel: 'rgba(0,0,0,0.05)',
    line: 'rgba(0,0,0,0.18)', outline: 'rgba(0,0,0,0.28)', watermark: '#000000', watermarkAlpha: 0.07,
    detour: '#C4761D',
};

const LOGO_MARK = new URL('../assets/logo-mark.svg', import.meta.url).href;
const LOGO_GLOBE = new URL('../assets/logo-globe.svg', import.meta.url).href;

// ---------------------------------------------------------------------------
// Ferramentas de desenho
// ---------------------------------------------------------------------------

function fonts() {
    const css = getComputedStyle(document.documentElement);
    const sans = css.getPropertyValue('--font-sans').trim() || 'system-ui, sans-serif';
    const mono = css.getPropertyValue('--font-mono').trim() || 'ui-monospace, monospace';
    return { sans, mono };
}

function loadImage(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);      // uma imagem que falha não derruba o cartão
        img.src = url;
    });
}

/** Cópia de uma imagem (de uma cor só) pintada com `color`: serve para a marca e a marca d'água. */
function tinted(img, color, size) {
    const buffer = document.createElement('canvas');
    buffer.width = buffer.height = size;
    const c = buffer.getContext('2d');
    c.drawImage(img, 0, 0, size, size);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = color;
    c.fillRect(0, 0, size, size);
    return buffer;
}

/** Texto com espaçamento entre letras (canvas.letterSpacing ainda não existe em todo navegador). */
function spaced(ctx, text, x, y, spacing, align = 'left') {
    const chars = Array.from(text);
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
    let cursor = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
    ctx.textAlign = 'left';
    chars.forEach((ch, i) => { ctx.fillText(ch, cursor, y); cursor += widths[i] + spacing; });
    return total;
}

/** Ajusta o tamanho da fonte para o texto caber em `maxWidth` (sem passar de `min`). */
function setFont(ctx, weight, size, family, text = '', maxWidth = Infinity, min = 14) {
    let px = size;
    ctx.font = `${weight} ${px}px ${family}`;
    while (text && px > min && ctx.measureText(text).width > maxWidth) {
        px -= 2;
        ctx.font = `${weight} ${px}px ${family}`;
    }
    return px;
}

function text(ctx, str, x, y, { font, color, align = 'left' }) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(str, x, y);
}

/** Desenha a bandeira dentro da caixa, inteira, centralizada e na proporção dela. */
function drawFlag(ctx, img, x, y, w, h) {
    if (!img) return;
    const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : w / h;
    let dw = w;
    let dh = w / ratio;
    if (dh > h) { dh = h; dw = h * ratio; }
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function background(ctx, pal, assets) {
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    if (assets.globe) {
        ctx.save();
        ctx.globalAlpha = pal.watermarkAlpha;
        ctx.drawImage(tinted(assets.globe, pal.watermark, 800), 200, 860, 1600, 1600);
        ctx.restore();
    }
}

/** Topo: marca do globo + GGEO à esquerda; à direita uma linha com texto, uma etiqueta ou só o texto. */
function header(ctx, pal, assets, f, { right, style }) {
    const cy = 291;
    if (assets.mark) ctx.drawImage(tinted(assets.mark, pal.accent, 128), MARGIN, cy - 32, 64, 64);
    ctx.font = `800 56px ${f.sans}`;
    ctx.fillStyle = pal.fg;
    const wordWidth = spaced(ctx, 'GGEO', MARGIN + 82, cy + 20, 8);
    ctx.font = `700 26px ${f.mono}`;
    if (style === 'tag') {
        const textWidth = Array.from(right).reduce((sum, ch) => sum + ctx.measureText(ch).width + 6, -6);
        const boxW = textWidth + 36 * 2;
        ctx.fillStyle = pal.fg;
        ctx.fillRect(W - MARGIN - boxW, cy - 29, boxW, 58);
        ctx.fillStyle = pal.bg;
        spaced(ctx, right, W - MARGIN - 36, cy + 9, 6, 'right');
        return;
    }
    ctx.fillStyle = style === 'plain' ? pal.accent : pal.fg;
    const rightWidth = spaced(ctx, right, W - MARGIN, cy + 9, 6, 'right');
    if (style === 'line') {
        const from = MARGIN + 82 + wordWidth + 30;
        const to = W - MARGIN - rightWidth - 30;
        if (to > from) { ctx.fillStyle = pal.green; ctx.fillRect(from, cy - 1, to - from, 2); }
    }
}

function footer(ctx, pal, f) {
    ctx.fillStyle = pal.line;
    ctx.fillRect(MARGIN, 1531, INNER, 2);
    ctx.font = `700 26px ${f.mono}`;
    ctx.fillStyle = pal.fg;
    spaced(ctx, t('card.playAt'), MARGIN, 1588, 6);
    text(ctx, t('card.tagline'), W - MARGIN, 1588, { font: `500 30px ${f.sans}`, color: pal.accent, align: 'right' });
}

/** Caixa grande no pé do layout Cartaz (fundo bege): chamada para o desafio. */
function challengeBar(ctx, pal, f, label) {
    ctx.fillStyle = pal.fg;
    ctx.fillRect(MARGIN, 1478, INNER, 122);
    setFont(ctx, 800, 40, f.sans, label, INNER - 300);
    ctx.fillStyle = pal.bg;
    ctx.textAlign = 'left';
    ctx.fillText(label, MARGIN + 44, 1553);
    ctx.font = `700 24px ${f.mono}`;
    ctx.fillStyle = '#FF7700';
    spaced(ctx, 'GGEO.IO', W - MARGIN - 44, 1550, 4, 'right');
}

/** Painel "SEUS NÚMEROS": linhas com nome, barra e valor. rows = [{ label, value, display, color, valueColor }] */
function statsPanel(ctx, pal, f, rows, top) {
    const height = 122 + rows.length * 70;
    ctx.fillStyle = pal.panel;
    ctx.fillRect(MARGIN, top, INNER, height);
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 2;
    ctx.strokeRect(MARGIN + 1, top + 1, INNER - 2, height - 2);
    ctx.font = `700 26px ${f.mono}`;
    ctx.fillStyle = pal.fg;
    spaced(ctx, t('card.yourNumbers'), MARGIN + 48, top + 58, 6);
    rows.forEach((row, i) => {
        const y = top + 125 + i * 70;
        text(ctx, row.label, MARGIN + 48, y + 11, { font: `400 30px ${f.sans}`, color: pal.fg });
        ctx.fillStyle = pal.faint;
        ctx.fillRect(380, y - 5, 450, 10);
        ctx.fillStyle = row.color;
        ctx.fillRect(380, y - 5, Math.max(0, Math.min(1, row.fraction)) * 450, 10);
        text(ctx, row.display, W - MARGIN - 48, y + 12, { font: `700 34px ${f.mono}`, color: row.valueColor || pal.fg, align: 'right' });
    });
}

// ---------------------------------------------------------------------------
// Flag Rush
// ---------------------------------------------------------------------------
// data: { hits, errors, record, flags: [URL das bandeiras acertadas, em ordem] }

function drawRush(ctx, layout, data, assets, f) {
    const pal = layout === 'b' ? LIGHT : DARK;
    const { hits, errors, record } = data;
    const precision = hits + errors > 0 ? Math.round((hits / (hits + errors)) * 100) : 0;
    background(ctx, pal, assets);

    if (layout === 'a') {
        header(ctx, pal, assets, f, { right: t('card.myResult'), style: 'line' });
        ctx.font = `700 26px ${f.mono}`;
        ctx.fillStyle = pal.accent;
        spaced(ctx, 'FLAG', MARGIN, 385, 8);
        text(ctx, 'Rush', MARGIN, 497, { font: `800 112px ${f.sans}`, color: pal.fg });
        setFont(ctx, 800, 360, f.sans, String(hits), INNER);
        ctx.fillStyle = pal.accent; ctx.textAlign = 'left';
        ctx.fillText(String(hits), MARGIN, 840);
        text(ctx, t('card.flagsLong'), MARGIN, 922, { font: `500 38px ${f.sans}`, color: pal.fg });
        const shown = assets.flags.slice(0, 6);
        shown.forEach((img, i) => {
            const x = MARGIN + i * (132 + 24);
            drawFlag(ctx, img, x, 968, 132, 88);
        });
        const denom = Math.max(hits, errors, record, 1);
        statsPanel(ctx, pal, f, [
            { label: t('card.hits'), fraction: hits / denom, display: String(hits), color: pal.accent, valueColor: pal.accent },
            { label: t('card.errors'), fraction: errors / denom, display: String(errors), color: pal.fg },
            { label: t('card.precision'), fraction: precision / 100, display: `${precision}%`, color: pal.fg },
            { label: t('card.record'), fraction: record / denom, display: String(record), color: pal.green },
        ], 1094);
        footer(ctx, pal, f);
        return;
    }

    if (layout === 'b') {
        header(ctx, pal, assets, f, { right: 'FLAG · RUSH', style: 'tag' });
        setFont(ctx, 800, 620, f.sans, String(hits), INNER);
        ctx.fillStyle = pal.fg; ctx.textAlign = 'left';
        ctx.fillText(String(hits), MARGIN - 6, 926);
        text(ctx, t('card.flagsShort'), MARGIN, 1030, { font: `800 56px ${f.sans}`, color: pal.fg });
        text(ctx, `${t('card.record')}: ${record}`, W - MARGIN, 1020, { font: `500 26px ${f.mono}`, color: pal.muted, align: 'right' });
        assets.flags.slice(0, 14).forEach((img, i) => {
            const col = i % 7;
            const row = Math.floor(i / 7);
            drawFlag(ctx, img, MARGIN + col * (118 + 14), 1171 + row * 93, 118, 79);
        });
        challengeBar(ctx, pal, f, t('card.canYouBeat'));
        return;
    }

    // layout c: Relógio
    header(ctx, pal, assets, f, { right: 'FLAG · RUSH', style: 'plain' });
    const cx = W / 2;
    const cy = 732;
    const radius = 306;
    ctx.lineWidth = 34;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = pal.faint;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    const fraction = Math.min(1, hits / Math.max(record, hits, 1));
    if (fraction > 0) {
        ctx.strokeStyle = pal.accent;
        ctx.beginPath(); ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fraction); ctx.stroke();
    }
    setFont(ctx, 800, 260, f.sans, String(hits), 420);
    ctx.fillStyle = pal.fg; ctx.textAlign = 'center';
    ctx.fillText(String(hits), cx, 802);
    text(ctx, t('card.flagsShort'), cx, 862, { font: `400 34px ${f.sans}`, color: pal.fg, align: 'center' });
    const shown = assets.flags.slice(0, 7);
    const rowWidth = shown.length * 108 + Math.max(0, shown.length - 1) * 13;
    shown.forEach((img, i) => {
        const x = (W - rowWidth) / 2 + i * 121;
        ctx.strokeStyle = pal.outline; ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, 1149, 106, 82);
        drawFlag(ctx, img, x + 5, 1153, 98, 74);
    });
    const boxes = [
        [t('card.precision').toUpperCase(), `${precision}%`, pal.accent],
        [t('card.errors').toUpperCase(), String(errors), pal.fg],
        [t('card.record').toUpperCase(), String(record), pal.fg],
    ];
    boxes.forEach(([label, value, color], i) => {
        const x = MARGIN + i * (296 + 12);
        ctx.fillStyle = pal.panel; ctx.fillRect(x, 1311, 296, 163);
        ctx.strokeStyle = pal.line; ctx.lineWidth = 2; ctx.strokeRect(x + 1, 1312, 294, 161);
        ctx.font = `700 22px ${f.mono}`; ctx.fillStyle = pal.muted;
        spaced(ctx, label, x + 24, 1357, 4);
        text(ctx, value, x + 24, 1436, { font: `800 72px ${f.sans}`, color });
    });
    footer(ctx, pal, f);
}

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------
// data: { from, to, daily, won, n (palpites), ideal, maxGuesses, streak,
//         steps: [{ name, state: 'green'|'yellow'|'gray' }] (todos os palpites, em ordem) }

function drawRotas(ctx, layout, data, f, assets) {
    const pal = layout === 'b' ? LIGHT : DARK;
    const { from, to, daily, won, n, ideal, steps } = data;
    const connected = steps.filter((s) => s.state !== 'gray');
    const grays = steps.filter((s) => s.state === 'gray').map((s) => s.name);
    const chain = [from, ...connected.map((s) => s.name)];
    if (won && chain[chain.length - 1] !== to) chain.push(to);
    const modeLabel = t(daily ? 'card.rotasDaily' : 'card.rotasPractice');
    const arrow = '→';
    background(ctx, pal, assets);

    if (layout === 'a') {
        header(ctx, pal, assets, f, { right: t('card.myResult'), style: 'line' });
        ctx.font = `700 26px ${f.mono}`; ctx.fillStyle = pal.accent;
        spaced(ctx, modeLabel, MARGIN, 378, 8);
        const title = `${from} ${arrow} ${to}`;
        setFont(ctx, 800, 80, f.sans, title, INNER, 40);
        ctx.fillStyle = pal.fg; ctx.textAlign = 'left';
        ctx.fillText(title, MARGIN, 464);
        setFont(ctx, 800, 360, f.sans, String(n), INNER);
        ctx.fillStyle = pal.accent;
        ctx.fillText(String(n), MARGIN, 806);
        text(ctx, t(won ? 'card.guessesToGetThere' : 'card.guessesWord'), MARGIN, 869, { font: `500 38px ${f.sans}`, color: pal.fg });

        // Percurso em caixinhas: quebra em até duas linhas.
        const chipFont = `500 30px ${f.sans}`;
        ctx.font = chipFont;
        const chips = chain.map((name, i) => ({ name, w: ctx.measureText(name).width + 40, last: won && i === chain.length - 1 }));
        const gap = 36;                          // espaço do separador ›
        const rows = [[]];
        let used = 0;
        for (const chip of chips) {
            if (used + chip.w > INNER && rows[rows.length - 1].length) { rows.push([]); used = 0; }
            rows[rows.length - 1].push(chip);
            used += chip.w + gap;
        }
        rows.slice(0, 2).forEach((row, r) => {
            let x = MARGIN;
            const y = 926 + r * 75;
            row.forEach((chip, i) => {
                if (chip.last) { ctx.fillStyle = pal.accent; ctx.fillRect(x, y, chip.w, 63); }
                else { ctx.strokeStyle = pal.green; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, chip.w - 2, 61); }
                text(ctx, chip.name, x + 20, y + 42, { font: chipFont, color: chip.last ? pal.ink : pal.fg });
                x += chip.w;
                if (i < row.length - 1) { text(ctx, '›', x + gap / 2, y + 42, { font: `700 30px ${f.sans}`, color: pal.accent, align: 'center' }); x += gap; }
            });
        });
        if (grays.length && rows.length === 1) {
            const note = t('card.noLinkShort', { name: grays.join(', ') });
            setFont(ctx, 400, 26, f.sans, note, INNER - 40, 18);
            const w = Math.min(INNER, ctx.measureText(note).width + 40);
            ctx.fillStyle = pal.panel; ctx.fillRect(MARGIN, 1011, w, 53);
            text(ctx, note, MARGIN + 20, 1046, { font: ctx.font, color: pal.muted });
        }
        const denom = Math.max(n, ideal, grays.length, 1);
        const list = [
            { label: t('card.guessesLabel'), fraction: n / denom, display: String(n), color: pal.accent, valueColor: pal.accent },
            { label: t('card.idealRoute'), fraction: ideal / denom, display: String(ideal), color: pal.fg },
            { label: t('card.noLink'), fraction: grays.length / denom, display: String(grays.length), color: pal.fg },
        ];
        if (daily) list.push({ label: t('card.streak'), fraction: Math.min(1, data.streak / 10), display: t('card.days', { n: data.streak }), color: pal.green });
        statsPanel(ctx, pal, f, list, 1100);
        footer(ctx, pal, f);
        return;
    }

    if (layout === 'b') {
        header(ctx, pal, assets, f, { right: modeLabel, style: 'tag' });
        setFont(ctx, 800, 620, f.sans, String(n), INNER);
        ctx.fillStyle = pal.fg; ctx.textAlign = 'left';
        ctx.fillText(String(n), MARGIN - 6, 908);
        text(ctx, t('card.guessesWord'), MARGIN, 996, { font: `800 56px ${f.sans}`, color: pal.fg });
        text(ctx, `${t('card.idealRoute')}: ${ideal}`, W - MARGIN, 1004, { font: `500 26px ${f.mono}`, color: pal.muted, align: 'right' });

        const boxes = chain.length > 8 ? [...chain.slice(0, 7), chain[chain.length - 1]] : chain;
        const perRow = boxes.length > 4 ? Math.ceil(boxes.length / 2) : boxes.length;
        const boxGap = 14;
        const boxW = (INNER - boxGap * (perRow - 1)) / perRow;
        boxes.forEach((name, i) => {
            const col = i % perRow;
            const row = Math.floor(i / perRow);
            const x = MARGIN + col * (boxW + boxGap);
            const y = 1141 + row * (128 + boxGap);
            const isLast = won && i === boxes.length - 1;
            const label = i === 0 ? t('card.origin') : isLast ? t('card.destination') : t('card.step', { n: i });
            ctx.fillStyle = isLast ? pal.accent : pal.fg;
            ctx.fillRect(x, y, boxW, 128);
            ctx.font = `700 20px ${f.mono}`;
            ctx.fillStyle = isLast ? pal.ink : 'rgba(230,212,191,0.7)';
            spaced(ctx, label, x + 20, y + 44, 3);
            setFont(ctx, 800, 32, f.sans, name, boxW - 40, 20);
            ctx.fillStyle = isLast ? pal.ink : '#E6D4BF';
            ctx.textAlign = 'left';
            ctx.fillText(name, x + 20, y + 96);
        });
        const twoRows = boxes.length > 4;
        if (grays.length && !twoRows) {
            const note = t('card.noLinkByLand', { name: grays.join(', ') });
            ctx.strokeStyle = pal.green; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
            ctx.strokeRect(MARGIN + 1, 1290, INNER - 2, 76);
            ctx.setLineDash([]);
            setFont(ctx, 400, 26, f.sans, note, INNER - 48, 18);
            ctx.fillStyle = pal.muted; ctx.textAlign = 'left';
            ctx.fillText(note, MARGIN + 24, 1336);
        }
        challengeBar(ctx, pal, f, t('card.canYouIn', { n: ideal }));
        return;
    }

    // layout c: Percurso (linha do tempo)
    header(ctx, pal, assets, f, { right: modeLabel, style: 'plain' });
    setFont(ctx, 800, 64, f.sans, `${arrow} ${to}`, 600, 34);
    ctx.fillStyle = pal.fg; ctx.textAlign = 'left';
    const titleFont = ctx.font;
    setFont(ctx, 800, 64, f.sans, from, 600, 34);
    const fromFont = ctx.font;
    ctx.font = fromFont; ctx.fillText(from, MARGIN, 584);
    ctx.font = titleFont; ctx.fillText(`${arrow} ${to}`, MARGIN, 653);
    text(ctx, t('card.idealLine', { n: ideal }), MARGIN, 705, { font: `400 26px ${f.mono}`, color: pal.muted });
    setFont(ctx, 800, 220, f.sans, String(n), 300);
    ctx.fillStyle = pal.accent; ctx.textAlign = 'right';
    ctx.fillText(String(n), W - MARGIN, 614);
    text(ctx, t('card.guessesWord'), W - MARGIN, 662, { font: `400 28px ${f.sans}`, color: pal.fg, align: 'right' });

    const rows = [{ name: from, sub: t('card.originCap'), kind: 'origin' }];
    steps.forEach((s, i) => {
        const isDest = won && i === steps.length - 1;
        const sub = isDest ? `${t('card.guessN', { n: i + 1 })} · ${t('card.destLower')}`
            : `${t('card.guessN', { n: i + 1 })} · ${s.state === 'gray' ? t('card.noLinkLower') : s.state === 'yellow' ? t('card.detour') : t('card.landLink')}`;
        rows.push({ name: s.name, sub, kind: isDest ? 'dest' : s.state });
    });
    const top = 840;
    const pitch = Math.min(132, rows.length > 1 ? (1480 - top) / (rows.length - 1) : 132);
    const s = Math.max(0.62, Math.min(1, pitch / 132));
    const icon = Math.round(56 * s);
    ctx.fillStyle = pal.green;
    ctx.fillRect(MARGIN + icon / 2 - 2, top, 4, pitch * (rows.length - 1));
    rows.forEach((row, i) => {
        const cy = top + i * pitch;
        const x = MARGIN;
        const y = cy - icon / 2;
        ctx.lineJoin = 'miter'; ctx.lineCap = 'square';
        const mark = (color, width) => {
            ctx.strokeStyle = color; ctx.lineWidth = width * s;
            ctx.beginPath();
            ctx.moveTo(x + icon * 0.25, y + icon * 0.52);
            ctx.lineTo(x + icon * 0.43, y + icon * 0.70);
            ctx.lineTo(x + icon * 0.77, y + icon * 0.30);
            ctx.stroke();
        };
        if (row.kind === 'origin') {
            ctx.fillStyle = pal.bg; ctx.fillRect(x, y, icon, icon);
            ctx.strokeStyle = pal.fg; ctx.lineWidth = 4; ctx.strokeRect(x + 2, y + 2, icon - 4, icon - 4);
        } else if (row.kind === 'gray') {
            ctx.fillStyle = pal.bg; ctx.fillRect(x, y, icon, icon);
            ctx.strokeStyle = pal.muted; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
            ctx.strokeRect(x + 1.5, y + 1.5, icon - 3, icon - 3);
            ctx.setLineDash([]);
            ctx.lineWidth = 5 * s;
            ctx.beginPath();
            ctx.moveTo(x + icon * 0.3, y + icon * 0.3); ctx.lineTo(x + icon * 0.7, y + icon * 0.7);
            ctx.moveTo(x + icon * 0.7, y + icon * 0.3); ctx.lineTo(x + icon * 0.3, y + icon * 0.7);
            ctx.stroke();
        } else {
            ctx.fillStyle = row.kind === 'dest' ? pal.accent : row.kind === 'yellow' ? pal.detour : pal.green;
            ctx.fillRect(x, y, icon, icon);
            mark(row.kind === 'dest' ? pal.ink : pal.fg, 6);
        }
        const nameColor = row.kind === 'dest' ? pal.accent : row.kind === 'gray' ? pal.muted : pal.fg;
        setFont(ctx, 800, Math.round(44 * s), f.sans, row.name, INNER - 120, 20);
        ctx.fillStyle = nameColor; ctx.textAlign = 'left';
        ctx.fillText(row.name, MARGIN + icon + 32, cy - 2 * s);
        setFont(ctx, 400, Math.round(24 * s), f.sans, row.sub, INNER - 120, 14);
        ctx.fillStyle = pal.muted;
        ctx.fillText(row.sub, MARGIN + icon + 32, cy + 30 * s);
    });
    footer(ctx, pal, f);
}

// ---------------------------------------------------------------------------
// Entrada pública
// ---------------------------------------------------------------------------

export const LAYOUTS = {
    rush: [['a', 'card.layout.a'], ['b', 'card.layout.b'], ['c', 'card.layout.c1']],
    rotas: [['a', 'card.layout.a'], ['b', 'card.layout.b'], ['c', 'card.layout.c2']],
};

let logoCache = null;
async function logos() {
    if (!logoCache) logoCache = Promise.all([loadImage(LOGO_MARK), loadImage(LOGO_GLOBE)]);
    return logoCache;
}

/** Desenha o cartão no canvas dado (1080×1920). Devolve o próprio canvas. */
export async function renderCard(canvas, kind, layout, data) {
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const f = fonts();
    const [mark, globe] = await logos();
    const assets = { mark, globe, flags: [] };
    if (kind === 'rush') assets.flags = await Promise.all((data.flags || []).slice(0, 14).map(loadImage));
    ctx.textBaseline = 'alphabetic';
    if (kind === 'rush') drawRush(ctx, layout, data, assets, f);
    else drawRotas(ctx, layout, data, f, assets);
    return canvas;
}

// ---- Janela de pré-visualização ----

let dialog = null;
let current = null;           // { kind, data, fileName, layout }
let renderToken = 0;

function build() {
    const box = document.createElement('dialog');
    box.className = 'share-dialog';
    box.setAttribute('aria-labelledby', 'share-dialog-title');
    box.innerHTML = `
        <h2 id="share-dialog-title" class="share-dialog__title" data-i18n="share.imageTitle"></h2>
        <div class="share-dialog__layouts" role="group" data-i18n-attr="aria-label:share.layout"></div>
        <canvas class="share-dialog__preview" role="img" data-i18n-attr="aria-label:share.previewAlt"></canvas>
        <div class="share-dialog__actions">
            <button type="button" class="btn-primary share-dialog__save" data-i18n="share.save"></button>
            <button type="button" class="secondary-btn share-dialog__send hidden" data-i18n="share.send"></button>
            <button type="button" class="secondary-btn share-dialog__close" data-i18n="share.close"></button>
        </div>
        <p class="share-dialog__status" role="status" aria-live="polite"></p>`;
    document.body.append(box);
    box.querySelector('.share-dialog__close').addEventListener('click', () => box.close());
    box.addEventListener('click', (event) => { if (event.target === box) box.close(); });   // clique no fundo
    box.querySelector('.share-dialog__save').addEventListener('click', save);
    box.querySelector('.share-dialog__send').addEventListener('click', send);
    return box;
}

function layoutButtons() {
    const group = dialog.querySelector('.share-dialog__layouts');
    group.textContent = '';
    for (const [id, key] of LAYOUTS[current.kind]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'share-dialog__layout';
        button.dataset.layout = id;
        button.setAttribute('aria-pressed', String(id === current.layout));
        button.textContent = t(key);
        button.addEventListener('click', () => { current.layout = id; layoutButtons(); redraw(); });
        group.append(button);
    }
}

async function redraw() {
    const token = ++renderToken;
    const status = dialog.querySelector('.share-dialog__status');
    status.textContent = '';
    try {
        await renderCard(dialog.querySelector('.share-dialog__preview'), current.kind, current.layout, current.data);
    } catch (error) {
        if (token === renderToken) status.textContent = t('share.imageFailed');
    }
}

function toBlob() {
    return new Promise((resolve) => dialog.querySelector('.share-dialog__preview').toBlob(resolve, 'image/png'));
}

async function save() {
    const status = dialog.querySelector('.share-dialog__status');
    const blob = await toBlob();
    if (!blob) { status.textContent = t('share.imageFailed'); return; }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${current.fileName}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    status.textContent = t('share.imageSaved');
}

async function send() {
    const status = dialog.querySelector('.share-dialog__status');
    const blob = await toBlob();
    if (!blob) { status.textContent = t('share.imageFailed'); return; }
    const file = new File([blob], `${current.fileName}.png`, { type: 'image/png' });
    try {
        await navigator.share({ files: [file] });
    } catch (error) {
        if (error && error.name !== 'AbortError') status.textContent = t('share.imageFailed');
    }
}

export function openShareDialog({ kind, data, fileName }) {
    if (!dialog) dialog = build();
    current = { kind, data, fileName, layout: 'a' };
    applyTranslations(dialog);
    layoutButtons();
    // Compartilhar direto (menu do celular) só aparece onde o navegador sabe enviar arquivos.
    const probe = new File([''], 'x.png', { type: 'image/png' });
    const canSend = typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
    dialog.querySelector('.share-dialog__send').classList.toggle('hidden', !canSend);
    dialog.showModal();
    redraw();
}

/*
 * GGEO — Rotas.
 *
 * Você recebe dois países (origem e destino) e tenta montar um caminho por
 * terra entre eles, chutando os países do meio. Cada palpite fica:
 *   verde    conectado à origem e numa das menores rotas possíveis
 *   amarelo  conectado à origem, mas fora de uma menor rota (desvio)
 *   cinza    ainda sem ligação com a origem
 * Quando os palpites formam um caminho completo, você vence. Se acabarem os
 * palpites antes disso, a rodada termina e mostramos uma rota ideal.
 *
 * Dados (tudo dentro do repositório, nada vem de sites externos):
 *   data/world-borders.json  193 países e com quem cada um faz fronteira
 *   data/world-map.json      contornos para o globo (Natural Earth, simplificado)
 *   data/countries.json      nomes/apelidos que já usamos no Flag
 * O globo é desenhado com o d3 (js/vendor/d3.min.js, carregado antes deste arquivo).
 */
import { t, setText, getLang, initI18n, onLangChange } from '../../js/i18n.js';
import { countryName, acceptedAnswers, normalize } from '../../js/country-names.js';
import { createAutocomplete } from '../../js/autocomplete.js';
import { playSound, initSoundToggle } from '../../js/sound.js';
import { copyText, siteUrl } from '../../js/share.js';

const BORDERS_URL = new URL('../../data/world-borders.json', import.meta.url);
const MAP_URL = new URL('../../data/world-map.json', import.meta.url);
const COUNTRIES_URL = new URL('../../data/countries.json', import.meta.url);

const MIN_DISTANCE = 4;      // a origem e o destino ficam a 4 a 7 fronteiras de distância
const MAX_DISTANCE = 7;
const EXTRA_GUESSES = 10;    // palpites permitidos além do mínimo necessário

// Sorteio com memória: países que apareceram em rodadas recentes têm menos chance
// de aparecer de novo (o "peso" de cada país decai a cada rodada). Assim passagens
// obrigatórias como Panamá ou a Rússia não dominam, sem limitar quantas vezes se joga.
const RECENT_KEY = 'ggeo_rotas_recent';
const RECENT_DECAY = 0.95;   // quanto da memória sobra a cada rodada
const RECENT_PENALTY = 0.8;  // quanto cada aparição recente reduz a chance (maior = mais variedade)
// Desafio diário: a mesma rota para todo mundo no dia (sorteada com semente fixa, pelo
// calendário local). Não mude DAILY_SEED nem DAILY_FIRST_DAY, senão muda o calendário.
const DAILY_KEY = 'ggeo_rotas_daily';
const DAILY_FIRST_DAY = '2026-11-12';   // data do desafio nº 1
const DAILY_SEED = 0x3c6ef372;
const MAP_SIZE = 480;        // tamanho "virtual" do desenho; o CSS ajusta à tela
const MIN_SCALE = 50;
const MAX_SCALE = 2000;

const d3 = window.d3;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Elementos ----------
const $ = (id) => document.getElementById(id);
const inputEl = $('country-input');
const suggestionsEl = $('suggestions');
const guessBtn = $('guess-btn');
const statusEl = $('status');
const routeEl = $('route');
const guessesListEl = $('guesses-list');
const legendEl = $('legend');
const hintsTitleEl = $('hints-title');
const hintBtns = [$('hint-1-btn'), $('hint-2-btn'), $('hint-3-btn')];
const hint3Note = $('hint-3-note');
const tooltipEl = $('tooltip');
const globeWrap = document.querySelector('.globe-wrap');
const resultEl = $('result');
const settingsBtn = $('settings-btn');
const settingsModal = $('settings-modal');

// ---------- Dados ----------
let graph = {};            // id (ISO alfa-3) -> ids vizinhos (usado nas dicas)
// Grafo de "pedaços de terra": um país com partes separadas (Indonésia, Malásia,
// Angola/Cabinda, Croácia/Dubrovnik, Palestina) vira um nó por pedaço, e só se
// atravessa o país entre vizinhos do MESMO pedaço. Sem isso, dava para "andar"
// da Tailândia à Indonésia pela Malásia, o que não existe por terra.
let nodes = {};            // nó ('IDN#0') -> { country, next: [nós] }
let nodesOf = {};          // id -> seus nós
let countries = {};        // id -> objeto de país (o mesmo formato do Flag)
let features = [];         // contornos
let ready = false;

// Nomes no idioma atual (refeitos ao trocar de idioma)
let nameOf = {};           // id -> nome exibido
let entries = [];          // [{ id, name, keys: [respostas normalizadas] }]
let exact = new Map();     // resposta normalizada -> id

// ---------- Estado da rodada ----------
let startId = null;
let endId = null;
let minPath = 0;           // países que faltam entre os dois, no melhor caso
let maxGuesses = 0;
let guesses = [];          // ids, na ordem
let guessStates = {};      // id -> 'green' | 'yellow' | 'gray'
let hintsUsed = 0;
let ended = null;          // null | { won: boolean }
let idealPath = [];
let statusState = null;    // { key, id?, state? }
let yourPath = [];         // caminho montado pelos palpites (só na vitória)
let copied = false;        // mostrou "resultado copiado"?
let mode = 'daily';        // 'daily' (rota do dia) | 'practice' (treino infinito)
let daily = null;          // { date, guesses, hints, ended, streak, lastWin }
let svg, projection, pathGenerator;

// ================= Carregamento =================

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return response.json();
}

async function loadData() {
    const [borders, map, flagCountries] = await Promise.all([
        fetchJson(BORDERS_URL), fetchJson(MAP_URL), fetchJson(COUNTRIES_URL),
    ]);
    const known = new Map(flagCountries.map((country) => [country.code, country]));
    const ptNames = new Intl.DisplayNames(['pt-BR'], { type: 'region' });
    for (const item of borders) {
        graph[item.id] = item.borders;
        // Os 128 países do Flag já têm nome/apelidos; os demais usam o nome do navegador.
        countries[item.id] = known.get(item.code) || {
            name: ptNames.of(item.code.toUpperCase()), code: item.code, aliases: [],
        };
    }
    features = map.features;
    buildNodes(borders);
}

// Cada item de world-borders.json pode ter `parts`: listas de vizinhos por pedaço de terra.
function buildNodes(borders) {
    const byId = Object.fromEntries(borders.map((item) => [item.id, item]));
    const groupsOf = (item) => item.parts || [item.borders];
    nodes = {};
    nodesOf = {};
    for (const item of borders) {
        nodesOf[item.id] = groupsOf(item).map((_, k) => `${item.id}#${k}`);
        for (const node of nodesOf[item.id]) nodes[node] = { country: item.id, next: [] };
    }
    for (const item of borders) {
        groupsOf(item).forEach((group, k) => {
            for (const neighborId of group) {
                const neighbor = byId[neighborId];
                if (!neighbor) continue;
                groupsOf(neighbor).forEach((otherGroup, h) => {
                    if (otherGroup.includes(item.id)) nodes[`${item.id}#${k}`].next.push(`${neighborId}#${h}`);
                });
            }
        });
    }
}

// ================= Nomes e busca (idioma atual) =================

function buildNames() {
    const lang = getLang();
    nameOf = {};
    entries = [];
    exact = new Map();
    for (const id of Object.keys(countries)) {
        const country = countries[id];
        nameOf[id] = countryName(country, lang);
        const keys = [...acceptedAnswers(country, lang)];
        entries.push({ id, name: nameOf[id], keys });
        for (const key of keys) if (!exact.has(key)) exact.set(key, id);
    }
    entries.sort((a, b) => a.name.localeCompare(b.name, lang));
}

// ================= Grafo =================

// Distância (em fronteiras) de um país até cada NÓ; a origem vale todos os seus pedaços.
function nodeDistances(source) {
    const dist = {};
    const queue = [...nodesOf[source]];
    for (const node of queue) dist[node] = 0;
    for (let i = 0; i < queue.length; i++) {
        for (const next of nodes[queue[i]].next) {
            if (!(next in dist)) { dist[next] = dist[queue[i]] + 1; queue.push(next); }
        }
    }
    return dist;
}

// Distância de um país até cada outro país (o menor entre os pedaços dele).
function distancesFrom(source) {
    const dist = {};
    for (const [node, d] of Object.entries(nodeDistances(source))) {
        const id = nodes[node].country;
        if (!(id in dist) || d < dist[id]) dist[id] = d;
    }
    return dist;
}

function shuffled(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

// Todos os pares origem/destino válidos, com os países que ficam no meio de algum
// caminho mínimo. Calculado uma vez (alguns milhares de pares, instantâneo).
let routePairs = null;
function buildRoutePairs() {
    const ids = Object.keys(graph).filter((id) => graph[id].length > 0);
    const byNode = {};
    const dist = {};
    for (const id of ids) { byNode[id] = nodeDistances(id); dist[id] = distancesFrom(id); }
    routePairs = [];
    for (const a of ids) {
        for (const b of ids) {
            const d = dist[a][b];
            if (a >= b || d === undefined || d < MIN_DISTANCE || d > MAX_DISTANCE) continue;
            const middle = ids.filter((x) => x !== a && x !== b
                && nodesOf[x].some((n) => byNode[a][n] + byNode[b][n] === d));
            routePairs.push({ a, b, d, members: [a, b, ...middle] });
        }
    }
}

function loadRecent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || {}; } catch (error) { return {}; }
}

function saveRecent(recent) {
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); } catch (error) { /* sem persistência */ }
}

// Escolhe a próxima rota e atualiza a memória dos países usados.
function pickRoute() {
    if (!routePairs) buildRoutePairs();
    const recent = loadRecent();
    const weights = routePairs.map((pair) => {
        let load = 0;
        for (const id of pair.members) load += recent[id] || 0;
        return Math.exp(-RECENT_PENALTY * load);
    });
    let roll = Math.random() * weights.reduce((sum, w) => sum + w, 0);
    let chosen = routePairs[routePairs.length - 1];
    for (let i = 0; i < routePairs.length; i++) {
        roll -= weights[i];
        if (roll <= 0) { chosen = routePairs[i]; break; }
    }
    for (const id of Object.keys(recent)) {
        recent[id] *= RECENT_DECAY;
        if (recent[id] < 0.02) delete recent[id];
    }
    for (const id of chosen.members) recent[id] = (recent[id] || 0) + 1;
    saveRecent(recent);
    return Math.random() < 0.5 ? [chosen.a, chosen.b, chosen.d] : [chosen.b, chosen.a, chosen.d];
}

// Menor caminho de `from` até `to`, passando só por `allowed` (se informado).
// Devolve a lista de países (ou null se não houver).
function shortestPath(from, to, allowed = null, randomize = false) {
    const previous = {};
    const queue = [];
    for (const node of nodesOf[from]) { previous[node] = null; queue.push(node); }
    for (let i = 0; i < queue.length; i++) {
        const node = queue[i];
        if (nodes[node].country === to) {
            const path = [];
            for (let at = node; at !== null; at = previous[at]) path.unshift(nodes[at].country);
            return path;
        }
        const neighbors = nodes[node].next;
        for (const next of randomize ? shuffled(neighbors) : neighbors) {
            if (next in previous) continue;
            const country = nodes[next].country;
            if (allowed && !allowed.has(country) && country !== to) continue;
            previous[next] = node;
            queue.push(next);
        }
    }
    return null;
}

function evaluateGuesses() {
    const fromStart = nodeDistances(startId);
    const toEnd = nodeDistances(endId);
    const best = Math.min(...nodesOf[endId].map((node) => fromStart[node] ?? Infinity));

    // Quais palpites já se ligam à origem (direta ou indiretamente, só por palpites)?
    const allowed = new Set([...guesses, startId]);
    const reached = new Set(nodesOf[startId]);
    const queue = [...reached];
    for (let i = 0; i < queue.length; i++) {
        for (const next of nodes[queue[i]].next) {
            if (!reached.has(next) && allowed.has(nodes[next].country)) { reached.add(next); queue.push(next); }
        }
    }
    const connected = new Set([...reached].map((node) => nodes[node].country));
    guessStates = {};
    for (const id of guesses) {
        if (!connected.has(id)) guessStates[id] = 'gray';
        else guessStates[id] = nodesOf[id].some((node) => fromStart[node] + toEnd[node] === best) ? 'green' : 'yellow';
    }
}

// ================= Globo (d3) =================

function featureId(feature) { return feature.id; }

function initGlobe() {
    svg = d3.select('#map').append('svg')
        .attr('width', '100%').attr('height', '100%')
        .attr('viewBox', `0 0 ${MAP_SIZE} ${MAP_SIZE}`);

    projection = d3.geoOrthographic()
        .scale(MAP_SIZE / 2.3)
        .translate([MAP_SIZE / 2, MAP_SIZE / 2])
        .clipAngle(90);
    pathGenerator = d3.geoPath().projection(projection);

    svg.append('path').datum({ type: 'Sphere' }).attr('class', 'sphere');
    svg.append('path').datum(d3.geoGraticule10()).attr('class', 'graticule');

    svg.selectAll('.country')
        .data(features)
        .enter().append('path')
        .attr('class', 'country')
        .on('pointerenter', (event, d) => { if (event.pointerType === 'mouse') showTip(event, d); })
        .on('pointermove', (event, d) => { if (event.pointerType === 'mouse') showTip(event, d); })
        .on('pointerleave', hideTip)
        .on('click', (event, d) => {
            if (gestureMoved) return;       // foi um arrasto/pinça, não um toque
            showTip(event, d);
            if (event.pointerType !== 'mouse') setTimeout(hideTip, 2200); // toque: some sozinho
        });

    // Um dedo (ou o mouse) arrasta e gira o globo; dois dedos fazem pinça (zoom).
    // A roda do mouse e os botões + e − também aproximam/afastam.
    setupPointerGestures(svg.node());
    svg.on('wheel', (event) => {
        event.preventDefault();
        zoom(event.deltaY < 0 ? 1.1 : 0.9);
    });

    $('zoom-in-btn').addEventListener('click', () => { playSound('click'); zoom(1.3); });
    $('zoom-out-btn').addEventListener('click', () => { playSound('click'); zoom(1 / 1.3); });
    $('center-map-btn').addEventListener('click', () => { playSound('click'); focusOnRoute(); });
    redrawPaths();
}

// ---- Gestos: arrastar (1 ponteiro) e pinça (2 ponteiros) com Pointer Events.
// Não usamos pointer capture de propósito: ele desviaria o "click" dos países.
let gestureMoved = false;   // o último gesto foi arrasto/pinça? (para ignorar o "click" seguinte)

function setupPointerGestures(element) {
    const pointers = new Map();   // pointerId -> { x, y }
    let pinchStartDistance = 0;
    let pinchStartScale = 0;
    let travel = 0;

    const pinchDistance = () => {
        const [a, b] = [...pointers.values()];
        return Math.hypot(a.x - b.x, a.y - b.y);
    };

    element.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        if (pointers.size === 0) { travel = 0; gestureMoved = false; }
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size === 2) {
            pinchStartDistance = pinchDistance();
            pinchStartScale = projection.scale();
            gestureMoved = true;
        }
        hideTip();
    });

    window.addEventListener('pointermove', (event) => {
        const last = pointers.get(event.pointerId);
        if (!last) return;
        const dx = event.clientX - last.x;
        const dy = event.clientY - last.y;
        last.x = event.clientX;
        last.y = event.clientY;
        travel += Math.hypot(dx, dy);
        if (travel > 5) gestureMoved = true;

        if (pointers.size === 2) {
            if (pinchStartDistance > 0) {
                const scale = pinchStartScale * (pinchDistance() / pinchStartDistance);
                projection.scale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale)));
                redrawPaths();
            }
        } else if (pointers.size === 1 && gestureMoved) {
            // dx/dy estão em pixels da tela; o desenho usa MAP_SIZE unidades
            const rect = element.getBoundingClientRect();
            const unit = MAP_SIZE / Math.min(rect.width, rect.height);   // o globo cabe no menor lado
            const [lambda, phi] = projection.rotate();
            const k = 75 / projection.scale();
            projection.rotate([lambda + dx * unit * k, Math.max(-90, Math.min(90, phi - dy * unit * k))]);
            redrawPaths();
        }
    });

    const release = (event) => {
        pointers.delete(event.pointerId);
        if (pointers.size === 1) gestureMoved = true;   // sobrou um dedo depois da pinça
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
}

function zoom(factor) {
    projection.scale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, projection.scale() * factor)));
    redrawPaths();
}

function redrawPaths() {
    svg.selectAll('.sphere, .graticule, .country').attr('d', pathGenerator);
}

// Classe visual de cada país no globo (a cor vem do CSS, que segue o tema).
function countryClass(id) {
    if (id === startId) return 'country is-start';
    if (id === endId) return 'country is-end';
    if (guessStates[id]) return `country g-${guessStates[id]}`;
    if (ended && idealPath.includes(id)) return 'country is-reveal';
    if (hintsUsed >= 1 && ((graph[startId] || []).includes(id) || (graph[endId] || []).includes(id))) return 'country is-near';
    if (hintsUsed >= 2 || ended) return 'country is-shown';
    return 'country';
}

function drawMap() {
    svg.selectAll('.country').attr('class', (d) => countryClass(featureId(d)));
}

// Gira o globo para mostrar o meio do caminho entre a origem e o destino.
function focusOnRoute() {
    const a = features.find((f) => featureId(f) === startId);
    const b = features.find((f) => featureId(f) === endId);
    if (!a || !b) return;
    const middle = d3.geoInterpolate(d3.geoCentroid(a), d3.geoCentroid(b))(0.5);
    const target = [-middle[0], -middle[1]];
    if (reducedMotion) {
        projection.rotate(target);
        redrawPaths();
        return;
    }
    const from = d3.interpolate(projection.rotate(), target);
    svg.transition().duration(800).tween('rotate', () => (progress) => {
        projection.rotate(from(progress));
        redrawPaths();
    });
}

// ---- Dica visual sobre o globo (nome do país ou, na dica 3, só a inicial)
function showTip(event, feature) {
    const id = featureId(feature);
    let text = null;
    if (ended || id === startId || id === endId || guessStates[id]) text = nameOf[id];
    else if (hintsUsed >= 3 && nameOf[id]) text = `${Array.from(nameOf[id])[0].toUpperCase()}.`;
    if (!text) { hideTip(); return; }
    const box = globeWrap.getBoundingClientRect();
    tooltipEl.textContent = text;
    tooltipEl.classList.remove('hidden');
    const x = Math.min(event.clientX - box.left + 14, box.width - tooltipEl.offsetWidth - 4);
    tooltipEl.style.left = `${Math.max(4, x)}px`;
    tooltipEl.style.top = `${Math.max(4, event.clientY - box.top - 30)}px`;
}

function hideTip() { tooltipEl.classList.add('hidden'); }

// ================= Interface (textos dependem do idioma) =================

function stateLabel(state) { return t(`rotas.state.${state}`); }
const STATE_MARK = { green: '✓', yellow: '~', gray: '✕' };

function makeChip(state) {
    const chip = document.createElement('span');
    chip.className = `chip ${state}`;
    chip.textContent = STATE_MARK[state];
    chip.setAttribute('role', 'img');
    chip.setAttribute('aria-label', stateLabel(state));
    return chip;
}

function renderRoute() {
    if (!ready) return;
    routeEl.removeAttribute('data-i18n');
    routeEl.textContent = '';
    const from = document.createElement('span');
    from.className = 'dot start';
    const to = document.createElement('span');
    to.className = 'dot end';
    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = '→';
    arrow.setAttribute('aria-hidden', 'true');
    const badge = document.createElement('span');
    badge.className = 'mode-badge';
    badge.textContent = mode === 'daily' ? t('rotas.mode.daily', { n: dailyNumber(daily.date) }) : t('rotas.mode.practice');
    routeEl.append(badge, from, nameOf[startId], arrow, to, nameOf[endId]);
    routeEl.setAttribute('aria-label', t('rotas.routeAria', { from: nameOf[startId], to: nameOf[endId] }));
}

function renderLegend() {
    legendEl.textContent = '';
    for (const state of ['green', 'yellow', 'gray']) {
        const item = document.createElement('li');
        item.append(makeChip(state), ' ', stateLabel(state));
        legendEl.append(item);
    }
}

function renderGuesses() {
    guessesListEl.textContent = '';
    if (guesses.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'empty';
        empty.textContent = t('rotas.guessesEmpty');
        guessesListEl.append(empty);
        return;
    }
    guesses.forEach((id, index) => {
        const item = document.createElement('li');
        const number = document.createElement('span');
        number.className = 'num';
        number.textContent = `${index + 1}.`;
        item.append(number, nameOf[id], makeChip(guessStates[id]));
        guessesListEl.append(item);
    });
}

function renderGuessButton() {
    guessBtn.textContent = t('rotas.guess', { n: guesses.length, max: maxGuesses });
}

function renderHints() {
    hintsTitleEl.textContent = t('rotas.hintsTitle', { n: hintsUsed });
    hintBtns.forEach((button, index) => {
        button.disabled = index !== hintsUsed || !!ended;     // só a próxima dica está liberada
        button.classList.toggle('used', index < hintsUsed);
    });
    hint3Note.classList.toggle('hidden', hintsUsed < 3);
}

function setStatus(key, extra = {}) {
    statusState = key ? { key, ...extra } : null;
    renderStatus();
}

function renderStatus() {
    if (!statusState) { statusEl.textContent = ''; return; }
    const { key, id, state } = statusState;
    statusEl.textContent = t(key, {
        name: id ? nameOf[id] : '',
        state: state ? stateLabel(state) : '',
    });
}

function renderResult() {
    if (!ended) return;
    $('result-title').textContent = t(ended.won ? 'rotas.win.title' : 'rotas.lose.title');
    const text = $('result-text');
    const note = [ended.won ? '' : t('rotas.lose.text'), mode === 'daily' ? t('rotas.daily.note') : ''].filter(Boolean);
    text.textContent = note.join(' ');
    text.classList.toggle('hidden', note.length === 0);

    const stats = $('result-stats');
    stats.textContent = '';
    const rows = [['rotas.win.ideal', minPath], ['rotas.win.guesses', guesses.length]];
    if (ended.won) {
        const misses = Math.max(0, guesses.length - minPath);
        rows.push(['rotas.win.errors', misses === 0 ? t('rotas.win.perfect') : misses]);
    }
    if (mode === 'daily') rows.push(['rotas.daily.streak', currentStreak()]);
    for (const [labelKey, value] of rows) {
        const row = document.createElement('div');
        const term = document.createElement('dt');
        term.textContent = t(labelKey);
        const detail = document.createElement('dd');
        detail.textContent = value;
        row.append(term, detail);
        stats.append(row);
    }

    // Um quadradinho por palpite, na ordem, com a cor/símbolo do resultado final.
    const marks = $('result-marks');
    marks.textContent = '';
    for (const id of guesses) {
        const item = document.createElement('li');
        item.append(makeChip(guessStates[id]));
        item.title = nameOf[id];
        marks.append(item);
    }

    const names = (ids) => ids.map((id) => nameOf[id]).join(' → ');
    $('your-route-block').classList.toggle('hidden', !ended.won);
    $('your-route').textContent = names(yourPath);
    $('ideal-route').textContent = names(idealPath);

    $('share-btn').classList.toggle('hidden', mode !== 'daily' && !ended.won);
    $('play-again-btn').textContent = t(mode === 'daily' ? 'rotas.practice' : 'rotas.playAgain');
    $('share-status').textContent = copied ? t('rotas.res.copied') : '';
}

// Texto para colar em conversas: rota, quadradinhos e número de palpites.
function shareText() {
    const square = { green: '🟩', yellow: '🟨', gray: '⬛' };
    const marks = guesses.map((id) => square[guessStates[id]]).join('');
    if (mode === 'daily') {
        // Sem a rota no texto, para não estragar o desafio de quem ainda não jogou.
        return [
            t('rotas.res.dailyHeader', { n: dailyNumber(daily.date) }),
            marks,
            ended && ended.won
                ? t('rotas.res.shareLine', { n: guesses.length, ideal: minPath })
                : t('rotas.res.dailyFail', { n: guesses.length }),
            siteUrl(),
        ].join('\n');
    }
    return [
        t('rotas.res.shareHeader', { from: nameOf[startId], to: nameOf[endId] }),
        marks,
        t('rotas.res.shareLine', { n: guesses.length, ideal: minPath }),
        siteUrl(),
    ].join('\n');
}

async function shareResult() {
    await copyText(shareText());
    playSound('click');
    copied = true;
    renderResult();
}

function renderAll() {
    renderRoute();
    renderLegend();
    renderGuesses();
    renderGuessButton();
    renderHints();
    renderStatus();
    renderResult();
}

// ================= Autocompletar =================

const suggestions = createAutocomplete({
    input: inputEl,
    list: suggestionsEl,
    getEntries: () => entries,
    isExcluded: (id) => id === startId || id === endId || guesses.includes(id),
    isEnabled: () => ready && !ended,
    onChoose: (id) => submitGuess(id),
    onEnter: () => submitTyped(),
});

// ================= Rodada =================

// ---- Desafio diário
const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayIndex = (key) => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
const dailyNumber = (key) => Math.max(1, dayIndex(key) - dayIndex(DAILY_FIRST_DAY) + 1);
function yesterdayKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return dateKey(new Date(y, m - 1, d - 1));
}

function seededRandom(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let x = Math.imul(a ^ (a >>> 15), 1 | a);
        x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}

// A rota do dia: a lista de pares é a mesma em todo aparelho, então a semente do dia escolhe igual.
function dailyRoute(key) {
    if (!routePairs) buildRoutePairs();
    const random = seededRandom((DAILY_SEED + dailyNumber(key) * 0x9E3779B1) >>> 0);
    random();   // a primeira saída de uma semente sequencial é pouco espalhada
    const pair = routePairs[Math.floor(random() * routePairs.length)];
    return random() < 0.5 ? [pair.a, pair.b, pair.d] : [pair.b, pair.a, pair.d];
}

function loadDaily() {
    const today = dateKey();
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(DAILY_KEY)) || {}; } catch (error) { saved = {}; }
    const base = { streak: saved.streak || 0, lastWin: saved.lastWin || null };
    if (saved.date === today && Array.isArray(saved.guesses)) {
        return { ...base, date: today, guesses: saved.guesses, hints: saved.hints || 0, ended: saved.ended || null };
    }
    return { ...base, date: today, guesses: [], hints: 0, ended: null };
}

function saveDaily() {
    try { localStorage.setItem(DAILY_KEY, JSON.stringify(daily)); } catch (error) { /* sem persistência */ }
}

function currentStreak() {
    const today = dateKey();
    return daily && (daily.lastWin === today || daily.lastWin === yesterdayKey(today)) ? daily.streak : 0;
}

// ---- Rodadas
function resetRound() {
    guesses = [];
    guessStates = {};
    hintsUsed = 0;
    ended = null;
    idealPath = [];
    statusState = null;
    yourPath = [];
    copied = false;
    hideTip();
}

function applyRoute([from, to, distance]) {
    startId = from;
    endId = to;
    minPath = distance - 1;                   // países que ficam ENTRE a origem e o destino
    maxGuesses = minPath + EXTRA_GUESSES;
    idealPath = shortestPath(startId, endId, null, true);   // para mostrar no final (uma das menores, sorteada)
}

function renderRound() {
    showPanels();
    inputEl.value = '';
    inputEl.disabled = !!ended;
    guessBtn.disabled = !!ended;
    suggestions.close();
    renderAll();
    drawMap();
    focusOnRoute();
    if (!ended) inputEl.focus({ preventScroll: true });
}

function startPractice() {
    mode = 'practice';
    resetRound();
    applyRoute(pickRoute());
    renderRound();
}

// Abre o desafio de hoje, retomando palpites/dicas/resultado se já começou (ou terminou).
function startDaily() {
    mode = 'daily';
    resetRound();
    daily = loadDaily();
    applyRoute(dailyRoute(daily.date));
    guesses = daily.guesses.filter((id) => id in graph);
    hintsUsed = daily.hints;
    if (guesses.length) evaluateGuesses();
    if (daily.ended) {
        ended = { won: !!daily.ended.won };
        yourPath = ended.won ? shortestPath(startId, endId, new Set([...guesses, startId])) || [] : [];
    }
    saveDaily();
    renderRound();
}

function submitGuess(id) {
    if (ended || !id) return;
    if (id === startId || id === endId) {
        inputEl.value = '';
        playSound('error');
        setStatus('rotas.inRoute', { id });
        return;
    }
    if (guesses.includes(id)) {
        inputEl.value = '';
        playSound('error');
        setStatus('rotas.duplicate', { id });
        return;
    }
    guesses.push(id);
    inputEl.value = '';
    suggestions.close();
    evaluateGuesses();
    setStatus('rotas.result', { id, state: guessStates[id] });
    renderGuesses();
    renderGuessButton();
    drawMap();
    if (mode === 'daily') { daily.guesses = [...guesses]; saveDaily(); }
    if (!checkEnd()) playSound({ green: 'success', yellow: 'detour', gray: 'click' }[guessStates[id]]);
}

function submitTyped() {
    const id = exact.get(normalize(inputEl.value.trim()));
    if (!id) {
        if (inputEl.value.trim()) { playSound('error'); setStatus('rotas.notFound'); }
        return;
    }
    submitGuess(id);
}

// Devolve true se a rodada acabou (vitória ou fim dos palpites).
function checkEnd() {
    const allowed = new Set([...guesses, startId]);
    const path = shortestPath(startId, endId, allowed);
    if (!path && guesses.length < maxGuesses) return false;

    ended = { won: !!path };
    yourPath = path || [];
    if (mode === 'daily') finishDaily();
    suggestions.close();
    hideTip();
    showPanels();
    renderResult();
    drawMap();
    playSound(ended.won ? 'win' : 'lose');
    $('play-again-btn').focus({ preventScroll: true });
    return true;
}

function finishDaily() {
    const today = dateKey();
    daily.ended = { won: ended.won };
    daily.guesses = [...guesses];
    daily.hints = hintsUsed;
    if (ended.won) {
        daily.streak = daily.lastWin === yesterdayKey(today) ? daily.streak + 1 : 1;
        daily.lastWin = today;
    } else {
        daily.streak = 0;
        daily.lastWin = null;
    }
    saveDaily();
}

// Ao acabar a rodada, busca/palpites/dicas dão lugar ao resultado (e o mapa fica livre).
function showPanels() {
    for (const panel of document.querySelectorAll('.guess-area, .guesses, .hints')) {
        panel.classList.toggle('hidden', !!ended);
    }
    resultEl.classList.toggle('hidden', !ended);
    document.querySelector('.rotas-layout').classList.toggle('is-ended', !!ended);
}

// ================= Dicas =================

hintBtns.forEach((button, index) => {
    button.addEventListener('click', () => {
        if (index !== hintsUsed || ended) return;
        hintsUsed++;
        if (mode === 'daily') { daily.hints = hintsUsed; saveDaily(); }
        playSound('click');
        renderHints();
        drawMap();
    });
});

// ================= Eventos =================

guessBtn.addEventListener('click', () => { suggestions.close(); submitTyped(); inputEl.focus(); });
$('play-again-btn').addEventListener('click', () => { playSound('click'); startPractice(); });
$('share-btn').addEventListener('click', shareResult);

// Configurações (tamanho da fonte)
function toggleSettings(force) {
    const open = typeof force === 'boolean' ? force : !settingsModal.classList.contains('active');
    settingsModal.classList.toggle('active', open);
    settingsBtn.setAttribute('aria-expanded', String(open));
}
settingsBtn.addEventListener('click', () => { playSound('click'); toggleSettings(); });
window.addEventListener('click', (event) => {
    if (!event.target.closest('.top-controls') && !event.target.closest('.settings-modal')) toggleSettings(false);
});
window.addEventListener('keydown', (event) => { if (event.key === 'Escape') toggleSettings(false); });

// Trocar o idioma no meio da rodada: nomes, textos e quadro final são refeitos.
onLangChange(() => {
    if (!ready) return;
    buildNames();
    suggestions.close();
    renderAll();
});

// ================= Início =================

async function init() {
    try {
        if (!d3) throw new Error('d3 não carregou');
        await Promise.all([loadData(), initI18n()]);
        buildNames();
        initSoundToggle();
        initGlobe();
        ready = true;
        startDaily();
    } catch (error) {
        console.error(error);
        await initI18n().catch(() => {});
        setText(routeEl, 'rotas.loadError');
    }
}

init();

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

const BORDERS_URL = new URL('../../data/world-borders.json', import.meta.url);
const MAP_URL = new URL('../../data/world-map.json', import.meta.url);
const COUNTRIES_URL = new URL('../../data/countries.json', import.meta.url);

const MIN_DISTANCE = 4;      // a origem e o destino ficam a 4 a 7 fronteiras de distância
const MAX_DISTANCE = 7;
const EXTRA_GUESSES = 10;    // palpites permitidos além do mínimo necessário
const END_DELAY_MS = 900;    // tempo para ver o mapa antes do quadro final
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
const endModal = $('end-modal');
const settingsBtn = $('settings-btn');
const settingsModal = $('settings-modal');

// ---------- Dados ----------
let graph = {};            // id (ISO alfa-3) -> ids vizinhos
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
let endTimer = null;
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

function distancesFrom(source) {
    const dist = { [source]: 0 };
    const queue = [source];
    for (let i = 0; i < queue.length; i++) {
        for (const next of graph[queue[i]] || []) {
            if (!(next in dist)) { dist[next] = dist[queue[i]] + 1; queue.push(next); }
        }
    }
    return dist;
}

// Menor caminho de `from` até `to`, passando só por `allowed` (se informado).
function shortestPath(from, to, allowed = null) {
    const previous = { [from]: null };
    const queue = [from];
    for (let i = 0; i < queue.length; i++) {
        const node = queue[i];
        if (node === to) {
            const path = [];
            for (let at = to; at !== null; at = previous[at]) path.unshift(at);
            return path;
        }
        for (const next of graph[node] || []) {
            if (next in previous) continue;
            if (allowed && !allowed.has(next) && next !== to) continue;
            previous[next] = node;
            queue.push(next);
        }
    }
    return null;
}

function evaluateGuesses() {
    const fromStart = distancesFrom(startId);
    const toEnd = distancesFrom(endId);
    const best = fromStart[endId];

    // Quais palpites já se ligam à origem (direta ou indiretamente, só por palpites)?
    const connected = new Set([startId]);
    let grew = true;
    while (grew) {
        grew = false;
        for (const id of guesses) {
            if (!connected.has(id) && (graph[id] || []).some((n) => connected.has(n))) {
                connected.add(id);
                grew = true;
            }
        }
    }
    guessStates = {};
    for (const id of guesses) {
        if (!connected.has(id)) guessStates[id] = 'gray';
        else guessStates[id] = fromStart[id] + toEnd[id] === best ? 'green' : 'yellow';
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
            showTip(event, d);
            if (event.pointerType !== 'mouse') setTimeout(hideTip, 2200); // toque: some sozinho
        });

    // Arrastar gira o globo; a roda do mouse aproxima/afasta.
    svg.call(d3.drag().on('drag', (event) => {
        const [lambda, phi] = projection.rotate();
        const k = 75 / projection.scale();
        projection.rotate([lambda + event.dx * k, Math.max(-90, Math.min(90, phi - event.dy * k))]);
        hideTip();
        redrawPaths();
    }));
    svg.on('wheel', (event) => {
        event.preventDefault();
        zoom(event.deltaY < 0 ? 1.1 : 0.9);
    });

    $('zoom-in-btn').addEventListener('click', () => zoom(1.3));
    $('zoom-out-btn').addEventListener('click', () => zoom(1 / 1.3));
    $('center-map-btn').addEventListener('click', focusOnRoute);
    redrawPaths();
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
    if (ended && !ended.won && idealPath.includes(id)) return 'country is-reveal';
    if (hintsUsed >= 1 && ((graph[startId] || []).includes(id) || (graph[endId] || []).includes(id))) return 'country is-near';
    if (hintsUsed >= 2) return 'country is-shown';
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
    if (id === startId || id === endId || guessStates[id]) text = nameOf[id];
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
    routeEl.append(from, nameOf[startId], arrow, to, nameOf[endId]);
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

function renderModal() {
    if (!ended) return;
    $('end-title').textContent = t(ended.won ? 'rotas.win.title' : 'rotas.lose.title');
    const text = $('end-text');
    text.textContent = ended.won ? '' : t('rotas.lose.text');
    text.classList.toggle('hidden', ended.won);

    const stats = $('end-stats');
    stats.textContent = '';
    const rows = [['rotas.win.ideal', minPath], ['rotas.win.guesses', guesses.length]];
    if (ended.won) {
        const misses = Math.max(0, guesses.length - minPath);
        rows.push(['rotas.win.errors', misses === 0 ? t('rotas.win.perfect') : misses]);
    }
    for (const [labelKey, value] of rows) {
        const row = document.createElement('div');
        const term = document.createElement('dt');
        term.textContent = t(labelKey);
        const detail = document.createElement('dd');
        detail.textContent = value;
        row.append(term, detail);
        stats.append(row);
    }
    $('ideal-route').textContent = idealPath.map((id) => nameOf[id]).join(' → ');
}

function renderAll() {
    renderRoute();
    renderLegend();
    renderGuesses();
    renderGuessButton();
    renderHints();
    renderStatus();
    renderModal();
}

// ================= Autocompletar =================

let suggestionIds = [];
let activeIndex = -1;

function closeSuggestions() {
    suggestionsEl.classList.add('hidden');
    suggestionsEl.textContent = '';
    suggestionIds = [];
    activeIndex = -1;
    inputEl.setAttribute('aria-expanded', 'false');
    inputEl.removeAttribute('aria-activedescendant');
}

function setActive(index) {
    const options = suggestionsEl.children;
    if (options.length === 0) return;
    activeIndex = (index + options.length) % options.length;
    [...options].forEach((option, i) => option.setAttribute('aria-selected', String(i === activeIndex)));
    inputEl.setAttribute('aria-activedescendant', options[activeIndex].id);
    options[activeIndex].scrollIntoView({ block: 'nearest' });
}

function highlight(name, query) {
    const fragment = document.createDocumentFragment();
    const normalized = normalize(name);
    const at = normalized.length === name.length ? normalized.indexOf(query) : -1;
    if (at === -1) {
        fragment.append(name);
    } else {
        const mark = document.createElement('mark');
        mark.textContent = name.slice(at, at + query.length);
        fragment.append(name.slice(0, at), mark, name.slice(at + query.length));
    }
    return fragment;
}

function updateSuggestions() {
    const query = normalize(inputEl.value.trim());
    closeSuggestions();
    if (!query || ended || !ready) return;
    const used = new Set([...guesses, startId, endId]);
    const rank = (entry) => (entry.keys.includes(query) ? 0 : entry.keys.some((k) => k.startsWith(query)) ? 1 : 2);
    const matches = entries
        .filter((entry) => !used.has(entry.id) && entry.keys.some((k) => k.includes(query)))
        .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, getLang()))
        .slice(0, 40);
    if (matches.length === 0) return;
    matches.forEach((entry, index) => {
        const option = document.createElement('li');
        option.id = `suggestion-${index}`;
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', 'false');
        option.append(highlight(entry.name, query));
        // pointerdown (e não click) para o campo não perder o foco antes da escolha
        option.addEventListener('pointerdown', (event) => { event.preventDefault(); chooseSuggestion(index); });
        suggestionsEl.append(option);
        suggestionIds.push(entry.id);
    });
    suggestionsEl.classList.remove('hidden');
    inputEl.setAttribute('aria-expanded', 'true');
}

function chooseSuggestion(index) {
    const id = suggestionIds[index];
    closeSuggestions();
    if (id) submitGuess(id);
}

// ================= Rodada =================

function startNewRound() {
    clearTimeout(endTimer);
    guesses = [];
    guessStates = {};
    hintsUsed = 0;
    ended = null;
    idealPath = [];
    statusState = null;
    endModal.classList.add('hidden');
    hideTip();

    const candidates = Object.keys(graph).filter((id) => graph[id].length > 0);
    for (let attempt = 0; attempt < 500; attempt++) {
        const from = candidates[Math.floor(Math.random() * candidates.length)];
        const dist = distancesFrom(from);
        const targets = Object.keys(dist).filter((id) => dist[id] >= MIN_DISTANCE && dist[id] <= MAX_DISTANCE);
        if (targets.length > 0) {
            startId = from;
            endId = targets[Math.floor(Math.random() * targets.length)];
            minPath = dist[endId] - 1;            // países que ficam ENTRE a origem e o destino
            maxGuesses = minPath + EXTRA_GUESSES;
            break;
        }
    }
    idealPath = shortestPath(startId, endId);       // para mostrar no final

    inputEl.value = '';
    inputEl.disabled = false;
    guessBtn.disabled = false;
    closeSuggestions();
    renderAll();
    drawMap();
    focusOnRoute();
    inputEl.focus({ preventScroll: true });
}

function submitGuess(id) {
    if (ended || !id) return;
    if (id === startId || id === endId) {
        inputEl.value = '';
        setStatus('rotas.inRoute', { id });
        return;
    }
    if (guesses.includes(id)) {
        inputEl.value = '';
        setStatus('rotas.duplicate', { id });
        return;
    }
    guesses.push(id);
    inputEl.value = '';
    closeSuggestions();
    evaluateGuesses();
    setStatus('rotas.result', { id, state: guessStates[id] });
    renderGuesses();
    renderGuessButton();
    drawMap();
    checkEnd();
}

function submitTyped() {
    const id = exact.get(normalize(inputEl.value.trim()));
    if (!id) {
        if (inputEl.value.trim()) setStatus('rotas.notFound');
        return;
    }
    submitGuess(id);
}

function checkEnd() {
    const allowed = new Set([...guesses, startId]);
    const connected = !!shortestPath(startId, endId, allowed);
    if (!connected && guesses.length < maxGuesses) return;

    ended = { won: connected };
    inputEl.disabled = true;
    guessBtn.disabled = true;
    closeSuggestions();
    renderHints();
    drawMap();
    renderModal();
    endTimer = setTimeout(() => {
        endModal.classList.remove('hidden');
        $('play-again-btn').focus();
    }, END_DELAY_MS);
}

// ================= Dicas =================

hintBtns.forEach((button, index) => {
    button.addEventListener('click', () => {
        if (index !== hintsUsed || ended) return;
        hintsUsed++;
        renderHints();
        drawMap();
    });
});

// ================= Eventos =================

inputEl.addEventListener('input', updateSuggestions);
inputEl.addEventListener('blur', () => setTimeout(closeSuggestions, 120));
inputEl.addEventListener('keydown', (event) => {
    const open = !suggestionsEl.classList.contains('hidden');
    if (event.key === 'ArrowDown') { event.preventDefault(); if (open) setActive(activeIndex + 1); else updateSuggestions(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); if (open) setActive(activeIndex - 1); }
    else if (event.key === 'Escape') { closeSuggestions(); }
    else if (event.key === 'Enter') {
        event.preventDefault();
        if (open && suggestionIds.length > 0) chooseSuggestion(activeIndex >= 0 ? activeIndex : 0);
        else submitTyped();
    }
});
guessBtn.addEventListener('click', () => { closeSuggestions(); submitTyped(); inputEl.focus(); });
$('play-again-btn').addEventListener('click', startNewRound);

// O quadro final só tem um botão: mantém o foco nele enquanto estiver aberto.
endModal.addEventListener('keydown', (event) => { if (event.key === 'Tab') { event.preventDefault(); $('play-again-btn').focus(); } });

// Configurações (tamanho da fonte)
function toggleSettings(force) {
    const open = typeof force === 'boolean' ? force : !settingsModal.classList.contains('active');
    settingsModal.classList.toggle('active', open);
    settingsBtn.setAttribute('aria-expanded', String(open));
}
settingsBtn.addEventListener('click', () => toggleSettings());
window.addEventListener('click', (event) => {
    if (!event.target.closest('.top-controls') && !event.target.closest('.settings-modal')) toggleSettings(false);
});
window.addEventListener('keydown', (event) => { if (event.key === 'Escape') toggleSettings(false); });

// Trocar o idioma no meio da rodada: nomes, textos e quadro final são refeitos.
onLangChange(() => {
    if (!ready) return;
    buildNames();
    closeSuggestions();
    renderAll();
});

// ================= Início =================

async function init() {
    try {
        if (!d3) throw new Error('d3 não carregou');
        await Promise.all([loadData(), initI18n()]);
        buildNames();
        initGlobe();
        ready = true;
        startNewRound();
    } catch (error) {
        console.error(error);
        await initI18n().catch(() => {});
        setText(routeEl, 'rotas.loadError');
    }
}

init();

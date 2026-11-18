import { t, setText, getLang, initI18n, onLangChange } from '../../js/i18n.js';
import { countryName, capitalName, matchesCountry, acceptedAnswers } from '../../js/country-names.js';
import { createAutocomplete } from '../../js/autocomplete.js';
import { playSound, initSoundToggle } from '../../js/sound.js';
import { copyText, siteUrl } from '../../js/share.js';
import { analyzeFlag, overlap, fraction, addMask, drawRevealed, drawFull, animateReveal } from './reveal.js';

// A lista de países fica em data/countries.json, compartilhada entre os jogos.
// import.meta.url resolve o caminho a partir deste arquivo, então funciona
// em qualquer hospedagem (inclusive em subpastas, como no GitHub Pages).
const COUNTRIES_URL = new URL('../../data/countries.json', import.meta.url);
let countries = [];

let activeCountries = [];
let currentCountry = null;
let score = 0;

// ---- Modos de jogo ----
//  daily   Desafio diário: uma bandeira por dia (igual para todos), escondida: cada palpite
//          revela os pedaços que têm cores iguais (ver reveal.js). 7 palpites. É a primeira
//          coisa que a pessoa vê; só depois de terminar aparecem o Treino e o Rush.
//  classic Treino: sequência de acertos, com cronômetro por bandeira (o jogo original).
//  rush    Rush: quantas bandeiras você acerta em 1 minuto; errar não tira pontos nem encerra.
let mode = 'classic';      // modo escolhido no menu (Treino ou Rush; o diário é a página de entrada)
let playMode = null;       // modo da partida em andamento (null = no menu)

const DAILY_ATTEMPTS = 7;
const DAILY_FIRST_DAY = '2026-11-11';   // data do desafio nº 1
const DAILY_SEED = 0x6a09e667;          // fixa: todo mundo embaralha igual (não mude, senão muda o calendário)
// O desafio diário só sorteia bandeiras bem conhecidas (as do Treino e do Rush usam todas).
const EASY_CODES = new Set(('ar au at be br ca cl cn co cu cz dk eg fi fr de gr hu in id ie il it jp kr mx nl nz ng no pk pe ph pl pt ru sa za es se ch th tr ua gb us ve vn ' +
    'bo ec uy py cr pa do jm ht ma dz tn ke et gh sn ao mz ir iq jo lb kw ae qa np lk my sg mn ro bg rs hr sk ee lv lt is cy mt lu mc bs bb tz zw cm sc').split(' '));
const RUSH_SECONDS = 60;
const RECENT_FLAGS = 20;    // uma bandeira acertada fica este número de rodadas sem voltar

// Chaves do localStorage. Antes da GGEO o jogo se chamava Flagle e usava chaves
// "flagle_*". Na primeira visita os valores antigos são COPIADOS para as chaves
// novas (as antigas não são apagadas, para ser possível voltar atrás).
const STORAGE = { records: 'ggeo_flag_records', recent: 'ggeo_flag_recent', daily: 'ggeo_flag_daily' };
const LEGACY_STORAGE = { records: 'flagle_records' };   // só os recordes têm versão antiga
// (O tamanho da fonte é guardado por js/font.js, preferência única de todos os jogos.)

function migrateLegacyStorage() {
    try {
        for (const name of Object.keys(LEGACY_STORAGE)) {
            const old = localStorage.getItem(LEGACY_STORAGE[name]);
            if (old !== null && localStorage.getItem(STORAGE[name]) === null) {
                localStorage.setItem(STORAGE[name], old);
            }
        }
    } catch (error) {
        console.warn('Não foi possível migrar dados antigos do localStorage:', error);
    }
}

function loadJson(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch (error) {
        return fallback; // dado corrompido ou localStorage bloqueado: começa do zero
    }
}

function saveJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* sem persistência */ }
}

function loadRecords() {
    const value = loadJson(STORAGE.records, {});
    return value && typeof value === 'object' ? value : {};
}

migrateLegacyStorage();
let records = loadRecords();
let hintUsed = false;

// Mensagem do resultado e dica são guardadas como DADOS (e não como texto pronto),
// para poderem ser reescritas se a pessoa trocar de idioma no meio da rodada.
let messageState = null; // { key, country, params?, hintNote? } — o texto é montado em renderMessage()
let hintVisible = false;

let maxTime = 15;
let currentTime = 15;
let timerInterval = null;
let selectedContinent = "all";
let flagReady = false;     // a imagem da bandeira atual já carregou
let retryPending = false;  // falha de rede: o botão grande tenta de novo

const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const flagImg = document.getElementById('flag-img');
const loader = document.getElementById('loader');
const guessInput = document.getElementById('guess-input');
const messageDiv = document.getElementById('message');
const scoreSpan = document.getElementById('score');
const recordSpan = document.getElementById('record');
const nextBtn = document.getElementById('next-btn');
const guessBtn = document.getElementById('guess-btn');
const timerBar = document.getElementById('timer-bar');
const timerContainer = document.getElementById('timer-container');
const settingsModal = document.getElementById('settings-modal');
const themeToggle = document.getElementById('theme-toggle');
const hintBox = document.getElementById('hint-box');
const startBtn = document.getElementById('start-btn');
const menuMessage = document.getElementById('menu-message');
const modeDesc = document.getElementById('mode-desc');
const menuDailyBtn = document.getElementById('menu-daily-btn');
const regionSection = document.getElementById('region-section');
const stat1Label = document.getElementById('stat1-label');
const stat2Label = document.getElementById('stat2-label');
const statTime = document.getElementById('stat-time');
const timeLeft = document.getElementById('time-left');
const hintBtn = document.getElementById('hint-btn');
const skipBtn = document.getElementById('skip-btn');
const gameArea = document.getElementById('game-area');
const flagContainer = document.querySelector('.flag-container');
const endPanel = document.getElementById('end-panel');
const endTitle = document.getElementById('end-title');
const endText = document.getElementById('end-text');
const endExtra = document.getElementById('end-extra');
const endAgainBtn = document.getElementById('end-again-btn');
const shareBtn = document.getElementById('share-btn');
const shareStatus = document.getElementById('share-status');
const flagCanvas = document.getElementById('flag-canvas');
const guessList = document.getElementById('guess-list');
const revealCaption = document.getElementById('reveal-caption');
const goClassicBtn = document.getElementById('go-classic-btn');
const goRushBtn = document.getElementById('go-rush-btn');
const backBtn = document.getElementById('back-btn');

async function loadCountries() {
    startBtn.disabled = true;
    try {
        const response = await fetch(COUNTRIES_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        countries = await response.json();
        startBtn.disabled = false;
    } catch (error) {
        console.error('Falha ao carregar data/countries.json:', error);
        setText(menuMessage, 'flag.loadError');
        menuMessage.className = "message error";
    }
}

// O tema (claro/escuro) é controlado por js/theme.js, compartilhado com a plataforma.
// Aqui só falta tocar o som de clique no botão de tema.
themeToggle.addEventListener('click', () => playSound('click'));

function toggleSettings() {
    playSound('click');
    settingsModal.classList.toggle('active');
}

window.addEventListener('click', function(e) {
    if (!e.target.closest('.top-controls') && !e.target.closest('.settings-modal')) {
        settingsModal.classList.remove('active');
    }
});

// ---------------------------------------------------------------------------
// Textos montados em JS (refeitos quando o idioma muda)
// ---------------------------------------------------------------------------

// Escreve a mensagem de resultado (acertou / errou / tempo) no idioma atual.
function renderMessage() {
    if (!messageState) {
        messageDiv.textContent = "";
        messageDiv.className = "message";
        return;
    }
    const name = countryName(messageState.country || currentCountry, getLang());
    let text = t(messageState.key, { name, ...(messageState.params || {}) });
    if (messageState.hintNote) text += t('flag.hintUsedNote');
    messageDiv.textContent = text;
}

function setMessage(state, kind) {
    messageState = state;
    renderMessage();
    messageDiv.className = state ? `message ${kind}` : 'message';
}

// Escreve a dica (capital + continente) no idioma atual.
function renderHint() {
    if (!hintVisible) {
        hintBox.textContent = "";
        hintBox.classList.remove('active');
        return;
    }
    const lang = getLang();
    hintBox.textContent = '';
    const label = document.createElement('strong');
    label.textContent = t('flag.hintLabel');
    hintBox.append(label, ' ' + t('flag.hintBody', {
        capital: capitalName(currentCountry, lang),
        continent: t(`continent.${currentCountry.continent}`),
    }));
    hintBox.classList.add('active');
}

const show = (element, visible) => element.classList.toggle('hidden', !visible);

// ---------------------------------------------------------------------------
// Sorteio sem repetir bandeiras acertadas há pouco
// ---------------------------------------------------------------------------

// Bandeiras locais (SVG do projeto flag-icons, licença MIT) em assets/flags/<código>.svg
const flagUrl = (country) => new URL(`../../assets/flags/${country.code}.svg`, import.meta.url).href;

function loadRecent() {
    const list = loadJson(STORAGE.recent, []);
    return Array.isArray(list) ? list : [];
}

// Guarda uma bandeira que a pessoa acertou: ela não volta nas próximas RECENT_FLAGS rodadas.
function rememberCorrect(country) {
    const list = loadRecent().filter((code) => code !== country.code);
    list.push(country.code);
    saveJson(STORAGE.recent, list.slice(-RECENT_FLAGS));
}

// Sorteia uma bandeira de `pool` fora da lista de recentes (e fora de `exclude`).
// Em regiões pequenas a janela encolhe (60% do tamanho), para sempre haver opções.
function pickCountry(pool, exclude = []) {
    const windowSize = Math.min(RECENT_FLAGS, Math.floor(pool.length * 0.6));
    const blocked = new Set(loadRecent().slice(-windowSize));
    for (const code of exclude) if (code) blocked.add(code);
    let candidates = pool.filter((country) => !blocked.has(country.code));
    if (candidates.length === 0) candidates = pool.filter((country) => !exclude.includes(country.code));
    if (candidates.length === 0) candidates = pool;
    return candidates[Math.floor(Math.random() * candidates.length)];
}

// ---------------------------------------------------------------------------
// Carregar a imagem da bandeira (todos os modos)
// ---------------------------------------------------------------------------

let loadToken = 0;
function loadFlag(country, { onReady = () => {}, onError = () => {} } = {}) {
    const token = ++loadToken;
    flagReady = false;
    flagImg.style.display = "none";
    loader.style.display = "block";
    setText(loader, 'flag.loading');

    flagImg.onload = () => {
        if (token !== loadToken) return;      // chegou atrasada: já passamos para outra bandeira
        flagReady = true;
        loader.style.display = "none";
        flagImg.style.display = "block";
        onReady();
    };
    flagImg.onerror = () => {
        if (token !== loadToken) return;
        setText(loader, 'flag.imageError');
        onError();
    };
    flagImg.removeAttribute('src');           // garante novo "load" mesmo para a mesma URL
    flagImg.src = flagUrl(country);
}

// Falha de rede não é culpa do jogador: oferece tentar de novo, sem perder nada.
function offerRetry(keyOfButton = 'flag.retry') {
    retryPending = true;
    guessInput.disabled = true;
    guessBtn.disabled = true;
    setText(nextBtn, keyOfButton);
    nextBtn.style.display = "block";
}

// ---------------------------------------------------------------------------
// Menu e escolha do modo
// ---------------------------------------------------------------------------

const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayIndex = (key) => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
const dailyNumber = (key) => dayIndex(key) - dayIndex(DAILY_FIRST_DAY) + 1;
function yesterdayKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return dateKey(new Date(y, m - 1, d - 1));
}

function loadDaily() {
    const today = dateKey();
    const saved = loadJson(STORAGE.daily, {});
    const base = { streak: saved.streak || 0, lastWin: saved.lastWin || null };
    // (O formato antigo, com `results` em vez de `guesses`, vale como "ainda não jogou hoje".)
    if (saved.date === today && Array.isArray(saved.guesses)) {
        return { ...base, date: today, guesses: saved.guesses, done: !!saved.done, won: !!saved.won, hint: !!saved.hint };
    }
    return { ...base, date: today, guesses: [], done: false, won: false, hint: false };
}
let daily = loadDaily();

function saveDaily() { saveJson(STORAGE.daily, daily); }

function currentStreak() {
    const today = dateKey();
    return daily.lastWin === today || daily.lastWin === yesterdayKey(today) ? daily.streak : 0;
}

// Embaralhamento com semente fixa: todo mundo obtém a mesma ordem das bandeiras do dia.
function seededRandom(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let x = Math.imul(a ^ (a >>> 15), 1 | a);
        x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}

// A bandeira de cada dia: percorre todos os países em ordem embaralhada (fixa),
// então não repete antes de passar por todos.
function dailyCountry(key) {
    const list = countries.filter((country) => EASY_CODES.has(country.code)).sort((a, b) => (a.code < b.code ? -1 : 1));
    const random = seededRandom(DAILY_SEED);
    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    const n = dailyNumber(key) - 1;
    return list[((n % list.length) + list.length) % list.length];
}

const MODE_DESC = { daily: 'flag.daily.desc', classic: 'flag.classic.desc', rush: 'flag.rush.desc' };

function renderMenu() {
    for (const tab of document.querySelectorAll('.mode-tab')) {
        tab.setAttribute('aria-pressed', String(tab.dataset.mode === mode));
    }
    setText(modeDesc, MODE_DESC[mode]);
    setText(startBtn, mode === 'rush' ? 'flag.rush.start' : 'flag.start');
}

function selectMode(next) {
    playSound('click');
    mode = next;
    renderMenu();
}

// ---------------------------------------------------------------------------
// Estrutura da tela de jogo, por modo
// ---------------------------------------------------------------------------

function setPlayLayout(which) {
    playMode = which;
    const reveal = which === 'daily' || which === 'classic';
    setText(stat1Label, reveal ? 'flag.stat.attempts' : 'flag.score');
    setText(stat2Label, which === 'daily' ? 'flag.stat.streak' : 'flag.record');
    show(statTime, which === 'rush');
    show(timerContainer, which === 'rush');
    show(hintBtn, which !== 'rush');
    show(skipBtn, which === 'rush');
    show(flagContainer, true);
    show(flagCanvas, reveal);
    show(guessList, reveal);
    show(revealCaption, reveal);
    show(shareBtn, true);
    show(backBtn, which !== 'daily');       // no diário o botão só aparece quando termina (veja showRevealEnd)
    if (reveal) { flagImg.style.display = 'none'; loader.style.display = 'none'; }
    else { flagCanvas.getContext('2d').clearRect(0, 0, flagCanvas.width, flagCanvas.height); }
    show(gameArea, true);
    show(endPanel, false);
    show(endAgainBtn, false);
    show(goClassicBtn, false);
    show(goRushBtn, false);
    nextBtn.style.display = "none";
    retryPending = false;
    hintVisible = false;
    renderHint();
    setMessage(null);
    shareStatus.textContent = '';
    shareStatus.removeAttribute('data-i18n');
    guessInput.value = "";
    guessInput.disabled = false;
    guessBtn.disabled = false;
    timerBar.style.width = "100%";
}

function startGame() {
    playSound('click');

    selectedContinent = document.getElementById('continent-select').value;
    activeCountries = selectedContinent === "all" ? [...countries] : countries.filter(c => c.continent === selectedContinent);
    if (activeCountries.length === 0) {
        alert(t('flag.noCountries'));
        return;
    }
    menuScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    if (mode === 'rush') startRush(); else startClassic();
}

function returnToMenu(withSound = true) {
    if (withSound === true) playSound('click');
    clearInterval(timerInterval);
    loadToken++;                 // ignora imagens que ainda estejam chegando
    rush.active = false;
    playMode = null;
    settingsModal.classList.remove('active');
    gameScreen.classList.add('hidden');
    menuScreen.classList.remove('hidden');
    renderMenu();
}

// ---------------------------------------------------------------------------
// Treino (mesma mecânica do diário, mas infinito: bandeira sorteada, sem salvar)
// ---------------------------------------------------------------------------

let practice = { guesses: [], done: false, won: false };
let practiceStreak = 0;     // bandeiras seguidas acertadas (sem dica) nesta sessão de treino

function startClassic() {
    practiceStreak = 0;
    startPracticeRound();
}

function startPracticeRound() {
    currentCountry = pickCountry(activeCountries, [currentCountry && currentCountry.code]);
    practice = { guesses: [], done: false, won: false };
    maxTime = 0;
    setPlayLayout('classic');
    hintUsed = false;
    hintVisible = false;
    renderHint();
    board = null;
    flagReady = false;
    renderRevealStats();
    renderGuessList();
    loadBoard();
}

function showHint() {
    playSound('click');
    hintUsed = true;
    hintVisible = true;
    if (playMode === 'daily') { daily.hint = true; saveDaily(); }
    renderHint();
}

// ---------------------------------------------------------------------------
// Modo Rush (1 minuto)
// ---------------------------------------------------------------------------

const rush = { active: false, started: false, endsAt: 0, score: 0, next: null, newRecord: false, previous: 0 };
let rushClock = null;

function startRush() {
    setPlayLayout('rush');
    rush.active = true;
    rush.started = false;      // o relógio só começa quando a primeira bandeira aparece
    rush.score = 0;
    rush.next = null;
    rush.newRecord = false;
    score = 0;
    scoreSpan.textContent = 0;
    recordSpan.textContent = records[`rush:${selectedContinent}`] || 0;
    timeLeft.textContent = RUSH_SECONDS;
    clearInterval(rushClock);
    currentCountry = null;
    rushAdvance();
    guessInput.focus();
}

// Mostra a próxima bandeira (já sorteada e pré-carregada, para não perder tempo de rede).
function rushAdvance() {
    currentCountry = rush.next || pickCountry(activeCountries, [currentCountry && currentCountry.code]);
    rush.next = null;
    guessInput.value = "";
    suggestions.close();
    loadFlag(currentCountry, {
        onReady: () => {
            if (!rush.active) return;
            if (!rush.started) {
                rush.started = true;
                rush.endsAt = Date.now() + RUSH_SECONDS * 1000;
                rushClock = setInterval(rushTick, 100);
            }
            // pré-carrega a seguinte
            rush.next = pickCountry(activeCountries, [currentCountry.code]);
            new Image().src = flagUrl(rush.next);
        },
        onError: () => { /* o botão "Pular" continua valendo */ },
    });
}

function rushTick() {
    const remaining = Math.max(0, (rush.endsAt - Date.now()) / 1000);
    timerBar.style.width = (remaining / RUSH_SECONDS) * 100 + "%";
    timeLeft.textContent = Math.ceil(remaining);
    if (remaining <= 0) endRush();
}

function rushGuess() {
    const text = guessInput.value;
    if (!rush.active || !flagReady || !text.trim()) return;
    const answered = currentCountry;

    if (matchesCountry(text, answered)) {
        playSound('success');
        rememberCorrect(answered);
        rush.score++;
        score = rush.score;
        scoreSpan.textContent = score;
        setMessage({ key: 'flag.rush.correct', country: answered }, 'success');
    } else {
        // Errar não encerra nem tira pontos: só não pontua, e segue para a próxima.
        playSound('error');
        setMessage({ key: 'flag.rush.wrong', country: answered }, 'error');
        guessInput.classList.add('shake');
        setTimeout(() => guessInput.classList.remove('shake'), 300);
    }
    rushAdvance();
}

function rushSkip() {
    if (!rush.active) return;
    playSound('click');
    setMessage({ key: 'flag.rush.skipped', country: currentCountry }, 'error');
    rushAdvance();
    guessInput.focus();
}

function endRush() {
    clearInterval(rushClock);
    rush.active = false;
    loadToken++;
    suggestions.close();

    const key = `rush:${selectedContinent}`;
    rush.previous = records[key] || 0;
    rush.newRecord = rush.score > rush.previous;
    if (rush.newRecord) {
        records[key] = rush.score;
        saveJson(STORAGE.records, records);
        recordSpan.textContent = rush.score;
    }
    playSound(rush.score > 0 ? 'win' : 'lose');

    timerBar.style.width = "0%";
    timeLeft.textContent = 0;
    show(flagContainer, false);
    show(gameArea, false);
    show(hintBtn, false);
    show(skipBtn, false);
    show(endAgainBtn, true);
    setMessage(null);
    renderEnd();
    show(endPanel, true);
    endAgainBtn.focus();
}

// ---------------------------------------------------------------------------
// Desafio diário (bandeira escondida, revelada pelas cores dos palpites)
// ---------------------------------------------------------------------------

// Estado da rodada com revelação: o diário (salvo) ou o treino (só na memória).
const state = () => (playMode === 'daily' ? daily : practice);

let board = null;          // { target (análise da bandeira do dia), revealed (máscara), rows: [{ code, percent }] }
let boardToken = 0;

function renderRevealStats() {
    scoreSpan.textContent = `${state().guesses.length}/${DAILY_ATTEMPTS}`;
    recordSpan.textContent = playMode === 'daily' ? currentStreak() : (records[selectedContinent] || 0);
}

function byCode(code) {
    return countries.find((country) => country.code === code);
}

// Lista de palpites: uma linha por tentativa (nome, % revelado, bandeira) e linhas vazias até o limite.
function renderGuessList() {
    guessList.textContent = '';
    const lang = getLang();
    for (let i = 0; i < DAILY_ATTEMPTS; i++) {
        const row = document.createElement('li');
        row.className = 'guess-row';
        const entry = board && board.rows[i];
        if (entry) {
            const country = byCode(entry.code);
            const name = document.createElement('span');
            name.className = 'guess-name';
            name.textContent = countryName(country, lang);
            const percent = document.createElement('span');
            percent.className = 'guess-percent';
            percent.textContent = entry.correct ? '100%' : `${entry.percent.toFixed(1)}%`;
            const flag = document.createElement('img');
            flag.className = 'guess-flag';
            flag.src = flagUrl(country);
            flag.alt = '';
            row.append(name, percent, flag);
            if (entry.correct) row.classList.add('is-correct');
        } else {
            row.classList.add('is-empty');
            row.append(document.createElement('span'), document.createElement('span'), document.createElement('span'));
        }
        guessList.append(row);
    }
}

// Soma o palpite à revelação e devolve a % que ELE revelou sozinho (0 a 100).
async function applyGuess(code) {
    const guessCountry = byCode(code);
    const guess = await analyzeFlag(flagUrl(guessCountry), { width: board.target.width, height: board.target.height });
    const result = overlap(board.target, guess);
    addMask(board.revealed, result.mask);
    const percent = fraction(board.target, result.count) * 100;
    board.rows.push({ code, percent, correct: code === currentCountry.code });
    return percent;
}

function drawBoard() {
    if (state().done) drawFull(flagCanvas, board.target);
    else drawRevealed(flagCanvas, board.target, board.revealed);
    renderGuessList();
    renderRevealStats();
}

// Prepara a bandeira do dia e refaz o estado salvo (palpites e fim, se já terminou).
async function loadBoard() {
    const token = ++boardToken;
    retryPending = false;
    nextBtn.style.display = 'none';
    guessInput.disabled = state().done;
    guessBtn.disabled = state().done;
    try {
        const target = await analyzeFlag(flagUrl(currentCountry));
        if (token !== boardToken) return;
        board = { target, revealed: new Uint8Array(target.width * target.height), rows: [] };
        for (const code of state().guesses) {
            if (byCode(code)) await applyGuess(code);
        }
        if (token !== boardToken) return;
        flagReady = true;
        drawBoard();
        if (state().done) showRevealEnd(); else guessInput.focus({ preventScroll: true });
    } catch (error) {
        console.error('Falha ao carregar a bandeira do dia:', error);
        flagReady = false;
        setMessage({ key: 'flag.imageError', country: currentCountry }, 'error');
        offerRetry('flag.retry');
    }
}

function startDaily() {
    daily = loadDaily();                     // pode ter virado o dia desde a última leitura
    currentCountry = dailyCountry(dateKey());
    menuScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    maxTime = 0;
    setPlayLayout('daily');
    hintUsed = daily.hint;
    hintVisible = daily.hint;
    renderHint();
    board = null;
    flagReady = false;
    renderRevealStats();
    renderGuessList();
    loadBoard();
}

// Descobre qual país o texto digitado nomeia (no idioma atual).
function findCountry(text) {
    return countries.find((country) => matchesCountry(text, country)) || null;
}

async function revealGuess() {
    const text = guessInput.value;
    if (state().done || !flagReady || !text.trim() || dailyBusy) return;

    const guessed = findCountry(text);
    if (!guessed) {                                     // não é um país da lista: não gasta tentativa
        playSound('error');
        setMessage({ key: 'flag.daily.unknown', country: currentCountry }, 'error');
        guessInput.classList.add('shake');
        setTimeout(() => guessInput.classList.remove('shake'), 300);
        return;
    }
    if (state().guesses.includes(guessed.code)) {         // repetido também não gasta
        setMessage({ key: 'flag.daily.duplicate', country: guessed }, 'error');
        return;
    }

    dailyBusy = true;
    try {
        state().guesses.push(guessed.code);
        const before = board.revealed.slice();
        await applyGuess(guessed.code);
        guessInput.value = '';
        suggestions.close();
        if (guessed.code === currentCountry.code) {
            state().done = true;
            state().won = true;
        } else if (state().guesses.length >= DAILY_ATTEMPTS) {
            state().done = true;
            state().won = false;
        }
        if (state().done) {
            renderGuessList();
            const all = new Uint8Array(board.revealed.length).fill(1);
            await animateReveal(flagCanvas, board.target, before, all);   // no fim, a bandeira inteira aparece
            drawBoard();
            finishReveal();
            return;
        }
        playSound('detour');
        const last = board.rows[board.rows.length - 1];
        setMessage({ key: 'flag.daily.wrong', country: currentCountry, params: { n: DAILY_ATTEMPTS - state().guesses.length, p: last.percent.toFixed(1) } }, 'error');
        if (playMode === 'daily') saveDaily();
        renderGuessList();
        renderRevealStats();
        animateReveal(flagCanvas, board.target, before, board.revealed);
    } finally {
        dailyBusy = false;
    }
}
let dailyBusy = false;

function finishReveal() {
    if (playMode === 'daily') {
        const today = dateKey();
        if (daily.won) {
            daily.streak = daily.lastWin === yesterdayKey(today) ? daily.streak + 1 : 1;
            daily.lastWin = today;
            rememberCorrect(currentCountry);   // (não afeta o sorteio do diário, só o dos outros modos)
        }
        saveDaily();
    } else {
        rememberCorrect(currentCountry);
        if (practice.won && !hintUsed) {
            practiceStreak++;
            if (practiceStreak > (records[selectedContinent] || 0)) {
                records[selectedContinent] = practiceStreak;
                saveJson(STORAGE.records, records);
            }
        } else if (!practice.won) {
            practiceStreak = 0;
        }
    }
    renderRevealStats();
    playSound(state().won ? 'win' : 'lose');
    showRevealEnd();
}

function showRevealEnd() {
    const isDaily = playMode === 'daily';
    suggestions.close();
    guessInput.disabled = true;
    guessBtn.disabled = true;
    show(gameArea, false);
    show(hintBtn, false);
    show(revealCaption, false);
    show(goClassicBtn, isDaily);
    show(goRushBtn, isDaily);
    show(endAgainBtn, !isDaily);        // treino: "Jogar novamente"
    show(shareBtn, isDaily);
    show(backBtn, !isDaily);            // diário: segue para Treino/Rush (botões) ou volta ao GGEO (topo)
    setMessage(null);
    renderEnd();
    show(endPanel, true);
    (isDaily ? shareBtn : endAgainBtn).focus({ preventScroll: true });
}

// Depois do diário: Treino e Rush ficam disponíveis no menu.
function goToMode(next) {
    playSound('click');
    mode = next;
    returnToMenu(false);
}

// ---------------------------------------------------------------------------
// Painel de fim (Desafio diário e Rush) e compartilhar
// ---------------------------------------------------------------------------

function renderEnd() {
    if (!endPanel || !playMode) return;
    if (playMode === 'rush') {
        endTitle.textContent = t('flag.rush.endTitle');
        endText.textContent = t('flag.rush.endText', { n: rush.score });
        endExtra.textContent = rush.newRecord ? t('flag.rush.newRecord') : t('flag.rush.recordLine', { n: rush.previous });
        return;
    }
    const name = countryName(currentCountry, getLang());
    const round = state();
    endTitle.textContent = t(round.won ? 'flag.daily.winTitle' : 'flag.daily.loseTitle');
    endText.textContent = round.won
        ? t('flag.daily.win', { name, n: round.guesses.length, max: DAILY_ATTEMPTS })
        : t(playMode === 'classic' ? 'flag.practice.lose' : 'flag.daily.lose', { name });
    if (playMode === 'classic') {
        endExtra.textContent = t('flag.practice.streakLine', { n: practiceStreak, r: records[selectedContinent] || 0 });
        return;
    }
    const streak = currentStreak();
    endExtra.textContent = t('flag.daily.comeBack') + (streak > 0 ? ' ' + t('flag.daily.streakLine', { n: streak }) : '');
}

function shareText() {
    if (playMode === 'rush') {
        const region = t(`flag.region.${selectedContinent}`);
        return [t('flag.share.rushHeader'), t('flag.share.rushLine', { n: rush.score, region }), siteUrl()].join('\n');
    }
    // Um quadrado por palpite, do mais longe ao mais perto da bandeira (sem revelar nada do país).
    const tier = (entry) => (entry.correct ? '🟩' : entry.percent < 10 ? '⬛' : entry.percent < 25 ? '🟥' : entry.percent < 45 ? '🟧' : '🟨');
    const squares = board.rows.map(tier).join('');
    const tries = `${daily.won ? daily.guesses.length : 'X'}/${DAILY_ATTEMPTS}`;
    return [
        t('flag.share.dailyHeader', { n: dailyNumber(daily.date) }),
        `${squares} ${tries}${daily.hint ? ' 💡' : ''}`,
        siteUrl(),
    ].join('\n');
}

async function shareResult() {
    const ok = await copyText(shareText());
    playSound('click');
    setText(shareStatus, ok ? 'share.copied' : 'share.failed');
}

// ---------------------------------------------------------------------------
// Entrada do jogador (Enter, botão Enviar, sugestões)
// ---------------------------------------------------------------------------

function handleAction() {
    playSound('click');
    if (playMode === 'rush') return rushGuess();
    return revealGuess();
}

function handleRoundAction() {
    playSound('click');
    if (retryPending) {                           // tenta carregar a MESMA bandeira de novo
        setMessage(null);
        loadBoard();
    }
}

// Sugestões de países enquanto digita (setas, Enter, mouse). Escolher uma
// sugestão já envia o palpite, como no Rotas. O Enter com a lista fechada
// envia o que está digitado.
let searchEntries = [];
function buildSearchEntries() {
    const lang = getLang();
    searchEntries = countries.map((country) => ({
        id: country.code,
        name: countryName(country, lang),
        keys: [...acceptedAnswers(country, lang)],
    }));
}

function canType() {
    if (guessInput.disabled) return false;
    if (playMode === 'rush') return rush.active;
    return !state().done;
}

const suggestions = createAutocomplete({
    input: guessInput,
    list: document.getElementById('suggestions'),
    getEntries: () => searchEntries,
    isEnabled: canType,
    onChoose: (id, name) => {
        guessInput.value = name;
        handleAction();
    },
    onEnter: handleAction,
});

// Não existe listener de Enter para o botão "Próxima": um <button> já dispara
// "click" ao apertar Enter, e um segundo listener rodava a ação duas vezes
// (sorteando dois países por vez).

// Os botões eram ligados por onclick="..." no HTML. Como o script agora é um
// módulo (suas funções não são globais), a ligação é feita aqui.
startBtn.addEventListener('click', startGame);
menuDailyBtn.addEventListener('click', () => { playSound('click'); startDaily(); });
hintBtn.addEventListener('click', showHint);
skipBtn.addEventListener('click', rushSkip);
guessBtn.addEventListener('click', handleAction);
nextBtn.addEventListener('click', handleRoundAction);
shareBtn.addEventListener('click', shareResult);
endAgainBtn.addEventListener('click', () => { playSound('click'); if (playMode === 'rush') startRush(); else startPracticeRound(); });
backBtn.addEventListener('click', () => returnToMenu());
goClassicBtn.addEventListener('click', () => goToMode('classic'));
goRushBtn.addEventListener('click', () => goToMode('rush'));
document.getElementById('settings-btn').addEventListener('click', toggleSettings);
document.getElementById('font-size-select').addEventListener('change', () => playSound('click'));
for (const tab of document.querySelectorAll('.mode-tab')) {
    tab.addEventListener('click', () => selectMode(tab.dataset.mode));
}

// Se a pessoa trocar o idioma no meio da rodada, o que foi montado em JS é refeito.
onLangChange(() => {
    renderMessage();
    renderHint();
    renderMenu();
    if ((playMode === 'daily' || playMode === 'classic') && board) renderGuessList();
    if (!endPanel.classList.contains('hidden')) renderEnd();
    buildSearchEntries();
    suggestions.close();
});

initSoundToggle();
await initI18n();
await loadCountries();
buildSearchEntries();
renderMenu();
// A primeira coisa que a pessoa vê é o desafio diário; o menu (Treino e Rush) vem depois.
if (countries.length > 0) startDaily();

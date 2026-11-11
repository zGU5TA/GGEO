import { t, setText, getLang, initI18n, onLangChange } from '../../js/i18n.js';
import { countryName, capitalName, matchesCountry, acceptedAnswers } from '../../js/country-names.js';
import { createAutocomplete } from '../../js/autocomplete.js';
import { playSound, initSoundToggle } from '../../js/sound.js';
import { copyText, siteUrl } from '../../js/share.js';

// A lista de países fica em data/countries.json, compartilhada entre os jogos.
// import.meta.url resolve o caminho a partir deste arquivo, então funciona
// em qualquer hospedagem (inclusive em subpastas, como no GitHub Pages).
const COUNTRIES_URL = new URL('../../data/countries.json', import.meta.url);
let countries = [];

let activeCountries = [];
let currentCountry = null;
let score = 0;

// ---- Modos de jogo ----
//  daily   Desafio diário: uma bandeira por dia (igual para todos), 3 tentativas. É o padrão.
//  classic Clássico: sequência de acertos, com cronômetro por bandeira (o jogo original).
//  rush    Rush: quantas bandeiras você acerta em 1 minuto; errar não tira pontos nem encerra.
let mode = 'daily';        // modo escolhido no menu
let playMode = null;       // modo da partida em andamento (null = no menu)

const DAILY_ATTEMPTS = 3;
const DAILY_FIRST_DAY = '2026-11-11';   // data do desafio nº 1
const DAILY_SEED = 0x6a09e667;          // fixa: todo mundo embaralha igual (não mude, senão muda o calendário)
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
let roundEnded = false;
let isLost = false;
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
const dailyStatus = document.getElementById('daily-status');
const regionSection = document.getElementById('region-section');
const difficultySection = document.getElementById('difficulty-section');
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

const flagUrl = (country) => `https://flagcdn.com/w640/${country.code}.png`;

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
    if (saved.date === today && Array.isArray(saved.results)) {
        return { ...base, date: today, results: saved.results, done: !!saved.done, won: !!saved.won, hint: !!saved.hint };
    }
    return { ...base, date: today, results: [], done: false, won: false, hint: false };
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
    const list = [...countries].sort((a, b) => (a.code < b.code ? -1 : 1));
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
    show(regionSection, mode !== 'daily');
    show(difficultySection, mode === 'classic');
    show(dailyStatus, mode === 'daily');

    if (mode === 'daily') {
        const key = dateKey();
        const n = dailyNumber(key);
        const streak = currentStreak();
        let text = t(daily.done ? 'flag.daily.statusDone' : 'flag.daily.statusPending', { n });
        if (streak > 0) text += ' ' + t('flag.daily.streakLine', { n: streak });
        dailyStatus.textContent = text;
        setText(startBtn, daily.done ? 'flag.daily.view' : 'flag.daily.play');
    } else {
        setText(startBtn, mode === 'rush' ? 'flag.rush.start' : 'flag.start');
    }
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
    setText(stat1Label, which === 'daily' ? 'flag.stat.attempts' : 'flag.score');
    setText(stat2Label, which === 'daily' ? 'flag.stat.streak' : 'flag.record');
    show(statTime, which === 'rush');
    show(timerContainer, which === 'rush' || (which === 'classic' && maxTime !== 0));
    show(hintBtn, which !== 'rush');
    show(skipBtn, which === 'rush');
    show(flagContainer, true);
    show(gameArea, true);
    show(endPanel, false);
    show(endAgainBtn, false);
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
    if (mode === 'daily') return startDaily();

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

function returnToMenu() {
    playSound('click');
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
// Modo Clássico (o jogo original: sequência de acertos, tempo por bandeira)
// ---------------------------------------------------------------------------

function startClassic() {
    maxTime = parseInt(document.getElementById('difficulty-select').value);
    setPlayLayout('classic');
    score = 0;
    scoreSpan.textContent = score;
    recordSpan.textContent = records[selectedContinent] || 0;
    loadNewCountry();
}

function loadNewCountry() {
    clearInterval(timerInterval);
    roundEnded = false;
    hintUsed = false;
    hintVisible = false;
    renderHint();
    setMessage(null);
    nextBtn.style.display = "none";
    retryPending = false;
    guessInput.value = "";
    guessInput.disabled = false;
    guessBtn.disabled = false;

    currentCountry = pickCountry(activeCountries, [currentCountry && currentCountry.code]);

    loadFlag(currentCountry, {
        onReady: startTimer,
        onError: () => {
            // Falha de rede não é culpa do jogador: não zera a pontuação e oferece
            // sortear outra bandeira, em vez de deixar o jogo travado.
            isLost = false;
            roundEnded = true;
            guessInput.disabled = true;
            guessBtn.disabled = true;
            setText(nextBtn, 'flag.retry');
            nextBtn.style.display = "block";
        },
    });
}

function showHint() {
    playSound('click');
    hintUsed = true;
    hintVisible = true;
    if (playMode === 'daily') { daily.hint = true; saveDaily(); }
    renderHint();
}

function startTimer() {
    if (maxTime === 0) return;

    currentTime = maxTime;
    updateTimerBar();

    timerInterval = setInterval(() => {
        currentTime -= 0.1;
        updateTimerBar();

        if (currentTime <= 0) {
            clearInterval(timerInterval);
            timeOut();
        }
    }, 100);
}

function updateTimerBar() {
    const percentage = (currentTime / maxTime) * 100;
    timerBar.style.width = percentage + "%";
}

function timeOut() {
    playSound('error');
    isLost = true;
    setMessage({ key: 'flag.timeout', country: currentCountry }, 'error');
    score = 0;
    scoreSpan.textContent = score;
    endRound();
}

function checkGuess() {
    const userGuess = guessInput.value;
    // Campo vazio: não faz nada e o cronômetro continua correndo.
    if (!userGuess.trim()) return;

    clearInterval(timerInterval);

    // Aceita o nome do país no idioma em que se joga (ver js/country-names.js).
    const isMatch = matchesCountry(userGuess, currentCountry);

    if (isMatch) {
        playSound('success');
        isLost = false;
        rememberCorrect(currentCountry);
        setMessage({ key: 'flag.correct', country: currentCountry, hintNote: hintUsed }, 'success');

        if (!hintUsed) {
            score++;
            scoreSpan.textContent = score;
            if (score > (records[selectedContinent] || 0)) {
                records[selectedContinent] = score;
                saveJson(STORAGE.records, records);
                recordSpan.textContent = score;
            }
        }
    } else {
        playSound('error');
        isLost = true;
        setMessage({ key: 'flag.incorrect', country: currentCountry }, 'error');
        score = 0;
        scoreSpan.textContent = score;

        guessInput.classList.add('shake');
        setTimeout(() => guessInput.classList.remove('shake'), 300);
    }
    endRound();
}

function endRound() {
    roundEnded = true;
    suggestions.close();
    guessInput.disabled = true;
    guessBtn.disabled = true;

    setText(nextBtn, isLost ? 'flag.restart' : 'flag.next');
    nextBtn.style.display = "block";
    nextBtn.focus();
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
// Desafio diário
// ---------------------------------------------------------------------------

function renderDailyStats() {
    scoreSpan.textContent = `${daily.results.length}/${DAILY_ATTEMPTS}`;
    recordSpan.textContent = currentStreak();
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
    renderDailyStats();

    loadFlag(currentCountry, { onError: () => offerRetry('flag.retry') });

    if (daily.done) {
        showDailyEnd();
    } else {
        guessInput.focus();
    }
}

function dailyGuess() {
    const text = guessInput.value;
    if (daily.done || !flagReady || !text.trim()) return;

    if (matchesCountry(text, currentCountry)) {
        playSound('success');
        daily.results.push('v');
        daily.done = true;
        daily.won = true;
        finishDaily();
        return;
    }

    playSound('error');
    daily.results.push('x');
    guessInput.classList.add('shake');
    setTimeout(() => guessInput.classList.remove('shake'), 300);
    if (daily.results.length >= DAILY_ATTEMPTS) {
        daily.done = true;
        daily.won = false;
        finishDaily();
        return;
    }
    guessInput.value = "";
    setMessage({ key: 'flag.daily.wrong', country: currentCountry, params: { n: DAILY_ATTEMPTS - daily.results.length } }, 'error');
    saveDaily();
    renderDailyStats();
}

function finishDaily() {
    const today = dateKey();
    if (daily.won) {
        daily.streak = daily.lastWin === yesterdayKey(today) ? daily.streak + 1 : 1;
        daily.lastWin = today;
        rememberCorrect(currentCountry);   // (não afeta o sorteio do diário, só o dos outros modos)
    }
    saveDaily();
    renderDailyStats();
    playSound(daily.won ? 'win' : 'lose');
    showDailyEnd();
}

function showDailyEnd() {
    suggestions.close();
    guessInput.disabled = true;
    guessBtn.disabled = true;
    show(gameArea, false);
    show(hintBtn, false);
    setMessage(null);
    renderEnd();
    show(endPanel, true);
    shareBtn.focus();
}

// ---------------------------------------------------------------------------
// Painel de fim (Desafio diário e Rush) e compartilhar
// ---------------------------------------------------------------------------

function renderEnd() {
    if (!endPanel || (playMode !== 'daily' && playMode !== 'rush')) return;
    if (playMode === 'rush') {
        endTitle.textContent = t('flag.rush.endTitle');
        endText.textContent = t('flag.rush.endText', { n: rush.score });
        endExtra.textContent = rush.newRecord ? t('flag.rush.newRecord') : t('flag.rush.recordLine', { n: rush.previous });
        return;
    }
    const name = countryName(currentCountry, getLang());
    endTitle.textContent = t(daily.won ? 'flag.daily.winTitle' : 'flag.daily.loseTitle');
    endText.textContent = daily.won
        ? t('flag.daily.win', { name, n: daily.results.length, max: DAILY_ATTEMPTS })
        : t('flag.daily.lose', { name });
    const streak = currentStreak();
    endExtra.textContent = t('flag.daily.comeBack') + (streak > 0 ? ' ' + t('flag.daily.streakLine', { n: streak }) : '');
}

function shareText() {
    if (playMode === 'rush') {
        const region = t(`flag.region.${selectedContinent}`);
        return [t('flag.share.rushHeader'), t('flag.share.rushLine', { n: rush.score, region }), siteUrl()].join('\n');
    }
    const squares = daily.results.map((r) => (r === 'v' ? '🟩' : '🟥')).join('');
    const tries = `${daily.won ? daily.results.length : 'X'}/${DAILY_ATTEMPTS}`;
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
    if (playMode === 'daily') return dailyGuess();
    if (!roundEnded) {
        checkGuess();
    } else {
        handleRoundAction();
    }
}

function handleRoundAction() {
    playSound('click');
    if (retryPending) {                      // diário: tenta carregar a MESMA bandeira de novo
        retryPending = false;
        nextBtn.style.display = "none";
        guessInput.disabled = daily.done;
        guessBtn.disabled = daily.done;
        loadFlag(currentCountry, { onError: () => offerRetry('flag.retry') });
        return;
    }
    loadNewCountry();
    guessInput.focus();
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
    if (playMode === 'daily') return !daily.done;
    return !roundEnded;
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
hintBtn.addEventListener('click', showHint);
skipBtn.addEventListener('click', rushSkip);
guessBtn.addEventListener('click', handleAction);
nextBtn.addEventListener('click', handleRoundAction);
shareBtn.addEventListener('click', shareResult);
endAgainBtn.addEventListener('click', () => { playSound('click'); startRush(); });
document.getElementById('back-btn').addEventListener('click', returnToMenu);
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
    if (!endPanel.classList.contains('hidden')) renderEnd();
    buildSearchEntries();
    suggestions.close();
});

initSoundToggle();
await initI18n();
await loadCountries();
buildSearchEntries();
renderMenu();

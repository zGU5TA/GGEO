// A lista de países fica em data/countries.json, compartilhada entre os jogos.
// import.meta.url resolve o caminho a partir deste arquivo, então funciona
// em qualquer hospedagem (inclusive em subpastas, como no GitHub Pages).
const COUNTRIES_URL = new URL('../../data/countries.json', import.meta.url);
let countries = [];

let activeCountries = [];
let availableCountries = [];
let currentCountry = null;
let score = 0;
let records = JSON.parse(localStorage.getItem('flagle_records')) || {};
let roundEnded = false;
let isLost = false;
let hintUsed = false;

let maxTime = 15;
let currentTime = 15;
let timerInterval = null;
let selectedContinent = "all";

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

async function loadCountries() {
    startBtn.disabled = true;
    try {
        const response = await fetch(COUNTRIES_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        countries = await response.json();
        startBtn.disabled = false;
    } catch (error) {
        console.error('Falha ao carregar data/countries.json:', error);
        menuMessage.textContent = "Não foi possível carregar a lista de países. Recarregue a página.";
        menuMessage.className = "message error";
    }
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    if (type === 'success') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.setValueAtTime(100, now + 0.1);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('flagle_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeToggle.textContent = savedTheme === 'dark' ? '🌙' : '☀️';

    const savedFont = localStorage.getItem('flagle_font') || 'medium';
    document.documentElement.setAttribute('data-font', savedFont);
    document.getElementById('font-size-select').value = savedFont;
});

function toggleTheme() {
    playSound('click');
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    themeToggle.textContent = newTheme === 'dark' ? '🌙' : '☀️';
    localStorage.setItem('flagle_theme', newTheme);
}

function toggleSettings() {
    playSound('click');
    settingsModal.classList.toggle('active');
}

function changeFontSize(size) {
    playSound('click');
    document.documentElement.setAttribute('data-font', size);
    localStorage.setItem('flagle_font', size);
}

window.addEventListener('click', function(e) {
    if (!e.target.closest('.top-controls') && !e.target.closest('.settings-modal')) {
        settingsModal.classList.remove('active');
    }
});

function normalizeString(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function startGame() {
    playSound('click');
    selectedContinent = document.getElementById('continent-select').value;
    maxTime = parseInt(document.getElementById('difficulty-select').value);

    if (selectedContinent === "all") {
        activeCountries = [...countries];
    } else {
        activeCountries = countries.filter(c => c.continent === selectedContinent);
    }

    if (activeCountries.length === 0) {
        alert("Não há países suficientes.");
        return;
    }

    availableCountries = [...activeCountries];
    score = 0;
    scoreSpan.textContent = score;
    recordSpan.textContent = records[selectedContinent] || 0;

    menuScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');

    if (maxTime === 0) {
        timerContainer.classList.add('hidden');
    } else {
        timerContainer.classList.remove('hidden');
    }

    loadNewCountry();
}

function returnToMenu() {
    playSound('click');
    clearInterval(timerInterval);
    settingsModal.classList.remove('active');
    gameScreen.classList.add('hidden');
    menuScreen.classList.remove('hidden');
}

function loadNewCountry() {
    clearInterval(timerInterval);
    roundEnded = false;
    hintUsed = false;
    hintBox.classList.remove('active');
    hintBox.textContent = "";
    messageDiv.textContent = "";
    nextBtn.style.display = "none";
    guessInput.value = "";
    guessInput.disabled = false;
    guessBtn.disabled = false;
    flagImg.style.display = "none";
    loader.style.display = "block";
    loader.textContent = "Carregando bandeira...";

    if (availableCountries.length === 0) {
        availableCountries = [...activeCountries];
    }

    const randomIndex = Math.floor(Math.random() * availableCountries.length);
    currentCountry = availableCountries[randomIndex];
    availableCountries.splice(randomIndex, 1);

    flagImg.src = `https://flagcdn.com/w640/${currentCountry.code}.png`;
    
    flagImg.onload = () => {
        loader.style.display = "none";
        flagImg.style.display = "block";
        startTimer();
    };
    
    flagImg.onerror = () => {
        loader.textContent = "Erro ao carregar imagem.";
    };
}

function showHint() {
    playSound('click');
    hintUsed = true;
    const contNames = { Americas: "Américas", Europe: "Europa", Asia: "Ásia", Africa: "África", Oceania: "Oceania" };
    hintBox.innerHTML = `<strong>Dica:</strong> Capital: ${currentCountry.capital} | Continente: ${contNames[currentCountry.continent] || currentCountry.continent}`;
    hintBox.classList.add('active');
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
    messageDiv.textContent = `Tempo esgotado! O país era: ${currentCountry.name}.`;
    messageDiv.className = "message error";
    score = 0;
    scoreSpan.textContent = score;
    endRound();
}

function checkGuess() {
    clearInterval(timerInterval);
    const userGuess = guessInput.value;
    if (!userGuess.trim()) return;

    const cleanGuess = normalizeString(userGuess);
    const correctMain = normalizeString(currentCountry.name);
    const isMatch = cleanGuess === correctMain || currentCountry.aliases.some(alias => normalizeString(alias) === cleanGuess);

    if (isMatch) {
        playSound('success');
        isLost = false;
        messageDiv.textContent = `Correto! É ${currentCountry.name}.`;
        messageDiv.className = "message success";
        
        if (!hintUsed) {
            score++;
            scoreSpan.textContent = score;
            if (score > (records[selectedContinent] || 0)) {
                records[selectedContinent] = score;
                localStorage.setItem('flagle_records', JSON.stringify(records));
                recordSpan.textContent = score;
            }
        } else {
            messageDiv.textContent += " (Dica usada: sem pontuação nesta rodada)";
        }
    } else {
        playSound('error');
        isLost = true;
        messageDiv.textContent = `Incorreto. O país era: ${currentCountry.name}.`;
        messageDiv.className = "message error";
        score = 0;
        scoreSpan.textContent = score;
        
        guessInput.classList.add('shake');
        setTimeout(() => guessInput.classList.remove('shake'), 300);
    }
    endRound();
}

function endRound() {
    roundEnded = true;
    guessInput.disabled = true;
    guessBtn.disabled = true;
    
    if (isLost) {
        nextBtn.textContent = "Recomeçar";
    } else {
        nextBtn.textContent = "Próxima Bandeira";
    }

    nextBtn.style.display = "block";
    nextBtn.focus();
}

function handleAction() {
    playSound('click');
    if (!roundEnded) {
        checkGuess();
    } else {
        handleRoundAction();
    }
}

function handleRoundAction() {
    playSound('click');
    if (isLost) {
        availableCountries = [...activeCountries];
    }
    loadNewCountry();
    guessInput.focus();
}

guessInput.addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        handleAction();
    }
});

nextBtn.addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        handleRoundAction();
    }
});

// Os botões eram ligados por onclick="..." no HTML. Como o script agora é um
// módulo (suas funções não são globais), a ligação é feita aqui.
startBtn.addEventListener('click', startGame);
document.getElementById('hint-btn').addEventListener('click', showHint);
guessBtn.addEventListener('click', handleAction);
nextBtn.addEventListener('click', handleRoundAction);
document.getElementById('back-btn').addEventListener('click', returnToMenu);
themeToggle.addEventListener('click', toggleTheme);
document.getElementById('settings-btn').addEventListener('click', toggleSettings);
document.getElementById('font-size-select').addEventListener('change', (event) => changeFontSize(event.target.value));

loadCountries();

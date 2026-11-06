const countries = [
    // --- AMÉRICAS ---
    { name: "Brasil", code: "br", continent: "Americas", capital: "Brasília", aliases: ["brasil"] },
    { name: "Estados Unidos", code: "us", continent: "Americas", capital: "Washington, D.C.", aliases: ["eua", "estados unidos", "usa", "america"] },
    { name: "Canadá", code: "ca", continent: "Americas", capital: "Ottawa", aliases: ["canada"] },
    { name: "Argentina", code: "ar", continent: "Americas", capital: "Buenos Aires", aliases: ["argentina"] },
    { name: "México", code: "mx", continent: "Americas", capital: "Cidade do México", aliases: ["mexico"] },
    { name: "Colômbia", code: "co", continent: "Americas", capital: "Bogotá", aliases: ["colombia"] },
    { name: "Chile", code: "cl", continent: "Americas", capital: "Santiago", aliases: ["chile"] },
    { name: "Peru", code: "pe", continent: "Americas", capital: "Lima", aliases: ["peru"] },
    { name: "Uruguai", code: "uy", continent: "Americas", capital: "Montevidéu", aliases: ["uruguai"] },
    { name: "Venezuela", code: "ve", continent: "Americas", capital: "Caracas", aliases: ["venezuela"] },
    { name: "Bolívia", code: "bo", continent: "Americas", capital: "Sucre", aliases: ["bolivia"] },
    { name: "Paraguai", code: "py", continent: "Americas", capital: "Assunção", aliases: ["paraguai"] },
    { name: "Equador", code: "ec", continent: "Americas", capital: "Quito", aliases: ["equador"] },
    { name: "Cuba", code: "cu", continent: "Americas", capital: "Havana", aliases: ["cuba"] },
    { name: "Costa Rica", code: "cr", continent: "Americas", capital: "San José", aliases: ["costa rica"] },
    { name: "Panamá", code: "pa", continent: "Americas", capital: "Cidade do Panamá", aliases: ["panama"] },
    { name: "República Dominicana", code: "do", continent: "Americas", capital: "Santo Domingo", aliases: ["republica dominicana", "dominicana"] },
    { name: "Honduras", code: "hn", continent: "Americas", capital: "Tegucigalpa", aliases: ["honduras"] },
    { name: "Guatemala", code: "gt", continent: "Americas", capital: "Cidade da Guatemala", aliases: ["guatemala"] },
    { name: "El Salvador", code: "sv", continent: "Americas", capital: "San Salvador", aliases: ["el salvador", "salvador"] },
    { name: "Trinidad e Tobago", code: "tt", continent: "Americas", capital: "Porto Espanha", aliases: ["trinidad e tobago", "trinidad", "trinidad e tobago"] },
    { name: "Jamaica", code: "jm", continent: "Americas", capital: "Kingston", aliases: ["jamaica"] },
    { name: "Bahamas", code: "bs", continent: "Americas", capital: "Nassau", aliases: ["bahamas"] },
    { name: "Barbados", code: "bb", continent: "Americas", capital: "Bridgetown", aliases: ["barbados"] },
    { name: "Haiti", code: "ht", continent: "Americas", capital: "Porto Príncipe", aliases: ["haiti"] },
    { name: "Nicarágua", code: "ni", continent: "Americas", capital: "Manágua", aliases: ["nicaragua"] },
    { name: "Belize", code: "bz", continent: "Americas", capital: "Belmopã", aliases: ["belize"] },
    { name: "Guiana", code: "gy", continent: "Americas", capital: "Georgetown", aliases: ["guiana"] },
    { name: "Suriname", code: "sr", continent: "Americas", capital: "Paramaribo", aliases: ["suriname", "suriname"] },
    { name: "Dominica", code: "dm", continent: "Americas", capital: "Roseau", aliases: ["dominica"] },
    { name: "Santa Lúcia", code: "lc", continent: "Americas", capital: "Castries", aliases: ["santa lucia"] },
    { name: "Granada", code: "gd", continent: "Americas", capital: "Saint George's", aliases: ["granada"] },

    // --- EUROPA ---
    { name: "Portugal", code: "pt", continent: "Europe", capital: "Lisboa", aliases: ["portugal"] },
    { name: "Espanha", code: "es", continent: "Europe", capital: "Madri", aliases: ["espanha"] },
    { name: "França", code: "fr", continent: "Europe", capital: "Paris", aliases: ["franca"] },
    { name: "Alemanha", code: "de", continent: "Europe", capital: "Berlim", aliases: ["alemanha"] },
    { name: "Itália", code: "it", continent: "Europe", capital: "Roma", aliases: ["italia"] },
    { name: "Reino Unido", code: "gb", continent: "Europe", capital: "Londres", aliases: ["reino unido", "inglaterra", "uk", "gra-bretanha"] },
    { name: "Suíça", code: "ch", continent: "Europe", capital: "Berna", aliases: ["suica"] },
    { name: "Suécia", code: "se", continent: "Europe", capital: "Estocolmo", aliases: ["suecia"] },
    { name: "Noruega", code: "no", continent: "Europe", capital: "Oslo", aliases: ["noruega"] },
    { name: "Dinamarca", code: "dk", continent: "Europe", capital: "Copenhague", aliases: ["dinamarca"] },
    { name: "Finlândia", code: "fi", continent: "Europe", capital: "Helsinque", aliases: ["finlandia"] },
    { name: "Islândia", code: "is", continent: "Europe", capital: "Reiquiavique", aliases: ["islandia"] },
    { name: "Bélgica", code: "be", continent: "Europe", capital: "Bruxelas", aliases: ["belgica"] },
    { name: "Países Baixos", code: "nl", continent: "Europe", capital: "Amsterdã", aliases: ["paises baixos", "holanda"] },
    { name: "Áustria", code: "at", continent: "Europe", capital: "Viena", aliases: ["austria"] },
    { name: "Grécia", code: "gr", continent: "Europe", capital: "Atenas", aliases: ["grecia"] },
    { name: "Polônia", code: "pl", continent: "Europe", capital: "Varsóvia", aliases: ["polonia"] },
    { name: "Ucrânia", code: "ua", continent: "Europe", capital: "Kiev", aliases: ["ucrania"] },
    { name: "Rússia", code: "ru", continent: "Europe", capital: "Moscou", aliases: ["russia"] },
    { name: "Irlanda", code: "ie", continent: "Europe", capital: "Dublin", aliases: ["irlanda"] },
    { name: "República Tcheca", code: "cz", continent: "Europe", capital: "Praga", aliases: ["republica tcheca", "tchequia"] },
    { name: "Hungria", code: "hu", continent: "Europe", capital: "Budapeste", aliases: ["hungria"] },
    { name: "Romênia", code: "ro", continent: "Europe", capital: "Bucareste", aliases: ["romenia"] },
    { name: "Croácia", code: "hr", continent: "Europe", capital: "Zagrebe", aliases: ["croacia"] },
    { name: "Sérvia", code: "rs", continent: "Europe", capital: "Belgrado", aliases: ["servia"] },
    { name: "Bulgária", code: "bg", continent: "Europe", capital: "Sófia", aliases: ["bulgaria"] },
    { name: "Eslováquia", code: "sk", continent: "Europe", capital: "Bratislava", aliases: ["eslovaquia"] },
    { name: "Liechtenstein", code: "li", continent: "Europe", capital: "Vaduz", aliases: ["liechtenstein"] },
    { name: "San Marino", code: "sm", continent: "Europe", capital: "San Marino", aliases: ["san marino"] },
    { name: "Mônaco", code: "mc", continent: "Europe", capital: "Mônaco", aliases: ["monaco"] },
    { name: "Andorra", code: "ad", continent: "Europe", capital: "Andorra-a-Velha", aliases: ["andorra"] },
    { name: "Malta", code: "mt", continent: "Europe", capital: "Valeta", aliases: ["malta"] },
    { name: "Estônia", code: "ee", continent: "Europe", capital: "Tallinn", aliases: ["estonia"] },
    { name: "Letônia", code: "lv", continent: "Europe", capital: "Riga", aliases: ["letonia"] },
    { name: "Lituânia", code: "lt", continent: "Europe", capital: "Vilnius", aliases: ["lituania"] },
    { name: "Luxemburgo", code: "lu", continent: "Europe", capital: "Luxemburgo", aliases: ["luxemburgo"] },
    { name: "Albânia", code: "al", continent: "Europe", capital: "Tirana", aliases: ["albania"] },
    { name: "Chipre", code: "cy", continent: "Europe", capital: "Nicósia", aliases: ["chipre"] },
    { name: "Islas Feroe", code: "fo", continent: "Europe", capital: "Tórshavn", aliases: ["ilhas faroe", "faroe", "islas feroe"] },

    // --- ÁSIA ---
    { name: "Japão", code: "jp", continent: "Asia", capital: "Tóquio", aliases: ["japao"] },
    { name: "China", code: "cn", continent: "Asia", capital: "Pequim", aliases: ["china"] },
    { name: "Coreia do Sul", code: "kr", continent: "Asia", capital: "Seul", aliases: ["coreia do sul", "coreia"] },
    { name: "Índia", code: "in", continent: "Asia", capital: "Nova Deli", aliases: ["india"] },
    { name: "Turquia", code: "tr", continent: "Asia", capital: "Ancara", aliases: ["turquia"] },
    { name: "Arábia Saudita", code: "sa", continent: "Asia", capital: "Riade", aliases: ["arabia saudita"] },
    { name: "Emirados Árabes Unidos", code: "ae", continent: "Asia", capital: "Abu Dhabi", aliases: ["emirados arabes", "eau"] },
    { name: "Israel", code: "il", continent: "Asia", capital: "Jerusalém", aliases: ["israel"] },
    { name: "Tailândia", code: "th", continent: "Asia", capital: "Bangcoc", aliases: ["tailandia"] },
    { name: "Vietnã", code: "vn", continent: "Asia", capital: "Hanói", aliases: ["vietna"] },
    { name: "Indonésia", code: "id", continent: "Asia", capital: "Jacarta", aliases: ["indonesia"] },
    { name: "Filipinas", code: "ph", continent: "Asia", capital: "Manila", aliases: ["filipinas"] },
    { name: "Malásia", code: "my", continent: "Asia", capital: "Kuala Lumpur", aliases: ["malasia"] },
    { name: "Singapura", code: "sg", continent: "Asia", capital: "Singapura", aliases: ["singapura"] },
    { name: "Paquistão", code: "pk", continent: "Asia", capital: "Islamabade", aliases: ["paquistao"] },
    { name: "Irã", code: "ir", continent: "Asia", capital: "Teerã", aliases: ["ira"] },
    { name: "Iraque", code: "iq", continent: "Asia", capital: "Bagdá", aliases: ["iraque"] },
    { name: "Catar", code: "qa", continent: "Asia", capital: "Doha", aliases: ["catar", "qatar"] },
    { name: "Brunei", code: "bn", continent: "Asia", capital: "Bandar Seri Begawan", aliases: ["brunei"] },
    { name: "Mongólia", code: "mn", continent: "Asia", capital: "Ulã Bator", aliases: ["mongolia"] },
    { name: "Nepal", code: "np", continent: "Asia", capital: "Katmandu", aliases: ["nepal"] },
    { name: "Sri Lanka", code: "lk", continent: "Asia", capital: "Sri Jayawardenepura Kotte", aliases: ["sri lanka"] },
    { name: "Cazaquistão", code: "kz", continent: "Asia", capital: "Astana", aliases: ["cazaquistao"] },
    { name: "Uzbequistão", code: "uz", continent: "Asia", capital: "Tasquente", aliases: ["uzbequistao"] },
    { name: "Omã", code: "om", continent: "Asia", capital: "Mascate", aliases: ["oman", "oma"] },
    { name: "Jordânia", code: "jo", continent: "Asia", capital: "Amã", aliases: ["jordania"] },
    { name: "Líbano", code: "lb", continent: "Asia", capital: "Beirute", aliases: ["libano"] },
    { name: "Kuwait", code: "kw", continent: "Asia", capital: "Kuwait", aliases: ["kuwait"] },

    // --- ÁFRICA ---
    { name: "África do Sul", code: "za", continent: "Africa", capital: "Pretória / Cidade do Cabo", aliases: ["africa do sul"] },
    { name: "Egito", code: "eg", continent: "Africa", capital: "Cairo", aliases: ["egito"] },
    { name: "Marrocos", code: "ma", continent: "Africa", capital: "Rabat", aliases: ["marrocos"] },
    { name: "Nigéria", code: "ng", continent: "Africa", capital: "Abuja", aliases: ["nigeria"] },
    { name: "Quênia", code: "ke", continent: "Africa", capital: "Nairóbi", aliases: ["quenia"] },
    { name: "Gana", code: "gh", continent: "Africa", capital: "Acra", aliases: ["gana"] },
    { name: "Argélia", code: "dz", continent: "Africa", capital: "Argel", aliases: ["argelia"] },
    { name: "Tunísia", code: "tn", continent: "Africa", capital: "Túnis", aliases: ["tunisia"] },
    { name: "Senegal", code: "sn", continent: "Africa", capital: "Dacar", aliases: ["senegal"] },
    { name: "Etiópia", code: "et", continent: "Africa", capital: "Adis Abeba", aliases: ["etiopia"] },
    { name: "Camarões", code: "cm", continent: "Africa", capital: "Yaoundé", aliases: ["camaroes"] },
    { name: "Madagascar", code: "mg", continent: "Africa", capital: "Antananarivo", aliases: ["madagascar"] },
    { name: "Ilhas Maurício", code: "mu", continent: "Africa", capital: "Port Louis", aliases: ["mauricio", "ilhas mauricio"] },
    { name: "Seicheles", code: "sc", continent: "Africa", capital: "Vitória", aliases: ["seicheles", "seychelles"] },
    { name: "Ruanda", code: "rw", continent: "Africa", capital: "Kigali", aliases: ["ruanda"] },
    { name: "Zimbábue", code: "zw", continent: "Africa", capital: "Harare", aliases: ["zimbabue"] },
    { name: "Tanzânia", code: "tz", continent: "Africa", capital: "Dodoma", aliases: ["tanzania"] },
    { name: "Angola", code: "ao", continent: "Africa", capital: "Luanda", aliases: ["angola"] },
    { name: "Moçambique", code: "mz", continent: "Africa", capital: "Maputo", aliases: ["mocambique"] },
    { name: "Cabo Verde", code: "cv", continent: "Africa", capital: "Praia", aliases: ["cabo verde"] },

    // --- OCEANIA ---
    { name: "Austrália", code: "au", continent: "Oceania", capital: "Camberra", aliases: ["australia"] },
    { name: "Nova Zelândia", code: "nz", continent: "Oceania", capital: "Wellington", aliases: ["nova zelândia", "nova zelanda"] },
    { name: "Fiji", code: "fj", continent: "Oceania", capital: "Suva", aliases: ["fiji"] },
    { name: "Papua-Nova Guiné", code: "pg", continent: "Oceania", capital: "Port Moresby", aliases: ["papua", "papua nova guine"] },
    { name: "Samoa", code: "ws", continent: "Oceania", capital: "Apia", aliases: ["samoa"] },
    { name: "Tonga", code: "to", continent: "Oceania", capital: "Nuku'alofa", aliases: ["tonga"] },
    { name: "Vanuatu", code: "vu", continent: "Oceania", capital: "Port Vila", aliases: ["vanuatu"] },
    { name: "Ilhas Salomão", code: "sb", continent: "Oceania", capital: "Honiara", aliases: ["ilhas salomao", "salomao"] },
    { name: "Micronésia", code: "fm", continent: "Oceania", capital: "Palikir", aliases: ["micronesia"] }
];

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

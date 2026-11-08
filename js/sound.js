/*
 * GGEO — efeitos sonoros compartilhados pelos jogos.
 *
 * Os sons são gerados na hora pelo navegador (Web Audio), sem arquivos de áudio.
 * Tipos: click, success, error, detour, win, lose.
 *
 * A pessoa pode desligar tudo na janela de configurações (⚙️): um
 * <input type="checkbox" data-sound-toggle> é ligado por initSoundToggle().
 * Preferência salva em localStorage: ggeo_sound = "off" (ausente = ligado).
 */
const KEY = 'ggeo_sound';

let audioCtx = null;
let enabled = true;
try { enabled = localStorage.getItem(KEY) !== 'off'; } catch (error) { /* sem localStorage */ }

export function isSoundOn() { return enabled; }

export function setSoundOn(on) {
    enabled = !!on;
    try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (error) { /* sem persistência */ }
}

/** Liga o(s) checkbox(es) [data-sound-toggle] da página à preferência. */
export function initSoundToggle() {
    for (const box of document.querySelectorAll('[data-sound-toggle]')) {
        box.checked = enabled;
        box.addEventListener('change', () => {
            setSoundOn(box.checked);
            playSound('click');
        });
    }
}

// Uma nota: frequência (ou rampa de f0 para f1), duração, volume e onda.
function note(ctx, start, { type = 'sine', f0, f1 = null, dur, vol }) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(f0, start);
    if (f1) osc.frequency.exponentialRampToValueAtTime(f1, start + dur * 0.75);
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.01, start + dur);
    osc.start(start);
    osc.stop(start + dur);
}

const SOUNDS = {
    click:   [{ type: 'sine', f0: 600, dur: 0.05, vol: 0.05 }],
    success: [{ type: 'triangle', f0: 440, f1: 880, dur: 0.2, vol: 0.15 }],
    error:   [{ type: 'sawtooth', f0: 150, f1: 100, dur: 0.3, vol: 0.2 }],
    // conectado, mas fora da menor rota: um "quase"
    detour:  [{ type: 'triangle', f0: 330, f1: 392, dur: 0.18, vol: 0.13 }],
    // vitória: arpejo subindo
    win: [
        { type: 'triangle', f0: 523, dur: 0.14, vol: 0.15, at: 0 },
        { type: 'triangle', f0: 659, dur: 0.14, vol: 0.15, at: 0.11 },
        { type: 'triangle', f0: 784, dur: 0.14, vol: 0.15, at: 0.22 },
        { type: 'triangle', f0: 1047, dur: 0.35, vol: 0.15, at: 0.33 },
    ],
    // derrota: três notas descendo
    lose: [
        { type: 'sawtooth', f0: 330, dur: 0.18, vol: 0.12, at: 0 },
        { type: 'sawtooth', f0: 262, dur: 0.18, vol: 0.12, at: 0.16 },
        { type: 'sawtooth', f0: 196, dur: 0.4, vol: 0.12, at: 0.32 },
    ],
};

export function playSound(type) {
    if (!enabled || !SOUNDS[type]) return;
    try {
        // O AudioContext só nasce no primeiro som (depois de um gesto da pessoa).
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const now = audioCtx.currentTime;
        for (const spec of SOUNDS[type]) note(audioCtx, now + (spec.at || 0), spec);
    } catch (error) {
        // navegador sem Web Audio: o jogo segue sem som
    }
}

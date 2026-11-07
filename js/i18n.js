/*
 * GGEO — idiomas (internacionalização).
 *
 * Os textos de cada idioma ficam em i18n/<codigo>.json, num formato simples:
 *     { "chave.do.texto": "Texto traduzido, com {parametros}." }
 * O português (i18n/pt.json) é a referência: se uma chave faltar em outro
 * idioma, aparece o texto em português.
 *
 * No HTML, marque o elemento com a chave:
 *     <h2 data-i18n="home.aboutTitle">Sobre a GGEO</h2>
 *     <input data-i18n-attr="placeholder:flag.placeholder; aria-label:flag.placeholder">
 * O texto escrito dentro do HTML é o PORTUGUÊS padrão (serve para quem está sem
 * JavaScript e para o primeiro desenho da página).
 *
 * No JavaScript:
 *     t('flag.correct', { name: 'Brasil' })   // texto traduzido com parâmetros
 *     setText(elemento, 'flag.next')           // coloca o texto e acompanha trocas de idioma
 *     onLangChange(() => ...)                  // refaça aqui o que foi montado em JS
 *
 * Precisa de js/lang.js carregado antes, no <head> (ele escolhe o idioma).
 */

const boot = window.GGEO_LANG;
if (!boot) {
    throw new Error('js/lang.js precisa ser carregado no <head> antes de js/i18n.js');
}

export const LANGUAGES = boot.languages;
export const DEFAULT_LANG = boot.default;

let currentLang = boot.current;
let dictionary = {};
let fallbackDictionary = {};

const dictionaryCache = new Map();
const listeners = new Set();

export function getLang() {
    return currentLang;
}

export function langTag(code = currentLang) {
    const language = LANGUAGES.find(l => l.code === code);
    return language ? language.tag : code;
}

/** Carrega (uma vez só) o dicionário de um idioma. */
function loadDictionary(code) {
    if (!dictionaryCache.has(code)) {
        const url = new URL(`../i18n/${code}.json`, import.meta.url);
        const request = fetch(url).then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status} em i18n/${code}.json`);
            return response.json();
        });
        // Se falhar, esquece o resultado para uma próxima tentativa poder funcionar.
        request.catch(() => dictionaryCache.delete(code));
        dictionaryCache.set(code, request);
    }
    return dictionaryCache.get(code);
}

/** Texto traduzido. Se a chave não existir em lugar nenhum, devolve a própria chave. */
export function t(key, params) {
    let text = dictionary[key];
    if (text === undefined) text = fallbackDictionary[key];
    if (text === undefined) return key;
    if (params) {
        text = text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? params[name] : match));
    }
    return text;
}

/**
 * Coloca um texto traduzido (SEM parâmetros) num elemento e o marca para ser
 * traduzido de novo quando o idioma mudar.
 */
export function setText(element, key) {
    element.dataset.i18n = key;
    element.textContent = t(key);
}

/** Traduz tudo que estiver marcado com data-i18n / data-i18n-attr dentro de `root`. */
export function applyTranslations(root = document) {
    for (const element of root.querySelectorAll('[data-i18n]')) {
        element.textContent = t(element.dataset.i18n);
    }
    for (const element of root.querySelectorAll('[data-i18n-attr]')) {
        for (const pair of element.dataset.i18nAttr.split(';')) {
            const [attribute, key] = pair.split(':').map(part => part.trim());
            if (attribute && key) element.setAttribute(attribute, t(key));
        }
    }
}

/** O botão de tema muda de função (claro <-> escuro), então o rótulo depende do tema atual. */
function updateThemeLabels() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const label = t(isLight ? 'theme.toDark' : 'theme.toLight');
    for (const button of document.querySelectorAll('[data-theme-toggle]')) {
        button.setAttribute('aria-label', label);
        button.setAttribute('title', label);
    }
}

/** Atualiza o que não é texto simples: <html lang>, seletores de idioma e botão de tema. */
function updateDocument() {
    document.documentElement.setAttribute('lang', langTag());
    for (const select of document.querySelectorAll('[data-lang-select]')) {
        if (select.options.length === 0) {
            for (const language of LANGUAGES) {
                const option = document.createElement('option');
                option.value = language.code;
                option.lang = language.tag; // leitores de tela leem cada nome na pronúncia certa
                option.textContent = language.name;
                select.append(option);
            }
        }
        select.value = currentLang;
    }
    updateThemeLabels();
}

document.addEventListener('ggeo:themechange', updateThemeLabels);

/**
 * Troca o idioma. Devolve true se deu certo.
 * `persist: false` é usado na carga inicial (a escolha só é salva quando a
 * pessoa mexe no seletor).
 */
export async function setLang(code, { persist = true } = {}) {
    if (!LANGUAGES.some(l => l.code === code)) return false;
    try {
        const [next, fallback] = await Promise.all([
            loadDictionary(code),
            loadDictionary(DEFAULT_LANG),
        ]);
        dictionary = next;
        fallbackDictionary = fallback;
    } catch (error) {
        console.error('Não foi possível carregar o idioma:', code, error);
        updateDocument(); // devolve o seletor ao idioma que continua valendo
        return false;
    }

    currentLang = code;
    if (persist) {
        try { localStorage.setItem(boot.storageKey, code); } catch (error) { /* sem persistência */ }
    }
    applyTranslations();
    updateDocument();
    for (const callback of listeners) callback(code);
    return true;
}

/** Registra uma função a ser chamada sempre que o idioma mudar. */
export function onLangChange(callback) {
    listeners.add(callback);
}

/**
 * Chame uma vez por página, antes de montar qualquer texto em JavaScript:
 *     await initI18n();
 * Carrega o idioma, traduz a página e liga os seletores `[data-lang-select]`.
 */
export async function initI18n() {
    document.addEventListener('change', event => {
        if (event.target.matches && event.target.matches('[data-lang-select]')) {
            setLang(event.target.value);
        }
    });

    try {
        let ok = await setLang(currentLang, { persist: false });
        if (!ok && currentLang !== DEFAULT_LANG) {
            currentLang = DEFAULT_LANG; // não conseguiu o idioma pedido: volta ao padrão
            ok = await setLang(DEFAULT_LANG, { persist: false });
        }
        if (!ok) updateDocument();
    } finally {
        document.documentElement.classList.remove('i18n-loading');
    }
}

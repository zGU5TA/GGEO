/*
 * GGEO — escolha do idioma, ANTES da página ser desenhada.
 *
 * Este script é CLÁSSICO (não é módulo) e fica no <head>, antes de theme.js.
 * Ele só decide qual é o idioma e o registra em `window.GGEO_LANG`; quem
 * carrega e aplica os textos é js/i18n.js.
 *
 * ---- COMO ADICIONAR UM IDIOMA ----
 *   1. Crie i18n/<codigo>.json (copie i18n/pt.json e traduza os valores).
 *   2. Acrescente uma linha na lista LANGUAGES abaixo.
 * Só isso. Os nomes dos países já vêm do navegador em qualquer idioma;
 * capitais traduzidas vão em data/countries.json, no campo "capitals".
 *
 * Ordem de decisão do idioma:
 *   1) o que a pessoa escolheu no seletor (salvo em localStorage);
 *   2) o idioma do navegador, se for um dos suportados;
 *   3) português (padrão).
 */
(function () {
    var STORAGE_KEY = 'ggeo_lang';
    var DEFAULT_LANG = 'pt';

    // name: como o idioma se chama NO PRÓPRIO idioma (aparece no seletor).
    // tag:  etiqueta BCP 47 usada em <html lang> e nos nomes de países.
    var LANGUAGES = [
        { code: 'pt', name: 'Português', tag: 'pt-BR' },
        { code: 'en', name: 'English',   tag: 'en' },
        { code: 'es', name: 'Español',   tag: 'es' }
        // Futuro: { code: 'zh', name: '中文', tag: 'zh-Hans' }
    ];

    function isSupported(code) {
        for (var i = 0; i < LANGUAGES.length; i++) {
            if (LANGUAGES[i].code === code) return true;
        }
        return false;
    }

    function tagOf(code) {
        for (var i = 0; i < LANGUAGES.length; i++) {
            if (LANGUAGES[i].code === code) return LANGUAGES[i].tag;
        }
        return code;
    }

    function readStored() {
        try {
            var value = localStorage.getItem(STORAGE_KEY);
            return isSupported(value) ? value : null;
        } catch (error) {
            return null; // localStorage bloqueado: segue sem lembrar a escolha
        }
    }

    function fromBrowser() {
        var preferred = navigator.languages && navigator.languages.length
            ? navigator.languages
            : [navigator.language];
        for (var i = 0; i < preferred.length; i++) {
            var base = String(preferred[i] || '').toLowerCase().split('-')[0];
            if (isSupported(base)) return base;
        }
        return null;
    }

    var current = readStored() || fromBrowser() || DEFAULT_LANG;
    var root = document.documentElement;
    root.setAttribute('lang', tagOf(current));

    // O HTML vem em português. Para quem usa outro idioma, esconde a página por
    // um instante até os textos serem trocados (evita "piscar" em português).
    // A trava de 3 s garante que a página nunca fique escondida se algo falhar.
    if (current !== DEFAULT_LANG) {
        root.classList.add('i18n-loading');
        setTimeout(function () { root.classList.remove('i18n-loading'); }, 3000);
    }

    window.GGEO_LANG = {
        languages: LANGUAGES,
        default: DEFAULT_LANG,
        storageKey: STORAGE_KEY,
        current: current
    };
})();

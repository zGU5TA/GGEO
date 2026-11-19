/*
 * GGEO — tema claro/escuro compartilhado por todas as páginas.
 *
 * Este script é CLÁSSICO (não é módulo) e fica no <head> de propósito:
 * assim ele aplica o tema ANTES da página ser desenhada, evitando o
 * "pisca" de tema errado ao carregar.
 *
 * Como usar numa página:
 *   <script src="js/theme.js"></script>              (no <head>)
 *   <button data-theme-toggle>...</button>           (qualquer botão)
 * O botão é ligado sozinho. O ícone (lua/sol) é trocado só pelo CSS, conforme o tema;
 * o rótulo falado vem de js/i18n.js.
 */
(function () {
    var KEY = 'ggeo_theme';
    var LEGACY_KEY = 'flagle_theme'; // chave usada antes da GGEO; lida uma vez para migrar
    var DEFAULT_THEME = 'dark';

    function readStored() {
        try {
            var value = localStorage.getItem(KEY);
            if (!value) {
                value = localStorage.getItem(LEGACY_KEY);
                if (value) localStorage.setItem(KEY, value);
            }
            return value === 'light' || value === 'dark' ? value : null;
        } catch (error) {
            return null; // localStorage bloqueado (ex.: modo privado): segue sem salvar
        }
    }

    function store(theme) {
        try { localStorage.setItem(KEY, theme); } catch (error) { /* sem persistência */ }
    }

    function apply(theme) {
        var root = document.documentElement;
        root.setAttribute('data-theme', theme);
        root.style.colorScheme = theme; // faz campos e barras de rolagem acompanharem o tema
        // Avisa quem precisar reagir ao tema (js/i18n.js atualiza o rótulo do botão).
        document.dispatchEvent(new CustomEvent('ggeo:themechange', { detail: theme }));
    }

    function current() {
        return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    }

    apply(readStored() || DEFAULT_THEME);

    document.addEventListener('DOMContentLoaded', function () {
        var buttons = document.querySelectorAll('[data-theme-toggle]');
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].addEventListener('click', function () {
                var next = current() === 'dark' ? 'light' : 'dark';
                apply(next);
                store(next);
            });
        }
    });
})();

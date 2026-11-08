/*
 * GGEO — tamanho da fonte, preferência única para todos os jogos.
 *
 * Script CLÁSSICO no <head> (como theme.js e lang.js): aplica o tamanho antes
 * da página aparecer. O CSS reage ao atributo <html data-font="small|medium|
 * large|xlarge"> (veja css/game-shell.css).
 *
 * Numa página: <select data-font-select> com as opções small/medium/large/xlarge
 * (o valor é ligado e salvo sozinho).
 *
 * Chave do localStorage: ggeo_font. Valores antigos (ggeo_flag_font do Flag e
 * flagle_font da época do Flagle) são COPIADOS na primeira visita; não são apagados.
 */
(function () {
    var KEY = 'ggeo_font';
    var LEGACY = ['ggeo_flag_font', 'flagle_font'];
    var SIZES = ['small', 'medium', 'large', 'xlarge'];
    var DEFAULT_SIZE = 'medium';

    function valid(value) { return SIZES.indexOf(value) !== -1 ? value : null; }

    function readStored() {
        try {
            var value = valid(localStorage.getItem(KEY));
            for (var i = 0; !value && i < LEGACY.length; i++) {
                value = valid(localStorage.getItem(LEGACY[i]));
                if (value) localStorage.setItem(KEY, value);
            }
            return value;
        } catch (error) {
            return null; // localStorage bloqueado: segue sem salvar
        }
    }

    function apply(size) {
        document.documentElement.setAttribute('data-font', size);
        var selects = document.querySelectorAll('[data-font-select]');
        for (var i = 0; i < selects.length; i++) selects[i].value = size;
    }

    var current = readStored() || DEFAULT_SIZE;
    apply(current);

    document.addEventListener('DOMContentLoaded', function () {
        var selects = document.querySelectorAll('[data-font-select]');
        for (var i = 0; i < selects.length; i++) {
            selects[i].value = current;
            selects[i].addEventListener('change', function (event) {
                current = valid(event.target.value) || DEFAULT_SIZE;
                apply(current);
                try { localStorage.setItem(KEY, current); } catch (error) { /* sem persistência */ }
            });
        }
    });
})();

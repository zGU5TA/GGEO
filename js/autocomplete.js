/*
 * GGEO — sugestões de países enquanto a pessoa digita (Flag e Rotas).
 *
 * Funciona com mouse/toque (clicar numa sugestão), com as setas ↑ ↓ e com
 * Enter (escolhe a destacada, ou a primeira). Esc fecha. Segue o padrão
 * "combobox" de acessibilidade (role, aria-expanded, aria-activedescendant).
 *
 * Uso:
 *   const box = createAutocomplete({
 *       input, list,                       // <input> e <ul> (dentro de um .combo)
 *       getEntries: () => [{ id, name, keys }],   // keys = respostas já normalizadas
 *       isExcluded: (id) => false,         // opcional: esconde certos itens
 *       isEnabled: () => true,             // opcional: false = sem sugestões
 *       onChoose: (id, name) => {},        // escolheu uma sugestão
 *       onEnter: () => {},                 // Enter com a lista fechada
 *   });
 *   box.close();   // fecha a lista (ex.: ao trocar de idioma)
 */
import { normalize } from './country-names.js';
import { getLang } from './i18n.js';

const MAX_RESULTS = 40;

export function createAutocomplete({ input, list, getEntries, isExcluded = () => false, isEnabled = () => true, onChoose, onEnter = () => {} }) {
    let ids = [];
    let active = -1;
    if (!list.id) list.id = `${input.id}-suggestions`;
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', list.id);
    list.setAttribute('role', 'listbox');

    const isOpen = () => !list.classList.contains('hidden');

    function close() {
        list.classList.add('hidden');
        list.textContent = '';
        ids = [];
        active = -1;
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
    }

    function setActive(index) {
        const options = list.children;
        if (options.length === 0) return;
        active = (index + options.length) % options.length;
        [...options].forEach((option, i) => option.setAttribute('aria-selected', String(i === active)));
        input.setAttribute('aria-activedescendant', options[active].id);
        options[active].scrollIntoView({ block: 'nearest' });
    }

    // Destaca o trecho digitado (só quando o texto normalizado tem o mesmo tamanho do original).
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

    function choose(index) {
        const id = ids[index];
        const name = list.children[index] ? list.children[index].dataset.name : '';
        close();
        if (id !== undefined) onChoose(id, name);
    }

    function update() {
        const query = normalize(input.value.trim());
        close();
        if (!query || !isEnabled()) return;
        const lang = getLang();
        const rank = (entry) => (entry.keys.includes(query) ? 0 : entry.keys.some((k) => k.startsWith(query)) ? 1 : 2);
        const matches = getEntries()
            .filter((entry) => !isExcluded(entry.id) && entry.keys.some((k) => k.includes(query)))
            .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, lang))
            .slice(0, MAX_RESULTS);
        if (matches.length === 0) return;
        matches.forEach((entry, index) => {
            const option = document.createElement('li');
            option.id = `${list.id}-${index}`;
            option.dataset.name = entry.name;
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', 'false');
            option.append(highlight(entry.name, query));
            // pointerdown (e não click): o campo não perde o foco antes da escolha
            option.addEventListener('pointerdown', (event) => { event.preventDefault(); choose(index); });
            list.append(option);
            ids.push(entry.id);
        });
        list.classList.remove('hidden');
        input.setAttribute('aria-expanded', 'true');
        list.scrollIntoView({ block: 'nearest' });   // no celular, garante que a lista apareça inteira
    }

    input.setAttribute('aria-expanded', 'false');
    input.addEventListener('input', update);
    input.addEventListener('blur', () => setTimeout(close, 120));
    input.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') { event.preventDefault(); if (isOpen()) setActive(active + 1); else update(); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); if (isOpen()) setActive(active - 1); }
        else if (event.key === 'Escape') { close(); }
        else if (event.key === 'Enter') {
            event.preventDefault();
            if (isOpen() && ids.length > 0) choose(active >= 0 ? active : 0);
            else onEnter();
        }
    });

    return { close, update };
}

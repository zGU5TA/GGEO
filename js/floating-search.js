/*
 * GGEO — pesquisa flutuante no celular (Flag e Rotas).
 *
 * Problema: ao tocar no campo de resposta, o teclado ocupa metade da tela e o navegador
 * rola a página até o campo, empurrando a bandeira ou o mapa para fora da área visível.
 *
 * Solução (inspirada no Travle): ao ganhar foco, o campo vira um painel fixo no TOPO da
 * área visível, com o teclado embaixo e a bandeira/mapa logo abaixo do painel. O painel
 * mostra também um resumo (ex.: "Moçambique → Libéria") para a pessoa não perder o contexto.
 * Ao terminar (✕, Esc, fim da rodada ou toque fora), tudo volta ao normal.
 *
 * Detalhes técnicos:
 *  - A posição vem de `window.visualViewport` (altura e deslocamento da parte realmente
 *    visível). No iOS o teclado NÃO encolhe a página, só a "viewport visual", e por isso
 *    `position: fixed; top: 0` sozinho não basta. Sem `visualViewport`, cai em `top: 0`.
 *  - Uma "reserva" (slot) mantém o espaço do campo na página: nada pula ao abrir/fechar.
 *  - Só ativa em telas de toque (`pointer: coarse`); no computador o campo fica onde está.
 *  - Não depende da Virtual Keyboard API nem de alturas de teclado fixas.
 *
 * Uso:
 *   initFloatingSearch({
 *       panel,        // elemento que contém o campo e o botão de enviar
 *       input,        // o <input>
 *       anchor,       // o que precisa continuar visível (bandeira ou mapa)
 *       getContext,   // () => texto do resumo mostrado no painel
 *       placement,    // () => 'top' | 'bottom' (opcional; padrão 'top')
 *   });
 */
import { t } from './i18n.js';

const coarse = window.matchMedia('(pointer: coarse)');

export function initFloatingSearch({ panel, input, anchor, getContext = () => '', placement = () => 'top' }) {
    const root = document.documentElement;
    const viewport = window.visualViewport;

    // Reserva de espaço: o painel sai do fluxo quando flutua, a reserva mantém a altura dele.
    const slot = document.createElement('div');
    slot.className = 'search-slot';
    panel.before(slot);
    slot.append(panel);
    panel.classList.add('search-panel');

    const bar = document.createElement('div');
    bar.className = 'search-bar';
    const context = document.createElement('span');
    context.className = 'search-context';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'search-close';
    close.textContent = '✕';
    bar.append(context, close);
    panel.prepend(bar);

    let floating = false;
    let ticker = 0;

    const visible = () => ({
        top: viewport ? viewport.offsetTop : 0,
        height: viewport ? viewport.height : window.innerHeight,
    });

    // Rola só o necessário para a bandeira/mapa ficar fora do painel e acima do teclado.
    function keepAnchorVisible(bottom) {
        const view = visible();
        const rect = anchor.getBoundingClientRect();
        const min = bottom ? view.top + 8 : view.top + panel.offsetHeight + 8;
        const max = bottom ? view.top + view.height - panel.offsetHeight - 8 : view.top + view.height - 8;
        let delta = 0;
        if (rect.top < min) delta = rect.top - min;
        else if (rect.bottom > max) delta = Math.min(rect.bottom - max, rect.top - min);
        if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: 'instant' });
    }

    function update() {
        if (!floating) return;
        const view = visible();
        const bottom = placement() === 'bottom';
        panel.classList.toggle('is-bottom', bottom);
        if (bottom) {
            // distância entre o fim da página "de layout" e o fim da parte visível = altura do teclado (iOS)
            panel.style.top = 'auto';
            panel.style.bottom = `${Math.max(0, window.innerHeight - (view.top + view.height))}px`;
        } else {
            panel.style.bottom = '';
            panel.style.top = `${view.top}px`;
        }
        const text = getContext();
        context.textContent = text;
        panel.classList.toggle('has-context', !!text);
        // Espaço que a bandeira/mapa pode ocupar: o jogo encolhe a imagem em vez de rolar a página.
        const panelH = panel.offsetHeight;
        const rect = anchor.getBoundingClientRect();
        const room = bottom && rect.top > view.top
            ? view.top + view.height - panelH - 8 - rect.top
            : view.height - panelH - 16;
        root.style.setProperty('--anchor-max-h', `${Math.max(96, room)}px`);
        root.style.setProperty('--dock-h', `${panelH}px`);
        root.style.setProperty('--vv-h', `${view.height}px`);
        requestAnimationFrame(() => floating && keepAnchorVisible(bottom));
    }

    function open() {
        if (floating || !coarse.matches || input.disabled) return;
        slot.style.minHeight = `${panel.offsetHeight}px`;
        floating = true;
        close.setAttribute('aria-label', t('search.close'));
        panel.classList.add('is-floating');
        root.classList.add('search-floating');
        update();
        viewport?.addEventListener('resize', update);
        viewport?.addEventListener('scroll', update);
        // (o relógio do Rush e o contador mudam sozinhos; o foco pode sumir sem aviso quando o campo é desativado)
        ticker = setInterval(() => {
            if (document.activeElement !== input) shut(); else update();
        }, 400);
        setTimeout(update, 250);   // o teclado termina de abrir um pouco depois do foco
    }

    function shut() {
        if (!floating) return;
        floating = false;
        clearInterval(ticker);
        viewport?.removeEventListener('resize', update);
        viewport?.removeEventListener('scroll', update);
        panel.classList.remove('is-floating');
        root.classList.remove('search-floating');
        panel.style.top = '';
        panel.style.bottom = '';
        panel.classList.remove('is-bottom', 'has-context');
        slot.style.minHeight = '';
        root.style.removeProperty('--anchor-max-h');
        root.style.removeProperty('--dock-h');
        root.style.removeProperty('--vv-h');
    }

    // O painel só se move DEPOIS do toque terminar (evento click): mover o campo no meio do
    // toque faria o navegador perder o foco ou não abrir o teclado. E só quando a pessoa toca:
    // o foco automático do jogo não deve abrir o painel sozinho.
    input.addEventListener('click', () => { if (document.activeElement === input) open(); });
    input.addEventListener('blur', () => setTimeout(() => {
        if (!panel.contains(document.activeElement)) shut();
    }, 150));
    input.addEventListener('keydown', (event) => { if (event.key === 'Escape') input.blur(); });
    close.addEventListener('click', () => input.blur());
    // Tocar fora do painel (mas não na bandeira/mapa, que continuam jogáveis) fecha o teclado.
    document.addEventListener('pointerdown', (event) => {
        if (!floating) return;
        const target = event.target;
        if (panel.contains(target) || anchor.contains(target)) return;
        input.blur();
    });
    new MutationObserver(() => { if (input.disabled) { input.blur(); shut(); } })
        .observe(input, { attributes: true, attributeFilter: ['disabled'] });

    return { open, close: shut };
}

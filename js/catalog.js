/*
 * Monta os cartões do catálogo de jogos dentro de um elemento da página.
 * Textos entram com textContent (nunca como HTML); só o ícone, que vem
 * do nosso próprio games.js, entra como SVG.
 */

function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
}

function createCard(game) {
    const available = game.status === 'available';

    const card = createElement('article', 'game-card');
    card.dataset.game = game.id;

    const icon = createElement('div', 'game-card__icon');
    icon.insertAdjacentHTML('beforeend', game.icon);

    const body = createElement('div', 'game-card__body');
    body.append(
        createElement('h3', 'game-card__title', game.name),
        createElement('p', 'game-card__text', game.description),
    );

    const footer = createElement('div', 'game-card__footer');
    const badge = createElement(
        'span',
        `badge ${available ? 'badge--available' : 'badge--soon'}`,
        available ? 'Disponível' : 'Em desenvolvimento',
    );

    let action;
    if (available) {
        action = createElement('a', 'btn btn-primary', 'Jogar');
        action.href = game.path;
        action.setAttribute('aria-label', `Jogar ${game.name}`);
    } else {
        action = createElement('span', 'btn', 'Em breve');
        action.setAttribute('aria-disabled', 'true');
    }

    footer.append(badge, action);
    card.append(icon, body, footer);
    return card;
}

export function renderCatalog(container, games) {
    container.replaceChildren(...games.map(createCard));
}

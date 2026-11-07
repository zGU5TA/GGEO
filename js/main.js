/* Ponto de entrada da página inicial. */
import { games } from './games.js';
import { renderCatalog } from './catalog.js';
import { initI18n, onLangChange } from './i18n.js';

const catalog = document.getElementById('catalog');
const render = () => { if (catalog) renderCatalog(catalog, games); };

await initI18n();
render();
onLangChange(render); // os cartões são montados em JS, então refazem ao trocar o idioma

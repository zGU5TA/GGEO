/* Ponto de entrada da página inicial. */
import { games } from './games.js';
import { renderCatalog } from './catalog.js';

const catalog = document.getElementById('catalog');
if (catalog) renderCatalog(catalog, games);

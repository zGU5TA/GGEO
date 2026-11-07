/*
 * GGEO — nomes de países e capitais em cada idioma (compartilhado entre jogos).
 *
 * - Nome do país: em português vem de `country.name`; nos demais idiomas vem do
 *   próprio navegador (Intl.DisplayNames), que já conhece todos os países em
 *   qualquer idioma, inclusive mandarim. Se o navegador não souber, usa o português.
 * - Capital: `country.capitals[idioma]` quando existir; senão `country.capital`
 *   (português). Só são listadas em data/countries.json as que diferem do português.
 * - Resposta digitada: vale o nome em QUALQUER idioma suportado, mais os apelidos
 *   de `country.aliases`, ignorando acentos, maiúsculas e espaços repetidos.
 *   Assim quem joga em inglês pode digitar "Espanha" ou "España" e acertar.
 */
import { LANGUAGES, DEFAULT_LANG, getLang, langTag } from './i18n.js';

const formatters = new Map();

function regionNames(lang) {
    if (!formatters.has(lang)) {
        let formatter = null;
        try {
            formatter = new Intl.DisplayNames([langTag(lang)], { type: 'region' });
        } catch (error) {
            // navegador sem Intl.DisplayNames: cai no nome em português
        }
        formatters.set(lang, formatter);
    }
    return formatters.get(lang);
}

/** Nome que o navegador dá ao país nesse idioma, ou null se não souber. */
function intlName(country, lang) {
    const formatter = regionNames(lang);
    if (!formatter) return null;
    try {
        const code = country.code.toUpperCase();
        const name = formatter.of(code);
        return name && name.toUpperCase() !== code ? name : null;
    } catch (error) {
        return null;
    }
}

export function countryName(country, lang = getLang()) {
    if (lang === DEFAULT_LANG) return country.name;
    return intlName(country, lang) || country.name;
}

export function capitalName(country, lang = getLang()) {
    return (country.capitals && country.capitals[lang]) || country.capital;
}

function normalize(text) {
    return text
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

const acceptedCache = new WeakMap();

function acceptedAnswers(country) {
    if (!acceptedCache.has(country)) {
        const accepted = new Set([country.name, ...country.aliases].map(normalize));
        for (const language of LANGUAGES) {
            const name = intlName(country, language.code);
            if (name) accepted.add(normalize(name));
        }
        acceptedCache.set(country, accepted);
    }
    return acceptedCache.get(country);
}

/** A resposta digitada corresponde a esse país? */
export function matchesCountry(guess, country) {
    return acceptedAnswers(country).has(normalize(guess));
}

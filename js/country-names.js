/*
 * GGEO — nomes de países e capitais em cada idioma (compartilhado entre jogos).
 *
 * - Nome do país: em português vem de `country.name`; nos demais idiomas vem do
 *   próprio navegador (Intl.DisplayNames), que já conhece todos os países em
 *   qualquer idioma, inclusive mandarim. Se o navegador não souber, usa o português.
 * - Capital: `country.capitals[idioma]` quando existir; senão `country.capital`
 *   (português). Só são listadas em data/countries.json as que diferem do português.
 * - Resposta digitada: vale SÓ o idioma em que a pessoa está jogando: o nome
 *   do país nesse idioma mais os apelidos dele (`country.aliases` para o
 *   português; `country.aliasesByLang.<idioma>` para os demais), ignorando
 *   acentos, maiúsculas e espaços repetidos. Jogando em inglês, "Suíça" está
 *   errado e "Switzerland" está certo.
 */
import { DEFAULT_LANG, getLang, langTag } from './i18n.js';

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

export function normalize(text) {
    return text
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

const acceptedCache = new WeakMap(); // país -> { idioma -> Set de respostas aceitas }

/** Todas as respostas aceitas para o país nesse idioma (já normalizadas). */
export function acceptedAnswers(country, lang = getLang()) {
    if (!acceptedCache.has(country)) acceptedCache.set(country, new Map());
    const byLang = acceptedCache.get(country);
    if (!byLang.has(lang)) {
        const names = [countryName(country, lang)];
        if (lang === DEFAULT_LANG) names.push(...country.aliases);
        else names.push(...((country.aliasesByLang && country.aliasesByLang[lang]) || []));
        byLang.set(lang, new Set(names.map(normalize)));
    }
    return byLang.get(lang);
}

/** A resposta digitada corresponde a esse país, no idioma atual? */
export function matchesCountry(guess, country, lang = getLang()) {
    return acceptedAnswers(country, lang).has(normalize(guess));
}

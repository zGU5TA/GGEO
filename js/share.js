/*
 * GGEO — compartilhar resultado (Flag e Rotas).
 *
 * `copyText(texto)` copia para a área de transferência e devolve true/false.
 * `siteUrl()` é o endereço da página inicial, para fechar o texto compartilhado.
 */
export async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        // sem permissão da área de transferência (ou página sem https): método antigo
        const box = document.createElement('textarea');
        box.value = text;
        box.setAttribute('readonly', '');
        box.style.position = 'fixed';
        box.style.opacity = '0';
        document.body.append(box);
        box.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
        box.remove();
        return ok;
    }
}

/** Endereço da página inicial (dois níveis acima de games/<jogo>/). */
export function siteUrl() {
    return new URL('../../', location.href).href;
}

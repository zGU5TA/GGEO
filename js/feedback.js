// Link "Enviar feedback" (rodapé da home e dos jogos): abre o e-mail do jogador
// para feedback@ggeo.io (encaminhado pela Cloudflare Email Routing).
// O endereço também aparece escrito ao lado, porque quem usa só webmail pode
// não ter um programa de e-mail configurado para abrir o link.
const FEEDBACK_EMAIL = 'feedback@ggeo.io';

for (const link of document.querySelectorAll('[data-feedback]')) {
    link.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('GGEO — feedback')}`;
    const address = document.createElement('span');
    address.className = 'feedback-address';
    address.textContent = ` · ${FEEDBACK_EMAIL}`;
    link.after(address);
}

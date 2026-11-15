// Link "Enviar feedback" (rodapé da home e dos jogos).
// Para usar um formulário próprio (ex.: Google Forms), basta colar o endereço
// em FEEDBACK_URL. Enquanto estiver vazio, o link abre uma "issue" no GitHub.
const FEEDBACK_URL = '';
const FALLBACK_URL = 'https://github.com/zGU5TA/GGEO/issues/new';

for (const link of document.querySelectorAll('[data-feedback]')) {
    link.href = FEEDBACK_URL || FALLBACK_URL;
    link.target = '_blank';
    link.rel = 'noopener';
}

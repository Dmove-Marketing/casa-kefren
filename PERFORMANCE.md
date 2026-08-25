# Guia de Performance — Dmove Astro Template

**Baseado em:** trabalho de otimização mobile/desktop feito no projeto Casa Rofer (score mobile ~60 → 94, desktop ~90 → 95+).

Este guia documenta as causas mais comuns de nota baixa no Lighthouse para sites gerados com este template, e como corrigi-las no código. Use como checklist ao rodar Lighthouse em qualquer novo projeto do template.

---

## Como diagnosticar

1. Rode o Lighthouse (mobile **e** desktop — as causas de queda costumam ser diferentes) contra a URL de produção, não `localhost` (throttling simulado precisa de latência real de rede/CDN).
2. Abra a aba **Insights** — ela lista as oportunidades por categoria com economia estimada em KiB/ms. É o ponto de partida, não o "Diagnostics" clássico.
3. **Rode pelo menos 2x antes de investigar qualquer queda.** Notas de Lighthouse variam por execução (CPU/rede no momento do teste) — uma queda pontual que some sozinha na segunda rodada não é regressão de código, é ruído. Só investigue se a queda persistir em 2-3 execuções.

---

## 1. Imagens servidas maiores que o necessário

**Sintoma no relatório:** "Melhore a entrega de imagens" — imagem baixada em resolução X para exibição em resolução menor.

**Causa:** todas as imagens de conteúdo vêm de `media.dmove.com.br` via `src/components/ui/Img.astro`, que gera `srcset` responsivo chamando a rota de resize sob demanda do CDN (`/api/public/resize/:width/...`).

**Correção — ajustar granularidade dos breakpoints:**

```ts
// src/components/ui/Img.astro
const RESIZE_WIDTHS = [400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1600, 2048];
```

Breakpoints muito espaçados (ex.: um salto de 600→800) fazem o navegador pedir uma imagem maior que o necessário quando o tamanho real fica no meio do caminho. Preencher os saltos na faixa mais usada em mobile (400-1200px) reduz esse desperdício sem custo — a rota de resize já aceita qualquer largura entre 50-2048px e cacheia por combinação arquivo+largura.

**Correção — atributo `sizes` incorreto:**

Sempre que uma imagem **não** ocupa 100% da largura da viewport (grids, carrosséis, cards multi-coluna), passe `sizes` explicitamente refletindo a largura real renderizada:

```astro
<Img
  src="https://media.dmove.com.br/clients/.../foto.webp"
  alt="..."
  sizes="(max-width:760px) calc(100vw - 48px), 600px"
/>
```

O padrão (`100vw`) só é correto para imagens full-bleed (hero, banners). Confira o valor com o layout real da seção — um `sizes` maior que a renderização real faz o navegador baixar mais que precisa.

**Não é fixável no código deste repo:** qualidade/compressão do WebP é definida no `server.js` do backend de mídia compartilhado (`quality: 78` na rota de resize) — mudar isso afeta todos os clientes que usam esse CDN, não só o projeto atual. Trate como decisão de infraestrutura, não de código de página (ver seção 6).

---

## 2. CSS bloqueando renderização

**Sintoma:** "Elimine recursos que bloqueiam a renderização" — arquivos `.css` carregados de forma síncrona antes do primeiro paint.

**Correção:**

```js
// astro.config.mjs
export default defineConfig({
  build: {
    inlineStylesheets: 'always',
  },
});
```

Com `'auto'` (padrão do Astro), CSS de componente acima de ~4KB é extraído para arquivo separado e bloqueia o render. `'always'` inlina todo CSS no `<head>`, eliminando essa requisição bloqueante — funciona bem neste template porque as páginas são estáticas e o CSS por página não costuma ser gigante.

---

## 3. Fontes

**Sintoma:** peso sintético de fonte (negrito "falso" renderizado pelo navegador) ou pesos não utilizados sendo baixados à toa.

**Correção:** audite quais `font-weight` o CSS da página realmente usa e garanta que **todos e apenas esses** estejam importados em `src/layouts/Base.astro`:

```astro
import '@fontsource/montserrat/300.css';
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/400-italic.css';
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/800.css';
```

Peso usado no CSS mas não importado aqui → o navegador sintetiza negrito (pior visual, e ainda assim baixa um peso que não é o certo). Peso importado mas não usado → banda desperdiçada.

---

## 4. Preconnects

**Sintoma:** "Preconecte-se a origens necessárias" — domínios de terceiro/CDN sendo resolvidos do zero na primeira requisição.

**Correção:** liste no `<head>` de `Base.astro` todo domínio externo do qual a página depende de fato (CDN de mídia, backend de forms, mapas, etc.):

```astro
<link rel="preconnect" href="https://media.dmove.com.br" crossorigin />
<link rel="dns-prefetch" href="https://media.dmove.com.br" />
<link rel="preconnect" href="https://capi-automation.s3.us-east-2.amazonaws.com" crossorigin />
```

Não passe de ~4 preconnects — cada um tem custo de handshake antecipado; excesso é contraproducente.

---

## 5. JS de tracking (GTM + gtag + Pixel + CAPI) — o maior custo remanescente

**Sintoma:** "Reduza o JavaScript não usado" e "Minimize o trabalho da thread principal" apontando `googletagmanager.com`, `connect.facebook.net` e qualquer bundle de CAPI custom como os maiores consumidores (tipicamente 200+ KiB não usados, ~1s de execução).

**Restrição importante:** o snippet do GTM em si (`src/components/tracking/GTMHead.astro`) **deve permanecer síncrono/padrão** — não deferir, não usar `async` fora do próprio snippet oficial do Google — porque o Google Tag Assistant depende disso pra detectar a instalação corretamente. O ganho aqui não vem de mexer em como o GTM carrega, e sim em **quando as tags de dentro dele disparam**.

**Correção — gatilho de interação (adiar Pixel/CAPI até o usuário demonstrar engajamento real):**

1. Código deste repo — componente que empurra um evento pro `dataLayer` na primeira interação, com fallback por timeout (pra não perder tracking de quem nunca interage):

```astro
<!-- src/components/tracking/InteractionTrigger.astro -->
<script>
  (function() {
    const FALLBACK_TIMEOUT_MS = 4000; // ajustar com dado real do GA4 (tempo até 1ª interação)
    let fired = false;

    function fireInteraction() {
      if (fired) return;
      fired = true;
      const eventId = crypto.randomUUID();
      (window as any).dataLayer = (window as any).dataLayer || [];
      (window as any).dataLayer.push({ event: 'user_interaction', event_id: eventId });
      interactionEvents.forEach(evt => window.removeEventListener(evt, fireInteraction));
      clearTimeout(fallbackTimer);
    }

    const interactionEvents = ['scroll', 'click', 'touchstart', 'keydown'];
    interactionEvents.forEach(evt =>
      window.addEventListener(evt, fireInteraction, { passive: true, once: true })
    );
    const fallbackTimer = setTimeout(fireInteraction, FALLBACK_TIMEOUT_MS);
  })();
</script>
```

Incluído em `Base.astro`, condicionado a `trackingEnabled && gtmId`.

2. **Configuração no GTM (fora deste repo, precisa de acesso à conta):**
   - Criar gatilho customizado `Custom Event = user_interaction`
   - Trocar o gatilho do **Pixel do Meta** e do **bundle CAPI** de "All Pages" para esse evento — **manter o GA4 em "All Pages"**, sem alterar (evita distorcer métricas de engaged session/bounce rate do GA4)
   - Configurar a tag do Pixel pra ler `{{DLV - event_id}}` do dataLayer e enviar como `eventID`, e alinhar o bundle CAPI pra usar o mesmo `event_id` — evita contagem duplicada entre Pixel (client-side) e CAPI (server-side)
   - Validar deduplicação na aba **Test Events** do Meta Events Manager antes de publicar

**Risco a controlar:** timeout de fallback muito longo perde tracking de quem sai rápido (bounce); muito curto anula o ganho de performance. Ideal: puxar o tempo real de engajamento no GA4 (Explorar → tempo até 1ª interação) em vez de chutar o valor.

---

## 6. O que NÃO é fixável em código de página — é infraestrutura compartilhada

Alguns itens do relatório apontam pra dentro do backend de mídia (`media.dmove.com.br`, VPS compartilhada por ~27 clientes Dmove) ou pra contas externas (GTM, S3 do bundle CAPI). **Não aplique mudanças nesses pontos sem confirmação explícita** — o blast radius é maior que o projeto atual:

- Qualidade/compressão de imagem no backend de resize (`server.js`, parâmetro `quality`/`effort` do sharp)
- Cache-Control do bundle CAPI hospedado em S3
- Qualquer configuração de tag dentro do GTM

Pra esses, faça investigação **somente leitura** primeiro (SSH read-only, `curl` de verificação), reporte o achado em linguagem simples, e só aplique com aval de quem administra a infra/conta.

---

## Checklist rápido pra novo projeto

- [ ] Rodar Lighthouse mobile + desktop na URL de produção (2x cada, pra descartar ruído)
- [ ] Conferir `sizes` de cada `<Img>` fora do hero/full-bleed
- [ ] Conferir breakpoints do `RESIZE_WIDTHS` em `Img.astro` (já vem ajustado neste template)
- [ ] Conferir `build.inlineStylesheets: 'always'` no `astro.config.mjs`
- [ ] Auditar pesos de fonte usados vs. importados
- [ ] Conferir preconnects para os domínios externos reais do projeto (CDN, webhook, mapas)
- [ ] Se o projeto tiver Pixel/CAPI configurado no GTM, aplicar o gatilho de interação (seção 5) e coordenar a configuração do lado do GTM com quem administra a conta

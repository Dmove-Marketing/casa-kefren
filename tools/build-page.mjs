#!/usr/bin/env node
/**
 * build-page.mjs — monta src/pages/index.astro e src/styles/casa-kefren.css
 * a partir dos artefatos limpos em _work/ (body.html + style.css).
 * Embrião do scaffold greenfield: mapeia mídia base64 → CDN, faz o wiring
 * do formulário com forms.ts, corrige fontes para self-host.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const CDN = 'https://media.dmove.com.br/clients/casa-kefren';
const P = (f) => `${CDN}/photos/${f}`;
const V = (f) => `${CDN}/videos/${f}`;

// Mapa placeholder → URL final no CDN (derivado do contexto/alt de cada imagem)
const G = 'carrossel-gastronomia_corporativos';
const GAL = 'galeria_corporativos';
const media = {
  __IMAGE_0__: P('logo_principal_resultado.webp'),        // logo header
  __IMAGE_1__: P('hero_corporativo_resultado.webp'),      // hero
  __IMAGE_2__: P('001_-_R6LE4353.webp'),                  // poster do vídeo
  __VIDEO_3__: V('video.webm'),                           // vídeo institucional
  __IMAGE_4__: P('salao-principal_corporativo_resultado.webp'),
  __IMAGE_5__: P('area-externa_corporativo_resultado.webp'),
  __IMAGE_6__: P('gastronomia_corporativos_resultado.webp'),
  __IMAGE_7__: P('bar_corporativos_resultado.webp'),
  __IMAGE_8__: P('projecao-mapeada_corporativos_resultado.webp'),
  __IMAGE_9__: P('personalizacao_corporativos_resultado.webp'),
  __IMAGE_10__: P('atendimento-personalizado_corporativos_resultado.webp'),
  __IMAGE_11__: P('tecnologia_corporativos_resultado.webp'),
  // Carrossel gastronomia (5 itens: href + img apontam para a mesma imagem)
  __IMAGE_12__: P(`${G}01_resultado.webp`), __IMAGE_13__: P(`${G}01_resultado.webp`),
  __IMAGE_14__: P(`${G}02_resultado.webp`), __IMAGE_15__: P(`${G}02_resultado.webp`),
  __IMAGE_16__: P(`${G}03_resultado.webp`), __IMAGE_17__: P(`${G}03_resultado.webp`),
  __IMAGE_18__: P(`${G}04_resultado.webp`), __IMAGE_19__: P(`${G}04_resultado.webp`),
  __IMAGE_20__: P(`${G}05_resultado.webp`), __IMAGE_21__: P(`${G}05_resultado.webp`),
  // Galeria (8 itens)
  __IMAGE_22__: P(`${GAL}01_resultado.webp`), __IMAGE_23__: P(`${GAL}01_resultado.webp`),
  __IMAGE_24__: P(`${GAL}02_resultado.webp`), __IMAGE_25__: P(`${GAL}02_resultado.webp`),
  __IMAGE_26__: P(`${GAL}03_resultado.webp`), __IMAGE_27__: P(`${GAL}03_resultado.webp`),
  __IMAGE_28__: P(`${GAL}04_resultado.webp`), __IMAGE_29__: P(`${GAL}04_resultado.webp`),
  __IMAGE_30__: P(`${GAL}05_resultado.webp`), __IMAGE_31__: P(`${GAL}05_resultado.webp`),
  __IMAGE_32__: P(`${GAL}06_resultado.webp`), __IMAGE_33__: P(`${GAL}06_resultado.webp`),
  __IMAGE_34__: P(`${GAL}07_resultado.webp`), __IMAGE_35__: P(`${GAL}07_resultado.webp`),
  __IMAGE_36__: P(`${GAL}08_resultado.webp`), __IMAGE_37__: P(`${GAL}08_resultado.webp`),
  __IMAGE_38__: P('logo_principal_resultado.webp'),       // logo footer
};

// ---------- BODY ----------
let body = readFileSync('_work/body.html', 'utf8');

// 1) remover o <script> inline (interações foram para src/scripts/casa-kefren.js)
body = body.replace(/<script>[\s\S]*?<\/script>/gi, '').trim();

// 2) hero = LCP → prioridade de carregamento
body = body.replace('<img src="__IMAGE_1__"', '<img fetchpriority="high" src="__IMAGE_1__"');

// 3) wiring do formulário com forms.ts
body = body.replace(
  '<form id="contact-form" novalidate>',
  '<form id="contact-form" novalidate data-form-id="lead-form" data-project="casa-kefren" ' +
  'data-submit-url={webhook} data-fonte="Landing page/casa-kefren" ' +
  'data-grid-id="contact-form" data-success-id="contact-success">\n' +
  '        <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" ' +
  'style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;" />'
);
// nomes de campo alinhados ao keyMap do webhook (underscore, não hífen)
body = body.replace('name="tipo-evento"', 'name="tipo_evento"');
body = body.replace('name="data-evento"', 'name="data_evento"');
// id no bloco de sucesso (forms.ts adiciona .active)
body = body.replace('<div class="form-success">', '<div class="form-success" id="contact-success">');

// 4) mapear mídia base64 → CDN
for (const [token, url] of Object.entries(media)) {
  body = body.split(token).join(url);
}

// 5) guarda: nenhum placeholder órfão nem chave que quebre o parser Astro
const orphans = body.match(/__[A-Z]+_\d+__/g);
if (orphans) throw new Error('Placeholders não mapeados: ' + [...new Set(orphans)].join(', '));
if (/[{}]/.test(body)) {
  // apenas a expressão {webhook} é permitida
  const bad = body.replace('{webhook}', '');
  if (/[{}]/.test(bad)) throw new Error('Chaves { } inesperadas no body (quebram o Astro).');
}

// ---------- PÁGINA ASTRO ----------
const astro = `---
// Gerado por tools/build-page.mjs a partir de casa-kefren-preview.html
import Base from '../layouts/Base.astro';
import config from '../../config.json';
import '../styles/casa-kefren.css';

const title = 'Casa Kefren Corporativo | Eventos Corporativos no Tatuapé, São Paulo';
const description =
  'Personalização, sofisticação e estrutura para transformar a proposta da sua empresa em um evento que realmente se destaca. Até 350 convidados no Tatuapé, São Paulo.';
const webhook = config.forms['lead-form'].webhooks[0];
---

<Base title={title} description={description} canonical={\`https://\${config.domain}/\`}>
${body}

  <script>
    import '../scripts/casa-kefren.js';
    import { initForms } from '../scripts/forms';
    initForms();
  </script>
</Base>
`;
writeFileSync('src/pages/index.astro', astro);

// ---------- CSS (fontes self-host) ----------
let css = readFileSync('_work/style.css', 'utf8');
const fontFaces = `/* Clarity City — self-host (public/fonts) */
@font-face { font-family: "Clarity City"; src: url("/fonts/ClarityCity-Regular.ttf") format("truetype"); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: "Clarity City"; src: url("/fonts/ClarityCity-Medium.ttf") format("truetype"); font-weight: 500; font-style: normal; font-display: swap; }
@font-face { font-family: "Clarity City"; src: url("/fonts/ClarityCity-SemiBold.ttf") format("truetype"); font-weight: 600; font-style: normal; font-display: swap; }
@font-face { font-family: "Clarity City"; src: url("/fonts/ClarityCity-Bold.ttf") format("truetype"); font-weight: 700; font-style: normal; font-display: swap; }
@font-face { font-family: "Clarity City"; src: url("/fonts/ClarityCity-BoldItalic.ttf") format("truetype"); font-weight: 700; font-style: italic; font-display: swap; }
`;
// troca todo o bloco original de @font-face (do 1º @font-face até o :root) pelo novo
css = css.replace(/@font-face[\s\S]*?(?=:root)/, fontFaces + '\n');
// forms.ts revela o sucesso via classe .active (design usava .show)
css = css.replace('.form-success.show { display: block; }', '.form-success.show,\n.form-success.active { display: block; }');
writeFileSync('src/styles/casa-kefren.css', css);

console.log('✅ Gerado:');
console.log('   src/pages/index.astro');
console.log('   src/styles/casa-kefren.css');
console.log('   (fontes: 5 pesos self-host em public/fonts/)');

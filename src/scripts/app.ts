/* ---------------------------------------------------------------------------
 * Comportamento do caderno no navegador.
 *
 * Tudo aqui é progressivo: sem JS a página continua navegável, só perde
 * as conveniências (tema, busca, progresso, atalhos).
 *
 * Nada sai do dispositivo — o progresso vive só no localStorage do usuário.
 * ------------------------------------------------------------------------- */

import 'js-circle-progress';
import { montarQuiz } from './quiz';
import { montarTopicos } from './topicos';
import { montarSumario } from './sumario';
import { montarBarrasDeRolagem } from './barra-rolagem';
import { ligarAtalhos } from './atalhos';
import { ligarAulaAtual } from './aula';
import { montarAjustes } from './ajustes';
import { montarAvisoRever } from './estudo-aula';
import { toast } from './avisos';
import { abrirBusca } from './busca';
import { ligarCabecalhoFixo, ligarPilulaVoltar } from './cabecalho';
import { ligarDobras } from './dobras';
import { montarHub } from './hub';
import { ligarNotasSoltas } from './notas';
import { montarEstudo } from './meu-estudo';
import { montarRecomendacoes } from './recomendacoes';
import { montarResumoDeVideo } from './resumo-de-video';
import { montarRevisao } from './revisao';
import { aplicarFontePx, lerBrilho, aplicarBrilho, aplicarDispensados, lerFontePx, preferencias, aplicarA11y } from './preferencias';
import { vistas, refletirProgresso } from './progresso';
import { aplicarTema, temaSalvo } from './tema';
import { ligarPwa } from './pwa';
import { montarSimulado } from './simulado';

function iniciar() {
  // O primeiro carregamento dispara `astro:page-load` e também a chamada direta lá embaixo:
  // sem esta marca, tudo era ligado duas vezes (ex.: os `toggle` das dobras). O <body> é
  // trocado a cada navegação, então a marca some junto e a página nova inicia normalmente.
  if (document.body.dataset.cdtIniciado) return;
  document.body.dataset.cdtIniciado = '1';
  aplicarTema(temaSalvo());
  aplicarDispensados();
  aplicarFontePx(lerFontePx());
  aplicarBrilho(lerBrilho());
  aplicarA11y(preferencias());
  refletirProgresso();
  montarHub();
  void montarRevisao();
  void montarEstudo();
  void montarRecomendacoes();
  montarResumoDeVideo();
  montarSimulado();
  void montarAjustes();
  ligarAtalhos();
  ligarNotasSoltas();
  ligarDobras();
  ligarCabecalhoFixo();
  ligarAulaAtual();
  ligarPilulaVoltar();
  // Ordem importa: o quiz lê os filhos do artigo, os tópicos os embrulham em seguida e
  // as barras de rolagem medem a página já com os tópicos no lugar.
  montarQuiz();
  montarTopicos();
  montarAvisoRever();
  montarSumario();
  montarBarrasDeRolagem();
  ligarPwa();
}

document.addEventListener('astro:page-load', () => {
  delete document.documentElement.dataset.navegando;
  iniciar();
});
// Marca o <html> NOVO enquanto a troca de página acontece: a rolagem suave do CSS faria o
// "voltar" correr por baixo da página que já entrou (ver html[data-navegando] em global.css).

document.addEventListener('astro:before-swap', (e) => {
  (e as Event & { newDocument: Document }).newDocument.documentElement.dataset.navegando = '';
});
// Roda no documento novo, antes de pintar: evita perder tema e fonte (e o flash).

document.addEventListener('astro:after-swap', () => {
  aplicarTema(temaSalvo());
  aplicarDispensados();
  aplicarFontePx(lerFontePx());
  aplicarBrilho(lerBrilho());
  aplicarA11y(preferencias());
});

if (document.readyState !== 'loading') iniciar();
else document.addEventListener('DOMContentLoaded', iniciar, { once: true });

// Exposto para depuração e para trechos inline que precisam avisar o usuário.
(window as any).cdt = { toast, vistas, abrirBusca };

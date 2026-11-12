/* =====================================================
   AGENDA LIGADA AO GOOGLE + AVISOS COM SOM — Dra. Ingrid
   - Google Agenda: um robozinho que roda NA CONTA GOOGLE DELA (Apps Script),
     a cada 5 minutos. Põe as visitas confirmadas no Google Agenda (com lembrete
     60 e 15 min antes, que tocam no celular) e traz de volta o que está ocupado
     lá — esses horários somem do link do tutor. Quem guarda o link secreto do
     robô é o banco (ingridvet.segredos); só a dona vê, pela função agenda_google_info.
   - Avisos no celular (push): pedido de horário novo e visita daqui a 30 min,
     mesmo com o app fechado. Quem manda é o servidor (função vet-agenda),
     chamado pelo banco e pelo relógio. Aqui só se cadastra o aparelho.
   - Sino: com o app aberto, pedido novo e visita chegando tocam um sino.
   No iPhone o push só existe com o app instalado na tela de início (iOS 16.4+).
   ===================================================== */
'use strict';

const VET_FN = () => (typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.supabaseUrl : '') + '/functions/v1/vet-agenda';
let GOOGLE = null;          // { token, sincronizado, eventos, ocupados[], aparelhos } — só a dona recebe
let VAPID = null;

/* ---------- Google Agenda ---------- */
async function googleInfo() {
  if (!MODO_REAL || !isLoggedIn() || NUV.eid !== 1) return GOOGLE = null;
  try { const r = await rest('rpc/agenda_google_info', { method: 'POST', body: '{}' }); GOOGLE = r.ok ? await r.json() : null; }
  catch (e) { GOOGLE = null; }
  return GOOGLE;
}
const googleMinutos = () => GOOGLE && GOOGLE.sincronizado ? Math.round((Date.now() - Date.parse(GOOGLE.sincronizado)) / 60000) : null;
const googleLigado = () => { const m = googleMinutos(); return m !== null && m < 24 * 60; };
function googleOcupadosDoDia(dia) {
  return ((GOOGLE && GOOGLE.ocupados) || []).filter(b => b.ini.slice(0, 10) <= dia && b.fim.slice(0, 10) >= dia)
    .map(b => ({ ...b, de: b.ini.slice(0, 10) < dia ? '00:00' : b.ini.slice(11, 16), ate: b.fim.slice(0, 10) > dia ? '24:00' : b.fim.slice(11, 16) }))
    .sort((a, b) => a.de.localeCompare(b.de));
}
function codigoRobo(token) {
  const link = VET_FN() + '?k=' + token;
  return `// Robô da agenda da Dra. Ingrid — roda na conta Google DELA.
// A cada 5 minutos: põe no Google Agenda as visitas confirmadas no app
// (com lembrete 60 e 15 minutos antes) e manda para o app o que está
// ocupado no Google — esses horários somem do link do tutor.
// INSTALAR (uma vez só): lá em cima escolha a função "instalar" e clique em Executar.
const LINK = '${link}';
const FUSO = 'America/Sao_Paulo', DIAS_ATRAS = 7, DIAS_FRENTE = 60;

function instalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('sincronizar').timeBased().everyMinutes(5).create();
  sincronizar();
  Logger.log('Pronto! A agenda do app vai para o Google a cada 5 minutos.');
}

function desinstalar() {   // para tudo e tira do Google as visitas que o robô pôs
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  var cal = CalendarApp.getDefaultCalendar();
  cal.getEvents(new Date(Date.now() - DIAS_ATRAS * 864e5), new Date(Date.now() + DIAS_FRENTE * 864e5))
    .forEach(function (ev) { if (ev.getTag('vetig')) ev.deleteEvent(); });
}

function sincronizar() {
  var cal = CalendarApp.getDefaultCalendar();
  var r = UrlFetchApp.fetch(LINK, { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('O app respondeu ' + r.getResponseCode() + '. Se o link foi trocado no app, copie o código de novo.');
  var dados = JSON.parse(r.getContentText());
  if (!dados || !Array.isArray(dados.eventos)) throw new Error('Resposta estranha do app — nada foi mudado.');
  var de = new Date(Date.now() - DIAS_ATRAS * 864e5), ate = new Date(Date.now() + DIAS_FRENTE * 864e5);
  var nossos = {}, vistos = {};
  cal.getEvents(de, ate).forEach(function (ev) { var id = ev.getTag('vetig'); if (id) nossos[id] = ev; });
  dados.eventos.forEach(function (e) {
    vistos[e.id] = true;
    var ini = Utilities.parseDate(e.inicio, FUSO, "yyyy-MM-dd'T'HH:mm:ss");
    var fim = Utilities.parseDate(e.fim, FUSO, "yyyy-MM-dd'T'HH:mm:ss");
    var ev = nossos[e.id];
    if (!ev) {
      ev = cal.createEvent(e.titulo, ini, fim, { location: e.local, description: e.descricao });
      ev.setTag('vetig', e.id);
      ev.removeAllReminders(); ev.addPopupReminder(60); ev.addPopupReminder(15);
      return;
    }
    if (ev.getTitle() !== e.titulo) ev.setTitle(e.titulo);
    if (ev.getStartTime().getTime() !== ini.getTime() || ev.getEndTime().getTime() !== fim.getTime()) ev.setTime(ini, fim);
    if (ev.getLocation() !== e.local) ev.setLocation(e.local);
    if (ev.getDescription() !== e.descricao) ev.setDescription(e.descricao);
  });
  Object.keys(nossos).forEach(function (id) { if (!vistos[id]) nossos[id].deleteEvent(); });   // visita desmarcada no app
  var ocupados = cal.getEvents(new Date(), ate).filter(function (ev) {
    if (ev.getTag('vetig')) return false;
    if (ev.isAllDayEvent()) return /^(ocupad|folga|f[ée]rias|viagem|plant[ãa]o)/i.test(ev.getTitle());
    return true;
  }).map(function (ev) {
    return { ini: Utilities.formatDate(ev.getStartTime(), FUSO, "yyyy-MM-dd'T'HH:mm"),
             fim: Utilities.formatDate(ev.getEndTime(), FUSO, "yyyy-MM-dd'T'HH:mm"), titulo: ev.getTitle() };
  });
  UrlFetchApp.fetch(LINK, { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ ocupados: ocupados, eventos: dados.eventos.length }) });
}
`;
}
async function copiarRobo() {
  if (!GOOGLE || !GOOGLE.token) return toast('Abra esta tela logada como a Dra. Ingrid');
  const txt = codigoRobo(GOOGLE.token);
  try { await navigator.clipboard.writeText(txt); toast('Código copiado — agora cole no script.google.com'); }
  catch (e) {
    abrirFolha(`<h2>Código do robô</h2><p class="small muted">Toque e segure dentro da caixa → Selecionar tudo → Copiar.</p><textarea rows="14" readonly style="font:12px ui-monospace,monospace">${esc(txt)}</textarea>`);
  }
}
async function trocarLinkGoogle() {
  if (!confirm('Gerar um link novo para o robô do Google? O robô que já está instalado para de funcionar até você colar o código novo.')) return;
  try { const r = await rest('rpc/agenda_google_trocar', { method: 'POST', body: '{}' }); if (!r.ok) throw 0; await googleInfo(); route({ manterScroll: true }); toast('Link novo gerado — copie o código de novo'); }
  catch (e) { toast('Não consegui trocar agora. Tente de novo.'); }
}

/* ---------- avisos no celular (push) ---------- */
const avIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const avInstalado = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const avSuportado = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
function avChave(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4), raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
async function avVapid() {
  if (VAPID !== null) return VAPID;
  try { const r = await fetch(VET_FN() + '?vapid=1'); VAPID = r.ok ? ((await r.json()).chave || '') : ''; } catch (e) { VAPID = ''; }
  return VAPID;
}
async function avAssinatura() {
  if (!avSuportado()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}
async function avEstado() {
  if (!MODO_REAL) return { txt: 'Na demonstração os avisos não chegam ao celular. No app da Dra. Ingrid, cada pedido novo e cada visita chegando tocam no celular dela.', pode: false };
  if (NUV.eid !== 1 || !souDona()) return { txt: 'Os avisos ligam só no aparelho da Dra. Ingrid, logada com o login dela.', pode: false };
  if (avIOS() && !avInstalado()) return { txt: 'No iPhone: toque em Compartilhar → “Adicionar à Tela de Início”, abra o app pelo ícone e ative aqui.', pode: false };
  if (!avSuportado()) return { txt: 'Este navegador não recebe notificações. No celular, use o app instalado na tela de início.', pode: false };
  if (!(await avVapid())) return { txt: 'Os avisos ainda estão sendo ligados no servidor. Já já aparecem aqui.', pode: false };
  if (Notification.permission === 'denied') return { txt: 'O celular bloqueou as notificações do app. Libere em Ajustes do celular → Notificações e tente de novo.', pode: true };
  const s = await avAssinatura().catch(() => null);
  return s && Notification.permission === 'granted' ? { txt: '✓ Ativo neste aparelho.', pode: true, ativo: true } : { txt: 'Ainda não ativado neste aparelho.', pode: true };
}
async function avAtivar() {
  const chave = await avVapid();
  if (!avSuportado() || !chave) return toast('Este aparelho ainda não pode receber avisos');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { toast('Sem permissão, o celular não deixa o app avisar'); return avPintar(); }
  try {
    const reg = await navigator.serviceWorker.ready;
    let s = await reg.pushManager.getSubscription();
    if (!s) s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: avChave(chave) });
    const j = s.toJSON();
    const r = await rest('push_subs', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ endpoint: j.endpoint, sub: j, aparelho: navigator.userAgent.slice(0, 120) }) });
    toast(r.ok ? 'Pronto! Este celular vai avisar com som.' : 'Não consegui ativar agora. Confira a internet.');
  } catch (e) { toast('Não consegui ativar agora. Confira a internet.'); }
  avPintar();
}
async function avTeste() {
  try {
    const r = await fetch(VET_FN(), { method: 'POST', headers: { 'content-type': 'application/json', apikey: APP_CONFIG.supabaseKey, Authorization: 'Bearer ' + authToken() }, body: '{"op":"teste"}' });
    const j = await r.json().catch(() => ({}));
    toast(!r.ok ? 'Entre com o login da Dra. Ingrid para testar' : j.aparelhos ? 'Aviso de teste enviado — chega em segundos' : 'Nenhum aparelho ativado ainda');
  } catch (e) { toast('Sem internet agora'); }
}
async function avPintar() {
  const el = document.getElementById('avEstado'); if (!el) return;
  const e = await avEstado();
  el.textContent = e.txt;
  const liga = document.getElementById('avLiga'); if (liga) { liga.hidden = !e.pode || !!e.ativo; }
  const teste = document.getElementById('avTesteBtn'); if (teste) teste.hidden = !e.ativo;
}

/* ---------- sino com o app aberto ---------- */
const somLigado = () => { try { return localStorage.getItem('vetig_som') !== 'off'; } catch (e) { return true; } };
function sino() {
  if (!somLigado()) return;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  let ctx; try { ctx = new AC(); } catch (e) { return; }
  if (ctx.state === 'suspended') ctx.resume().catch(() => { });
  const t0 = ctx.currentTime + 0.03;
  [[880, 0], [1318.5, 0.18]].forEach(([hz, q]) => {
    [[hz, 0.26], [hz * 2.01, 0.06]].forEach(([f, v]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + q); g.gain.exponentialRampToValueAtTime(v, t0 + q + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + q + 1.1);
      o.connect(g); g.connect(ctx.destination); o.start(t0 + q); o.stop(t0 + q + 1.2);
    });
  });
  setTimeout(() => { try { ctx.close(); } catch (e) { } }, 1800);
}
function avisoNaTela() {
  try { sino(); } catch (e) { }
  try { if (navigator.vibrate) navigator.vibrate([120, 80, 120]); } catch (e) { }
}
// visita chegando, com o app aberto: toca o sino 30 min antes (uma vez por visita)
function vigiaVisitas() {
  if (!DB || !DB.agenda) return;
  const hoje = isoHoje(), agora = new Date().getHours() * 60 + new Date().getMinutes();
  DB.agenda.filter(g => g.data === hoje && g.status === 'confirmado' && g.hora).forEach(g => {
    const falta = minutos(g.hora) - agora, k = 'vetig_lem_' + g.id + g.data + g.hora;
    if (falta < 1 || falta > 31) return;
    try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch (e) { return; }
    const a = animal(g.animalId); avisoNaTela(); toast(`Visita em ${falta} min · ${g.hora} · ${a ? a.nome : ''}`);
  });
}
setInterval(vigiaVisitas, 60000);

/* ---------- a tela: Mais → Google Agenda e avisos ---------- */
TELAS.google = () => {
  const m = googleMinutos(), lig = googleLigado();
  const statusG = !MODO_REAL ? '<span class="tag">demonstração</span>'
    : lig ? `<span class="tag verde">${ic('check', 'sm')} ligado</span>` : m !== null ? '<span class="tag ambar">parado</span>' : '<span class="tag">não ligado</span>';
  const dica = !MODO_REAL ? 'No app da Dra. Ingrid, as visitas confirmadas entram sozinhas no Google Agenda dela, e o que estiver ocupado lá some do link do tutor.'
    : lig ? `Última conversa com o Google ${m < 1 ? 'agora há pouco' : 'há ' + (m < 60 ? m + ' min' : Math.round(m / 60) + ' h')} · ${GOOGLE.eventos || 0} visita${GOOGLE.eventos === 1 ? '' : 's'} no Google · ${(GOOGLE.ocupados || []).length} horário${(GOOGLE.ocupados || []).length === 1 ? '' : 's'} ocupado${(GOOGLE.ocupados || []).length === 1 ? '' : 's'} vindo${(GOOGLE.ocupados || []).length === 1 ? '' : 's'} de lá.`
    : m !== null ? `O robô não conversa com o app há ${Math.round(m / 60)} h. Abra o script.google.com e veja se ele ainda está lá — ou cole o código de novo.`
    : 'Faça uma vez, no computador, com o Google da Ingrid aberto (o mesmo do Google Agenda dela). Leva uns 3 minutos.';
  return barra('Google Agenda e avisos', { voltar: '/mais' }) + `<main>
  <div class="secao" style="margin-top:4px"><h2>Google Agenda</h2>${statusG}</div>
  <div class="card">
    <p class="small" style="margin:0">${dica}</p>
    <details ${lig ? '' : 'open'} style="margin-top:10px"><summary>Como ligar</summary><div><ol class="passos small">
      <li>Toque em <b>Copiar o código</b> (aqui embaixo).</li>
      <li>No computador, abra <b>script.google.com</b> → <b>Novo projeto</b>.</li>
      <li>Apague o que estiver escrito, <b>cole o código</b> e clique no disquete para salvar.</li>
      <li>Lá em cima, escolha <b>instalar</b> e clique em <b>Executar</b>.</li>
      <li>O Google pede permissão: <b>Revisar permissões</b> → a conta da Ingrid → <b>Avançado</b> → <b>Acessar (não seguro)</b> → <b>Permitir</b>. Aparece “não verificado” porque o robô é dela mesma, não de uma empresa.</li>
      <li>Pronto. Em até 5 minutos este quadro mostra <b>ligado</b>.</li>
    </ol></div></details>
    <div class="row wrap" style="gap:8px;margin-top:12px">
      <button class="btn" onclick="copiarRobo()" ${MODO_REAL && GOOGLE && GOOGLE.token ? '' : 'disabled'}>${ic('clipboard-list', 'sm')} Copiar o código</button>
      ${MODO_REAL && GOOGLE && GOOGLE.token ? `<button class="btn ghost" onclick="trocarLinkGoogle()">Gerar link novo</button>` : ''}
    </div>
    <p class="tiny muted" style="margin:10px 0 0">Cada visita confirmada vira um evento com o endereço e lembrete 60 e 15 min antes (toca no celular pelo app do Google Agenda). Compromissos dela no Google bloqueiam o horário no link do tutor — o tutor não vê o quê, só que está ocupado. Dia inteiro só bloqueia se o título começar com Ocupado, Folga, Férias, Viagem ou Plantão.</p>
  </div>

  <div class="secao"><h2>Avisos no celular</h2></div>
  <div class="card">
    <p class="small" style="margin:0">Notificação com som quando um tutor pede horário pelo link e 30 min antes de cada visita — mesmo com o app fechado. Ative em cada celular que a Ingrid usa.</p>
    <p class="small" id="avEstado" style="margin:10px 0 0">…</p>
    <div class="row wrap" style="gap:8px;margin-top:10px"><button class="btn" id="avLiga" hidden onclick="avAtivar()">${ic('bell', 'sm')} Ativar neste aparelho</button><button class="btn ghost" id="avTesteBtn" hidden onclick="avTeste()">Mandar um aviso de teste</button></div>
  </div>

  <div class="secao"><h2>Som com o app aberto</h2></div>
  <div class="card">
    <label class="row interruptor" for="somOn" style="min-height:44px"><input type="checkbox" id="somOn" ${somLigado() ? 'checked' : ''} onchange="try{localStorage.setItem('vetig_som',this.checked?'on':'off')}catch(e){};if(this.checked)sino()"> <span>Tocar um sino quando chegar pedido de horário e quando faltar 30 min para uma visita</span></label>
    <button class="btn mini ghost" style="margin-top:8px" onclick="sino()">${ic('volume-2', 'sm')} Ouvir o sino</button>
  </div>
  </main>`;
};
let googleBuscouNaTela = false;
TELAS.google.depois = () => {
  avPintar();
  if (MODO_REAL && !googleBuscouNaTela) { googleBuscouNaTela = true; googleInfo().then(g => { if (g && location.hash === '#/google') route({ manterScroll: true }); }); }
};
if (MODO_REAL) setTimeout(() => googleInfo(), 4000);
if (/^#\/google/.test(location.hash)) route();

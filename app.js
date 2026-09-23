/* Protótipo v0.2 — app da Dra. Ingrid Garrocini (veterinária a domicílio).
   Sem banco: tudo mora no localStorage deste aparelho. Duas faces: painel da Ingrid (#/...) e lado do tutor (#/t...). */

const DB_K = MODO_REAL ? 'vetig_real_v1' : 'vetig_db_v1';   // o real e a demonstração nunca se misturam
const COFRE_K = 'vetig_cofre_v1';
const RASC_K = 'vetig_rasc_';
const TUTOR_DEMO = 't1';

/* ---------- datas: sempre pelo relógio local (peça 10) ---------- */
function isoDe(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function isoHoje() { return isoDe(new Date()); }
function isoMais(iso, n) { const [y, m, d] = iso.split('-').map(Number); return isoDe(new Date(y, m - 1, d + n)); }
function mesMais(ym, n) { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function diasAte(iso) { const [y, m, d] = iso.split('-').map(Number); const [a, b, c] = isoHoje().split('-').map(Number); return Math.round((new Date(y, m - 1, d) - new Date(a, b - 1, c)) / 864e5); }
const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const SEM_LONGO = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function dataCurta(iso) { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return d + '/' + m + (y !== isoHoje().slice(0, 4) ? '/' + y.slice(2) : ''); }
function diaSemN(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).getDay(); }
function diaSem(iso) { return SEM[diaSemN(iso)]; }
function quando(iso) { const n = diasAte(iso); if (n === 0) return 'hoje'; if (n === 1) return 'amanhã'; if (n === -1) return 'ontem'; return n > 0 ? 'em ' + n + ' dias' : 'há ' + (-n) + ' dias'; }
const minutos = h => +h.slice(0, 2) * 60 + +h.slice(3, 5);
const hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
function idade(nasc) {
  if (!nasc) return 'idade a confirmar';
  const dias = -diasAte(nasc);
  if (dias < 60) return Math.max(1, Math.round(dias / 7)) + ' semanas';
  if (dias < 365) return Math.round(dias / 30.4) + ' meses';
  const a = Math.floor((dias + 2) / 365.25); return a + (a === 1 ? ' ano' : ' anos');
}

/* ---------- utilidades ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = v => (v < 0 ? '− ' : '') + 'R$ ' + Math.abs(Number(v || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brlCurto = v => brl(v).replace(',00', '');
const vg = n => String(n).replace('.', ',');
const semAcento = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
function toast(t, desfazer) {
  const e = $('#toast');
  e.innerHTML = '<span>' + esc(t) + '</span>' + (desfazer ? '<button type="button" id="tDesf">Desfazer</button>' : '');
  e.classList.toggle('acao', !!desfazer); e.classList.add('on');
  if (desfazer) $('#tDesf').onclick = () => { e.classList.remove('on'); desfazer(); };
  clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), desfazer ? 5500 : 2400);
}
/* toda ação que muda dados pode ser desfeita: guarda uma foto do banco antes */
function comDesfazer(msg, fn) {
  const foto = JSON.stringify(DB);
  fn(); salvar();
  toast(msg, () => { DB = JSON.parse(foto); salvar(); route({ manterScroll: true }); toast('Desfeito'); });
}

/* ---------- dados ---------- */
let DB;
function carregar() {
  try { DB = JSON.parse(localStorage.getItem(DB_K)); } catch (e) { DB = null; }
  if (MODO_REAL) { if (!DB) { DB = seedReal(); salvarLocal(); } return; }
  if (!DB || DB.seedVer !== SEED_VER) { DB = seedDB(); salvarLocal(); }
}
function salvarLocal() { try { localStorage.setItem(DB_K, JSON.stringify(DB)); } catch (e) { toast('Não consegui guardar neste aparelho'); } }
function salvar() { salvarLocal(); nuvAgendarEnvio(); }   // no modo real, sobe para a nuvem em 1,5 s

/* ---------- cofre: cópias automáticas neste aparelho (fórmula app-um-so) ---------- */
function cofreLer() { try { return JSON.parse(localStorage.getItem(COFRE_K)) || { copias: [] }; } catch (e) { return { copias: [] }; } }
function cofreGravar(c) { try { localStorage.setItem(COFRE_K, JSON.stringify(c)); return true; } catch (e) { if (c.copias.length > 2) { c.copias.pop(); return cofreGravar(c); } return false; } }
function cofreGuardar(motivo, dados = DB) {
  if (!MODO_REAL || !dados) return false;
  const peso = nuvPeso(dados), c = cofreLer(), dia = isoHoje();
  const maiorHoje = Math.max(0, ...c.copias.filter(x => x.dia === dia).map(x => x.peso || 0));
  const maiorTudo = Math.max(0, ...c.copias.map(x => x.peso || 0));
  if (peso === 0 && maiorTudo > 0) return false;                                            // vazio não come cheio
  if (motivo === 'abertura' && peso > 0 && maiorHoje > 0 && peso < maiorHoje * 0.5) return false;   // perdeu metade: suspeito
  if (motivo === 'abertura' && c.copias.some(x => x.dia === dia && x.motivo === 'abertura')) return false;   // uma por dia
  c.copias.unshift({ em: new Date().toISOString(), dia, peso, motivo, resumo: nuvResumo(dados), dados: JSON.parse(JSON.stringify(dados)) });
  const porDia = {}; c.copias = c.copias.filter(x => (porDia[x.dia] = (porDia[x.dia] || 0) + 1) <= (x.dia === dia ? 3 : 1)).slice(0, 17);
  return cofreGravar(c);
}
const tutor = id => DB.tutores.find(t => t.id === id);
const animal = id => DB.animais.find(a => a.id === id);
const tab = id => DB.tabela.find(t => t.id === id);
const ehGato = a => a.especie === 'Gato';
const avatar = (a, cls = '') => `<div class="ava ${ehGato(a) ? 'gato' : ''} ${cls}" aria-hidden="true">${ic(ehGato(a) ? 'cat' : 'dog')}</div>`;
const avatarTutor = t => { const an = DB.animais.filter(a => a.tutorId === t.id); return `<div class="ava dupla" aria-hidden="true">${an.slice(0, 3).map(a => ic(ehGato(a) ? 'cat' : 'dog')).join('') || ic('users')}</div>`; };
const pesoAtual = a => a.pesos.length ? a.pesos[a.pesos.length - 1].kg : null;
const totalItens = itens => itens.reduce((s, i) => s + (tab(i.tab)?.preco || 0) * (i.qtd || 1), 0);
const servicosTxt = g => [g.servico, ...(g.extras || [])].map(id => tab(id)?.nome).filter(Boolean).join(' + ');
const linkApp = h => location.origin + location.pathname + '#' + h;
const waLink = txt => 'https://wa.me/?text=' + encodeURIComponent(txt);   // protótipo: sem número, a pessoa escolhe o contato
const endereco = t => t.endereco + ', ' + t.bairro;
const mapsLink = t => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(endereco(t));
const rotaLink = t => 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + encodeURIComponent(endereco(t));
function rotaDoDia(visitas) {
  const ends = visitas.map(g => endereco(tutor(animal(g.animalId).tutorId)));
  if (!ends.length) return '#';
  const destino = ends.pop();
  return 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + encodeURIComponent(destino) + (ends.length ? '&waypoints=' + encodeURIComponent(ends.join('|')) : '');
}

function statusDose(v) {
  if (v.status === 'aplicada') return { k: 'aplicada', txt: 'aplicada ' + dataCurta(v.data), cls: 'verde' };
  const n = diasAte(v.data);
  if (n < 0) return { k: 'atrasada', txt: 'atrasada há ' + (-n) + (n === -1 ? ' dia' : ' dias'), cls: 'coral' };
  if (n <= 15) return { k: 'vence', txt: 'vence ' + quando(v.data), cls: 'ambar' };
  return { k: 'programada', txt: 'programada ' + dataCurta(v.data), cls: 'cinza' };
}
const dosesPendentes = () => DB.doses.filter(v => v.status === 'programada');
const atrasadas = () => dosesPendentes().filter(v => diasAte(v.data) < 0);
const vencendo = () => dosesPendentes().filter(v => { const n = diasAte(v.data); return n >= 0 && n <= 15; });
/* só a próxima dose de cada vacina do animal */
const proximasDoses = (animalId, ate = 9999) => DB.doses.filter(v => v.animalId === animalId && v.status === 'programada' && diasAte(v.data) <= ate)
  .sort((x, y) => x.data.localeCompare(y.data)).filter((v, i, arr) => arr.findIndex(w => w.vacina === v.vacina) === i);

/* ---------- ocupada? (peça 5 e 11) ---------- */
function formularioSujo() {
  return [...document.querySelectorAll('#app input, #app textarea, #folha input, #folha textarea')].some(e =>
    (e.type === 'checkbox' || e.type === 'radio') ? e.checked !== e.defaultChecked : e.value !== e.defaultValue);
}
function isBusyEditing() {
  const a = document.activeElement;
  if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return true;
  if ($('#ov').classList.contains('on')) return true;
  return formularioSujo();
}

/* ---------- ditado por voz (grátis, do próprio navegador) ---------- */
function ditar(sel) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const el = $(sel);
  if (!SR || !el) return toast('Ditado não disponível neste navegador');
  const r = new SR(); r.lang = 'pt-BR'; r.interimResults = false;
  r.onresult = e => { el.value += (el.value ? ' ' : '') + e.results[0][0].transcript; el.dispatchEvent(new Event('input', { bubbles: true })); };
  r.onerror = () => toast('Não consegui ouvir — tente de novo');
  r.start(); toast('Pode falar…');
}
const micBtn = sel => `<button type="button" class="icbtn mic" aria-label="Ditar por voz" onclick="ditar('${sel}')">${ic('mic')}</button>`;

/* ---------- roteador (peça 9) ---------- */
function go(h) { if (location.hash === '#' + h) route(); else location.hash = h; }
window.addEventListener('hashchange', () => route());

function route(opts = {}) {
  const y = window.scrollY;
  const h = (location.hash || '#/').slice(1);
  const p = h.split('/').filter(Boolean);
  const ladoTutor = p[0] === 't';
  const precisaEntrar = MODO_REAL && !ladoTutor && (!isLoggedIn() || NUV.dona === false || p[0] === 'nova-senha');
  document.body.classList.toggle('tutor', ladoTutor || precisaEntrar);
  if (!NUV.conflito) fecharFolha();
  if (!MODO_REAL) {
    $('#faixa').innerHTML = ladoTutor
      ? '<span>Demonstração · você está vendo o app como <b>tutor</b></span><button onclick="go(\'/\')">Voltar à Ingrid</button>'
      : '<span>Demonstração · dados de exemplo</span><button onclick="go(\'/t\')">Ver como tutor</button>';
  } else nuvStatus(NUV.status);
  const aba = ({ '': 'hoje', avisos: 'hoje', agenda: 'agenda', clientes: 'clientes', tutor: 'clientes', animal: 'clientes', atender: 'clientes', receita: 'clientes', assistente: 'ia' }[p[0] || ''] || 'mais');
  $('#rail').innerHTML = '<div class="rail-marca"><img src="simbolo.png" alt="">Dra. Ingrid</div>' +
    [['hoje', '/', 'Hoje', 'house'], ['agenda', '/agenda', 'Agenda', 'calendar'], ['clientes', '/clientes', 'Clientes', 'users'], ['ia', '/assistente', 'Assistente', 'sparkles'], ['mais', '/mais', 'Mais', 'ellipsis']]
      .map(([k, href, t, i]) => `<a href="#${href}" class="${aba === k ? 'on' : ''}" ${aba === k ? 'aria-current="page"' : ''}>${ic(i)}${t}</a>`).join('');

  const tela = precisaEntrar ? (p[0] === 'nova-senha' ? TELAS['nova-senha'] : NUV.dona === false && isLoggedIn() ? TELAS.naoDona : TELAS.entrar)
    : ladoTutor ? (MODO_REAL ? (TUTOR_REAL[p[1]] || TUTOR_REAL.home) : TUTOR[p[1] || 'home']) : TELAS[p[0] || 'hoje'];
  const args = ladoTutor ? p.slice(2) : p.slice(1);
  $('#app').innerHTML = tela ? tela(...args) : '<main><p>Tela não encontrada.</p></main>';
  if (tela && tela.depois) tela.depois(...args);
  window.scrollTo({ top: opts.manterScroll ? y : 0, behavior: 'instant' });
}

/* ---------- folha (overlay) ---------- */
function abrirFolha(html) {
  $('#folha').innerHTML = `<button class="icbtn fundo fecha" onclick="fecharFolha()" aria-label="Fechar">${ic('x')}</button>` + html;
  $('#ov').classList.add('on');
}
function fecharFolha() { $('#ov').classList.remove('on'); }
$('#ov').addEventListener('click', e => { if (e.target.id === 'ov') fecharFolha(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharFolha(); });

/* barra de topo compacta: título, voltar e ações */
function barra(titulo, { voltar, sub, acoes = '' } = {}) {
  return `<header class="barra-app"><div class="in">${voltar ? `<a class="icbtn" href="#${voltar}" aria-label="Voltar">${ic('chevron-left', 'lg')}</a>` : '<img src="simbolo.png" alt="" style="height:26px;margin:0 6px 0 8px">'}
    <h1>${titulo}${sub ? `<span class="sub">${sub}</span>` : ''}</h1>${acoes}${document.body.classList.contains('tutor') ? '' : sinoBtn()}</div></header>`;
}
const acaoBtn = (icone, rotulo, onclick) => `<button class="icbtn" aria-label="${rotulo}" title="${rotulo}" onclick="${onclick}">${ic(icone)}</button>`;

/* ---------- avisos do dia (lembretes ativos ao tutor) ---------- */
function avisosHoje() {
  const lista = [];
  const jaAvisado = k => DB.avisos[k] && diasAte(DB.avisos[k]) > -7;
  dosesPendentes().filter(v => diasAte(v.data) <= 15).sort((a, b) => a.data.localeCompare(b.data)).forEach(v => {
    const a = animal(v.animalId), t = tutor(a.tutorId), n = diasAte(v.data), k = 'v' + v.id;
    if (jaAvisado(k)) return;
    const frase = n < 0 ? `a vacina ${v.vacina} ${v.total > 1 ? `(${v.n}ª dose) ` : ''}do ${a.nome} venceu em ${dataCurta(v.data)}` : `a vacina ${v.vacina} ${v.total > 1 ? `(${v.n}ª dose) ` : ''}do ${a.nome} vence ${quando(v.data)} (${dataCurta(v.data)})`;
    lista.push({ k, a, t, tipo: 'Vacina', cls: n < 0 ? 'coral' : 'ambar', titulo: `${v.vacina} ${v.total > 1 ? v.n + '/' + v.total : ''} · ${n < 0 ? 'atrasada' : quando(v.data)}`,
      msg: `Olá, ${t.nome.split(' ')[0]}! Aqui é a Dra. Ingrid 🐾\nPassando para lembrar que ${frase}.\nVamos marcar a visita? Escolha o melhor horário aqui: ${linkApp('/t/agendar')}` });
  });
  DB.animais.filter(a => a.checkup && diasAte(a.checkup) <= 15).forEach(a => {
    const t = tutor(a.tutorId), k = 'c' + a.id + a.checkup;
    if (jaAvisado(k)) return;
    lista.push({ k, a, t, tipo: 'Check-up', cls: diasAte(a.checkup) < 0 ? 'coral' : 'azul', titulo: `Avaliação periódica · ${diasAte(a.checkup) < 0 ? 'passou ' + quando(a.checkup) : quando(a.checkup)}`,
      msg: `Olá, ${t.nome.split(' ')[0]}! Aqui é a Dra. Ingrid 🐾\nEstá na hora do check-up do ${a.nome} — a avaliação periódica que ajuda a pegar qualquer coisa cedo.\nMarque aqui o melhor dia: ${linkApp('/t/agendar')}` });
  });
  DB.atendimentos.filter(at => diasAte(at.data) >= -2 && diasAte(at.data) <= 0).forEach(at => {
    const a = animal(at.animalId), t = tutor(a.tutorId), k = 'av' + at.id;
    if (DB.avisos[k] || DB.avaliacoes.some(x => x.tutorId === t.id && diasAte(x.data) >= -3)) return;
    lista.push({ k, a, t, tipo: 'Avaliação', cls: 'verde', titulo: `Pedir avaliação da visita de ${quando(at.data)}`,
      msg: `Oi, ${t.nome.split(' ')[0]}! Obrigada por confiar em mim para cuidar do ${a.nome} 💜\n` + (MODO_REAL ? (DB.cfg.google ? `Se puder, deixe sua avaliação no Google — ajuda outros tutores a me encontrar: ${DB.cfg.google}` : 'Qualquer dúvida sobre o tratamento, é só me chamar aqui.') : `Conta como foi? Leva 1 minuto: ${linkApp('/t/avaliar')}`) });
  });
  return lista;
}
function avisar(k) {
  const x = avisosHoje().find(i => i.k === k); if (!x) return;
  abrirFolha(`<h2>Avisar ${esc(x.t.nome)}</h2><p class="muted small">${esc(x.tipo)} · ${esc(x.a.nome)} · ${esc(x.t.fone)}</p>
    <label for="msgAviso">Mensagem (pode editar)</label><textarea id="msgAviso" rows="7">${esc(x.msg)}</textarea>
    <div class="aviso lil small" style="margin-top:10px">No protótipo o WhatsApp abre para você escolher o contato. No app real ele já abre na conversa do tutor — e, na versão 2, sai sozinho.</div>
    <div class="row" style="margin-top:14px"><a class="btn wa grow" target="_blank" rel="noopener" id="btnWa" href="${waLink(x.msg)}" onclick="marcarAvisado('${x.k}')">${ic('message-circle')} Abrir no WhatsApp</a>
    <button class="btn ghost" onclick="fecharFolha();comDesfazer('Marcado como avisado',()=>{DB.avisos['${x.k}']=isoHoje()});route({manterScroll:true})">Já avisei</button></div>`);
  $('#msgAviso').addEventListener('input', e => { $('#btnWa').href = waLink(e.target.value); });
}
function marcarAvisado(k) { DB.avisos[k] = isoHoje(); salvar(); setTimeout(() => route({ manterScroll: true }), 400); }

/* ---------- Google Agenda (sem API: link de evento pronto) ---------- */
function linkGoogle(g) {
  const a = animal(g.animalId), t = tutor(a.tutorId);
  const ini = g.data.replace(/-/g, '') + 'T' + g.hora.replace(':', '') + '00';
  const fim = g.data.replace(/-/g, '') + 'T' + hhmm(minutos(g.hora) + 60).replace(':', '') + '00';
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    '&text=' + encodeURIComponent(`${servicosTxt(g) || 'Visita'} — ${a.nome} (${t.nome})`) +
    '&dates=' + ini + '/' + fim + '&ctz=America/Sao_Paulo' +
    '&location=' + encodeURIComponent(endereco(t)) +
    '&details=' + encodeURIComponent(`${a.especie} · ${a.raca}\nTutor: ${t.nome} ${t.fone}\n${g.obs || ''}`);
}
function confirmar(gid) {
  const g = DB.agenda.find(x => x.id === gid);
  comDesfazer('Horário confirmado', () => { g.status = 'confirmado'; const an = animal(g.animalId); if (an) { delete an.provisorio; const tu = tutor(an.tutorId); if (tu) delete tu.provisorio; } });
  const a = animal(g.animalId), t = tutor(a.tutorId);
  const msg = `Olá, ${t.nome.split(' ')[0]}! Visita confirmada ✅\n${servicosTxt(g) || 'Visita'} do ${a.nome}\n${diaSem(g.data)}, ${dataCurta(g.data)} às ${g.hora}\nEndereço: ${endereco(t)}\nQualquer mudança é só me chamar. Dra. Ingrid 🐾`;
  route({ manterScroll: true });
  abrirFolha(`<h2>Horário confirmado</h2><p class="muted">${esc(a.nome)} · ${diaSem(g.data)} ${dataCurta(g.data)} às ${g.hora}</p>
    <div class="stack" style="margin-top:14px">
      <a class="btn wa full" target="_blank" rel="noopener" href="${waLink(msg)}">${ic('message-circle')} Avisar o tutor no WhatsApp</a>
      <a class="btn sec full" target="_blank" rel="noopener" href="${linkGoogle(g)}">${ic('calendar')} Pôr no Google Agenda</a>
      <p class="tiny muted">No app real a visita entra sozinha no Google Agenda da Ingrid, e os horários ocupados lá somem do link do tutor.</p>
    </div>`);
}
function recusar(gid) {
  const g = DB.agenda.find(x => x.id === gid), a = animal(g.animalId), t = tutor(a.tutorId);
  comDesfazer('Pedido retirado da agenda', () => {
    DB.agenda = DB.agenda.filter(x => x.id !== gid);
    const semUso = aid => !DB.agenda.some(x => x.animalId === aid) && !DB.doses.some(x => x.animalId === aid) && !DB.atendimentos.some(x => x.animalId === aid);
    if (a.provisorio && semUso(a.id)) DB.animais = DB.animais.filter(x => x.id !== a.id);
    if (t.provisorio && !DB.animais.some(x => x.tutorId === t.id)) DB.tutores = DB.tutores.filter(x => x.id !== t.id);
  });
  const msg = `Olá, ${t.nome.split(' ')[0]}! Infelizmente não consigo ${diaSem(g.data)} ${dataCurta(g.data)} às ${g.hora}. Pode escolher outro horário aqui? ${linkApp('/t/agendar')} 🐾`;
  route({ manterScroll: true });
  abrirFolha(`<h2>Pedir outro horário</h2><p class="muted small">O pedido saiu da agenda. Mande o link para ${esc(t.nome.split(' ')[0])} escolher outro.</p><a class="btn wa full" style="margin-top:12px" target="_blank" rel="noopener" href="${waLink(msg)}">${ic('message-circle')} Mandar no WhatsApp</a>`);
}
function aCaminho(gid) {
  const g = DB.agenda.find(x => x.id === gid), a = animal(g.animalId), t = tutor(a.tutorId);
  return waLink(`Olá, ${t.nome.split(' ')[0]}! Aqui é a Dra. Ingrid 🐾 Estou a caminho para a visita do ${a.nome}. Chego em cerca de 20 minutos.`);
}

/* ================= TELAS DA INGRID ================= */
const TELAS = {};

function proximaVisita() {
  const hoje = isoHoje(), agora = new Date().getHours() * 60 + new Date().getMinutes();
  const vs = DB.agenda.filter(g => g.data === hoje && g.status === 'confirmado').sort((a, b) => a.hora.localeCompare(b.hora));
  return vs.find(g => minutos(g.hora) >= agora - 60) || vs[0] || null;
}
TELAS.hoje = () => {
  const hoje = isoHoje();
  const visitas = DB.agenda.filter(g => g.data === hoje && g.status !== 'pedido').sort((a, b) => a.hora.localeCompare(b.hora));
  const pendentes = visitas.filter(g => g.status !== 'feito');
  const pedidos = DB.agenda.filter(g => g.status === 'pedido').sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  const avisos = avisosHoje();
  const ym = hoje.slice(0, 7);
  const entrou = DB.lanc.filter(l => l.tipo === 'entrada' && l.data.startsWith(ym)).reduce((s, l) => s + l.valor, 0);
  const aReceber = DB.orcamentos.filter(o => o.status !== 'pago').reduce((s, o) => s + totalItens(o.itens), 0);
  const est = DB.estoque.filter(e => e.qtd <= e.min || (e.validade && diasAte(e.validade) <= 30));
  const [, m, d] = hoje.split('-').map(Number);
  const hr = new Date().getHours(), saud = hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite';
  const px = proximaVisita();
  let cardPx = '';
  if (px) {
    const a = animal(px.animalId), t = tutor(a.tutorId), falta = minutos(px.hora) - (new Date().getHours() * 60 + new Date().getMinutes());
    cardPx = `<div class="proxima"><div class="quando">Próxima visita · ${px.hora}${falta > 0 && falta < 180 ? ` · em ${falta} min` : ''}</div>
      <div class="row" style="margin-top:8px">${avatar(a)}<div class="grow"><b>${esc(a.nome)}</b> <span class="muted small">· ${esc(t.nome)}</span><div class="small">${esc(servicosTxt(px))}</div>
      <div class="tiny muted">${esc(endereco(t))}</div></div></div>
      <div class="botoes"><a class="btn sec" href="${rotaLink(t)}" target="_blank" rel="noopener">${ic('navigation', 'sm')} Rota</a>
      <a class="btn sec" href="${aCaminho(px.id)}" target="_blank" rel="noopener">${ic('car', 'sm')} A caminho</a>
      <a class="btn" href="#/atender/${a.id}/${px.id}">${ic('stethoscope', 'sm')} Atender</a></div></div>`;
  } else cardPx = `<div class="proxima"><div class="quando">Sem mais visitas hoje</div><p class="small muted" style="margin:6px 0 0">Aproveite para responder os pedidos e avisar os tutores abaixo.</p></div>`;

  return `<section class="hero"><div class="in"><div class="marca"><img src="simbolo.png" alt=""><b>Dra. Ingrid Garrocini</b><span>CRMV ${esc(DB.cfg.crmv)}</span>${sinoBtn()}</div>
    <h1>${saud}, Ingrid</h1><div class="sub">${SEM_LONGO[diaSemN(hoje)]}, ${d} de ${MESES[m - 1]} · ${pendentes.length ? pendentes.length + (pendentes.length === 1 ? ' visita pela frente' : ' visitas pela frente') : 'agenda do dia concluída'}</div>
    ${cardPx}</div></section><main>
  <div class="kpis" role="list">
    <a class="kpi ${atrasadas().length ? 'alerta' : ''}" role="listitem" href="#/clientes" onclick="filtroCli='atrasada'"><b>${atrasadas().length}</b><span>vacinas atrasadas</span></a>
    <a class="kpi" role="listitem" href="#/clientes" onclick="filtroCli='vence'"><b>${vencendo().length}</b><span>vencem em 15 dias</span></a>
    <a class="kpi" role="listitem" href="#/financeiro"><b>${brlCurto(entrou)}</b><span>entrou em ${MESES[m - 1]}</span></a>
    <a class="kpi" role="listitem" href="#/financeiro"><b>${brlCurto(aReceber)}</b><span>a receber</span></a>
  </div>

  ${pedidos.length ? `<div class="secao"><h2>Para aprovar<span class="cont">${pedidos.length}</span></h2></div>
  <div class="card">${pedidos.map(g => { const a = animal(g.animalId), t = tutor(a.tutorId); return `
    <div class="item">${avatar(a)}
      <div class="grow"><b>${esc(a.nome)}</b> <span class="muted small">· ${esc(t.nome)}</span>
      <div class="small">${diaSem(g.data)} ${dataCurta(g.data)} às <b>${g.hora}</b> · ${esc(servicosTxt(g))}</div>
      <div class="tiny muted">${esc(t.bairro)} · pediu pelo link</div>
      <div class="row" style="margin-top:8px"><button class="btn mini" onclick="confirmar('${g.id}')">${ic('check', 'sm')} Confirmar</button><button class="btn mini ghost" onclick="recusar('${g.id}')">Outro horário</button></div></div></div>`; }).join('')}</div>` : ''}

  <div class="secao"><h2>Visitas de hoje</h2>${pendentes.length > 1 ? `<a class="btn mini ghost" href="${rotaDoDia(pendentes)}" target="_blank" rel="noopener">${ic('route', 'sm')} Rota do dia</a>` : ''}</div>
  <div class="card">${visitas.length ? visitas.map(g => { const a = animal(g.animalId), t = tutor(a.tutorId); return `
    <div class="item"><div class="hora">${g.hora}</div>
      <div class="grow"><b>${esc(a.nome)}</b> <span class="muted small">· ${esc(t.nome)}</span>
      <div class="small">${esc(servicosTxt(g))}${g.obs ? ' · ' + esc(g.obs) : ''}</div>
      <div class="tiny muted">${ic('map-pin', 'sm')} ${esc(t.bairro)}</div></div>
      ${g.status === 'feito' ? `<span class="tag verde">${ic('check', 'sm')} feito</span>` : `<a class="btn mini" href="#/atender/${a.id}/${g.id}">Atender</a>`}</div>`; }).join('') : '<p class="muted" style="margin:0">Nenhuma visita hoje.</p>'}</div>

  <div class="secao"><h2>Avisar hoje${avisos.length ? `<span class="cont">${avisos.length}</span>` : ''}</h2><a href="#/avisos" class="small">Todos os avisos</a></div>
  <div class="card">${avisos.length ? avisos.map(x => `
    <div class="item">${avatar(x.a)}
      <div class="grow"><b>${esc(x.a.nome)}</b> <span class="muted small">· ${esc(x.t.nome)}</span><div class="small"><span class="tag ${x.cls}">${x.tipo}</span> ${esc(x.titulo)}</div></div>
      <button class="btn mini wa" onclick="avisar('${x.k}')" aria-label="Avisar ${esc(x.t.nome)}">${ic('message-circle', 'sm')} Avisar</button></div>`).join('') : '<p class="muted" style="margin:0">Todo mundo avisado.</p>'}</div>

  ${est.length ? `<div class="secao"><h2>Estoque</h2><a href="#/estoque" class="small">Ver tudo</a></div>
  <div class="card">${est.map(e => `<div class="item"><div class="grow"><b>${esc(e.nome)}</b><div class="small muted">${e.qtd} em estoque${e.lote ? ' · lote ' + esc(e.lote) : ''}</div></div>
    ${e.qtd <= e.min ? '<span class="tag coral">repor</span>' : ''}${e.validade && diasAte(e.validade) <= 30 ? `<span class="tag ambar">vence ${quando(e.validade)}</span>` : ''}</div>`).join('')}</div>` : ''}
  </main>`;
};

/* ---- Agenda: linha do dia com os horários livres ---- */
let diaAgenda = null;
TELAS.agenda = () => {
  const hoje = isoHoje(); diaAgenda = diaAgenda || hoje;
  const dias = Array.from({ length: 21 }, (_, i) => isoMais(hoje, i - 1));
  const doDia = DB.agenda.filter(g => g.data === diaAgenda).sort((a, b) => a.hora.localeCompare(b.hora));
  const h = DB.cfg.horario, [ay, am] = diaAgenda.split('-').map(Number);
  // monta a linha do dia: visitas + faixas livres
  const linhas = [];
  let livreIni = null;
  const fechaLivre = fim => { if (livreIni !== null) { linhas.push({ livre: true, ini: livreIni, fim }); livreIni = null; } };
  for (let m = minutos(h.ini); m < minutos(h.fim); m += h.passo) {
    const aqui = doDia.filter(g => minutos(g.hora) >= m && minutos(g.hora) < m + h.passo);
    if (aqui.length) { fechaLivre(m); aqui.forEach(g => linhas.push({ g })); }
    else if (livreIni === null) livreIni = m;
  }
  fechaLivre(minutos(h.fim));
  doDia.filter(g => minutos(g.hora) < minutos(h.ini) || minutos(g.hora) >= minutos(h.fim)).forEach(g => linhas.push({ g }));
  const passado = diasAte(diaAgenda) < 0;
  const vis = doDia.filter(g => g.status === 'confirmado');
  return barra('Agenda', { sub: `Todos os dias · ${h.ini} às ${h.fim}`, acoes: acaoBtn('plus', 'Novo horário', "novoHorario({})") }) + `<main>
  <div class="row between"><b style="text-transform:capitalize">${MESES[am - 1]} ${ay}</b>${diaAgenda !== hoje ? `<button class="btn mini ghost" onclick="diaAgenda=isoHoje();route({manterScroll:true})">Hoje</button>` : ''}</div>
  <div class="dias" role="tablist">${dias.map(d => { const n = DB.agenda.filter(g => g.data === d && g.status !== 'pedido').length; return `<button role="tab" aria-selected="${d === diaAgenda}" class="${d === diaAgenda ? 'on' : ''}" onclick="diaAgenda='${d}';route({manterScroll:true})">${diaSem(d)}<b>${d.slice(8)}</b><small>${n ? n + (n === 1 ? ' visita' : ' visitas') : '&nbsp;'}</small>${DB.agenda.some(g => g.data === d && g.status === 'pedido') ? '<i title="pedido para aprovar"></i>' : ''}</button>`; }).join('')}</div>
  <div class="row between"><h2>${SEM_LONGO[diaSemN(diaAgenda)]}, ${dataCurta(diaAgenda)} <span class="muted small">· ${quando(diaAgenda)}</span></h2>
    ${vis.length > 1 ? `<a class="btn mini ghost" href="${rotaDoDia(vis)}" target="_blank" rel="noopener">${ic('route', 'sm')} Rota</a>` : ''}</div>
  <div style="margin-top:8px">${linhas.map(l => l.livre ? (passado ? '' : `<div class="livre"><span>${ic('clock', 'sm')} Livre ${hhmm(l.ini)} – ${hhmm(l.fim)}</span><button class="btn mini ghost" onclick="novoHorario({hora:'${hhmm(l.ini)}'})">${ic('plus', 'sm')} Marcar</button></div>`) : (() => {
    const g = l.g, a = animal(g.animalId), t = tutor(a.tutorId); return `
    <div class="card" style="margin:8px 0"><div class="row" style="align-items:flex-start"><div class="hora">${g.hora}</div><div class="grow"><b>${esc(a.nome)}</b> <span class="muted small">· ${esc(t.nome)}</span>
      <div class="small">${esc(servicosTxt(g))} · ${esc(t.bairro)}</div>
      <div class="row wrap" style="margin-top:8px">${g.status === 'pedido' ? `<span class="tag coral">pedido do tutor</span><button class="btn mini" onclick="confirmar('${g.id}')">Confirmar</button>` : g.status === 'feito' ? '<span class="tag verde">feito</span>' : `<a class="btn mini" href="#/atender/${a.id}/${g.id}">Atender</a>`}</div></div>
      <a class="icbtn" target="_blank" rel="noopener" href="${linkGoogle(g)}" aria-label="Pôr no Google Agenda" title="Pôr no Google Agenda">${ic('calendar')}</a></div></div>`; })()).join('') || '<p class="muted">Dia livre.</p>'}</div>
  <div class="aviso lil small" style="margin-top:14px">O tutor marca pelo link e você confirma. No app real a agenda conversa com o seu Google Agenda nos dois sentidos.</div>
  </main>`;
};
function novoHorario({ hora = '10:00', animalId = '', servico = '', data = diaAgenda || isoHoje() } = {}) {
  const ops = DB.animais.map(a => `<option value="${a.id}" ${a.id === animalId ? 'selected' : ''}>${esc(a.nome)} — ${esc(tutor(a.tutorId).nome)}</option>`).join('');
  abrirFolha(`<h2>Novo horário</h2>
    <label for="nhA">Animal</label><select id="nhA">${ops}</select>
    <label for="nhS">Serviço</label><select id="nhS">${DB.tabela.filter(t => t.cat !== 'Deslocamento').map(t => `<option value="${t.id}" ${t.id === servico ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}</select>
    <div class="grid2"><div><label for="nhD">Dia</label><input type="date" id="nhD" value="${data}"></div><div><label for="nhH">Hora</label><input type="time" id="nhH" value="${hora}"></div></div>
    <label for="nhO">Observação</label><input id="nhO" placeholder="Ex.: levar balança">
    <button class="btn full" style="margin-top:16px" onclick="salvarHorario()">Guardar na agenda</button>`);
}
function salvarHorario() {
  const d = $('#nhD').value;
  const g = { id: uid('g'), animalId: $('#nhA').value, servico: $('#nhS').value, data: d, hora: $('#nhH').value, obs: $('#nhO').value, status: 'confirmado', origem: 'ingrid' };
  fecharFolha(); comDesfazer('Horário guardado', () => DB.agenda.push(g));
  diaAgenda = d; route({ manterScroll: true });
}

/* ---- Clientes (com o funil) ---- */
let filtroCli = 'todos', buscaCli = '';
function ultimaVisita(t) {
  const ids = DB.animais.filter(a => a.tutorId === t.id).map(a => a.id);
  return DB.atendimentos.filter(at => ids.includes(at.animalId)).map(at => at.data).sort().pop() || null;
}
function etapa(t) {
  const ids = DB.animais.filter(a => a.tutorId === t.id).map(a => a.id);
  if (atrasadas().some(v => ids.includes(v.animalId))) return { k: 'atrasada', txt: 'vacina atrasada', cls: 'coral' };
  if (DB.animais.some(a => ids.includes(a.id) && a.checkup && diasAte(a.checkup) <= 15)) return { k: 'checkup', txt: 'check-up a marcar', cls: 'azul' };
  if (vencendo().some(v => ids.includes(v.animalId))) return { k: 'vence', txt: 'vacina vencendo', cls: 'ambar' };
  if (diasAte(t.desde) >= -30) return { k: 'novo', txt: 'cliente novo', cls: '' };
  const u = ultimaVisita(t);
  if (u && diasAte(u) < -180) return { k: 'sumido', txt: 'sem visita há 6+ meses', cls: 'cinza' };
  return { k: 'emdia', txt: 'em dia', cls: 'verde' };
}
TELAS.clientes = () => {
  const filtros = [['todos', 'Todos'], ['atrasada', 'Vacina atrasada'], ['vence', 'Vacina vencendo'], ['checkup', 'Check-up'], ['novo', 'Novos'], ['sumido', 'Sumidos'], ['emdia', 'Em dia']];
  const q = semAcento(buscaCli);
  const lista = DB.tutores.filter(t => filtroCli === 'todos' || etapa(t).k === filtroCli)
    .filter(t => !q || semAcento(t.nome + ' ' + t.fone + ' ' + DB.animais.filter(a => a.tutorId === t.id).map(a => a.nome).join(' ')).includes(q))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  const cont = k => DB.tutores.filter(t => etapa(t).k === k).length;
  return barra('Clientes', { sub: `${DB.tutores.length} tutores · ${DB.animais.length} animais`, acoes: acaoBtn('plus', 'Novo tutor', 'novoTutor()') }) + `<main>
  <div class="row" style="position:relative"><span style="position:absolute;left:12px;color:var(--tinta-2);display:flex">${ic('search', 'sm')}</span><input id="buscaCli" type="search" aria-label="Buscar tutor, animal ou telefone" placeholder="Buscar tutor, animal ou telefone" value="${esc(buscaCli)}" style="padding-left:36px"></div>
  <div class="abas" role="tablist">${filtros.map(([k, t]) => `<button role="tab" aria-selected="${filtroCli === k}" class="${filtroCli === k ? 'on' : ''}" onclick="filtroCli='${k}';route({manterScroll:true})">${t}${k !== 'todos' ? ' · ' + cont(k) : ''}</button>`).join('')}</div>
  <div class="card" style="margin-top:8px">${lista.length ? lista.map(t => { const e = etapa(t), an = DB.animais.filter(a => a.tutorId === t.id); return `
    <a class="item" href="#/tutor/${t.id}">${avatarTutor(t)}
      <div class="grow"><b>${esc(t.nome)}</b><div class="small muted">${an.map(a => esc(a.nome)).join(', ')} · ${esc(t.bairro)}</div></div>
      <span class="tag ${e.cls}">${e.txt}</span></a>`; }).join('') : '<p class="muted" style="margin:0">Ninguém nesse filtro.</p>'}</div>
  </main>`;
};
TELAS.clientes.depois = () => { const i = $('#buscaCli'); i.addEventListener('input', () => { buscaCli = i.value; const pos = i.selectionStart; route({ manterScroll: true }); const n = $('#buscaCli'); n.focus(); n.setSelectionRange(pos, pos); }); };

function novoTutor() {
  abrirFolha(`<h2>Novo tutor</h2>
    <label for="ntN">Nome</label><input id="ntN" autocomplete="name"><div class="grid2"><div><label for="ntF">WhatsApp</label><input id="ntF" inputmode="tel" autocomplete="tel"></div><div><label for="ntC">CPF</label><input id="ntC" inputmode="numeric"></div></div>
    <label for="ntE">Endereço</label><input id="ntE" autocomplete="street-address"><div class="grid2"><div><label for="ntB">Bairro</label><input id="ntB"></div><div><label for="ntD">Distância</label><select id="ntD">${DB.tabela.filter(t => t.cat === 'Deslocamento').map(t => `<option value="${t.id}">${esc(t.nome.replace('Deslocamento ', ''))}</option>`).join('')}</select></div></div>
    <label for="ntO">Como chegou</label><select id="ntO"><option>WhatsApp</option><option>Instagram</option><option>Indicação</option><option>Google</option></select>
    <h3 style="margin-top:18px">Primeiro animal</h3>
    <div class="grid2"><div><label for="naN">Nome</label><input id="naN"></div><div><label for="naE">Espécie</label><select id="naE"><option>Cão</option><option>Gato</option></select></div></div>
    <div class="grid2"><div><label for="naR">Raça</label><input id="naR"></div><div><label for="naD">Nascimento</label><input type="date" id="naD"></div></div>
    <button class="btn full" style="margin-top:16px" onclick="salvarTutor()">Cadastrar</button>`);
}
function salvarTutor() {
  if (!$('#ntN').value.trim()) return toast('Falta o nome');
  const t = { id: uid('t'), nome: $('#ntN').value.trim(), fone: $('#ntF').value, cpf: $('#ntC').value, email: '', endereco: $('#ntE').value, bairro: $('#ntB').value, faixa: $('#ntD').value, origem: $('#ntO').value, desde: isoHoje() };
  DB.tutores.push(t);
  if ($('#naN').value.trim()) DB.animais.push({ id: uid('a'), tutorId: t.id, nome: $('#naN').value.trim(), especie: $('#naE').value, raca: $('#naR').value || 'SRD', sexo: '', castrado: false, nasc: $('#naD').value || isoHoje(), pesos: [], checkup: null });
  salvar(); fecharFolha(); go('/tutor/' + t.id); toast('Cadastrado');
}

TELAS.tutor = id => {
  const t = tutor(id); if (!t) return barra('Tutor', { voltar: '/clientes' }) + '<main>Tutor não encontrado.</main>';
  const an = DB.animais.filter(a => a.tutorId === id);
  const orc = DB.orcamentos.filter(o => o.tutorId === id).sort((a, b) => b.data.localeCompare(a.data));
  const devendo = orc.filter(o => o.status !== 'pago').reduce((s, o) => s + totalItens(o.itens), 0);
  const fx = tab(t.faixa);
  return barra(esc(t.nome), { voltar: '/clientes', sub: `Cliente desde ${dataCurta(t.desde)} · chegou por ${esc(t.origem)}` }) + `<main>
  <div class="acoes" style="grid-template-columns:repeat(3,1fr)">
    <a class="btn wa" target="_blank" rel="noopener" href="${waLink('Olá, ' + t.nome.split(' ')[0] + '! Aqui é a Dra. Ingrid 🐾')}">${ic('message-circle')}WhatsApp</a>
    <a class="btn sec" href="tel:${esc(t.fone.replace(/\D/g, ''))}">${ic('phone')}Ligar</a>
    <a class="btn sec" href="${mapsLink(t)}" target="_blank" rel="noopener">${ic('map-pin')}Mapa</a></div>
  ${devendo ? `<div class="aviso coral" style="margin-top:12px">Em aberto: <b>${brl(devendo)}</b></div>` : ''}
  <div class="card" style="margin-top:12px">
    <div class="small muted">Endereço</div><b>${esc(t.endereco)} — ${esc(t.bairro)}</b>
    <div class="tiny muted">${fx ? esc(fx.nome) + ' · ' + brl(fx.preco) : ''}</div>
    <div class="grid2" style="margin-top:10px"><div><div class="small muted">WhatsApp</div><b>${esc(t.fone)}</b></div>${t.cpf ? `<div><div class="small muted">CPF</div><b>${esc(t.cpf)}</b></div>` : ''}</div>
  </div>
  <div class="secao"><h2>Animais</h2><button class="btn mini ghost" onclick="novoAnimal('${id}')">${ic('plus', 'sm')} Animal</button></div>
  ${an.map(a => { const atr = DB.doses.some(v => v.animalId === a.id && statusDose(v).k === 'atrasada'); return `<a class="card row" href="#/animal/${a.id}">${avatar(a)}
    <div class="grow"><b>${esc(a.nome)}</b><div class="small muted">${esc(a.raca)} · ${idade(a.nasc)}${pesoAtual(a) ? ' · ' + vg(pesoAtual(a)) + ' kg' : ''}</div></div>
    ${atr ? '<span class="tag coral">vacina atrasada</span>' : ''}${ic('chevron-right')}</a>`; }).join('')}
  ${orc.length ? `<div class="secao"><h2>Orçamentos e cobranças</h2></div><div class="card">${orc.map(o => `<div class="item"><div class="grow"><b>${brl(totalItens(o.itens))}</b><div class="small muted">${dataCurta(o.data)} · ${esc(animal(o.animalId)?.nome || '')}</div></div>${tagOrc(o)}</div>`).join('')}</div>` : ''}
  </main>`;
};
const tagOrc = o => o.status === 'pago' ? `<span class="tag verde">pago · ${o.forma === 'cartao' ? 'cartão' : 'Pix'}</span>` : o.status === 'aprovado' ? '<span class="tag azul">aprovado · a receber</span>' : '<span class="tag ambar">enviado ao tutor</span>';
function novoAnimal(tid) {
  abrirFolha(`<h2>Novo animal</h2>
    <div class="grid2"><div><label for="naN">Nome</label><input id="naN"></div><div><label for="naE">Espécie</label><select id="naE"><option>Cão</option><option>Gato</option></select></div></div>
    <div class="grid2"><div><label for="naR">Raça</label><input id="naR"></div><div><label for="naS">Sexo</label><select id="naS"><option>Macho</option><option>Fêmea</option></select></div></div>
    <div class="grid2"><div><label for="naD">Nascimento</label><input type="date" id="naD"></div><div><label for="naP">Peso (kg)</label><input id="naP" inputmode="decimal"></div></div>
    <button class="btn full" style="margin-top:16px" onclick="salvarAnimal('${tid}')">Cadastrar</button>`);
}
function salvarAnimal(tid) {
  if (!$('#naN').value.trim()) return toast('Falta o nome');
  const kg = parseFloat(($('#naP').value || '').replace(',', '.'));
  const a = { id: uid('a'), tutorId: tid, nome: $('#naN').value.trim(), especie: $('#naE').value, raca: $('#naR').value || 'SRD', sexo: $('#naS').value, castrado: false, nasc: $('#naD').value || isoHoje(), pesos: kg ? [{ data: isoHoje(), kg }] : [], checkup: null };
  DB.animais.push(a); salvar(); fecharFolha(); go('/animal/' + a.id);
}

/* ---- Animal ---- */
let abaAnimal = 'tempo';
TELAS.animal = id => {
  const a = animal(id); if (!a) return barra('Animal', { voltar: '/clientes' }) + '<main>Animal não encontrado.</main>';
  const t = tutor(a.tutorId);
  const vs = DB.doses.filter(v => v.animalId === id).sort((x, y) => y.data.localeCompare(x.data));
  const ats = DB.atendimentos.filter(x => x.animalId === id).sort((x, y) => y.data.localeCompare(x.data));
  const rs = DB.receitas.filter(x => x.animalId === id);
  const tempo = [
    ...vs.filter(v => v.status === 'aplicada').map(v => ({ d: v.data, ic: 'syringe', t: `Vacina ${v.vacina}${v.total > 1 ? ' · dose ' + v.n + '/' + v.total : ''}`, s: v.lote ? 'lote ' + v.lote : '' })),
    ...ats.map(x => ({ d: x.data, ic: 'stethoscope', t: x.tipo, s: x.resumo })),
    ...rs.map(x => ({ d: x.data, ic: 'file-text', t: x.tipo === 'controle' ? 'Receita de controle especial nº ' + x.numero : 'Receita', s: x.itens.map(i => i.med).join(', ') })),
    ...a.pesos.map(p => ({ d: p.data, ic: 'scale', t: 'Peso ' + vg(p.kg) + ' kg', s: '' })),
  ].sort((x, y) => y.d.localeCompare(x.d));
  // cuidados pendentes, sempre à vista
  const cuid = proximasDoses(id, 30).map(v => { const s = statusDose(v); return `<div class="cuidado ${s.k === 'atrasada' ? 'coral' : ''}">${ic('syringe', 'sm')}<span class="grow"><b>${esc(v.vacina)}${v.total > 1 ? ' ' + v.n + '/' + v.total : ''}</b> · ${s.txt}</span><button class="btn mini" onclick="aplicarVacina('${id}','${v.id}')">Aplicar</button></div>`; });
  if (a.checkup && diasAte(a.checkup) <= 30) cuid.push(`<div class="cuidado azul">${ic('clipboard-list', 'sm')}<span class="grow"><b>Check-up</b> · ${diasAte(a.checkup) < 0 ? 'passou ' + quando(a.checkup) : quando(a.checkup)}</span><button class="btn mini" onclick="novoHorario({animalId:'${id}',servico:'s3'})">Marcar</button></div>`);
  const abas = [['tempo', 'Histórico'], ['vacinas', 'Vacinas'], ['atend', 'Consultas'], ['peso', 'Peso']];
  let corpo = '';
  if (abaAnimal === 'tempo') corpo = tempo.length ? tempo.map(e => `<div class="item"><div class="ava" style="background:var(--lil-3)">${ic(e.ic)}</div><div class="grow"><b>${esc(e.t)}</b><div class="small muted">${dataCurta(e.d)}${e.s ? ' · ' + esc(e.s) : ''}</div></div></div>`).join('') : '<p class="muted" style="margin:0">Nada registrado ainda.</p>';
  if (abaAnimal === 'vacinas') corpo = (vs.length ? vs.map(v => { const s = statusDose(v); return `<div class="item"><div class="grow"><b>${esc(v.vacina)}</b> <span class="muted small">${v.total > 1 ? 'dose ' + v.n + '/' + v.total + ' · ' : ''}${v.protocolo === 'filhote' ? 'protocolo filhote' : 'anual'}</span><div class="small muted">${dataCurta(v.data)}${v.lote ? ' · lote ' + esc(v.lote) : ''}</div></div><span class="tag ${s.cls}">${s.txt}</span></div>`; }).join('') : '<p class="muted" style="margin:0">Sem vacinas.</p>') +
    `<div class="row" style="margin-top:12px"><button class="btn mini" onclick="aplicarVacina('${id}')">Aplicar vacina</button><button class="btn mini ghost" onclick="iniciarProtocoloUI('${id}')">Iniciar protocolo</button></div>`;
  if (abaAnimal === 'atend') corpo = ats.length ? ats.map(x => `<details><summary>${dataCurta(x.data)} · ${esc(x.tipo)}</summary><div><p style="margin-top:0">${esc(x.resumo)}</p>${Object.entries(x.campos || {}).filter(([, v]) => v).map(([k, v]) => `<div class="small"><b>${esc(ROTULO[k] || k)}:</b> ${esc(v)}</div>`).join('')}</div></details>`).join('') : '<p class="muted" style="margin:0">Nenhum atendimento.</p>';
  if (abaAnimal === 'peso') { const mx = Math.max(...a.pesos.map(p => p.kg), 1); corpo = a.pesos.length ? a.pesos.map(p => `<div style="margin:10px 0"><div class="row between small"><span>${dataCurta(p.data)}</span><b>${vg(p.kg)} kg</b></div><div class="barra"><i style="width:${p.kg / mx * 100}%"></i></div></div>`).join('') : '<p class="muted" style="margin:0">Sem pesagens.</p>'; }
  return barra(esc(a.nome), { voltar: '/tutor/' + t.id, sub: esc(t.nome) }) + `<main>
  <div class="card"><div class="row">${avatar(a, 'xl')}<div class="grow"><h2 style="font-size:20px">${esc(a.nome)}</h2>
    <div class="small muted">${esc(a.especie)} · ${esc(a.raca)} · ${esc(a.sexo)}${a.castrado ? ' · castrado(a)' : ''}</div>
    <div class="small"><b>${idade(a.nasc)}</b>${pesoAtual(a) ? ' · <b>' + vg(pesoAtual(a)) + ' kg</b>' : ''}</div></div></div>
    ${cuid.length ? cuid.join('') : `<div class="cuidado" style="background:var(--verde-2);color:var(--verde)">${ic('check', 'sm')}<span class="grow">Vacinas e check-up em dia</span></div>`}
  </div>
  <div class="acoes" style="margin-top:12px"><a class="btn" href="#/atender/${id}">${ic('stethoscope')}Atender</a><button class="btn sec" onclick="aplicarVacina('${id}')">${ic('syringe')}Vacina</button><a class="btn sec" href="#/receita/${id}">${ic('file-text')}Receita</a><a class="btn sec" href="#/doses/${id}">${ic('scale')}Dose</a></div>
  <div class="abas" role="tablist">${abas.map(([k, n]) => `<button role="tab" aria-selected="${abaAnimal === k}" class="${abaAnimal === k ? 'on' : ''}" onclick="abaAnimal='${k}';route({manterScroll:true})">${n}</button>`).join('')}</div>
  <div class="card">${corpo}</div></main>`;
};

/* ---- Vacinas: protocolo gera as doses ---- */
function vacinasDaEspecie(a) { return DB.tabela.filter(t => t.vacina && (t.especie === 'Ambos' || t.especie === a.especie)); }
function iniciarProtocolo(animalId, vacina, protId, data1) {
  const p = DB.protocolos.find(x => x.id === protId);
  for (let i = 0; i < p.doses; i++) DB.doses.push({ id: uid('v'), animalId, vacina, protocolo: protId, n: i + 1, total: p.doses, data: isoMais(data1, i * p.intervalo), status: 'programada', lote: '' });
}
function iniciarProtocoloUI(id) {
  const a = animal(id);
  abrirFolha(`<h2>Iniciar protocolo · ${esc(a.nome)}</h2>
    <label for="ipV">Vacina</label><select id="ipV">${vacinasDaEspecie(a).map(t => `<option>${esc(t.vacina)}</option>`).join('')}</select>
    <label for="ipP">Protocolo</label><select id="ipP">${DB.protocolos.map(p => `<option value="${p.id}">${esc(p.nome)} — ${p.doses} ${p.doses > 1 ? 'doses a cada ' + p.intervalo + ' dias' : 'dose por ano'}</option>`).join('')}</select>
    <label for="ipD">Data da 1ª dose</label><input type="date" id="ipD" value="${isoHoje()}">
    <p class="small muted">O app marca as próximas doses sozinho e avisa o tutor quando estiverem perto.</p>
    <button class="btn full" onclick="const v=$('#ipV').value,p=$('#ipP').value,d=$('#ipD').value;fecharFolha();comDesfazer('Doses programadas',()=>iniciarProtocolo('${id}',v,p,d));abaAnimal='vacinas';route({manterScroll:true})">Programar doses</button>`);
}
function aplicarVacina(id, doseId) {
  const a = animal(id);
  const pend = proximasDoses(id);
  abrirFolha(`<h2>Aplicar vacina · ${esc(a.nome)}</h2>
    <label for="avV">Vacina</label><select id="avV">${pend.map(v => `<option value="dose:${v.id}" ${v.id === doseId ? 'selected' : ''}>${esc(v.vacina)} ${v.total > 1 ? v.n + '/' + v.total : ''} — ${statusDose(v).txt}</option>`).join('')}
      ${vacinasDaEspecie(a).map(t => `<option value="nova:${esc(t.vacina)}">${esc(t.vacina)} — nova (anual)</option>`).join('')}</select>
    <label for="avL">Lote (do estoque)</label><select id="avL">${DB.estoque.filter(e => e.tipo === 'Vacina').map(e => `<option value="${e.id}">${esc(e.nome)} · lote ${esc(e.lote)} · ${e.qtd} un.</option>`).join('')}</select>
    <p class="small muted">Dá baixa no estoque, marca a próxima dose e lança o valor na cobrança.</p>
    <button class="btn full" onclick="confirmarVacina('${id}')">${ic('check')} Registrar aplicação</button>`);
  const casar = () => { const v = $('#avV').value; const nome = v.startsWith('dose:') ? DB.doses.find(d => d.id === v.slice(5)).vacina : v.slice(5); const e = DB.estoque.find(x => x.tipo === 'Vacina' && x.nome.startsWith(nome)); if (e) $('#avL').value = e.id; };
  $('#avV').addEventListener('change', casar); casar();
}
function registrarDose(animalId, escolha, estoqueId) {
  const e = DB.estoque.find(x => x.id === estoqueId), hoje = isoHoje();
  let v;
  if (escolha.startsWith('dose:')) v = DB.doses.find(d => d.id === escolha.slice(5));
  else { v = { id: uid('v'), animalId, vacina: escolha.slice(5), protocolo: 'anual', n: 1, total: 1, status: 'programada' }; DB.doses.push(v); }
  v.status = 'aplicada'; v.data = hoje; v.lote = e ? e.lote : '';
  if (e && e.qtd > 0) e.qtd--;
  // próxima: se foi a última dose do protocolo, reforço anual
  if (v.n === v.total && !DB.doses.some(d => d.animalId === animalId && d.vacina === v.vacina && d.status === 'programada'))
    DB.doses.push({ id: uid('v'), animalId, vacina: v.vacina, protocolo: 'anual', n: 1, total: 1, data: isoMais(hoje, 365), status: 'programada', lote: '' });
  return v;
}
function confirmarVacina(id) {
  const escolha = $('#avV').value, lote = $('#avL').value;
  fecharFolha();
  comDesfazer('Vacina registrada · estoque atualizado', () => {
    const v = registrarDose(id, escolha, lote);
    const t = DB.tabela.find(x => x.vacina === v.vacina);
    if (t) DB.orcamentos.push({ id: uid('o'), tutorId: animal(id).tutorId, animalId: id, data: isoHoje(), itens: [{ tab: t.id, qtd: 1 }], status: 'enviado', forma: '' });
  });
  abaAnimal = 'vacinas'; route({ manterScroll: true });
}

/* ---- Atendimento: rápido na casa do cliente ---- */
const ROTULO = {
  queixa: 'Queixa principal', ambiente: 'Ambiente', alimentacao: 'Alimentação', vacinacao: 'Vacinação', vermifugacao: 'Vermifugação', ectoparasitas: 'Ectoparasitas', reproducao: 'Histórico de reprodução', historia: 'História médica anterior',
  peso: 'Peso (kg)', fc: 'FC (bpm)', fr: 'FR (mpm)', temperatura: 'Temp. (°C)', tpc: 'TPC (seg)', hidratacao: 'Hidratação', mucosas: 'Olhos e mucosas', oral: 'Cavidade oral', orelhas: 'Orelhas/ouvido', linfonodos: 'Linfonodos', pele: 'Pele/pelo', torax: 'Tórax', abdome: 'Abdome', locomotor: 'Músculo-esquelético', nervoso: 'Nervoso', urogenital: 'Urinário/genital',
  suspeita: 'Suspeita diagnóstica', tratamento: 'Tratamento', exames: 'Exames solicitados', obs: 'Outras observações',
};
const VITAIS = ['peso', 'temperatura', 'fc', 'fr', 'tpc'];
const ANAMNESE = ['ambiente', 'alimentacao', 'vacinacao', 'vermifugacao', 'ectoparasitas', 'reproducao', 'historia'];
const SISTEMAS = ['hidratacao', 'mucosas', 'oral', 'orelhas', 'linfonodos', 'pele', 'torax', 'abdome', 'locomotor', 'nervoso', 'urogenital'];
const CONCLUSOES = ['suspeita', 'tratamento', 'exames', 'obs'];

TELAS.atender = (id, gid) => {
  const a = animal(id); if (!a) return barra('Atender', { voltar: '/clientes' }) + '<main>Animal não encontrado.</main>';
  const t = tutor(a.tutorId), g = gid ? DB.agenda.find(x => x.id === gid) : null;
  const pend = proximasDoses(id, 30);
  const servicos = DB.tabela.filter(x => x.cat === 'Serviços');
  const marcado = s => g ? (g.servico === s.id || (g.extras || []).includes(s.id)) : s.id === 's1';
  const tipoIni = g && g.servico === 's3' ? 'Check-up (avaliação periódica)' : g && tab(g.servico)?.vacina ? 'Vacinação' : 'Consulta domiciliar';
  return barra(`Atender ${esc(a.nome)}`, { voltar: '/animal/' + id, sub: `${esc(t.nome)} · ${esc(t.bairro)}` }) + `<main class="com-cta" id="formAt">
  <label for="atTipo">Tipo de atendimento</label><select id="atTipo">${['Consulta domiciliar', 'Check-up (avaliação periódica)', 'Vacinação', 'Retorno'].map(x => `<option ${x === tipoIni ? 'selected' : ''}>${x}</option>`).join('')}</select>

  <div class="secao"><h2>Sinais vitais</h2></div>
  <div class="card"><div class="grid3" style="margin-top:-12px">${VITAIS.map(c => `<div><label for="f_${c}">${ROTULO[c]}</label><input id="f_${c}" data-campo="${c}" inputmode="decimal"></div>`).join('')}</div></div>

  <div class="secao"><h2>Queixa principal</h2></div>
  <div class="campo-mic"><textarea id="f_queixa" data-campo="queixa" rows="3" aria-label="Queixa principal" placeholder="O que o tutor contou — toque no microfone para ditar"></textarea>${micBtn('#f_queixa')}</div>
  <details><summary>Mais perguntas da anamnese</summary><div>${ANAMNESE.map(c => `<label for="f_${c}">${ROTULO[c]}</label><input id="f_${c}" data-campo="${c}">`).join('')}</div></details>

  <div class="secao"><h2>Exame físico</h2><button type="button" class="btn mini ghost" onclick="tudoNormal()">${ic('check', 'sm')} Tudo normal</button></div>
  <div class="card">${SISTEMAS.map(c => `<div class="sist" data-sist="${c}"><b>${ROTULO[c]}</b><span class="seg" role="group" aria-label="${ROTULO[c]}"><button type="button" class="ok" onclick="marcarSist('${c}','ok')">Normal</button><button type="button" class="alt" onclick="marcarSist('${c}','alt')">Alterado</button></span><input data-alt="${c}" placeholder="Descreva a alteração" aria-label="Alteração em ${ROTULO[c]}" hidden></div>`).join('')}</div>

  <div class="secao"><h2>Conclusões</h2></div>
  <div class="card" style="padding-top:2px">${CONCLUSOES.map(c => `<label for="f_${c}">${ROTULO[c]}</label><div class="campo-mic"><textarea id="f_${c}" data-campo="${c}" rows="2"></textarea>${micBtn('#f_' + c)}</div>`).join('')}</div>

  ${pend.length ? `<div class="secao"><h2>Vacinas desta visita</h2></div><div class="card">${pend.map(v => `<label class="row" style="margin:6px 0;color:var(--tinta);font-weight:500"><input type="checkbox" data-dose="${v.id}" ${g && tab(g.servico)?.vacina === v.vacina ? 'checked' : ''}> <span class="grow">${esc(v.vacina)} ${v.total > 1 ? v.n + '/' + v.total : ''}</span><span class="tag ${statusDose(v).cls}">${statusDose(v).txt}</span></label>`).join('')}</div>` : ''}

  <div class="secao"><h2>Cobrança</h2><span class="small muted">vira orçamento para o tutor</span></div>
  <div class="card">
    ${servicos.map(s => `<label class="preco-lin"><input type="checkbox" data-item="${s.id}" ${marcado(s) ? 'checked' : ''}><span>${esc(s.nome)} ${s.exemplo ? '<span class="exemplo">exemplo</span>' : ''}</span><b>${brl(s.preco)}</b></label>`).join('')}
    <label class="preco-lin"><input type="checkbox" data-item="${t.faixa}" checked><span>${esc(tab(t.faixa)?.nome || 'Deslocamento')} <span class="exemplo">exemplo</span></span><b>${brl(tab(t.faixa)?.preco)}</b></label>
  </div>
  <p class="tiny muted" style="text-align:center;margin-top:14px">O rascunho se guarda sozinho neste aparelho enquanto você preenche.</p>
  </main>
  <div class="cta-fixa"><div class="in"><div class="grow"><div class="tiny muted">Total da visita</div><b id="atTotal" style="font-size:20px"></b></div>
    <button class="btn" onclick="salvarAtendimento('${id}','${gid || ''}')">${ic('check')} Finalizar visita</button></div></div>`;
};
function marcarSist(c, estado) {
  const el = document.querySelector(`[data-sist="${c}"]`), atual = el.dataset.estado;
  el.dataset.estado = atual === estado ? '' : estado;
  el.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.classList.contains(el.dataset.estado || '-')));
  const inp = el.querySelector('[data-alt]'); inp.hidden = el.dataset.estado !== 'alt'; if (!inp.hidden) inp.focus();
  guardarRascunho();
}
function tudoNormal() { SISTEMAS.forEach(c => { const el = document.querySelector(`[data-sist="${c}"]`); if (!el.dataset.estado) marcarSist(c, 'ok'); }); }
let rascId = null;
function lerForm() {
  const r = { tipo: $('#atTipo').value, campos: {}, sist: {}, itens: [], doses: [] };
  document.querySelectorAll('[data-campo]').forEach(e => { if (e.value.trim()) r.campos[e.dataset.campo] = e.value.trim(); });
  document.querySelectorAll('[data-sist]').forEach(e => { if (e.dataset.estado) r.sist[e.dataset.sist] = [e.dataset.estado, e.querySelector('[data-alt]').value.trim()]; });
  document.querySelectorAll('[data-item]:checked').forEach(c => r.itens.push(c.dataset.item));
  document.querySelectorAll('[data-dose]:checked').forEach(c => r.doses.push(c.dataset.dose));
  return r;
}
function guardarRascunho() { if (!rascId || !$('#formAt')) return; try { localStorage.setItem(RASC_K + rascId, JSON.stringify(lerForm())); } catch (e) { } }
TELAS.atender.depois = (id) => {
  rascId = id;
  const soma = () => {
    let s = 0;
    document.querySelectorAll('[data-item]').forEach(c => { if (c.checked) s += tab(c.dataset.item)?.preco || 0; });
    document.querySelectorAll('[data-dose]').forEach(c => { if (c.checked) { const v = DB.doses.find(d => d.id === c.dataset.dose); s += DB.tabela.find(x => x.vacina === v.vacina)?.preco || 0; } });
    $('#atTotal').textContent = brl(s);
  };
  // recupera o rascunho, se houver
  let r = null; try { r = JSON.parse(localStorage.getItem(RASC_K + id)); } catch (e) { }
  if (r && (Object.keys(r.campos).length || Object.keys(r.sist).length)) {
    $('#atTipo').value = r.tipo;
    Object.entries(r.campos).forEach(([k, v]) => { const e = document.querySelector(`[data-campo="${k}"]`); if (e) e.value = v; });
    Object.entries(r.sist).forEach(([k, [est, txt]]) => { marcarSist(k, est); document.querySelector(`[data-alt="${k}"]`).value = txt; });
    document.querySelectorAll('[data-item]').forEach(c => c.checked = r.itens.includes(c.dataset.item));
    document.querySelectorAll('[data-dose]').forEach(c => c.checked = r.doses.includes(c.dataset.dose));
    if (Object.keys(r.campos).some(k => ANAMNESE.includes(k))) document.querySelector('details').open = true;
    toast('Rascunho recuperado', () => { localStorage.removeItem(RASC_K + id); route(); });
  }
  $('#formAt').addEventListener('input', () => { soma(); guardarRascunho(); });
  $('#formAt').addEventListener('change', () => { soma(); guardarRascunho(); });
  soma();
};
function salvarAtendimento(id, gid) {
  const a = animal(id), f = lerForm(), campos = { ...f.campos };
  SISTEMAS.forEach(c => { const s = f.sist[c]; if (s) campos[c] = s[0] === 'ok' ? 'Normal' : (s[1] || 'Alterado'); });
  const itens = f.itens.map(t => ({ tab: t, qtd: 1 }));
  const foto = JSON.stringify(DB);
  const vacs = [];
  f.doses.forEach(did => {
    const v = DB.doses.find(d => d.id === did);
    const e = DB.estoque.find(x => x.tipo === 'Vacina' && x.nome.startsWith(v.vacina));
    registrarDose(id, 'dose:' + v.id, e ? e.id : '');
    const t = DB.tabela.find(x => x.vacina === v.vacina); if (t) itens.push({ tab: t.id, qtd: 1 });
    vacs.push(v.vacina);
  });
  const kg = parseFloat((campos.peso || '').replace(',', '.'));
  if (kg) a.pesos.push({ data: isoHoje(), kg });
  if (/Check-up/.test(f.tipo)) a.checkup = isoMais(isoHoje(), DB.checkupMeses * 30);
  const alterados = SISTEMAS.filter(c => f.sist[c] && f.sist[c][0] === 'alt').map(c => ROTULO[c]);
  const resumo = [campos.queixa, campos.suspeita && 'Suspeita: ' + campos.suspeita, alterados.length && 'Alterado: ' + alterados.join(', '), vacs.length && 'Vacinas: ' + vacs.join(', ')].filter(Boolean).join(' · ') || f.tipo;
  DB.atendimentos.push({ id: uid('at'), animalId: id, data: isoHoje(), tipo: f.tipo, resumo, campos });
  const o = { id: uid('o'), tutorId: a.tutorId, animalId: id, data: isoHoje(), itens, status: 'enviado', forma: '' };
  DB.orcamentos.push(o);
  if (gid) { const g = DB.agenda.find(x => x.id === gid); if (g) g.status = 'feito'; }
  salvar();
  localStorage.removeItem(RASC_K + id); rascId = null;
  desfazVisita = foto;
  const t = tutor(a.tutorId);
  const msg = MODO_REAL
    ? `Olá, ${t.nome.split(' ')[0]}! Obrigada por hoje 💜\nResumo da visita do ${a.nome}:\n` + itens.map(i => `• ${tab(i.tab)?.nome} — ${brl(tab(i.tab)?.preco)}`).join('\n') + `\nTotal: ${brl(totalItens(itens))}\nPode pagar por Pix${DB.cfg.pix ? ' (chave ' + DB.cfg.pix + ')' : ''} ou cartão. Dra. Ingrid 🐾`
    : `Olá, ${t.nome.split(' ')[0]}! Obrigada por hoje 💜\nAqui está o resumo da visita do ${a.nome}, com os valores e as formas de pagamento (Pix ou cartão):\n${linkApp('/t/orcamento/' + o.id)}`;
  abaAnimal = 'tempo';
  go('/animal/' + id);
  setTimeout(() => {
    abrirFolha(`<h2>Visita finalizada</h2><p class="muted">Total ${brl(totalItens(itens))}${vacs.length ? ' · vacinas baixadas do estoque' : ''}</p>
      <div class="stack" style="margin-top:12px"><a class="btn wa full" target="_blank" rel="noopener" href="${waLink(msg)}">${ic('message-circle')} Mandar resumo e valores no WhatsApp</a>
      ${MODO_REAL ? '' : `<a class="btn sec full" href="#/t/orcamento/${o.id}">${ic('eye')} Ver o que o tutor recebe</a>`}
      <button class="btn ghost full" onclick="DB=JSON.parse(desfazVisita);salvar();fecharFolha();route();toast('Visita desfeita')">${ic('undo-2')} Desfazer</button></div>`);
  }, 30);
}
let desfazVisita = null;

/* ---- Receita ---- */
TELAS.receita = id => {
  const a = animal(id), t = tutor(a.tutorId);
  return barra('Receita', { voltar: '/animal/' + id, sub: `${esc(a.nome)} · ${esc(t.nome)}` }) + `<main>
  <div class="abas" id="recTipo" role="tablist" style="margin-top:0"><button class="on" data-t="simples">Simples</button><button data-t="controle">Controle especial</button><button data-t="digital">Digital</button></div>
  <div id="recAvisos"></div>
  <div id="recItens"></div>
  <button class="btn mini ghost" id="recMais" style="margin-top:8px">${ic('plus', 'sm')} Medicamento</button>
  <div class="secao"><h2>Prévia</h2></div>
  <div class="receita" id="recPrevia"></div>
  <div class="row" style="margin-top:14px"><button class="btn grow" onclick="salvarReceita('${id}')">${ic('check')} Salvar no prontuário</button><button class="btn sec" onclick="window.print()">Imprimir / PDF</button></div>
  </main>`;
};
let recTipo = 'simples', recItens = [];
TELAS.receita.depois = id => {
  recTipo = 'simples'; recItens = [{ med: '', uso: '' }];
  const a = animal(id), t = tutor(a.tutorId), c = DB.cfg;
  const previa = () => {
    const num = (c.receitaSeq + 1) + '/' + isoHoje().slice(2, 4);
    $('#recPrevia').innerHTML = `<h3>${recTipo === 'controle' ? 'RECEITUÁRIO DE CONTROLE ESPECIAL · nº ' + num : 'RECEITUÁRIO'}</h3>
      <div class="small"><b>Emitente:</b> ${esc(c.nome)} · CRMV ${esc(c.crmv)}${recTipo === 'controle' ? ' · MAPA ' + (c.mapa ? esc(c.mapa) : '<span style="color:var(--coral-f)">— falta —</span>') : ''}<br>Atendimento veterinário a domicílio · emitida em ${dataCurta(isoHoje())}/${isoHoje().slice(0, 4)}</div>
      <div class="small" style="margin-top:8px"><b>Tutor:</b> ${esc(t.nome)}${t.cpf ? ' · CPF ' + esc(t.cpf) : ''} · ${esc(endereco(t))}<br><b>Animal:</b> ${esc(a.nome)} · ${esc(a.especie)} · ${esc(a.raca)} · ${esc(a.sexo)} · ${idade(a.nasc)}</div>
      <div style="margin-top:12px">${recItens.map((it, i) => `<p><b>${i + 1}. ${esc(it.med) || '________________'}</b><br>${esc(it.uso) || ''}</p>`).join('')}</div>
      <div class="ass">${esc(c.nome)} · CRMV ${esc(c.crmv)}</div>
      ${recTipo === 'controle' ? '<div class="tiny" style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><b>Identificação do comprador</b><br>Nome: ____________<br>RG: ______ Órgão: ____<br>Endereço: ____________</div><div><b>Identificação do fornecedor</b><br>____________________<br>Assinatura do farmacêutico<br>Data __/__/__</div></div><div class="tiny" style="margin-top:8px">1ª via — Farmácia · 2ª via — Paciente</div>' : ''}`;
  };
  const desenha = () => {
    document.querySelectorAll('#recTipo button').forEach(b => { b.classList.toggle('on', b.dataset.t === recTipo); b.setAttribute('aria-selected', b.dataset.t === recTipo); });
    if (recTipo === 'controle' && recItens.length > 1) recItens = recItens.slice(0, 1);
    $('#recMais').style.display = recTipo === 'controle' ? 'none' : '';
    const faltas = [];
    if (recTipo === 'controle') {
      faltas.push('<b>Portaria MAPA nº 837/2025:</b> só <b>1 medicamento</b> por receita de controle especial, em 2 vias (farmácia e paciente).');
      if (!c.mapa) faltas.push('Falta o <b>número de registro no MAPA (SIPEAGRO)</b> — a Ingrid ainda não tem.');
      faltas.push('Precisa de <b>assinatura com certificado digital</b> (A1 e-CPF). Sem ele esta receita não sai no app real.');
    }
    if (recTipo === 'digital') faltas.push('Receita digital: PDF assinado + QR para a farmácia conferir. Precisa do certificado digital para ter validade.');
    $('#recAvisos').innerHTML = faltas.length ? `<div class="aviso coral small stack" style="margin:8px 0">${faltas.map(f => `<div>${f}</div>`).join('')}</div>` : '';
    $('#recItens').innerHTML = recItens.map((it, i) => `<div class="card"><div class="row between"><b>Medicamento ${recItens.length > 1 ? i + 1 : ''}</b>${recItens.length > 1 ? `<button class="icbtn" data-rm="${i}" aria-label="Tirar medicamento ${i + 1}">${ic('trash-2')}</button>` : ''}</div>
      <label for="rm${i}">Nome, concentração e quantidade</label><input id="rm${i}" data-i="${i}" data-k="med" value="${esc(it.med)}" placeholder="Ex.: Meloxicam 0,5 mg — 10 comprimidos">
      <label for="ru${i}">Como usar</label><textarea id="ru${i}" data-i="${i}" data-k="uso" rows="2" placeholder="Ex.: dar 1 comprimido por via oral a cada 24 h por 3 dias">${esc(it.uso)}</textarea></div>`).join('');
    previa();
  };
  $('#recTipo').addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.t) { recTipo = b.dataset.t; desenha(); } });
  $('#recMais').addEventListener('click', () => { recItens.push({ med: '', uso: '' }); desenha(); });
  $('#recItens').addEventListener('input', e => { if (e.target.dataset.k) { recItens[e.target.dataset.i][e.target.dataset.k] = e.target.value; previa(); } });
  $('#recItens').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { recItens.splice(+b.dataset.rm, 1); desenha(); } });
  desenha();
};
function salvarReceita(id) {
  if (!recItens.some(i => i.med.trim())) return toast('Escreva o medicamento');
  const r = { id: uid('r'), animalId: id, data: isoHoje(), tipo: recTipo, itens: recItens.filter(i => i.med.trim()) };
  if (recTipo === 'controle') { DB.cfg.receitaSeq++; r.numero = DB.cfg.receitaSeq + '/' + isoHoje().slice(2, 4); }
  DB.receitas.push(r); salvar(); abaAnimal = 'tempo'; go('/animal/' + id); toast('Receita salva no prontuário');
}

/* ---- Doses (lista da Ingrid, fiel ao VetSmart) ---- */
TELAS.doses = animalId => {
  const a = animalId ? animal(animalId) : null;
  return barra('Calcular dose', { voltar: a ? '/animal/' + a.id : '/mais', sub: 'Só remédios da sua lista, conferidos na bula' }) + `<main>
  <div class="card">
    <label for="dsM" style="margin-top:0">Medicamento</label><select id="dsM">${DB.formulario.map((f, i) => `<option value="${i}">${esc(f.nome)}</option>`).join('')}</select>
    <div class="grid2"><div><label for="dsE">Espécie</label><select id="dsE"><option ${a && a.especie === 'Cão' ? 'selected' : ''}>Cão</option><option ${a && a.especie === 'Gato' ? 'selected' : ''}>Gato</option></select></div>
    <div><label for="dsP">Peso (kg)</label><input id="dsP" inputmode="decimal" value="${a && pesoAtual(a) ? vg(pesoAtual(a)) : ''}"></div></div>
    <div id="dsR" style="margin-top:14px" aria-live="polite"></div>
  </div>
  <div class="secao"><h2>Lista de medicamentos</h2><button class="btn mini ghost" onclick="novoRemedio()">${ic('plus', 'sm')} Medicamento</button></div>
  <div class="card">${DB.formulario.map(f => `<div class="item"><div class="ava" style="background:var(--lil-3)">${ic('pill')}</div><div class="grow"><b>${esc(f.nome)}</b><div class="small muted">${esc(f.classe)} · ${esc(f.receita)}</div><div class="tiny muted">Conferido em ${dataCurta(f.conferido)}/${f.conferido.slice(0, 4)} · <a href="${esc(f.fonte)}" target="_blank" rel="noopener">bula no VetSmart</a></div></div></div>`).join('')}</div>
  <div class="aviso lil small" style="margin-top:12px">Remédio que não está na lista <b>não tem dose</b> no app nem no assistente — nada é inventado. Cadastre cada um com o link da bula e a data em que conferiu.</div>
  </main>`;
};
TELAS.doses.depois = () => {
  const calc = () => {
    const f = DB.formulario[$('#dsM').value], esp = $('#dsE').value, kg = parseFloat(($('#dsP').value || '').replace(',', '.'));
    const d = f.doses[esp];
    if (!d) { $('#dsR').innerHTML = `<div class="aviso coral">A bula não traz dose de ${esc(f.nome)} para ${esp.toLowerCase()}. Não use.</div>`; return; }
    const faixa = d.min === d.max ? `${vg(d.min)} mg/kg` : `${vg(d.min)} a ${vg(d.max)} mg/kg`;
    const mg = n => (n * kg).toFixed(2).replace('.', ',');
    const tot = kg ? (d.min === d.max ? `${mg(d.min)} mg` : `${mg(d.min)} a ${mg(d.max)} mg`) : '—';
    $('#dsR').innerHTML = `<div class="kpis-grade"><div class="kpi"><span>Dose indicada</span><b style="font-size:18px">${faixa}</b></div><div class="kpi"><span>Para ${kg ? vg(kg) + ' kg' : 'o peso'}</span><b style="font-size:18px">${tot}</b></div></div>
      <div class="small" style="margin-top:10px"><b>Vias:</b> ${esc(f.vias)}<br><b>Duração:</b> ${esc(d.duracao)}<br><b>Receita:</b> ${esc(f.receita)}</div>
      <div class="tiny muted" style="margin-top:8px">Fonte: <a href="${esc(f.fonte)}" target="_blank" rel="noopener">VetSmart — ${esc(f.nome)}</a>, conferido em ${dataCurta(f.conferido)}/${f.conferido.slice(0, 4)}. A decisão clínica é da veterinária.</div>`;
  };
  ['#dsM', '#dsE', '#dsP'].forEach(s => $(s).addEventListener('input', calc)); calc();
};
function novoRemedio() {
  abrirFolha(`<h2>Novo medicamento</h2><p class="small muted">Copie da bula do VetSmart. Sem o link da bula o app não aceita.</p>
    <label for="nrN">Nome</label><input id="nrN"><label for="nrC">Classe</label><input id="nrC"><label for="nrR">Tipo de receita</label><select id="nrR"><option>Receita simples</option><option>Receita de controle especial</option></select>
    <label for="nrV">Vias</label><input id="nrV">
    <div class="grid3"><div><label for="nrC1">Cão mín. mg/kg</label><input id="nrC1" inputmode="decimal"></div><div><label for="nrC2">Cão máx.</label><input id="nrC2" inputmode="decimal"></div><div><label for="nrC3">Duração</label><input id="nrC3"></div></div>
    <div class="grid3"><div><label for="nrG1">Gato mín. mg/kg</label><input id="nrG1" inputmode="decimal"></div><div><label for="nrG2">Gato máx.</label><input id="nrG2" inputmode="decimal"></div><div><label for="nrG3">Duração</label><input id="nrG3"></div></div>
    <label for="nrL">Link da bula (VetSmart)</label><input id="nrL" type="url" placeholder="https://vetsmart.com.br/cg/produto/...">
    <button class="btn full" style="margin-top:16px" onclick="salvarRemedio()">Guardar</button>`);
}
function salvarRemedio() {
  const n = v => parseFloat(($(v).value || '').replace(',', '.'));
  if (!$('#nrN').value.trim()) return toast('Falta o nome');
  if (!/^https:\/\/(www\.)?vetsmart\.com\.br\//.test($('#nrL').value.trim())) return toast('Cole o link da bula no VetSmart');
  const doses = {};
  if (n('#nrC1')) doses['Cão'] = { min: n('#nrC1'), max: n('#nrC2') || n('#nrC1'), duracao: $('#nrC3').value || '—' };
  if (n('#nrG1')) doses['Gato'] = { min: n('#nrG1'), max: n('#nrG2') || n('#nrG1'), duracao: $('#nrG3').value || '—' };
  DB.formulario.push({ nome: $('#nrN').value.trim(), classe: $('#nrC').value, receita: $('#nrR').value, vias: $('#nrV').value, doses, fonte: $('#nrL').value.trim(), conferido: isoHoje() });
  salvar(); fecharFolha(); route(); toast('Medicamento guardado');
}

/* ---- Financeiro ---- */
let mesFin = null;
TELAS.financeiro = () => {
  mesFin = mesFin || isoHoje().slice(0, 7);
  const [y, m] = mesFin.split('-').map(Number);
  const ls = DB.lanc.filter(l => l.data.startsWith(mesFin)).sort((a, b) => b.data.localeCompare(a.data));
  const ent = ls.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0), sai = ls.filter(l => l.tipo === 'saida').reduce((s, l) => s + l.valor, 0);
  const porForma = f => ls.filter(l => l.tipo === 'entrada' && l.forma === f).reduce((s, l) => s + l.valor, 0);
  const aberto = DB.orcamentos.filter(o => o.status !== 'pago');
  const cats = {}; ls.filter(l => l.tipo === 'entrada').forEach(l => cats[l.cat] = (cats[l.cat] || 0) + l.valor);
  const mx = Math.max(...Object.values(cats), 1);
  const pix = porForma('pix'), cartao = porForma('cartao');
  return barra('Financeiro', { voltar: '/mais', sub: 'O que entra e o que sai', acoes: acaoBtn('plus', 'Novo lançamento', 'novoLanc()') }) + `<main>
  ${aberto.length ? `<div class="secao" style="margin-top:0"><h2>A receber<span class="cont">${aberto.length}</span></h2><b>${brl(aberto.reduce((s, o) => s + totalItens(o.itens), 0))}</b></div><div class="card">${aberto.map(o => `<div class="item"><div class="grow"><b>${brl(totalItens(o.itens))}</b> <span class="small muted">· ${esc(tutor(o.tutorId).nome)} · ${esc(animal(o.animalId).nome)}</span><div class="small">${tagOrc(o)}</div></div>
    <button class="btn mini" onclick="receber('${o.id}')">Recebi</button></div>`).join('')}</div>` : ''}
  <div class="row between" style="margin-top:20px"><button class="icbtn fundo" aria-label="Mês anterior" onclick="mesFin=mesMais(mesFin,-1);route({manterScroll:true})">${ic('chevron-left')}</button><h2 style="text-transform:capitalize">${MESES[m - 1]} ${y}</h2><button class="icbtn fundo" aria-label="Mês seguinte" onclick="mesFin=mesMais(mesFin,1);route({manterScroll:true})">${ic('chevron-right')}</button></div>
  <div class="kpis-grade" style="margin-top:12px"><div class="kpi"><b style="color:var(--verde)">${brl(ent)}</b><span>entrou</span></div><div class="kpi"><b style="color:var(--coral-f)">${brl(sai)}</b><span>saiu</span></div>
    <div class="kpi" style="grid-column:1/-1"><b style="color:${ent - sai < 0 ? 'var(--coral-f)' : 'var(--tinta)'}">${brl(ent - sai)}</b><span>${ent - sai < 0 ? 'faltou no mês' : 'sobrou no mês'}</span></div></div>
  ${ent ? `<div class="secao"><h2>Como recebeu</h2></div><div class="card">${[['Pix', pix], ['Cartão', cartao]].map(([n, v]) => `<div style="margin:6px 0"><div class="row between small"><span>${n}</span><b>${brl(v)}</b></div><div class="barra"><i style="width:${v / ent * 100}%"></i></div></div>`).join('')}</div>` : ''}
  ${Object.keys(cats).length ? `<div class="secao"><h2>Entradas por tipo</h2></div><div class="card">${Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<div style="margin:8px 0"><div class="row between small"><span>${esc(c)}</span><b>${brl(v)}</b></div><div class="barra"><i style="width:${v / mx * 100}%"></i></div></div>`).join('')}</div>` : ''}
  <div class="secao"><h2>Lançamentos</h2></div>
  <div class="card">${ls.length ? ls.map(l => `<div class="item"><div class="grow"><b>${esc(l.desc)}</b><div class="small muted">${dataCurta(l.data)} · ${esc(l.cat)} · ${l.forma === 'cartao' ? 'cartão' : l.forma === 'pix' ? 'Pix' : esc(l.forma)}</div></div><b style="color:${l.tipo === 'entrada' ? 'var(--verde)' : 'var(--coral-f)'};white-space:nowrap">${l.tipo === 'entrada' ? '+' : '−'} ${brl(l.valor)}</b></div>`).join('') : '<p class="muted" style="margin:0">Nada neste mês.</p>'}</div>
  </main>`;
};
function receber(oid) {
  abrirFolha(`<h2>Como recebeu?</h2><div class="row" style="margin-top:14px"><button class="btn grow" onclick="baixarOrc('${oid}','pix')">Pix</button><button class="btn sec grow" onclick="baixarOrc('${oid}','cartao')">Cartão</button></div>`);
}
function baixarOrcDados(oid, forma) {
  const o = DB.orcamentos.find(x => x.id === oid); o.status = 'pago'; o.forma = forma;
  const a = animal(o.animalId);
  o.itens.forEach(i => { const t = tab(i.tab); if (t) DB.lanc.push({ id: uid('f'), data: isoHoje(), tipo: 'entrada', cat: t.cat === 'Serviços' ? 'Consultas' : t.cat, desc: t.nome + ' — ' + a.nome, valor: t.preco * (i.qtd || 1), forma }); });
}
function baixarOrc(oid, forma) { fecharFolha(); comDesfazer('Recebido · entrou no financeiro', () => baixarOrcDados(oid, forma)); route({ manterScroll: true }); }
function novoLanc() {
  abrirFolha(`<h2>Novo lançamento</h2>
    <div class="abas" id="nlT" role="tablist"><button class="on" data-t="saida">Saída</button><button data-t="entrada">Entrada</button></div>
    <label for="nlD">Descrição</label><input id="nlD" placeholder="Ex.: Combustível">
    <div class="grid2"><div><label for="nlV">Valor (R$)</label><input id="nlV" inputmode="decimal"></div><div><label for="nlC">Categoria</label><select id="nlC"><option>Combustível</option><option>Compra de vacinas</option><option>Medicamentos</option><option>Insumos</option><option>Consultas</option><option>Outros</option></select></div></div>
    <label for="nlF">Forma</label><select id="nlF"><option value="pix">Pix</option><option value="cartao">Cartão</option><option value="dinheiro">Dinheiro</option></select>
    <button class="btn full" style="margin-top:16px" onclick="salvarLanc()">Lançar</button>`);
  $('#nlT').addEventListener('click', e => { if (e.target.dataset.t) document.querySelectorAll('#nlT button').forEach(b => b.classList.toggle('on', b === e.target)); });
}
function salvarLanc() {
  const v = parseFloat(($('#nlV').value || '').replace(/\./g, '').replace(',', '.'));
  if (!v || !$('#nlD').value.trim()) return toast('Falta descrição ou valor');
  const l = { id: uid('f'), data: isoHoje(), tipo: $('#nlT .on').dataset.t, cat: $('#nlC').value, desc: $('#nlD').value.trim(), valor: v, forma: $('#nlF').value };
  fecharFolha(); comDesfazer('Lançado', () => DB.lanc.push(l)); route({ manterScroll: true });
}

/* ---- Estoque ---- */
TELAS.estoque = () => {
  const grupos = [['Vacina', 'Vacinas'], ['Medicamento', 'Medicamentos'], ['Insumo', 'Insumos']];
  const repor = DB.estoque.filter(e => e.qtd <= e.min);
  return barra('Estoque', { voltar: '/mais', sub: 'Vacina aplicada na visita sai sozinha', acoes: acaoBtn('plus', 'Entrada no estoque', 'entradaEstoque()') }) + `<main>
  ${repor.length ? `<div class="aviso coral row between"><span><b>${repor.length}</b> ${repor.length === 1 ? 'item para repor' : 'itens para repor'}</span><button class="btn mini coral" onclick="listaCompras()">${ic('receipt', 'sm')} Lista de compras</button></div>` : ''}
  ${grupos.map(([g, titulo]) => { const it = DB.estoque.filter(e => e.tipo === g); return it.length ? `<div class="secao"><h2>${titulo}</h2></div><div class="card">${it.map(e => `
    <div class="item"><div class="grow"><b>${esc(e.nome)}</b><div class="small muted">${e.lote ? 'lote ' + esc(e.lote) + ' · ' : ''}${e.validade ? 'validade ' + dataCurta(e.validade) : 'sem validade'} · mínimo ${e.min}</div>
      <div class="row wrap" style="margin-top:4px">${e.qtd <= e.min ? '<span class="tag coral">repor</span>' : ''}${e.validade && diasAte(e.validade) <= 30 ? `<span class="tag ambar">vence ${quando(e.validade)}</span>` : ''}</div></div>
      <div class="row" style="gap:4px"><button class="icbtn fundo" aria-label="Tirar 1 ${esc(e.nome)}" onclick="ajEst('${e.id}',-1)">${ic('minus')}</button><b style="min-width:30px;text-align:center;font-size:18px" aria-live="polite">${e.qtd}</b><button class="icbtn fundo" aria-label="Pôr 1 ${esc(e.nome)}" onclick="ajEst('${e.id}',1)">${ic('plus')}</button></div></div>`).join('')}</div>` : ''; }).join('')}
  </main>`;
};
function ajEst(id, n) { const e = DB.estoque.find(x => x.id === id); e.qtd = Math.max(0, e.qtd + n); salvar(); route({ manterScroll: true }); }
function listaCompras() {
  const itens = DB.estoque.filter(e => e.qtd <= e.min);
  const msg = 'Olá! Pedido da Dra. Ingrid Garrocini:\n' + itens.map(e => `• ${e.nome} — ${Math.max(e.min * 2 - e.qtd, 1)} un.`).join('\n') + '\nObrigada!';
  abrirFolha(`<h2>Lista de compras</h2><p class="small muted">Sugestão: repor até o dobro do mínimo. Edite à vontade.</p>
    <label for="lcM">Mensagem para o fornecedor</label><textarea id="lcM" rows="8">${esc(msg)}</textarea>
    <a class="btn wa full" id="lcWa" style="margin-top:12px" target="_blank" rel="noopener" href="${waLink(msg)}">${ic('message-circle')} Mandar no WhatsApp</a>`);
  $('#lcM').addEventListener('input', e => { $('#lcWa').href = waLink(e.target.value); });
}
function entradaEstoque() {
  abrirFolha(`<h2>Entrada no estoque</h2>
    <label for="eeN">Item</label><input id="eeN" placeholder="Ex.: V10"><div class="grid2"><div><label for="eeT">Tipo</label><select id="eeT"><option>Vacina</option><option>Medicamento</option><option>Insumo</option></select></div><div><label for="eeQ">Quantidade</label><input id="eeQ" inputmode="numeric"></div></div>
    <div class="grid2"><div><label for="eeL">Lote</label><input id="eeL"></div><div><label for="eeV">Validade</label><input type="date" id="eeV"></div></div>
    <div class="grid2"><div><label for="eeC">Custo unitário</label><input id="eeC" inputmode="decimal"></div><div><label for="eeM">Mínimo</label><input id="eeM" inputmode="numeric" value="2"></div></div>
    <label class="row" style="color:var(--tinta);font-weight:500"><input type="checkbox" id="eeF" checked> Lançar a compra como saída no financeiro</label>
    <button class="btn full" style="margin-top:16px" onclick="salvarEntrada()">Guardar</button>`);
}
function salvarEntrada() {
  const q = parseInt($('#eeQ').value, 10), c = parseFloat(($('#eeC').value || '0').replace(',', '.'));
  if (!$('#eeN').value.trim() || !q) return toast('Falta item ou quantidade');
  const it = { id: uid('e'), nome: $('#eeN').value.trim(), tipo: $('#eeT').value, lote: $('#eeL').value, validade: $('#eeV').value, qtd: q, min: parseInt($('#eeM').value, 10) || 0, custo: c };
  const lanc = $('#eeF').checked && c;
  fecharFolha();
  comDesfazer('Entrada guardada', () => {
    DB.estoque.push(it);
    if (lanc) DB.lanc.push({ id: uid('f'), data: isoHoje(), tipo: 'saida', cat: it.tipo === 'Vacina' ? 'Compra de vacinas' : it.tipo === 'Medicamento' ? 'Medicamentos' : 'Insumos', desc: q + '× ' + it.nome, valor: q * c, forma: 'pix' });
  });
  route();
}

/* ---- Assistente: pergunta E faz (sempre com cartão de confirmação) ---- */
let conversa = [];
const SUG_PERGUNTAR = ['Quem está com vacina atrasada?', 'Qual a agenda de amanhã?', 'Dose de meloxicam para cão de 12 kg', 'Quanto entrou este mês?', 'O que preciso repor?', 'Dose de dipirona para gato'];
const SUG_FAZER = ['Agenda o Thor da Carla sexta às 10', 'Marca a Mia amanhã de manhã', 'Peso do Thor 33 kg', 'Pipoca tomou V8 hoje', 'Carla pagou no Pix'];
function acharAnimal(nome) { const n = semAcento(nome); return DB.animais.find(a => semAcento(a.nome) === n); }
function acharTutor(nome) { const n = semAcento(nome); return DB.tutores.find(t => semAcento(t.nome.split(' ')[0]) === n) || (acharAnimal(nome) && tutor(acharAnimal(nome).tutorId)); }
/* entende pedidos de AÇÃO; devolve um cartão para a Ingrid confirmar */
function entenderAcao(p) {
  const q = semAcento(p);
  let m;
  if ((m = q.match(/peso\s+(?:d[oa]\s+)?([a-z]+)\s+(\d+(?:[.,]\d+)?)/)) || (m = q.match(/([a-z]+)\s+(?:esta com|pesa|pesou)\s+(\d+(?:[.,]\d+)?)/))) {
    const a = acharAnimal(m[1]); if (!a) return null; const kg = parseFloat(m[2].replace(',', '.'));
    return { tipo: 'peso', dados: { animalId: a.id, kg }, titulo: `Registrar peso de ${a.nome}`, itens: [`${vg(kg)} kg em ${dataCurta(isoHoje())}${pesoAtual(a) ? ` (antes: ${vg(pesoAtual(a))} kg)` : ''}`] };
  }
  if ((m = q.match(/([a-z]+)\s+(?:tomou|recebeu)\s+(?:a\s+)?(v8|v10|v4|v5|antirrabica|raiva)/)) || (m = q.match(/apliquei\s+(?:a\s+)?(v8|v10|v4|v5|antirrabica|raiva)\s+n[oa]\s+([a-z]+)/))) {
    const [nome, vac] = /apliquei/.test(q) ? [m[2], m[1]] : [m[1], m[2]];
    const a = acharAnimal(nome); if (!a) return null;
    const vacina = /rab|raiva/.test(vac) ? 'Antirrábica' : vac.toUpperCase();
    const dose = proximasDoses(a.id).find(v => v.vacina === vacina);
    const est = DB.estoque.find(e => e.tipo === 'Vacina' && e.nome.startsWith(vacina)), t = DB.tabela.find(x => x.vacina === vacina);
    return { tipo: 'vacina', dados: { animalId: a.id, escolha: dose ? 'dose:' + dose.id : 'nova:' + vacina, estoqueId: est ? est.id : '' }, titulo: `Registrar ${vacina} em ${a.nome}`,
      itens: [`${vacina}${dose && dose.total > 1 ? ' dose ' + dose.n + '/' + dose.total : ''} aplicada hoje`, est ? `Baixa no estoque: lote ${est.lote} (${est.qtd} → ${Math.max(0, est.qtd - 1)})` : 'Sem lote no estoque', t ? `Cobrança: ${brl(t.preco)} para ${tutor(a.tutorId).nome}` : '', 'Próxima dose marcada sozinha'].filter(Boolean) };
  }
  if (/\b(agend|marc|visita\b)/.test(q)) { const r = entenderMarcar(q); if (r) return r; }
  if ((m = q.match(/([a-z]+)\s+pagou(?:\s+(?:no|com|de|em)\s+(pix|cartao))?/))) {
    const t = acharTutor(m[1]); if (!t) return null;
    const abertos = DB.orcamentos.filter(o => o.tutorId === t.id && o.status !== 'pago');
    if (!abertos.length) return { tipo: 'nada', titulo: `${t.nome} não tem nada em aberto`, itens: [] };
    const forma = m[2] === 'cartao' ? 'cartao' : 'pix';
    return { tipo: 'pagou', dados: { ids: abertos.map(o => o.id), forma }, titulo: `Dar baixa no pagamento de ${t.nome}`, itens: [...abertos.map(o => `${brl(totalItens(o.itens))} · ${dataCurta(o.data)} · ${animal(o.animalId).nome}`), `Forma: ${forma === 'pix' ? 'Pix' : 'cartão'} · entra no financeiro de hoje`] };
  }
  return null;
}

/* ---------- marcar visita falando do jeito dela ----------
   "agenda o Thor da Carla sexta às 10", "marca a Mia amanhã de manhã",
   "agendar o Pedrinho, tutor do cachorro Thor, dia 25 às 10 e meia".
   Faltou alguma coisa? Pergunta de volta e lembra do que já foi dito. */
let contextoMarcar = null;
const DIAS_SEM = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const palavras = q => q.split(/[^a-z0-9]+/).filter(Boolean);
function lerData(q) {
  const hoje = isoHoje();
  if (/depois de amanha/.test(q)) return isoMais(hoje, 2);
  if (/\bamanha\b/.test(q)) return isoMais(hoje, 1);
  if (/\bhoje\b/.test(q)) return hoje;
  let m = q.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/);
  if (m) return hoje.slice(0, 4) + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  m = q.match(/\bdia\s+(\d{1,2})\b/);
  if (m) { let d = hoje.slice(0, 8) + m[1].padStart(2, '0'); if (d < hoje) d = mesMais(hoje.slice(0, 7), 1) + '-' + m[1].padStart(2, '0'); return d; }
  const i = DIAS_SEM.findIndex(n => new RegExp('\\b' + n).test(q));
  if (i >= 0) { let n = (i - diaSemN(hoje) + 7) % 7; if (n === 0) n = 7; if (/que vem|proxim/.test(q) && n < 7) n += 7; return isoMais(hoje, n); }
  return null;
}
function lerHora(q) {
  let m = q.match(/\b(\d{1,2})\s*(?:h|:|horas?)?\s*(?:e\s+)?(meia|\d{2})?\b(?=\s*(?:h|horas?|da manha|da tarde|$|\s))/);
  const aoLado = q.match(/\b(?:as|para as|pras|das)\s+(\d{1,2})(?:\s*(?:h|:|horas?))?(?:\s*(?:e\s+)?(meia|\d{2}))?/);
  if (aoLado) m = aoLado; else if (!/\bh\b|\d{1,2}h|horas?|:\d{2}/.test(q)) m = null;
  if (m) {
    let h = +m[1]; const min = m[2] === 'meia' ? 30 : m[2] ? +m[2] : 0;
    if (/da tarde|da noite/.test(q) && h < 12) h += 12;
    if (h >= 0 && h < 24) return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
  }
  if (/meio dia/.test(q)) return '12:00';
  if (/de manha|pela manha/.test(q)) return '09:00';
  if (/de tarde|a tarde|pela tarde/.test(q)) return '14:00';
  return null;
}
function lerServico(q) {
  const v = q.match(/\b(v8|v10|v4|v5|antirrabica|raiva)\b/);
  if (v) { const vac = /rab|raiva/.test(v[1]) ? 'Antirrábica' : v[1].toUpperCase(); const t = DB.tabela.find(x => x.vacina === vac); if (t) return t.id; }
  if (/check.?up|avaliacao/.test(q)) return 's3';
  if (/retorno/.test(q)) return 's2';
  return 's1';
}
function entenderMarcar(q, ctx = {}) {
  const pal = palavras(q);
  // quem: animal falado (e, se houver dois com o mesmo nome, o tutor desempata)
  let cands = DB.animais.filter(a => pal.includes(semAcento(a.nome)));
  const tutoresDitos = DB.tutores.filter(t => pal.includes(semAcento(t.nome.split(' ')[0])));
  if (cands.length > 1 && tutoresDitos.length) cands = cands.filter(a => tutoresDitos.some(t => t.id === a.tutorId));
  if (!cands.length && tutoresDitos.length === 1) cands = DB.animais.filter(a => a.tutorId === tutoresDitos[0].id);
  const a = ctx.animalId ? animal(ctx.animalId) : cands.length === 1 ? cands[0] : null;
  const data = lerData(q) || ctx.data, hora = lerHora(q) || ctx.hora, servico = (lerServico(q) !== 's1' ? lerServico(q) : ctx.servico) || 's1';
  if (!a) {
    if (cands.length > 1) { contextoMarcar = { data, hora, servico }; return { tipo: 'pergunta', titulo: `Tenho ${cands.length} com esse nome`, itens: cands.map(x => `${x.nome}, ${x.especie.toLowerCase()} da ${tutor(x.tutorId).nome}`), fala: `Tenho ${cands.length}: ${cands.map(x => x.nome + ' da ' + tutor(x.tutorId).nome.split(' ')[0]).join(' ou ')}. Qual deles?` }; }
    return null;
  }
  const t = tutor(a.tutorId);
  if (!data || !hora) {
    contextoMarcar = { animalId: a.id, data, hora, servico };
    const falta = !data && !hora ? 'o dia e o horário' : !data ? 'o dia' : 'o horário';
    return { tipo: 'pergunta', titulo: `Marcar ${a.nome}: falta ${falta}`, itens: [data ? `Dia: ${SEM_LONGO[diaSemN(data)]}, ${dataCurta(data)}` : 'Dia: ?', hora ? `Horário: ${hora}` : 'Horário: ?'], fala: `Para quando é a visita do ${a.nome}? Me diga ${falta}.` };
  }
  contextoMarcar = null;
  const ocupado = DB.agenda.some(g => g.data === data && g.hora === hora);
  const falado = tutoresDitos.find(x => x.id !== t.id);
  return { tipo: 'marcar', dados: { animalId: a.id, data, hora, servico }, titulo: `Marcar ${tab(servico)?.nome.toLowerCase() || 'visita'} · ${a.nome}`,
    itens: [`${SEM_LONGO[diaSemN(data)]}, ${dataCurta(data)} às ${hora}`, `${t.nome} · ${t.endereco} — ${t.bairro}`, ocupado ? 'Atenção: já existe visita nesse horário' : 'Horário livre', falado ? `Obs.: no cadastro, o tutor do ${a.nome} é ${t.nome}` : ''].filter(Boolean),
    fala: `Marcar ${tab(servico)?.nome.toLowerCase() || 'visita'} do ${a.nome}, ${SEM_LONGO[diaSemN(data)].toLowerCase()}, dia ${+data.slice(8)}, às ${falaHora(hora)}, na casa ${t.nome.split(' ')[0] ? 'da ' + t.nome.split(' ')[0] : ''}.${ocupado ? ' Atenção: já tem visita nesse horário.' : ''} Confirmo?` };
}
const falaHora = h => { const [hh, mm] = h.split(':').map(Number); return hh + (mm ? ' e ' + (mm === 30 ? 'meia' : mm) : ' horas'); };

/* ---------- voz: ouvir e falar (grátis, do próprio celular) ---------- */
const VOZ_K = 'vetig_voz';
let vozLigada = (() => { try { return localStorage.getItem(VOZ_K) !== 'nao'; } catch (e) { return true; } })();
function alternarVoz() { vozLigada = !vozLigada; try { localStorage.setItem(VOZ_K, vozLigada ? 'sim' : 'nao'); } catch (e) { } if (!vozLigada && window.speechSynthesis) speechSynthesis.cancel(); route({ manterScroll: true }); toast(vozLigada ? 'Vou responder falando' : 'Respostas só por escrito'); }
function vozPtBr() {
  const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
  const br = vs.filter(v => /pt[-_]BR/i.test(v.lang));
  return br.find(v => /google|luciana|francisca|natural|premium|enhanced/i.test(v.name)) || br[0] || vs.find(v => /^pt/i.test(v.lang)) || null;
}
function falar(texto, depois) {
  if (!vozLigada || !window.speechSynthesis || !texto) { if (depois) depois(); return; }
  speechSynthesis.cancel();
  const limpo = String(texto).replace(/[•*_#→]/g, ' ').replace(/R\$\s?([\d.]+),00/g, '$1 reais').replace(/R\$\s?([\d.]+),(\d{2})/g, '$1 reais e $2 centavos').replace(/\s+/g, ' ').slice(0, 420);
  const u = new SpeechSynthesisUtterance(limpo);
  const v = vozPtBr(); if (v) u.voice = v; u.lang = 'pt-BR'; u.rate = 1.05;
  if (depois) u.onend = depois;
  speechSynthesis.speak(u);
}
if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => { };   // carrega a lista de vozes cedo
let ouvindo = false;
function ouvir(aoOuvir) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Este navegador não ouve por voz — escreva a mensagem'); return; }
  if (window.speechSynthesis) speechSynthesis.cancel();
  const r = new SR(); r.lang = 'pt-BR'; r.interimResults = false; r.maxAlternatives = 1;
  ouvindo = true; marcarMic(true);
  r.onresult = e => aoOuvir(e.results[0][0].transcript);
  r.onerror = e => { if (e.error !== 'no-speech') toast('Não consegui ouvir — tente de novo'); };
  r.onend = () => { ouvindo = false; marcarMic(false); };
  r.start();
}
function marcarMic(on) { const b = $('#micAssist'); if (b) { b.classList.toggle('on', on); b.setAttribute('aria-label', on ? 'Ouvindo…' : 'Falar com o assistente'); } }
function falarComAssistente() { ouvir(txt => perguntar(txt, true)); }
/* depois de um cartão de ação lido em voz alta, escuta "confirma" ou "cancela" */
function escutarConfirmacao(i) {
  ouvir(txt => {
    const q = semAcento(txt);
    if (/\b(sim|confirm\w*|pode|isso|ok|manda|beleza|certo|claro|marca|faz)\b/.test(q)) { executarAcao(i); falar('Pronto, feito.'); }
    else if (/\b(nao|cancel\w*|deixa|errado|espera)\b/.test(q)) { cancelarAcao(i); falar('Cancelado.'); }
    else perguntar(txt, true);
  });
}

function executarAcao(i) {
  const c = conversa[i]; if (!c || c.estado !== 'pendente') return;
  const d = c.acao.dados;
  comDesfazer('Feito no app', () => {
    if (c.acao.tipo === 'peso') animal(d.animalId).pesos.push({ data: isoHoje(), kg: d.kg });
    if (c.acao.tipo === 'vacina') {
      const v = registrarDose(d.animalId, d.escolha, d.estoqueId), t = DB.tabela.find(x => x.vacina === v.vacina);
      if (t) DB.orcamentos.push({ id: uid('o'), tutorId: animal(d.animalId).tutorId, animalId: d.animalId, data: isoHoje(), itens: [{ tab: t.id, qtd: 1 }], status: 'enviado', forma: '' });
    }
    if (c.acao.tipo === 'marcar') DB.agenda.push({ id: uid('g'), animalId: d.animalId, servico: d.servico || 's1', data: d.data, hora: d.hora, obs: d.obs || 'Marcado pelo assistente', status: 'confirmado', origem: 'ingrid' });
    if (c.acao.tipo === 'cadastro') {
      const t = { id: uid('t'), nome: d.tutor.nome, fone: d.tutor.fone || '', cpf: '', email: '', endereco: d.tutor.endereco || '', bairro: d.tutor.bairro || '', faixa: 'd1', origem: 'Assistente', desde: isoHoje() };
      DB.tutores.push(t);
      if (d.animal) DB.animais.push({ id: uid('a'), tutorId: t.id, nome: d.animal.nome, especie: d.animal.especie, raca: d.animal.raca || 'SRD', sexo: '', castrado: false, nasc: '', pesos: [], checkup: null });
    }
    if (c.acao.tipo === 'preco') { const t = tab(d.id); if (t) { t.preco = d.preco; delete t.exemplo; } }
    if (c.acao.tipo === 'ajuste') (DB.ajustes = DB.ajustes || []).push({ id: uid('aj'), data: isoHoje(), texto: d.texto, status: 'novo' });
    if (c.acao.tipo === 'pagou') d.ids.forEach(id => baixarOrcDados(id, d.forma));
    c.estado = 'feito';
  });
  route({ manterScroll: true });
}
function cancelarAcao(i) { conversa[i].estado = 'cancelado'; route({ manterScroll: true }); }
function responder(p) {
  const q = semAcento(p);
  if (/dose|mg|dosagem/.test(q)) {
    const f = DB.formulario.find(f => q.includes(semAcento(f.nome)));
    if (!f) { const nome = (q.match(/dose de ([a-z]+)/) || [])[1]; return `Não tenho ${nome ? 'a dose de ' + nome : 'essa dose'} na sua lista de medicamentos, então não vou arriscar um número.\nCadastre o remédio em Mais → Calcular dose, com o link da bula do VetSmart, e eu passo a responder.`; }
    const esp = /gat/.test(q) ? 'Gato' : 'Cão', d = f.doses[esp], kg = parseFloat((q.match(/(\d+[.,]?\d*)\s*kg/) || [])[1]?.replace(',', '.'));
    if (!d) return `A bula de ${f.nome} não traz dose para ${esp.toLowerCase()}. Não use.`;
    const mg = n => (n * kg).toFixed(2).replace('.', ',');
    return `${f.nome} para ${esp.toLowerCase()}: ${d.min === d.max ? vg(d.min) : vg(d.min) + ' a ' + vg(d.max)} mg/kg, ${d.duracao}.` + (kg ? `\nPara ${vg(kg)} kg: ${d.min === d.max ? mg(d.min) : mg(d.min) + ' a ' + mg(d.max)} mg.` : '') + `\nVias: ${f.vias}. ${f.receita}.\nFonte: VetSmart, conferido em ${dataCurta(f.conferido)}.`;
  }
  if (/atrasad|vencid|vacina/.test(q)) {
    const at = atrasadas(), ve = vencendo();
    if (!at.length && !ve.length) return 'Nenhuma vacina atrasada nem vencendo nos próximos 15 dias.';
    return (at.length ? 'Atrasadas:\n' + at.map(v => `• ${animal(v.animalId).nome} (${tutor(animal(v.animalId).tutorId).nome}) — ${v.vacina}, ${statusDose(v).txt}`).join('\n') : '') +
      (ve.length ? '\n\nVencendo em 15 dias:\n' + ve.map(v => `• ${animal(v.animalId).nome} — ${v.vacina}, ${quando(v.data)}`).join('\n') : '') + '\n\nAs mensagens prontas estão em Hoje → Avisar hoje.';
  }
  if (/agenda|amanha|hoje|visita/.test(q)) {
    const dia = /amanha/.test(q) ? isoMais(isoHoje(), 1) : isoHoje();
    const gs = DB.agenda.filter(g => g.data === dia).sort((a, b) => a.hora.localeCompare(b.hora));
    return gs.length ? `${dia === isoHoje() ? 'Hoje' : 'Amanhã'}:\n` + gs.map(g => { const a = animal(g.animalId), t = tutor(a.tutorId); return `• ${g.hora} — ${a.nome} (${t.nome}), ${servicosTxt(g)}, ${t.bairro}${g.status === 'pedido' ? ' — falta confirmar' : ''}`; }).join('\n') : 'Nenhuma visita marcada nesse dia.';
  }
  if (/entrou|fatur|financeiro|ganhei|lucro|saiu/.test(q)) {
    const ym = isoHoje().slice(0, 7), ls = DB.lanc.filter(l => l.data.startsWith(ym));
    const e = ls.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0), s = ls.filter(l => l.tipo === 'saida').reduce((s, l) => s + l.valor, 0);
    const ab = DB.orcamentos.filter(o => o.status !== 'pago').reduce((x, o) => x + totalItens(o.itens), 0);
    return `Em ${MESES[+ym.slice(5) - 1]}: entrou ${brl(e)}, saiu ${brl(s)}, resultado ${brl(e - s)}.\nAinda a receber: ${brl(ab)}.`;
  }
  if (/estoque|repor|acaband|comprar/.test(q)) {
    const it = DB.estoque.filter(e => e.qtd <= e.min || (e.validade && diasAte(e.validade) <= 30));
    return it.length ? 'Atenção no estoque:\n' + it.map(e => `• ${e.nome}: ${e.qtd} un.${e.qtd <= e.min ? ' (repor)' : ''}${e.validade && diasAte(e.validade) <= 30 ? ', vence ' + quando(e.validade) : ''}`).join('\n') + '\n\nEm Estoque tem o botão "Lista de compras" que monta o pedido.' : 'Estoque em ordem.';
  }
  if (/check|avaliacao periodica/.test(q)) {
    const as = DB.animais.filter(a => a.checkup && diasAte(a.checkup) <= 30);
    return as.length ? 'Check-ups nos próximos 30 dias:\n' + as.map(a => `• ${a.nome} (${tutor(a.tutorId).nome}) — ${quando(a.checkup)}`).join('\n') : 'Nenhum check-up nos próximos 30 dias.';
  }
  const t = DB.tutores.find(t => q.includes(semAcento(t.nome.split(' ')[0]))) || DB.tutores.find(t => DB.animais.some(a => a.tutorId === t.id && q.includes(semAcento(a.nome))));
  if (t) { const an = DB.animais.filter(a => a.tutorId === t.id); return `${t.nome} — ${t.fone}, ${t.bairro}.\nAnimais: ${an.map(a => `${a.nome} (${a.raca}, ${idade(a.nasc)})`).join(', ')}.\nSituação: ${etapa(t).txt}.`; }
  return 'Neste protótipo eu respondo sobre vacinas, agenda, doses da sua lista, financeiro, estoque, check-ups e clientes pelo nome — e já faço: registrar peso, vacina aplicada, marcar visita e dar baixa em pagamento. Sempre mostro o que vai mudar antes.';
}
TELAS.assistente = () => barra('Assistente', { sub: 'Fale ou escreva — ele faz no app', acoes: acaoBtn(vozLigada ? 'volume-2' : 'volume-x', vozLigada ? 'Desligar a voz' : 'Ligar a voz', 'alternarVoz()') }) + `<main style="padding-bottom:calc(var(--rail-h) + 110px)">
  <div class="aviso lil small">${MODO_REAL ? 'Assistente com IA (Claude). Ele consulta seus clientes, agenda e financeiro, e toda mudança vem num cartão para você confirmar. Dose, só da sua lista conferida no VetSmart.' : 'Demonstração: respostas montadas por regras sobre os dados de exemplo. No app real é a IA (Claude) — e <b>nunca inventa dose</b>: só usa a lista conferida no VetSmart.'}</div>
  <div class="chat" id="chat" style="margin-top:14px">${conversa.length ? conversa.map((m, i) => m.de === 'acao' ? `
    <div class="acao ${m.estado !== 'pendente' ? 'feita' : ''}"><b>${esc(m.acao.titulo)}</b>${m.acao.itens.length ? `<ul class="small">${m.acao.itens.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${m.estado === 'pendente' && m.acao.tipo !== 'nada' ? `<div class="row"><button class="btn mini" onclick="executarAcao(${i})">${ic('check', 'sm')} Confirmar</button><button class="btn mini ghost" onclick="cancelarAcao(${i})">Cancelar</button></div>` : m.estado === 'feito' ? `<span class="tag verde">${ic('check', 'sm')} feito no app</span>` : m.estado === 'cancelado' ? '<span class="tag cinza">cancelado</span>' : ''}</div>`
    : `<div class="msg ${m.de}${m.carregando ? ' carregando' : ''}" data-msg="${i}">${esc(m.t) || (m.carregando ? 'pensando…' : '')}</div>`).join('') : `<div class="msg ia">Oi, Ingrid! Posso responder sobre o seu dia e também fazer por você: registrar peso, vacina, marcar visita, dar baixa em pagamento. Eu sempre mostro o que vai mudar antes.</div>`}</div>
  <div class="secao"><h2>Perguntar</h2></div><div class="sugs">${SUG_PERGUNTAR.map(s => `<button onclick="perguntar(this.textContent)">${s}</button>`).join('')}</div>
  <div class="secao"><h2>Mandar fazer</h2></div><div class="sugs">${SUG_FAZER.map(s => `<button onclick="perguntar(this.textContent)">${s}</button>`).join('')}</div>
  </main><div class="chatbox"><form onsubmit="event.preventDefault();perguntar($('#chIn').value)"><button type="button" id="micAssist" class="btn mic-grande" aria-label="Falar com o assistente" onclick="falarComAssistente()">${ic('mic')}</button><input id="chIn" aria-label="Sua mensagem" placeholder="Toque no microfone e fale" autocomplete="off" class="grow"><button class="btn sec" aria-label="Enviar">${ic('send')}</button></form></div>`;

/* ---------- assistente com IA (Claude, pela função "assistente" no Supabase dela) ---------- */
let iaOcupada = false;
function historicoIA() {
  const h = [];
  for (const m of conversa) {
    const role = m.de === 'eu' ? 'user' : 'assistant';
    const t = m.de === 'acao' ? `[cartão: ${m.acao.titulo} — ${m.estado === 'feito' ? 'confirmado pela Ingrid' : m.estado === 'cancelado' ? 'cancelado' : 'aguardando confirmação'}]` : m.erro ? '' : m.t;
    if (!t) continue;
    if (h.length && h[h.length - 1].role === role) h[h.length - 1].content += '\n' + t;   // falas seguidas do mesmo lado viram uma só
    else h.push({ role, content: t });
  }
  while (h.length && h[0].role !== 'user') h.shift();
  return h.slice(-16);
}
function atualizarMsg(i) { const el = document.querySelector(`[data-msg="${i}"]`); if (el) { el.textContent = conversa[i].t || '…'; window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }); } }
async function perguntarIA(p, porVoz) {
  if (iaOcupada) return toast('Espere eu terminar a resposta anterior');
  iaOcupada = true;
  conversa.push({ de: 'eu', t: p });
  const hist = historicoIA();
  conversa.push({ de: 'ia', t: '', carregando: true });
  let atual = conversa.length - 1, cartaoIdx = -1, depoisCartao = false, falado = '';
  const desce = () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
  route(); desce();
  if (NUV.pendente) { try { await nuvEnviar(); } catch (e) { } }   // a IA lê a nuvem: manda antes o que mudou aqui
  const ctrl = new AbortController(), corta = setTimeout(() => ctrl.abort(), 90000);
  try {
    await authEnsure();
    const r = await fetch(SUPA_URL + '/functions/v1/assistente', { method: 'POST', signal: ctrl.signal, headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + authToken(), 'Content-Type': 'application/json' }, body: JSON.stringify({ mensagens: hist, hoje: isoHoje() }) });
    if (!r.ok || !r.body) throw new Error(r.status === 403 ? 'sem_acesso' : r.status === 404 ? 'sem_funcao' : r.status === 503 ? 'chave_invalida' : 'http ' + r.status);
    const leitor = r.body.getReader(), dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await leitor.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let k;
      while ((k = buf.indexOf('\n\n')) >= 0) {
        const bloco = buf.slice(0, k); buf = buf.slice(k + 2);
        if (!bloco.startsWith('data: ')) continue;
        let ev; try { ev = JSON.parse(bloco.slice(6)); } catch (e) { continue; }
        if (ev.t === 'texto') {
          if (depoisCartao) { conversa.push({ de: 'ia', t: '' }); atual = conversa.length - 1; depoisCartao = false; route({ manterScroll: true }); }
          conversa[atual].t = (conversa[atual].t + ev.d).replace(/^\s+/, ''); conversa[atual].carregando = false; falado += ev.d;
          atualizarMsg(atual);
        } else if (ev.t === 'cartao') {
          if (!conversa[atual].t) conversa.splice(atual, 1);   // o cartão veio antes de qualquer texto: some o "pensando…"
          conversa.push({ de: 'acao', acao: ev.acao, estado: 'pendente' }); cartaoIdx = conversa.length - 1; atual = cartaoIdx; depoisCartao = true;
          route({ manterScroll: true }); desce();
        } else if (ev.t === 'erro') throw new Error(ev.d);
      }
    }
  } catch (e) {
    const m = String(e.message || e);
    const aviso = m === 'chave_invalida' ? 'O assistente ainda não está ligado: falta a chave da IA no servidor.' : m === 'sem_funcao' ? 'O assistente ainda não foi instalado no servidor.' : m === 'sem_acesso' ? 'Não consegui ler o consultório — saia e entre de novo.' : m === 'limite' ? 'Muita gente pedindo ao mesmo tempo — tente em alguns segundos.' : /abort/i.test(m) ? 'Demorou demais para responder. Tente de novo.' : 'Não consegui falar com o assistente agora (internet?). Tente de novo.';
    if (conversa[atual].de === 'ia' && !conversa[atual].t) Object.assign(conversa[atual], { t: aviso, erro: true }); else { conversa.push({ de: 'ia', t: aviso, erro: true }); atual = conversa.length - 1; }
    falado = aviso;
  } finally { clearTimeout(corta); iaOcupada = false; if (conversa[atual].de === 'ia') conversa[atual].carregando = false; }
  if (conversa[atual].de === 'ia' && !conversa[atual].t) conversa[atual].t = 'Pronto.';
  route({ manterScroll: true }); desce();
  if (porVoz || vozLigada) falar(falado.trim() || conversa[atual].t || '', porVoz && cartaoIdx >= 0 ? () => escutarConfirmacao(cartaoIdx) : null);
}

function perguntar(p, porVoz = false) {
  if (!p || !p.trim()) return;
  if (MODO_REAL && isLoggedIn()) return perguntarIA(p.trim(), porVoz);
  conversa.push({ de: 'eu', t: p.trim() });
  const q = semAcento(p);
  let acao = null;
  const falouOutroAnimal = DB.animais.some(a => palavras(q).includes(semAcento(a.nome))) && !(contextoMarcar && contextoMarcar.animalId && palavras(q).includes(semAcento(animal(contextoMarcar.animalId).nome)));
  if (contextoMarcar && !falouOutroAnimal && !/\b(peso|pagou|tomou|apliquei|dose)\b/.test(q)) acao = entenderMarcar(q, Object.fromEntries(Object.entries(contextoMarcar).filter(([, v]) => v)));
  if (!acao) acao = entenderAcao(p);
  let fala;
  if (acao && acao.tipo === 'pergunta') { conversa.push({ de: 'ia', t: acao.titulo + '\n' + acao.itens.join('\n') }); fala = acao.fala; }
  else if (acao) { conversa.push({ de: 'acao', acao, estado: 'pendente' }); fala = acao.fala || (acao.titulo + '. ' + acao.itens.join('. ') + (acao.tipo !== 'nada' ? '. Confirmo?' : '')); }
  else { contextoMarcar = null; const r = responder(p); conversa.push({ de: 'ia', t: r }); fala = r; }
  route(); window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
  if (porVoz || vozLigada) {
    const i = conversa.length - 1, esperaSim = porVoz && conversa[i].de === 'acao' && conversa[i].acao.tipo !== 'nada', esperaMais = porVoz && acao && acao.tipo === 'pergunta';
    falar(fala, esperaSim ? () => escutarConfirmacao(i) : esperaMais ? () => falarComAssistente() : null);
  }
}

/* ---- Mais / ADM ---- */
TELAS.mais = () => barra('Mais') + `<main><div class="card menu">
  ${[['/financeiro', 'wallet', 'Financeiro', 'Entradas, saídas, a receber'], ['/estoque', 'package', 'Estoque', 'Vacinas, medicamentos, insumos'], ['/doses', 'scale', 'Calcular dose', 'Lista de medicamentos conferida no VetSmart'], ['/avaliacoes', 'star', 'Avaliações', 'O que os tutores acharam'],
    ['/adm/tabela', 'tag', 'Tabela de valores', 'Vacinas, consultas, deslocamento'], ['/adm/protocolos', 'shield-check', 'Protocolos de vacina', 'Filhote e anual · check-up'], ['/adm/perfil', 'id-card', 'Meus dados profissionais', 'CRMV, MAPA, Pix, WhatsApp, Google'], ['/t', 'eye', 'Ver como tutor', 'O link que o cliente recebe']]
    .map(([h, i, t, s]) => `<a href="#${h}"><span class="icm">${ic(i)}</span><span class="grow">${t}<small>${s}</small></span>${ic('chevron-right')}</a>`).join('')}
  ${(DB.ajustes || []).length ? `<a href="#/ajustes"><span class="icm">${ic('clipboard-list')}</span><span class="grow">Pedidos de ajuste no app<small>${DB.ajustes.filter(x => x.status === 'novo').length} para o Eugênio</small></span>${ic('chevron-right')}</a>` : ''}
  ${MODO_REAL ? `<a href="#/copias"><span class="icm">${ic('shield-check')}</span><span class="grow">Cópias de segurança<small>Guardadas sozinhas neste aparelho</small></span>${ic('chevron-right')}</a>` : ''}
  </div>
  ${MODO_REAL ? `<div class="card" style="margin-top:16px"><div class="small muted">Conectada como</div><b>${esc(authEmail() || '')}</b><div class="tiny muted" style="margin-top:4px">${NUV.status === 'ok' ? 'Tudo salvo na nuvem' : NUV.status === 'offline' ? 'Sem internet — guardado neste aparelho' : 'Tentando falar com a nuvem…'}</div>
    <button class="btn ghost full" style="margin-top:12px" onclick="sair()">Sair desta conta</button></div>`
    : `<button class="btn ghost full" style="margin-top:16px" onclick="if(confirm('Voltar os dados de exemplo? O que você mexeu some.')){DB=seedDB();salvar();go('/')}">Restaurar dados de exemplo</button>`}
  <p class="tiny muted" style="text-align:center;margin-top:10px">v0.6 · ${MODO_REAL ? 'dados na nuvem da Dra. Ingrid' : 'demonstração — os dados ficam só neste aparelho'}</p></main>`;

TELAS.adm = sub => {
  if (sub === 'tabela') {
    const cats = [...new Set(DB.tabela.map(t => t.cat))];
    return barra('Tabela de valores', { voltar: '/mais', sub: 'Orçamento e link do tutor usam estes preços' }) + `<main class="com-cta">
    ${cats.map(c => `<div class="secao"><h2>${esc(c)}</h2></div><div class="card">${DB.tabela.filter(t => t.cat === c).map(t => `<div class="item"><div class="grow"><label for="p_${t.id}" style="margin:0;color:var(--tinta);font-size:15px;font-weight:700">${esc(t.nome)}</label> ${t.exemplo ? '<span class="exemplo">exemplo</span>' : '<span class="tag verde">valor da Ingrid</span>'}${t.especie ? `<div class="tiny muted">${esc(t.especie)}</div>` : ''}</div>
      <div style="width:112px;position:relative"><span class="small muted" style="position:absolute;left:10px;top:50%;transform:translateY(-50%)">R$</span><input id="p_${t.id}" data-preco="${t.id}" value="${vg(t.preco)}" inputmode="decimal" style="text-align:right"></div></div>`).join('')}</div>`).join('')}
    <div class="aviso small" style="margin-top:12px">Faltam os valores reais de consulta, retorno, check-up e deslocamento (por distância ou por bairro?).</div></main>
    <div class="cta-fixa"><div class="in"><button class="btn full" onclick="salvarTabela()">${ic('check')} Salvar valores</button></div></div>`;
  }
  if (sub === 'protocolos') return barra('Protocolos de vacina', { voltar: '/mais' }) + `<main>
    ${DB.protocolos.map(p => `<div class="card"><b>${esc(p.nome)}</b><div class="grid2"><div><label for="pd_${p.id}">Nº de doses</label><input id="pd_${p.id}" data-pd="${p.id}" value="${p.doses}" inputmode="numeric"></div><div><label for="pi_${p.id}">Intervalo (dias)</label><input id="pi_${p.id}" data-pi="${p.id}" value="${p.intervalo}" inputmode="numeric"></div></div>${p.id === 'filhote' ? '<div class="tiny muted" style="margin-top:6px">Depois da última dose, o app marca o reforço anual sozinho.</div>' : ''}</div>`).join('')}
    <div class="card"><b>Check-up (avaliação periódica)</b><label for="ckM">Lembrar o tutor a cada (meses)</label><input id="ckM" value="${DB.checkupMeses}" inputmode="numeric"></div>
    <button class="btn full" style="margin-top:16px" onclick="salvarProtocolos()">Salvar</button>
    <div class="aviso small" style="margin-top:12px">Número de doses e intervalo do filhote são de exemplo (3 doses a cada 21 dias, como no SimplesVet). Confirmar com a Ingrid.</div></main>`;
  if (sub === 'perfil') { const c = DB.cfg; return barra('Dados profissionais', { voltar: '/mais', sub: 'Aparecem nas receitas e no link do tutor' }) + `<main><div class="card">
    <label for="pfN" style="margin-top:0">Nome</label><input id="pfN" value="${esc(c.nome)}"><div class="grid2"><div><label for="pfC">CRMV</label><input id="pfC" value="${esc(c.crmv)}"></div><div><label for="pfM">Registro MAPA</label><input id="pfM" value="${esc(c.mapa)}" placeholder="ainda não tem"></div></div>
    <label for="pfW">WhatsApp</label><input id="pfW" value="${esc(c.whats)}" placeholder="falta" inputmode="tel"><label for="pfP">Chave Pix</label><input id="pfP" value="${esc(c.pix)}" placeholder="falta">
    <label for="pfG">Link de avaliação no Google</label><input id="pfG" type="url" value="${esc(c.google)}" placeholder="https://g.page/r/...">
    <label>Horário de atendimento (todos os dias)</label><div class="grid2"><input type="time" id="pfI" aria-label="Início" value="${c.horario.ini}"><input type="time" id="pfF" aria-label="Fim" value="${c.horario.fim}"></div>
    <button class="btn full" style="margin-top:16px" onclick="salvarPerfil()">Salvar</button></div></main>`; }
  return '<main>—</main>';
};
function salvarTabela() { document.querySelectorAll('[data-preco]').forEach(i => { const t = tab(i.dataset.preco), v = parseFloat(i.value.replace(/\./g, '').replace(',', '.')); if (!isNaN(v) && v !== t.preco) { t.preco = v; delete t.exemplo; } }); salvar(); route(); toast('Valores salvos'); }
function salvarProtocolos() { DB.protocolos.forEach(p => { p.doses = parseInt($(`[data-pd="${p.id}"]`).value, 10) || p.doses; p.intervalo = parseInt($(`[data-pi="${p.id}"]`).value, 10) || p.intervalo; }); DB.checkupMeses = parseInt($('#ckM').value, 10) || 12; salvar(); route(); toast('Salvo'); }
function salvarPerfil() { const c = DB.cfg; c.nome = $('#pfN').value; c.crmv = $('#pfC').value; c.mapa = $('#pfM').value; c.whats = $('#pfW').value; c.pix = $('#pfP').value; c.google = $('#pfG').value; c.horario.ini = $('#pfI').value; c.horario.fim = $('#pfF').value; salvar(); route(); toast('Salvo'); }

TELAS.avaliacoes = () => {
  const av = DB.avaliacoes.slice().sort((a, b) => b.data.localeCompare(a.data)), media = av.length ? av.reduce((s, a) => s + a.nota, 0) / av.length : 0;
  return barra('Avaliações', { voltar: '/mais', sub: `${av.length} ${av.length === 1 ? 'avaliação' : 'avaliações'} · média ${media.toFixed(1).replace('.', ',')} de 5` }) + `<main>
  <div class="card">${av.length ? av.map(a => `<div class="item"><div class="grow"><b aria-label="${a.nota} de 5 estrelas" style="color:#B58300">${'★'.repeat(a.nota)}${'☆'.repeat(5 - a.nota)}</b> <span class="small muted">· ${esc(tutor(a.tutorId)?.nome || '')} · ${dataCurta(a.data)}</span><div class="small">${esc(a.texto)}</div></div></div>`).join('') : '<p class="muted" style="margin:0">Nenhuma ainda.</p>'}</div>
  <div class="aviso lil small" style="margin-top:12px">Depois de avaliar aqui, <b>todo</b> tutor vê o convite para avaliar também no Google. O Google proíbe mandar só quem deu nota alta — por isso o convite vai para todos.</div></main>`;
};

/* ================= LADO DO TUTOR ================= */
const TUTOR = {};
const barraTutor = (titulo, sub) => barra(titulo, { voltar: '/t', sub });

TUTOR.home = () => {
  const t = tutor(TUTOR_DEMO), an = DB.animais.filter(a => a.tutorId === t.id);
  const prox = DB.doses.filter(v => an.some(a => a.id === v.animalId) && v.status === 'programada').sort((a, b) => a.data.localeCompare(b.data))[0];
  const pedidos = DB.agenda.filter(g => an.some(a => a.id === g.animalId) && diasAte(g.data) >= 0 && g.status !== 'feito');
  const orc = DB.orcamentos.filter(o => o.tutorId === t.id && o.status !== 'pago');
  const menu = [
    ['#/t/agendar', 'calendar', 'Marcar visita', 'Escolha dia e horário'],
    ['#/t/carteira', 'syringe', 'Carteira de vacinas', an.map(a => esc(a.nome)).join(' e ')],
    ...orc.map(o => [`#/t/orcamento/${o.id}`, 'receipt', o.status === 'aprovado' ? 'Pagamento pendente' : 'Orçamento para aprovar', `${brl(totalItens(o.itens))} · ${dataCurta(o.data)}`]),
    ['#/t/avaliar', 'star', 'Avaliar atendimento', 'Leva 1 minuto'],
  ];
  return `<section class="hero" style="text-align:center"><div class="in"><img src="simbolo.png" alt="" style="height:52px"><div class="small" style="margin-top:8px;font-weight:700">Dra. Ingrid Garrocini</div><div class="tiny" style="color:var(--tinta-lil)">Veterinária a domicílio · CRMV ${esc(DB.cfg.crmv)}</div><h1 style="margin-top:14px">Olá, ${esc(t.nome.split(' ')[0])}!</h1><div class="sub">Cuidado veterinário na sua casa</div></div></section><main>
  ${prox ? (() => { const a = animal(prox.animalId), s = statusDose(prox), tv = DB.tabela.find(x => x.vacina === prox.vacina); return `<div class="card" style="border-color:var(--lil)"><div class="row">${avatar(a)}<div class="grow"><div class="small muted">Próxima vacina</div><b>${esc(a.nome)} · ${esc(prox.vacina)}</b><div><span class="tag ${s.cls}">${s.txt}</span></div></div>
    <a class="btn mini" href="#/t/agendar" onclick="agT={animal:'${a.id}',servicos:['${tv ? tv.id : ''}']}">Marcar</a></div></div>`; })() : ''}
  ${pedidos.map(g => `<div class="card"><div class="small muted">Visita ${g.status === 'pedido' ? 'pedida — a Dra. Ingrid vai confirmar' : 'confirmada'}</div><b>${SEM_LONGO[diaSemN(g.data)]}, ${dataCurta(g.data)} às ${g.hora}</b><div class="small">${esc(animal(g.animalId).nome)} · ${esc(servicosTxt(g))}</div></div>`).join('')}
  <div class="card menu" style="margin-top:12px">
    ${menu.map(([h, i, t, s]) => `<a href="${h}"><span class="icm">${ic(i)}</span><span class="grow">${t}<small>${s}</small></span>${ic('chevron-right')}</a>`).join('')}
    <a href="${waLink('Olá, Dra. Ingrid! ')}" target="_blank" rel="noopener"><span class="icm" style="background:var(--verde-2);color:var(--wa)">${ic('message-circle')}</span><span class="grow">Falar no WhatsApp<small>${DB.cfg.whats ? esc(DB.cfg.whats) : 'número da Ingrid — falta'}</small></span>${ic('chevron-right')}</a>
  </div></main>`;
};

let agT = {};
function horariosLivres(dia) {
  const h = DB.cfg.horario, slots = [];
  for (let m = minutos(h.ini); m + 60 <= minutos(h.fim); m += h.passo) slots.push(hhmm(m));
  const ocupado = DB.agenda.filter(g => g.data === dia).map(g => g.hora);
  return slots.filter(s => !ocupado.includes(s));
}
TUTOR.agendar = () => {
  const t = tutor(TUTOR_DEMO), an = DB.animais.filter(a => a.tutorId === t.id);
  agT.animal = an.some(a => a.id === agT.animal) ? agT.animal : an[0].id;
  const a = animal(agT.animal);
  const servs = DB.tabela.filter(x => x.cat === 'Serviços' || (x.vacina && (x.especie === 'Ambos' || x.especie === a.especie)));
  agT.servicos = (agT.servicos || []).filter(id => servs.some(s => s.id === id));
  const h = DB.cfg.horario, dias = Array.from({ length: 14 }, (_, i) => isoMais(isoHoje(), i + 1)).filter(d => h.dias.includes(diaSemN(d)));
  if (!agT.dia || !dias.includes(agT.dia)) agT.dia = dias.find(d => horariosLivres(d).length) || dias[0];
  const livres = horariosLivres(agT.dia);
  if (!livres.includes(agT.hora)) agT.hora = '';
  const fx = tab(t.faixa), soma = agT.servicos.reduce((s, id) => s + (tab(id)?.preco || 0), 0) + (agT.servicos.length ? fx.preco : 0);
  const pronto = agT.servicos.length && agT.hora;
  return barraTutor('Marcar visita', 'A Dra. Ingrid confirma pelo WhatsApp') + `<main class="com-cta">
  <div class="secao" style="margin-top:4px"><h2>Para quem?</h2></div><div class="abas" style="margin-top:0">${an.map(x => `<button class="${agT.animal === x.id ? 'on' : ''}" aria-pressed="${agT.animal === x.id}" onclick="agT.animal='${x.id}';route({manterScroll:true})">${ic(ehGato(x) ? 'cat' : 'dog', 'sm')} ${esc(x.nome)}</button>`).join('')}</div>
  <div class="secao"><h2>O que precisa?</h2><span class="small muted">pode marcar mais de um</span></div><div class="card">${servs.map(x => `<label class="preco-lin"><input type="checkbox" ${agT.servicos.includes(x.id) ? 'checked' : ''} onchange="agT.servicos=this.checked?[...agT.servicos,'${x.id}']:agT.servicos.filter(s=>s!=='${x.id}');route({manterScroll:true})"><span>${esc(x.nome)} ${x.exemplo ? '<span class="exemplo">exemplo</span>' : ''}</span><b>${brl(x.preco)}</b></label>`).join('')}</div>
  <div class="secao"><h2>Qual dia?</h2></div><div class="dias">${dias.map(d => { const n = horariosLivres(d).length; return `<button class="${d === agT.dia ? 'on' : ''}" ${n ? '' : 'disabled'} onclick="agT.dia='${d}';route({manterScroll:true})">${diaSem(d)}<b>${d.slice(8)}</b><small>${n ? n + ' livres' : 'lotado'}</small></button>`; }).join('')}</div>
  <div class="secao"><h2>Horário</h2></div><div class="sugs">${livres.map(x => `<button aria-pressed="${agT.hora === x}" style="${agT.hora === x ? 'background:var(--tinta);color:#fff;border-color:var(--tinta)' : ''}" onclick="agT.hora='${x}';route({manterScroll:true})">${x}</button>`).join('') || '<span class="muted small">Sem horários neste dia.</span>'}</div>
  <div class="card" style="margin-top:16px"><div class="small muted">Endereço da visita</div><b>${esc(endereco(t))}</b>
    ${agT.servicos.length ? `<div style="margin-top:10px">${agT.servicos.map(id => `<div class="row between small"><span>${esc(tab(id).nome)}</span><span>${brl(tab(id).preco)}</span></div>`).join('')}<div class="row between small"><span>${esc(fx.nome)}</span><span>${brl(fx.preco)}</span></div></div>` : ''}
    <label for="agObs">Quer contar algo?</label><textarea id="agObs" rows="2" placeholder="Ex.: está coçando a orelha"></textarea></div>
  </main>
  <div class="cta-fixa"><div class="in"><div class="grow"><div class="tiny muted">${pronto ? `${diaSem(agT.dia)} ${dataCurta(agT.dia)} às ${agT.hora}` : !agT.servicos.length ? 'Escolha o serviço' : 'Escolha o horário'}</div><b style="font-size:18px">${agT.servicos.length ? 'Estimativa ' + brl(soma) : '—'}</b></div>
    <button class="btn" ${pronto ? '' : 'disabled'} onclick="pedirHorario()">Pedir horário</button></div></div>`;
};
function pedirHorario() {
  const [servico, ...extras] = agT.servicos;
  DB.agenda.push({ id: uid('g'), data: agT.dia, hora: agT.hora, animalId: agT.animal, servico, extras, status: 'pedido', origem: 'tutor', obs: ($('#agObs').value || '').trim() || 'Pedido pelo link' });
  salvar(); const txt = `${SEM_LONGO[diaSemN(agT.dia)]}, ${dataCurta(agT.dia)} às ${agT.hora}`; agT = {};
  $('#app').innerHTML = barraTutor('Pedido enviado') + `<main><div class="card" style="text-align:center"><div class="ava xl" style="margin:0 auto;background:var(--verde-2);color:var(--verde)">${ic('check')}</div><h2 style="margin-top:12px">${txt}</h2><p>A Dra. Ingrid recebeu seu pedido e vai confirmar pelo WhatsApp.</p><p class="small muted">Para a demonstração: volte para o lado da Ingrid — o pedido aparece em <b>Hoje → Para aprovar</b>.</p></div>
  <div class="row" style="margin-top:14px"><a class="btn grow" href="#/t">Início</a><button class="btn sec grow" onclick="go('/')">Ver como Ingrid</button></div></main>`;
  window.scrollTo(0, 0);
}

TUTOR.carteira = () => {
  const an = DB.animais.filter(a => a.tutorId === TUTOR_DEMO);
  return barraTutor('Carteira de vacinas') + `<main>${an.map(a => { const vs = DB.doses.filter(v => v.animalId === a.id).sort((x, y) => y.data.localeCompare(x.data)); return `
    <div class="secao" style="margin-top:8px"><h2>${esc(a.nome)}</h2><span class="small muted">${esc(a.raca)} · ${idade(a.nasc)}</span></div>
    <div class="card">${vs.map(v => `<div class="item"><div class="grow"><b>${esc(v.vacina)}</b>${v.total > 1 ? ` <span class="small muted">dose ${v.n}/${v.total}</span>` : ''}<div class="small muted">${dataCurta(v.data)}${v.lote ? ' · lote ' + esc(v.lote) : ''}</div></div><span class="tag ${statusDose(v).cls}">${statusDose(v).txt}</span></div>`).join('') || '<p class="muted" style="margin:0">Sem registros.</p>'}</div>`; }).join('')}
  <a class="btn full" href="#/t/agendar" style="margin-top:16px">Marcar a próxima vacina</a></main>`;
};

TUTOR.orcamento = id => {
  const o = DB.orcamentos.find(x => x.id === id); if (!o) return barraTutor('Orçamento') + '<main>Orçamento não encontrado.</main>';
  const a = animal(o.animalId), c = DB.cfg;
  return barraTutor(o.status === 'pago' ? 'Pagamento recebido' : 'Resumo da visita', `${esc(a.nome)} · ${dataCurta(o.data)}`) + `<main>
  <div class="card">${o.itens.map(i => `<div class="row between" style="margin:6px 0"><span>${esc(tab(i.tab)?.nome || '')}</span><b>${brl((tab(i.tab)?.preco || 0) * (i.qtd || 1))}</b></div>`).join('')}
    <div class="row between" style="border-top:1px solid var(--linha);margin-top:8px;padding-top:10px"><b>Total</b><b style="font-size:22px">${brl(totalItens(o.itens))}</b></div></div>
  ${o.status === 'pago' ? `<p class="muted" style="text-align:center">Pago com ${o.forma === 'cartao' ? 'cartão' : 'Pix'}. Obrigada!</p>` : `
  <div class="secao"><h2>Como prefere pagar?</h2></div>
  <div class="card"><div class="row"><div class="ava" style="background:var(--verde-2);color:var(--verde)">${ic('wallet')}</div><div class="grow"><b>Pix</b><div class="small muted">Chave: ${c.pix ? esc(c.pix) : '<span style="color:var(--coral-f)">chave Pix da Ingrid — falta</span>'}</div></div></div>
    <button class="btn full" style="margin-top:10px" onclick="tutorPagar('${o.id}','pix')">Aprovar e pagar com Pix</button></div>
  <div class="card"><div class="row"><div class="ava">${ic('receipt')}</div><div class="grow"><b>Cartão</b><div class="small muted">Crédito ou débito, na maquininha da Dra. Ingrid, na visita.</div></div></div>
    <button class="btn sec full" style="margin-top:10px" onclick="tutorPagar('${o.id}','cartao')">Aprovar e pagar no cartão</button></div>`}
  </main>`;
};
function tutorPagar(id, forma) {
  const o = DB.orcamentos.find(x => x.id === id); o.status = 'aprovado'; o.forma = forma; salvar();
  $('#app').innerHTML = barraTutor('Aprovado', brl(totalItens(o.itens))) + `<main><div class="card">${forma === 'pix'
    ? `<p>Faça o Pix para a chave:</p><p style="font-size:18px"><b>${DB.cfg.pix ? esc(DB.cfg.pix) : '(chave da Ingrid)'}</b></p><p class="small muted">No app real aparece também o QR Code do Pix com o valor já preenchido, e o comprovante vai direto para ela.</p>`
    : '<p>Tudo certo! O pagamento no cartão é feito na maquininha, na hora da visita.</p>'}</div>
    <p class="small muted" style="text-align:center">Para a demonstração: do lado da Ingrid, em Mais → Financeiro → A receber, ela toca “Recebi”.</p><a class="btn full" href="#/t">Início</a></main>`;
  window.scrollTo(0, 0);
}

let notaT = 0;
TUTOR.avaliar = () => barraTutor('Como foi o atendimento?', 'Sua opinião ajuda a Dra. Ingrid') + `<main><div class="card" style="text-align:center">
  <div class="estrelas" role="radiogroup" aria-label="Nota">${[1, 2, 3, 4, 5].map(n => `<button role="radio" aria-checked="${n === notaT}" class="${n <= notaT ? 'on' : ''}" onclick="notaT=${n};route({manterScroll:true})" aria-label="${n} ${n === 1 ? 'estrela' : 'estrelas'}">★</button>`).join('')}</div>
  <label for="avT" style="text-align:left">Conte como foi (opcional)</label><textarea id="avT" rows="3"></textarea>
  <button class="btn full" style="margin-top:12px" ${notaT ? '' : 'disabled'} onclick="enviarAvaliacao()">Enviar</button></div></main>`;
function enviarAvaliacao() {
  DB.avaliacoes.push({ id: uid('av'), tutorId: TUTOR_DEMO, nota: notaT, texto: $('#avT').value.trim(), data: isoHoje() }); salvar(); notaT = 0;
  const g = DB.cfg.google;
  $('#app').innerHTML = barraTutor('Obrigada!') + `<main><div class="card" style="text-align:center"><p>Sua avaliação chegou para a Dra. Ingrid.</p>
    <p class="small">Pode deixar também no Google? Ajuda outros tutores a encontrar atendimento em casa.</p>
    ${g ? `<a class="btn full" target="_blank" rel="noopener" href="${esc(g)}">Avaliar no Google</a>` : '<button class="btn full" disabled>Avaliar no Google</button><p class="tiny muted">Falta o link do Google da Ingrid (Mais → Meus dados).</p>'}</div>
    <a class="btn ghost full" style="margin-top:12px" href="#/t">Início</a></main>`;
  window.scrollTo(0, 0);
}



/* ================= CENTRAL DE AVISOS ================= */
/* Junta tudo o que pede atenção num lugar só. Cada aviso tem uma chave estável:
   "lembrar amanhã" e "dispensar" valem só para aquele aviso. */
const GRUPOS = [['agora', 'Agir agora', 'coral'], ['hoje', 'Hoje', 'ambar'], ['espera', 'Pode esperar', 'azul'], ['sistema', 'Sistema', 'cinza']];
function notifEstado() { return DB.notif || (DB.notif = {}); }
function centralAvisos() {
  const L = [];
  // agir agora: pedidos de horário e conflito entre aparelhos
  DB.agenda.filter(g => g.status === 'pedido').sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora)).forEach(g => {
    const a = animal(g.animalId), t = a && tutor(a.tutorId); if (!a || !t) return;
    L.push({ k: 'ped' + g.id, grupo: 'agora', icone: 'calendar', titulo: `Pedido de horário · ${a.nome}`, sub: `${t.nome} · ${diaSem(g.data)} ${dataCurta(g.data)} às ${g.hora} · ${servicosTxt(g)}`, rotulo: 'Confirmar', acao: `confirmar('${g.id}')`, extra: `recusar('${g.id}')`, extraRot: 'Outro horário' });
  });
  if (typeof NUV !== 'undefined' && NUV.conflito) L.push({ k: 'conflito', grupo: 'agora', icone: 'triangle-alert', titulo: 'Mudou em dois aparelhos', sub: 'Escolha qual versão fica — a outra vai para as cópias.', rotulo: 'Escolher', acao: 'nuvConflito(window.__nuvRemoto)', fixo: true });
  // hoje: tutores para avisar (vacina, check-up, avaliação)
  avisosHoje().forEach(x => L.push({ k: 'av' + x.k, grupo: 'hoje', icone: x.tipo === 'Vacina' ? 'syringe' : x.tipo === 'Check-up' ? 'clipboard-list' : 'star', titulo: `${x.tipo} · ${x.a.nome}`, sub: `${x.t.nome} · ${x.titulo}`, rotulo: 'Avisar', acao: `avisar('${x.k}')`, wa: true }));
  // pode esperar: dinheiro em aberto há mais de 7 dias, estoque
  DB.orcamentos.filter(o => o.status !== 'pago' && diasAte(o.data) <= -7).forEach(o => {
    const t = tutor(o.tutorId), a = animal(o.animalId); if (!t) return;
    const msg = `Olá, ${t.nome.split(' ')[0]}! Aqui é a Dra. Ingrid 🐾 Passando para lembrar do valor em aberto da visita de ${dataCurta(o.data)}${a ? ' (' + a.nome + ')' : ''}: ${brl(totalItens(o.itens))}. Pode ser por Pix${DB.cfg.pix ? ' (chave ' + DB.cfg.pix + ')' : ''} ou cartão. Obrigada!`;
    L.push({ k: 'orc' + o.id, grupo: 'espera', icone: 'wallet', titulo: `${brl(totalItens(o.itens))} em aberto · ${t.nome}`, sub: `Visita de ${dataCurta(o.data)} · ${quando(o.data)}`, rotulo: 'Lembrar', link: waLink(msg), wa: true, extra: `receber('${o.id}')`, extraRot: 'Recebi' });
  });
  const repor = DB.estoque.filter(e => e.qtd <= e.min);
  if (repor.length) L.push({ k: 'repor' + repor.map(e => e.id + e.qtd).join(''), grupo: 'espera', icone: 'package', titulo: `${repor.length} ${repor.length === 1 ? 'item para repor' : 'itens para repor'}`, sub: repor.map(e => `${e.nome} (${e.qtd})`).join(', '), rotulo: 'Lista de compras', acao: 'listaCompras()' });
  DB.estoque.filter(e => e.validade && diasAte(e.validade) <= 30).forEach(e => L.push({ k: 'val' + e.id + e.validade, grupo: 'espera', icone: 'clock', titulo: `${e.nome} ${diasAte(e.validade) < 0 ? 'venceu' : 'vence ' + quando(e.validade)}`, sub: `Lote ${e.lote || '—'} · ${e.qtd} no estoque`, rotulo: 'Ver estoque', link: '#/estoque' }));
  // sistema
  if (typeof NUV !== 'undefined' && MODO_REAL && (NUV.status === 'offline' || NUV.status === 'erro')) L.push({ k: 'nuvem', grupo: 'sistema', icone: 'triangle-alert', titulo: NUV.status === 'offline' ? 'Sem internet' : 'A nuvem não respondeu', sub: 'Tudo fica guardado neste aparelho e sobe sozinho quando voltar.', rotulo: 'Tentar agora', acao: "nuvCiclo('mao')", fixo: true });
  if ($('#novaver') && $('#novaver').classList.contains('on')) L.push({ k: 'versao', grupo: 'sistema', icone: 'sparkles', titulo: 'Versão nova do app', sub: 'Atualize quando terminar o que está fazendo.', rotulo: 'Atualizar', acao: 'location.reload()', fixo: true });
  const est = notifEstado(), hoje = isoHoje();
  return L.filter(x => x.fixo || !(est[x.k] && (est[x.k].dispensado || (est[x.k].adiado && est[x.k].adiado > hoje))));
}
function naoVistos() { const est = notifEstado(); return centralAvisos().filter(x => (x.grupo === 'agora' || x.grupo === 'hoje') && !(est[x.k] && est[x.k].visto)).length; }
function sinoBtn() {
  const n = naoVistos();
  return `<a class="icbtn sino" href="#/avisos" aria-label="Avisos${n ? ': ' + n + ' novos' : ''}" title="Avisos">${ic('bell')}${n ? `<span class="badge">${n > 9 ? '9+' : n}</span>` : ''}</a>`;
}
function notifMarcar(k, campo) {
  const est = notifEstado();
  comDesfazer(campo === 'adiado' ? 'Volta amanhã' : 'Aviso dispensado', () => { est[k] = { ...(est[k] || {}), [campo]: campo === 'adiado' ? isoMais(isoHoje(), 1) : isoHoje() }; });
  route({ manterScroll: true });
}
TELAS.avisos = () => {
  const itens = centralAvisos();
  const html = barra('Avisos', { voltar: '/', sub: itens.length ? `${itens.length} ${itens.length === 1 ? 'coisa pede' : 'coisas pedem'} atenção` : 'Tudo em dia' }) + `<main>
  ${itens.length ? GRUPOS.map(([g, nome, cor]) => { const doGrupo = itens.filter(x => x.grupo === g); return doGrupo.length ? `<div class="secao"><h2>${nome}<span class="cont" style="background:var(--${cor === 'coral' ? 'coral-f' : cor === 'ambar' ? 'ambar-f' : cor === 'azul' ? 'azul-f' : 'tinta-2'})">${doGrupo.length}</span></h2></div>
    <div class="card">${doGrupo.map(x => { const visto = notifEstado()[x.k] && notifEstado()[x.k].visto; return `<div class="item aviso-item${visto ? ' visto' : ''}"><div class="ava" style="background:var(--${cor === 'coral' ? 'coral-2' : cor === 'ambar' ? 'ambar-2' : cor === 'azul' ? 'azul-2' : 'lil-3'});color:var(--${cor === 'coral' ? 'coral-f' : cor === 'ambar' ? 'ambar-f' : cor === 'azul' ? 'azul-f' : 'tinta-2'})">${ic(x.icone)}</div>
      <div class="grow"><b>${esc(x.titulo)}</b><div class="small muted">${esc(x.sub)}</div>
      <div class="row wrap" style="margin-top:8px;gap:6px">${x.link ? `<a class="btn mini ${x.wa ? 'wa' : ''}" href="${x.link}" ${x.link.startsWith('#') ? '' : 'target="_blank" rel="noopener"'}>${x.wa ? ic('message-circle', 'sm') + ' ' : ''}${x.rotulo}</a>` : `<button class="btn mini ${x.wa ? 'wa' : ''}" onclick="${x.acao}">${x.wa ? ic('message-circle', 'sm') + ' ' : ''}${x.rotulo}</button>`}
        ${x.extra ? `<button class="btn mini ghost" onclick="${x.extra}">${x.extraRot}</button>` : ''}
        ${x.fixo ? '' : `<button class="icbtn" style="width:36px;height:36px" aria-label="Lembrar amanhã" title="Lembrar amanhã" onclick="notifMarcar('${x.k}','adiado')">${ic('clock', 'sm')}</button><button class="icbtn" style="width:36px;height:36px" aria-label="Dispensar" title="Dispensar" onclick="notifMarcar('${x.k}','dispensado')">${ic('x', 'sm')}</button>`}</div></div></div>`; }).join('')}</div>` : ''; }).join('')
    : `<div class="card" style="text-align:center;padding:28px"><div class="ava xl" style="margin:0 auto;background:var(--verde-2);color:var(--verde)">${ic('check')}</div><h2 style="margin-top:12px">Tudo em dia</h2><p class="muted small">Nenhum pedido, tutor para avisar ou estoque para repor agora.</p></div>`}
  <p class="tiny muted" style="text-align:center;margin-top:14px">${ic('clock', 'sm')} lembrar amanhã · ${ic('x', 'sm')} dispensar este aviso. Os resolvidos saem sozinhos.</p></main>`;
  return html;
};
/* depois de ver a Central, os avisos contam como vistos (o número do sino zera) */
TELAS.avisos.depois = () => {
  const est = notifEstado(); let mudou = false;
  centralAvisos().forEach(x => { if (!(est[x.k] && est[x.k].visto)) { est[x.k] = { ...(est[x.k] || {}), visto: isoHoje() }; mudou = true; } });
  if (mudou) salvar();
  document.querySelectorAll('.sino').forEach(b => { b.setAttribute('aria-label', 'Avisos'); const n = b.querySelector('.badge'); if (n) n.remove(); });
};

/* ================= LOGIN (modo real) ================= */
let modoEntrar = 'entrar';
const telaSemRail = (titulo, sub, corpo) => `<section class="hero" style="text-align:center"><div class="in"><img src="simbolo.png" alt="" style="height:52px"><div class="small" style="margin-top:8px;font-weight:700">Dra. Ingrid Garrocini</div><div class="tiny" style="color:var(--tinta-lil)">Veterinária a domicílio</div><h1 style="margin-top:14px">${titulo}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div></section><main style="max-width:440px">${corpo}</main>`;
TELAS.entrar = () => {
  const m = modoEntrar;
  return telaSemRail(m === 'criar' ? 'Criar minha senha' : m === 'esqueci' ? 'Esqueci a senha' : 'Entrar', m === 'criar' ? 'Só no primeiro acesso' : '', `<form class="card" id="fEntrar" onsubmit="event.preventDefault();entrar()">
    <label for="enEmail" style="margin-top:0">E-mail</label><input id="enEmail" type="email" autocomplete="username" inputmode="email" required>
    ${m !== 'esqueci' ? `<label for="enSenha">${m === 'criar' ? 'Escolha uma senha (mínimo 8 caracteres)' : 'Senha'}</label><input id="enSenha" type="password" autocomplete="${m === 'criar' ? 'new-password' : 'current-password'}" minlength="${m === 'criar' ? 8 : 1}" required>` : ''}
    <button class="btn full" id="enBtn" style="margin-top:16px">${m === 'criar' ? 'Criar senha' : m === 'esqueci' ? 'Mandar link para o e-mail' : 'Entrar'}</button>
    <div id="enMsg" class="small" style="margin-top:12px" role="alert"></div></form>
    <div class="stack" style="margin-top:14px;text-align:center">
      ${m !== 'entrar' ? `<button class="btn ghost full" onclick="modoEntrar='entrar';route()">Já tenho senha — entrar</button>` : `<button class="btn ghost full" onclick="modoEntrar='criar';route()">Primeiro acesso: criar minha senha</button><button class="btn ghost full" onclick="modoEntrar='esqueci';route()">Esqueci a senha</button>`}
    </div>
    <p class="tiny muted" style="text-align:center;margin-top:16px">É o tutor? <a href="#/t">Marcar uma visita</a></p>`);
};
async function entrar() {
  const email = $('#enEmail').value.trim(), senha = $('#enSenha') ? $('#enSenha').value : '', btn = $('#enBtn'), msg = $('#enMsg');
  btn.disabled = true; const txt = btn.textContent; btn.textContent = 'Um momento…'; msg.textContent = '';
  try {
    if (modoEntrar === 'esqueci') {
      const r = await authReset(email);
      msg.textContent = r.ok ? 'Pronto! Abra o e-mail e toque no link para criar uma senha nova.' : 'Não consegui mandar: ' + (r.error || 'tente de novo');
    } else if (modoEntrar === 'criar') {
      const r = await authSignUp(email, senha);
      if (!r.ok) msg.textContent = 'Não deu: ' + (r.error || 'tente de novo');
      else if (r.needsConfirm) msg.textContent = 'Quase lá! Mandamos um e-mail de confirmação. Abra e toque no link — ele volta para cá já conectada.';
      else { await depoisDeEntrar(); return; }
    } else {
      const r = await authSignIn(email, senha);
      if (!r.ok) msg.textContent = /invalid/i.test(r.error || '') ? 'E-mail ou senha não conferem.' : /confirm/i.test(r.error || '') ? 'Falta confirmar o e-mail: abra o link que mandamos.' : 'Não deu: ' + (r.error || 'sem internet?');
      else { await depoisDeEntrar(); return; }
    }
  } catch (e) { msg.textContent = 'Sem resposta da internet. Tente de novo.'; }
  btn.disabled = false; btn.textContent = txt;
}
async function depoisDeEntrar() {
  NUV.dona = null; NUV.puxou = false;
  await nuvCiclo('login');
  if (NUV.dona) cofreGuardar('abertura');
  go('/');
}
async function sair() {
  if (NUV.pendente) { try { await nuvEnviar(); } catch (e) { } }
  if (NUV.pendente && !confirm('Ainda tem mudança que não subiu para a nuvem (sem internet?). Sair mesmo assim? Ela fica guardada neste aparelho.')) return;
  await authSignOut(); NUV.dona = null; NUV.puxou = false; modoEntrar = 'entrar'; go('/');
}
TELAS.naoDona = () => telaSemRail('Conta sem acesso', '', `<div class="card"><p>Você entrou como <b>${esc(authEmail() || '')}</b>, mas este consultório só abre para a conta da Dra. Ingrid.</p><button class="btn full" onclick="sair()">Sair e entrar com outra conta</button></div>`);
TELAS['nova-senha'] = () => telaSemRail('Senha nova', 'Escolha a senha que vai usar daqui para a frente', `<form class="card" onsubmit="event.preventDefault();trocarSenha()">
  <label for="nsSenha" style="margin-top:0">Senha nova (mínimo 8 caracteres)</label><input id="nsSenha" type="password" autocomplete="new-password" minlength="8" required>
  <button class="btn full" id="nsBtn" style="margin-top:16px">Salvar senha</button><div id="nsMsg" class="small" style="margin-top:12px" role="alert"></div></form>`);
async function trocarSenha() {
  const b = $('#nsBtn'); b.disabled = true;
  const r = await authSetPassword($('#nsSenha').value);
  if (r.ok) { toast('Senha salva'); history.replaceState(null, '', location.pathname); await depoisDeEntrar(); }
  else { $('#nsMsg').textContent = 'Não deu: ' + (r.error || 'tente de novo'); b.disabled = false; }
}

/* ---- Pedidos de ajuste (anotados pelo assistente, para o Eugênio) ---- */
TELAS.ajustes = () => barra('Pedidos de ajuste', { voltar: '/mais', sub: 'O que você pediu para mudar no app' }) + `<main><div class="card">${(DB.ajustes || []).slice().reverse().map(x => `<div class="item"><div class="grow"><b>${esc(x.texto)}</b><div class="small muted">${dataCurta(x.data)}</div></div><span class="tag ${x.status === 'feito' ? 'verde' : 'ambar'}">${x.status === 'feito' ? 'feito' : 'anotado'}</span></div>`).join('') || '<p class="muted" style="margin:0">Nada ainda.</p>'}</div>
  <p class="small muted" style="margin-top:12px">Peça ao assistente, por exemplo: "queria um campo para o microchip". Ele anota aqui e o Eugênio faz.</p></main>`;

/* ---- Cópias de segurança (cofre) ---- */
TELAS.copias = () => {
  const c = cofreLer();
  const nomeMotivo = { abertura: 'ao abrir o app', conflito: 'num conflito entre aparelhos', mao: 'antes de voltar uma cópia' };
  return barra('Cópias de segurança', { voltar: '/mais', sub: 'Guardadas sozinhas neste aparelho' }) + `<main>
  <div class="aviso lil small">O app guarda uma cópia por dia (até 2 semanas), mais uma sempre que dois aparelhos discordam. Uma cópia vazia nunca apaga uma cheia.</div>
  <div class="card" style="margin-top:12px">${c.copias.length ? c.copias.map((x, i) => `<div class="item"><div class="grow"><b>${new Date(x.em).toLocaleString('pt-BR')}</b><div class="small muted">${esc(x.resumo)} · ${nomeMotivo[x.motivo] || x.motivo}</div></div>
    <div class="row" style="gap:6px"><button class="btn mini ghost" onclick="baixarCopia(${i})">Baixar</button><button class="btn mini" onclick="voltarCopia(${i})">Voltar</button></div></div>`).join('') : '<p class="muted" style="margin:0">Ainda nenhuma cópia.</p>'}</div></main>`;
};
function baixarCopia(i) {
  const x = cofreLer().copias[i]; if (!x) return;
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(x.dados, null, 1)], { type: 'application/json' }));
  a.download = 'dra-ingrid-copia-' + x.dia + '.json'; a.click();
}
function voltarCopia(i) {
  const x = cofreLer().copias[i]; if (!x) return;
  if (!confirm(`Voltar para a cópia de ${new Date(x.em).toLocaleString('pt-BR')}?\n(${x.resumo})\nO que está agora vira mais uma cópia — dá para desfazer.`)) return;
  cofreGuardar('mao', DB); DB = JSON.parse(JSON.stringify(x.dados)); salvar(); go('/'); toast('Cópia restaurada');
}

/* ================= LADO DO TUTOR — de verdade (visitante, sem dado de ninguém) ================= */
const TUTOR_REAL = {};
let agR = { especie: 'Cão', servicos: [] };
const ocupCache = {};
function pubCarregando() { if (PUB === undefined && !pubCarregando.pedido) { pubCarregando.pedido = true; pubCarregar().then(() => route({ manterScroll: true })); } return PUB === undefined; }
TUTOR_REAL.home = () => {
  const carregando = pubCarregando(), p = PUB || {};
  const wa = p.whats ? 'https://wa.me/55' + soDigitos(p.whats).replace(/^55/, '') : '';
  return `<section class="hero" style="text-align:center"><div class="in"><img src="simbolo.png" alt="" style="height:56px"><div class="small" style="margin-top:8px;font-weight:700">Dra. Ingrid Garrocini</div><div class="tiny" style="color:var(--tinta-lil)">Médica-veterinária · atendimento a domicílio${p.crmv ? ' · CRMV ' + esc(p.crmv) : ''}</div><h1 style="margin-top:14px">Cuidado veterinário na sua casa</h1><div class="sub">Vacinas, consultas e check-up sem estresse para o seu pet</div></div></section><main style="max-width:520px">
  <a class="btn full" href="#/t/agendar" style="padding:16px">${ic('calendar')} Marcar uma visita</a>
  <div class="card menu" style="margin-top:14px">
    ${wa ? `<a href="${wa}" target="_blank" rel="noopener"><span class="icm" style="background:var(--verde-2);color:var(--wa)">${ic('message-circle')}</span><span class="grow">Falar no WhatsApp<small>${esc(p.whats)}</small></span>${ic('chevron-right')}</a>` : ''}
    ${p.google ? `<a href="${esc(p.google)}" target="_blank" rel="noopener"><span class="icm">${ic('star')}</span><span class="grow">Avaliar no Google<small>Ajuda outros tutores a me encontrar</small></span>${ic('chevron-right')}</a>` : ''}
    <a href="#/t/agendar"><span class="icm">${ic('syringe')}</span><span class="grow">Vacinas, consultas e check-up<small>${carregando ? 'carregando os valores…' : 'ver serviços e valores'}</small></span>${ic('chevron-right')}</a>
  </div>
  <p class="tiny muted" style="text-align:center;margin-top:16px">A Dra. Ingrid confirma cada visita pelo WhatsApp.</p></main>`;
};
function horariosDoDia(dia) {
  const h = (PUB && PUB.horario) || { ini: '08:00', fim: '19:00', passo: 60 }, slots = [];
  for (let m = minutos(h.ini); m + 60 <= minutos(h.fim); m += h.passo) slots.push(hhmm(m));
  if (!ocupCache[dia]) { ocupCache[dia] = 'carregando'; pubOcupados(dia).then(o => { ocupCache[dia] = o; route({ manterScroll: true }); }); }
  return ocupCache[dia] === 'carregando' ? null : slots.filter(s => !ocupCache[dia].includes(s));
}
TUTOR_REAL.agendar = () => {
  if (pubCarregando()) return barra('Marcar visita', { voltar: '/t' }) + '<main><p class="muted">Carregando…</p></main>';
  if (!PUB) return barra('Marcar visita', { voltar: '/t' }) + '<main style="max-width:520px"><div class="aviso">A agenda online ainda não está aberta (ou a internet caiu). Tente de novo em instantes, ou chame a Dra. Ingrid no WhatsApp.</div><button class="btn ghost full" style="margin-top:12px" onclick="PUB=undefined;pubCarregando.pedido=false;route()">Tentar de novo</button></main>';
  const h = PUB.horario || { dias: [0, 1, 2, 3, 4, 5, 6] };
  const servs = (PUB.tabela || []).filter(x => x.cat !== 'Deslocamento' && (!x.especie || x.especie === 'Ambos' || x.especie === agR.especie));
  agR.servicos = agR.servicos.filter(id => servs.some(s => s.id === id));
  const dias = Array.from({ length: 14 }, (_, i) => isoMais(isoHoje(), i + 1)).filter(d => (h.dias || [0, 1, 2, 3, 4, 5, 6]).includes(diaSemN(d)));
  agR.dia = agR.dia && dias.includes(agR.dia) ? agR.dia : dias[0];
  const livres = horariosDoDia(agR.dia);
  if (livres && !livres.includes(agR.hora)) agR.hora = '';
  const soma = agR.servicos.reduce((s, id) => s + (servs.find(x => x.id === id)?.preco || 0), 0);
  const campo = (id, rot, tipo = 'text', extra = '') => `<label for="ag_${id}">${rot}</label><input id="ag_${id}" type="${tipo}" value="${esc(agR[id] || '')}" oninput="agR.${id}=this.value;ctaAgendar()" ${extra}>`;
  return barra('Marcar visita', { voltar: '/t', sub: 'A Dra. Ingrid confirma pelo WhatsApp' }) + `<main class="com-cta" style="max-width:560px">
  <div class="secao" style="margin-top:4px"><h2>Seus dados</h2></div><div class="card" style="padding-top:2px">
    ${campo('nome', 'Seu nome', 'text', 'autocomplete="name"')}${campo('fone', 'WhatsApp (com DDD)', 'tel', 'autocomplete="tel" inputmode="tel"')}
    ${campo('endereco', 'Endereço da visita', 'text', 'autocomplete="street-address"')}${campo('bairro', 'Bairro')}</div>
  <div class="secao"><h2>Seu pet</h2></div><div class="card" style="padding-top:2px">${campo('animal', 'Nome do pet')}
    <label>É cão ou gato?</label><div class="abas" style="margin:0">${['Cão', 'Gato'].map(e => `<button type="button" class="${agR.especie === e ? 'on' : ''}" aria-pressed="${agR.especie === e}" onclick="agR.especie='${e}';route({manterScroll:true})">${ic(e === 'Gato' ? 'cat' : 'dog', 'sm')} ${e}</button>`).join('')}</div></div>
  <div class="secao"><h2>O que precisa?</h2><span class="small muted">pode marcar mais de um</span></div><div class="card">${servs.map(x => `<label class="preco-lin"><input type="checkbox" ${agR.servicos.includes(x.id) ? 'checked' : ''} onchange="agR.servicos=this.checked?[...agR.servicos,'${x.id}']:agR.servicos.filter(s=>s!=='${x.id}');route({manterScroll:true})"><span>${esc(x.nome)}</span><b>${brl(x.preco)}</b></label>`).join('')}
    <p class="tiny muted" style="margin:8px 0 0">+ taxa de deslocamento, conforme a distância.</p></div>
  <div class="secao"><h2>Qual dia?</h2></div><div class="dias">${dias.map(d => `<button class="${d === agR.dia ? 'on' : ''}" onclick="agR.dia='${d}';agR.hora='';route({manterScroll:true})">${diaSem(d)}<b>${d.slice(8)}</b></button>`).join('')}</div>
  <div class="secao"><h2>Horário</h2></div><div class="sugs">${livres === null ? '<span class="muted small">Vendo os horários livres…</span>' : livres.map(x => `<button aria-pressed="${agR.hora === x}" style="${agR.hora === x ? 'background:var(--tinta);color:#fff;border-color:var(--tinta)' : ''}" onclick="agR.hora='${x}';route({manterScroll:true})">${x}</button>`).join('') || '<span class="muted small">Dia lotado — escolha outro.</span>'}</div>
  <label for="ag_obs">Quer contar algo? (opcional)</label><textarea id="ag_obs" rows="2" oninput="agR.obs=this.value" placeholder="Ex.: está coçando a orelha">${esc(agR.obs || '')}</textarea>
  <p class="tiny muted" style="margin-top:10px">Seus dados vão só para a Dra. Ingrid, para confirmar a visita.</p>
  </main>
  <div class="cta-fixa"><div class="in"><div class="grow"><div class="tiny muted" id="ctaTxt"></div><b style="font-size:18px">${agR.servicos.length ? brl(soma) + ' + desloc.' : '—'}</b></div>
    <button class="btn" id="ctaBtn" onclick="enviarPedido()">Pedir horário</button></div></div>`;
};
TUTOR_REAL.agendar.depois = () => ctaAgendar();
function faltaAgendar() {
  if (!(agR.nome || '').trim()) return 'Falta o seu nome';
  if (soDigitos(agR.fone).length < 10) return 'Falta o WhatsApp com DDD';
  if (!(agR.endereco || '').trim()) return 'Falta o endereço';
  if (!(agR.animal || '').trim()) return 'Falta o nome do pet';
  if (!agR.servicos.length) return 'Escolha o serviço';
  if (!agR.hora) return 'Escolha o horário';
  return '';
}
function ctaAgendar() { const f = faltaAgendar(), b = $('#ctaBtn'), t = $('#ctaTxt'); if (!b) return; b.disabled = !!f; t.textContent = f || `${diaSem(agR.dia)} ${dataCurta(agR.dia)} às ${agR.hora}`; }
async function enviarPedido() {
  if (faltaAgendar()) return;
  const b = $('#ctaBtn'); b.disabled = true; b.textContent = 'Enviando…';
  const d = { nome: agR.nome.trim(), fone: agR.fone.trim(), endereco: agR.endereco.trim(), bairro: (agR.bairro || '').trim(), animal: agR.animal.trim(), especie: agR.especie, servicos: agR.servicos, data: agR.dia, hora: agR.hora, obs: (agR.obs || '').trim() };
  let ok = false; try { ok = await pubPedir(d); } catch (e) { }
  if (!ok) { b.disabled = false; b.textContent = 'Pedir horário'; toast('Não consegui enviar. Confira a internet e tente de novo.'); return; }
  delete ocupCache[d.data];
  const txt = `${SEM_LONGO[diaSemN(d.data)]}, ${dataCurta(d.data)} às ${d.hora}`;
  agR = { especie: 'Cão', servicos: [] };
  $('#app').innerHTML = barra('Pedido enviado', { voltar: '/t' }) + `<main style="max-width:520px"><div class="card" style="text-align:center"><div class="ava xl" style="margin:0 auto;background:var(--verde-2);color:var(--verde)">${ic('check')}</div><h2 style="margin-top:12px">${txt}</h2><p>A Dra. Ingrid recebeu seu pedido e vai confirmar pelo WhatsApp.</p></div><a class="btn ghost full" style="margin-top:14px" href="#/t">Início</a></main>`;
  window.scrollTo(0, 0);
}

/* ---------- partida ---------- */
carregar();
if (MODO_REAL) {
  const volta = authFromHash();                        // link de confirmação ou de senha nova no e-mail
  if (volta && volta.tipo === 'recovery') history.replaceState(null, '', location.pathname + '#/nova-senha');
  nuvIniciar();
  route();
  if (volta && volta.erro) toast('O link do e-mail não valeu: ' + volta.erro);
  if (isLoggedIn() && !(volta && volta.tipo === 'recovery')) nuvCiclo('abertura').then(() => { if (NUV.dona) cofreGuardar('abertura'); if (volta && volta.tipo === 'signup') toast('E-mail confirmado — bem-vinda!'); });
} else route();

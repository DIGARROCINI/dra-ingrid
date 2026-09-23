/* =====================================================
   App da Dra. Ingrid — nuvem (Supabase na conta dela)

   O consultório inteiro é UM documento (tabela `estado`), que só a dona lê
   e grava. A vitrine (`publico`) e os pedidos de horário (`pedidos`) são as
   únicas partes que o tutor toca — e o tutor nunca lê nada de ninguém.

   Regras da fórmula app-um-so que moram aqui:
   - trava inicial: nada é enviado antes de comparar com a nuvem uma vez;
   - conflito é decisão DELA, nunca do código (mostra o que tem de cada lado);
   - sincronia a cada 25 s, ao voltar para o app e quando a internet volta;
   - não redesenha à toa (semMudanca) nem em cima de quem está digitando.
   ===================================================== */
'use strict';

/* ?demo no endereço = só dados de exemplo, sem tocar no banco dela */
const MODO_REAL = !!SUPA_URL && !/[?&]demo\b/.test(location.search);
const NUV_K = 'vetig_nuvem_v1';
const NUV = { ultimo: null, pendente: false, puxou: false, status: 'ok', dona: null, conflito: false };

function nuvLer() { try { const s = JSON.parse(localStorage.getItem(NUV_K)) || {}; NUV.ultimo = s.ultimo || null; NUV.pendente = !!s.pendente; NUV.pubHash = s.pubHash || ''; } catch (e) { } }
function nuvGravar() { try { localStorage.setItem(NUV_K, JSON.stringify({ ultimo: NUV.ultimo, pendente: NUV.pendente, pubHash: NUV.pubHash })); } catch (e) { } }

async function rest(caminho, opts = {}) {
  if (isLoggedIn()) await authEnsure();
  return comPrazo(SUPA_URL + '/rest/v1/' + caminho, {
    ...opts,
    headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + (authToken() || SUPA_KEY), 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
}

/* quanto tem de cada lado — para ela decidir num conflito */
function nuvResumo(d) {
  const q = k => (d && Array.isArray(d[k]) ? d[k].length : 0);
  return `${q('tutores')} clientes · ${q('animais')} animais · ${q('atendimentos')} atendimentos · ${q('lanc')} lançamentos`;
}
function nuvPeso(d) { return ['tutores', 'animais', 'doses', 'agenda', 'atendimentos', 'orcamentos', 'lanc', 'estoque', 'receitas'].reduce((s, k) => s + (d && Array.isArray(d[k]) ? d[k].length : 0), 0); }

/* ---------- puxar ---------- */
async function nuvPuxar() {
  const r = await rest('estado?id=eq.1&select=data,updated_at');
  if (!r.ok) throw new Error('estado ' + r.status);
  const [linha] = await r.json();
  if (!linha) { NUV.dona = false; return 'naoDona'; }   // as regras do banco esconderam: não é a dona
  NUV.dona = true;
  const remotoVazio = !linha.data || !Object.keys(linha.data).length;
  if (remotoVazio) {                                    // primeira vez: sobe o que tem aqui
    NUV.puxou = true; NUV.pendente = true; NUV.ultimo = linha.updated_at; nuvGravar();
    return 'primeiraVez';
  }
  if (linha.updated_at === NUV.ultimo) { NUV.puxou = true; return 'semMudanca'; }
  if (NUV.pendente && NUV.puxou) return nuvConflito(linha);   // mudou lá E aqui
  if (NUV.pendente && !NUV.puxou && nuvPeso(DB) > 0 && JSON.stringify(DB) !== JSON.stringify(linha.data)) return nuvConflito(linha);
  aplicarRemoto(linha);
  return 'aplicou';
}
function aplicarRemoto(linha) {
  DB = linha.data; if (!DB.seedVer) DB.seedVer = SEED_VER;
  salvarLocal();
  NUV.ultimo = linha.updated_at; NUV.pendente = false; NUV.puxou = true; nuvGravar();
}

/* ---------- enviar (só grava se ninguém mudou lá desde a última vez) ---------- */
async function nuvEnviar() {
  if (!NUV.puxou || !NUV.dona || NUV.conflito) return;
  const agora = new Date().toISOString();
  const filtro = NUV.ultimo ? '&updated_at=eq.' + encodeURIComponent(NUV.ultimo) : '';
  const r = await rest('estado?id=eq.1' + filtro, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ data: DB, updated_at: agora }) });
  if (!r.ok) throw new Error('enviar ' + r.status);
  const linhas = await r.json();
  if (!linhas.length) {                                 // alguém gravou antes (outro aparelho)
    const r2 = await rest('estado?id=eq.1&select=data,updated_at');
    const [linha] = await r2.json();
    return nuvConflito(linha);
  }
  NUV.ultimo = linhas[0].updated_at; NUV.pendente = false; nuvGravar();
  return 'enviou';
}

/* ---------- conflito: ela escolhe, e o lado que perde vai para o cofre ---------- */
function nuvConflito(linha) {
  NUV.conflito = true;
  window.__nuvRemoto = linha;
  abrirFolha(`<h2>Mudou nos dois lugares</h2>
    <p class="small muted">Este aparelho e a nuvem têm mudanças diferentes. Escolha qual fica — a outra vai para as cópias de segurança (Mais → Cópias de segurança), nada se perde.</p>
    <div class="card" style="margin-top:10px"><b>Neste aparelho</b><div class="small muted">${nuvResumo(DB)}</div></div>
    <div class="card"><b>Na nuvem</b> <span class="tiny muted">(${new Date(linha.updated_at).toLocaleString('pt-BR')})</span><div class="small muted">${nuvResumo(linha.data)}</div></div>
    <div class="row" style="margin-top:14px"><button class="btn grow" onclick="nuvResolver('nuvem')">Ficar com a da nuvem</button><button class="btn sec grow" onclick="nuvResolver('aqui')">Ficar com a deste aparelho</button></div>`);
  return 'conflito';
}
async function nuvResolver(qual) {
  const linha = window.__nuvRemoto;
  if (qual === 'nuvem') { cofreGuardar('conflito', DB); aplicarRemoto(linha); }
  else { cofreGuardar('conflito', linha.data); NUV.ultimo = linha.updated_at; NUV.pendente = true; NUV.puxou = true; }
  NUV.conflito = false; nuvGravar(); fecharFolha();
  try { await nuvEnviar(); } catch (e) { }
  route({ manterScroll: true }); toast('Pronto — os dois aparelhos iguais de novo');
}

/* ---------- pedidos de horário que chegaram pelo link ---------- */
const soDigitos = s => String(s || '').replace(/\D/g, '');
async function nuvPedidos() {
  const r = await rest('pedidos?status=eq.novo&select=id,criado_em,dados&order=criado_em');
  if (!r.ok) return 0;
  const linhas = await r.json();
  const novos = [];
  for (const p of linhas) {
    if (DB.agenda.some(g => g.pedidoId === p.id)) { novos.push(p.id); continue; }
    const d = p.dados || {};
    const fone = soDigitos(d.fone).slice(-9);
    let t = fone.length >= 8 && DB.tutores.find(x => soDigitos(x.fone).slice(-9) === fone);
    if (!t) { t = { id: uid('t'), nome: d.nome || 'Tutor sem nome', fone: d.fone || '', cpf: '', email: '', endereco: d.endereco || '', bairro: d.bairro || '', faixa: 'd1', origem: 'Link', desde: isoHoje(), provisorio: true }; DB.tutores.push(t); }
    let a = DB.animais.find(x => x.tutorId === t.id && semAcento(x.nome) === semAcento(d.animal));
    if (!a) { a = { id: uid('a'), tutorId: t.id, nome: d.animal || 'Animal', especie: d.especie === 'Gato' ? 'Gato' : 'Cão', raca: 'a confirmar', sexo: '', castrado: false, nasc: '', pesos: [], checkup: null, provisorio: true }; DB.animais.push(a); }
    const [servico, ...extras] = (d.servicos && d.servicos.length ? d.servicos : ['s1']);
    DB.agenda.push({ id: uid('g'), pedidoId: p.id, data: d.data, hora: d.hora, animalId: a.id, servico, extras, status: 'pedido', origem: 'tutor', obs: d.obs || 'Pedido pelo link' });
    novos.push(p.id);
  }
  if (!novos.length) return 0;
  salvarLocal(); NUV.pendente = true; nuvGravar();
  if (await nuvEnviar() !== 'enviou') return 0;              // primeiro guarda na nuvem (se não guardou, o pedido fica lá e volta na próxima rodada)...
  for (const id of novos) await rest('pedidos?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'importado' }) });   // ...depois dá baixa
  return linhas.length;
}

/* ---------- vitrine pública: só o que o tutor pode ver ---------- */
function vitrine() {
  const c = DB.cfg;
  return { nome: c.nome, crmv: c.crmv, whats: c.whats, pix: c.pix, google: c.google, horario: c.horario, tabela: DB.tabela.map(t => ({ id: t.id, nome: t.nome, cat: t.cat, preco: t.preco, vacina: t.vacina || null, especie: t.especie || null, exemplo: !!t.exemplo })) };
}
async function nuvVitrine() {
  const v = vitrine(), h = JSON.stringify(v);
  if (h === NUV.pubHash) return;
  const r = await rest('publico?id=eq.1', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ data: v, updated_at: new Date().toISOString() }) });
  if (r.ok) { NUV.pubHash = h; nuvGravar(); }
}

/* ---------- o ciclo ---------- */
let nuvRodando = false, nuvUltimoCiclo = 0, nuvAgendado = null;
async function nuvCiclo(motivo = '') {
  if (!MODO_REAL || !isLoggedIn() || nuvRodando || NUV.conflito) return;
  if (!navigator.onLine) { nuvStatus('offline'); return; }
  nuvRodando = true; nuvUltimoCiclo = Date.now();
  try {
    const antes = JSON.stringify(DB);
    const res = await nuvPuxar();
    if (res === 'naoDona') { nuvStatus('naoDona'); route(); return; }
    if (res === 'conflito') return;
    const chegaram = await nuvPedidos();
    if (NUV.pendente) await nuvEnviar();
    await nuvVitrine();
    nuvStatus('ok');
    if (JSON.stringify(DB) !== antes && !isBusyEditing()) route({ manterScroll: true });
    if (chegaram) toast(chegaram === 1 ? 'Chegou 1 pedido de horário' : `Chegaram ${chegaram} pedidos de horário`);
  } catch (e) { nuvStatus('erro'); }
  finally { nuvRodando = false; }
}
function nuvAgendarEnvio() {
  if (!MODO_REAL) return;
  NUV.pendente = true; nuvGravar();
  clearTimeout(nuvAgendado);
  nuvAgendado = setTimeout(() => nuvCiclo('salvou'), 1500);
}
function nuvStatus(s) {
  NUV.status = s;
  const f = document.getElementById('faixa');
  if (!f || !MODO_REAL) return;
  const txt = { offline: 'Sem internet — tudo fica guardado neste aparelho e sobe quando a conexão voltar.', erro: 'Não consegui falar com a nuvem agora. Tento de novo sozinho.', naoDona: '' }[s];
  f.style.display = txt ? 'flex' : 'none';
  if (txt) f.innerHTML = `<span>${txt}</span>`;
}
function nuvIniciar() {
  if (!MODO_REAL) return;
  nuvLer();
  setInterval(() => { if (!isBusyEditing()) nuvCiclo('relogio'); }, 25000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - nuvUltimoCiclo > 20000) nuvCiclo('voltou'); });
  window.addEventListener('online', () => nuvCiclo('online'));
  window.addEventListener('offline', () => nuvStatus('offline'));
}

/* ---------- lado do tutor (visitante): vitrine, horários ocupados e pedido ---------- */
let PUB;   // undefined = ainda não carregou · false = vitrine vazia ou sem internet · objeto = vitrine
async function pubCarregar() {
  try { const r = await rest('publico?id=eq.1&select=data'); const [l] = await r.json(); PUB = (l && l.data && l.data.tabela) ? l.data : false; } catch (e) { PUB = false; }
  return PUB;
}
async function pubOcupados(dia) {
  try { const r = await rest('rpc/horarios_ocupados', { method: 'POST', body: JSON.stringify({ dia }) }); return r.ok ? (await r.json()).map(x => x.hora) : []; } catch (e) { return []; }
}
async function pubPedir(dados) {
  const r = await rest('pedidos', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ dados }) });
  return r.ok;
}

/* =====================================================
   App da Dra. Ingrid — Documentos de RT dos mercados
   Ela cadastra cada mercado uma vez (salva sozinho, como o resto do app) e baixa o
   Manual de Boas Práticas e os POPs já preenchidos, em Word (.docx), editáveis.
   Os modelos saem de supabase/rt/modelar.py e moram no depósito privado da sala:
   campos «EM MAIÚSCULAS» grifados e marcadores invisíveis SE_* (trechos que dependem do mercado).
   ===================================================== */
'use strict';

const RT_SETORES = [
  // chave, nome do setor, atividade de produção, o que recebe, equipamentos
  ['acougue', 'açougue', 'fracionamento de carnes no açougue', 'carnes (açougue)', ['serra fita e moedor (açougue)']],
  ['hortifruti', 'hortifrúti', 'manipulação de hortifrúti', 'hortifrúti', []],
  ['padaria', 'padaria', 'panificação', 'insumos de padaria', ['forno (padaria)']],
  ['cozinha', 'cozinha de produção (salgados)', 'produção de salgados na cozinha', 'insumos da cozinha de produção (salgados)', ['coifa e exaustor da cozinha']],
  ['frios', 'fatiamento de frios', 'fatiamento de frios', 'frios para fatiamento', ['fatiador de frios']],
  ['peixaria', 'peixaria', 'manipulação de pescados', 'pescados', []],
  ['camara_resf', 'câmara fria de resfriamento', '', '', ['câmara fria de resfriamento']],
  ['camara_cong', 'câmara fria de congelamento', '', '', ['câmara fria de congelamento']],
  ['estoque', 'estoque', '', '', []],
];
const RT_PRODUCAO = ['acougue', 'padaria', 'cozinha', 'frios', 'peixaria'];
const MESES_RT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/* Os mercados de verdade moram só no banco privado dela (sala ingridvet) — nunca neste código,
   que é público. Aqui só o exemplo fictício da demonstração e do consultório de teste. */
function rtMercadosIniciais() {
  if (MODO_REAL && NUV.eid !== 2) return [];
  return [{ id: uid('m'), nome_fantasia: 'Mercado Exemplo', razao_social: 'Mercado Exemplo Ltda.', cnpj: '00.000.000/0001-00', endereco: 'Rua Exemplo, 100, Centro, Pontal do Paraná – PR', responsavel_legal: 'Fulano de Tal', art_numero: '0000000', art_inicio: isoHoje(), art_fim: isoMais(isoHoje(), 365), versao: '01', data_emissao: isoHoje(), porte: 'Pequeno porte – mercado de bairro', setores: { acougue: true, hortifruti: true, padaria: true, frios: true, camara_resf: true, estoque: true }, fritura: false, autosservico: true, setores_autosservico: 'fatiamento e embalagem de frios e queijos' }];
}
function rtLista() {
  if (!Array.isArray(DB.rtMercados)) { DB.rtMercados = rtMercadosIniciais(); salvar(); }
  return DB.rtMercados;
}
const rtMercado = id => rtLista().find(m => m.id === id);

/* ---------- textos montados a partir dos setores ---------- */
function rtJunta(itens) { const l = itens.filter(Boolean); return l.length <= 1 ? (l[0] || '') : l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1]; }
const rtData = iso => iso ? iso.split('-').reverse().join('/') : '';
function rtMaisUmAno(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return rtData(`${+y + 1}-${m}-${d}`); }
function rtCampos(m) {
  const s = m.setores || {}, ativos = RT_SETORES.filter(([k]) => s[k]);
  const de = i => ativos.map(x => x[i]).filter(Boolean);
  const nomesProducao = ativos.filter(([k]) => RT_PRODUCAO.includes(k)).map(x => x[1]);
  const equip = ['câmara fria de resfriamento', 'câmara fria de congelamento'].filter(e => ativos.some(x => x[4].includes(e)));
  equip.push('balcões refrigerados');
  ativos.forEach(x => x[4].forEach(e => { if (!equip.includes(e)) equip.push(e); }));
  if (m.fritura) equip.push('fritadeira');
  const pops = ['higienização', 'controle de pragas', 'água', 'higiene e saúde dos manipuladores', 'recebimento', 'temperatura', 'resíduos', 'contaminação cruzada', 'calibração de termômetros', 'manutenção preventiva', 'rastreabilidade'];
  if (m.fritura) pops.push('óleo de fritura');
  if (m.autosservico) pops.push('fracionamento em autosserviço');
  const atividadeAuto = m.porte && /pequeno/i.test(m.porte) ? 'Mercado de bairro de pequeno porte' : 'Supermercado';
  const emissao = m.data_emissao || isoHoje(), [ey, em] = emissao.split('-');
  return {
    'NOME FANTASIA': m.nome_fantasia, 'RAZÃO SOCIAL': m.razao_social, 'CNPJ': m.cnpj, 'ENDEREÇO COMPLETO': m.endereco,
    'TELEFONE': m.telefone, 'E-MAIL': m.email, 'ALVARÁ SANITÁRIO Nº E VALIDADE': m.alvara || '[número e validade – anexar cópia]',
    'REGISTRO DO ESTABELECIMENTO NO CRMV-PR': m.registro_crmv,
    'ATIVIDADE': m.atividade || (ativos.length ? `${atividadeAuto}, com ${rtJunta(de(1).filter(x => !/câmara|estoque/.test(x)))}` : ''),
    'PORTE': m.porte, 'RESPONSÁVEL LEGAL': m.responsavel_legal,
    'SUPERVISÃO': m.supervisao || m.responsavel_legal,
    'Nº DA ART': m.art_numero, 'INÍCIO DA ART': rtData(m.art_inicio), 'FIM DA ART': rtData(m.art_fim),
    'VERSÃO': m.versao || '01', 'MÊS/ANO': `${MESES_RT[+em - 1]}/${ey}`, 'DATA DE EMISSÃO': rtData(emissao), 'PRÓXIMA REVISÃO': rtMaisUmAno(emissao),
    'DESCRIÇÃO DA REVISÃO': (m.versao || '01') === '01' ? 'Emissão inicial do manual' : 'Revisão do manual e atualização das referências legais',
    'SETORES': rtJunta(de(1)), 'ATIVIDADES DE PRODUÇÃO': rtJunta(de(2)) || 'manipulação de alimentos',
    'PRODUTOS RECEBIDOS': rtJunta(de(3)) || 'alimentos perecíveis', 'EQUIPAMENTOS': equip.join(', '),
    'SETORES DE PRODUÇÃO': rtJunta(nomesProducao) || 'setores de manipulação',
    'SETORES DE AUTOSSERVIÇO': m.setores_autosservico || 'fatiamento e embalagem de frios, embutidos e queijos',
    'Nº DE POPs': String(11 + (m.fritura ? 1 : 0) + (m.autosservico ? 1 : 0)),
    'LISTA DE POPs': pops.map((p, i) => i ? p : p[0].toUpperCase() + p.slice(1)).join('; '),
    'Nº DO POP DE AUTOSSERVIÇO': m.fritura ? '13' : '12',
    'REF AUTOSSERVIÇO': m.autosservico ? '; Resolução SESA-PR nº 469/2016 (fracionamento de produtos de origem animal em autosserviço)' : '',
  };
}
function rtCondicoes(m) {
  const s = m.setores || {};
  return { FRITURA: !!m.fritura, AUTO: !!m.autosservico, ACOUGUE: !!s.acougue, FORNO: !!(s.padaria || s.cozinha), MODELO: false };
}
/* o que ainda falta para o documento sair completo */
function rtFaltando(m) {
  const f = [];
  [['razao_social', 'razão social'], ['cnpj', 'CNPJ'], ['endereco', 'endereço'], ['responsavel_legal', 'responsável legal'], ['art_numero', 'nº da ART'], ['art_inicio', 'início da ART'], ['art_fim', 'fim da ART']]
    .forEach(([k, n]) => { if (!(m[k] || '').trim()) f.push(n); });
  if (!Object.values(m.setores || {}).some(Boolean)) f.push('setores');
  return f;
}

/* ---------- gerar o .docx a partir do modelo ---------- */
const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function rtProcessarXml(xml, campos, cond) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('modelo com XML inválido');
  // 1) trechos condicionais (marcadores invisíveis SE_* / SO_*)
  for (const ini of [...doc.getElementsByTagNameNS(NS_W, 'bookmarkStart')]) {
    const nome = ini.getAttributeNS(NS_W, 'name') || '', m = nome.match(/^(SE|SO)_([A-Z]+)_\d+$/);
    if (!m || !ini.parentNode) continue;
    const id = ini.getAttributeNS(NS_W, 'id');
    let fim = ini.nextSibling;
    while (fim && !(fim.localName === 'bookmarkEnd' && fim.getAttributeNS(NS_W, 'id') === id)) fim = fim.nextSibling;
    if (!fim) continue;
    const manter = m[1] === 'SE' && !!cond[m[2]];
    if (manter) { ini.remove(); fim.remove(); continue; }
    let n = ini; while (n) { const prox = n.nextSibling; const ultimo = n === fim; n.remove(); if (ultimo) break; n = prox; }
  }
  // 2) campos «…»
  for (const t of [...doc.getElementsByTagNameNS(NS_W, 't')]) {
    const s = t.textContent;
    if (!s.includes('«')) continue;
    const run = t.parentNode, soCampo = /^«[^»]+»$/.test(s);
    let vazio = false, faltou = false;
    let novo = s.replace(/«([^»]+)»/g, (inteiro, k) => {
      if (k === '…') return inteiro;
      if (!(k in campos)) return inteiro;   // campo que este gerador não conhece: fica como está
      let v = campos[k];
      v = String(v || '').trim();
      if (!v && k !== 'REF AUTOSSERVIÇO') { faltou = true; return '[preencher]'; }
      if (!v) vazio = true;
      return v;
    });
    // campo no começo do parágrafo começa com maiúscula
    if (soCampo && novo) {
      let p = run; while (p && p.localName !== 'p') p = p.parentNode;
      const primeiro = p && [...p.getElementsByTagNameNS(NS_W, 't')][0] === t;
      if (primeiro) novo = novo[0].toUpperCase() + novo.slice(1);
    }
    t.textContent = novo;
    if (/^\s|\s$/.test(novo)) t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    if (soCampo && !faltou) {   // preenchido: tira o grifo amarelo (o que falta continua grifado)
      const rpr = [...run.childNodes].find(x => x.localName === 'rPr');
      if (rpr) [...rpr.childNodes].filter(x => x.localName === 'highlight').forEach(x => x.remove());
    }
    if (soCampo && vazio && !novo) run.remove();
  }
  return new XMLSerializer().serializeToString(doc);
}
/* os modelos são trabalho da Ingrid: ficam no depósito PRIVADO da sala (c1/modelos, c2/modelos), não no site */
async function rtModelo(qual) {
  if (!MODO_REAL) throw new Error('na demonstração os documentos não são gerados');
  const caminho = `c${NUV.eid || 1}/modelos/modelo-${qual}.docx`;
  await arqAssinar([caminho]);
  const link = arqLink(caminho);
  if (!link) throw new Error('não consegui buscar o modelo (internet?)');
  const r = await fetch(link);
  if (!r.ok) throw new Error('não achei o modelo');
  return r.arrayBuffer();
}
async function rtGerar(m, qual, modelo) {
  if (typeof JSZip === 'undefined') throw new Error('biblioteca de documentos não carregou (internet?)');
  const bruto = modelo || await rtModelo(qual);
  const zip = await JSZip.loadAsync(bruto);
  const campos = rtCampos(m), cond = rtCondicoes(m);
  for (const nome of Object.keys(zip.files)) {
    if (!/^word\/(document|header\d*|footer\d*)\.xml$/.test(nome)) continue;
    zip.file(nome, rtProcessarXml(await zip.file(nome).async('string'), campos, cond));
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
const rtNomeArquivo = (m, qual) => `${qual === 'manual' ? 'Manual de Boas Práticas' : 'POPs'} – ${(m.nome_fantasia || 'mercado').replace(/[\\/:*?"<>|]/g, '')} – v${m.versao || '01'}.docx`;
async function rtBaixar(id, qual, compartilhar) {
  const m = rtMercado(id); if (!m) return;
  const falta = rtFaltando(m);
  if (falta.length && !confirm(`Ainda falta: ${falta.join(', ')}.\n\nGerar assim mesmo? O que faltar sai como [preencher], grifado em amarelo.`)) return;
  toast('Montando o documento…');
  try {
    const blob = await rtGerar(m, qual), nome = rtNomeArquivo(m, qual);
    const arq = new File([blob], nome, { type: blob.type });
    if (compartilhar && navigator.canShare && navigator.canShare({ files: [arq] })) {
      try { await navigator.share({ files: [arq], title: nome }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    toast('Documento pronto: ' + nome);
  } catch (e) { toast('Não consegui montar o documento: ' + (e.message || e)); }
}

/* ---------- telas ---------- */
function rtVencimento(m) {
  if (!m.art_fim) return '';
  const n = diasAte(m.art_fim);
  return n < 0 ? `<span class="tag coral">ART venceu em ${rtData(m.art_fim)}</span>` : n <= 30 ? `<span class="tag ambar">ART vence em ${n} dias</span>` : `<span class="tag verde">ART até ${rtData(m.art_fim)}</span>`;
}
TELAS.rt = () => {
  const lista = rtLista();
  return barra('Documentos de RT', { voltar: '/mais', sub: 'Manual de Boas Práticas e POPs por mercado', acoes: acaoBtn('plus', 'Novo mercado', 'rtNovo()') }) + `<main>
  ${lista.map(m => { const falta = rtFaltando(m); return `<div class="card">
    <div class="row" style="align-items:flex-start"><div class="grow toca" ${tocavel(`editarMercadoRT('${m.id}')`)}><b>${esc(m.nome_fantasia || 'Mercado sem nome')}</b>
      <div class="small muted">${esc(m.cnpj || 'CNPJ a preencher')}${m.versao ? ' · versão ' + esc(m.versao) : ''}</div>
      <div class="row wrap" style="margin-top:6px;gap:6px">${rtVencimento(m)}${m.fritura ? '<span class="tag">fritura</span>' : ''}${m.autosservico ? '<span class="tag azul">autosserviço</span>' : ''}${falta.length ? `<span class="tag ambar">falta: ${esc(falta.slice(0, 3).join(', '))}${falta.length > 3 ? '…' : ''}</span>` : ''}</div></div>
      <button class="btn mini ghost editar" onclick="editarMercadoRT('${m.id}')">${ic('pencil', 'sm')} Dados</button></div>
    <div class="row wrap" style="margin-top:12px;gap:8px">
      <button class="btn mini" onclick="rtBaixar('${m.id}','manual')">${ic('file-text', 'sm')} Manual (.docx)</button>
      <button class="btn mini" onclick="rtBaixar('${m.id}','pops')">${ic('clipboard-list', 'sm')} POPs (.docx)</button>
      ${navigator.share ? `<button class="btn mini ghost" onclick="rtBaixar('${m.id}','manual',true)">${ic('send', 'sm')} Enviar Manual</button><button class="btn mini ghost" onclick="rtBaixar('${m.id}','pops',true)">${ic('send', 'sm')} Enviar POPs</button>` : ''}
    </div></div>`; }).join('')}
  <div class="aviso lil small" style="margin-top:12px">Os documentos saem em Word, prontos para revisar e assinar. O que faltar aparece como <b>[preencher]</b>, grifado em amarelo. Itens entre colchetes [ ] são para ajustar à rotina de cada mercado.
  Normas conferidas em 11/2026: RDC Anvisa 216/2004, 275/2002, 727/2022 (rotulagem), 655/2022 (recolhimento), Portaria GM/MS 888/2021 (água), Código de Saúde do Paraná e, no autosserviço, Resolução SESA-PR 469/2016.</div>
  </main>`;
};
function rtNovo() {
  const m = { id: uid('m'), nome_fantasia: '', versao: '01', data_emissao: isoHoje(), setores: {}, fritura: false, autosservico: false };
  comDesfazer('Mercado novo', () => rtLista().push(m)); route({ manterScroll: true }); editarMercadoRT(m.id);
}
function editarMercadoRT(id) {
  const m = rtMercado(id); if (!m) return;
  abrirFicha('Dados do mercado', () => rtMercado(id), [
    { sep: 'Identificação' },
    { k: 'nome_fantasia', rot: 'Nome fantasia', obrig: true },
    { k: 'razao_social', rot: 'Razão social' },
    { k: 'cnpj', rot: 'CNPJ', meia: true }, { k: 'registro_crmv', rot: 'Registro no CRMV-PR', meia: true },
    { k: 'endereco', rot: 'Endereço completo' },
    { k: 'telefone', rot: 'Telefone', tipo: 'tel', meia: true }, { k: 'email', rot: 'E-mail', meia: true },
    { k: 'alvara', rot: 'Alvará sanitário (nº e validade)' },
    { k: 'responsavel_legal', rot: 'Responsável legal', meia: true }, { k: 'porte', rot: 'Porte', meia: true, dica: 'Pequeno porte – mercado de bairro' },
    { k: 'supervisao', rot: 'Quem cuida das Boas Práticas no dia a dia', dica: 'vazio = o responsável legal' },
    { k: 'atividade', rot: 'Descrição da atividade', tipo: 'area', linhas: 2, dica: 'vazio = o app monta pelos setores' },
    { sep: 'ART e versão do documento' },
    { k: 'art_numero', rot: 'Nº da ART', meia: true }, { k: 'versao', rot: 'Versão', meia: true },
    { k: 'art_inicio', rot: 'ART — início', tipo: 'date', meia: true }, { k: 'art_fim', rot: 'ART — fim', tipo: 'date', meia: true },
    { k: 'data_emissao', rot: 'Data de emissão do documento', tipo: 'date' },
    { sep: 'Setores do mercado' },
    ...RT_SETORES.map(([k, nome]) => ({ k: 'setores.' + k, rot: nome[0].toUpperCase() + nome.slice(1), tipo: 'check' })),
    { sep: 'Situações que mudam o documento' },
    { k: 'fritura', rot: 'Frita salgados ou outros alimentos (entra o POP de óleo de fritura e o Anexo F)', tipo: 'check' },
    { k: 'autosservico', rot: 'Fraciona e embala frios, queijos ou outros produtos de origem animal SEM o cliente presente — autosserviço (entra o POP da Res. SESA-PR 469/2016)', tipo: 'check' },
    { k: 'setores_autosservico', rot: 'O que é fracionado no autosserviço', dica: 'ex.: fatiamento e embalagem de frios e queijos' },
  ], { sub: 'Salva sozinho. Depois é só baixar o Manual e os POPs.',
       rodape: botaoApagar('Apagar este mercado', `apagarComDesfazer('Mercado apagado',()=>{DB.rtMercados=DB.rtMercados.filter(x=>x.id!=='${id}')},'Apagar este mercado dos documentos de RT?')`) });
}
if (/^#\/rt/.test(location.hash)) route();   // abriu direto em #/rt antes deste arquivo carregar

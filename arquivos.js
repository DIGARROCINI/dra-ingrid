/* =====================================================
   App da Dra. Ingrid — fotos e arquivos do prontuário
   Supabase Storage na conta DELA, bucket PRIVADO "arquivos" (supabase/ARQUIVOS.sql).
     c<consultório>/a/<animal>/<id>.<ext>      → enviados pela equipe
     c<consultório>/envio/<token>/<id>.<ext>   → enviados pelo tutor pelo link
   Nada é público: para mostrar, o app pede links assinados que valem 1 hora.
   Na demonstração (?demo) as fotos ficam só na memória desta aba.
   ===================================================== */
'use strict';

const ARQ_BUCKET = 'arquivos';
const ARQ_URL = {};     // caminho → { url, ate }
const ARQ_LOCAL = {};   // demonstração: caminho → objectURL

function arqCabecalho(tipo) {
  return { apikey: SUPA_KEY, Authorization: 'Bearer ' + (authToken() || SUPA_KEY), ...(tipo ? { 'Content-Type': tipo } : {}) };
}
async function arqRede(url, opts, prazo = 60000) {   // envio de foto com sinal fraco demora: prazo maior que o resto
  const c = new AbortController(), t = setTimeout(() => c.abort(), prazo);
  try { return await fetch(url, { ...opts, signal: c.signal }); } finally { clearTimeout(t); }
}

/* foto do celular tem 3–8 MB: reduz para ~1600 px em JPEG antes de subir */
async function comprimir(arquivo, lado = 1600) {
  if (!/^image\//.test(arquivo.type || '')) return arquivo;
  try {
    const bmp = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
    const k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    const b = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.82));
    return b && b.size < arquivo.size ? b : arquivo;
  } catch (e) { return arquivo; }                    // formato que o navegador não abre (ex.: HEIC): sobe o original
}
function extDe(mime) { return mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : /hei[cf]/.test(mime || '') ? 'heic' : 'jpg'; }
const ehPdf = x => (x.mime || '') === 'application/pdf' || /\.pdf$/i.test(x.caminho || '');

async function arqEnviar(caminho, blob) {
  if (!MODO_REAL) { ARQ_LOCAL[caminho] = URL.createObjectURL(blob); return; }
  if (isLoggedIn()) await authEnsure();
  const r = await arqRede(`${SUPA_URL}/storage/v1/object/${ARQ_BUCKET}/${caminho}`, {
    method: 'POST', body: blob,
    headers: { ...arqCabecalho(blob.type || 'application/octet-stream'), 'x-upsert': 'false', 'cache-control': '31536000' },
  });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.message || j.error || ('erro ' + r.status)); }
}
/* pede de uma vez os links de tudo que vai aparecer; devolve true se chegou link novo */
async function arqAssinar(caminhos) {
  const agora = Date.now();
  const falta = [...new Set((caminhos || []).filter(c => c && !ARQ_LOCAL[c] && !(ARQ_URL[c] && ARQ_URL[c].ate > agora + 60000)))];
  if (!falta.length || !MODO_REAL || !isLoggedIn()) return false;
  try {
    await authEnsure();
    const r = await arqRede(`${SUPA_URL}/storage/v1/object/sign/${ARQ_BUCKET}`, { method: 'POST', headers: arqCabecalho('application/json'), body: JSON.stringify({ expiresIn: 3600, paths: falta.slice(0, 300) }) }, 15000);
    if (!r.ok) return false;
    let novo = false;
    (await r.json()).forEach(x => { if (x.signedURL) { ARQ_URL[x.path] = { url: SUPA_URL + '/storage/v1' + x.signedURL, ate: agora + 3500000 }; novo = true; } });
    return novo;
  } catch (e) { return false; }
}
const arqLink = c => ARQ_LOCAL[c] || (ARQ_URL[c] && ARQ_URL[c].url) || '';
async function arqApagar(caminho) {
  if (!MODO_REAL) { delete ARQ_LOCAL[caminho]; return; }
  await authEnsure();
  await arqRede(`${SUPA_URL}/storage/v1/object/${ARQ_BUCKET}`, { method: 'DELETE', headers: arqCabecalho('application/json'), body: JSON.stringify({ prefixes: [caminho] }) }, 15000);
}
async function arqListar(prefixo) {
  try {
    const r = await arqRede(`${SUPA_URL}/storage/v1/object/list/${ARQ_BUCKET}`, { method: 'POST', headers: arqCabecalho('application/json'), body: JSON.stringify({ prefix: prefixo, limit: 100, offset: 0, sortBy: { column: 'created_at', order: 'asc' } }) }, 15000);
    return r.ok ? (await r.json()).filter(o => o.name && !o.name.startsWith('.')) : [];
  } catch (e) { return []; }
}
/* abre a câmera ou a galeria — precisa ser chamado direto do toque (o navegador exige) */
function escolherArquivos({ camera = false, multiplo = true, aceitar = 'image/*,application/pdf' } = {}) {
  return new Promise(res => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = camera ? 'image/*' : aceitar; i.multiple = multiplo && !camera;
    if (camera) i.setAttribute('capture', 'environment');
    i.onchange = () => res([...i.files]);
    i.click();
  });
}

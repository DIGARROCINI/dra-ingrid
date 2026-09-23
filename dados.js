/* Dados de exemplo do protótipo. Datas relativas a hoje, para a demonstração nunca envelhecer.
   Valores marcados com exemplo:true NÃO vieram da Ingrid — aparecem com a etiqueta "exemplo". */

const SEED_VER = 3;

function seedDB() {
  const d = n => isoMais(isoHoje(), n);
  const id = (() => { let i = 0; return p => p + (++i); })();

  const tutores = [
    { id: 't1', nome: 'Carla Mendes', fone: '(41) 90000-0001', email: 'carla@exemplo.com', cpf: '000.000.000-01', endereco: 'Rua das Araucárias, 120', bairro: 'Água Verde', faixa: 'd1', origem: 'WhatsApp', desde: d(-420) },
    { id: 't2', nome: 'Roberto Almeida', fone: '(41) 90000-0002', email: '', cpf: '', endereco: 'Av. República, 880 ap 42', bairro: 'Rebouças', faixa: 'd1', origem: 'Instagram', desde: d(-200) },
    { id: 't3', nome: 'Juliana Prado', fone: '(41) 90000-0003', email: 'ju@exemplo.com', cpf: '', endereco: 'Rua Holanda, 55', bairro: 'Bacacheri', faixa: 'd2', origem: 'Indicação', desde: d(-90) },
    { id: 't4', nome: 'Marcos Tavares', fone: '(41) 90000-0004', email: '', cpf: '', endereco: 'Rua XV de Novembro, 3000', bairro: 'Alto da XV', faixa: 'd1', origem: 'WhatsApp', desde: d(-35) },
    { id: 't5', nome: 'Helena Costa', fone: '(41) 90000-0005', email: 'helena@exemplo.com', cpf: '', endereco: 'Rua Pará, 410', bairro: 'Santa Felicidade', faixa: 'd3', origem: 'Instagram', desde: d(-610) },
    { id: 't6', nome: 'Paulo Nogueira', fone: '(41) 90000-0006', email: '', cpf: '', endereco: 'Rua Chile, 77', bairro: 'Portão', faixa: 'd2', origem: 'WhatsApp', desde: d(-15) },
  ];

  const animais = [
    { id: 'a1', tutorId: 't1', nome: 'Thor', especie: 'Cão', raca: 'Golden Retriever', sexo: 'Macho', castrado: true, nasc: d(-365 * 4), pesos: [{ data: d(-300), kg: 31.2 }, { data: d(-120), kg: 32.0 }], checkup: d(9) },
    { id: 'a2', tutorId: 't1', nome: 'Mia', especie: 'Gato', raca: 'SRD', sexo: 'Fêmea', castrado: true, nasc: d(-365 * 2), pesos: [{ data: d(-120), kg: 3.8 }], checkup: d(120) },
    { id: 'a3', tutorId: 't2', nome: 'Pipoca', especie: 'Cão', raca: 'Shih-tzu', sexo: 'Fêmea', castrado: false, nasc: d(-70), pesos: [{ data: d(-21), kg: 1.4 }], checkup: null },
    { id: 'a4', tutorId: 't3', nome: 'Bento', especie: 'Cão', raca: 'Border Collie', sexo: 'Macho', castrado: false, nasc: d(-365 * 6), pesos: [{ data: d(-380), kg: 19.5 }], checkup: d(-20) },
    { id: 'a5', tutorId: 't4', nome: 'Luna', especie: 'Gato', raca: 'Siamês', sexo: 'Fêmea', castrado: false, nasc: d(-80), pesos: [{ data: d(-35), kg: 1.1 }], checkup: null },
    { id: 'a6', tutorId: 't5', nome: 'Fred', especie: 'Cão', raca: 'Buldogue Francês', sexo: 'Macho', castrado: true, nasc: d(-365 * 8), pesos: [{ data: d(-150), kg: 12.8 }], checkup: d(4) },
    { id: 'a7', tutorId: 't5', nome: 'Nina', especie: 'Gato', raca: 'Persa', sexo: 'Fêmea', castrado: true, nasc: d(-365 * 10), pesos: [{ data: d(-150), kg: 4.2 }], checkup: d(40) },
    { id: 'a8', tutorId: 't6', nome: 'Zeca', especie: 'Cão', raca: 'SRD', sexo: 'Macho', castrado: false, nasc: d(-365 * 1), pesos: [{ data: d(-15), kg: 14.0 }], checkup: null },
  ];

  const doses = [];
  const dose = (animalId, vacina, protocolo, n, total, data, status, lote) =>
    doses.push({ id: id('v'), animalId, vacina, protocolo, n, total, data, status, lote: lote || '' });
  // Thor: anual V10 e antirrábica — V10 vence em 6 dias
  dose('a1', 'V10', 'anual', 1, 1, d(-359), 'aplicada', 'L2291');
  dose('a1', 'V10', 'anual', 1, 1, d(6), 'programada');
  dose('a1', 'Antirrábica', 'anual', 1, 1, d(-300), 'aplicada', 'R881');
  dose('a1', 'Antirrábica', 'anual', 1, 1, d(65), 'programada');
  // Mia: V5 anual em dia
  dose('a2', 'V5', 'anual', 1, 1, d(-120), 'aplicada', 'F310');
  dose('a2', 'V5', 'anual', 1, 1, d(245), 'programada');
  // Pipoca: filhote V8, 1ª feita, 2ª vence hoje+0 (atrasada 1 dia)
  dose('a3', 'V8', 'filhote', 1, 3, d(-22), 'aplicada', 'L2291');
  dose('a3', 'V8', 'filhote', 2, 3, d(-1), 'programada');
  dose('a3', 'V8', 'filhote', 3, 3, d(20), 'programada');
  // Bento: V10 atrasada há 18 dias
  dose('a4', 'V10', 'anual', 1, 1, d(-383), 'aplicada', 'L1150');
  dose('a4', 'V10', 'anual', 1, 1, d(-18), 'programada');
  // Luna: filhote V4, 2ª em 11 dias
  dose('a5', 'V4', 'filhote', 1, 3, d(-10), 'aplicada', 'F298');
  dose('a5', 'V4', 'filhote', 2, 3, d(11), 'programada');
  dose('a5', 'V4', 'filhote', 3, 3, d(32), 'programada');
  // Fred e Nina
  dose('a6', 'V10', 'anual', 1, 1, d(-150), 'aplicada', 'L2002');
  dose('a6', 'V10', 'anual', 1, 1, d(215), 'programada');
  dose('a7', 'V5', 'anual', 1, 1, d(-340), 'aplicada', 'F201');
  dose('a7', 'V5', 'anual', 1, 1, d(25), 'programada');
  // Zeca: antirrábica vence em 3 dias
  dose('a8', 'Antirrábica', 'anual', 1, 1, d(-362), 'aplicada', 'R640');
  dose('a8', 'Antirrábica', 'anual', 1, 1, d(3), 'programada');

  const agenda = [
    { id: 'g1', data: d(0), hora: '09:00', animalId: 'a6', servico: 's3', status: 'confirmado', origem: 'ingrid', obs: 'Check-up anual + exames de sangue' },
    { id: 'g2', data: d(0), hora: '11:00', animalId: 'a3', servico: 'v8', status: 'confirmado', origem: 'tutor', obs: '2ª dose do protocolo filhote' },
    { id: 'g3', data: d(0), hora: '15:30', animalId: 'a4', servico: 's1', status: 'confirmado', origem: 'tutor', obs: 'Coçando muito a orelha' },
    { id: 'g4', data: d(1), hora: '10:00', animalId: 'a1', servico: 'v10', status: 'pedido', origem: 'tutor', obs: 'Pedido pelo link' },
    { id: 'g5', data: d(2), hora: '14:00', animalId: 'a8', servico: 'raiva', status: 'pedido', origem: 'tutor', obs: 'Pedido pelo link' },
    { id: 'g6', data: d(3), hora: '09:30', animalId: 'a5', servico: 's1', status: 'confirmado', origem: 'ingrid', obs: '' },
    { id: 'g7', data: d(-1), hora: '16:00', animalId: 'a2', servico: 's1', status: 'feito', origem: 'tutor', obs: '' },
  ];

  const atendimentos = [
    { id: 'at1', animalId: 'a2', data: d(-1), tipo: 'Consulta domiciliar', resumo: 'Vômito ocasional, bola de pelo. Orientado manejo com pasta.', campos: { queixa: 'Vômito 2x na semana', alimentacao: 'Ração seca premium', temperatura: '38,6', fc: '180', fr: '28', suspeita: 'Tricobezoar', tratamento: 'Pasta de malte 3x/semana, escovação diária' } },
    { id: 'at2', animalId: 'a1', data: d(-120), tipo: 'Consulta domiciliar', resumo: 'Otite leve em orelha esquerda.', campos: { queixa: 'Balançando a cabeça', suspeita: 'Otite externa', tratamento: 'Limpeza + otológico 7 dias' } },
    { id: 'at3', animalId: 'a3', data: d(-22), tipo: 'Vacinação', resumo: '1ª dose V8. Filhote ativo, sem alterações.', campos: {} },
  ];

  const orcamentos = [
    { id: 'o1', tutorId: 't1', animalId: 'a2', data: d(-1), itens: [{ tab: 's1', qtd: 1 }, { tab: 'd1', qtd: 1 }], status: 'aprovado', forma: 'pix' },
    { id: 'o2', tutorId: 't6', animalId: 'a8', data: d(0), itens: [{ tab: 'raiva', qtd: 1 }, { tab: 'd2', qtd: 1 }], status: 'enviado', forma: '' },
  ];

  const lanc = [];
  const l = (dias, tipo, cat, desc, valor, forma) => lanc.push({ id: id('f'), data: d(dias), tipo, cat, desc, valor, forma });
  l(-2, 'entrada', 'Vacinas', 'V10 — Fred', 150, 'cartao');
  l(-3, 'entrada', 'Consultas', 'Consulta — Nina', 180, 'pix');
  l(-5, 'entrada', 'Vacinas', 'V8 1ª dose — Pipoca', 130, 'pix');
  l(-6, 'entrada', 'Deslocamento', 'Deslocamento — Água Verde', 30, 'pix');
  l(-8, 'entrada', 'Vacinas', 'Antirrábica — Bento', 90, 'cartao');
  l(-9, 'entrada', 'Consultas', 'Consulta — Luna', 180, 'pix');
  l(-4, 'saida', 'Compra de vacinas', 'Distribuidora — 10 V10 + 10 V8', 980, 'pix');
  l(-7, 'saida', 'Combustível', 'Posto', 220, 'cartao');
  l(-10, 'saida', 'Insumos', 'Seringas, agulhas, luvas', 145, 'cartao');

  const estoque = [
    { id: 'e1', nome: 'V10', tipo: 'Vacina', lote: 'L2291', validade: d(140), qtd: 8, min: 4, custo: 52 },
    { id: 'e2', nome: 'V8', tipo: 'Vacina', lote: 'L2291', validade: d(140), qtd: 3, min: 4, custo: 45 },
    { id: 'e3', nome: 'V5 (felina)', tipo: 'Vacina', lote: 'F310', validade: d(25), qtd: 2, min: 2, custo: 68 },
    { id: 'e4', nome: 'V4 (felina)', tipo: 'Vacina', lote: 'F298', validade: d(200), qtd: 5, min: 2, custo: 55 },
    { id: 'e5', nome: 'Antirrábica', tipo: 'Vacina', lote: 'R881', validade: d(300), qtd: 12, min: 5, custo: 18 },
    { id: 'e6', nome: 'Meloxicam 0,2% injetável', tipo: 'Medicamento', lote: 'M77', validade: d(12), qtd: 1, min: 1, custo: 40 },
    { id: 'e7', nome: 'Seringa 3 ml', tipo: 'Insumo', lote: '', validade: '', qtd: 60, min: 30, custo: 0.6 },
    { id: 'e8', nome: 'Luva de procedimento (cx)', tipo: 'Insumo', lote: '', validade: '', qtd: 1, min: 2, custo: 38 },
  ];

  return {
    seedVer: SEED_VER,
    cfg: {
      nome: 'Dra. Ingrid Garrocini Nascimento', crmv: '24240 PR', mapa: '', whats: '', pix: '', google: '',
      horario: { dias: [0, 1, 2, 3, 4, 5, 6], ini: '08:00', fim: '19:00', passo: 60 },
      receitaSeq: 0,
    },
    tabela: [
      { id: 'v8', nome: 'Vacina V8', cat: 'Vacinas', preco: 130, vacina: 'V8', especie: 'Cão' },
      { id: 'v10', nome: 'Vacina V10', cat: 'Vacinas', preco: 150, vacina: 'V10', especie: 'Cão' },
      { id: 'v4', nome: 'Vacina V4 (felina)', cat: 'Vacinas', preco: 140, vacina: 'V4', especie: 'Gato' },
      { id: 'v5', nome: 'Vacina V5 (felina)', cat: 'Vacinas', preco: 160, vacina: 'V5', especie: 'Gato' },
      { id: 'raiva', nome: 'Vacina antirrábica', cat: 'Vacinas', preco: 90, vacina: 'Antirrábica', especie: 'Ambos' },
      { id: 's1', nome: 'Consulta domiciliar', cat: 'Serviços', preco: 180, exemplo: true },
      { id: 's2', nome: 'Retorno', cat: 'Serviços', preco: 90, exemplo: true },
      { id: 's3', nome: 'Check-up (avaliação periódica)', cat: 'Serviços', preco: 220, exemplo: true },
      { id: 'd1', nome: 'Deslocamento até 5 km', cat: 'Deslocamento', preco: 30, exemplo: true },
      { id: 'd2', nome: 'Deslocamento 5 a 10 km', cat: 'Deslocamento', preco: 50, exemplo: true },
      { id: 'd3', nome: 'Deslocamento acima de 10 km', cat: 'Deslocamento', preco: 80, exemplo: true },
    ],
    protocolos: [
      { id: 'filhote', nome: 'Protocolo de filhote', doses: 3, intervalo: 21, depois: 'anual' },
      { id: 'anual', nome: 'Protocolo anual', doses: 1, intervalo: 365, depois: 'anual' },
    ],
    checkupMeses: 12,
    formulario: [
      {
        nome: 'Meloxicam', classe: 'Anti-inflamatório não esteroidal (AINE)', receita: 'Receita simples',
        vias: 'IV (cães) · oral (cães e gatos) · SC (cães e gatos)',
        doses: { 'Cão': { min: 0.1, max: 0.2, duracao: 'máximo 14 dias' }, 'Gato': { min: 0.1, max: 0.1, duracao: 'máximo 4 dias' } },
        fonte: 'https://vetsmart.com.br/cg/produto/2038/meloxicam', conferido: '2026-09-22',
      },
    ],
    tutores, animais, doses, agenda, atendimentos, orcamentos, lanc, estoque,
    receitas: [], avaliacoes: [{ id: 'av1', tutorId: 't5', nota: 5, texto: 'Atendimento em casa salvou o Fred do estresse!', data: d(-30) }],
    avisos: {},
  };
}

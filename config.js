/* Endereço do banco da Dra. Ingrid: SALA 'ingridvet' no projeto Pro da Ti Artes
   (APP gestão TI ARTES). Projeto pago não pausa — o grátis dela pausava sozinho.
   A chave abaixo é a PÚBLICA ("publishable"): foi feita para ir dentro do site.
   Quem protege os dados são as regras do banco (supabase/SALA-INGRIDVET.sql).
   Abrir o app com ?demo no endereço usa só dados de exemplo, sem tocar no banco. */
const APP_CONFIG = {
  supabaseUrl: 'https://uopfqlogjzuqpabptxkb.supabase.co',
  supabaseKey: 'sb_publishable_VKIdd2RNpMf3e4IEDprxJw_TOKPIHT2',
  sala: 'ingridvet',                 // schema dela no projeto (Accept-/Content-Profile)
  bucket: 'ingridvet-arquivos',      // fotos e exames (privado)
  funcao: 'assistente-vet',          // assistente com IA
  emailsDeLogin: false,              // o projeto não manda e-mail de senha para cliente
};

export const ETAPAS = [
  "novo",
  "qualificado",
  "contatado",
  "respondeu",
  "reuniao",
  "ganho",
  "perdido",
  "descartado",
] as const;
export type Etapa = (typeof ETAPAS)[number];

export const ROTULO_ETAPA: Record<Etapa, string> = {
  novo: "Novo",
  qualificado: "Qualificado",
  contatado: "Contatado",
  respondeu: "Respondeu",
  reuniao: "Reunião",
  ganho: "Ganho",
  perdido: "Perdido",
  descartado: "Descartado",
};

export type Lead = {
  id: string;
  nome: string;
  escritorio: string | null;
  areas_atuacao: string[];
  oab: string | null;
  telefone: string | null;
  whatsapp_valido: boolean | null;
  email: string | null;
  site: string | null;
  cidade: string | null;
  uf: string | null;
  endereco: string | null;
  avaliacao: number | null;
  total_avaliacoes: number | null;
  origem: string;
  origem_id: string | null;
  etapa: Etapa;
  score: number | null;
  motivo_score: string | null;
  opt_out: boolean;
  proximo_contato_em: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type Mensagem = {
  id: string;
  lead_id: string;
  canal: "whatsapp" | "email" | "nota";
  direcao: "saida" | "entrada";
  assunto: string | null;
  corpo: string;
  status: string;
  enviada_em: string | null;
  criado_em: string;
};

export type Atividade = {
  id: string;
  lead_id: string;
  tipo: string;
  descricao: string;
  autor: string;
  criado_em: string;
};

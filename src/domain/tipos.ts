import type { Centavos } from './dinheiro';
import type { DataISO } from './datas';
import type { ParametrosEncargos } from './encargos';

export interface Cliente {
  id: string;
  nome: string;
  documento: string;
  contato: string;
  telefone: string;
  email: string;
  contrato: string;
  plano: string;
}

/** Situação gravada. "vencido" e "em conferência" são derivados (data-base e comprovantes). */
export type SituacaoTitulo = 'em_aberto' | 'pago' | 'disputado';
export type StatusTitulo = 'a_vencer' | 'vencido' | 'em_conferencia' | 'pago' | 'disputado';

export interface Titulo {
  id: string;
  clienteId: string;
  numero: string;
  competencia: string;
  valor: Centavos;
  vencimento: DataISO;
  situacao: SituacaoTitulo;
  linhaDigitavel: string;
  pagoEm?: DataISO;
  valorPago?: Centavos;
}

export interface EtapaRegua {
  id: string;
  nome: string;
  /** Dias em relação ao vencimento (negativo = antes). */
  offset: number;
  hora: string;
  filaHumana: boolean;
  ativa: boolean;
  modelo: string;
}

export type StatusMensagem = 'pendente' | 'aprovada' | 'rejeitada' | 'adiada' | 'cancelada';

export interface EventoHistorico {
  em: string;
  por: string;
  acao: string;
  nota?: string;
}

export interface Mensagem {
  id: string;
  chave: string;
  tituloId: string;
  clienteId: string;
  etapaId: string;
  filaHumana: boolean;
  texto: string;
  status: StatusMensagem;
  agendadaPara: string;
  historico: EventoHistorico[];
}

export type EstadoComprovante =
  | 'recebido'
  | 'em_conferencia'
  | 'agendado'
  | 'divergente'
  | 'duplicado'
  | 'credito_confirmado'
  | 'baixa_registrada'
  | 'rejeitado';

export interface Comprovante {
  id: string;
  recebidoEm: string;
  canal: string;
  pagador: string;
  valor: Centavos;
  dataPagamento: DataISO;
  tipo: 'efetivado' | 'agendado';
  endToEndId: string;
  banco: string;
  estado: EstadoComprovante;
  tituloId: string | null;
  creditoConferido: boolean;
  terceiro: boolean;
  terceiroValidado: boolean;
  divergenciaAceita: boolean;
  notas: string[];
}

export type Perfil = 'operador' | 'supervisor' | 'consulta';

export interface RegistroAuditoria {
  id: string;
  em: string;
  usuario: string;
  acao: string;
  alvo: string;
  detalhe?: string;
  bloqueado?: boolean;
}

export interface Configuracao {
  encargos: ParametrosEncargos;
  regua: EtapaRegua[];
  /** Cliente com N+ títulos vencidos vai para fila humana agrupada. */
  limiteTitulosFila: number;
  nomeEmpresa: string;
}

export interface Estado {
  versao: 1;
  dataBase: DataISO;
  perfil: Perfil;
  config: Configuracao;
  clientes: Cliente[];
  titulos: Titulo[];
  mensagens: Mensagem[];
  comprovantes: Comprovante[];
  auditoria: RegistroAuditoria[];
  seq: number;
}

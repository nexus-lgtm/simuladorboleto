import type { EstadoComprovante, StatusMensagem, StatusTitulo } from '../domain/tipos';
import type { Tom } from './components/ui';

export const STATUS_TITULO: Record<StatusTitulo, { rotulo: string; tom: Tom }> = {
  a_vencer: { rotulo: 'A vencer', tom: 'azul' },
  vencido: { rotulo: 'Vencido', tom: 'vermelho' },
  em_conferencia: { rotulo: 'Em conferência', tom: 'ambar' },
  pago: { rotulo: 'Pago', tom: 'verde' },
  disputado: { rotulo: 'Em disputa', tom: 'roxo' },
};

export const STATUS_MENSAGEM: Record<StatusMensagem, { rotulo: string; tom: Tom }> = {
  pendente: { rotulo: 'Pendente', tom: 'ambar' },
  aprovada: { rotulo: 'Aprovada', tom: 'verde' },
  rejeitada: { rotulo: 'Rejeitada', tom: 'vermelho' },
  adiada: { rotulo: 'Adiada', tom: 'cinza' },
  cancelada: { rotulo: 'Cancelada', tom: 'cinza' },
};

export const ESTADO_COMPROVANTE: Record<EstadoComprovante, { rotulo: string; tom: Tom }> = {
  recebido: { rotulo: 'Recebido', tom: 'azul' },
  em_conferencia: { rotulo: 'Em conferência', tom: 'ambar' },
  agendado: { rotulo: 'Agendamento', tom: 'roxo' },
  divergente: { rotulo: 'Divergente', tom: 'vermelho' },
  duplicado: { rotulo: 'Duplicado', tom: 'vermelho' },
  credito_confirmado: { rotulo: 'Crédito confirmado', tom: 'verde' },
  baixa_registrada: { rotulo: 'Baixa registrada', tom: 'verde' },
  rejeitado: { rotulo: 'Rejeitado', tom: 'cinza' },
};

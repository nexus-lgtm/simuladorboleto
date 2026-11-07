// Motor de regras puro: recebe estado + ação e devolve o novo estado. Toda ação (inclusive bloqueada) é auditada.
import { brl } from '../domain/dinheiro';
import { type DataISO, ehDataISO } from '../domain/datas';
import {
  ehDuplicado,
  finalizado,
  podeConfirmarCredito,
  podeRegistrarBaixa,
  valorConfere,
} from '../domain/conciliacao';
import { ETAPA_AGRUPADA, ESTADOS_QUE_PAUSAM, proporMensagens, statusTitulo } from '../domain/regua';
import type { Comprovante, Configuracao, Estado, Mensagem, Perfil, Titulo } from '../domain/tipos';

export const PERFIS: Record<Perfil, string> = {
  operador: 'Operador',
  supervisor: 'Supervisor',
  consulta: 'Consulta',
};

export type Permissao = 'mensagem' | 'conferencia' | 'baixa' | 'supervisao';

export function temPermissao(perfil: Perfil, p: Permissao): boolean {
  if (perfil === 'supervisor') return true;
  if (perfil === 'operador') return p === 'mensagem' || p === 'conferencia';
  return false;
}

export type NovoComprovante = Pick<Comprovante, 'pagador' | 'valor' | 'dataPagamento' | 'tipo' | 'endToEndId' | 'banco' | 'canal' | 'terceiro'>;

export type Acao =
  | { tipo: 'perfil'; perfil: Perfil }
  | { tipo: 'dataBase'; data: DataISO }
  | { tipo: 'config'; config: Configuracao }
  | { tipo: 'recalcularRegua' }
  | { tipo: 'decidirMensagem'; id: string; decisao: 'aprovar' | 'rejeitar' | 'adiar'; nota?: string }
  | { tipo: 'editarMensagem'; id: string; texto: string }
  | { tipo: 'mensagemCopiada'; id: string }
  | { tipo: 'novoComprovante'; dados: NovoComprovante }
  | { tipo: 'vincular'; id: string; tituloId: string }
  | { tipo: 'desvincular'; id: string; motivo: string }
  | { tipo: 'validarTerceiro'; id: string; motivo: string }
  | { tipo: 'aceitarDivergencia'; id: string; motivo: string }
  | { tipo: 'efetivarAgendamento'; id: string }
  | { tipo: 'conferir'; id: string; conferido: boolean }
  | { tipo: 'confirmarCredito'; id: string }
  | { tipo: 'registrarBaixa'; id: string }
  | { tipo: 'rejeitarComprovante'; id: string; motivo: string }
  | { tipo: 'disputa'; tituloId: string; ativa: boolean; motivo: string };

export interface Resultado {
  estado: Estado;
  erro?: string;
  sucesso?: string;
}

const PERMISSAO_DA_ACAO: Partial<Record<Acao['tipo'], Permissao>> = {
  config: 'supervisao',
  recalcularRegua: 'mensagem',
  decidirMensagem: 'mensagem',
  editarMensagem: 'mensagem',
  novoComprovante: 'conferencia',
  vincular: 'conferencia',
  desvincular: 'conferencia',
  validarTerceiro: 'conferencia',
  aceitarDivergencia: 'supervisao',
  efetivarAgendamento: 'conferencia',
  conferir: 'conferencia',
  confirmarCredito: 'conferencia',
  registrarBaixa: 'baixa',
  rejeitarComprovante: 'conferencia',
  disputa: 'supervisao',
};

const motivoValido = (m?: string) => (m?.trim().length ?? 0) >= 3;

export function executar(estado: Estado, acao: Acao, agora: string): Resultado {
  const usuario = PERFIS[estado.perfil];
  let seq = estado.seq;
  const novoId = (p: string) => `${p}${++seq}`;
  const auditar = (s: Estado, a: string, alvo: string, detalhe?: string, bloqueado?: boolean): Estado => ({
    ...s,
    seq,
    auditoria: [{ id: novoId('A'), em: agora, usuario, acao: a, alvo, detalhe, bloqueado }, ...s.auditoria],
  });
  const negar = (alvo: string, motivo: string): Resultado => ({
    estado: auditar(estado, 'Ação bloqueada', alvo, motivo, true),
    erro: motivo,
  });
  const ok = (s: Estado, a: string, alvo: string, detalhe?: string, sucesso?: string): Resultado => ({
    estado: auditar(s, a, alvo, detalhe),
    sucesso: sucesso ?? a,
  });

  const perm = PERMISSAO_DA_ACAO[acao.tipo];
  if (perm && !temPermissao(estado.perfil, perm)) {
    return negar('id' in acao ? acao.id : acao.tipo, `Perfil ${usuario} sem permissão para esta ação.`);
  }

  const comp = (id: string) => estado.comprovantes.find((c) => c.id === id);
  const tit = (id: string | null) => estado.titulos.find((t) => t.id === id);
  const setComp = (s: Estado, id: string, f: (c: Comprovante) => Comprovante): Estado => ({
    ...s,
    comprovantes: s.comprovantes.map((c) => (c.id === id ? f(c) : c)),
  });
  const setTit = (s: Estado, id: string, f: (t: Titulo) => Titulo): Estado => ({
    ...s,
    titulos: s.titulos.map((t) => (t.id === id ? f(t) : t)),
  });
  const cancelarMensagens = (s: Estado, tituloId: string, motivo: string): Estado => ({
    ...s,
    mensagens: s.mensagens.map((m) =>
      m.tituloId === tituloId && ['pendente', 'adiada', 'aprovada'].includes(m.status)
        ? { ...m, status: 'cancelada', historico: [...m.historico, { em: agora, por: 'Sistema', acao: 'Cancelada', nota: motivo }] }
        : m,
    ),
  });
  const editavel = (id: string): Comprovante | string => {
    const c = comp(id);
    if (!c) return 'Comprovante não encontrado.';
    if (finalizado(c)) return 'Comprovante finalizado não pode ser alterado.';
    return c;
  };
  const titulocobravel = (t: Titulo | undefined) => {
    if (!t) return false;
    const s = statusTitulo(t, estado.dataBase, estado.comprovantes);
    return s === 'vencido' || s === 'a_vencer';
  };

  switch (acao.tipo) {
    case 'perfil':
      return ok({ ...estado, perfil: acao.perfil }, 'Perfil alterado', PERFIS[acao.perfil]);

    case 'dataBase':
      if (!ehDataISO(acao.data)) return negar('Data-base', 'Data inválida.');
      return ok({ ...estado, dataBase: acao.data }, 'Data-base alterada', acao.data);

    case 'config': {
      const e = acao.config.encargos;
      if ([e.multaPct, e.jurosMesPct, e.correcaoMesPct, e.descontoPct].some((v) => !Number.isFinite(v) || v < 0 || v > 100)) {
        return negar('Configuração', 'Percentuais devem estar entre 0 e 100.');
      }
      const ids = acao.config.regua.map((r) => r.id.trim());
      if (ids.some((id) => !id) || new Set(ids).size !== ids.length) return negar('Configuração', 'Cada etapa da régua precisa de um identificador único.');
      if (ids.includes(ETAPA_AGRUPADA)) return negar('Configuração', `"${ETAPA_AGRUPADA}" é reservado.`);
      return ok({ ...estado, config: acao.config }, 'Configuração salva', 'Parâmetros');
    }

    case 'recalcularRegua': {
      const propostas = proporMensagens(estado.titulos, estado.clientes, estado.comprovantes, {
        dataBase: estado.dataBase,
        etapas: estado.config.regua,
        limiteTitulosFila: estado.config.limiteTitulosFila,
        encargos: estado.config.encargos,
        empresa: estado.config.nomeEmpresa,
      });
      const existentes = new Set(estado.mensagens.map((m) => m.chave));
      const novas: Mensagem[] = propostas
        .filter((p) => !existentes.has(p.chave))
        .map((p) => ({
          ...p,
          id: novoId('M'),
          status: 'pendente',
          historico: [{ em: agora, por: 'Sistema', acao: 'Proposta pela régua' }],
        }));
      return ok(
        { ...estado, mensagens: [...novas, ...estado.mensagens] },
        'Régua calculada',
        `Data-base ${estado.dataBase}`,
        `${novas.length} nova(s) mensagem(ns); ${propostas.length - novas.length} já existente(s) ignorada(s)`,
        novas.length ? `${novas.length} mensagem(ns) proposta(s) para aprovação` : 'Nenhuma mensagem nova — sem duplicações',
      );
    }

    case 'decidirMensagem': {
      const m = estado.mensagens.find((x) => x.id === acao.id);
      if (!m) return negar(acao.id, 'Mensagem não encontrada.');
      if (!['pendente', 'adiada'].includes(m.status)) return negar(acao.id, 'Mensagem já finalizada.');
      const cobravel =
        m.etapaId === ETAPA_AGRUPADA
          ? estado.titulos.some((t) => t.clienteId === m.clienteId && titulocobravel(t))
          : titulocobravel(tit(m.tituloId));
      if (acao.decisao === 'aprovar' && !cobravel) return negar(acao.id, 'Título pago, disputado ou com pagamento em conferência: régua pausada.');
      if (acao.decisao !== 'aprovar' && !motivoValido(acao.nota)) return negar(acao.id, 'Informe o motivo (mín. 3 caracteres).');
      const status = ({ aprovar: 'aprovada', rejeitar: 'rejeitada', adiar: 'adiada' } as const)[acao.decisao];
      const s: Estado = {
        ...estado,
        mensagens: estado.mensagens.map((x) =>
          x.id === m.id ? { ...x, status, historico: [...x.historico, { em: agora, por: usuario, acao: status, nota: acao.nota }] } : x,
        ),
      };
      return ok(s, `Mensagem ${status}`, m.id, acao.nota, status === 'aprovada' ? 'Aprovada — pronta para envio manual' : `Mensagem ${status}`);
    }

    case 'editarMensagem': {
      const m = estado.mensagens.find((x) => x.id === acao.id);
      if (!m || !['pendente', 'adiada', 'aprovada'].includes(m.status)) return negar(acao.id, 'Mensagem não editável.');
      if (acao.texto.trim().length < 10) return negar(acao.id, 'Texto muito curto (mín. 10 caracteres).');
      const s: Estado = {
        ...estado,
        mensagens: estado.mensagens.map((x) =>
          x.id === m.id
            ? { ...x, texto: acao.texto.trim(), status: 'pendente', historico: [...x.historico, { em: agora, por: usuario, acao: 'Texto editado — requer nova aprovação', nota: x.texto }] }
            : x,
        ),
      };
      return ok(s, 'Mensagem editada', m.id, undefined, 'Texto salvo — nova aprovação necessária');
    }

    case 'mensagemCopiada': {
      const m = estado.mensagens.find((x) => x.id === acao.id);
      if (!m || m.status !== 'aprovada') return negar(acao.id, 'Somente mensagens aprovadas podem ser copiadas para envio.');
      return ok(estado, 'Texto copiado para envio manual', m.id, undefined, 'Texto copiado');
    }

    case 'novoComprovante': {
      const d = acao.dados;
      if (d.pagador.trim().length < 2) return negar('Novo comprovante', 'Informe o pagador.');
      if (!Number.isInteger(d.valor) || d.valor <= 0) return negar('Novo comprovante', 'Valor inválido.');
      if (!ehDataISO(d.dataPagamento)) return negar('Novo comprovante', 'Data de pagamento inválida.');
      const id = novoId('CP-');
      const c: Comprovante = {
        ...d,
        id,
        pagador: d.pagador.trim(),
        endToEndId: d.endToEndId.trim().toUpperCase(),
        recebidoEm: agora,
        estado: d.tipo === 'agendado' ? 'agendado' : 'recebido',
        tituloId: null,
        creditoConferido: false,
        terceiroValidado: false,
        divergenciaAceita: false,
        notas: d.tipo === 'agendado' ? ['Comprovante de AGENDAMENTO — não representa quitação.'] : [],
      };
      if (ehDuplicado(c, estado.comprovantes)) {
        c.estado = 'duplicado';
        c.notas = [...c.notas, 'EndToEndId já recebido em outro comprovante.'];
      }
      return ok({ ...estado, comprovantes: [c, ...estado.comprovantes] }, 'Comprovante registrado', id, `${c.pagador} · ${brl(c.valor)}${c.estado === 'duplicado' ? ' · DUPLICADO' : ''}`);
    }

    case 'vincular': {
      const c = editavel(acao.id);
      if (typeof c === 'string') return negar(acao.id, c);
      const t = tit(acao.tituloId);
      if (!t) return negar(acao.id, 'Título não encontrado.');
      if (c.tituloId) return negar(acao.id, 'Desfaça o vínculo atual antes de trocar de título.');
      if (t.situacao !== 'em_aberto') return negar(acao.id, 'Título pago ou em disputa.');
      const ocupado = estado.comprovantes.some((x) => x.id !== c.id && x.tituloId === t.id && ESTADOS_QUE_PAUSAM.includes(x.estado));
      if (ocupado) return negar(acao.id, 'Outro comprovante já está em conferência para este título.');
      const confere = valorConfere(c, t, estado.config.encargos);
      const estadoNovo = c.tipo === 'agendado' ? 'agendado' : confere ? 'em_conferencia' : 'divergente';
      const s = setComp(estado, c.id, (x) => ({ ...x, tituloId: t.id, estado: estadoNovo, creditoConferido: false, divergenciaAceita: false }));
      return ok(s, 'Comprovante vinculado', c.id, `${t.numero}${confere === 'atualizado' ? ' · valor com encargos' : ''}`, estadoNovo === 'divergente' ? 'Vinculado com divergência de valor · régua pausada' : 'Vinculado · régua do título pausada');
    }

    case 'desvincular': {
      const c = editavel(acao.id);
      if (typeof c === 'string') return negar(acao.id, c);
      if (!c.tituloId) return negar(acao.id, 'Comprovante sem vínculo.');
      if (!motivoValido(acao.motivo)) return negar(acao.id, 'Informe o motivo.');
      const s = setComp(estado, c.id, (x) => ({
        ...x,
        tituloId: null,
        estado: x.tipo === 'agendado' ? 'agendado' : 'recebido',
        creditoConferido: false,
        terceiroValidado: false,
        divergenciaAceita: false,
        notas: [...x.notas, `Vínculo desfeito: ${acao.motivo.trim()}`],
      }));
      return ok(s, 'Vínculo desfeito', c.id, acao.motivo);
    }

    case 'validarTerceiro': {
      const c = editavel(acao.id);
      if (typeof c === 'string') return negar(acao.id, c);
      if (!c.terceiro || !c.tituloId) return negar(acao.id, 'Vincule o título antes de validar o terceiro.');
      if (!motivoValido(acao.motivo)) return negar(acao.id, 'Justificativa obrigatória.');
      const s = setComp(estado, c.id, (x) => ({ ...x, terceiroValidado: true, notas: [...x.notas, `Terceiro validado: ${acao.motivo.trim()}`] }));
      return ok(s, 'Pagador terceiro validado', c.id, acao.motivo);
    }

    case 'aceitarDivergencia': {
      const c = editavel(acao.id);
      if (typeof c === 'string') return negar(acao.id, c);
      if (c.estado !== 'divergente') return negar(acao.id, 'Comprovante não está divergente.');
      if (!motivoValido(acao.motivo)) return negar(acao.id, 'Justificativa obrigatória.');
      const s = setComp(estado, c.id, (x) => ({ ...x, divergenciaAceita: true, notas: [...x.notas, `Divergência aceita: ${acao.motivo.trim()}`] }));
      return ok(s, 'Divergência aceita pelo supervisor', c.id, acao.motivo);
    }

    case 'efetivarAgendamento': {
      const c = editavel(acao.id);
      if (typeof c === 'string') return negar(acao.id, c);
      if (c.tipo !== 'agendado') return negar(acao.id, 'Comprovante não é de agendamento.');
      const t = tit(c.tituloId);
      const confere = t ? valorConfere(c, t, estado.config.encargos) : null;
      const s = setComp(estado, c.id, (x) => ({
        ...x,
        tipo: 'efetivado',
        estado: !t ? 'recebido' : confere ? 'em_conferencia' : 'divergente',
        notas: [...x.notas, 'Agendamento informado como efetivado — conferir no extrato.'],
      }));
      return ok(s, 'Agendamento marcado como efetivado', c.id);
    }

    case 'conferir': {
      const c = editavel(acao.id);
      if (typeof c === 'string') return negar(acao.id, c);
      if (!c.tituloId) return negar(acao.id, 'Vincule um título primeiro.');
      const s = setComp(estado, c.id, (x) => ({ ...x, creditoConferido: acao.conferido }));
      return ok(s, acao.conferido ? 'Crédito conferido no extrato' : 'Conferência desmarcada', c.id);
    }

    case 'confirmarCredito': {
      const c = comp(acao.id);
      if (!c) return negar(acao.id, 'Comprovante não encontrado.');
      const chk = podeConfirmarCredito(c);
      if (!chk.ok) return negar(acao.id, chk.motivo);
      const s = setComp(estado, c.id, (x) => ({ ...x, estado: 'credito_confirmado', notas: [...x.notas, `Crédito confirmado por ${usuario}`] }));
      return ok(s, 'Crédito confirmado', c.id);
    }

    case 'registrarBaixa': {
      const c = comp(acao.id);
      if (!c) return negar(acao.id, 'Comprovante não encontrado.');
      const chk = podeRegistrarBaixa(c);
      if (!chk.ok) return negar(acao.id, chk.motivo);
      const t = tit(c.tituloId);
      if (!t || t.situacao !== 'em_aberto') return negar(acao.id, 'Título indisponível para baixa.');
      let s = setComp(estado, c.id, (x) => ({ ...x, estado: 'baixa_registrada', notas: [...x.notas, 'Baixa registrada no simulador (nenhum ERP alterado).'] }));
      s = setTit(s, t.id, (x) => ({ ...x, situacao: 'pago', pagoEm: c.dataPagamento, valorPago: c.valor }));
      s = cancelarMensagens(s, t.id, 'Título baixado');
      return ok(s, 'Baixa registrada', t.numero, `${brl(c.valor)} via ${c.id}`);
    }

    case 'rejeitarComprovante': {
      const c = editavel(acao.id);
      if (typeof c === 'string') return negar(acao.id, c);
      if (!motivoValido(acao.motivo)) return negar(acao.id, 'Motivo obrigatório.');
      const s = setComp(estado, c.id, (x) => ({ ...x, estado: 'rejeitado', creditoConferido: false, notas: [...x.notas, `Rejeitado: ${acao.motivo.trim()}`] }));
      return ok(s, 'Comprovante rejeitado', c.id, acao.motivo, c.tituloId ? 'Rejeitado · régua do título retomada' : 'Comprovante rejeitado');
    }

    case 'disputa': {
      const t = tit(acao.tituloId);
      if (!t) return negar(acao.tituloId, 'Título não encontrado.');
      if (!motivoValido(acao.motivo)) return negar(t.numero, 'Motivo obrigatório.');
      if (acao.ativa && t.situacao !== 'em_aberto') return negar(t.numero, 'Só títulos em aberto podem entrar em disputa.');
      if (!acao.ativa && t.situacao !== 'disputado') return negar(t.numero, 'Título não está em disputa.');
      let s = setTit(estado, t.id, (x) => ({ ...x, situacao: acao.ativa ? 'disputado' : 'em_aberto' }));
      if (acao.ativa) s = cancelarMensagens(s, t.id, 'Título em disputa');
      return ok(s, acao.ativa ? 'Título colocado em disputa' : 'Disputa encerrada', t.numero, acao.motivo);
    }
  }
}

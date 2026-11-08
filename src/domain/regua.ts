import { brl } from './dinheiro';
import { type DataISO, diferencaDias, fmtData } from './datas';
import { calcularEncargos, type ParametrosEncargos } from './encargos';
import type { Cliente, Comprovante, EstadoComprovante, EtapaRegua, StatusTitulo, Titulo } from './tipos';

export const ETAPA_AGRUPADA = 'AGRUPADA';

export const REGUA_PADRAO: EtapaRegua[] = [
  {
    id: 'D-3', nome: 'Lembrete preventivo', offset: -3, hora: '10:00', filaHumana: false, ativa: true,
    modelo: 'Olá, {contato}! Lembramos que o boleto {numero} ({valor}) da {empresa} vence em {vencimento}. Se já pagou, desconsidere.',
  },
  {
    id: 'D+1', nome: 'Aviso de vencimento', offset: 1, hora: '10:00', filaHumana: false, ativa: true,
    modelo: 'Olá, {contato}. Ainda não identificamos o pagamento do título {numero} ({valor}), vencido em {vencimento}. Pode nos enviar o comprovante?',
  },
  {
    id: 'D+7', nome: 'Cobrança cordial', offset: 7, hora: '14:00', filaHumana: false, ativa: true,
    modelo: '{contato}, tudo bem? O título {numero} segue em aberto desde {vencimento}. Valor atualizado hoje: {valorAtualizado}. Podemos ajudar com segunda via ou negociação.',
  },
  {
    id: 'D+15', nome: 'Atendimento humano', offset: 15, hora: '09:00', filaHumana: true, ativa: true,
    modelo: '[FILA HUMANA] {cliente}: título {numero} com {diasAtraso} dias de atraso ({valorAtualizado}). Contatar {contato} — {telefone}.',
  },
];

export const MODELO_AGRUPADO =
  '[FILA HUMANA] {cliente} possui {qtdVencidos} títulos vencidos somando {totalAtualizado}. Encaminhar para negociação.';

/** Estados de comprovante que pausam a régua do título vinculado. */
export const ESTADOS_QUE_PAUSAM: EstadoComprovante[] = ['recebido', 'em_conferencia', 'agendado', 'divergente', 'credito_confirmado'];

export function statusTitulo(t: Titulo, dataBase: DataISO, comprovantes: Comprovante[]): StatusTitulo {
  if (t.situacao === 'pago') return 'pago';
  if (t.situacao === 'disputado') return 'disputado';
  if (comprovantes.some((c) => c.tituloId === t.id && ESTADOS_QUE_PAUSAM.includes(c.estado))) return 'em_conferencia';
  return diferencaDias(t.vencimento, dataBase) > 0 ? 'vencido' : 'a_vencer';
}

/**
 * Etapa individual aplicável: a de maior offset <= dias desde o vencimento.
 * Etapas preventivas (offset < 0) só valem antes do vencimento.
 */
export function etapaAplicavel(diasDesdeVenc: number, etapas: EtapaRegua[]): EtapaRegua | null {
  let escolhida: EtapaRegua | null = null;
  for (const e of etapas) {
    if (!e.ativa || e.offset > diasDesdeVenc) continue;
    if (e.offset < 0 && diasDesdeVenc >= 0) continue;
    if (!escolhida || e.offset > escolhida.offset) escolhida = e;
  }
  return escolhida;
}

export function preencherModelo(modelo: string, vars: Record<string, string | number>): string {
  return modelo.replace(/\{(\w+)\}/g, (orig, k: string) => (k in vars ? String(vars[k]) : orig));
}

export interface Proposta {
  chave: string;
  tituloId: string;
  clienteId: string;
  etapaId: string;
  filaHumana: boolean;
  texto: string;
  agendadaPara: string;
}

export interface ContextoRegua {
  dataBase: DataISO;
  etapas: EtapaRegua[];
  limiteTitulosFila: number;
  encargos: ParametrosEncargos;
  empresa: string;
}

export function chaveMensagem(tituloId: string, clienteId: string, etapaId: string, dataBase: DataISO): string {
  // A mensagem agrupada é única por cliente e dia; as individuais, por título e etapa.
  return etapaId === ETAPA_AGRUPADA ? `${clienteId}:${ETAPA_AGRUPADA}:${dataBase}` : `${tituloId}:${etapaId}`;
}

/** Calcula as mensagens que a régua propõe para a data-base. Títulos pagos, disputados ou em conferência ficam fora. */
export function proporMensagens(
  titulos: Titulo[],
  clientes: Cliente[],
  comprovantes: Comprovante[],
  ctx: ContextoRegua,
): Proposta[] {
  const out: Proposta[] = [];
  const cobraveis = titulos.filter((t) => {
    const s = statusTitulo(t, ctx.dataBase, comprovantes);
    return s === 'vencido' || s === 'a_vencer';
  });
  const vencidosPorCliente = new Map<string, Titulo[]>();
  for (const t of cobraveis) {
    if (diferencaDias(t.vencimento, ctx.dataBase) > 0) {
      vencidosPorCliente.set(t.clienteId, [...(vencidosPorCliente.get(t.clienteId) ?? []), t]);
    }
  }
  const atualizado = (t: Titulo) => calcularEncargos(t.valor, t.vencimento, ctx.dataBase, ctx.encargos).total;
  const agrupados = new Set<string>();

  for (const t of cobraveis) {
    const c = clientes.find((x) => x.id === t.clienteId);
    if (!c) continue;
    const dias = diferencaDias(t.vencimento, ctx.dataBase);
    const vencidos = vencidosPorCliente.get(c.id) ?? [];

    if (dias > 0 && ctx.limiteTitulosFila > 0 && vencidos.length >= ctx.limiteTitulosFila) {
      if (agrupados.has(c.id)) continue;
      agrupados.add(c.id);
      const maisAntigo = [...vencidos].sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0]!;
      out.push({
        chave: chaveMensagem(maisAntigo.id, c.id, ETAPA_AGRUPADA, ctx.dataBase),
        tituloId: maisAntigo.id,
        clienteId: c.id,
        etapaId: ETAPA_AGRUPADA,
        filaHumana: true,
        texto: preencherModelo(MODELO_AGRUPADO, {
          cliente: c.nome,
          qtdVencidos: vencidos.length,
          totalAtualizado: brl(vencidos.reduce((s, x) => s + atualizado(x), 0)),
        }),
        agendadaPara: `${ctx.dataBase}T09:00`,
      });
      continue;
    }

    const etapa = etapaAplicavel(dias, ctx.etapas);
    if (!etapa) continue;
    out.push({
      chave: chaveMensagem(t.id, c.id, etapa.id, ctx.dataBase),
      tituloId: t.id,
      clienteId: c.id,
      etapaId: etapa.id,
      filaHumana: etapa.filaHumana,
      texto: preencherModelo(etapa.modelo, {
        contato: c.contato,
        cliente: c.nome,
        telefone: c.telefone,
        numero: t.numero,
        valor: brl(t.valor),
        valorAtualizado: brl(atualizado(t)),
        vencimento: fmtData(t.vencimento),
        diasAtraso: Math.max(0, dias),
        empresa: ctx.empresa,
        linhaDigitavel: t.linhaDigitavel,
      }),
      agendadaPara: `${ctx.dataBase}T${etapa.hora}`,
    });
  }
  return out;
}

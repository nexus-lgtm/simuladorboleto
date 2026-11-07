import { brl } from './dinheiro';
import { diferencaDias } from './datas';
import { calcularEncargos, type ParametrosEncargos } from './encargos';
import type { Cliente, Comprovante, Titulo } from './tipos';

export interface Sugestao {
  tituloId: string;
  score: number;
  motivos: string[];
}

export function normalizarNome(s: string): string[] {
  const ignorar = new Set(['ltda', 'me', 'sa', 's', 'a', 'eireli', 'epp', 'de', 'da', 'do', 'e', 'cia', 'coop']);
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !ignorar.has(t));
}

/** Similaridade de nomes (0..1): proporção de tokens do pagador presentes no cliente, aceitando prefixos/abreviações. */
export function similaridadeNome(pagador: string, cliente: string): number {
  const a = normalizarNome(pagador);
  const b = normalizarNome(cliente);
  if (!a.length || !b.length) return 0;
  const hits = a.filter((ta) => b.some((tb) => tb === ta || (ta.length >= 3 && (tb.startsWith(ta) || ta.startsWith(tb))))).length;
  return hits / Math.max(a.length, Math.min(b.length, 4));
}

/** Valor confere com o título (original) ou com o valor atualizado com encargos na data do pagamento. */
export function valorConfere(c: Comprovante, t: Titulo, enc: ParametrosEncargos): 'original' | 'atualizado' | null {
  if (c.valor === t.valor) return 'original';
  const atual = calcularEncargos(t.valor, t.vencimento, c.dataPagamento, enc).total;
  if (Math.abs(c.valor - atual) <= 1) return 'atualizado';
  return null;
}

export function nivelConfianca(score: number): 'alta' | 'media' | 'baixa' {
  if (score >= 0.8) return 'alta';
  if (score >= 0.55) return 'media';
  return 'baixa';
}

/** Ranqueia títulos candidatos para um comprovante com base em valor, nome do pagador e data. */
export function sugerirTitulos(
  c: Comprovante,
  titulos: Titulo[],
  clientes: Cliente[],
  enc: ParametrosEncargos,
  limite = 3,
): Sugestao[] {
  const res: Sugestao[] = [];
  for (const t of titulos) {
    if (t.situacao !== 'em_aberto') continue;
    const cli = clientes.find((x) => x.id === t.clienteId);
    if (!cli) continue;
    const motivos: string[] = [];
    let score = 0;

    const conf = valorConfere(c, t, enc);
    if (conf === 'original') { score += 0.5; motivos.push('Valor idêntico ao título'); }
    else if (conf === 'atualizado') { score += 0.5; motivos.push('Valor igual ao atualizado com encargos'); }
    else {
      const dif = Math.abs(c.valor - t.valor) / t.valor;
      if (dif <= 0.1) { score += 0.2; motivos.push(`Valor próximo (diferença ${brl(c.valor - t.valor)})`); }
    }

    const sim = similaridadeNome(c.pagador, cli.nome);
    if (sim > 0) { score += 0.35 * Math.min(1, sim); motivos.push(sim >= 0.6 ? 'Nome do pagador compatível' : 'Nome parcialmente compatível'); }

    const dias = diferencaDias(t.vencimento, c.dataPagamento);
    if (dias >= -5 && dias <= 45) { score += 0.15 * (1 - Math.max(0, dias) / 60); motivos.push(dias <= 0 ? 'Pago até o vencimento' : `Pago ${dias} dia(s) após o vencimento`); }

    if (score >= 0.25) res.push({ tituloId: t.id, score: Math.min(1, Math.round(score * 100) / 100), motivos });
  }
  return res.sort((a, b) => b.score - a.score).slice(0, limite);
}

/** Comprovante é duplicado se o mesmo EndToEndId já foi recebido antes em outro comprovante não rejeitado. */
export function ehDuplicado(c: Pick<Comprovante, 'id' | 'endToEndId' | 'recebidoEm'>, todos: Comprovante[]): boolean {
  const id = c.endToEndId.trim().toUpperCase();
  if (!id) return false;
  return todos.some(
    (o) =>
      o.id !== c.id &&
      o.estado !== 'rejeitado' &&
      o.estado !== 'duplicado' &&
      o.endToEndId.trim().toUpperCase() === id &&
      (o.recebidoEm < c.recebidoEm || (o.recebidoEm === c.recebidoEm && o.id < c.id)),
  );
}

type Checagem = { ok: true } | { ok: false; motivo: string };

/** Nenhum comprovante basta como prova: crédito precisa ser conferido no extrato por um humano. */
export function podeConfirmarCredito(c: Comprovante): Checagem {
  if (!c.tituloId) return { ok: false, motivo: 'Vincule um título primeiro.' };
  if (c.estado === 'credito_confirmado') return { ok: false, motivo: 'Crédito já confirmado.' };
  if (c.estado === 'duplicado') return { ok: false, motivo: 'Comprovante duplicado.' };
  if (c.estado === 'rejeitado' || c.estado === 'baixa_registrada') return { ok: false, motivo: 'Comprovante finalizado.' };
  if (c.tipo === 'agendado') return { ok: false, motivo: 'Comprovante de agendamento não é quitação.' };
  if (c.estado === 'divergente' && !c.divergenciaAceita) return { ok: false, motivo: 'Resolva a divergência de valor antes.' };
  if (c.terceiro && !c.terceiroValidado) return { ok: false, motivo: 'Valide o vínculo do pagador terceiro.' };
  if (!c.creditoConferido) return { ok: false, motivo: 'Marque a conferência do crédito no extrato bancário.' };
  return { ok: true };
}

export function podeRegistrarBaixa(c: Comprovante): Checagem {
  if (c.estado !== 'credito_confirmado') return { ok: false, motivo: 'O crédito precisa ser confirmado antes da baixa.' };
  return { ok: true };
}

export function finalizado(c: Comprovante): boolean {
  return ['duplicado', 'rejeitado', 'credito_confirmado', 'baixa_registrada'].includes(c.estado);
}

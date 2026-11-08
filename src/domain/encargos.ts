import type { Centavos } from './dinheiro';
import { type DataISO, diferencaDias, proximoDiaUtil } from './datas';

export interface ParametrosEncargos {
  /** Multa moratória sobre o valor (corrigido), em %. */
  multaPct: number;
  /** Juros de mora ao mês, em %. Aplicados pro rata die (mês comercial de 30 dias). */
  jurosMesPct: number;
  tipoJuros: 'simples' | 'composto';
  /** Correção monetária ao mês (índice informado pelo usuário), em %. 0 = sem correção. */
  correcaoMesPct: number;
  /** Vencimento em fim de semana/feriado é prorrogado para o próximo dia útil (regra bancária). */
  prorrogarDiaUtil: boolean;
  /** Desconto por pagamento até o vencimento, em %. */
  descontoPct: number;
}

export const ENCARGOS_PADRAO: ParametrosEncargos = {
  multaPct: 2,
  jurosMesPct: 1,
  tipoJuros: 'simples',
  correcaoMesPct: 0,
  prorrogarDiaUtil: true,
  descontoPct: 0,
};

export interface ResultadoEncargos {
  valorOriginal: Centavos;
  vencimentoEfetivo: DataISO;
  diasAtraso: number;
  emAtraso: boolean;
  correcao: Centavos;
  multa: Centavos;
  juros: Centavos;
  desconto: Centavos;
  total: Centavos;
  /** Passo a passo legível do cálculo. */
  memoria: string[];
  avisos: string[];
}

/** Arredonda para o centavo (meio para cima), neutralizando ruído de ponto flutuante. */
const r = (v: number) => Math.round(Number(v.toFixed(6)));

export function calcularEncargos(
  valorOriginal: Centavos,
  vencimento: DataISO,
  pagamento: DataISO,
  p: ParametrosEncargos,
): ResultadoEncargos {
  const avisos: string[] = [];
  const memoria: string[] = [];
  if (p.multaPct > 2) avisos.push('Multa acima de 2%: em relações de consumo o CDC (art. 52, §1º) limita a multa a 2%.');
  if (p.jurosMesPct > 1) avisos.push('Juros de mora acima de 1% a.m. exigem previsão contratual expressa.');

  const vencimentoEfetivo = p.prorrogarDiaUtil ? proximoDiaUtil(vencimento) : vencimento;
  if (vencimentoEfetivo !== vencimento) {
    memoria.push(`Vencimento em dia não útil: prorrogado para ${vencimentoEfetivo.split('-').reverse().join('/')}.`);
  }

  const base = { valorOriginal, vencimentoEfetivo, correcao: 0, multa: 0, juros: 0, desconto: 0 };

  if (diferencaDias(vencimentoEfetivo, pagamento) <= 0) {
    const desconto = diferencaDias(vencimento, pagamento) <= 0 && p.descontoPct > 0 ? r((valorOriginal * p.descontoPct) / 100) : 0;
    if (desconto) memoria.push(`Desconto de ${p.descontoPct}% por pagamento até o vencimento.`);
    memoria.push('Pagamento em dia: sem encargos moratórios.');
    return { ...base, diasAtraso: 0, emAtraso: false, desconto, total: valorOriginal - desconto, memoria, avisos };
  }

  // Em atraso, os dias contam a partir do vencimento original.
  const dias = diferencaDias(vencimento, pagamento);
  const meses = dias / 30;
  const correcao = p.correcaoMesPct > 0 ? r(valorOriginal * ((1 + p.correcaoMesPct / 100) ** meses - 1)) : 0;
  const corrigido = valorOriginal + correcao;
  const multa = r((corrigido * p.multaPct) / 100);
  const juros =
    p.tipoJuros === 'simples'
      ? r((corrigido * (p.jurosMesPct / 100) * dias) / 30)
      : r(corrigido * ((1 + p.jurosMesPct / 100) ** meses - 1));

  memoria.push(`${dias} dia(s) de atraso desde o vencimento original.`);
  if (correcao) memoria.push(`Correção: ${p.correcaoMesPct}% a.m. composto por ${meses.toFixed(2)} mês(es).`);
  memoria.push(`Multa: ${p.multaPct}% sobre o valor${correcao ? ' corrigido' : ''}.`);
  memoria.push(
    p.tipoJuros === 'simples'
      ? `Juros simples: ${p.jurosMesPct}% a.m. ÷ 30 × ${dias} dia(s).`
      : `Juros compostos: (1 + ${p.jurosMesPct}%)^(${dias}/30) − 1.`,
  );

  return {
    ...base,
    diasAtraso: dias,
    emAtraso: true,
    correcao,
    multa,
    juros,
    total: corrigido + multa + juros,
    memoria,
    avisos,
  };
}

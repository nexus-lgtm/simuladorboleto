// Valores monetários são sempre inteiros em centavos para evitar erros de ponto flutuante.

export type Centavos = number;

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function brl(centavos: Centavos): string {
  return fmt.format(centavos / 100);
}

export function paraCentavos(reais: number): Centavos {
  return Math.round(reais * 100);
}

/** Converte texto digitado ("1.234,56", "1234.56", "R$ 10") em centavos. Retorna null se inválido. */
export function lerValor(texto: string): Centavos | null {
  const limpo = texto.replace(/[R$\s]/g, '');
  if (!limpo) return null;
  let normalizado = limpo;
  if (limpo.includes(',')) normalizado = limpo.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalizado)) return null;
  return paraCentavos(Number(normalizado));
}

/** Formata centavos para edição em campo de texto ("1234,56"). */
export function paraTexto(centavos: Centavos): string {
  return (centavos / 100).toFixed(2).replace('.', ',');
}

export function pct(valor: number, casas = 2): string {
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas })}%`;
}

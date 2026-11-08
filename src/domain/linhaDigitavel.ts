// Leitura e validação de linha digitável / código de barras de boleto bancário (padrão Febraban).
// Substitui o "scanner por IA" anterior: é determinístico, offline e não exige chave de API.
import type { Centavos } from './dinheiro';
import { type DataISO, diferencaDias, somarDias } from './datas';

export interface BoletoLido {
  banco: string;
  codigoBarras: string;
  valor: Centavos;
  /** null quando o fator de vencimento é 0000 (boleto sem vencimento). */
  vencimento: DataISO | null;
}

export type ResultadoLeitura = { ok: true; boleto: BoletoLido } | { ok: false; erro: string };

export function modulo10(numero: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = numero.length - 1; i >= 0; i--) {
    let prod = Number(numero[i]) * peso;
    if (prod > 9) prod = Math.floor(prod / 10) + (prod % 10);
    soma += prod;
    peso = peso === 2 ? 1 : 2;
  }
  return (10 - (soma % 10)) % 10;
}

/** DV geral do código de barras (43 dígitos sem o DV). */
export function modulo11Boleto(numero: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = numero.length - 1; i >= 0; i--) {
    soma += Number(numero[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const dv = 11 - (soma % 11);
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv;
}

/**
 * Converte o fator de vencimento em data. O fator chegou a 9999 em 21/02/2025 e reiniciou em 1000
 * (22/02/2025). Escolhemos o ciclo cuja data fica mais próxima da data de referência.
 */
export function fatorParaData(fator: number, referencia: DataISO): DataISO | null {
  if (fator === 0) return null;
  const antigo = somarDias('1997-10-07', fator);
  const novo = somarDias('2025-02-22', fator - 1000);
  return Math.abs(diferencaDias(referencia, antigo)) <= Math.abs(diferencaDias(referencia, novo)) ? antigo : novo;
}

function lerCodigoBarras(cb: string, referencia: DataISO): ResultadoLeitura {
  const dv = Number(cb[4]);
  const semDv = cb.slice(0, 4) + cb.slice(5);
  if (modulo11Boleto(semDv) !== dv) return { ok: false, erro: 'Dígito verificador geral inválido. Confira a digitação.' };
  return {
    ok: true,
    boleto: {
      banco: cb.slice(0, 3),
      codigoBarras: cb,
      valor: Number(cb.slice(9, 19)),
      vencimento: fatorParaData(Number(cb.slice(5, 9)), referencia),
    },
  };
}

export function lerBoleto(entrada: string, referencia: DataISO): ResultadoLeitura {
  const d = entrada.replace(/\D/g, '');
  if (d.length === 48 || (d.length === 44 && d.startsWith('8'))) {
    return { ok: false, erro: 'Boleto de arrecadação/convênio (contas de consumo, tributos) não é suportado.' };
  }
  if (d.length === 44) return lerCodigoBarras(d, referencia);
  if (d.length !== 47) return { ok: false, erro: `A linha digitável deve ter 47 dígitos (informados: ${d.length}).` };

  const campos: [string, number][] = [
    [d.slice(0, 9), Number(d[9])],
    [d.slice(10, 20), Number(d[20])],
    [d.slice(21, 31), Number(d[31])],
  ];
  for (let i = 0; i < campos.length; i++) {
    const [num, dv] = campos[i]!;
    if (modulo10(num) !== dv) return { ok: false, erro: `Dígito verificador do campo ${i + 1} inválido.` };
  }
  const cb = d.slice(0, 4) + d[32] + d.slice(33, 47) + d.slice(4, 9) + d.slice(10, 20) + d.slice(21, 31);
  return lerCodigoBarras(cb, referencia);
}

/** Monta a linha digitável a partir de um código de barras de 44 dígitos (usado em testes e na geração de dados). */
export function codigoBarrasParaLinha(cb: string): string {
  const c1 = cb.slice(0, 4) + cb.slice(19, 24);
  const c2 = cb.slice(24, 34);
  const c3 = cb.slice(34, 44);
  return `${c1}${modulo10(c1)}${c2}${modulo10(c2)}${c3}${modulo10(c3)}${cb[4]}${cb.slice(5, 19)}`;
}

/** Gera um código de barras válido (dados fictícios). */
export function gerarCodigoBarras(banco: string, fator: number, valor: Centavos, campoLivre: string): string {
  const semDv = banco.padStart(3, '0') + '9' + String(fator).padStart(4, '0') + String(valor).padStart(10, '0') + campoLivre.padStart(25, '0');
  const dv = modulo11Boleto(semDv);
  return semDv.slice(0, 4) + dv + semDv.slice(4);
}

export function formatarLinha(linha: string): string {
  const d = linha.replace(/\D/g, '');
  if (d.length !== 47) return linha;
  return `${d.slice(0, 5)}.${d.slice(5, 10)} ${d.slice(10, 15)}.${d.slice(15, 21)} ${d.slice(21, 26)}.${d.slice(26, 32)} ${d[32]} ${d.slice(33)}`;
}

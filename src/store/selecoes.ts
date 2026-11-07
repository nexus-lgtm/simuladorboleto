// Consultas derivadas do estado usadas pelas telas.
import { diferencaDias } from '../domain/datas';
import { calcularEncargos } from '../domain/encargos';
import { statusTitulo } from '../domain/regua';
import type { Estado, StatusTitulo, Titulo } from '../domain/tipos';

export interface TituloVisao extends Titulo {
  status: StatusTitulo;
  dias: number;
  atualizado: number;
  clienteNome: string;
}

export function titulosVisao(e: Estado): TituloVisao[] {
  return e.titulos.map((t) => {
    const status = statusTitulo(t, e.dataBase, e.comprovantes);
    const aberto = status !== 'pago';
    return {
      ...t,
      status,
      dias: diferencaDias(t.vencimento, e.dataBase),
      atualizado: aberto ? calcularEncargos(t.valor, t.vencimento, e.dataBase, e.config.encargos).total : t.valorPago ?? t.valor,
      clienteNome: e.clientes.find((c) => c.id === t.clienteId)?.nome ?? '—',
    };
  });
}

export const FAIXAS_AGING = [
  { id: 'a_vencer', nome: 'A vencer', min: -Infinity, max: 0 },
  { id: '1-15', nome: '1–15 dias', min: 1, max: 15 },
  { id: '16-30', nome: '16–30 dias', min: 16, max: 30 },
  { id: '31-60', nome: '31–60 dias', min: 31, max: 60 },
  { id: '60+', nome: '60+ dias', min: 61, max: Infinity },
] as const;

export function aging(ts: TituloVisao[]) {
  const abertos = ts.filter((t) => t.status !== 'pago' && t.status !== 'disputado');
  return FAIXAS_AGING.map((f) => {
    const itens = abertos.filter((t) => t.dias >= f.min && t.dias <= f.max);
    return { ...f, qtd: itens.length, valor: itens.reduce((s, t) => s + t.valor, 0) };
  });
}

export function paraCSV(linhas: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + linhas.map((l) => l.map(esc).join(';')).join('\n');
}

export function baixarArquivo(nome: string, conteudo: string, tipo = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

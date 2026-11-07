// Datas são strings ISO "AAAA-MM-DD" tratadas como dias civis (sem fuso horário).

export type DataISO = string;

const DIA_MS = 86_400_000;

export function ehDataISO(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [a, m, d] = s.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function paraDia(iso: DataISO): number {
  const [a, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Math.round(Date.UTC(a, m - 1, d) / DIA_MS);
}

export function deDia(dia: number): DataISO {
  return new Date(dia * DIA_MS).toISOString().slice(0, 10);
}

export function somarDias(iso: DataISO, dias: number): DataISO {
  return deDia(paraDia(iso) + dias);
}

/** Dias de `de` até `ate` (positivo se `ate` for depois). */
export function diferencaDias(de: DataISO, ate: DataISO): number {
  return paraDia(ate) - paraDia(de);
}

export function hojeLocal(): DataISO {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fmtData(iso: DataISO): string {
  if (!iso) return '—';
  return iso.split('-').reverse().join('/');
}

export function fmtDataHora(isoCompleto: string): string {
  const d = new Date(isoCompleto);
  if (Number.isNaN(d.getTime())) return isoCompleto;
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(ano: number): DataISO {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

const cacheFeriados = new Map<number, Set<DataISO>>();

/** Feriados bancários nacionais (fixos + móveis: Carnaval, Sexta-feira Santa, Corpus Christi). */
export function feriadosBancarios(ano: number): Set<DataISO> {
  const cache = cacheFeriados.get(ano);
  if (cache) return cache;
  const fixos = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '12-25'];
  if (ano >= 2024) fixos.push('11-20'); // Dia da Consciência Negra (Lei 14.759/2023)
  const p = pascoa(ano);
  const set = new Set<DataISO>([
    ...fixos.map((f) => `${ano}-${f}`),
    somarDias(p, -48), // segunda de Carnaval
    somarDias(p, -47), // terça de Carnaval
    somarDias(p, -2), // Sexta-feira Santa
    somarDias(p, 60), // Corpus Christi
  ]);
  cacheFeriados.set(ano, set);
  return set;
}

export function ehDiaUtil(iso: DataISO): boolean {
  const semana = new Date(paraDia(iso) * DIA_MS).getUTCDay();
  if (semana === 0 || semana === 6) return false;
  return !feriadosBancarios(Number(iso.slice(0, 4))).has(iso);
}

export function proximoDiaUtil(iso: DataISO): DataISO {
  let d = iso;
  while (!ehDiaUtil(d)) d = somarDias(d, 1);
  return d;
}

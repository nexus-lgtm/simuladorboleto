import { useEffect, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Cabecalho({ titulo, subtitulo, acoes }: { titulo: string; subtitulo?: string; acoes?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{titulo}</h1>
        {subtitulo && <p className="mt-1 max-w-3xl text-sm text-slate-500">{subtitulo}</p>}
      </div>
      {acoes && <div className="no-print flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

export function Painel({ titulo, acao, children, className }: { titulo?: ReactNode; acao?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      {titulo && (
        <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{titulo}</h2>
          {acao}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const TONS = {
  cinza: 'bg-slate-100 text-slate-700 ring-slate-200',
  verde: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  ambar: 'bg-amber-50 text-amber-800 ring-amber-200',
  vermelho: 'bg-rose-50 text-rose-700 ring-rose-200',
  azul: 'bg-marca-50 text-marca-700 ring-marca-100',
  roxo: 'bg-violet-50 text-violet-700 ring-violet-200',
} as const;
export type Tom = keyof typeof TONS;

export function Selo({ tom = 'cinza', children, className }: { tom?: Tom; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', TONS[tom], className)}>{children}</span>;
}

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo' | 'alerta';
const VARIANTES: Record<Variante, string> = {
  primario: 'bg-marca-600 text-white hover:bg-marca-700 shadow-sm',
  secundario: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50',
  fantasma: 'text-slate-600 hover:bg-slate-100',
  perigo: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
  alerta: 'text-rose-600 hover:bg-rose-50',
};

export function Botao({ variante = 'primario', tamanho = 'md', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; tamanho?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      {...p}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-500 disabled:cursor-not-allowed disabled:opacity-50',
        tamanho === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        VARIANTES[variante],
        className,
      )}
    />
  );
}

const campoCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-marca-500 focus:ring-2 focus:ring-marca-100 disabled:bg-slate-50';

export function Campo({ rotulo, ajuda, erro, children }: { rotulo: string; ajuda?: ReactNode; erro?: string | null; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-700">{rotulo}</label>
      {children(id)}
      {erro ? <p className="mt-1 text-xs text-rose-600">{erro}</p> : ajuda ? <p className="mt-1 text-xs text-slate-500">{ajuda}</p> : null}
    </div>
  );
}

export const Entrada = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(campoCls, className)} />;
export const Selecao = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(campoCls, className)} />;
export const Texto = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(campoCls, 'min-h-20', className)} />;

export function Kpi({ rotulo, valor, detalhe, tom = 'cinza' }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode; tom?: Tom }) {
  const barra = { cinza: 'bg-slate-400', verde: 'bg-emerald-500', ambar: 'bg-amber-500', vermelho: 'bg-rose-500', azul: 'bg-marca-500', roxo: 'bg-violet-500' }[tom];
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className={cx('absolute inset-y-0 left-0 w-1', barra)} />
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{rotulo}</p>
      <p className="num mt-1 text-2xl font-bold text-slate-900">{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-slate-500">{detalhe}</p>}
    </div>
  );
}

export function Alerta({ tom = 'ambar', children }: { tom?: 'ambar' | 'vermelho' | 'azul' | 'verde'; children: ReactNode }) {
  const c = {
    ambar: 'border-amber-200 bg-amber-50 text-amber-900',
    vermelho: 'border-rose-200 bg-rose-50 text-rose-800',
    azul: 'border-marca-100 bg-marca-50 text-marca-900',
    verde: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  }[tom];
  return <div role="note" className={cx('rounded-lg border px-3 py-2 text-xs leading-relaxed', c)}>{children}</div>;
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{children}</p>;
}

export function Modal({ aberto, titulo, descricao, aoFechar, children, rodape }: { aberto: boolean; titulo: string; descricao?: string; aoFechar: () => void; children?: ReactNode; rodape: ReactNode }) {
  const tituloId = useId();
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [aberto, aoFechar]);
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div role="dialog" aria-modal="true" aria-labelledby={tituloId} className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="p-5">
          <h3 id={tituloId} className="text-base font-semibold text-slate-900">{titulo}</h3>
          {descricao && <p className="mt-1 text-sm text-slate-500">{descricao}</p>}
          {children && <div className="mt-4 space-y-3">{children}</div>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">{rodape}</div>
      </div>
    </div>
  );
}

export function Tabela({ cabecalho, children }: { cabecalho: ReactNode[]; children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            {cabecalho.map((h, i) => <th key={i} className="whitespace-nowrap px-4 py-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

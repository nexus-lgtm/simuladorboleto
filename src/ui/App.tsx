import { useEffect, useState, type ReactNode } from 'react';
import { fmtData } from '../domain/datas';
import { PERFIS } from '../store/motor';
import { useApp } from '../store/store';
import { cx } from './components/ui';
import { Painel as PaginaPainel } from './pages/Painel';
import { Simulador } from './pages/Simulador';
import { Cobrancas } from './pages/Cobrancas';
import { Aprovacoes } from './pages/Aprovacoes';
import { Conciliacao } from './pages/Conciliacao';
import { Clientes } from './pages/Clientes';
import { Auditoria } from './pages/Auditoria';
import { Configuracoes } from './pages/Configuracoes';

export interface Rota {
  caminho: string;
  nome: string;
  icone: string;
  pagina: () => ReactNode;
}

export const ROTAS: Rota[] = [
  { caminho: 'painel', nome: 'Painel', icone: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z', pagina: PaginaPainel },
  { caminho: 'simulador', nome: 'Simulador de boleto', icone: 'M4 4h16v16H4zM8 8h8M8 12h8M8 16h4', pagina: Simulador },
  { caminho: 'cobrancas', nome: 'Cobranças', icone: 'M12 22a2 2 0 002-2h-4a2 2 0 002 2zm6-6V11a6 6 0 10-12 0v5l-2 2h16l-2-2z', pagina: Cobrancas },
  { caminho: 'aprovacoes', nome: 'Aprovações', icone: 'M9 11l3 3 8-8M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9', pagina: Aprovacoes },
  { caminho: 'conciliacao', nome: 'Conciliação PIX', icone: 'M7 7h10v10H7zM3 12h4M17 12h4M12 3v4M12 17v4', pagina: Conciliacao },
  { caminho: 'clientes', nome: 'Clientes', icone: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75', pagina: Clientes },
  { caminho: 'auditoria', nome: 'Auditoria', icone: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 14h6M9 17h4', pagina: Auditoria },
  { caminho: 'configuracoes', nome: 'Configurações', icone: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z', pagina: Configuracoes },
];

export function navegar(caminho: string) {
  window.location.hash = `#/${caminho}`;
}

function rotaAtual(): string {
  const h = window.location.hash.replace(/^#\/?/, '').split('?')[0] ?? '';
  return ROTAS.some((r) => r.caminho === h) ? h : 'painel';
}

export function parametroRota(nome: string): string | null {
  const q = window.location.hash.split('?')[1];
  return q ? new URLSearchParams(q).get(nome) : null;
}

function Icone({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function App() {
  const { estado, avisos } = useApp();
  const [caminho, setCaminho] = useState(rotaAtual);
  const [hash, setHash] = useState(() => window.location.hash);
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    const f = () => {
      setCaminho(rotaAtual());
      setHash(window.location.hash);
      setMenuAberto(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);

  const pendentes = estado.mensagens.filter((m) => m.status === 'pendente').length;
  const aConferir = estado.comprovantes.filter((c) => ['recebido', 'em_conferencia', 'divergente', 'agendado'].includes(c.estado)).length;
  const contadores: Record<string, number> = { aprovacoes: pendentes, conciliacao: aConferir };
  const rota = ROTAS.find((r) => r.caminho === caminho) ?? ROTAS[0]!;
  const Pagina = rota.pagina;

  const nav = (
    <nav className="space-y-0.5 px-3" aria-label="Principal">
      {ROTAS.map((r) => (
        <a
          key={r.caminho}
          href={`#/${r.caminho}`}
          aria-current={r.caminho === caminho ? 'page' : undefined}
          className={cx(
            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
            r.caminho === caminho ? 'bg-white/10 font-medium text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white',
          )}
        >
          <Icone d={r.icone} />
          <span className="flex-1">{r.nome}</span>
          {!!contadores[r.caminho] && <span className="num rounded-full bg-marca-500 px-1.5 text-[11px] font-semibold text-white">{contadores[r.caminho]}</span>}
        </a>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className={cx('no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-950 transition-transform lg:translate-x-0', menuAberto ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="grid size-8 place-items-center rounded-lg bg-marca-600 text-sm font-bold text-white">CF</div>
          <div>
            <p className="text-sm font-semibold text-white">Central Financeira</p>
            <p className="text-[11px] uppercase tracking-widest text-slate-500">Simulador</p>
          </div>
        </div>
        {nav}
        <div className="mt-auto border-t border-white/10 px-5 py-4 text-xs text-slate-400">
          <p>Perfil: <span className="font-medium text-slate-200">{PERFIS[estado.perfil]}</span></p>
          <p className="mt-0.5">Data-base: <span className="num font-medium text-slate-200">{fmtData(estado.dataBase)}</span></p>
          <p className="mt-2 text-[11px] leading-snug text-slate-500">Envios e baixas são simulados. Nenhum dado sai do seu navegador.</p>
        </div>
      </aside>
      {menuAberto && <div className="no-print fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={() => setMenuAberto(false)} />}

      <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <button type="button" aria-label="Abrir menu" onClick={() => setMenuAberto(true)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
          <Icone d="M3 6h18M3 12h18M3 18h18" />
        </button>
        <span className="text-sm font-semibold">{rota.nome}</span>
      </header>

      <main className="print-full mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Pagina key={hash} />
      </main>

      <div className="no-print fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} className={cx('rounded-lg px-4 py-3 text-sm shadow-lg ring-1', a.tipo === 'erro' ? 'bg-rose-50 text-rose-800 ring-rose-200' : 'bg-slate-900 text-white ring-slate-800')}>
            {a.tipo === 'erro' && <strong className="mr-1">Bloqueado:</strong>}
            {a.texto}
          </div>
        ))}
      </div>
    </div>
  );
}

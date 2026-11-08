import { brl } from '../../domain/dinheiro';
import { fmtDataHora } from '../../domain/datas';
import type { StatusTitulo } from '../../domain/tipos';
import { aging, titulosVisao } from '../../store/selecoes';
import { useApp } from '../../store/store';
import { Botao, Cabecalho, Kpi, Painel as Card, Selo, cx } from '../components/ui';
import { navegar } from '../App';
import { STATUS_TITULO } from '../rotulos';

const COR_STATUS: Record<StatusTitulo, string> = {
  a_vencer: 'bg-marca-500',
  vencido: 'bg-rose-500',
  em_conferencia: 'bg-amber-500',
  pago: 'bg-emerald-500',
  disputado: 'bg-violet-500',
};

export function Painel() {
  const { estado } = useApp();
  const ts = titulosVisao(estado);
  const abertos = ts.filter((t) => t.status !== 'pago');
  const vencidos = ts.filter((t) => t.status === 'vencido');
  const encargos = vencidos.reduce((s, t) => s + (t.atualizado - t.valor), 0);
  const pendentes = estado.mensagens.filter((m) => m.status === 'pendente');
  const aConferir = estado.comprovantes.filter((c) => ['recebido', 'em_conferencia', 'divergente', 'agendado'].includes(c.estado));
  const faixas = aging(ts);
  const maxFaixa = Math.max(1, ...faixas.map((f) => f.valor));
  const porStatus = (Object.keys(STATUS_TITULO) as StatusTitulo[]).map((s) => ({ s, qtd: ts.filter((t) => t.status === s).length }));
  const recebido = ts.filter((t) => t.status === 'pago').reduce((s, t) => s + (t.valorPago ?? t.valor), 0);

  return (
    <>
      <Cabecalho
        titulo="Painel financeiro"
        subtitulo="Visão consolidada da carteira, da régua de cobrança e da conciliação de pagamentos."
        acoes={
          <>
            <Botao variante="secundario" onClick={() => navegar('conciliacao')}>Conferir comprovantes ({aConferir.length})</Botao>
            <Botao onClick={() => navegar('aprovacoes')}>Revisar mensagens ({pendentes.length})</Botao>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi rotulo="Carteira em aberto" valor={brl(abertos.reduce((s, t) => s + t.valor, 0))} detalhe={`${abertos.length} título(s)`} tom="azul" />
        <Kpi rotulo="Vencido" valor={brl(vencidos.reduce((s, t) => s + t.valor, 0))} detalhe={`${vencidos.length} título(s) · + ${brl(encargos)} em encargos`} tom="vermelho" />
        <Kpi rotulo="Comprovantes a conferir" valor={aConferir.length} detalhe="Régua pausada nos títulos vinculados" tom="ambar" />
        <Kpi rotulo="Recebido (baixas)" valor={brl(recebido)} detalhe={`${pendentes.length} mensagem(ns) aguardando aprovação`} tom="verde" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card titulo="Aging da carteira (valor original)" className="lg:col-span-3">
          <ul className="space-y-3">
            {faixas.map((f) => (
              <li key={f.id} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-sm">
                <span className="text-slate-600">{f.nome}</span>
                <div className="h-6 overflow-hidden rounded bg-slate-100">
                  <div
                    className={cx('h-full rounded', f.id === 'a_vencer' ? 'bg-marca-500' : f.id === '1-15' ? 'bg-amber-400' : f.id === '16-30' ? 'bg-orange-500' : 'bg-rose-600')}
                    style={{ width: `${(f.valor / maxFaixa) * 100}%` }}
                  />
                </div>
                <span className="num w-36 text-right text-xs text-slate-700">
                  {brl(f.valor)} <span className="text-slate-400">({f.qtd})</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card titulo="Títulos por situação" className="lg:col-span-2">
          <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
            {porStatus.filter((p) => p.qtd).map((p) => (
              <div key={p.s} className={COR_STATUS[p.s]} style={{ width: `${(p.qtd / ts.length) * 100}%` }} title={`${STATUS_TITULO[p.s].rotulo}: ${p.qtd}`} />
            ))}
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
            {porStatus.map((p) => (
              <li key={p.s} className="flex items-center gap-2">
                <span className={cx('size-2.5 rounded-full', COR_STATUS[p.s])} />
                <span className="flex-1 text-slate-600">{STATUS_TITULO[p.s].rotulo}</span>
                <span className="num font-semibold">{p.qtd}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card titulo="Maiores atrasos" acao={<a href="#/cobrancas" className="text-xs font-medium text-marca-600 hover:underline">Ver cobranças</a>}>
          <ul className="divide-y divide-slate-100">
            {[...vencidos].sort((a, b) => b.dias - a.dias).slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.clienteNome}</p>
                  <p className="num text-xs text-slate-500">{t.numero} · {t.dias} dia(s)</p>
                </div>
                <div className="text-right">
                  <p className="num font-semibold">{brl(t.atualizado)}</p>
                  <p className="num text-xs text-slate-400">orig. {brl(t.valor)}</p>
                </div>
              </li>
            ))}
            {!vencidos.length && <li className="py-2 text-sm text-slate-500">Nenhum título vencido.</li>}
          </ul>
        </Card>

        <Card titulo="Auditoria recente" acao={<a href="#/auditoria" className="text-xs font-medium text-marca-600 hover:underline">Ver tudo</a>}>
          <ul className="divide-y divide-slate-100">
            {estado.auditoria.slice(0, 6).map((a) => (
              <li key={a.id} className="flex items-start gap-3 py-2 text-sm">
                <span className="num w-28 shrink-0 text-xs text-slate-400">{fmtDataHora(a.em)}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{a.acao}</span>
                  {a.detalhe && <span className="block truncate text-xs text-slate-500">{a.detalhe}</span>}
                </span>
                {a.bloqueado ? <Selo tom="vermelho">bloqueada</Selo> : <Selo>{a.alvo}</Selo>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

import { useState } from 'react';
import { brl, lerValor } from '../../domain/dinheiro';
import { fmtData, fmtDataHora } from '../../domain/datas';
import { calcularEncargos } from '../../domain/encargos';
import { finalizado, nivelConfianca, podeConfirmarCredito, podeRegistrarBaixa, sugerirTitulos } from '../../domain/conciliacao';
import type { Comprovante } from '../../domain/tipos';
import { temPermissao, type NovoComprovante } from '../../store/motor';
import { useApp } from '../../store/store';
import { Alerta, Botao, Cabecalho, Campo, Entrada, Modal, Painel, Selecao, Selo, Texto, Vazio, cx } from '../components/ui';
import { ESTADO_COMPROVANTE } from '../rotulos';

type ModalMotivo = 'rejeitar' | 'desvincular' | 'terceiro' | 'divergencia' | null;

const TEXTO_MOTIVO: Record<Exclude<ModalMotivo, null>, { titulo: string; descricao: string; acao: string }> = {
  rejeitar: { titulo: 'Rejeitar comprovante', descricao: 'A régua do título volta a correr.', acao: 'Rejeitar' },
  desvincular: { titulo: 'Desfazer vínculo', descricao: 'O comprovante volta para a fila sem título.', acao: 'Desfazer' },
  terceiro: { titulo: 'Validar pagador terceiro', descricao: 'Explique a relação do pagador com o cliente.', acao: 'Validar' },
  divergencia: { titulo: 'Aceitar divergência de valor', descricao: 'Somente supervisor. Ex.: pagamento parcial negociado.', acao: 'Aceitar' },
};

export function Conciliacao() {
  const { estado, despachar } = useApp();
  const [selId, setSelId] = useState(estado.comprovantes[0]?.id ?? '');
  const [modal, setModal] = useState<ModalMotivo>(null);
  const [motivo, setMotivo] = useState('');
  const [baixaAberta, setBaixaAberta] = useState(false);
  const [novoAberto, setNovoAberto] = useState(false);
  const [mostrarFinalizados, setMostrarFinalizados] = useState(true);

  const lista = estado.comprovantes.filter((c) => mostrarFinalizados || !finalizado(c));
  const c = estado.comprovantes.find((x) => x.id === selId) ?? lista[0];
  const pode = temPermissao(estado.perfil, 'conferencia');

  const executarMotivo = () => {
    if (!c || !modal) return;
    const acao =
      modal === 'rejeitar' ? { tipo: 'rejeitarComprovante' as const, id: c.id, motivo }
      : modal === 'desvincular' ? { tipo: 'desvincular' as const, id: c.id, motivo }
      : modal === 'terceiro' ? { tipo: 'validarTerceiro' as const, id: c.id, motivo }
      : { tipo: 'aceitarDivergencia' as const, id: c.id, motivo };
    if (!despachar(acao).erro) setModal(null);
  };

  return (
    <>
      <Cabecalho
        titulo="Conciliação PIX"
        subtitulo="Comprovantes enviados por clientes não são prova de crédito: o vínculo é sugerido automaticamente, mas a conferência no extrato e a baixa são sempre humanas."
        acoes={<Botao disabled={!pode} onClick={() => setNovoAberto(true)}>Registrar comprovante</Botao>}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
        <Painel
          titulo={`Comprovantes (${lista.length})`}
          acao={
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" className="accent-marca-600" checked={mostrarFinalizados} onChange={(e) => setMostrarFinalizados(e.target.checked)} />
              finalizados
            </label>
          }
        >
          <ul className="space-y-2">
            {lista.map((x) => (
              <li key={x.id}>
                <button type="button" onClick={() => setSelId(x.id)}
                  className={cx('w-full rounded-lg border p-3 text-left transition-colors hover:bg-slate-50', x.id === c?.id ? 'border-marca-500 bg-marca-50/60' : 'border-slate-200')}>
                  <div className="flex items-center gap-2">
                    <span className="num text-xs font-semibold">{x.id}</span>
                    <Selo tom={ESTADO_COMPROVANTE[x.estado].tom} className="ml-auto">{ESTADO_COMPROVANTE[x.estado].rotulo}</Selo>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium">{x.pagador}</p>
                  <p className="num text-xs text-slate-500">{brl(x.valor)} · {x.canal} · {fmtDataHora(x.recebidoEm)}</p>
                </button>
              </li>
            ))}
            {!lista.length && <Vazio>Nenhum comprovante.</Vazio>}
          </ul>
        </Painel>

        {c ? <Detalhe c={c} pode={pode} abrir={(m) => { setMotivo(''); setModal(m); }} abrirBaixa={() => setBaixaAberta(true)} /> : <Vazio>Selecione um comprovante.</Vazio>}
      </div>

      <Modal
        aberto={!!modal}
        titulo={modal ? TEXTO_MOTIVO[modal].titulo : ''}
        descricao={modal ? TEXTO_MOTIVO[modal].descricao : ''}
        aoFechar={() => setModal(null)}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setModal(null)}>Cancelar</Botao>
            <Botao variante={modal === 'rejeitar' ? 'perigo' : 'primario'} disabled={motivo.trim().length < 3} onClick={executarMotivo}>{modal ? TEXTO_MOTIVO[modal].acao : ''}</Botao>
          </>
        }
      >
        <Campo rotulo="Justificativa (obrigatória)">{(id) => <Texto id={id} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}</Campo>
      </Modal>

      <Modal
        aberto={baixaAberta}
        titulo="Registrar baixa?"
        descricao="O título será marcado como pago no simulador e as mensagens pendentes dele serão canceladas. Nenhum ERP externo é alterado."
        aoFechar={() => setBaixaAberta(false)}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setBaixaAberta(false)}>Cancelar</Botao>
            <Botao onClick={() => { if (c) despachar({ tipo: 'registrarBaixa', id: c.id }); setBaixaAberta(false); }}>Registrar baixa</Botao>
          </>
        }
      />

      {novoAberto && <NovoComprovanteModal fechar={(id) => { setNovoAberto(false); if (id) setSelId(id); }} />}
    </>
  );
}

function Detalhe({ c, pode, abrir, abrirBaixa }: { c: Comprovante; pode: boolean; abrir: (m: Exclude<ModalMotivo, null>) => void; abrirBaixa: () => void }) {
  const { estado, despachar } = useApp();
  const t = estado.titulos.find((x) => x.id === c.tituloId);
  const nomeCliente = (clienteId: string) => estado.clientes.find((x) => x.id === clienteId)?.nome ?? '—';
  const fim = finalizado(c);
  const sugestoes = !c.tituloId && !fim ? sugerirTitulos(c, estado.titulos, estado.clientes, estado.config.encargos) : [];
  const conf = podeConfirmarCredito(c);
  const bx = podeRegistrarBaixa(c);
  const atualizadoNaData = t ? calcularEncargos(t.valor, t.vencimento, c.dataPagamento, estado.config.encargos).total : 0;

  return (
    <div className="space-y-4">
      <Painel titulo={`Comprovante ${c.id}`} acao={<Selo tom={ESTADO_COMPROVANTE[c.estado].tom}>{ESTADO_COMPROVANTE[c.estado].rotulo}</Selo>}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          {[
            ['Pagador', c.pagador], ['Valor', brl(c.valor)], ['Data do pagamento', fmtData(c.dataPagamento)],
            ['Tipo', c.tipo === 'agendado' ? 'AGENDAMENTO' : 'Efetivado'], ['EndToEndId', c.endToEndId || '—'], ['Banco de origem', c.banco],
            ['Canal', c.canal], ['Recebido em', fmtDataHora(c.recebidoEm)], ['Terceiro', c.terceiro ? (c.terceiroValidado ? 'Sim · validado' : 'Sim · não validado') : 'Não'],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-slate-500">{k}</dt>
              <dd className="num truncate font-medium" title={v}>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 space-y-2">
          {c.tipo === 'agendado' && <Alerta>Comprovante de agendamento NÃO é quitação. Quando o cliente confirmar a efetivação, marque abaixo e confira no extrato.</Alerta>}
          {c.estado === 'duplicado' && <Alerta tom="vermelho">EndToEndId já recebido em outro comprovante — possível reenvio ou fraude.</Alerta>}
          {c.estado === 'divergente' && (
            <Alerta tom="vermelho">
              Valor diferente do título{t && ` (original ${brl(t.valor)}; atualizado na data do pagamento ${brl(atualizadoNaData)})`}.
              {c.divergenciaAceita ? ' Divergência aceita pelo supervisor.' : ' Requer aceite do supervisor ou rejeição.'}
            </Alerta>
          )}
          {c.notas.length > 0 && <ul className="space-y-0.5 text-xs text-slate-500">{c.notas.map((n, i) => <li key={i}>• {n}</li>)}</ul>}
        </div>
      </Painel>

      {t ? (
        <Painel titulo="Título vinculado" acao={!fim && <Botao tamanho="sm" variante="fantasma" disabled={!pode} onClick={() => abrir('desvincular')}>Desfazer vínculo</Botao>}>
          <p className="text-sm"><span className="num font-semibold">{t.numero}</span> · {nomeCliente(t.clienteId)}</p>
          <p className="num mt-1 text-xs text-slate-500">Original {brl(t.valor)} · venc. {fmtData(t.vencimento)} · atualizado na data do pagamento {brl(atualizadoNaData)}</p>
        </Painel>
      ) : !fim ? (
        <Painel titulo="Sugestões de vínculo">
          {!sugestoes.length && <Vazio>Nenhum título em aberto compatível. Verifique valor e pagador.</Vazio>}
          <ul className="space-y-2">
            {sugestoes.map((s) => {
              const tt = estado.titulos.find((x) => x.id === s.tituloId)!;
              const nv = nivelConfianca(s.score);
              return (
                <li key={s.tituloId} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="num text-sm font-semibold">{tt.numero}</span>
                    <span className="truncate text-xs text-slate-500">{nomeCliente(tt.clienteId)}</span>
                    <Selo tom={nv === 'alta' ? 'verde' : nv === 'media' ? 'ambar' : 'vermelho'} className="ml-auto">Confiança {nv} · {Math.round(s.score * 100)}%</Selo>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={cx('h-full', nv === 'alta' ? 'bg-emerald-500' : nv === 'media' ? 'bg-amber-500' : 'bg-rose-500')} style={{ width: `${s.score * 100}%` }} />
                  </div>
                  <p className="num mt-2 text-xs">{brl(tt.valor)} · venc. {fmtData(tt.vencimento)}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{s.motivos.join(' · ')}</p>
                  <Botao tamanho="sm" variante="secundario" className="mt-2" disabled={!pode} onClick={() => despachar({ tipo: 'vincular', id: c.id, tituloId: tt.id })}>Vincular a este título</Botao>
                </li>
              );
            })}
          </ul>
        </Painel>
      ) : null}

      {!fim && (
        <Painel titulo="Conferência humana">
          <ol className="space-y-3 text-sm">
            {c.tipo === 'agendado' && (
              <li><Botao tamanho="sm" variante="secundario" disabled={!pode} onClick={() => despachar({ tipo: 'efetivarAgendamento', id: c.id })}>Cliente informou que o agendamento foi efetivado</Botao></li>
            )}
            {c.terceiro && !c.terceiroValidado && (
              <li><Botao tamanho="sm" variante="secundario" disabled={!pode || !t} onClick={() => abrir('terceiro')}>Validar vínculo do pagador terceiro</Botao></li>
            )}
            {c.estado === 'divergente' && !c.divergenciaAceita && (
              <li><Botao tamanho="sm" variante="secundario" disabled={!temPermissao(estado.perfil, 'supervisao')} onClick={() => abrir('divergencia')}>Aceitar divergência (supervisor)</Botao></li>
            )}
            <li className="flex items-start gap-3">
              <input id={`conf-${c.id}`} type="checkbox" className="mt-0.5 size-4 accent-marca-600" disabled={!pode || !t} checked={c.creditoConferido}
                onChange={(e) => despachar({ tipo: 'conferir', id: c.id, conferido: e.target.checked })} />
              <label htmlFor={`conf-${c.id}`}>
                Conferi o crédito no extrato bancário
                <span className="block text-xs text-slate-500">{t ? 'Valor, data e EndToEndId devem constar no extrato.' : 'Vincule um título primeiro.'}</span>
              </label>
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <Botao tamanho="sm" disabled={!pode || !conf.ok} onClick={() => despachar({ tipo: 'confirmarCredito', id: c.id })}>Confirmar crédito</Botao>
              {!conf.ok && <span className="text-xs text-slate-500">{conf.motivo}</span>}
            </li>
          </ol>
          <div className="mt-4 border-t border-slate-100 pt-3">
            <Botao tamanho="sm" variante="alerta" disabled={!pode} onClick={() => abrir('rejeitar')}>Rejeitar comprovante</Botao>
          </div>
        </Painel>
      )}

      {c.estado === 'credito_confirmado' && (
        <Painel titulo="Baixa">
          <div className="flex flex-wrap items-center gap-2">
            <Botao disabled={!temPermissao(estado.perfil, 'baixa') || !bx.ok} onClick={abrirBaixa}>Registrar baixa do título</Botao>
            {!temPermissao(estado.perfil, 'baixa') && <span className="text-xs text-slate-500">Apenas supervisor registra baixas.</span>}
          </div>
        </Painel>
      )}
    </div>
  );
}

function NovoComprovanteModal({ fechar }: { fechar: (id?: string) => void }) {
  const { estado, despachar } = useApp();
  const [f, setF] = useState({ pagador: '', valor: '', data: estado.dataBase, tipo: 'efetivado', e2e: '', banco: '', canal: 'WhatsApp', terceiro: false });
  const valor = lerValor(f.valor);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const salvar = () => {
    if (valor === null) return;
    const dados: NovoComprovante = {
      pagador: f.pagador, valor, dataPagamento: f.data, tipo: f.tipo as NovoComprovante['tipo'],
      endToEndId: f.e2e, banco: f.banco || '—', canal: f.canal, terceiro: f.terceiro,
    };
    const r = despachar({ tipo: 'novoComprovante', dados });
    if (!r.erro) fechar(r.estado.comprovantes[0]?.id);
  };

  return (
    <Modal
      aberto
      titulo="Registrar comprovante"
      descricao="Transcreva os dados do comprovante recebido. Duplicidade é verificada pelo EndToEndId."
      aoFechar={() => fechar()}
      rodape={
        <>
          <Botao variante="secundario" onClick={() => fechar()}>Cancelar</Botao>
          <Botao disabled={!f.pagador.trim() || valor === null || !valor} onClick={salvar}>Registrar</Botao>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo rotulo="Pagador">{(id) => <Entrada id={id} value={f.pagador} onChange={set('pagador')} />}</Campo>
        <Campo rotulo="Valor (R$)" erro={f.valor && valor === null ? 'Valor inválido' : null}>{(id) => <Entrada id={id} inputMode="decimal" value={f.valor} onChange={set('valor')} placeholder="0,00" />}</Campo>
        <Campo rotulo="Data do pagamento">{(id) => <Entrada id={id} type="date" value={f.data} onChange={set('data')} />}</Campo>
        <Campo rotulo="Tipo">
          {(id) => (
            <Selecao id={id} value={f.tipo} onChange={set('tipo')}>
              <option value="efetivado">PIX efetivado</option>
              <option value="agendado">Agendamento</option>
            </Selecao>
          )}
        </Campo>
        <Campo rotulo="EndToEndId">{(id) => <Entrada id={id} value={f.e2e} onChange={set('e2e')} placeholder="E..." className="font-mono" />}</Campo>
        <Campo rotulo="Banco de origem">{(id) => <Entrada id={id} value={f.banco} onChange={set('banco')} />}</Campo>
        <Campo rotulo="Canal">
          {(id) => (
            <Selecao id={id} value={f.canal} onChange={set('canal')}>
              {['WhatsApp', 'E-mail', 'Portal', 'Telefone'].map((x) => <option key={x}>{x}</option>)}
            </Selecao>
          )}
        </Campo>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" className="size-4 accent-marca-600" checked={f.terceiro} onChange={(e) => setF({ ...f, terceiro: e.target.checked })} />
          Pago por terceiro
        </label>
      </div>
    </Modal>
  );
}

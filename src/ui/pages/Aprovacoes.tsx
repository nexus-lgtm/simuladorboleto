import { useState } from 'react';
import { brl } from '../../domain/dinheiro';
import { fmtData, fmtDataHora } from '../../domain/datas';
import { calcularEncargos } from '../../domain/encargos';
import { ETAPA_AGRUPADA } from '../../domain/regua';
import type { Mensagem, StatusMensagem } from '../../domain/tipos';
import { temPermissao } from '../../store/motor';
import { useApp } from '../../store/store';
import { Alerta, Botao, Cabecalho, Campo, Modal, Painel, Selo, Texto, Vazio, cx } from '../components/ui';
import { STATUS_MENSAGEM } from '../rotulos';

type Filtro = 'abertas' | StatusMensagem | 'todas';

export function Aprovacoes() {
  const { estado, despachar, avisar } = useApp();
  const [filtro, setFiltro] = useState<Filtro>('abertas');
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState('');
  const [decisao, setDecisao] = useState<{ m: Mensagem; tipo: 'rejeitar' | 'adiar' } | null>(null);
  const [nota, setNota] = useState('');
  const pode = temPermissao(estado.perfil, 'mensagem');

  const lista = estado.mensagens.filter((m) =>
    filtro === 'todas' ? true : filtro === 'abertas' ? m.status === 'pendente' || m.status === 'adiada' : m.status === filtro,
  );
  const contagem = (s: StatusMensagem) => estado.mensagens.filter((m) => m.status === s).length;

  const copiar = async (m: Mensagem) => {
    try {
      await navigator.clipboard.writeText(m.texto);
      despachar({ tipo: 'mensagemCopiada', id: m.id });
    } catch {
      avisar('erro', 'Não foi possível acessar a área de transferência.');
    }
  };

  const filtros: [Filtro, string][] = [
    ['abertas', `Para decidir (${contagem('pendente') + contagem('adiada')})`],
    ['aprovada', `Aprovadas (${contagem('aprovada')})`],
    ['rejeitada', 'Rejeitadas'],
    ['cancelada', 'Canceladas'],
    ['todas', 'Todas'],
  ];

  return (
    <>
      <Cabecalho
        titulo="Aprovações"
        subtitulo="Cada mensagem proposta pela régua exige aprovação individual. Nada é enviado automaticamente: mensagens aprovadas podem ser copiadas para envio manual pelo canal da empresa."
        acoes={<Botao disabled={!pode} onClick={() => despachar({ tipo: 'recalcularRegua' })}>Calcular régua de {fmtData(estado.dataBase)}</Botao>}
      />
      {!pode && <div className="mb-4"><Alerta>Perfil {estado.perfil} pode apenas consultar. Troque o perfil em Configurações para decidir.</Alerta></div>}

      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {filtros.map(([f, nome]) => (
          <button key={f} type="button" role="tab" aria-selected={filtro === f} onClick={() => setFiltro(f)}
            className={cx('rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset', filtro === f ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50')}>
            {nome}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {!lista.length && <Vazio>Nenhuma mensagem neste filtro. Use “Calcular régua” para gerar as propostas do dia.</Vazio>}
        {lista.map((m) => {
          const c = estado.clientes.find((x) => x.id === m.clienteId);
          const t = estado.titulos.find((x) => x.id === m.tituloId);
          const etapa = estado.config.regua.find((e) => e.id === m.etapaId);
          const aberta = m.status === 'pendente' || m.status === 'adiada';
          return (
            <Painel key={m.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Selo tom={m.filaHumana ? 'roxo' : 'azul'}>{m.etapaId === ETAPA_AGRUPADA ? 'Fila humana · agrupada' : `${m.etapaId} · ${etapa?.nome ?? ''}`}</Selo>
                <Selo tom={STATUS_MENSAGEM[m.status].tom}>{STATUS_MENSAGEM[m.status].rotulo}</Selo>
                <span className="text-sm font-medium">{c?.nome}</span>
                <span className="num ml-auto text-xs text-slate-500">
                  {t && m.etapaId !== ETAPA_AGRUPADA && `${t.numero} · ${brl(t.valor)} → ${brl(calcularEncargos(t.valor, t.vencimento, estado.dataBase, estado.config.encargos).total)} · `}
                  agendada {fmtDataHora(m.agendadaPara)}
                </span>
              </div>

              {editando === m.id ? (
                <div className="mt-3 space-y-2">
                  <Texto aria-label="Texto da mensagem" value={rascunho} onChange={(e) => setRascunho(e.target.value)} rows={4} />
                  <div className="flex gap-2">
                    <Botao tamanho="sm" onClick={() => { if (!despachar({ tipo: 'editarMensagem', id: m.id, texto: rascunho }).erro) setEditando(null); }}>Salvar (requer nova aprovação)</Botao>
                    <Botao tamanho="sm" variante="secundario" onClick={() => setEditando(null)}>Cancelar</Botao>
                  </div>
                </div>
              ) : (
                <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-800">{m.texto}</p>
              )}

              {c && <p className="mt-2 text-xs text-slate-500">Destinatário: {c.contato} · {c.telefone} · {c.email}</p>}

              <div className="mt-3 flex flex-wrap gap-2">
                {aberta && (
                  <>
                    <Botao tamanho="sm" disabled={!pode} onClick={() => despachar({ tipo: 'decidirMensagem', id: m.id, decisao: 'aprovar' })}>Aprovar</Botao>
                    <Botao tamanho="sm" variante="secundario" disabled={!pode} onClick={() => { setRascunho(m.texto); setEditando(m.id); }}>Editar</Botao>
                    {m.status === 'pendente' && <Botao tamanho="sm" variante="secundario" disabled={!pode} onClick={() => { setNota(''); setDecisao({ m, tipo: 'adiar' }); }}>Adiar</Botao>}
                    <Botao tamanho="sm" variante="alerta" disabled={!pode} onClick={() => { setNota(''); setDecisao({ m, tipo: 'rejeitar' }); }}>Rejeitar</Botao>
                  </>
                )}
                {m.status === 'aprovada' && (
                  <>
                    <Botao tamanho="sm" onClick={() => copiar(m)}>Copiar para envio manual</Botao>
                    <Botao tamanho="sm" variante="secundario" disabled={!pode} onClick={() => { setRascunho(m.texto); setEditando(m.id); }}>Editar</Botao>
                  </>
                )}
              </div>

              <details className="mt-3 text-xs text-slate-500">
                <summary className="cursor-pointer select-none">Histórico ({m.historico.length})</summary>
                <ul className="mt-2 space-y-1">
                  {m.historico.map((h, i) => (
                    <li key={i}><span className="num">{fmtDataHora(h.em)}</span> · {h.por} · <b>{h.acao}</b>{h.nota && ` — ${h.nota}`}</li>
                  ))}
                </ul>
              </details>
            </Painel>
          );
        })}
      </div>

      <Modal
        aberto={!!decisao}
        titulo={decisao?.tipo === 'rejeitar' ? 'Rejeitar mensagem' : 'Adiar mensagem'}
        descricao="O motivo fica registrado no histórico e na auditoria."
        aoFechar={() => setDecisao(null)}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setDecisao(null)}>Cancelar</Botao>
            <Botao variante={decisao?.tipo === 'rejeitar' ? 'perigo' : 'primario'} disabled={nota.trim().length < 3}
              onClick={() => { if (decisao && !despachar({ tipo: 'decidirMensagem', id: decisao.m.id, decisao: decisao.tipo, nota }).erro) setDecisao(null); }}>
              Confirmar
            </Botao>
          </>
        }
      >
        <Campo rotulo="Motivo">{(id) => <Texto id={id} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: cliente informou pagamento por telefone" />}</Campo>
      </Modal>
    </>
  );
}

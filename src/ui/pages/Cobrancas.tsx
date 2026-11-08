import { useState } from 'react';
import { brl } from '../../domain/dinheiro';
import { fmtData } from '../../domain/datas';
import { etapaAplicavel } from '../../domain/regua';
import type { StatusTitulo } from '../../domain/tipos';
import { temPermissao } from '../../store/motor';
import { baixarArquivo, paraCSV, titulosVisao, type TituloVisao } from '../../store/selecoes';
import { useApp } from '../../store/store';
import { navegar } from '../App';
import { Botao, Cabecalho, Campo, Entrada, Modal, Painel, Selecao, Selo, Tabela, Texto } from '../components/ui';
import { STATUS_TITULO } from '../rotulos';

export function Cobrancas() {
  const { estado, despachar } = useApp();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<StatusTitulo | 'todos' | 'abertos'>('abertos');
  const [disputa, setDisputa] = useState<TituloVisao | null>(null);
  const [motivo, setMotivo] = useState('');

  const todos = titulosVisao(estado);
  const termo = busca.trim().toLowerCase();
  const lista = todos
    .filter((t) => (filtro === 'todos' ? true : filtro === 'abertos' ? t.status !== 'pago' : t.status === filtro))
    .filter((t) => !termo || `${t.numero} ${t.clienteNome}`.toLowerCase().includes(termo))
    .sort((a, b) => b.dias - a.dias);
  const podeDisputa = temPermissao(estado.perfil, 'supervisao');

  const exportar = () => {
    baixarArquivo(
      `titulos_${estado.dataBase}.csv`,
      paraCSV([
        ['Número', 'Cliente', 'Competência', 'Vencimento', 'Dias', 'Valor original', 'Valor atualizado', 'Status', 'Linha digitável'],
        ...lista.map((t) => [t.numero, t.clienteNome, t.competencia, fmtData(t.vencimento), t.dias, (t.valor / 100).toFixed(2).replace('.', ','), (t.atualizado / 100).toFixed(2).replace('.', ','), STATUS_TITULO[t.status].rotulo, t.linhaDigitavel]),
      ]),
    );
  };

  return (
    <>
      <Cabecalho
        titulo="Cobranças"
        subtitulo={`Valores atualizados com multa e juros na data-base ${fmtData(estado.dataBase)}. A etapa da régua indica qual mensagem se aplica hoje.`}
        acoes={<Botao variante="secundario" onClick={exportar}>Exportar CSV</Botao>}
      />
      <Painel>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_14rem]">
          <Campo rotulo="Buscar">{(id) => <Entrada id={id} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Número do título ou cliente" />}</Campo>
          <Campo rotulo="Situação">
            {(id) => (
              <Selecao id={id} value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
                <option value="abertos">Em aberto (todos)</option>
                <option value="todos">Todos</option>
                {(Object.keys(STATUS_TITULO) as StatusTitulo[]).map((s) => <option key={s} value={s}>{STATUS_TITULO[s].rotulo}</option>)}
              </Selecao>
            )}
          </Campo>
        </div>
        <Tabela cabecalho={['Título', 'Cliente', 'Vencimento', 'Original', 'Atualizado', 'Situação', 'Régua hoje', '']}>
          {lista.map((t) => {
            const etapa = t.status === 'vencido' || t.status === 'a_vencer' ? etapaAplicavel(t.dias, estado.config.regua) : null;
            return (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="num whitespace-nowrap px-4 py-2.5 font-medium">{t.numero}</td>
                <td className="max-w-56 truncate px-4 py-2.5">{t.clienteNome}</td>
                <td className="num whitespace-nowrap px-4 py-2.5">
                  {fmtData(t.vencimento)}
                  <span className="block text-xs text-slate-400">{t.dias > 0 ? `${t.dias} dia(s) atraso` : t.dias === 0 ? 'vence hoje' : `em ${-t.dias} dia(s)`}</span>
                </td>
                <td className="num whitespace-nowrap px-4 py-2.5">{brl(t.valor)}</td>
                <td className="num whitespace-nowrap px-4 py-2.5 font-semibold">{brl(t.atualizado)}</td>
                <td className="px-4 py-2.5"><Selo tom={STATUS_TITULO[t.status].tom}>{STATUS_TITULO[t.status].rotulo}</Selo></td>
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-600">{etapa ? `${etapa.id}${etapa.filaHumana ? ' · humano' : ''}` : '—'}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <Botao tamanho="sm" variante="fantasma" onClick={() => navegar(`simulador?titulo=${t.id}`)}>Simular</Botao>
                    {(t.status === 'disputado' || t.situacao === 'em_aberto') && (
                      <Botao tamanho="sm" variante="fantasma" disabled={!podeDisputa} title={podeDisputa ? undefined : 'Apenas supervisor'} onClick={() => { setMotivo(''); setDisputa(t); }}>
                        {t.status === 'disputado' ? 'Encerrar disputa' : 'Disputa'}
                      </Botao>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </Tabela>
        {!lista.length && <p className="py-6 text-center text-sm text-slate-500">Nenhum título encontrado.</p>}
      </Painel>

      <Modal
        aberto={!!disputa}
        titulo={disputa?.situacao === 'disputado' ? `Encerrar disputa de ${disputa.numero}` : `Colocar ${disputa?.numero} em disputa`}
        descricao={disputa?.situacao === 'disputado' ? 'O título volta para a régua de cobrança.' : 'Mensagens pendentes do título serão canceladas e a régua fica suspensa.'}
        aoFechar={() => setDisputa(null)}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setDisputa(null)}>Cancelar</Botao>
            <Botao
              disabled={motivo.trim().length < 3}
              onClick={() => {
                if (!disputa) return;
                const r = despachar({ tipo: 'disputa', tituloId: disputa.id, ativa: disputa.situacao !== 'disputado', motivo });
                if (!r.erro) setDisputa(null);
              }}
            >
              Confirmar
            </Botao>
          </>
        }
      >
        <Campo rotulo="Motivo (obrigatório)">{(id) => <Texto id={id} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: cliente contesta cobrança do mês" />}</Campo>
      </Modal>
    </>
  );
}

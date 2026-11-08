import { useState } from 'react';
import { fmtDataHora } from '../../domain/datas';
import { baixarArquivo, paraCSV } from '../../store/selecoes';
import { useApp } from '../../store/store';
import { Botao, Cabecalho, Campo, Entrada, Painel, Selo, Tabela } from '../components/ui';

export function Auditoria() {
  const { estado } = useApp();
  const [busca, setBusca] = useState('');
  const [soBloqueadas, setSoBloqueadas] = useState(false);
  const termo = busca.trim().toLowerCase();
  const lista = estado.auditoria.filter(
    (a) => (!soBloqueadas || a.bloqueado) && (!termo || `${a.acao} ${a.alvo} ${a.detalhe ?? ''} ${a.usuario}`.toLowerCase().includes(termo)),
  );

  const exportar = () =>
    baixarArquivo(
      `auditoria_${estado.dataBase}.csv`,
      paraCSV([['Data/hora', 'Usuário', 'Ação', 'Alvo', 'Detalhe', 'Bloqueada'], ...lista.map((a) => [a.em, a.usuario, a.acao, a.alvo, a.detalhe ?? '', a.bloqueado ? 'sim' : 'não'])]),
    );

  return (
    <>
      <Cabecalho titulo="Auditoria" subtitulo="Registro imutável de todas as ações, inclusive tentativas bloqueadas por permissão ou regra de negócio." acoes={<Botao variante="secundario" onClick={exportar}>Exportar CSV</Botao>} />
      <Painel>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:w-80">
            <Campo rotulo="Buscar">{(id) => <Entrada id={id} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ação, alvo, usuário…" />}</Campo>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" className="size-4 accent-marca-600" checked={soBloqueadas} onChange={(e) => setSoBloqueadas(e.target.checked)} />
            Somente bloqueadas
          </label>
          <span className="pb-2 text-xs text-slate-500 sm:ml-auto">{lista.length} registro(s)</span>
        </div>
        <Tabela cabecalho={['Data/hora', 'Usuário', 'Ação', 'Alvo', 'Detalhe']}>
          {lista.slice(0, 500).map((a) => (
            <tr key={a.id} className={a.bloqueado ? 'bg-rose-50/50' : undefined}>
              <td className="num whitespace-nowrap px-4 py-2 text-xs text-slate-500">{fmtDataHora(a.em)}</td>
              <td className="whitespace-nowrap px-4 py-2 text-xs">{a.usuario}</td>
              <td className="px-4 py-2">
                <span className="font-medium">{a.acao}</span>
                {a.bloqueado && <Selo tom="vermelho" className="ml-2">bloqueada</Selo>}
              </td>
              <td className="num whitespace-nowrap px-4 py-2 text-xs">{a.alvo}</td>
              <td className="max-w-md px-4 py-2 text-xs text-slate-600">{a.detalhe}</td>
            </tr>
          ))}
        </Tabela>
      </Painel>
    </>
  );
}

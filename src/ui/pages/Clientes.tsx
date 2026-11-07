import { useState } from 'react';
import { brl } from '../../domain/dinheiro';
import { titulosVisao } from '../../store/selecoes';
import { useApp } from '../../store/store';
import { Cabecalho, Campo, Entrada, Painel, Selo, Tabela } from '../components/ui';

export function Clientes() {
  const { estado } = useApp();
  const [busca, setBusca] = useState('');
  const ts = titulosVisao(estado);
  const termo = busca.trim().toLowerCase();

  const linhas = estado.clientes
    .filter((c) => !termo || `${c.nome} ${c.documento} ${c.contato} ${c.contrato}`.toLowerCase().includes(termo))
    .map((c) => {
      const deles = ts.filter((t) => t.clienteId === c.id);
      const vencidos = deles.filter((t) => t.status === 'vencido');
      return {
        c,
        aberto: deles.filter((t) => t.status !== 'pago').reduce((s, t) => s + t.valor, 0),
        devido: vencidos.reduce((s, t) => s + t.atualizado, 0),
        vencidos: vencidos.length,
        maiorAtraso: Math.max(0, ...vencidos.map((t) => t.dias)),
        disputa: deles.some((t) => t.status === 'disputado'),
      };
    })
    .sort((a, b) => b.devido - a.devido);

  return (
    <>
      <Cabecalho titulo="Clientes e contratos" subtitulo="Exposição por cliente, com valor vencido já atualizado pelos encargos configurados." />
      <Painel>
        <div className="mb-4 max-w-sm">
          <Campo rotulo="Buscar">{(id) => <Entrada id={id} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, documento, contato ou contrato" />}</Campo>
        </div>
        <Tabela cabecalho={['Cliente', 'Contato', 'Contrato', 'Em aberto', 'Vencido atualizado', 'Risco']}>
          {linhas.map(({ c, aberto, devido, vencidos, maiorAtraso, disputa }) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <td className="px-4 py-2.5">
                <p className="font-medium">{c.nome}</p>
                <p className="num text-xs text-slate-500">{c.documento}</p>
              </td>
              <td className="px-4 py-2.5 text-xs">
                {c.contato}
                <span className="block text-slate-500">{c.telefone}</span>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-xs">
                {c.contrato}
                <span className="block text-slate-500">{c.plano}</span>
              </td>
              <td className="num whitespace-nowrap px-4 py-2.5">{brl(aberto)}</td>
              <td className="num whitespace-nowrap px-4 py-2.5 font-semibold">{devido ? brl(devido) : '—'}</td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <div className="flex flex-wrap gap-1">
                  {vencidos >= estado.config.limiteTitulosFila && <Selo tom="vermelho">{vencidos} vencidos</Selo>}
                  {vencidos > 0 && vencidos < estado.config.limiteTitulosFila && <Selo tom="ambar">{maiorAtraso}d atraso</Selo>}
                  {disputa && <Selo tom="roxo">disputa</Selo>}
                  {!vencidos && !disputa && <Selo tom="verde">em dia</Selo>}
                </div>
              </td>
            </tr>
          ))}
        </Tabela>
      </Painel>
    </>
  );
}

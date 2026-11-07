import { useMemo, useState } from 'react';
import { brl, lerValor, paraTexto, pct } from '../../domain/dinheiro';
import { ehDataISO, fmtData } from '../../domain/datas';
import { calcularEncargos, type ParametrosEncargos } from '../../domain/encargos';
import { formatarLinha, lerBoleto } from '../../domain/linhaDigitavel';
import { useApp } from '../../store/store';
import { parametroRota } from '../App';
import { Alerta, Botao, Cabecalho, Campo, Entrada, Painel, Selecao, Selo } from '../components/ui';

export function Simulador() {
  const { estado, avisar } = useApp();
  const tituloInicial = estado.titulos.find((t) => t.id === parametroRota('titulo'));
  const clienteInicial = estado.clientes.find((c) => c.id === tituloInicial?.clienteId);

  const [linha, setLinha] = useState(tituloInicial ? formatarLinha(tituloInicial.linhaDigitavel) : '');
  const [erroLinha, setErroLinha] = useState<string | null>(null);
  const [beneficiario, setBeneficiario] = useState(tituloInicial ? estado.config.nomeEmpresa : '');
  const [pagador, setPagador] = useState(clienteInicial?.nome ?? '');
  const [valorTxt, setValorTxt] = useState(tituloInicial ? paraTexto(tituloInicial.valor) : '');
  const [vencimento, setVencimento] = useState(tituloInicial?.vencimento ?? '');
  const [pagamento, setPagamento] = useState(estado.dataBase);
  const [p, setP] = useState<ParametrosEncargos>(estado.config.encargos);

  const valor = lerValor(valorTxt);
  const valido = valor !== null && valor > 0 && ehDataISO(vencimento) && ehDataISO(pagamento);
  const r = useMemo(() => (valido ? calcularEncargos(valor!, vencimento, pagamento, p) : null), [valido, valor, vencimento, pagamento, p]);

  const ler = () => {
    const res = lerBoleto(linha, estado.dataBase);
    if (!res.ok) {
      setErroLinha(res.erro);
      return;
    }
    setErroLinha(null);
    setLinha(formatarLinha(linha));
    setValorTxt(paraTexto(res.boleto.valor));
    if (res.boleto.vencimento) setVencimento(res.boleto.vencimento);
    avisar('sucesso', `Boleto do banco ${res.boleto.banco} lido: ${brl(res.boleto.valor)}${res.boleto.vencimento ? ` · venc. ${fmtData(res.boleto.vencimento)}` : ''}`);
  };

  const num = (k: keyof ParametrosEncargos) => (e: React.ChangeEvent<HTMLInputElement>) => setP({ ...p, [k]: Math.max(0, Number(e.target.value.replace(',', '.')) || 0) });

  const resumo = r
    ? [
        `Atualização de boleto — pagamento em ${fmtData(pagamento)}`,
        beneficiario && `Beneficiário: ${beneficiario}`,
        pagador && `Pagador: ${pagador}`,
        `Valor original: ${brl(r.valorOriginal)} · vencimento ${fmtData(vencimento)}`,
        r.emAtraso ? `Atraso: ${r.diasAtraso} dia(s)` : 'Pagamento em dia',
        r.correcao ? `Correção: ${brl(r.correcao)}` : '',
        r.multa ? `Multa (${pct(p.multaPct)}): ${brl(r.multa)}` : '',
        r.juros ? `Juros (${pct(p.jurosMesPct)} a.m.): ${brl(r.juros)}` : '',
        r.desconto ? `Desconto: −${brl(r.desconto)}` : '',
        `TOTAL A PAGAR: ${brl(r.total)}`,
      ].filter(Boolean).join('\n')
    : '';

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(resumo);
      avisar('sucesso', 'Resumo copiado');
    } catch {
      avisar('erro', 'Não foi possível acessar a área de transferência.');
    }
  };

  return (
    <>
      <Cabecalho
        titulo="Simulador de boleto"
        subtitulo="Cole a linha digitável para preencher valor e vencimento automaticamente (validação dos dígitos Febraban, sem IA e sem enviar dados para fora). Ajuste os encargos e gere o demonstrativo."
        acoes={
          <>
            <Botao variante="secundario" disabled={!r} onClick={copiar}>Copiar resumo</Botao>
            <Botao disabled={!r} onClick={() => window.print()}>Imprimir / salvar PDF</Botao>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="no-print space-y-4">
          <Painel titulo="1. Leitura do boleto">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Campo rotulo="Linha digitável ou código de barras" erro={erroLinha} ajuda="47 dígitos (linha) ou 44 (código de barras). Pontos e espaços são ignorados.">
                  {(id) => <Entrada id={id} value={linha} onChange={(e) => setLinha(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ler()} inputMode="numeric" placeholder="00190.00009 01234.567890 12345.678901 1 00000000000000" className="num font-mono text-xs" />}
                </Campo>
              </div>
              <Botao variante="secundario" onClick={ler} disabled={!linha.trim()} className="sm:mb-5">Ler boleto</Botao>
            </div>
          </Painel>

          <Painel titulo="2. Dados do título">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo rotulo="Beneficiário">{(id) => <Entrada id={id} value={beneficiario} onChange={(e) => setBeneficiario(e.target.value)} placeholder="Quem recebe" />}</Campo>
              <Campo rotulo="Pagador">{(id) => <Entrada id={id} value={pagador} onChange={(e) => setPagador(e.target.value)} placeholder="Quem paga" />}</Campo>
              <Campo rotulo="Valor original (R$)" erro={valorTxt && valor === null ? 'Valor inválido' : null}>
                {(id) => <Entrada id={id} value={valorTxt} onChange={(e) => setValorTxt(e.target.value)} inputMode="decimal" placeholder="0,00" className="num" />}
              </Campo>
              <div />
              <Campo rotulo="Vencimento">{(id) => <Entrada id={id} type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />}</Campo>
              <Campo rotulo="Data do pagamento">{(id) => <Entrada id={id} type="date" value={pagamento} onChange={(e) => setPagamento(e.target.value)} />}</Campo>
            </div>
          </Painel>

          <Painel titulo="3. Encargos" acao={<button type="button" className="text-xs font-medium text-marca-600 hover:underline" onClick={() => setP(estado.config.encargos)}>Usar padrão da empresa</button>}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Campo rotulo="Multa (%)">{(id) => <Entrada id={id} type="number" min={0} step={0.1} value={p.multaPct} onChange={num('multaPct')} />}</Campo>
              <Campo rotulo="Juros ao mês (%)">{(id) => <Entrada id={id} type="number" min={0} step={0.1} value={p.jurosMesPct} onChange={num('jurosMesPct')} />}</Campo>
              <Campo rotulo="Tipo de juros">
                {(id) => (
                  <Selecao id={id} value={p.tipoJuros} onChange={(e) => setP({ ...p, tipoJuros: e.target.value as ParametrosEncargos['tipoJuros'] })}>
                    <option value="simples">Simples (pro rata)</option>
                    <option value="composto">Compostos</option>
                  </Selecao>
                )}
              </Campo>
              <Campo rotulo="Correção ao mês (%)" ajuda="Índice informado (ex.: IPCA)">{(id) => <Entrada id={id} type="number" min={0} step={0.01} value={p.correcaoMesPct} onChange={num('correcaoMesPct')} />}</Campo>
              <Campo rotulo="Desconto até o venc. (%)">{(id) => <Entrada id={id} type="number" min={0} step={0.1} value={p.descontoPct} onChange={num('descontoPct')} />}</Campo>
              <label className="flex items-center gap-2 self-center text-xs text-slate-700">
                <input type="checkbox" className="size-4 accent-marca-600" checked={p.prorrogarDiaUtil} onChange={(e) => setP({ ...p, prorrogarDiaUtil: e.target.checked })} />
                Prorrogar para dia útil
              </label>
            </div>
          </Painel>
        </div>

        <div className="space-y-4">
          <section className={`rounded-2xl p-6 text-white shadow-lg ${r?.emAtraso ? 'bg-gradient-to-br from-slate-900 to-rose-900' : 'bg-gradient-to-br from-slate-900 to-marca-700'}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-white/80">Total a pagar em {ehDataISO(pagamento) ? fmtData(pagamento) : '—'}</p>
              {r && <Selo tom={r.emAtraso ? 'vermelho' : 'verde'}>{r.emAtraso ? `${r.diasAtraso} dia(s) de atraso` : 'Em dia'}</Selo>}
            </div>
            <p className="num mt-2 text-4xl font-bold">{r ? brl(r.total) : 'R$ —'}</p>
            <dl className="mt-6 space-y-2 border-t border-white/15 pt-4 text-sm">
              {[
                ['Valor original', r ? brl(r.valorOriginal) : '—'],
                ['Vencimento considerado', r ? fmtData(r.vencimentoEfetivo) : '—'],
                ['Correção monetária', r ? `+ ${brl(r.correcao)}` : '—'],
                [`Multa (${pct(p.multaPct)})`, r ? `+ ${brl(r.multa)}` : '—'],
                [`Juros (${pct(p.jurosMesPct)} a.m., ${p.tipoJuros})`, r ? `+ ${brl(r.juros)}` : '—'],
                ['Desconto', r ? `− ${brl(r.desconto)}` : '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-white/70">{k}</dt>
                  <dd className="num font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          {r && (
            <Painel titulo="Memória de cálculo">
              <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
                {r.memoria.map((m) => <li key={m}>{m}</li>)}
              </ol>
              {r.avisos.length > 0 && <div className="mt-3 space-y-2">{r.avisos.map((a) => <Alerta key={a}>{a}</Alerta>)}</div>}
              <p className="mt-3 text-xs text-slate-500">
                Valores arredondados ao centavo em cada componente. O demonstrativo vale apenas para a data de pagamento informada.
                {(beneficiario || pagador) && ` Beneficiário: ${beneficiario || '—'} · Pagador: ${pagador || '—'}.`}
              </p>
            </Painel>
          )}
          {!r && <Alerta tom="azul">Informe valor, vencimento e data de pagamento — ou leia a linha digitável — para ver o cálculo.</Alerta>}
        </div>
      </div>
    </>
  );
}

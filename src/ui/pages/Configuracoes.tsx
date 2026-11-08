import { useRef, useState } from 'react';
import type { ParametrosEncargos } from '../../domain/encargos';
import type { Configuracao, Estado, EtapaRegua, Perfil } from '../../domain/tipos';
import { PERFIS, temPermissao } from '../../store/motor';
import { baixarArquivo } from '../../store/selecoes';
import { useApp } from '../../store/store';
import { Alerta, Botao, Cabecalho, Campo, Entrada, Modal, Painel, Selecao, Texto } from '../components/ui';

const VARIAVEIS = '{contato} {cliente} {telefone} {numero} {valor} {valorAtualizado} {vencimento} {diasAtraso} {empresa} {linhaDigitavel}';

export function Configuracoes() {
  const { estado, despachar, restaurar, importar, avisar } = useApp();
  const [cfg, setCfg] = useState<Configuracao>(estado.config);
  const [data, setData] = useState(estado.dataBase);
  const [confirmarReset, setConfirmarReset] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const supervisor = temPermissao(estado.perfil, 'supervisao');
  const alterado = JSON.stringify(cfg) !== JSON.stringify(estado.config);

  const enc = (k: keyof ParametrosEncargos, v: number | string | boolean) => setCfg({ ...cfg, encargos: { ...cfg.encargos, [k]: v } });
  const etapa = (i: number, patch: Partial<EtapaRegua>) => setCfg({ ...cfg, regua: cfg.regua.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
  const n = (v: string) => Number(v.replace(',', '.')) || 0;

  const lerBackup = async (f: File | undefined) => {
    if (!f) return;
    try {
      const e = JSON.parse(await f.text()) as Estado;
      if (importar(e)) {
        setCfg(e.config);
        setData(e.dataBase);
      }
    } catch {
      avisar('erro', 'Arquivo não é um JSON válido.');
    } finally {
      if (arquivo.current) arquivo.current.value = '';
    }
  };

  return (
    <>
      <Cabecalho titulo="Configurações" subtitulo="Perfil de acesso, data-base, encargos padrão e régua de cobrança. Tudo fica salvo neste navegador." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Painel titulo="Sessão">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo rotulo="Perfil de acesso" ajuda="Operador: mensagens e conferência. Supervisor: tudo. Consulta: leitura.">
              {(id) => (
                <Selecao id={id} value={estado.perfil} onChange={(e) => despachar({ tipo: 'perfil', perfil: e.target.value as Perfil })}>
                  {(Object.keys(PERFIS) as Perfil[]).map((p) => <option key={p} value={p}>{PERFIS[p]}</option>)}
                </Selecao>
              )}
            </Campo>
            <Campo rotulo="Data-base" ajuda="Simule outro dia para ver a régua e os encargos mudarem.">
              {(id) => (
                <div className="flex gap-2">
                  <Entrada id={id} type="date" value={data} onChange={(e) => setData(e.target.value)} />
                  <Botao variante="secundario" disabled={data === estado.dataBase} onClick={() => despachar({ tipo: 'dataBase', data })}>Aplicar</Botao>
                </div>
              )}
            </Campo>
          </div>
        </Painel>

        <Painel titulo="Dados e backup">
          <div className="flex flex-wrap gap-2">
            <Botao variante="secundario" onClick={() => baixarArquivo(`central-financeira-backup-${estado.dataBase}.json`, JSON.stringify(estado, null, 2), 'application/json')}>Exportar backup (JSON)</Botao>
            <Botao variante="secundario" onClick={() => arquivo.current?.click()}>Importar backup</Botao>
            <input ref={arquivo} type="file" accept="application/json" className="hidden" onChange={(e) => lerBackup(e.target.files?.[0])} />
            <Botao variante="perigo" onClick={() => setConfirmarReset(true)}>Restaurar demonstração</Botao>
          </div>
          <p className="mt-3 text-xs text-slate-500">Os dados ficam no armazenamento local do navegador; nenhuma informação é enviada a servidores.</p>
        </Painel>
      </div>

      <Painel titulo="Parâmetros da empresa" className="mt-4">
        {!supervisor && <div className="mb-3"><Alerta>Somente o perfil Supervisor pode salvar alterações de parâmetros.</Alerta></div>}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Campo rotulo="Nome da empresa">{(id) => <Entrada id={id} value={cfg.nomeEmpresa} onChange={(e) => setCfg({ ...cfg, nomeEmpresa: e.target.value })} />}</Campo>
          <Campo rotulo="Multa (%)">{(id) => <Entrada id={id} type="number" min={0} step={0.1} value={cfg.encargos.multaPct} onChange={(e) => enc('multaPct', n(e.target.value))} />}</Campo>
          <Campo rotulo="Juros ao mês (%)">{(id) => <Entrada id={id} type="number" min={0} step={0.1} value={cfg.encargos.jurosMesPct} onChange={(e) => enc('jurosMesPct', n(e.target.value))} />}</Campo>
          <Campo rotulo="Tipo de juros">
            {(id) => (
              <Selecao id={id} value={cfg.encargos.tipoJuros} onChange={(e) => enc('tipoJuros', e.target.value)}>
                <option value="simples">Simples (pro rata)</option>
                <option value="composto">Compostos</option>
              </Selecao>
            )}
          </Campo>
          <Campo rotulo="Correção ao mês (%)">{(id) => <Entrada id={id} type="number" min={0} step={0.01} value={cfg.encargos.correcaoMesPct} onChange={(e) => enc('correcaoMesPct', n(e.target.value))} />}</Campo>
          <Campo rotulo="Desconto até o venc. (%)">{(id) => <Entrada id={id} type="number" min={0} step={0.1} value={cfg.encargos.descontoPct} onChange={(e) => enc('descontoPct', n(e.target.value))} />}</Campo>
          <Campo rotulo="Fila humana a partir de" ajuda="títulos vencidos por cliente (0 = desliga)">
            {(id) => <Entrada id={id} type="number" min={0} value={cfg.limiteTitulosFila} onChange={(e) => setCfg({ ...cfg, limiteTitulosFila: Math.max(0, Math.floor(n(e.target.value))) })} />}
          </Campo>
          <label className="flex items-center gap-2 self-center text-sm">
            <input type="checkbox" className="size-4 accent-marca-600" checked={cfg.encargos.prorrogarDiaUtil} onChange={(e) => enc('prorrogarDiaUtil', e.target.checked)} />
            Prorrogar vencimento para dia útil
          </label>
        </div>

        <h3 className="mt-6 text-sm font-semibold">Régua de cobrança</h3>
        <p className="mt-1 text-xs text-slate-500">Variáveis disponíveis nos modelos: <code className="text-[11px]">{VARIAVEIS}</code></p>
        <div className="mt-3 space-y-3">
          {cfg.regua.map((e, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-3">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-[6rem_1fr_6rem_6rem_auto_auto]">
                <Campo rotulo="Código">{(id) => <Entrada id={id} value={e.id} onChange={(ev) => etapa(i, { id: ev.target.value })} />}</Campo>
                <Campo rotulo="Nome">{(id) => <Entrada id={id} value={e.nome} onChange={(ev) => etapa(i, { nome: ev.target.value })} />}</Campo>
                <Campo rotulo="Dias (±)">{(id) => <Entrada id={id} type="number" value={e.offset} onChange={(ev) => etapa(i, { offset: Math.trunc(n(ev.target.value)) })} />}</Campo>
                <Campo rotulo="Hora">{(id) => <Entrada id={id} type="time" value={e.hora} onChange={(ev) => etapa(i, { hora: ev.target.value })} />}</Campo>
                <div className="flex flex-col justify-end gap-1 pb-1 text-xs">
                  <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-marca-600" checked={e.ativa} onChange={(ev) => etapa(i, { ativa: ev.target.checked })} /> Ativa</label>
                  <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-marca-600" checked={e.filaHumana} onChange={(ev) => etapa(i, { filaHumana: ev.target.checked })} /> Fila humana</label>
                </div>
                <div className="flex items-end pb-0.5">
                  <Botao tamanho="sm" variante="alerta" onClick={() => setCfg({ ...cfg, regua: cfg.regua.filter((_, j) => j !== i) })}>Remover</Botao>
                </div>
              </div>
              <div className="mt-2">
                <Campo rotulo="Modelo da mensagem">{(id) => <Texto id={id} rows={2} value={e.modelo} onChange={(ev) => etapa(i, { modelo: ev.target.value })} />}</Campo>
              </div>
            </div>
          ))}
          <Botao variante="secundario" tamanho="sm" onClick={() => setCfg({ ...cfg, regua: [...cfg.regua, { id: `D+${30}`, nome: 'Nova etapa', offset: 30, hora: '10:00', ativa: true, filaHumana: false, modelo: 'Olá, {contato}. O título {numero} está em aberto ({valorAtualizado}).' }] })}>
            Adicionar etapa
          </Botao>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <Botao disabled={!supervisor || !alterado} onClick={() => despachar({ tipo: 'config', config: { ...cfg, regua: cfg.regua.map((e) => ({ ...e, id: e.id.trim() })) } })}>Salvar parâmetros</Botao>
          <Botao variante="secundario" disabled={!alterado} onClick={() => setCfg(estado.config)}>Descartar alterações</Botao>
        </div>
      </Painel>

      <Modal
        aberto={confirmarReset}
        titulo="Restaurar dados de demonstração?"
        descricao="Todos os títulos, comprovantes, mensagens, auditoria e parâmetros atuais serão substituídos. Exporte um backup antes se quiser guardar."
        aoFechar={() => setConfirmarReset(false)}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setConfirmarReset(false)}>Cancelar</Botao>
            <Botao variante="perigo" onClick={() => { restaurar(); setConfirmarReset(false); window.location.hash = '#/painel'; }}>Restaurar</Botao>
          </>
        }
      />
    </>
  );
}

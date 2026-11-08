import { describe, expect, it } from 'vitest';
import { executar, type Acao } from './motor';
import { criarEstadoInicial } from './seed';
import { statusTitulo } from '../domain/regua';
import type { Estado } from '../domain/tipos';

const AGORA = '2026-11-07T12:00:00.000Z';
const novo = () => criarEstadoInicial('2026-11-07', AGORA);

function rodar(estado: Estado, ...acoes: Acao[]) {
  let s = estado;
  let ultimo;
  for (const a of acoes) {
    ultimo = executar(s, a, AGORA);
    s = ultimo.estado;
  }
  return { estado: s, ultimo: ultimo! };
}

describe('motor', () => {
  it('propõe mensagens sem duplicar ao recalcular', () => {
    const { estado } = rodar(novo(), { tipo: 'recalcularRegua' });
    const total = estado.mensagens.length;
    expect(total).toBeGreaterThan(0);
    const chaves = new Set(estado.mensagens.map((m) => m.chave));
    expect(chaves.size).toBe(total);
    const r = rodar(estado, { tipo: 'recalcularRegua' });
    expect(r.estado.mensagens.length).toBe(total);
  });

  it('não propõe mensagem para título pago, disputado ou em conferência', () => {
    const { estado } = rodar(novo(), { tipo: 'recalcularRegua' });
    const ids = new Set(estado.mensagens.map((m) => m.tituloId));
    expect(ids.has('T13')).toBe(false); // pago
    expect(ids.has('T15')).toBe(false); // disputado
    expect(ids.has('T3')).toBe(false); // comprovante divergente vinculado
    expect(ids.has('T6')).toBe(false); // agendamento vinculado
  });

  it('agrupa clientes com 2+ títulos vencidos na fila humana', () => {
    const { estado } = rodar(novo(), { tipo: 'recalcularRegua' });
    const agrupadas = estado.mensagens.filter((m) => m.etapaId === 'AGRUPADA');
    expect(agrupadas.map((m) => m.clienteId).sort()).toEqual(['C004', 'C008']);
  });

  it('bloqueia e audita ações sem permissão', () => {
    const s0 = rodar(novo(), { tipo: 'perfil', perfil: 'consulta' }).estado;
    const r = executar(s0, { tipo: 'recalcularRegua' }, AGORA);
    expect(r.erro).toBeDefined();
    expect(r.estado.auditoria[0]).toMatchObject({ bloqueado: true });
    const op = rodar(novo(), { tipo: 'perfil', perfil: 'operador' }).estado;
    expect(executar(op, { tipo: 'disputa', tituloId: 'T1', ativa: true, motivo: 'teste' }, AGORA).erro).toBeDefined();
  });

  it('exige motivo para rejeitar/adiar mensagem', () => {
    const s = rodar(novo(), { tipo: 'recalcularRegua' }).estado;
    const m = s.mensagens[0]!;
    expect(executar(s, { tipo: 'decidirMensagem', id: m.id, decisao: 'rejeitar' }, AGORA).erro).toBeDefined();
    expect(executar(s, { tipo: 'decidirMensagem', id: m.id, decisao: 'rejeitar', nota: 'cliente pagou' }, AGORA).erro).toBeUndefined();
  });

  it('fluxo completo: vincular → conferir → confirmar → baixa cancela mensagens', () => {
    let s = rodar(novo(), { tipo: 'recalcularRegua' }).estado;
    expect(s.mensagens.some((m) => m.tituloId === 'T2' && m.status === 'pendente')).toBe(true);
    const r1 = rodar(s, { tipo: 'vincular', id: 'CP-001', tituloId: 'T2' });
    expect(r1.ultimo.erro).toBeUndefined();
    s = r1.estado;
    expect(statusTitulo(s.titulos.find((t) => t.id === 'T2')!, s.dataBase, s.comprovantes)).toBe('em_conferencia');
    expect(executar(s, { tipo: 'confirmarCredito', id: 'CP-001' }, AGORA).erro).toMatch(/extrato/);
    s = rodar(s, { tipo: 'conferir', id: 'CP-001', conferido: true }, { tipo: 'confirmarCredito', id: 'CP-001' }, { tipo: 'registrarBaixa', id: 'CP-001' }).estado;
    expect(s.titulos.find((t) => t.id === 'T2')!.situacao).toBe('pago');
    expect(s.mensagens.filter((m) => m.tituloId === 'T2').every((m) => m.status === 'cancelada')).toBe(true);
  });

  it('reconhece pagamento com encargos como valor correto', () => {
    const { estado, ultimo } = rodar(novo(), { tipo: 'vincular', id: 'CP-007', tituloId: 'T9' });
    expect(ultimo.erro).toBeUndefined();
    expect(estado.comprovantes.find((c) => c.id === 'CP-007')!.estado).toBe('em_conferencia');
  });

  it('marca duplicado ao registrar comprovante com EndToEndId repetido', () => {
    const { estado } = rodar(novo(), {
      tipo: 'novoComprovante',
      dados: { pagador: 'Alguém', valor: 100, dataPagamento: '2026-11-07', tipo: 'efetivado', endToEndId: 'e0000000020260005', banco: 'b', canal: 'c', terceiro: false },
    });
    expect(estado.comprovantes[0]!.estado).toBe('duplicado');
  });

  it('divergência só é confirmada após aceite do supervisor', () => {
    let s = rodar(novo(), { tipo: 'conferir', id: 'CP-003', conferido: true }).estado;
    expect(executar(s, { tipo: 'confirmarCredito', id: 'CP-003' }, AGORA).erro).toBeDefined();
    s = rodar(s, { tipo: 'aceitarDivergencia', id: 'CP-003', motivo: 'pagamento parcial acordado' }, { tipo: 'confirmarCredito', id: 'CP-003' }).estado;
    expect(s.comprovantes.find((c) => c.id === 'CP-003')!.estado).toBe('credito_confirmado');
  });

  it('impede dois comprovantes ativos no mesmo título', () => {
    const r = executar(novo(), { tipo: 'vincular', id: 'CP-001', tituloId: 'T3' }, AGORA);
    expect(r.erro).toMatch(/Outro comprovante/);
  });
});

import { describe, expect, it } from 'vitest';
import { lerValor } from './dinheiro';
import { ehDiaUtil, feriadosBancarios, pascoa, proximoDiaUtil } from './datas';
import { ENCARGOS_PADRAO, calcularEncargos } from './encargos';
import { codigoBarrasParaLinha, fatorParaData, gerarCodigoBarras, lerBoleto, modulo10, modulo11Boleto } from './linhaDigitavel';
import { etapaAplicavel, preencherModelo, REGUA_PADRAO } from './regua';
import { ehDuplicado, podeConfirmarCredito, similaridadeNome } from './conciliacao';
import type { Comprovante } from './tipos';

describe('dinheiro', () => {
  it('lê valores em formato brasileiro e internacional', () => {
    expect(lerValor('1.234,56')).toBe(123456);
    expect(lerValor('R$ 10')).toBe(1000);
    expect(lerValor('99.9')).toBe(9990);
    expect(lerValor('abc')).toBeNull();
    expect(lerValor('1,234')).toBeNull();
  });
});

describe('datas e dias úteis', () => {
  it('calcula a Páscoa', () => {
    expect(pascoa(2025)).toBe('2025-04-20');
    expect(pascoa(2026)).toBe('2026-04-05');
  });
  it('inclui feriados móveis e Consciência Negra', () => {
    const f = feriadosBancarios(2026);
    expect(f.has('2026-02-16')).toBe(true); // segunda de Carnaval
    expect(f.has('2026-04-03')).toBe(true); // Sexta-feira Santa
    expect(f.has('2026-06-04')).toBe(true); // Corpus Christi
    expect(f.has('2026-11-20')).toBe(true);
  });
  it('prorroga para o próximo dia útil', () => {
    expect(ehDiaUtil('2026-11-07')).toBe(false); // sábado
    expect(proximoDiaUtil('2026-11-14')).toBe('2026-11-16'); // sáb → seg (15/11 é domingo e feriado)
    expect(proximoDiaUtil('2026-11-20')).toBe('2026-11-23'); // feriado sexta → segunda
  });
});

describe('encargos', () => {
  it('não cobra encargos até o vencimento', () => {
    const r = calcularEncargos(10000, '2026-11-10', '2026-11-10', ENCARGOS_PADRAO);
    expect(r).toMatchObject({ emAtraso: false, total: 10000, multa: 0, juros: 0 });
  });
  it('vencimento no sábado pago na segunda não tem encargos', () => {
    const r = calcularEncargos(10000, '2026-11-07', '2026-11-09', ENCARGOS_PADRAO);
    expect(r.emAtraso).toBe(false);
    const semProrrogar = calcularEncargos(10000, '2026-11-07', '2026-11-09', { ...ENCARGOS_PADRAO, prorrogarDiaUtil: false });
    expect(semProrrogar.emAtraso).toBe(true);
  });
  it('aplica multa de 2% e juros simples de 1% a.m. pro rata', () => {
    const r = calcularEncargos(100000, '2026-10-01', '2026-10-31', ENCARGOS_PADRAO);
    expect(r.diasAtraso).toBe(30);
    expect(r.multa).toBe(2000);
    expect(r.juros).toBe(1000);
    expect(r.total).toBe(103000);
  });
  it('aplica juros compostos e correção', () => {
    const r = calcularEncargos(100000, '2026-01-01', '2026-03-02', { ...ENCARGOS_PADRAO, tipoJuros: 'composto', correcaoMesPct: 0.5 });
    expect(r.diasAtraso).toBe(60);
    expect(r.correcao).toBe(1003); // 1000,00 × (1,005² − 1)
    expect(r.juros).toBe(2030); // 1.010,03 × (1,01² − 1) = 20,30
  });
  it('aplica desconto até o vencimento e avisa limites legais', () => {
    const r = calcularEncargos(10000, '2026-11-10', '2026-11-05', { ...ENCARGOS_PADRAO, descontoPct: 5, multaPct: 10 });
    expect(r.desconto).toBe(500);
    expect(r.total).toBe(9500);
    expect(r.avisos.length).toBe(1);
  });
});

describe('linha digitável', () => {
  it('calcula módulo 10 e 11', () => {
    expect(modulo10('001905009')).toBe(5);
    expect(modulo11Boleto('0019373700000001000500940144816060680935031')).toBe(3);
  });
  it('converte fator de vencimento nos dois ciclos', () => {
    expect(fatorParaData(1000, '2000-07-01')).toBe('2000-07-03');
    expect(fatorParaData(9999, '2025-02-01')).toBe('2025-02-21');
    expect(fatorParaData(1000, '2025-03-01')).toBe('2025-02-22');
    expect(fatorParaData(0, '2025-03-01')).toBeNull();
  });
  it('lê uma linha digitável válida (ida e volta)', () => {
    const cb = gerarCodigoBarras('341', 1000 + 623, 123456, '1234567890123456789012345');
    const linha = codigoBarrasParaLinha(cb);
    expect(linha).toHaveLength(47);
    const r = lerBoleto(linha, '2026-11-01');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.boleto).toMatchObject({ banco: '341', valor: 123456, codigoBarras: cb, vencimento: '2026-11-07' });
    }
    expect(lerBoleto(cb, '2026-11-01').ok).toBe(true);
  });
  it('rejeita dígito errado e boletos de convênio', () => {
    const linha = codigoBarrasParaLinha(gerarCodigoBarras('341', 2000, 100, '1'));
    const errada = linha.slice(0, 12) + ((Number(linha[12]) + 1) % 10) + linha.slice(13);
    expect(lerBoleto(errada, '2026-01-01').ok).toBe(false);
    expect(lerBoleto('8'.repeat(48), '2026-01-01').ok).toBe(false);
    expect(lerBoleto('123', '2026-01-01').ok).toBe(false);
  });
});

describe('régua', () => {
  it('escolhe a etapa correta', () => {
    const id = (d: number) => etapaAplicavel(d, REGUA_PADRAO)?.id ?? null;
    expect(id(-10)).toBeNull();
    expect(id(-3)).toBe('D-3');
    expect(id(-1)).toBe('D-3');
    expect(id(0)).toBeNull();
    expect(id(1)).toBe('D+1');
    expect(id(6)).toBe('D+1');
    expect(id(7)).toBe('D+7');
    expect(id(40)).toBe('D+15');
  });
  it('ignora etapas inativas e preenche modelos', () => {
    const etapas = REGUA_PADRAO.map((e) => (e.id === 'D+7' ? { ...e, ativa: false } : e));
    expect(etapaAplicavel(8, etapas)?.id).toBe('D+1');
    expect(preencherModelo('Olá {a}, {b} {x}', { a: 'Ana', b: 2 })).toBe('Olá Ana, 2 {x}');
  });
});

describe('conciliação', () => {
  const base: Comprovante = {
    id: 'X1', recebidoEm: '2026-11-07T10:00:00Z', canal: 'x', pagador: 'P', valor: 100, dataPagamento: '2026-11-07',
    tipo: 'efetivado', endToEndId: 'E1', banco: 'b', estado: 'em_conferencia', tituloId: 'T1', creditoConferido: true,
    terceiro: false, terceiroValidado: false, divergenciaAceita: false, notas: [],
  };
  it('compara nomes ignorando acentos e sufixos', () => {
    expect(similaridadeNome('LOGISTICA DEMONSTRACAO BETA', 'Logística Demonstração Beta ME')).toBe(1);
    expect(similaridadeNome('FULANO', 'Logística Beta')).toBe(0);
  });
  it('detecta duplicidade pela ordem de recebimento', () => {
    const anterior = { ...base, id: 'X0', recebidoEm: '2026-11-07T09:00:00Z', endToEndId: 'e1' };
    expect(ehDuplicado(base, [anterior, base])).toBe(true);
    expect(ehDuplicado(anterior, [anterior, base])).toBe(false);
    expect(ehDuplicado(base, [{ ...anterior, estado: 'rejeitado' }, base])).toBe(false);
  });
  it('exige conferência humana, terceiro validado e não aceita agendamento', () => {
    expect(podeConfirmarCredito(base).ok).toBe(true);
    expect(podeConfirmarCredito({ ...base, creditoConferido: false }).ok).toBe(false);
    expect(podeConfirmarCredito({ ...base, tipo: 'agendado' }).ok).toBe(false);
    expect(podeConfirmarCredito({ ...base, terceiro: true }).ok).toBe(false);
    expect(podeConfirmarCredito({ ...base, estado: 'divergente' }).ok).toBe(false);
    expect(podeConfirmarCredito({ ...base, estado: 'divergente', divergenciaAceita: true }).ok).toBe(true);
  });
});

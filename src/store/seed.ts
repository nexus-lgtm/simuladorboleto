import { type DataISO, diferencaDias, somarDias } from '../domain/datas';
import { ENCARGOS_PADRAO, calcularEncargos } from '../domain/encargos';
import { codigoBarrasParaLinha, gerarCodigoBarras } from '../domain/linhaDigitavel';
import { REGUA_PADRAO } from '../domain/regua';
import type { Cliente, Comprovante, Configuracao, Estado, Titulo } from '../domain/tipos';

export const CONFIG_PADRAO: Configuracao = {
  encargos: ENCARGOS_PADRAO,
  regua: REGUA_PADRAO,
  limiteTitulosFila: 2,
  nomeEmpresa: 'Sua Empresa',
};

const NOMES: [string, string][] = [
  ['Transportadora Fictícia Alfa Ltda', 'Marina Exemplo'],
  ['Logística Demonstração Beta ME', 'Carlos Teste'],
  ['Frota Imaginária Gama S/A', 'Juliana Modelo'],
  ['Entregas Simuladas Delta EIRELI', 'Rafael Fictício'],
  ['Agro Exemplo Épsilon Ltda', 'Patrícia Amostra'],
  ['Locadora Protótipo Zeta', 'Bruno Demo'],
  ['Mudanças Teste Eta ME', 'Fernanda Simulada'],
  ['Cooperativa Fictícia Theta', 'Diego Placeholder'],
  ['Distribuidora Modelo Iota', 'Aline Exemplo'],
  ['Táxi Demonstração Kappa', 'Marcos Teste'],
];
const PLANOS = ['Plano Básico', 'Plano Intermediário', 'Plano Completo'];
const VEICULOS = [3, 12, 40, 7, 18, 25, 5, 60, 9, 4];
const UNIT = [5990, 7990, 9990];

/** [índice do cliente, dias do vencimento em relação à data-base] */
const PLANO_TITULOS: [number, number][] = [
  [0, 3], [1, -1], [2, -7], [3, -15], [3, -45], [4, 3], [5, -1], [6, 10],
  [7, -9], [7, -38], [8, 2], [9, -20], [0, -30], [6, -7], [8, -4],
];

export function linhaFicticia(valor: number, vencimento: DataISO, seq: number): string {
  const fator = 1000 + diferencaDias('2025-02-22', vencimento);
  const cb = gerarCodigoBarras('999', fator > 999 && fator < 10000 ? fator : 0, valor, `DEMO${seq}`.replace(/\D/g, '').padStart(25, '7'));
  return codigoBarrasParaLinha(cb);
}

export function criarEstadoInicial(dataBase: DataISO, agora: string): Estado {
  const clientes: Cliente[] = NOMES.map(([nome, contato], i) => ({
    id: `C${String(i + 1).padStart(3, '0')}`,
    nome,
    documento: `00.000.${String(100 + i)}/0001-00`,
    contato,
    telefone: `(00) 90000-${String(1000 + i * 37)}`,
    email: `financeiro${i + 1}@exemplo.invalid`,
    contrato: `CTR-${String(i + 1).padStart(4, '0')}`,
    plano: PLANOS[i % 3]!,
  }));

  const titulos: Titulo[] = PLANO_TITULOS.map(([ci, off], i) => {
    const c = clientes[ci]!;
    const valor = VEICULOS[ci]! * UNIT[ci % 3]!;
    const vencimento = somarDias(dataBase, off);
    return {
      id: `T${i + 1}`,
      clienteId: c.id,
      numero: `TIT-${4100 + i}`,
      competencia: vencimento.slice(5, 7) + '/' + vencimento.slice(0, 4),
      valor,
      vencimento,
      situacao: 'em_aberto',
      linhaDigitavel: linhaFicticia(valor, vencimento, i + 1),
    };
  });
  const t = (n: number) => titulos[n - 1]!;
  Object.assign(t(13), { situacao: 'pago', pagoEm: somarDias(dataBase, -1), valorPago: t(13).valor });
  t(15).situacao = 'disputado';

  const recebido = (minAtras: number) => new Date(new Date(agora).getTime() - minAtras * 60_000).toISOString();
  const base = {
    canal: 'WhatsApp', tipo: 'efetivado' as const, banco: 'Banco Fictício', creditoConferido: false,
    terceiro: false, terceiroValidado: false, divergenciaAceita: false, notas: [] as string[], tituloId: null,
  };
  const comprovantes: Comprovante[] = [
    { ...base, id: 'CP-001', recebidoEm: recebido(240), pagador: 'LOGISTICA DEMONSTRACAO BETA', valor: t(2).valor, dataPagamento: dataBase, endToEndId: 'E0000000020260001', estado: 'recebido' },
    { ...base, id: 'CP-002', recebidoEm: recebido(200), pagador: 'AGRO EXEMPLO EPSILON', valor: t(6).valor, dataPagamento: somarDias(dataBase, 2), tipo: 'agendado', endToEndId: 'E0000000020260002', estado: 'agendado', tituloId: 'T6', notas: ['Comprovante de AGENDAMENTO — não representa quitação.'] },
    { ...base, id: 'CP-003', canal: 'E-mail', recebidoEm: recebido(180), pagador: 'FROTA IMAGINARIA GAMA', valor: t(3).valor - 15000, dataPagamento: somarDias(dataBase, -1), endToEndId: 'E0000000020260003', estado: 'divergente', tituloId: 'T3', notas: ['Valor pago diferente do título e do valor atualizado.'] },
    { ...base, id: 'CP-004', recebidoEm: recebido(150), pagador: 'LOGISTICA DEMONSTRACAO BETA', valor: t(2).valor, dataPagamento: dataBase, endToEndId: 'E0000000020260001', estado: 'duplicado', notas: ['EndToEndId já recebido em CP-001.'] },
    { ...base, id: 'CP-005', recebidoEm: recebido(120), pagador: 'M. TESTE', valor: t(12).valor, dataPagamento: somarDias(dataBase, -2), endToEndId: 'E0000000020260005', estado: 'recebido', terceiro: true, notas: ['Pagamento feito por terceiro — vínculo exige validação humana.'] },
    { ...base, id: 'CP-006', canal: 'E-mail', recebidoEm: recebido(1500), pagador: 'TRANSPORTADORA FICTICIA ALFA', valor: t(13).valor, dataPagamento: somarDias(dataBase, -1), endToEndId: 'E0000000020260006', estado: 'baixa_registrada', tituloId: 'T13', creditoConferido: true, notas: ['Crédito conferido e baixa registrada (simulação).'] },
    { ...base, id: 'CP-007', recebidoEm: recebido(60), pagador: 'COOPERATIVA FICTICIA THETA', valor: calcularEncargos(t(9).valor, t(9).vencimento, dataBase, ENCARGOS_PADRAO).total, dataPagamento: dataBase, endToEndId: 'E0000000020260007', estado: 'recebido', notas: ['Valor pago já inclui multa e juros do título T9.'] },
  ];

  return {
    versao: 1,
    dataBase,
    perfil: 'supervisor',
    config: CONFIG_PADRAO,
    clientes,
    titulos,
    mensagens: [],
    comprovantes,
    auditoria: [{ id: 'A1', em: agora, usuario: 'Sistema', acao: 'Base de demonstração criada', alvo: 'Dados fictícios' }],
    seq: 100,
  };
}

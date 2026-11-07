import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { executar } from '../store/motor';
import { criarEstadoInicial } from '../store/seed';
import { ProvedorEstado } from '../store/store';
import { App, ROTAS } from './App';

window.scrollTo = () => {};
const AGORA = '2026-11-07T12:00:00.000Z';
const estado = () => executar(criarEstadoInicial('2026-11-07', AGORA), { tipo: 'recalcularRegua' }, AGORA).estado;

function montar(rota: string) {
  window.location.hash = `#/${rota}`;
  return render(
    <ProvedorEstado inicial={estado()}>
      <App />
    </ProvedorEstado>,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('interface', () => {
  it.each(ROTAS.map((r) => [r.caminho, r.nome]))('renderiza a tela %s', (caminho, nome) => {
    montar(caminho);
    expect(screen.getAllByText(nome).length).toBeGreaterThan(0);
  });

  it('simulador lê a linha digitável do título e calcula encargos', () => {
    montar('simulador?titulo=T4'); // vencido há 15 dias
    expect(screen.getByText('15 dia(s) de atraso')).toBeTruthy();
    expect(screen.getByText(/dia\(s\) de atraso desde o vencimento original/)).toBeTruthy();
  });

  it('aprovar mensagem muda o status e registra auditoria', () => {
    montar('aprovacoes');
    const antes = screen.getAllByRole('button', { name: 'Aprovar' }).length;
    act(() => fireEvent.click(screen.getAllByRole('button', { name: 'Aprovar' })[0]!));
    expect(screen.getAllByRole('button', { name: 'Aprovar' }).length).toBe(antes - 1);
    expect(screen.getByText(/pronta para envio manual/)).toBeTruthy();
  });

  it('perfil consulta não consegue aprovar', () => {
    montar('configuracoes');
    act(() => fireEvent.change(screen.getByLabelText('Perfil de acesso'), { target: { value: 'consulta' } }));
    act(() => { window.location.hash = '#/aprovacoes'; window.dispatchEvent(new HashChangeEvent('hashchange')); });
    const botoes = screen.getAllByRole('button', { name: 'Aprovar' }) as HTMLButtonElement[];
    expect(botoes.every((b) => b.disabled)).toBe(true);
  });
});

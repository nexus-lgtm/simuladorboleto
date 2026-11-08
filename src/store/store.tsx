import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { hojeLocal } from '../domain/datas';
import type { Estado } from '../domain/tipos';
import { executar, type Acao, type Resultado } from './motor';
import { criarEstadoInicial } from './seed';

const CHAVE = 'central-financeira:v1';

export function carregar(): Estado {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) {
      const e = JSON.parse(bruto) as Estado;
      if (e?.versao === 1 && Array.isArray(e.titulos)) return e;
    }
  } catch {
    /* armazenamento indisponível ou corrompido: recomeça com a demonstração */
  }
  return executar(criarEstadoInicial(hojeLocal(), new Date().toISOString()), { tipo: 'recalcularRegua' }, new Date().toISOString()).estado;
}

function salvar(e: Estado) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(e));
  } catch {
    /* ignora: a aplicação segue funcionando em memória */
  }
}

export interface Aviso {
  id: number;
  tipo: 'sucesso' | 'erro';
  texto: string;
}

interface Ctx {
  estado: Estado;
  despachar: (a: Acao) => Resultado;
  restaurar: () => void;
  importar: (e: Estado) => boolean;
  avisos: Aviso[];
  avisar: (tipo: Aviso['tipo'], texto: string) => void;
}

const Contexto = createContext<Ctx | null>(null);

export function ProvedorEstado({ children, inicial }: { children: ReactNode; inicial?: Estado }) {
  const [estado, setEstado] = useState<Estado>(() => inicial ?? carregar());
  const ref = useRef(estado);
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  useEffect(() => {
    ref.current = estado;
    salvar(estado);
  }, [estado]);

  const avisar = useCallback((tipo: Aviso['tipo'], texto: string) => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a.slice(-3), { id, tipo, texto }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 4000);
  }, []);

  const despachar = useCallback(
    (a: Acao) => {
      const r = executar(ref.current, a, new Date().toISOString());
      ref.current = r.estado;
      setEstado(r.estado);
      if (r.erro) avisar('erro', r.erro);
      else if (r.sucesso) avisar('sucesso', r.sucesso);
      return r;
    },
    [avisar],
  );

  const restaurar = useCallback(() => {
    const agora = new Date().toISOString();
    const e = executar(criarEstadoInicial(hojeLocal(), agora), { tipo: 'recalcularRegua' }, agora).estado;
    ref.current = e;
    setEstado(e);
    avisar('sucesso', 'Dados de demonstração restaurados');
  }, [avisar]);

  const importar = useCallback(
    (e: Estado) => {
      if (e?.versao !== 1 || !Array.isArray(e.titulos) || !Array.isArray(e.clientes)) {
        avisar('erro', 'Arquivo de backup inválido.');
        return false;
      }
      ref.current = e;
      setEstado(e);
      avisar('sucesso', 'Backup importado');
      return true;
    },
    [avisar],
  );

  return <Contexto.Provider value={{ estado, despachar, restaurar, importar, avisos, avisar }}>{children}</Contexto.Provider>;
}

export function useApp() {
  const c = useContext(Contexto);
  if (!c) throw new Error('useApp fora do ProvedorEstado');
  return c;
}

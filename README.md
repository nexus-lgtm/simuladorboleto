# Central Financeira — Simulador

Sistema de cobrança e conciliação que roda 100% no navegador. Ele junta duas coisas:

- o **simulador de boleto** deste repositório (atualização de valores com multa e juros);
- a **central financeira** do protótipo Lovable (régua de cobrança, aprovações, conciliação PIX e auditoria).

Nenhuma mensagem é enviada e nenhum ERP é alterado. Os dados são fictícios e ficam no `localStorage` do navegador.

## Funcionalidades

| Tela | O que faz |
| --- | --- |
| **Painel** | Mostra a carteira em aberto, o vencido com encargos, o aging (a vencer, 1–15, 16–30, 31–60 e 60+ dias), os títulos por situação, os maiores atrasos e a auditoria recente. |
| **Simulador de boleto** | Lê a linha digitável (47 dígitos) ou o código de barras (44) e valida os DVs módulo 10/11 da Febraban. O fator de vencimento é tratado nos dois ciclos (antes e depois de 22/02/2025). Calcula multa, juros simples ou compostos, correção e desconto, mostra a memória de cálculo e gera PDF pela impressão do navegador. |
| **Cobranças** | Mostra os títulos com o valor atualizado na data-base, a etapa da régua que vale hoje, busca e filtro, exportação em CSV e abertura e encerramento de disputa (supervisor). |
| **Aprovações** | A régua propõe as mensagens sem repetir nenhuma, e cada uma passa por aprovação individual. Rejeitar ou adiar exige motivo, e editar o texto pede nova aprovação. Mensagem aprovada pode ser copiada para envio manual. Tudo fica no histórico. |
| **Conciliação PIX** | Registra comprovantes e detecta duplicidade pelo EndToEndId. Sugere títulos por valor (original ou já com encargos), nome do pagador e data. Cobre também pagador terceiro, divergência (aceita pelo supervisor), agendamento, conferência no extrato, confirmação de crédito e baixa. |
| **Clientes** | Mostra a exposição de cada cliente, o vencido atualizado e os sinais de risco. |
| **Auditoria** | Registra todas as ações, inclusive as tentativas bloqueadas. Tem busca e exportação em CSV. |
| **Configurações** | Escolha do perfil (operador, supervisor ou consulta) e da data-base simulada. Edição dos encargos padrão e da régua (etapas, horários, fila humana e modelos com variáveis). Backup em JSON (exportar e importar) e restauração da demonstração. |

## O que mudou em relação às versões anteriores

- **Sem chave de API no navegador.** A versão anterior chamava o Gemini direto do front-end, o que expunha a chave. A leitura do boleto agora é feita pela linha digitável: é determinística, funciona offline e valida os dígitos.
- **Dinheiro em centavos inteiros.** Os valores são arredondados por componente, sem erros de ponto flutuante.
- **Calendário bancário.** Vencimento em fim de semana ou feriado nacional (Carnaval, Sexta-feira Santa, Corpus Christi e Consciência Negra entram no cálculo) é prorrogado para o próximo dia útil.
- **A régua usa o valor atualizado.** As mensagens trazem `{valorAtualizado}`, e a conciliação reconhece o pagamento feito já com multa e juros.
- **Status derivado.** "Vencido" e "em conferência" são calculados a partir da data-base e dos comprovantes vinculados, então ficam coerentes mesmo quando a data-base muda.
- **Duplicidade pela ordem de recebimento**, e não pela posição na lista.
- **Persistência e backup.** Recarregar a página não perde o trabalho.
- **Motor de regras puro** (`src/store/motor.ts`) com testes automatizados.
- O app compila: a versão anterior importava `utils/formatters` e `services/geminiService`, que não existiam.

## Estrutura

```
src/
  domain/   regras puras: dinheiro, datas/feriados, encargos, linha digitável, régua, conciliação
  store/    motor de ações (estado → estado + auditoria), dados de demonstração, persistência
  ui/       telas React + Tailwind
```

## Rodar localmente

Pré-requisito: Node.js 20 ou mais recente.

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # testes de domínio, motor e interface
npm run build    # typecheck + build de produção em dist/
```

## Próximos passos sugeridos

- Integração somente leitura com o ERP (Omie) através de um backend com as credenciais no servidor.
- Envio real por WhatsApp ou e-mail com uma fila no servidor, mantendo a aprovação humana.
- Leitura de extrato (OFX/CNAB) para conferência automática do crédito.

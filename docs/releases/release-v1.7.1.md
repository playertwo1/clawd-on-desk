# Clawd on Desk v1.7.1

Esta versão incorpora o [Clawd on Desk v1.7.0](release-v1.7.0.md) ao fork. Os cartões de fim de turno e de tarefa concluída, o fechamento automático e o foco por PID no Claude Desktop continuam disponíveis. O atualizador consulta as [releases de playertwo1/clawd-on-desk](https://github.com/playertwo1/clawd-on-desk/releases).

## Novidades

- O Codex acompanha múltiplos perfis locais e separa suas sessões e conclusões de subagentes.
- O foco de sessão melhora no KDE Plasma 6 Wayland e no Windows, com suporte a t3code e links nativos em versões compatíveis do CodeBuddy IDE no macOS.
- O SSH remoto ganha transporte stdio para hosts que bloqueiam o encaminhamento reverso. Nos hosts existentes, execute **Deploy / Repair Hooks** em **Settings → SSH Hosts**.
- O modo reunião oculta temporariamente o pet, o HUD e os cartões, e restaura a visibilidade e o Não Perturbe ao terminar.
- Escolha até três moedas de cota ao lado do pet e, opcionalmente, acompanhe o saldo pré-pago do DeepSeek.
- O Qoder Desktop exibe títulos, contexto e tarefas delegadas. O Copilot só entra no HUD quando há atividade ou interação pendente e sai ao encerrar a sessão.
- Temas com esquema escuro voltam aos recursos claros do mesmo tema se os recursos escuros falharem.

Projeto original criado por [rullerzhou-afk](https://github.com/rullerzhou-afk/clawd-on-desk), com código sob [AGPL-3.0](../../LICENSE) e avisos em [NOTICE.md](../../NOTICE.md).

# Plano: sincronizar o fork com o original (v1.7.0)

Status: plano, nada implementado · Criado em 2026-11-24 · Responsável pelo plano: Orca

## 1. Objetivo
Trazer para o fork `playertwo1/clawd-on-desk` o que saiu no original `rullerzhou-afk/clawd-on-desk` (v1.7.0, 21/11/2026) sem perder o que o fork já tem (cartões de fim de turno, correções de foco, updater do fork). Resultado: fork em **v1.7.1** (versão do original + nossas mudanças), testes verdes e instalador funcionando.

## 2. Estado de hoje (medido em 2026-11-24)
- Fork: v1.6.4, **16 commits à frente**, **103 atrás** do original (`diverged`).
- Original: v1.7.0 (Latest), últimas releases 1.6.0 (08/11) e 1.7.0 (21/11).
- Arquivos mudados no fork: 23. No original desde a base: 209. **Sobreposição: 13 arquivos** (risco de conflito):
  `package.json`, `package-lock.json`, `src/bubble-renderer.js`, `src/focus.js`, `src/main.js`, `src/permission.js`, `src/prefs.js`, `src/server-route-state.js`, `src/session-focus.js`, `src/settings-actions.js`, `src/settings-i18n.js`, `src/state.js`, `test/permission-notify-autoclose.test.js`.
- Só do fork (preservar): `hooks/antigravity-hook.js`, `src/claude-turn-ask.js`, `src/completion-bubble.js`, `src/settings-tab-notifications.js`, `src/updater.js` e os testes `claude-turn-ask-reminder`, `completion-bubble`, `settings-tabs-split`, `turn-end-question`, `updater`.

## 3. O que vem do original (resumo)
| Área | O que traz |
|---|---|
| Codex | vários perfis (`CODEX_HOME`), recuperação de threads vivas após saída do processo, isolamento de perfis, subagente fecha a própria linha no JSONL, hooks não aprovados avisam |
| Foco | Konsole no KDE/Wayland, desabilitar "Ir ao terminal" onde o Wayland não levanta janela, t3code no Linux, Claude Desktop no Windows pelo HUD, helper de foco do Windows fica vivo entre cliques, CodeBuddy IDE (inclusive Windows) |
| SSH remoto | fallback stdio automático, jump host explícito por perfil, diagnóstico melhor, comandos multilinha |
| Pet | modo reunião cronometrado para compartilhar tela |
| Cotas | anel com no máximo 3 moedas escolhidas, moeda de saldo DeepSeek, Kimi só interno |
| Qoder | títulos nativos, badges de subagente, uso de contexto, juggling com subagente ativo |
| Outros | tema volta para claro se assets do escuro falharem, Copilot esconde sessões sem uso, avisos de instalação pulada, docs |

## 4. O que o fork tem e NÃO pode se perder
1. Cartões de fim de turno (pergunta) e de tarefa concluída para Codex, Antigravity e todos os agentes (`adc0049`, `21853ee`), mantendo os cartões abertos e respeitando a configuração de fechamento automático (`5f18fc0`).
2. Foco: alcançar a janela do app quando o processo do hook já saiu (`90a935c`); focar uma segunda instância do Claude Desktop pelo pid do agente (`142c200`).
3. Updater checa o fork `playertwo1` (`11cf987`).
4. Versionamento próprio 1.6.1 a 1.6.4.

## 5. Estratégia
- Branch de integração `sync/upstream-v1.7.0` a partir da `main` do fork. **Merge** do `upstream/main` (não rebase: preserva o histórico do fork e evita reescrever commits já publicados). Sem force push.
- Resolver conflitos arquivo a arquivo, nesta ordem: `package.json`/lock → `state.js`/`server-route-state.js`/`prefs.js` → `focus.js`/`session-focus.js` → `permission.js`/`bubble-renderer.js` → `settings-*` → `main.js`.
- Regra de resolução: o código do original vence na infraestrutura (Codex, foco, SSH, cotas); o fork vence nas suas funcionalidades próprias (cartões, updater); onde se tocam, juntar e escrever teste que prove os dois comportamentos.
- Versão final 1.7.1 só depois de tudo verde.

## 6. Etapas
| # | Etapa | Responsável | Aceite |
|---|---|---|---|
| S0 | Adicionar remoto `upstream`, fetch, congelar o SHA do `upstream/main` usado e o SHA da `main` do fork | Tubarão | SHAs registrados no PR |
| S1 | Baseline: rodar a suíte na `main` do fork e no `upstream/main` (anotar falhas já existentes) | Tubarão | tabela de baseline |
| S2 | Merge na branch `sync/upstream-v1.7.0`, resolver os 13 conflitos possíveis | Tubarão | merge commit sem marcadores, `git diff` revisado arquivo a arquivo |
| S3 | Testes dos cartões do fork e do updater continuam passando; novo teste cobrindo cartão + novas regras do Codex (perfis, subagente) | Tubarão | testes novos verdes |
| S4 | Suíte completa (`npm test` e o que `CONTRIBUTING.md`/CI mandar), lint, build do instalador no Windows | Tubarão | verde, ou falhas iguais ao baseline |
| S5 | QA no Windows: pet abre, HUD, foco no Claude Desktop (1 e 2 instâncias), cartões de fim de turno (Codex/Antigravity), modo reunião, perfis Codex, updater aponta para o fork; checklist com capturas | Golfinho | checklist completa com evidência |
| S6 | Auditoria independente: nada do fork perdido (comparar os 16 commits), sem dado pessoal/segredo, licenças/NOTICE do original mantidas, updater não aponta para o original por engano. S5 e S6 podem ser um único veredito | Golfinho | PASS |
| S7 | Versão 1.7.1, CHANGELOG, **atualizar os README** (versão, novidades do original incorporadas, fork/updater), merge do PR e release com instalador e SHA-256 | Tartaruga | Release publicada, README atualizado, SHA-256 conferido. **Autorizado pelo dono condicionado ao PASS do Golfinho em S5/S6** |

## 7. Riscos
| Risco | Efeito | Mitigação |
|---|---|---|
| Conflito semântico em `state.js`/`main.js` (cartões do fork vs. subagente/perfis do Codex) | cartão duplicado ou perdido | teste dedicado; revisão do Golfinho |
| O original reescreveu o fluxo de foco no Windows | correção `90a935c` ou `142c200` some | testes de foco do fork + QA manual S5 |
| Updater volta a apontar para o original | usuários do fork recebem build errado | teste `updater.test.js` mantido e checado em S6 |
| Falhas já existentes no original (testes de Linux/Wayland rodando no Windows) | ruído | baseline S1 |
| Dependências do `package.json` divergentes | build quebra | lock regenerado só após resolver; build em S4 |

## 8. Fora do escopo
Funcionalidades novas do fork, mudar a licença/NOTICE, traduções, backport para versões antigas, contribuir PRs de volta ao original (pode virar tarefa futura: nossos cartões de fim de turno).

## 9. Decisões em aberto
- Contribuir os cartões do fork de volta ao original, ou manter só no fork?
- Manter o nome de versão `1.7.1` ou alinhar ao original e usar sufixo (ex.: `1.7.0-fork.1`)?
- Plataformas do QA: só Windows (assumido) ou também macOS/Linux?
- Decididas em 2026-11-24 pelo dono: o QA é do Golfinho (não do dono); com PASS, a Tartaruga publica a release e atualiza o README sem novo pedido.

## 10. Como retomar
Tubarão executa S0 a S4; Golfinho faz o QA e a auditoria (S5/S6); com PASS, a Tartaruga executa S7.

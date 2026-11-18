# Handover — ProjetoCidadeInteligente_Unicap

Updated: 2026-11-18 · Branch: `freebuff/5c1e5c3c1f3c632b95a00f32`

## Current state

Repositório de notas (second-brain em Markdown) com o `ai-dev-kit` instalado por cima: `AGENTS.md` (contrato, token `[CX K7Q]`), `.agents/skills/` (13 skills + 17 companions `.js`), `.ai-dev-kit.json` (manifest do kit) e `coding-standards/` reduzido a 10 arquivos (git, qa, ai). Dois commits locais, **nada empurrado**: `e1a3124` no topo, `dab0c97` embaixo. Fora deles, dois itens não commitados: `handover.md` (novo, untracked) e `AGENTS.md` (modificado, seção Project State).

## Last session

Instalação do kit e sua redução ao que este repo usa: 13 skills promovidas para a conta do Freebuff, camadas de standard sem arquivo aplicável removidas, contrato conferido contra o comportamento real do instalador. Resultado: sessões novas carregam `AGENTS.md` e podem invocar as 13 skills por nome; o repo carrega apenas standards com arquivo aplicável.

## Decisions & why

- **Repo é a fonte de verdade; a conta é snapshot** — mudou uma skill, edite `.agents/skills/<nome>/SKILL.md` e re-promova; nunca editar só um lado.
- **`SKILL.md` fica no repo** — apagar faz o `verify` do kit acusar `has no SKILL.md -- not a valid skill folder` e o `update` recria os arquivos; a deleção se desfaz sozinha.
- **`coding-standards/` cortado de 105 → 10 arquivos** — 6 887 das 8 144 linhas eram CSS/HTML/JS/TS/UI/SEO/perf/a11y/frameworks para um repo sem esses arquivos. Ficaram só os que o `AGENTS.md` referencia: git, qa, ai.
- **`index.md` reescrito como mapa real** — o original mandava carregar camadas inexistentes; o novo define precedência e a regra `STANDARDS GAP:`.
- **Comentários em nível `none`** (default do kit); identidade git passada por `-c` no commit para não escrever em `.git/config` compartilhado.
- **Skills three.js fora do repo** — as 36 da página vivem só na conta (5 individuais + 8 pacotes), sem cópia local.

## Known issues

- `install-kit install/update --standards` **recria as 95 camadas removidas** e sobrescreve `coding-standards/index.md`. Não há remoção seletiva.
- `.ai-dev-kit.json` guarda `standards: true` — coerente com a pasta existir, mas não reflete o corte.
- `coding-standards/ai-standards.md:43` cita `css-standards.md` e `frameworks/astro.md` num exemplo de string (não é link; deixado intacto por ser conteúdo upstream).
- 22 WARN de `console.log` nos scripts do kit (`handover/*.js`, `skill-scope/*.js`): é saída de CLI, não debug esquecido.
- `git config user.name/email` não existem neste ambiente — commits exigem `-c user.name=… -c user.email=…` (use o e-mail do histórico: `79537972+pedromiguel777@users.noreply.github.com`).

## Next steps

1. **Ponto de retomada:** confirmar `git log --oneline -2` = `e1a3124` + `dab0c97` em `freebuff/5c1e5c3c1f3c632b95a00f32`, então decidir o envio — `git push` do branch atual, ou abrir PR para `main` a partir de `e1a3124`. Nada foi empurrado até aqui.
2. Se o envio sair: decidir se o PR inclui `.agents/skills/` (368 KB) ou apenas `AGENTS.md` + `coding-standards/`.
3. Se o kit for atualizado: re-promover só as skills cujo `SKILL.md` mudou (`git diff` na pasta mostra quais).
4. Opcional: criar um `CLAUDE.md` de 3 linhas apontando para `AGENTS.md`, caso o repo seja aberto no Claude Code.

## Don't touch / gotchas

- Não apagar os 13 `SKILL.md` do repo, nem `.agents/skills/package.json` (shield CommonJS dos companions).
- Não "consertar" os 22 WARN de `console.log` — são stdout das CLIs do kit.
- `AGENTS.md` só é lido porque está na raiz; `.agents/skills/` não é auto-descoberto, o contrato é que manda carregar.
- O corte dos standards é reversível mas não estável: qualquer reinstalação do kit desfaz. Refaça com o mesmo `rm` se acontecer.

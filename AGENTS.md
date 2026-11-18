# AGENTS.md — ProjetoCidadeInteligente_Unicap

This file is auto-loaded by your coding tool (Claude Code, OpenCode, …) at the start of every session. It defines the project context, active standards, and behavioural contract for all AI work on this project.

---

## Session Start Protocol

At the start of every session the AI assistant must:

1. Begin every response with `[CX <Context code>]` (or bare `[CX]` if no code is set below) — it tells the user you have not forgotten the project context
2. On the first response, declare standards as **not yet loaded**
3. Read `coding-standards/index.md` — loads the full standards map — only on the first turn that actually touches a file (edit, create, or a request needing a convention). Conversational, planning, or review-only turns never trigger this read.
4. Once loaded, confirm active standards below and declare them loaded from that point on

If the token is ever missing from a response — or the Context code is missing or wrong — the session has lost context. Stop immediately, discard the response, and start a new session.

---

## Active Standards

| Standard | Active |
|---|---|
| Git standard | `coding-standards/git-standards.md` |
| QA standard | `coding-standards/qa/index.md` |
| AI standard | `coding-standards/ai-standards.md` |

Sem script/CSS standard: o repositório é uma base de conhecimento em Markdown e o único código é `second-brain/scripts/auditar_grafo.py`. As camadas `js*`, `ts*`, `js-and-ts*`, `css*`, `html*`, `ui*`, `design*`, `seo*`, `performance*`, `accessibility*`, `versioning*`, `frameworks/` e `tooling/` foram copiadas pelo instalador e depois **removidas** (`coding-standards/` caiu de 105 para 10 arquivos; sobram git, qa e ai). Disciplina ausente vira `STANDARDS GAP:` — nunca importar regra de outro projeto. Se alguém rodar `install-kit install/update --standards`, a árvore completa volta: refaça o corte ou aceite o peso.

---

## Project-Specific Context

| Property | Value |
|---|---|
| Context code | K7Q |
| Project name | ProjetoCidadeInteligente_Unicap |
| Framework | Nenhum |
| CSS framework | Nenhum |
| Base de conhecimento | `second-brain/` (começar por `00 - Início.md`; cinco MOCs; validar com `python3 second-brain/scripts/auditar_grafo.py`) |

---

## AI Behavioural Contract

- Before editing a file, load its standard chain (role table in `coding-standards/index.md`): discipline standard, file-role partial, framework file
- Every response starts with `[CX <Context code>]` (bare `[CX]` if no code is set)
- First response of every session declares standards as not-yet-loaded; standards load lazily on first file-touching turn, not eagerly at session start
- No restating the task, trailing summaries or filler
- Code comments follow the `comment-style` level (default none: only tool-required ones: `as`/suppression justifications, pragmas, license headers)
- Response shape follows the data (RULE AI-18): table for 2+ items with 2+ attributes, one line for one fact, yes/no for yes/no; `/format` overrides
- Where the tool renders links, file references are markdown links, not bare or inline-code paths (RULE AI-17)
- Reuse an existing CSS variable/token before adding one; new tokens only when asked (RULE AI-19)
- Keep the shell at the project root: no `cd` into a subfolder; use absolute paths, a subshell or the tool's own root option (RULE AI-20)
- When a task will take more than 5 minutes, say so before starting, as a range ("~8-12 min"), in one line at the top of the response; skip it for shorter tasks. The `eta` command and `eta-nudge` mod follow up (`plan-first` has the checkpoint rule)
- No invented rules — gaps in standards are flagged to the developer
- **Ao escrever `handover.md`:** `## Current state` registra composição, não posição — nunca contagem de commits, hash do topo, "nada empurrado" nem "árvore limpa"; eles ficam falsos no instante do commit que os escreve e forçam outro commit de correção a cada mudança de estado. Para o estado, aponte os comandos que respondem na hora: `git log --oneline origin/main..HEAD` e `git status`. `## Next steps` é escrito como condição ("commits não publicados → push"), nunca como retrato ("o branch já está no remoto"); `Updated:` data o conteúdo (composição, decisões, riscos), não o estado.
- **Decision preference (every mode):** weigh token efficiency and correct results first, with minimal Agent-tool use (see `agent-usage`, `mode-kernel`).
- Full rules in `coding-standards/ai-standards.md`

---

## Skill Triggers

Load the skill BEFORE the action (a skill not loaded is a rule not applied). Remove rows for skills not installed.

As 13 skills abaixo também existem como skills registradas na conta do Freebuff (mesmo nome, mesma descrição), então carregue-as por nome quando a ferramenta de skills estiver disponível; no disco elas moram em `.agents/skills/<nome>/SKILL.md` e podem ser lidas como arquivo em qualquer sessão. Os `.js` ao lado são companions executáveis (`node .agents/skills/<nome>/<script>`), e o `package.json` ali é apenas o shield `{"type":"commonjs"}` deles.

**Fonte de verdade e duplicação:** `.agents/skills/<nome>/SKILL.md` é o original; a cópia na conta é um snapshot derivado. Mudou uma skill, edite o repo e re-promova — nunca edite só um dos dois lados. Não apague os `SKILL.md` do repo para deduplicar: o `verify` do install-kit exige layout plano (`has no SKILL.md -- not a valid skill folder`×13) e o próprio `install-kit update` recria os arquivos na execução seguinte, então a deleção se desfaz sozinha; `skill-scope/auto.js` também imprime caminhos `<skill-root>/<nome>/SKILL.md` para o modelo ler depois de um `restore`.

| Situation | Skill |
|---|---|
| About to commit | `pre-commit` |
| About to say a task is done | `pre-merge-gate` |
| A build, test or runtime failure whose cause is not obvious | `debug-protocol` |
| A task touching 3+ files | `plan-first` |
| Pedido ambíguo: fixar objetivo, restrições e done-when antes de planejar | `intent-capture` |
| Tarefa multi-arquivo/multi-parâmetro em que o detalhe interpretado importa | `interpretation-checkpoint` |
| Antes de editar qualquer arquivo: carregar a cadeia de standards | `coding-standards` |
| Decidir o grau de autonomia da sessão | `agent-usage` e `mode-kernel` |
| Contexto alongando ou saída de ferramenta verbosa | `session-budget` |
| Sessão terminando ou nova sessão retomando trabalho pendente | `handover` |
| Uma skill deveria ter disparado e não disparou | `skill-scope` |
| Definir densidade de comentários em código novo | `comment-style` |

---

## Project State

Leia `handover.md` na raiz: estado atual, decisões com o porquê, riscos conhecidos e o ponto exato de retomada. O conhecimento de domínio continua em `second-brain/` (comece por `00 - Início.md` e pelos MOCs).

---

## Kit drift check

**Antes de qualquer `install-kit update` (ou `install` com `--standards`), rode:**

```
node .agents/scripts/kit-drift.js --library <clone do ai-dev-kit>
```

`--library` é o caminho de um clone do `ai-dev-kit` — o mesmo que o `install-kit` usa (`--library` no CLI dele aponta para lá). Duas formas de não digitá-lo toda vez:

- exporte `AI_DEV_KIT_LIBRARY=/caminho/do/clone` no ambiente e omita a flag;
- ou passe `--library` explicitamente, que vence a variável.

Sem clone à mão: `git clone --depth 1 https://github.com/AftabIbrahimKazi/ai-dev-kit /tmp/kit` (o script precisa só do `skills/` e do `coding-standards/`).

O relatório separa `EDITED LOCALLY` (o update sobrescreve), `MISSING LOCALLY` (o update recria), `NOT IN THIS LIBRARY VERSION` e `ACCEPTED` (divergência deliberada, listada em `.agents/scripts/kit-drift.accept`). Exit 1 com drift, 0 sem drift, 2 uso errado; `--warn` sempre sai 0 (para hook) e `--json` dá o mesmo em JSON.

**Por que existe:** o `install-kit` guarda sha1 só dos *commands*; para skills o manifest registra apenas `{dir, companions}`, então `update` copia `SKILL.md` verbatim e sobrescreve edição local sem avisar — o relatório reporta `changed: true`, indistinguível de "o upstream tem versão nova". O `install-kit.verify` não detecta esse drift (só layout e protocolo): um `SKILL.md` editado passa como `clean`. Regra prática: arquivo do kit é descartável; regra de projeto vive aqui no `AGENTS.md` ou na skill da conta, nunca como edição local em `.agents/skills/*/SKILL.md`.

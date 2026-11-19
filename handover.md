# Handover — ProjetoCidadeInteligente_Unicap

Updated: 2026-11-19 · Branch: `freebuff/5c1e5c3c1f3c632b95a00f32`

## Current state

Repositório de notas (second-brain em Markdown) com o `ai-dev-kit` instalado por cima: `AGENTS.md` (contrato, token `[CX K7Q]`), `.agents/skills/` (13 skills do kit com 17 companions `.js`, mais 36 skills three.js vendorizadas como `SKILL.md`), `.ai-dev-kit.json` (manifest do kit) e `coding-standards/` reduzido a 10 arquivos (git, qa, ai). Automação própria mora em `.agents/scripts/`: `kit-drift.js` (+ `kit-drift.accept`), `packs-check.js`, `checks.test.js` e `check-all.js`; `threejs-packs.json` na raiz mapeia os pacotes da conta para as skills do repo. O trabalho da sessão vive no branch `freebuff/5c1e5c3c1f3c632b95a00f32`, criado a partir de `main` (`ae7001f`). **Este arquivo não registra contagem de commits, hashes nem "árvore limpa"** — isso muda a cada commit e chega desatualizado por construção. Para o estado exato, rode `git log --oneline origin/main..HEAD` (o que ainda não está em `main`) e `git status` (o que ainda não foi commitado). Aqui fica só o que não envelhece: composição, decisões e riscos. Atualize `Updated:` apenas quando um desses três mudar — não quando o estado mudar.

## Last session

Quatro frentes fechadas: kit instalado e reduzido ao que este repo usa (13 skills promovidas, 95 camadas de standard removidas, contrato conferido contra o instalador); as 36 skills three.js baixadas dos quatro repositórios de origem e versionadas; o mapa repo ↔ conta escrito e coberto por `packs-check.js`; e as três checagens do repo atrás de um comando único (`check-all.js`), com teste que impede qualquer uma de virar sempre-passa.

## Decisions & why

- **Repo é a fonte de verdade; a conta é snapshot** — mudou uma skill, edite `.agents/skills/<nome>/SKILL.md` e re-promova; nunca editar só um lado.
- **`SKILL.md` fica no repo** — apagar faz o `verify` do kit acusar `has no SKILL.md -- not a valid skill folder` e o `update` recria os arquivos; a deleção se desfaz sozinha.
- **`coding-standards/` cortado de 105 → 10 arquivos** — 6 887 das 8 144 linhas eram CSS/HTML/JS/TS/UI/SEO/perf/a11y/frameworks para um repo sem esses arquivos. Ficaram só os que o `AGENTS.md` referencia: git, qa, ai.
- **`index.md` reescrito como mapa real** — o original mandava carregar camadas inexistentes; o novo define precedência e a regra `STANDARDS GAP:`.
- **36 skills three.js vendorizadas no repo, só o `SKILL.md`** — as pastas `references/` e `agents/` de origem (741 arquivos) ficaram de fora por peso; procedência e licença de cada repositório estão na tabela do `AGENTS.md`.
- **Conta tem 8 pacotes + 5 individuais; repo tem 36 skills** — as embalagens existem porque a plataforma aceita no máximo 5 alterações de skill por rodada; paridade literal custaria ~9 rodadas e ~153 KB reenviados, e pioraria o disparo (36 descrições competindo). A correspondência e o porquê estão em `threejs-packs.json`; conta é superfície de disparo, repo é biblioteca.
- **Checagens por comando único, nunca por hook** — os hooks vivem no diretório comum do git, compartilhado entre worktrees, então automação por hook fica fora deste repo; a rotina é `node .agents/scripts/check-all.js`.
- **Regra de projeto nunca mora em arquivo do kit** — `install-kit update` sobrescreve `SKILL.md` sem avisar; regra vive no `AGENTS.md` ou na skill da conta.
- **Comentários em nível `none`** (default do kit); identidade git passada por `-c` no commit para não escrever em `.git/config` compartilhado.

## Known issues

- `install-kit install/update --standards` **recria as 95 camadas removidas** e sobrescreve `coding-standards/index.md`. Não há remoção seletiva.
- `.ai-dev-kit.json` guarda `standards: true` — coerente com a pasta existir, mas não reflete o corte.
- `coding-standards/ai-standards.md:43` cita `css-standards.md` e `frameworks/astro.md` num exemplo de string (não é link; deixado intacto por ser conteúdo upstream).
- 22 WARN de `console.log` nos scripts do kit (`handover/*.js`, `skill-scope/*.js`, `pre-commit/*.js`): é saída de CLI, não debug esquecido.
- As 36 skills three.js entraram só como `SKILL.md`: skill que cite `references/algo.md` não encontra o arquivo no repo.
- O bloco `account` do `threejs-packs.json` é **registro**, não consulta ao vivo: `packs-check.js` detecta divergência entre mapa e registro, não entre mapa e plataforma. Re-promover na conta sem atualizar o JSON não é visto.
- `kit-drift.js` precisa de clone da biblioteca; sem um, `check-all.js` reporta `SKIP` (visível) e não falha.
- `git config user.name/email` não existem neste ambiente — commits exigem `-c user.name=… -c user.email=…` (use o e-mail do histórico: `79537972+pedromiguel777@users.noreply.github.com`).

## Next steps

1. **Ponto de retomada:** rode `git status` e `git log --oneline origin/main..HEAD`. Commits não publicados → `git push` neste branch. Branch sem PR → abrir um para `main` (`gh pr create --base main --head freebuff/5c1e5c3c1f3c632b95a00f32`, ou a página de compare), com corpo citando kit, corte 105→10, skills three.js e as checagens. PR já mergeado → nada pendente aqui.
2. Antes de commitar qualquer mudança: `node .agents/scripts/check-all.js --library /tmp/kit` (clone: `git clone --depth 1 https://github.com/AftabIbrahimKazi/ai-dev-kit /tmp/kit`); tem que sair 3 passed, 0 failed.
3. Se o kit for atualizado: rode o `kit-drift.js` **antes** do `update`, e re-promova só as skills cujo `SKILL.md` mudou.
4. Se as skills three.js mudarem no repo: atualize `threejs-packs.json` no mesmo commit (o `packs-check.js` acusa).
5. Opcional: criar um `CLAUDE.md` de 3 linhas apontando para `AGENTS.md`, caso o repo seja aberto no Claude Code.

## Don't touch / gotchas

- Não apagar os `SKILL.md` do repo (kit ou three.js), nem `.agents/skills/package.json` (shield CommonJS dos companions).
- Não "consertar" os 22 WARN de `console.log` — são stdout das CLIs do kit.
- Não instalar hooks de git: o diretório de hooks é comum a todos os worktrees desta máquina.
- **`pr-body.md` é artefato local, nunca versionado** — é o corpo do PR para `gh pr create --body-file pr-body.md`. Se aparecer como `??` no `git status`, é esperado: não commitar (entraria no diff do próprio PR e mudaria as contagens que ele cita) e não apagar achando que é lixo. Se não existir, regenere a partir de `git diff --shortstat origin/main..HEAD` e da lista de commits.
- `AGENTS.md` só é lido porque está na raiz; `.agents/skills/` não é auto-descoberto, o contrato é que manda carregar.
- O corte dos standards é reversível mas não estável: qualquer reinstalação do kit desfaz. Refaça com o mesmo `rm` se acontecer.

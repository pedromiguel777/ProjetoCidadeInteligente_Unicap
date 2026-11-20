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
- **Ao escrever `handover.md`:** `## Current state` registra composição, não posição — nunca contagem de commits, hash do topo, "nada empurrado" nem "árvore limpa"; eles ficam falsos no instante do commit que os escreve e forçam outro commit de correção a cada mudança de estado. Para o estado, aponte os comandos que respondem na hora: `git log --oneline origin/main..HEAD` e `git status` (com `main` já publicado, o primeiro sai vazio — é resposta, não erro). `## Next steps` é escrito como condição ("commits não publicados → push"), nunca como retrato ("o branch já está no remoto"); `Updated:` data o conteúdo (composição, decisões, riscos), não o estado.
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

## Checagens do repo

**O comando é um só, antes de commitar e antes de qualquer `install-kit update`:**

```
node .agents/scripts/check-all.js [--library <clone do ai-dev-kit>]
```

Roda em sequência `checks.test.js` (os testes das próprias checagens), `packs-check.js` (o mapa three.js) e `kit-drift.js` (kit instalado × biblioteca), e sai 1 se qualquer um falhar. Sem clone da biblioteca, `kit-drift` é reportado como `SKIP` — visível, nunca silencioso — e não derruba a execução; `--library` vence `AI_DEV_KIT_LIBRARY`, que vence o fallback `/tmp/kit`. Não há hook de git: os hooks moram no diretório comum do git, compartilhado entre worktrees, então automação por hook fica fora deste repo — a rotina é o comando único.

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

## Skills three.js (vendorizadas)

As 36 skills de `https://threejsresources.com/ai/skills` vivem em `.agents/skills/` como cópia de quatro repositórios: os 36 `SKILL.md` mais o material que eles citam — `references/` (73 arquivos), `scripts/` (7), `examples/` (337, só código) e, no `webgpu-threejs-tsl`, `docs/` (7), `templates/` (2) e `REFERENCE.md`. São 497 arquivos, 6,2 MB.

| Origem | Skills | Arquivos além do `SKILL.md` | Licença no repo de origem |
|---|---|---|---|
| `scottstts/Threejs-Awesome-Graphics-Agent-Skills` | 24 (`threejs-*`: materiais, geometria, campos, planetas, vegetação, água, atmosfera, imagem, sombras, câmera, arquitetura) | 380 | MIT (`LICENSE`) |
| `majidmanzarpour/threejs-game-skills` | 9 (`threejs-game-*`, `threejs-3d-generator`, `threejs-image-generator`, `threejs-audio-generator`, `threejs-aaa-graphics-builder`, `threejs-debug-profiler`, `threejs-qa-release`) | 26 | MIT (`LICENSE`) |
| `azakhary/nixie-fx` | 2 (`nixie-fx-authoring`, `nixie-fx-runtime`) | 6 | MIT (`LICENSE`) |
| `dgreenheck/webgpu-claude-skill` | 1 (`webgpu-threejs-tsl`) | 15 | **não tem arquivo de licença** no repo de origem |

**O que ficou de fora, de propósito:** as pastas `agents/` (definições de sub-agente, não citadas por nenhum `SKILL.md`) e 165 binários dentro de `examples/` (`*.glb`, `*.exr`, texturas — 120 MB). A subseção seguinte diz o que isso quebra, exemplo por exemplo.

### Exemplos citados: o que roda e o que é leitura só

Nenhum exemplo traz `index.html`: todos são módulos para importar num host Vite com `three` instalado. "Roda" aqui significa *importa e executa nesse host*, nunca "abrir o arquivo no navegador". Dos 54 exemplos que os `SKILL.md` citam (49 pastas + os 5 arquivos soltos do `webgpu-threejs-tsl`), **45 rodam e 9 são leitura só**:

| Exemplo (sob `.agents/skills/`) | O que falta |
|---|---|
| `threejs-precipitation-surfaces/examples/wet-puddle-rain` | 4 mapas de asfalto `aerial_asphalt_01_{diff,nor_gl,rough,ao}_2k.jpg` e `Splash.png` |
| `threejs-procedural-vegetation/examples/stylized-meadow-grass` | `grass-blades-up.glb`, `perlin.webp`, `path.webp` |
| `threejs-spectral-ocean/examples/stylized-above-below-ocean` | `foam.webp`, `sand.webp` |
| `threejs-water-optics/examples/interactive-pool-volume` | `tiles.jpg` e 5 faces de cubemap `{xpos,xneg,ypos,zpos,zneg}.jpg` |
| `webgpu-threejs-tsl/examples/earth-shader.js` | `textures/earth_{day,night,clouds,bump}.jpg` |
| `threejs-atmosphere-aerial-perspective/examples/lut-aerial-perspective` | 31 shaders importados com `?raw` (11 `.frag`, 5 `.vert`, 15 `.glsl`) |
| `threejs-volumetric-clouds/examples/weather-volume-clouds` | 51 shaders `?raw` (20 `.frag`, 9 `.vert`, 22 `.glsl`); as nuvens ainda buscam `shape.bin`/`shape_detail.bin` em `media.githubusercontent.com` |
| `threejs-procedural-materials/examples/simulated-tearable-denim` | 36 `*.wgsl` e `assets/simulated-tearable-denim/settled-drape.js` |
| `threejs-water-optics/examples/photoreal-water` | `assets/photoreal-water/pebbles.js` (gera a textura de seixos em código) |

**Execução verificada (1 dos 45):** `threejs-procedural-materials/examples/lava-flow-surface/lava-surface.js` foi importado e executado num host Vite mínimo — Vite 8.3.8, `three` 0.187.0 — e devolveu `Mesh` com `ShaderMaterial`, 4 vértices, 19 uniforms, `uTime` 1.5, `uResolution` 800×600 e fragment shader de 7 568 caracteres. **Não houve renderização**: a VM não tem GPU, então o teste para na criação de geometria/material e na atualização dos uniforms. Dois detalhes que o host precisa: alias `three` → `node_modules/three` (o exemplo mora fora da raiz do host) e `build.modulePreload.polyfill: false` (o polyfill padrão toca `document` e impede rodar o bundle em Node).

```bash
mkdir -p /tmp/lava-host && cd /tmp/lava-host
printf '{"name":"lava-host","private":true,"type":"module"}' > package.json
npm i --no-fund --no-audit three vite   # three 0.187, vite 8.3
# vite.config.js: resolve.alias [{ find: /^three$/, replacement: '<host>/node_modules/three' }]
#                 build.modulePreload.polyfill = false
npx vite build --logLevel warn && node dist/assets/index-*.js
```

```js
// main.js
import * as THREE from "three";
import { createLavaFlowSurface, updateLavaFlowMaterial } from "<repo>/.agents/skills/threejs-procedural-materials/examples/lava-flow-surface/lava-surface.js";
const surface = createLavaFlowSurface({ flowSpeed: 0.2 });
const camera = new THREE.PerspectiveCamera(50, 4 / 3, 0.1, 100);
camera.position.set(0, 0.2, 1.5);
camera.updateMatrixWorld(true);
updateLavaFlowMaterial(surface.material, { elapsed: 1.5, width: 800, height: 600, camera });
console.log(JSON.stringify({ type: surface.type, material: surface.material.type,
  vertices: surface.geometry.attributes.position.count,
  uniforms: Object.keys(surface.material.uniforms).length,
  uTime: surface.material.uniforms.uTime.value }));
```

As cinco primeiras linhas são asset binário: os caminhos são URLs absolutas `/skills/<skill>/assets/...`, então copiar o arquivo para `assets/` não basta — ele precisa ser servido nesse caminho, ou a URL do exemplo precisa ser editada. As quatro últimas são código de apoio: o repo não tem nenhum `.glsl`, `.frag`, `.vert` ou `.wgsl` (a cópia levou só `.js`/`.mjs`/`.ts`/`.md`/`.json`), e `assets/` no nível da skill nunca foi copiado.

Duas ressalvas entram nos 45 que rodam: `threejs-procedural-materials/examples/hybrid-soil-moss-surface` exige `textureBaseUrl` apontando para os sets Poly Haven `Ground103`/`Moss002` (sem URL, a fábrica lança erro); `threejs-procedural-materials/examples/raytraced-diamond` e `threejs-procedural-vegetation/examples/procedural-surface-ivy` importam `postprocessing`/`three-stdlib`, então o host precisa desses pacotes além de `three`.

Fora de `examples/`, três `SKILL.md` citam `assets/` que também não existe: `assets/geometry-quality-kit/` (6 `.js`, em `threejs-procedural-geometry`), `assets/threejs-vite-game/` (`threejs-gameplay-systems`) e `assets/starter-project/vfx-editor.prj.template.json` (`nixie-fx-authoring`).

Para recuperar o que falta: clone raso do repo de origem da skill e copie só os arquivos que o exemplo pede, preservando o caminho relativo. Para os shaders, `git checkout HEAD -- 'skills/*/examples/**/*.{glsl,frag,vert,wgsl}'`; para um asset, copie o binário e sirva-o sob `/skills/<skill>/assets/...`.

As mesmas 36 estão registradas na conta do Freebuff como 5 skills individuais + 8 pacotes temáticos: `threejs-packs.json` guarda o mapa pacote → skills e o motivo das embalagens (o limite de 5 alterações de skill por rodada). O repo guarda o texto integral de cada uma e as pastas que ele cita; a conta, unidades de disparo — e o snapshot da conta continua sendo só `SKILL.md`, porque skill registrada não carrega diretório de apoio.

**Testar as checagens:** `node --test .agents/scripts/checks.test.js` — roda `packs-check.js` e `kit-drift.js` contra fixtures temporárias e exige exit 1 com drift e 0 sem drift, para que um refactor não os transforme em sempre-passa. Rode pelo `check-all.js`, que junta com o resto.

**Conferir o mapa:** `node .agents/scripts/packs-check.js` — exit 1 se o JSON envelheceu (skill no disco fora do mapa, skill do mapa sem pasta, `name:` do frontmatter diferente da pasta, contagem declarada errada, ou bloco `account` destoando dos pacotes). `--json` para automação. O bloco `account` é um registro, não uma consulta ao vivo: atualize-o quando a conta mudar. O `install-kit verify` aceita estas pastas (layout plano, frontmatter com `name` = pasta) e o `install-kit update` não as toca, porque não estão no manifest.

**Para atualizar:** clone raso do repo de origem, `git checkout HEAD -- 'skills/*/SKILL.md' 'skills/*/references' 'skills/*/scripts' 'skills/*/examples'` e copie `SKILL.md`, `references/`, `scripts/` e os arquivos de código de `examples/` (`.js`/`.mjs`/`.ts`/`.md`/`.json`) para `.agents/skills/<nome>/`, preservando a estrutura interna. Não copie `examples/**/assets/`: são os 120 MB de binários.

**Aprendizado encerrado:** a carga das 36 skills está fechada — texto integral, material citado, procedência/licenças e classificação dos exemplos (45 rodam, 9 são leitura só). Não há leitura pendente. Mudança futura de skill entra pelo caminho acima e é validada por `node .agents/scripts/check-all.js`.

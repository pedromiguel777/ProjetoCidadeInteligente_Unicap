# Coding Standards — Index

Mapa reduzido. Este repositório é uma base de conhecimento em Markdown; o único código é `second-brain/scripts/auditar_grafo.py`. O kit `ai-dev-kit` instala uma árvore de standards para CSS, HTML, JS/TS, UI, SEO, performance, acessibilidade, versionamento e frameworks — essas camadas foram removidas daqui por não existir arquivo daquele tipo (ver AGENTS.md, seção "Fonte de verdade").

---

## O que existe

| Disciplina | Arquivo | Carregar quando |
|---|---|---|
| Git | `git-standards.md` | antes de commitar, criar branch ou abrir PR |
| QA | `qa/index.md` + 6 irmãos | antes de declarar pronto, revisar processo, checar segurança ou escrever relatório de bug |
| AI | `ai-standards.md` | toda sessão — contrato de resposta, `[CX]`, disciplina de contexto |

---

## Ordem de leitura

1. `AGENTS.md` — contexto do projeto, token `[CX K7Q]`, gatilhos de skill.
2. O standard da disciplina que o arquivo editado pertence (tabela acima).
3. `qa/definition-of-done.md` antes de dizer que uma tarefa terminou.

---

## Precedência (quando duas regras discordam)

1. Acessibilidade e segurança — nunca sobreponíveis, nunca dispensáveis.
2. `AGENTS.md` (contexto do projeto).
3. `qa/`.
4. `git-standards.md` e `ai-standards.md`, onde explicitamente disserem que sobrepõem.
5. Defaults de IA nunca se aplicam. Regra ausente é um gap: escreva `STANDARDS GAP:` e pergunte.

---

## Disciplina ausente

Se a tarefa exigir um standard que não está aqui (CSS, HTML, JS/TS, UI, SEO, performance, acessibilidade, versionamento, framework), não importe regra de outro projeto e não invente: escreva `STANDARDS GAP:` e pergunte.

Se o repositório passar a ter arquivos daquele tipo, a camada pode voltar: `install-kit install --standards` recria a árvore completa — e, junto com ela, os 95 arquivos cortados.

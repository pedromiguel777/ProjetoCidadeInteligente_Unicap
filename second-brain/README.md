# Segundo Cérebro — Cidade Inteligente Unicap

Cofre de notas em Markdown com wikilinks, MOCs (Maps of Content) e grafo.

## Como abrir

**Obsidian:** `File → Open folder as vault` → selecione esta pasta (`second-brain/`).
O grafo aparece com `Ctrl/Cmd + G`, já colorido por braço de conhecimento (`.obsidian/graph.json`).

**Qualquer editor:** são arquivos `.md` normais; os wikilinks são texto puro no formato colchete-duplo.

## Estrutura

```
second-brain/
├── 00 - Início.md              ← home / MOC raiz
├── 01 - MOC Cidade Inteligente.md
├── 02 - MOC Tecnologia e Dados.md
├── 03 - MOC Pessoas e Governança.md
├── 04 - MOC Sustentabilidade e Território.md
├── 05 - MOC Projeto Unicap.md
├── 06 - Grafo do Conhecimento.md
├── Caixa de Entrada.md          ← captura rápida
├── Modelo de Nota.md            ← template
├── fundamentos/                 ← conceito e contexto
├── tecnologia/                  ← coleta, dados, IA
├── pessoas/                     ← cidadão, ética, governança
├── sustentabilidade/            ← clima, mobilidade, resíduos
├── projeto/                     ← escopo, método, prazos
└── scripts/auditar_grafo.py     ← valida links e órfãs
```

## Convenções

- **Wikilink sempre com motivo:** link + " — porque X depende de Y".
- **Frontmatter** obrigatório: `tipo`, `status` (`rascunho` | `ativo` | `arquivado`), `tags`, `atualizado`.
- **Nenhuma nota órfã:** toda nota nova entra em pelo menos um MOC.
- **`Modelo de Nota.md`** contém placeholders de link de propósito; ao copiar o modelo, substitua-os.
- **Nota atômica:** um conceito por arquivo; acima de ~60 linhas, quebrar.

## Auditoria de links

```bash
python3 second-brain/scripts/auditar_grafo.py
```

Sai com código 1 se houver link quebrado ou nota sem link de entrada. Rode antes de commitar.

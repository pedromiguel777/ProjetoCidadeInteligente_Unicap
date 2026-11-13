---
tipo: nota
status: rascunho
tags: [tecnologia, dados, arquitetura]
atualizado: 2026-11-13
---

# Arquitetura de Dados Urbanos

> O caminho do dado bruto até a decisão: sem esse caminho desenhado, cada secretaria vira uma planilha.

## Pipeline de referência

1. **Coleta** — [[Sensores e Redes de Sensores]] e sistemas transacionais (SIG, ouvidoria, transporte).
2. **Ingestão** — fila/stream, com carimbo de origem e versão do schema.
3. **Armazenamento em camadas** — bruto (imutável) → tratado → agregado por indicador.
4. **Qualidade** — nulos, duplicatas, outliers, atraso de chegada.
5. **Catálogo** — dicionário de dados e dono de cada tabela ([[Governança de Dados]]).
6. **Consumo** — [[Dashboard de Indicadores]], API pública, modelos de [[Inteligência Artificial Urbana]].

## Princípios

- **Bruto nunca é sobrescrito.** Auditoria e reprocessamento dependem disso.
- **Todo indicador é derivado e versionado.** Se muda a fórmula, muda a versão.
- **Metadado é produto**, não sobra: sem ele não há [[Dados Abertos]] utilizáveis.
- **Fonte única por domínio** evita o clássico "número da secretaria A vs. B".

## Anti-padrões

- Data lake sem catálogo (pântano de dados).
- Dashboard alimentado por planilha manual.
- Integração ponto a ponto entre sistemas (n sistemas, n² conexões) — ver [[Interoperabilidade e Padrões]].

## Conexões

- [[Internet das Coisas Urbana]] — origem dos dados de campo.
- [[Governança de Dados]] — dono e política.
- [[Privacidade e LGPD]] — o que pode ser armazenado e por quanto tempo.
- [[02 - MOC Tecnologia e Dados]] — MOC pai.
- [[05 - MOC Projeto Unicap]] — este é um dos entregáveis técnicos.

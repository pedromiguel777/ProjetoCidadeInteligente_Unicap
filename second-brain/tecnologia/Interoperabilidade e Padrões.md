---
tipo: nota
status: ativo
tags: [tecnologia, padroes, integracao]
atualizado: 2026-11-13
---

# Interoperabilidade e Padrões

> Dois sistemas que não conversam custam mais caro que qualquer sensor.

## Onde trava

- Identificadores diferentes para a mesma rua, escola ou ônibus.
- Coordenadas em datum distinto (SIRGAS 2000 vs. WGS84) — erro de metros vira erro de política.
- Unidades e granularidades temporais incompatíveis (hora vs. dia, bairro vs. setor censitário).
- Contrato de API sem versionamento: a prefeitura troca o sistema e o painel quebra.

## O que exigir

1. **Chave de ligação estável** (código IBGE de setor, código de rua).
2. **Schema versionado** e documentado (OpenAPI para APIs, JSON Schema para eventos).
3. **Formatos padrão de cidade**: GeoJSON, GTFS para transporte, SensorThings/OMA para IoT.
4. **Contrato de dados no edital** — ver [[Cidade Inteligente no Brasil]].

## Conexões

- [[Arquitetura de Dados Urbanos]] — onde o padrão é aplicado.
- [[Dados Abertos]] — padrão é pré-requisito de reuso.
- [[Plataformas de Cidades Inteligentes]] — aqui mora o risco de aprisionamento.
- [[02 - MOC Tecnologia e Dados]] — MOC pai.

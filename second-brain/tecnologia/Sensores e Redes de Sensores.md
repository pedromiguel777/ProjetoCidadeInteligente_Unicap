---
tipo: nota
status: ativo
tags: [tecnologia, hardware, coleta]
atualizado: 2026-11-13
---

# Sensores e Redes de Sensores

> A decisão mais importante de um projeto de sensoriamento não é o sensor: é **o que vale a pena medir**.

## Escolha do que medir

| Fenômeno | Sensor | Custo relativo | Nota de destino |
| --- | --- | --- | --- |
| Chuva / nível de canal | ultrassônico, pluviômetro | baixo | [[Infraestrutura Verde e Drenagem]] |
| Qualidade do ar | particulado PM2.5 | médio | [[Resiliência Climática Urbana]] |
| Fluxo de veículos | indutivo, visão computacional | alto | [[Mobilidade Urbana Inteligente]] |
| Ruído | microfone calibrado | baixo | — |
| Ocupação de lixeira | ultrassom | baixo | [[Resíduos Sólidos e Logística Reversa]] |
| Consumo de energia | medidor inteligente | médio | [[Eficiência Energética Urbana]] |

## Requisitos não funcionais (os que matam projetos)

- **Calibração e erro**: sem calibração periódica o dado vira ruído com carimbo de hora.
- **Autonomia**: bateria vs. painel solar vs. ponto de energia.
- **Conectividade**: LoRaWAN é barato e de baixo bandwidth; visão computacional exige 4G/5G.
- **Manutenção**: quem troca o sensor em 18 meses? Sem resposta, o parque morre — ver [[Riscos do Projeto]].
- **Segurança**: dispositivo é porta de entrada de rede; ver [[Governança de Dados]].

## Piloto mínimo viável

Um tipo de sensor, uma área, um indicador, seis meses de operação assistida. Mais que isso é pesquisa de infraestrutura, não de cidade.

## Conexões

- [[Internet das Coisas Urbana]] — a visão geral.
- [[Arquitetura de Dados Urbanos]] — para onde o dado vai.
- [[Dashboard de Indicadores]] — onde o dado aparece.
- [[02 - MOC Tecnologia e Dados]] — MOC pai.

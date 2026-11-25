# NPCs — personagens do pack CGTrader

`Low Poly Characters Set Free` (CGTrader), exportado do `.blend` original para glTF.

| Arquivo | Personagem | Vértices | Clipes |
|---|---|---|---|
| `npc_1.glb` … `npc_5.glb` | Character_1 … Character_5 | 3,1k – 6,2k | Walk, Idle, Run, Sad, Dance |

O ZIP original do `.blend` fica em `second-brain/prototipo-cidade-inteligente-3d/3d-source/`, fora da pasta servida, para não ir no build.

## Como foram gerados

Blender 4.5 headless, com as ~7 malhas de cada personagem unidas em uma só (1 draw call por NPC), textura `Color.png` reduzida para 512 px e exportada em WebP, e os clipes levados como NLA tracks (`export_animation_mode='NLA_TRACKS'`).

Só o `npc_1.glb` traz animação real: os rigs dos 5 personagens têm os mesmos 70 bones e a mesma pose de descanso (desvio máximo 0,01 num osso do polegar), então `npcs.js` carrega os clipes uma vez e os aplica aos 96 mixers. Os canais do bone `Root` são descartados para o deslocamento continuar vindo dos percursos em `npcs.js`.

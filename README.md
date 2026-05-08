# FateTable / Mesa Arcana VTT

FateTable é uma base de mesa tabletop virtual (VTT) em HTML, CSS e JavaScript puro. A proposta é se inspirar em categorias gerais de recursos de VTTs modernas (canvas, tokens, fichas, chat, macros, plugins e cenas), mas com nomes, layout, código e identidade próprios.

## Como abrir

Abra `index.html` em um navegador moderno. O MVP não usa backend, build step ou dependências externas.

## Recursos do MVP expandido

- Canvas 2D com grid quadrado, pan, zoom, snap e HUD de coordenadas.
- Sistema de câmera com centralização de cena e centralização em token pelo combate/menu.
- Cenas separadas com nome, troca via API, criação de nova cena e serialização no JSON.
- Tokens com seleção, múltipla seleção, arraste, edição de ficha rápida, HP, barras, condições, dono, visão/luz e menu de contexto.
- Ferramentas de desenho, medição, templates circulares, fog manual, luz, paredes, portas, ping e apagar.
- Chat com comandos `/r`, `/roll`, `/gmroll`, `/adv`, `/dis`, `/desc`, `/me`, `/damage`, `/heal`, `/condition`, `/spawn`, `/ping`, `/table`, `/init`, `/clear` e `/help`.
- Engine de dados para `d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100`, modificadores, keep-highest e keep-lowest.
- Tracker de iniciativa com adicionar selecionado, rolar iniciativa, ordenar e avançar turno/rodada.
- Biblioteca local para mapas/imagens e metadados de assets.
- Macros com hotbar de 10 slots e variáveis básicas como `@selected.name`, `@selected.hp` e `@selected.maxHp`.
- Diário/notas com visibilidade de Mestre/Jogadores.
- Configurações de camada, diagonal, nomes e barras de tokens.
- Salvamento no `localStorage`, importação/exportação de campanha JSON e estrutura preparada para backup/cenas.
- `NetworkManager` stub para multiplayer futuro via WebSocket, WebRTC, Firebase/Supabase ou servidor Node.js.
- Plugin Manager com permissões declaradas, ativar/desativar, captura de erro e painel de status.

## Plugins internos

- **Bloodied / Ferido**: adiciona a condição Ferido quando o token fica com HP igual ou abaixo de 50%.
- **Auto Initiative**: adiciona o comando `/init` para rolar iniciativa dos tokens selecionados.
- **Simple Damage**: adiciona `/damage` e `/heal`, aceitando número ou expressão de dados.
- **Aura**: exemplo desativado por padrão para ligar/desligar luz simples no token selecionado.

## API interna resumida

```js
window.TabletopAPI.createToken({ name: "Dragão", hp: 100, maxHp: 100 });
window.TabletopAPI.roll("2d20kh1+4");
window.TabletopAPI.createScene({ name: "Floresta Congelada" });
window.TabletopAPI.registerMacro({
  name: "Ataque Espada",
  icon: "⚔️",
  command: "/r 1d20+5\n/damage 1d8+3",
  showInHotbar: true
});
window.TabletopAPI.registerPlugin({
  id: "meu-plugin",
  name: "Meu Plugin",
  permissions: ["chat:send"],
  enabled: true,
  activate() {
    window.TabletopAPI.sendChatMessage({ sender: "Plugin", text: "Ativo!", type: "system" });
  }
});
```

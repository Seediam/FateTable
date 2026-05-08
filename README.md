# FateTable

FateTable é um MVP de mesa tabletop virtual (VTT) em HTML, CSS e JavaScript puro, inspirado em recursos gerais de mesas como Roll20 e Owlbear Rodeo, mas com estrutura, nomes e visual próprios.

## Recursos implementados

- Canvas 2D com grid quadrado, pan e zoom.
- Criação, seleção, arraste e edição de tokens.
- Barra de vida, nome, condições e destaque visual de seleção.
- Chat com comandos e cards de rolagem.
- Engine de dados para expressões como `1d20+5`, `2d6+3`, `4d6kh3` e `2d20kl1`.
- Tracker de iniciativa com rodada, ordenação e próximo turno.
- Salvamento em `localStorage`, importação e exportação JSON.
- Ferramentas iniciais de medição, desenho, áreas, fog manual e paredes futuras.
- Biblioteca local de mapa/imagem.
- API interna `window.TabletopAPI` para plugins.
- Plugins internos ativáveis/desativáveis: Bloodied, Auto Initiative e Simple Damage.

## Como abrir

Abra `index.html` em um navegador moderno. Não há backend, build step ou dependências externas.

## API interna resumida

```js
window.TabletopAPI.createToken({ name: "Dragão", hp: 100, maxHp: 100 });
window.TabletopAPI.roll("2d20kh1+4");
window.TabletopAPI.registerChatCommand("shout", (text) => {
  window.TabletopAPI.sendChatMessage({ sender: "Plugin", text: text.toUpperCase(), type: "message" });
});
```

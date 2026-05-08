(() => {
  "use strict";

  const STORAGE_KEY = "fatetable-campaign-v1";
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
  const now = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const elements = {
    canvas: $("#tableCanvas"),
    campaignName: $("#campaignName"),
    sceneName: $("#sceneName"),
    connectionLabel: $("#connectionLabel"),
    zoomLabel: $("#zoomLabel"),
    mouseCoords: $("#mouseCoords"),
    toolLabel: $("#toolLabel"),
    scaleLabel: $("#scaleLabel"),
    layerLabel: $("#layerLabel"),
    saveState: $("#saveState"),
    measureOverlay: $("#measureOverlay"),
    chatLog: $("#chatLog"),
    chatForm: $("#chatForm"),
    chatInput: $("#chatInput"),
    combatList: $("#combatList"),
    roundLabel: $("#roundLabel"),
    tokenForm: $("#tokenForm"),
    tokenName: $("#tokenName"),
    tokenHp: $("#tokenHp"),
    tokenMaxHp: $("#tokenMaxHp"),
    tokenArmor: $("#tokenArmor"),
    tokenSpeed: $("#tokenSpeed"),
    tokenColor: $("#tokenColor"),
    tokenNotes: $("#tokenNotes"),
    gridSizeInput: $("#gridSizeInput"),
    gridColorInput: $("#gridColorInput"),
    gridOpacityInput: $("#gridOpacityInput"),
    snapInput: $("#snapInput"),
    mapImageInput: $("#mapImageInput"),
    importFile: $("#importFile"),
    assetList: $("#assetList"),
    pluginList: $("#pluginList"),
    macroForm: $("#macroForm"),
    macroName: $("#macroName"),
    macroIcon: $("#macroIcon"),
    macroCommand: $("#macroCommand"),
    macroList: $("#macroList"),
    hotbar: $("#hotbar"),
    layerSelect: $("#layerSelect"),
    diagonalRuleInput: $("#diagonalRuleInput"),
    showNamesInput: $("#showNamesInput"),
    showBarsInput: $("#showBarsInput"),
    journalForm: $("#journalForm"),
    journalTitle: $("#journalTitle"),
    journalVisibility: $("#journalVisibility"),
    journalContent: $("#journalContent"),
    journalList: $("#journalList"),
    contextMenu: $("#contextMenu"),
  };

  const EventBus = {
    handlers: new Map(),
    on(eventName, callback) {
      if (!this.handlers.has(eventName)) this.handlers.set(eventName, new Set());
      this.handlers.get(eventName).add(callback);
      return () => this.handlers.get(eventName)?.delete(callback);
    },
    emit(eventName, payload) {
      this.handlers.get(eventName)?.forEach((callback) => callback(payload));
    },
    off(eventName, callback) {
      this.handlers.get(eventName)?.delete(callback);
    },
  };

  const App = {
    ctx: elements.canvas.getContext("2d"),
    camera: { x: 0, y: 0, zoom: 1 },
    activeTool: "select",
    role: "gm",
    drag: null,
    dirty: false,
    spacePan: false,
    mapImage: null,
    state: createDefaultState(),
    init() {
      this.bindUI();
      this.resizeCanvas();
      PluginManager.installBuiltIns();
      ChatManager.send({ sender: "Sistema", text: "Bem-vindo ao FateTable. Use /r 1d20+5 para rolar dados.", type: "system" });
      TokenManager.create({ name: "Herói", x: 128, y: 128, color: "#6d8cff", hp: 18, maxHp: 18, armor: 15, speed: 9, emitsLight: true, lightRange: 3 }, false);
      TokenManager.create({ name: "Goblin", type: "monster", x: 320, y: 192, color: "#4caf50", hp: 7, maxHp: 7, armor: 13, speed: 9 }, false);
      MacroManager.register({ name: "Ataque rápido", icon: "⚔️", command: "/r 1d20+5", showInHotbar: true });
      App.state.tables.push({ id: "table_001", name: "Tesouro Goblin", formula: "1d6", entries: [{ min: 1, max: 2, result: "10 moedas" }, { min: 3, max: 4, result: "Poção pequena" }, { min: 5, max: 6, result: "Adaga enferrujada" }] });
      SceneManager.saveActiveScene();
      MacroManager.render();
      JournalManager.render();
      this.markDirty(false);
      EventBus.emit("app:ready", this.state);
      requestAnimationFrame(() => this.render());
    },
    bindUI() {
      window.addEventListener("resize", () => this.resizeCanvas());
      elements.canvas.addEventListener("contextmenu", (event) => InputManager.contextMenu(event));
      elements.canvas.addEventListener("pointerdown", (event) => InputManager.pointerDown(event));
      elements.canvas.addEventListener("pointermove", (event) => InputManager.pointerMove(event));
      elements.canvas.addEventListener("pointerup", (event) => InputManager.pointerUp(event));
      elements.canvas.addEventListener("pointerleave", (event) => InputManager.pointerUp(event));
      elements.canvas.addEventListener("wheel", (event) => InputManager.wheel(event), { passive: false });
      document.addEventListener("keydown", (event) => InputManager.keyDown(event));
      document.addEventListener("keyup", (event) => InputManager.keyUp(event));

      $$(".tool").forEach((button) => button.addEventListener("click", () => this.setTool(button.dataset.tool)));
      $$(".tab").forEach((button) => button.addEventListener("click", () => this.showTab(button.dataset.tab)));
      $$('[data-open-tab]').forEach((button) => button.addEventListener("click", () => this.showTab(button.dataset.openTab)));
      $("#newMapBtn").addEventListener("click", () => StorageManager.newScene());
      $("#newSceneBtn").addEventListener("click", () => SceneManager.createScene());
      $("#saveBtn").addEventListener("click", () => StorageManager.saveLocal());
      $("#loadBtn").addEventListener("click", () => StorageManager.loadLocal());
      $("#exportBtn").addEventListener("click", () => StorageManager.exportJson());
      $("#roleBtn").addEventListener("click", () => this.toggleRole());
      $("#addCombatBtn").addEventListener("click", () => CombatManager.addSelected());
      $("#rollInitBtn").addEventListener("click", () => CombatManager.rollSelectedInitiative());
      $("#nextTurnBtn").addEventListener("click", () => CombatManager.nextTurn());
      $("#deleteTokenBtn").addEventListener("click", () => TokenManager.deleteSelected());
      elements.importFile.addEventListener("change", (event) => StorageManager.importJson(event));
      elements.chatForm.addEventListener("submit", (event) => ChatManager.submit(event));
      elements.tokenForm.addEventListener("submit", (event) => TokenManager.submitForm(event));
      elements.campaignName.addEventListener("input", () => { this.state.campaignName = elements.campaignName.value; this.markDirty(); });
      elements.sceneName.addEventListener("input", () => SceneManager.renameScene(elements.sceneName.value));
      elements.macroForm.addEventListener("submit", (event) => MacroManager.submit(event));
      elements.journalForm.addEventListener("submit", (event) => JournalManager.submit(event));
      elements.layerSelect.addEventListener("change", () => LayerManager.setLayer(elements.layerSelect.value));
      elements.diagonalRuleInput.addEventListener("change", () => { this.state.settings.diagonalRule = elements.diagonalRuleInput.value; this.markDirty(); });
      elements.showNamesInput.addEventListener("change", () => { this.state.settings.showTokenNames = elements.showNamesInput.checked; this.markDirty(); });
      elements.showBarsInput.addEventListener("change", () => { this.state.settings.showTokenBars = elements.showBarsInput.checked; this.markDirty(); });
      $("#centerSceneBtn").addEventListener("click", () => CameraManager.centerScene());
      document.addEventListener("click", () => elements.contextMenu.classList.add("hidden"));
      [elements.gridSizeInput, elements.gridColorInput, elements.gridOpacityInput, elements.snapInput].forEach((input) => {
        input.addEventListener("input", () => GridManager.updateSettings());
      });
      elements.mapImageInput.addEventListener("change", (event) => AssetManager.loadMapImage(event));
    },
    resizeCanvas() {
      const rect = elements.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      elements.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      elements.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },
    render() {
      const ctx = this.ctx;
      const rect = elements.canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      CanvasRenderer.background(ctx, rect);
      CanvasRenderer.withWorld(ctx, () => {
        CanvasRenderer.map(ctx);
        GridManager.draw(ctx, rect);
        WallManager.draw(ctx);
        DrawingManager.draw(ctx);
        TemplateManager.draw(ctx);
        LightManager.draw(ctx);
        FogManager.draw(ctx, rect);
        TokenManager.draw(ctx);
      });
      requestAnimationFrame(() => this.render());
    },
    setTool(tool) {
      this.activeTool = tool;
      $$(".tool").forEach((button) => button.classList.toggle("active", button.dataset.tool === tool));
      elements.toolLabel.textContent = `Ferramenta: ${tool}`;
      LayerManager.inferLayerFromTool(tool);
    },
    showTab(tabName) {
      $$(".tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === tabName));
      $$(".tab-panel").forEach((panel) => panel.classList.remove("active"));
      $(`#${tabName}Tab`).classList.add("active");
    },
    toggleRole() {
      this.role = this.role === "gm" ? "player" : "gm";
      $("#roleBtn").textContent = `Modo: ${this.role === "gm" ? "Mestre" : "Jogador"}`;
      ChatManager.send({ sender: "Sistema", text: `Modo alterado para ${this.role}.`, type: "system" });
    },
    markDirty(value = true) {
      this.dirty = value;
      elements.saveState.textContent = value ? "Não salvo" : "Salvo";
      elements.saveState.style.color = value ? "#f6dfaa" : "#9effbd";
    },
  };

  function createDefaultState() {
    return {
      version: "0.1.0",
      campaignName: "Crônicas da Mesa",
      activeSceneId: "scene_001",
      settings: {
        gridSize: 64,
        gridColor: "#ffffff",
        gridOpacity: 0.25,
        gridOffsetX: 0,
        gridOffsetY: 0,
        snap: true,
        scaleLabel: "1 célula = 1,5m",
        diagonalRule: "5-10-5",
        showTokenNames: true,
        showTokenBars: true,
        currentLayer: "tokens",
      },
      players: [],
      scenes: [createSceneData("scene_001", "Cena Inicial")],
      tokens: [],
      sheets: [],
      chat: [],
      combat: { active: false, round: 1, turnIndex: 0, combatants: [] },
      assets: [],
      templates: [],
      drawings: [],
      fog: [],
      walls: [],
      lights: [],
      macros: [],
      journal: [],
      tables: [],
      audio: [],
      selectedTokenIds: [],
      plugins: {},
      pluginSettings: {},
      history: { undo: [], redo: [] },
    };
  }

  function createSceneData(id = uid("scene"), name = "Nova Cena") {
    return {
      id, name, width: 4000, height: 4000, backgroundColor: "#151515",
      grid: {}, maps: [], tokens: [], drawings: [], templates: [], fog: [], walls: [], lights: [], notes: [], mapImage: null,
    };
  }

  const CameraManager = {
    centerScene() { App.camera.x = 120; App.camera.y = 80; App.camera.zoom = 1; elements.zoomLabel.textContent = "100%"; },
    centerOnToken: (token) => centerOnToken(token),
  };

  const LayerManager = {
    setLayer(layer) { App.state.settings.currentLayer = layer; elements.layerLabel.textContent = `Camada: ${layer}`; elements.layerSelect.value = layer; App.markDirty(); },
    inferLayerFromTool(tool) {
      const map = { token: "tokens", map: "map", draw: "drawings", text: "drawings", template: "templates", fog: "fog", light: "lights", wall: "walls", door: "walls" };
      if (map[tool]) this.setLayer(map[tool]);
    },
  };

  const SceneManager = {
    current() { return App.state.scenes.find((scene) => scene.id === App.state.activeSceneId) || App.state.scenes[0]; },
    saveActiveScene() {
      const scene = this.current(); if (!scene) return;
      Object.assign(scene, { tokens: structuredClone(App.state.tokens), drawings: structuredClone(App.state.drawings), templates: structuredClone(App.state.templates), fog: structuredClone(App.state.fog), walls: structuredClone(App.state.walls), lights: structuredClone(App.state.lights), mapImage: scene.mapImage || null });
    },
    loadScene(scene) {
      App.state.activeSceneId = scene.id; elements.sceneName.value = scene.name;
      App.state.tokens = structuredClone(scene.tokens || []); App.state.drawings = structuredClone(scene.drawings || []); App.state.templates = structuredClone(scene.templates || []); App.state.fog = structuredClone(scene.fog || []); App.state.walls = structuredClone(scene.walls || []); App.state.lights = structuredClone(scene.lights || []);
      App.state.selectedTokenIds = []; App.state.combat = { active: false, round: 1, turnIndex: 0, combatants: [] };
      AssetManager.restoreMap(); TokenManager.syncForm(); CombatManager.render(); EventBus.emit("scene:change", scene);
    },
    createScene(data = {}) {
      this.saveActiveScene(); const scene = { ...createSceneData(uid("scene"), `Cena ${App.state.scenes.length + 1}`), ...data };
      App.state.scenes.push(scene); this.loadScene(scene); ChatManager.send({ sender: "Sistema", text: `Cena criada: ${scene.name}.`, type: "system" }); App.markDirty(); EventBus.emit("scene:create", scene); return scene;
    },
    renameScene(name) { const scene = this.current(); if (scene) { scene.name = name || "Cena sem nome"; App.markDirty(); } },
    switchScene(id) { const scene = App.state.scenes.find((item) => item.id === id); if (!scene) return; this.saveActiveScene(); this.loadScene(scene); App.markDirty(); },
    exportScene() { this.saveActiveScene(); return JSON.stringify(this.current(), null, 2); },
    importScene(scene) { App.state.scenes.push(scene); this.switchScene(scene.id); },
  };

  const CanvasRenderer = {
    background(ctx, rect) {
      const gradient = ctx.createLinearGradient(0, 0, rect.width, rect.height);
      gradient.addColorStop(0, "#13101b");
      gradient.addColorStop(1, "#060508");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, rect.width, rect.height);
    },
    withWorld(ctx, callback) {
      ctx.save();
      ctx.translate(App.camera.x, App.camera.y);
      ctx.scale(App.camera.zoom, App.camera.zoom);
      callback();
      ctx.restore();
    },
    map(ctx) {
      if (App.mapImage) {
        ctx.drawImage(App.mapImage, 0, 0);
      } else {
        ctx.fillStyle = "#181421";
        ctx.fillRect(-2048, -2048, 4096, 4096);
        ctx.fillStyle = "rgba(215, 169, 75, 0.05)";
        for (let i = -2000; i < 2000; i += 256) ctx.fillRect(i, -2048, 128, 4096);
      }
    },
  };

  const GridManager = {
    screenToWorld(point) {
      return { x: (point.x - App.camera.x) / App.camera.zoom, y: (point.y - App.camera.y) / App.camera.zoom };
    },
    worldToScreen(point) {
      return { x: point.x * App.camera.zoom + App.camera.x, y: point.y * App.camera.zoom + App.camera.y };
    },
    worldToGrid(point) {
      const size = App.state.settings.gridSize;
      return {
        col: Math.floor((point.x - App.state.settings.gridOffsetX) / size),
        row: Math.floor((point.y - App.state.settings.gridOffsetY) / size),
      };
    },
    gridToWorld(cell) {
      const size = App.state.settings.gridSize;
      return { x: cell.col * size + App.state.settings.gridOffsetX, y: cell.row * size + App.state.settings.gridOffsetY };
    },
    snap(point) {
      if (!App.state.settings.snap) return point;
      return this.gridToWorld(this.worldToGrid({ x: point.x + App.state.settings.gridSize / 2, y: point.y + App.state.settings.gridSize / 2 }));
    },
    draw(ctx, rect) {
      const { gridSize, gridColor, gridOpacity, gridOffsetX, gridOffsetY } = App.state.settings;
      const topLeft = this.screenToWorld({ x: 0, y: 0 });
      const bottomRight = this.screenToWorld({ x: rect.width, y: rect.height });
      const startX = Math.floor((topLeft.x - gridOffsetX) / gridSize) * gridSize + gridOffsetX;
      const startY = Math.floor((topLeft.y - gridOffsetY) / gridSize) * gridSize + gridOffsetY;
      ctx.save();
      ctx.strokeStyle = gridColor;
      ctx.globalAlpha = gridOpacity;
      ctx.lineWidth = 1 / App.camera.zoom;
      ctx.beginPath();
      for (let x = startX; x < bottomRight.x + gridSize; x += gridSize) { ctx.moveTo(x, topLeft.y - gridSize); ctx.lineTo(x, bottomRight.y + gridSize); }
      for (let y = startY; y < bottomRight.y + gridSize; y += gridSize) { ctx.moveTo(topLeft.x - gridSize, y); ctx.lineTo(bottomRight.x + gridSize, y); }
      ctx.stroke();
      ctx.restore();
    },
    updateSettings() {
      App.state.settings.gridSize = Number(elements.gridSizeInput.value) || 64;
      App.state.settings.gridColor = elements.gridColorInput.value;
      App.state.settings.gridOpacity = Number(elements.gridOpacityInput.value);
      App.state.settings.snap = elements.snapInput.checked;
      App.markDirty();
    },
    syncInputs() {
      elements.gridSizeInput.value = App.state.settings.gridSize;
      elements.gridColorInput.value = App.state.settings.gridColor;
      elements.gridOpacityInput.value = App.state.settings.gridOpacity;
      elements.snapInput.checked = App.state.settings.snap;
      elements.scaleLabel.textContent = App.state.settings.scaleLabel;
    },
  };

  const TokenManager = {
    create(data = {}, makeDirty = true) {
      const size = App.state.settings.gridSize;
      const point = GridManager.snap({ x: data.x ?? 0, y: data.y ?? 0 });
      const token = {
        id: uid("token"), name: "Novo Token", type: "npc", x: point.x, y: point.y,
        width: 1, height: 1, image: null, color: "#8f5cff", borderColor: "#0b0810",
        hp: 10, maxHp: 10, armor: 10, speed: 9, initiative: 0, conditions: [], hidden: false,
        locked: false, rotation: 0, controlledBy: [], visionRange: 6, lightRange: 0, emitsLight: false, lightColor: "#ffd37a", lightOpacity: 0.45,
        bars: [{ name: "HP", current: data.hp ?? 10, max: data.maxHp ?? 10, color: "#d94141", visibleToPlayers: true }],
        notes: "", sheetId: uid("sheet"), owner: "gm", layer: "tokens", ...data,
      };
      token.hp = clamp(Number(token.hp), 0, Number(token.maxHp));
      token.maxHp = Math.max(1, Number(token.maxHp));
      token.bars = token.bars?.length ? token.bars : [{ name: "HP", current: token.hp, max: token.maxHp, color: "#d94141", visibleToPlayers: true }];
      token.x = point.x; token.y = point.y; token.width = Number(token.width) || 1; token.height = Number(token.height) || 1;
      App.state.tokens.push(token);
      App.state.selectedTokenIds = [token.id];
      this.syncForm();
      CombatManager.render();
      EventBus.emit("token:create", token);
      if (makeDirty) App.markDirty();
      return token;
    },
    update(id, patch) {
      const token = App.state.tokens.find((item) => item.id === id);
      if (!token) return null;
      Object.assign(token, patch);
      token.maxHp = Math.max(1, Number(token.maxHp));
      token.hp = clamp(Number(token.hp), 0, token.maxHp);
      token.bars = token.bars?.length ? token.bars : [{ name: "HP", current: token.hp, max: token.maxHp, color: "#d94141", visibleToPlayers: true }];
      token.bars[0].current = token.hp; token.bars[0].max = token.maxHp;
      EventBus.emit("token:update", token);
      this.syncForm(); CombatManager.render(); App.markDirty();
      return token;
    },
    delete(id) {
      App.state.tokens = App.state.tokens.filter((token) => token.id !== id);
      App.state.selectedTokenIds = App.state.selectedTokenIds.filter((tokenId) => tokenId !== id);
      App.state.combat.combatants = App.state.combat.combatants.filter((combatant) => combatant.tokenId !== id);
      EventBus.emit("token:delete", { id });
      this.syncForm(); CombatManager.render(); App.markDirty();
    },
    deleteSelected() { [...App.state.selectedTokenIds].forEach((id) => this.delete(id)); },
    draw(ctx) {
      const size = App.state.settings.gridSize;
      App.state.tokens.forEach((token) => {
        if (token.hidden && App.role !== "gm") return;
        const w = token.width * size;
        const h = token.height * size;
        const selected = App.state.selectedTokenIds.includes(token.id);
        ctx.save();
        if (token.hidden) ctx.globalAlpha = 0.45;
        ctx.fillStyle = token.color;
        ctx.strokeStyle = selected ? "#f6d36d" : token.borderColor;
        ctx.lineWidth = selected ? 4 / App.camera.zoom : 2 / App.camera.zoom;
        ctx.beginPath();
        ctx.roundRect(token.x + 5, token.y + 5, w - 10, h - 10, 18);
        ctx.fill(); ctx.stroke();
        if (App.state.settings.showTokenBars) {
          const bars = token.bars?.length ? token.bars : [{ current: token.hp, max: token.maxHp, color: "#4bd17d" }];
          bars.slice(0, 2).forEach((bar, index) => {
            ctx.fillStyle = "rgba(0,0,0,0.58)";
            ctx.fillRect(token.x + 8, token.y - 10 - index * 8, w - 16, 6);
            ctx.fillStyle = bar.color || (token.hp / token.maxHp <= 0.5 ? "#e0a13d" : "#4bd17d");
            ctx.fillRect(token.x + 8, token.y - 10 - index * 8, (w - 16) * clamp((bar.current ?? token.hp) / Math.max(1, bar.max ?? token.maxHp), 0, 1), 6);
          });
        }
        ctx.fillStyle = "#fff7dc";
        ctx.font = `${13 / App.camera.zoom}px sans-serif`;
        ctx.textAlign = "center";
        if (App.state.settings.showTokenNames) ctx.fillText(token.name, token.x + w / 2, token.y + h + 15 / App.camera.zoom);
        if (token.conditions.length) {
          ctx.fillStyle = "#ffcf5b";
          const labels = token.conditions.map((condition) => condition.icon || condition.name || condition).join(" ");
          ctx.fillText(labels, token.x + w / 2, token.y - 18 / App.camera.zoom);
        }
        ctx.restore();
      });
    },
    tokenAt(worldPoint) {
      const size = App.state.settings.gridSize;
      return [...App.state.tokens].reverse().find((token) => {
        const w = token.width * size; const h = token.height * size;
        return worldPoint.x >= token.x && worldPoint.x <= token.x + w && worldPoint.y >= token.y && worldPoint.y <= token.y + h;
      });
    },
    select(id, additive = false) {
      App.state.selectedTokenIds = additive ? [...new Set([...App.state.selectedTokenIds, id])] : [id];
      this.syncForm(); EventBus.emit("token:select", this.selected());
    },
    selected() { return App.state.selectedTokenIds.map((id) => App.state.tokens.find((token) => token.id === id)).filter(Boolean); },
    syncForm() {
      const token = this.selected()[0];
      const disabled = !token;
      [elements.tokenName, elements.tokenHp, elements.tokenMaxHp, elements.tokenArmor, elements.tokenSpeed, elements.tokenColor, elements.tokenNotes].forEach((input) => { input.disabled = disabled; });
      if (!token) {
        elements.tokenName.value = ""; elements.tokenHp.value = ""; elements.tokenMaxHp.value = ""; elements.tokenArmor.value = ""; elements.tokenSpeed.value = ""; elements.tokenColor.value = "#8f5cff"; elements.tokenNotes.value = ""; return;
      }
      elements.tokenName.value = token.name;
      elements.tokenHp.value = token.hp;
      elements.tokenMaxHp.value = token.maxHp;
      elements.tokenArmor.value = token.armor;
      elements.tokenSpeed.value = token.speed;
      elements.tokenColor.value = token.color;
      elements.tokenNotes.value = token.notes;
    },
    submitForm(event) {
      event.preventDefault();
      const token = this.selected()[0];
      if (!token) return;
      this.update(token.id, { name: elements.tokenName.value || "Token", hp: Number(elements.tokenHp.value), maxHp: Number(elements.tokenMaxHp.value), armor: Number(elements.tokenArmor.value), speed: Number(elements.tokenSpeed.value), color: elements.tokenColor.value, notes: elements.tokenNotes.value });
    },
  };

  const DiceEngine = {
    roll(expression) {
      const normalized = expression.replace(/\s+/g, "").toLowerCase();
      if (!/^[0-9d+\-khkl]+$/.test(normalized)) throw new Error("Expressão inválida");
      const terms = normalized.match(/[+-]?[^+-]+/g) || [];
      const parts = [];
      let total = 0;
      for (const term of terms) {
        const sign = term.startsWith("-") ? -1 : 1;
        const clean = term.replace(/^[+-]/, "");
        const dice = clean.match(/^(\d*)d(\d+)(kh|kl)?(\d+)?$/);
        if (dice) {
          const amount = clamp(Number(dice[1] || 1), 1, 100);
          const sides = clamp(Number(dice[2]), 2, 1000);
          const mode = dice[3];
          const keep = Number(dice[4] || amount);
          const rolls = Array.from({ length: amount }, () => 1 + Math.floor(Math.random() * sides));
          let kept = [...rolls];
          if (mode === "kh") kept = [...rolls].sort((a, b) => b - a).slice(0, keep);
          if (mode === "kl") kept = [...rolls].sort((a, b) => a - b).slice(0, keep);
          const subtotal = kept.reduce((sum, value) => sum + value, 0) * sign;
          total += subtotal;
          parts.push({ type: "dice", term, amount, sides, rolls, kept, subtotal, natural20: sides === 20 && rolls.includes(20), natural1: sides === 20 && rolls.includes(1) });
        } else if (/^\d+$/.test(clean)) {
          const value = Number(clean) * sign; total += value; parts.push({ type: "mod", term, value });
        } else throw new Error("Termo inválido");
      }
      const result = { expression, total, parts, critical: parts.some((part) => part.natural20), fumble: parts.some((part) => part.natural1) };
      EventBus.emit("dice:roll", result);
      return result;
    },
  };

  const ChatManager = {
    commands: new Map(),
    rollTemplates: new Map(),
    submit(event) {
      event.preventDefault();
      const text = elements.chatInput.value.trim();
      if (!text) return;
      elements.chatInput.value = "";
      this.handle(text);
    },
    handle(text) {
      if (!text.startsWith("/")) return this.send({ sender: App.role === "gm" ? "Mestre" : "Jogador", text, type: "message" });
      const [command, ...rest] = text.slice(1).split(" ");
      const payload = rest.join(" ").trim();
      if (["r", "roll", "gm", "gmroll", "wroll"].includes(command)) return this.roll(payload, ["gm", "gmroll", "wroll"].includes(command));
      if (command === "adv") return this.roll((payload || "1d20").replace(/^1d20/i, "2d20kh1"));
      if (command === "dis") return this.roll((payload || "1d20").replace(/^1d20/i, "2d20kl1"));
      if (command === "damage") return applyHpDelta(-rollOrNumber(payload || 0));
      if (command === "heal") return applyHpDelta(rollOrNumber(payload || 0));
      if (command === "condition") return addConditionFromCommand(payload);
      if (command === "spawn") return TokenManager.create({ name: payload || "Spawn", x: 0, y: 0 });
      if (command === "ping") return this.send({ sender: "Ping", text: payload || "Ping!", type: "system" });
      if (command === "me") return this.send({ sender: App.role === "gm" ? "Mestre" : "Jogador", text: `* ${payload}`, type: "message" });
      if (command === "table") return RollTableManager.roll(payload);
      if (command === "desc") return this.send({ sender: "Narrador", text: payload, type: "desc" });
      if (command === "clear") { App.state.chat = []; this.render(); App.markDirty(); return; }
      if (command === "help") return this.send({ sender: "Sistema", text: "Comandos: /r, /gmroll, /adv, /dis, /desc, /me, /damage, /heal, /condition, /spawn, /ping, /table, /init, /clear", type: "system" });
      const registered = this.commands.get(command);
      if (registered) return registered(payload);
      this.send({ sender: "Sistema", text: `Comando desconhecido: /${command}`, type: "system" });
    },
    roll(expression, secret = false) {
      try {
        const result = DiceEngine.roll(resolveRollVariables(expression || "1d20"));
        this.send({ sender: secret ? "Mestre (secreto)" : "Rolagem", type: "roll", result });
      } catch (error) {
        this.send({ sender: "Sistema", text: error.message, type: "system" });
      }
    },
    send(message) {
      const entry = { id: uid("msg"), time: now(), ...message };
      App.state.chat.push(entry);
      this.render();
      EventBus.emit("chat:message", entry);
      App.markDirty();
      return entry;
    },
    registerCommand(command, handler) { this.commands.set(command.replace(/^\//, ""), handler); },
    registerRollTemplate(name, renderer) { this.rollTemplates.set(name, renderer); },
    render() {
      elements.chatLog.innerHTML = "";
      App.state.chat.slice(-120).forEach((message) => {
        const node = document.createElement("article");
        node.className = message.type === "roll" ? "roll-card" : "chat-message";
        if (message.type === "roll") {
          const detail = message.result.parts.map((part) => part.type === "dice" ? `${part.term}: [${part.rolls.join(", ")}]` : `${part.term}`).join(" • ");
          node.innerHTML = `<small>${message.time} — ${escapeHtml(message.sender)}</small><div>${escapeHtml(message.result.expression)}</div><div class="roll-total">${message.result.total}</div><div>${escapeHtml(detail)}</div>${message.result.critical ? "<strong>Crítico natural!</strong>" : ""}${message.result.fumble ? "<strong>Falha crítica!</strong>" : ""}`;
        } else {
          node.innerHTML = `<small>${message.time} — ${escapeHtml(message.sender)}</small><div>${escapeHtml(message.text || "")}</div>`;
        }
        elements.chatLog.appendChild(node);
      });
      elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
    },
  };

  const CombatManager = {
    addSelected() {
      TokenManager.selected().forEach((token) => this.addToken(token.id));
      this.render(); App.markDirty();
    },
    addToken(tokenId) {
      if (App.state.combat.combatants.some((combatant) => combatant.tokenId === tokenId)) return;
      const token = App.state.tokens.find((item) => item.id === tokenId);
      if (!token) return;
      App.state.combat.active = true;
      App.state.combat.combatants.push({ id: uid("combat"), tokenId, initiative: token.initiative || 0 });
      this.sort(); EventBus.emit("combat:start", App.state.combat);
    },
    rollSelectedInitiative() {
      TokenManager.selected().forEach((token) => {
        this.addToken(token.id);
        const result = DiceEngine.roll("1d20");
        token.initiative = result.total;
        const combatant = App.state.combat.combatants.find((item) => item.tokenId === token.id);
        if (combatant) combatant.initiative = result.total;
        ChatManager.send({ sender: "Iniciativa", type: "roll", result: { ...result, expression: `${token.name}: 1d20` } });
      });
      this.sort(); this.render(); App.markDirty();
    },
    sort() { App.state.combat.combatants.sort((a, b) => b.initiative - a.initiative); },
    nextTurn() {
      const combat = App.state.combat;
      if (!combat.combatants.length) return;
      combat.turnIndex += 1;
      if (combat.turnIndex >= combat.combatants.length) { combat.turnIndex = 0; combat.round += 1; }
      EventBus.emit("combat:turnChange", combat.combatants[combat.turnIndex]);
      this.render(); App.markDirty();
    },
    render() {
      elements.roundLabel.textContent = App.state.combat.round;
      elements.combatList.innerHTML = "";
      App.state.combat.combatants.forEach((combatant, index) => {
        const token = App.state.tokens.find((item) => item.id === combatant.tokenId);
        if (!token) return;
        const node = document.createElement("div");
        node.className = `combatant ${index === App.state.combat.turnIndex ? "active" : ""}`;
        node.innerHTML = `<strong>${escapeHtml(token.name)}</strong><div class="combat-meta">Iniciativa ${combatant.initiative} • HP ${token.hp}/${token.maxHp} • DEF ${token.armor}</div>`;
        node.addEventListener("click", () => { TokenManager.select(token.id); centerOnToken(token); });
        elements.combatList.appendChild(node);
      });
    },
  };

  const DrawingManager = {
    draw(ctx) {
      App.state.drawings.forEach((drawing) => {
        ctx.save(); ctx.strokeStyle = drawing.color; ctx.globalAlpha = drawing.opacity; ctx.lineWidth = drawing.width;
        ctx.beginPath(); drawing.points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.stroke(); ctx.restore();
      });
    },
  };
  const TemplateManager = {
    create(point) { App.state.templates.push({ id: uid("tpl"), type: "circle", x: point.x, y: point.y, radius: App.state.settings.gridSize * 2, color: "#8f5cff", opacity: 0.28, label: "Área", ownerId: App.role }); App.markDirty(); },
    draw(ctx) { App.state.templates.forEach((tpl) => { ctx.save(); ctx.globalAlpha = tpl.opacity; ctx.fillStyle = tpl.color; ctx.strokeStyle = "#dbc9ff"; ctx.beginPath(); ctx.arc(tpl.x, tpl.y, tpl.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#fff"; ctx.fillText(tpl.label, tpl.x - 12, tpl.y); ctx.restore(); }); },
  };
  const FogManager = {
    reveal(point) { const entry = { id: uid("fog"), x: point.x, y: point.y, radius: point.radius || App.state.settings.gridSize * 2, mode: "reveal" }; App.state.fog.push(entry); App.markDirty(); EventBus.emit("fog:reveal", entry); return entry; },
    draw(ctx, rect) {
      if (!App.state.fog.length) return;
      ctx.save(); ctx.fillStyle = "rgba(0,0,0,0.42)"; const tl = GridManager.screenToWorld({ x: 0, y: 0 }); const br = GridManager.screenToWorld({ x: rect.width, y: rect.height }); ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.globalCompositeOperation = "destination-out"; App.state.fog.forEach((fog) => { ctx.beginPath(); ctx.arc(fog.x, fog.y, fog.radius, 0, Math.PI * 2); ctx.fill(); }); ctx.restore();
    },
  };
  const WallManager = {
    draw(ctx) { App.state.walls.forEach((wall) => { ctx.save(); ctx.strokeStyle = wall.door ? (wall.open ? "#47c07a" : "#d7a94b") : "#d7a94b"; ctx.setLineDash(wall.door ? [8 / App.camera.zoom, 5 / App.camera.zoom] : []); ctx.lineWidth = 4 / App.camera.zoom; ctx.beginPath(); ctx.moveTo(wall.x1, wall.y1); ctx.lineTo(wall.x2, wall.y2); ctx.stroke(); ctx.restore(); }); },
  };

  const AssetManager = {
    loadMapImage(event) {
      const file = event.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => { App.mapImage = image; const scene = SceneManager.current(); scene.mapImage = reader.result; App.state.assets.push({ id: uid("asset"), name: file.name, type: "map", tags: ["mapa"] }); this.render(); App.markDirty(); EventBus.emit("map:load", file.name); };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    },
    restoreMap() { const dataUrl = SceneManager.current()?.mapImage; if (!dataUrl) { App.mapImage = null; return; } const image = new Image(); image.onload = () => { App.mapImage = image; }; image.src = dataUrl; },
    render() { elements.assetList.innerHTML = ""; App.state.assets.forEach((asset) => { const node = document.createElement("div"); node.className = "asset-card"; node.textContent = `${asset.type}: ${asset.name}`; elements.assetList.appendChild(node); }); },
  };



  const LightManager = {
    create(point) {
      App.state.lights.push({ id: uid("light"), x: point.x, y: point.y, radius: App.state.settings.gridSize * 4, color: "#ffd37a", opacity: 0.32, attachedTokenId: null });
      App.markDirty();
    },
    draw(ctx) {
      App.state.lights.forEach((light) => {
        const gradient = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.radius);
        gradient.addColorStop(0, light.color);
        gradient.addColorStop(1, "rgba(255, 211, 122, 0)");
        ctx.save(); ctx.globalAlpha = light.opacity; ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(light.x, light.y, light.radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      });
      App.state.tokens.filter((token) => token.emitsLight || token.lightRange > 0).forEach((token) => {
        const size = App.state.settings.gridSize; const radius = (token.lightRange || 4) * size;
        const gradient = ctx.createRadialGradient(token.x + size / 2, token.y + size / 2, 0, token.x + size / 2, token.y + size / 2, radius);
        gradient.addColorStop(0, token.lightColor || "#ffd37a"); gradient.addColorStop(1, "rgba(255, 211, 122, 0)");
        ctx.save(); ctx.globalAlpha = token.lightOpacity ?? 0.35; ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(token.x + size / 2, token.y + size / 2, radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      });
    },
  };

  const MacroManager = {
    submit(event) { event.preventDefault(); this.register({ name: elements.macroName.value || "Macro", icon: elements.macroIcon.value || "⚔️", command: elements.macroCommand.value || "/r 1d20", visible: true, owner: App.role, showInHotbar: true }); elements.macroForm.reset(); elements.macroIcon.value = "⚔️"; },
    register(macro) { const entry = { id: uid("macro"), name: "Macro", command: "/r 1d20", icon: "⚔️", visible: true, owner: "gm", showInHotbar: true, ...macro }; App.state.macros.push(entry); this.render(); App.markDirty(); return entry; },
    run(macro) { macro.command.split(/\n+/).map((line) => line.trim()).filter(Boolean).forEach((line) => ChatManager.handle(this.resolveVariables(line))); },
    resolveVariables(command) { const selected = TokenManager.selected()[0]; return command.replaceAll("@selected.name", selected?.name || "").replaceAll("@selected.hp", selected?.hp ?? "0").replaceAll("@selected.maxHp", selected?.maxHp ?? "0"); },
    render() {
      elements.macroList.innerHTML = ""; elements.hotbar.innerHTML = "";
      App.state.macros.forEach((macro, index) => {
        const node = document.createElement("div"); node.className = "asset-card macro-card"; node.innerHTML = `<strong>${escapeHtml(macro.icon)} ${escapeHtml(macro.name)}</strong><button>Executar</button>`; node.querySelector("button").addEventListener("click", () => this.run(macro)); elements.macroList.appendChild(node);
        if (macro.showInHotbar && index < 10) { const button = document.createElement("button"); button.className = "hotbar-slot"; button.title = `${index === 9 ? 0 : index + 1}: ${macro.name}`; button.innerHTML = `<span>${index === 9 ? 0 : index + 1}</span>${escapeHtml(macro.icon)}`; button.addEventListener("click", () => this.run(macro)); elements.hotbar.appendChild(button); }
      });
      for (let i = App.state.macros.length; i < 10; i += 1) { const empty = document.createElement("button"); empty.className = "hotbar-slot empty"; empty.innerHTML = `<span>${i === 9 ? 0 : i + 1}</span>—`; elements.hotbar.appendChild(empty); }
    },
  };

  const JournalManager = {
    submit(event) { event.preventDefault(); const entry = { id: uid("journal"), title: elements.journalTitle.value || "Nota", content: elements.journalContent.value, visibility: elements.journalVisibility.value, tags: [], linkedTokens: [] }; App.state.journal.push(entry); elements.journalForm.reset(); this.render(); App.markDirty(); },
    render() { elements.journalList.innerHTML = ""; App.state.journal.forEach((entry) => { const node = document.createElement("article"); node.className = "asset-card"; node.innerHTML = `<strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.visibility)}</small><p>${escapeHtml(entry.content).slice(0, 240)}</p>`; elements.journalList.appendChild(node); }); },
  };

  const NetworkManager = {
    connected: false, role: "gm",
    connect() { this.connected = true; elements.connectionLabel.textContent = "Conectado (stub)"; },
    disconnect() { this.connected = false; elements.connectionLabel.textContent = "Offline preparado"; },
    send(event, payload) { console.info("Network stub", event, payload); },
    onMessage(callback) { this.callback = callback; },
    syncState() {}, requestState() {}, broadcastPatch(patch) { this.send("patch", patch); },
  };

  const RollTableManager = {
    roll(name) {
      const table = App.state.tables.find((item) => item.name.toLowerCase() === String(name).toLowerCase());
      if (!table) return ChatManager.send({ sender: "Tabelas", text: `Tabela não encontrada: ${name || "(sem nome)"}`, type: "system" });
      const result = DiceEngine.roll(table.formula || "1d6");
      const entry = table.entries.find((item) => result.total >= item.min && result.total <= item.max);
      ChatManager.send({ sender: "Tabela", text: `${table.name}: ${entry?.result || "sem resultado"} (${result.total})`, type: "message" });
    },
  };

  const PluginManager = {
    plugins: new Map(),
    installBuiltIns() {
      this.register({ id: "bloodied", name: "Bloodied / Ferido", version: "1.0.0", author: "Fate VTT", permissions: ["tokens:update"], description: "Adiciona a condição Ferido quando HP fica abaixo de 50%.", enabled: true, activate() { this.off = EventBus.on("token:update", (token) => { const wounded = token.hp > 0 && token.hp <= token.maxHp / 2; const has = token.conditions.some((condition) => (condition.name || condition) === "Ferido"); if (wounded && !has) token.conditions.push({ id: "bloodied", name: "Ferido", icon: "🩸" }); if (!wounded) token.conditions = token.conditions.filter((condition) => (condition.name || condition) !== "Ferido"); }); }, deactivate() { this.off?.(); } });
      this.register({ id: "auto-initiative", name: "Auto Initiative", version: "1.0.0", author: "Fate VTT", permissions: ["combat:update", "dice:roll"], description: "Comando /init selecionados rola iniciativa para tokens selecionados.", enabled: true, activate() { ChatManager.registerCommand("init", () => CombatManager.rollSelectedInitiative()); }, deactivate() { ChatManager.commands.delete("init"); } });
      this.register({ id: "simple-damage", name: "Simple Damage", version: "1.0.0", author: "Fate VTT", permissions: ["tokens:update", "chat:send"], description: "Comandos /damage 5 e /heal 5 aplicam nos tokens selecionados.", enabled: true, activate() { ChatManager.registerCommand("damage", (value) => applyHpDelta(-rollOrNumber(value || 0))); ChatManager.registerCommand("heal", (value) => applyHpDelta(rollOrNumber(value || 0))); }, deactivate() { ChatManager.commands.delete("damage"); ChatManager.commands.delete("heal"); } });
      this.register({ id: "aura", name: "Aura", version: "1.0.0", author: "Fate VTT", permissions: ["tokens:update"], description: "Liga/desliga luz simples no token selecionado com /aura.", enabled: false, activate() { ChatManager.registerCommand("aura", () => TokenManager.selected().forEach((token) => TokenManager.update(token.id, { emitsLight: !token.emitsLight, lightRange: token.lightRange || 4 }))); }, deactivate() { ChatManager.commands.delete("aura"); } });
      this.render();
    },
    register(plugin) { this.plugins.set(plugin.id, { permissions: [], version: "1.0.0", author: "Desconhecido", ...plugin }); if (plugin.enabled) this.enable(plugin.id); },
    enable(id) { const plugin = this.plugins.get(id); if (!plugin || App.state.plugins[id]) return; try { plugin.activate?.(); App.state.plugins[id] = true; EventBus.emit("plugin:enabled", plugin); } catch (error) { plugin.error = error.message; ChatManager.send({ sender: "Plugin", text: `Erro ao ativar ${plugin.name}: ${error.message}`, type: "system" }); } this.render(); },
    disable(id) { const plugin = this.plugins.get(id); if (!plugin || !App.state.plugins[id]) return; try { plugin.deactivate?.(); App.state.plugins[id] = false; EventBus.emit("plugin:disabled", plugin); } catch (error) { plugin.error = error.message; } this.render(); },
    toggle(id) { App.state.plugins[id] ? this.disable(id) : this.enable(id); App.markDirty(); },
    render() {
      elements.pluginList.innerHTML = "";
      this.plugins.forEach((plugin) => {
        const active = Boolean(App.state.plugins[plugin.id]);
        const node = document.createElement("article"); node.className = "plugin-card";
        node.innerHTML = `<header><strong>${escapeHtml(plugin.name)}</strong><span class="plugin-state ${active ? "" : "off"}">${active ? "Ativo" : "Inativo"}</span></header><p class="muted">${escapeHtml(plugin.description)}</p><small>v${escapeHtml(plugin.version)} • ${escapeHtml(plugin.author)} • permissões: ${escapeHtml(plugin.permissions.join(", ") || "nenhuma")}</small>${plugin.error ? `<small class="danger-text">Erro: ${escapeHtml(plugin.error)}</small>` : ""}<button>${active ? "Desativar" : "Ativar"}</button>`;
        node.querySelector("button").addEventListener("click", () => this.toggle(plugin.id));
        elements.pluginList.appendChild(node);
      });
    },
  };

  const StorageManager = {
    saveLocal() { SceneManager.saveActiveScene(); localStorage.setItem(STORAGE_KEY, JSON.stringify(App.state)); App.markDirty(false); ChatManager.send({ sender: "Sistema", text: "Campanha salva no navegador.", type: "system" }); App.markDirty(false); },
    loadLocal() { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return ChatManager.send({ sender: "Sistema", text: "Nenhum salvamento local encontrado.", type: "system" }); this.applyState(JSON.parse(raw)); ChatManager.send({ sender: "Sistema", text: "Campanha carregada.", type: "system" }); App.markDirty(false); },
    exportJson() { SceneManager.saveActiveScene(); const blob = new Blob([JSON.stringify(App.state, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${App.state.campaignName || "fatetable"}.json`; link.click(); URL.revokeObjectURL(link.href); },
    importJson(event) { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => this.applyState(JSON.parse(reader.result)); reader.readAsText(file); event.target.value = ""; },
    newScene() { const scene = SceneManager.current(); if (scene) { Object.assign(scene, createSceneData(scene.id, scene.name)); } App.state.tokens = []; App.state.drawings = []; App.state.templates = []; App.state.fog = []; App.state.walls = []; App.state.lights = []; App.state.combat = { active: false, round: 1, turnIndex: 0, combatants: [] }; App.mapImage = null; this.syncAll(); TokenManager.create({ name: "Aventureiro", x: 128, y: 128, color: "#8f5cff" }); SceneManager.saveActiveScene(); ChatManager.send({ sender: "Sistema", text: "Mapa/cena atual reiniciado.", type: "system" }); },
    applyState(state) { App.state = { ...createDefaultState(), ...state, settings: { ...createDefaultState().settings, ...(state.settings || {}) }, combat: { ...createDefaultState().combat, ...(state.combat || {}) } }; const scene = SceneManager.current(); if (scene) SceneManager.loadScene(scene); this.syncAll(); },
    syncAll() { elements.campaignName.value = App.state.campaignName; elements.sceneName.value = SceneManager.current()?.name || "Cena"; GridManager.syncInputs(); LayerManager.setLayer(App.state.settings.currentLayer || "tokens"); elements.diagonalRuleInput.value = App.state.settings.diagonalRule; elements.showNamesInput.checked = App.state.settings.showTokenNames; elements.showBarsInput.checked = App.state.settings.showTokenBars; TokenManager.syncForm(); ChatManager.render(); CombatManager.render(); AssetManager.restoreMap(); AssetManager.render(); MacroManager.render(); JournalManager.render(); PluginManager.render(); App.markDirty(false); },
  };

  const InputManager = {
    pointerDown(event) {
      elements.canvas.setPointerCapture(event.pointerId);
      const point = getCanvasPoint(event); const world = GridManager.screenToWorld(point);
      if (App.activeTool === "token") return TokenManager.create({ x: world.x, y: world.y });
      if (App.activeTool === "template") return TemplateManager.create(world);
      if (App.activeTool === "fog") return FogManager.reveal(world);
      if (App.activeTool === "light") return LightManager.create(world);
      if (App.activeTool === "erase") return eraseAt(world);
      if (App.activeTool === "ping") return ChatManager.send({ sender: "Ping", text: `Ping em ${formatGrid(world)}.`, type: "system" });
      if (["wall", "door"].includes(App.activeTool)) { App.drag = { type: App.activeTool, start: world, current: world }; return; }
      if (App.activeTool === "draw") { const drawing = { id: uid("draw"), color: "#d7a94b", opacity: 0.95, width: 3, points: [world] }; App.state.drawings.push(drawing); App.drag = { type: "draw", drawing }; return; }
      if (App.activeTool === "measure") { App.drag = { type: "measure", start: world, current: world }; return; }
      if (App.activeTool === "pan" || event.button === 1 || App.spacePan) { App.drag = { type: "pan", start: point, camera: { ...App.camera } }; return; }
      const token = TokenManager.tokenAt(world);
      if (token) { TokenManager.select(token.id, event.shiftKey); App.drag = { type: "token", tokenId: token.id, offset: { x: world.x - token.x, y: world.y - token.y } }; }
      else { App.state.selectedTokenIds = []; TokenManager.syncForm(); App.drag = null; }
    },
    pointerMove(event) {
      const point = getCanvasPoint(event); const world = GridManager.screenToWorld(point); const cell = GridManager.worldToGrid(world);
      elements.mouseCoords.textContent = `Col ${cell.col}, Lin ${cell.row}`;
      if (!App.drag) return;
      if (App.drag.type === "pan") { App.camera.x = App.drag.camera.x + point.x - App.drag.start.x; App.camera.y = App.drag.camera.y + point.y - App.drag.start.y; }
      if (App.drag.type === "token") { const token = App.state.tokens.find((item) => item.id === App.drag.tokenId); if (token && !token.locked) { const snapped = GridManager.snap({ x: world.x - App.drag.offset.x, y: world.y - App.drag.offset.y }); token.x = snapped.x; token.y = snapped.y; EventBus.emit("token:move", token); App.markDirty(); } }
      if (App.drag.type === "draw") { App.drag.drawing.points.push(world); App.markDirty(); }
      if (App.drag.type === "wall") { App.drag.current = world; }
      if (App.drag.type === "measure") { App.drag.current = world; showMeasure(App.drag.start, world); }
    },
    pointerUp() {
      if (["wall", "door"].includes(App.drag?.type)) { App.state.walls.push({ id: uid("wall"), x1: App.drag.start.x, y1: App.drag.start.y, x2: App.drag.current.x, y2: App.drag.current.y, blocksMovement: true, blocksVision: true, door: App.drag.type === "door", open: false, locked: false, hidden: false }); App.markDirty(); }
      if (App.drag?.type === "measure") elements.measureOverlay.classList.add("hidden");
      App.drag = null;
    },
    wheel(event) {
      event.preventDefault();
      const point = getCanvasPoint(event); const before = GridManager.screenToWorld(point);
      App.camera.zoom = clamp(App.camera.zoom * (event.deltaY < 0 ? 1.1 : 0.9), 0.25, 3);
      const after = GridManager.screenToWorld(point);
      App.camera.x += (after.x - before.x) * App.camera.zoom;
      App.camera.y += (after.y - before.y) * App.camera.zoom;
      elements.zoomLabel.textContent = `${Math.round(App.camera.zoom * 100)}%`;
    },
    keyDown(event) {
      if (isTyping(event.target)) return;
      if (event.code === "Space") { App.spacePan = true; event.preventDefault(); }
      if (event.ctrlKey && event.key.toLowerCase() === "s") { event.preventDefault(); StorageManager.saveLocal(); }
      const map = { v: "select", h: "pan", m: "measure", t: "token", f: "fog", d: "draw", l: "light", p: "ping" };
      const tool = map[event.key.toLowerCase()]; if (tool) App.setTool(tool);
      if (event.key.toLowerCase() === "c") { App.showTab("chat"); elements.chatInput.focus(); }
      if (/^[0-9]$/.test(event.key)) { const index = event.key === "0" ? 9 : Number(event.key) - 1; const macro = App.state.macros[index]; if (macro) MacroManager.run(macro); }
      if (event.key === "Delete") TokenManager.deleteSelected();
      if (event.key === "Escape") App.setTool("select");
    },
    keyUp(event) { if (event.code === "Space") App.spacePan = false; },
    contextMenu(event) {
      event.preventDefault();
      const world = GridManager.screenToWorld(getCanvasPoint(event));
      const token = TokenManager.tokenAt(world);
      if (!token) return;
      TokenManager.select(token.id);
      elements.contextMenu.innerHTML = "";
      const actions = [
        ["Editar ficha", () => App.showTab("sheet")],
        ["Duplicar", () => TokenManager.create({ ...token, id: undefined, name: `${token.name} cópia`, x: token.x + App.state.settings.gridSize, y: token.y })],
        ["Adicionar ao combate", () => CombatManager.addToken(token.id)],
        ["Rolar iniciativa", () => CombatManager.rollSelectedInitiative()],
        ["Dano 5", () => applyHpDelta(-5)],
        ["Cura 5", () => applyHpDelta(5)],
        [token.hidden ? "Mostrar" : "Esconder", () => TokenManager.update(token.id, { hidden: !token.hidden })],
        [token.locked ? "Destravar" : "Travar", () => TokenManager.update(token.id, { locked: !token.locked })],
        ["Centralizar câmera", () => centerOnToken(token)],
        ["Deletar", () => TokenManager.delete(token.id)],
      ];
      actions.forEach(([label, action]) => { const button = document.createElement("button"); button.textContent = label; button.addEventListener("click", () => { action(); elements.contextMenu.classList.add("hidden"); }); elements.contextMenu.appendChild(button); });
      elements.contextMenu.style.left = `${event.clientX}px`; elements.contextMenu.style.top = `${event.clientY}px`; elements.contextMenu.classList.remove("hidden");
    },
  };

  function rollOrNumber(value) {
    const text = String(value).trim();
    if (/d/i.test(text)) return DiceEngine.roll(resolveRollVariables(text)).total;
    return Number(text) || 0;
  }
  function resolveRollVariables(expression) {
    const selected = TokenManager.selected()[0];
    return String(expression).replace(/@selected\.hp/g, selected?.hp ?? 0).replace(/@selected\.maxHp/g, selected?.maxHp ?? 0).replace(/@selected\.armor/g, selected?.armor ?? 0);
  }
  function addConditionFromCommand(payload) {
    const condition = String(payload || "").trim() || "Marcado";
    TokenManager.selected().forEach((token) => TokenManager.update(token.id, { conditions: [...token.conditions, { id: uid("condition"), name: condition, icon: "●" }] }));
  }
  function applyHpDelta(delta) { TokenManager.selected().forEach((token) => TokenManager.update(token.id, { hp: token.hp + delta })); }
  function eraseAt(world) {
    const token = TokenManager.tokenAt(world);
    if (token) return TokenManager.delete(token.id);
    App.state.templates = App.state.templates.filter((tpl) => Math.hypot(tpl.x - world.x, tpl.y - world.y) > tpl.radius);
    App.state.lights = App.state.lights.filter((light) => Math.hypot(light.x - world.x, light.y - world.y) > light.radius);
    App.markDirty();
  }
  function centerOnToken(token) { const rect = elements.canvas.getBoundingClientRect(); App.camera.x = rect.width / 2 - token.x * App.camera.zoom; App.camera.y = rect.height / 2 - token.y * App.camera.zoom; }
  function getCanvasPoint(event) { const rect = elements.canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
  function formatGrid(world) { const cell = GridManager.worldToGrid(world); return `coluna ${cell.col}, linha ${cell.row}`; }
  function showMeasure(start, end) { const dx = end.x - start.x; const dy = end.y - start.y; const cells = Math.hypot(dx, dy) / App.state.settings.gridSize; elements.measureOverlay.textContent = `${cells.toFixed(1)} células • ${(cells * 1.5).toFixed(1)}m`; elements.measureOverlay.classList.remove("hidden"); }
  function isTyping(target) { return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable; }
  function escapeHtml(value) { const div = document.createElement("div"); div.textContent = String(value ?? ""); return div.innerHTML; }

  window.TabletopAPI = {
    version: "0.1.0",
    registerPlugin: (plugin) => PluginManager.register(plugin),
    enablePlugin: (id) => PluginManager.enable(id),
    disablePlugin: (id) => PluginManager.disable(id),
    getPluginSettings: (id) => App.state.pluginSettings[id] || {},
    setPluginSettings: (id, settings) => { App.state.pluginSettings[id] = { ...(App.state.pluginSettings[id] || {}), ...settings }; App.markDirty(); },
    on: (eventName, callback) => EventBus.on(eventName, callback),
    off: (eventName, callback) => EventBus.off(eventName, callback),
    emit: (eventName, payload) => EventBus.emit(eventName, payload),
    createToken: (data) => TokenManager.create(data),
    updateToken: (id, patch) => TokenManager.update(id, patch),
    deleteToken: (id) => TokenManager.delete(id),
    getToken: (id) => App.state.tokens.find((token) => token.id === id),
    getTokens: () => App.state.tokens,
    getSelectedTokens: () => TokenManager.selected(),
    createScene: (data) => SceneManager.createScene(data),
    getScene: (id) => App.state.scenes.find((scene) => scene.id === id),
    switchScene: (id) => SceneManager.switchScene(id),
    roll: (expression) => DiceEngine.roll(expression),
    sendChatMessage: (message) => ChatManager.send(message),
    registerChatCommand: (command, handler) => ChatManager.registerCommand(command, handler),
    registerSheetTemplate: (template) => App.state.sheets.push(template),
    registerRollTemplate: (template) => ChatManager.registerRollTemplate(template.name, template.renderer),
    registerMacro: (macro) => MacroManager.register(macro),
    addCombatant: (tokenId) => CombatManager.addToken(tokenId),
    nextTurn: () => CombatManager.nextTurn(),
    createDrawing: (data) => { const drawing = { id: uid("draw"), color: "#d7a94b", opacity: 1, width: 3, points: [], ...data }; App.state.drawings.push(drawing); App.markDirty(); return drawing; },
    createTemplate: (data) => { const tpl = { id: uid("tpl"), type: "circle", x: 0, y: 0, radius: 128, color: "#8f5cff", opacity: 0.35, ...data }; App.state.templates.push(tpl); App.markDirty(); return tpl; },
    revealFog: (data) => FogManager.reveal(data),
    hideFog: (data) => { App.state.fog = App.state.fog.filter((fog) => Math.hypot(fog.x - data.x, fog.y - data.y) > (data.radius || App.state.settings.gridSize)); App.markDirty(); EventBus.emit("fog:hide", data); },
    saveCampaign: () => StorageManager.saveLocal(),
    loadCampaign: () => StorageManager.loadLocal(),
    network: NetworkManager,
  };

  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, width, height, radius) {
      const r = Math.min(radius, width / 2, height / 2); this.beginPath(); this.moveTo(x + r, y); this.arcTo(x + width, y, x + width, y + height, r); this.arcTo(x + width, y + height, x, y + height, r); this.arcTo(x, y + height, x, y, r); this.arcTo(x, y, x + width, y, r); return this;
    };
  }

  GridManager.syncInputs();
  App.init();
})();

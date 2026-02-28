// === data.js - VARIABLES GLOBALES Y DEFINICIONES ESTÁTICAS ===
// Solo contiene: inicialización del canvas, definiciones de ítems/herramientas,
// estado global del jugador/mundo y helpers puramente utilitarios (sin lógica de negocio).
//
// La lógica de terreno/semilla está en terrain.js
// La lógica de inventario está en inventory.js

window.getEl = function (id) { return document.getElementById(id); };

// ─── Canvas y contexto ────────────────────────────────────────────────────────

window.canvas = document.getElementById('gameCanvas');
window.ctx    = window.canvas.getContext('2d');

// ─── Sprites ─────────────────────────────────────────────────────────────────

window.sprites = {
    tree_oak: new Image(), tree_pine: new Image(), tree_birch: new Image(), tree_stump: new Image(),
    rock_full: new Image(), rock_damaged: new Image(),
    tile_grass_top: new Image(), tile_dirt: new Image(),
    tile_sand_top: new Image(), tile_sand_base: new Image(),
    bg_mountains_back: new Image(), bg_mountains_mid: new Image(),
    sprite_sun: new Image(), sprite_moon: new Image(), sprite_cloud: new Image()
};

(function loadSprites() {
    const s = window.sprites;
    s.tree_oak.src            = 'assets/tree_oak.png';
    s.tree_pine.src           = 'assets/tree_pine.png';
    s.tree_birch.src          = 'assets/tree_birch.png';
    s.tree_stump.src          = 'assets/tree_stump.png';
    s.rock_full.src           = 'assets/rock_full.png';
    s.rock_damaged.src        = 'assets/rock_damaged.png';
    s.tile_grass_top.src      = 'assets/tile_grass_top.png';
    s.tile_dirt.src           = 'assets/tile_dirt.png';
    s.tile_sand_top.src       = 'assets/tile_sand_top.png';
    s.tile_sand_base.src      = 'assets/tile_sand_base.png';
    s.bg_mountains_back.src   = 'assets/bg_mountains_back.png';
    s.bg_mountains_mid.src    = 'assets/bg_mountains_mid.png';
    s.sprite_sun.src          = 'assets/sprite_sun.png';
    s.sprite_moon.src         = 'assets/sprite_moon.png';
    s.sprite_cloud.src        = 'assets/sprite_cloud.png';
})();

// ─── HiDPI ────────────────────────────────────────────────────────────────────

(function setupHiDPI() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const logicW = 1280, logicH = 720;
    window.canvas.width  = logicW * dpr;
    window.canvas.height = logicH * dpr;
    window.canvas.style.width  = logicW + 'px';
    window.canvas.style.height = logicH + 'px';
    window.ctx.scale(dpr, dpr);
    window._canvasLogicW = logicW;
    window._canvasLogicH = logicH;
    window._dpr          = dpr;
})();

// ─── Canvas de luz ────────────────────────────────────────────────────────────

window.lightCanvas        = document.createElement('canvas');
window.lightCanvas.width  = window.canvas.width;
window.lightCanvas.height = window.canvas.height;
window.lightCtx           = window.lightCanvas.getContext('2d');
window.lightCtx.scale(window._dpr, window._dpr);

// ─── Estado global ────────────────────────────────────────────────────────────

window.socket       = null;
window.otherPlayers = {};

window.game = {
    gravity:          0.32,
    blockSize:        30,
    groundLevel:      510,
    baseGroundLevel:  510,
    chunkSize:        1280,
    exploredRight:    1280,
    frameCount:       0,
    screenShake:      0,
    days:             1,
    shoreX:           200,
    isRunning:        false,
    isMultiplayer:    false,
    isRaining:        false,
    serverStartTime:  0,
    zoom:             1.0,
    minZoom:          0.6,
    maxZoom:          1.8,
    zoomTarget:       1.0
};

window.worldSeed = 0;
window.seedCode  = '';

// ─── Definiciones de herramientas e ítems ────────────────────────────────────

window.toolDefs = {
    hand:    { id: 'hand',    name: 'Mano'     },
    torch:   { id: 'torch',   name: 'Antorcha' },
    axe:     { id: 'axe',     name: 'Hacha'    },
    hammer:  { id: 'hammer',  name: 'Martillo' },
    bow:     { id: 'bow',     name: 'Arco'     },
    pickaxe: { id: 'pickaxe', name: 'Pico'     },
    sword:   { id: 'sword',   name: 'Espada'   }
};

window.itemDefs = {
    wood:          { name: 'Madera',            color: '#c19a6b', size: 12, maxStack: 500 },
    stone:         { name: 'Piedra',            color: '#999',    size: 10, maxStack: 500 },
    meat:          { name: 'Carne Cruda',        color: '#ff5555', size: 10, maxStack: 100 },
    cooked_meat:   { name: 'Carne Asada',        color: '#c0392b', size: 11, maxStack: 100 },
    web:           { name: 'Tela Araña',         color: '#e0e0e0', size:  8, maxStack: 100 },
    arrows:        { name: 'Flechas',            color: '#888',    size:  6, maxStack: 100 },
    boxes:         { name: 'Caja',              color: '#8B4513', size: 14, maxStack:  10 },
    campfire_item: { name: 'Fogata',             color: '#e67e22', size: 14, maxStack:  10 },
    bed_item:      { name: 'Cama',              color: '#8B0000', size: 16, maxStack:   1 },
    barricade_item:{ name: 'Barricada con Púas', color: '#8B4513', size: 14, maxStack:   5 },
    ladder_item:   { name: 'Escalera',          color: '#c8a86a', size: 14, maxStack:  20 },
    turret_item:   { name: 'Torreta',            color: '#6b4c24', size: 14, maxStack:   3 }
};

window.toolMaxDurability = {
    torch: 300, axe: 40, hammer: 50, pickaxe: 40, bow: 30, sword: 60
};

// ─── Estado del jugador ───────────────────────────────────────────────────────

window.player = {
    name: 'Invitado',
    x: 250, y: 100, width: 24, height: 40,
    vx: 0, vy: 0,
    baseSpeed: 2.8, baseJump: -7.2, baseHp: 100, baseHunger: 100,
    speed: 2.8, jumpPower: -7.2,
    hp: 100, maxHp: 100, hunger: 100, maxHunger: 100,
    baseDamage: { hand: 9, torch: 10, hammer: 15, pickaxe: 15, axe: 25, sword: 60 },
    level: 1, xp: 0, maxXp: 100, statPoints: 0,
    stats: { str: 0, agi: 0, vit: 0, sta: 0, int: 0 },
    isGrounded: false, coyoteTime: 0, isJumping: false,
    animTime: 0, jumpKeyReleased: true, isDead: false, bedPos: null,
    inventory: {
        wood: 200, stone: 0, meat: 0, cooked_meat: 0, web: 10,
        arrows: 0, boxes: 0, campfire_item: 0, bed_item: 0,
        barricade_item: 0, ladder_item: 0, turret_item: 0
    },
    toolbar: ['hand', null, null, null, null, null],
    activeSlot: 0, activeTool: 'hand', availableTools: ['hand'],
    toolHealth: {}, buildMode: 'block',
    inBackground: false, wantsBackground: false,
    miningRange: 150, isHit: false,
    attackFrame: 0, facingRight: true,
    isAiming: false, isCharging: false, chargeLevel: 0,
    isStealth: false, nearbyItem: null, placementMode: null,
    chatText: '', chatExpires: 0
};

// ─── Arrays del mundo ─────────────────────────────────────────────────────────

window.trees         = [];
window.rocks         = [];
window.blocks        = [];
window.particles     = [];
window.entities      = [];
window.damageTexts   = [];
window.droppedItems  = [];
window.projectiles   = [];
window.dustParticles = [];
window.removedTrees  = [];
window.removedRocks  = [];
window.treeState     = {};
window.killedEntities = [];
window.stuckArrows   = [];
window.currentOpenBox   = null;
window.currentCampfire  = null;

// ─── Input y cámara ───────────────────────────────────────────────────────────

window.camera      = { x: 0, y: 0 };
window.mouseWorldX = 0;
window.mouseWorldY = 0;
window.screenMouseX = 1280 / 2;
window.screenMouseY = 720 / 2;
window.keys = { w: false, a: false, d: false, space: false, shift: false, jumpPressed: false, y: false };

// ─── Decoración del mundo ─────────────────────────────────────────────────────

window.stars  = Array.from({ length: 150 }, () => ({
    x: Math.random() * 1280, y: Math.random() * 450, s: Math.random() * 2 + 1
}));
window.clouds = Array.from({ length: 10 }, () => ({
    x: Math.random() * 1280, y: Math.random() * 250 + 20,
    s: Math.random() * 0.6 + 0.4, v: Math.random() * 0.15 + 0.05
}));

// ─── Utilidades puramente funcionales (sin efecto de negocio) ────────────────

/** Intersección de dos rectángulos AABB */
window.checkRectIntersection = function (x1, y1, w1, h1, x2, y2, w2, h2) {
    return x2 < x1 + w1 && x2 + w2 > x1 && y2 < y1 + h1 && y2 + h2 > y1;
};

/** Marca un objeto como "golpeado" durante 150 ms */
window.setHit = function (t) {
    t.isHit = true;
    t.lastHitTime = Date.now();
    setTimeout(() => { t.isHit = false; }, 150);
};

/** Devuelve los bloques de una columna X que son sólidos */
window.getBlocksForCol = function (x) {
    return window.blocks.filter(b =>
        b.x === x && ['block','door','box','campfire','bed','grave'].includes(b.type) &&
        !(b.type === 'door' && b.open)
    );
};

/** Lanza un conjunto de partículas decorativas */
window.spawnParticles = function (x, y, color, count, speed = 1) {
    for (let i = 0; i < count; i++) {
        window.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 4 * speed,
            vy: (Math.random() - 1)   * 4 * speed,
            life: 1.0, decay: 0.02 + Math.random() * 0.03,
            color, size: Math.random() * 4 + 2
        });
    }
};

/** Agrega un texto de daño flotante */
window.spawnDamageText = function (x, y, text, color = '#ff4444') {
    window.damageTexts.push({ x, y, text, life: 1.0, color });
};

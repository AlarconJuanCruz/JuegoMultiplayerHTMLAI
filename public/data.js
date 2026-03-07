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
window.ctx.imageSmoothingEnabled = false;

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
    dirt:          { name: 'Tierra',            color: '#7a5230', size: 10, maxStack: 500 },
    coal:          { name: 'Carbón',            color: '#444',    size: 10, maxStack: 500 },
    sulfur:        { name: 'Azufre',            color: '#c8b800', size: 10, maxStack: 200 },
    diamond:       { name: 'Diamante',          color: '#7df9ff', size: 10, maxStack: 100 },
    meat:          { name: 'Carne Cruda',        color: '#ff5555', size: 10, maxStack: 100 },
    cooked_meat:   { name: 'Carne Asada',        color: '#c0392b', size: 11, maxStack: 100 },
    web:           { name: 'Tela Araña',         color: '#e0e0e0', size:  8, maxStack: 100 },
    arrows:        { name: 'Flechas',            color: '#888',    size:  6, maxStack: 100 },
    boxes:         { name: 'Caja',              color: '#8B4513', size: 14, maxStack:  10 },
    campfire_item: { name: 'Fogata',             color: '#e67e22', size: 14, maxStack:  10 },
    bed_item:      { name: 'Cama',              color: '#8B0000', size: 16, maxStack:   1 },
    barricade_item:{ name: 'Barricada con Púas', color: '#8B4513', size: 14, maxStack:   5 },
    ladder_item:   { name: 'Escalera',          color: '#c8a86a', size: 14, maxStack:  20 },
    turret_item:   { name: 'Torreta',            color: '#6b4c24', size: 14, maxStack:   3 },
    molotov:       { name: '🍾 Molotov',          color: '#c0392b', size: 14, maxStack:  10 },
    torch_item:    { name: 'Antorcha',           color: '#f39c12', size: 12, maxStack:  30 },
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
    walkSpeed: 1.2,   // velocidad caminata (default)
    runSpeed:  2.8,   // velocidad corriendo (shift)
    speed: 1.4, jumpPower: -7.2,
    hp: 100, maxHp: 100, hunger: 100, maxHunger: 100,
    baseDamage: { hand: 9, torch: 10, hammer: 15, pickaxe: 15, axe: 25, sword: 60 },
    level: 1, xp: 0, maxXp: 100, statPoints: 0,
    stats: { str: 0, agi: 0, vit: 0, sta: 0, int: 0 },
    isGrounded: false, coyoteTime: 0, isJumping: false,
    animTime: 0, jumpKeyReleased: true, isDead: false, bedPos: null,
    inventory: {
        wood: 200, stone: 0, dirt: 0, coal: 0, sulfur: 0, diamond: 0,
        meat: 0, cooked_meat: 0, web: 10,
        arrows: 0, boxes: 0, campfire_item: 0, bed_item: 0,
        barricade_item: 0, ladder_item: 0, turret_item: 0,
        molotov: 5, torch_item: 0
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
window.fires         = [];      // { x, y, w, h, life, maxLife, intensity, fromBlock }
window.scorchMarks   = [];      // { x, y, w, h, alpha, seed }
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
    // Asegurar maxHp para que drawCracks funcione
    if (t.hp !== undefined && !t.maxHp) t.maxHp = t.hp;
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
    // Redondear números de daño para evitar decimales
    const cleanText = typeof text === 'string'
        ? text.replace(/-?\d+\.\d+/g, n => Math.round(parseFloat(n)).toString())
        : String(Math.round(text));
    window.damageTexts.push({ x, y, text: cleanText, life: 1.0, color });
};

// ─── Sistema Molotov / Fuego ───────────────────────────────────────────────────

/**
 * Crea un foco de fuego al impactar la molotov.
 * Crea varias llamas y una marca de quemado en el suelo.
 */
window.spawnMolotovFire = function(impX, impY, isLocalPlayer) {
    if (!isLocalPlayer) return;  // solo el dueño genera el fuego

    const bs = window.game.blockSize;
    // Radio de explosión: 2.5 bloques, escala leve con INT
    const intBonus = (window.player.stats.int || 0) * 0.08;
    const radius   = bs * (2.2 + intBonus);
    // Fire duration: ~20s base (1200 frames) + int bonus. Scorch fades slower.
    const fireDur  = 1200 + (window.player.stats.int || 0) * 60;

    // Partículas de explosión
    for (let i = 0; i < 22; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd   = 1.5 + Math.random() * 4;
        window.particles.push({
            x: impX, y: impY,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd - 2,
            life: 1.0, decay: 0.018 + Math.random() * 0.025,
            color: Math.random() > 0.5 ? '#ff6600' : '#ffcc00',
            size: 4 + Math.random() * 6
        });
    }
    if (window.playSound) window.playSound('explosion');

    // Marca de quemado en el suelo (scorch) — solo si impacta sobre terreno real
    {
        const groundY = window.getGroundY ? window.getGroundY(impX) : window.game.groundLevel;
        const onGround = Math.abs(impY - groundY) < 30;
        // Verificar que no hay un bloque sólido en el punto de impacto
        const bs2 = window.game.blockSize;
        const onBlock = window.blocks.some(b2 =>
            b2.type !== 'ladder' && b2.type !== 'stair' &&
            impX >= b2.x && impX <= b2.x + bs2 &&
            impY >= b2.y && impY <= b2.y + bs2
        );
        if (onGround && !onBlock) {
            window.scorchMarks.push({
                x: impX - radius,
                y: impY - 10,
                w: radius * 2,
                h: 22,
                alpha: 0.80,
                seed: Math.floor(impX * 7 + impY * 13) & 0xFFFF,
                born: Date.now(),
                lifetime: 150000 + Math.random() * 90000
            });
        }
    }

    // Crear focos de fuego en área: varios puntos dentro del radio
    const fireCount = 6 + Math.floor(intBonus * 3);
    for (let f = 0; f < fireCount; f++) {
        const angle = (f / fireCount) * Math.PI * 2 + Math.random() * 0.8;
        const dist  = radius * (0.2 + Math.random() * 0.85);
        const fx    = impX + Math.cos(angle) * dist;
        const fy    = window.getGroundY ? window.getGroundY(fx) : impY;
        window.fires.push({
            x: fx - 12, y: fy - 28,
            w: 20 + Math.random() * 14,
            h: 28 + Math.random() * 18,
            life: fireDur * (0.6 + Math.random() * 0.6),
            maxLife: fireDur,
            intensity: 0.7 + Math.random() * 0.3,
            seed: Math.floor(fx * 3 + fy * 7) & 0xFFFF,
            phase: Math.random() * Math.PI * 2,   // para animación
            damageTimer: 0
        });
        // Marca de quemado bajo cada foco
        window.scorchMarks.push({
            x: fx - 12, y: fy - 6,
            w: 24 + Math.random() * 10,
            h: 10 + Math.random() * 6,
            alpha: 0.60 + Math.random() * 0.25,
            seed: Math.floor(fx * 11 + fy * 5) & 0xFFFF,
            born: Date.now(),
            lifetime: 120000 + Math.random() * 60000
        });
    }

    // Fuego central más grande
    window.fires.push({
        x: impX - 22, y: impY - 50,
        w: 44, h: 50,
        life: fireDur * 1.2,
        maxLife: fireDur,
        intensity: 1.0,
        seed: Math.floor(impX * 5 + impY * 9) & 0xFFFF,
        phase: 0,
        damageTimer: 0
    });
};

/**
 * Actualiza los focos de fuego: reduce vida, daña entidades, daña bloques de madera.
 * Llamar desde el loop principal.
 */
window.updateFires = function() {
    const bs = window.game.blockSize;

    for (let i = window.fires.length - 1; i >= 0; i--) {
        const fire = window.fires[i];
        fire.life--;
        fire.phase += 0.12;
        fire.damageTimer++;

        // Emitir partículas de chispa ocasionales
        if (Math.random() < 0.06 * fire.intensity) {
            window.particles.push({
                x: fire.x + fire.w * 0.3 + Math.random() * fire.w * 0.4,
                y: fire.y + fire.h * 0.2,
                vx: (Math.random() - 0.5) * 1.2,
                vy: -(0.8 + Math.random() * 2.0),
                life: 1.0, decay: 0.035 + Math.random() * 0.04,
                color: Math.random() > 0.6 ? '#ff8800' : '#ffee44',
                size: 1.5 + Math.random() * 2.5
            });
        }

        // Daño cada 40 frames
        if (fire.damageTimer >= 40) {
            fire.damageTimer = 0;
            const fireCX = fire.x + fire.w / 2;
            const fireCY = fire.y + fire.h / 2;
            const fireDmg = 8 + (window.player?.stats?.int || 0) * 1.5;

            // Daño al jugador si está en el fuego
            if (!window.player.isDead && !window.player.inBackground) {
                const pCX = window.player.x + window.player.width / 2;
                const pCY = window.player.y + window.player.height / 2;
                if (Math.hypot(pCX - fireCX, pCY - fireCY) < fire.w * 0.8) {
                    window.damagePlayer(fireDmg * 0.5, '🔥 Fuego');
                }
            }

            // Daño a entidades en el fuego
            for (const ent of window.entities) {
                if (ent.hp <= 0) continue;
                const eCX = ent.x + ent.width / 2;
                const eCY = ent.y + ent.height / 2;
                if (Math.hypot(eCX - fireCX, eCY - fireCY) < fire.w * 0.85) {
                    ent.hp -= fireDmg;
                    window.setHit(ent);
                    window.spawnDamageText(eCX, ent.y - 8, '-' + Math.floor(fireDmg), '#ff6600');
                    // Marca de quemado sobre la entidad
                    if (Math.random() < 0.3) {
                        window.scorchMarks.push({
                            x: ent.x, y: ent.y + ent.height - 8,
                            w: ent.width, h: 8,
                            alpha: 0.4, seed: Math.floor(eCX * 3) & 0xFFFF,
                            born: Date.now(), lifetime: 60000
                        });
                    }
                    if (ent.hp <= 0) {
                        window.killedEntities.push(ent.id);
                        window.sendWorldUpdate('kill_entity', { id: ent.id });
                        window.spawnParticles(eCX, ent.y, '#ff6600', 12, 1.2);
                        // Si muere por fuego y es un animal con carne: drop carne cocinada
                        const meatDroppers = new Set(['chicken', 'wolf', 'zombie']);
                        if (meatDroppers.has(ent.type)) {
                            // Calcular cuánta carne saldría normalmente
                            const meatAmt = ent.type === 'chicken' ? 1
                                          : ent.type === 'zombie'  ? 2
                                          : 1 + Math.floor(Math.random() * 2);
                            const xpAmt   = ent.type === 'chicken' ? 10
                                          : ent.type === 'zombie'  ? 50 * ent.level
                                          : 35 * ent.level;
                            const item = {
                                id: Math.random().toString(36).substring(2, 15),
                                x: eCX, y: ent.y,
                                vx: 0, vy: -1,
                                type: 'cooked_meat', amount: meatAmt, life: 1.0
                            };
                            window.droppedItems.push(item);
                            window.sendWorldUpdate('drop_item', { item });
                            window.gainXP(xpAmt);
                            // Partículas de vapor/humo al salir la carne
                            for (let _s = 0; _s < 5; _s++) {
                                window.particles.push({
                                    x: eCX + (Math.random() - 0.5) * 14,
                                    y: ent.y - 4 + Math.random() * 8,
                                    vx: (Math.random() - 0.5) * 0.8,
                                    vy: -(0.6 + Math.random() * 1.2),
                                    life: 1.0, decay: 0.04 + Math.random() * 0.03,
                                    color: '#c8a050',
                                    size: 2 + Math.random() * 2
                                });
                            }
                        } else {
                            window.killEntityLoot(ent);
                        }
                        window.entities.splice(window.entities.indexOf(ent), 1);
                        if (window.updateUI) window.updateUI();
                    }
                }
            }

            // Daño a bloques de MADERA cercanos (block, stair, barricade, door, box)
            const woodTypes = new Set(['block', 'stair', 'barricade', 'door', 'box', 'ladder']);
            for (const b of window.blocks) {
                if (!woodTypes.has(b.type)) continue;
                const bCX = b.x + bs / 2;
                const bCY = b.y + bs / 2;
                if (Math.hypot(bCX - fireCX, bCY - fireCY) > fire.w * 1.1) continue;

                const woodDmg = fireDmg * 0.8;
                b.hp = (b.hp || b.maxHp || 100) - woodDmg;
                window.setHit(b);

                // Añadir marca de quemado sobre el bloque
                if (!window.scorchMarks.some(s => Math.abs(s.x - b.x) < 4 && Math.abs(s.y - b.y) < 4)) {
                    window.scorchMarks.push({
                        x: b.x, y: b.y,
                        w: bs, h: bs,
                        alpha: 0.55 + Math.random() * 0.3,
                        seed: Math.floor(b.x * 7 + b.y * 11) & 0xFFFF,
                        born: Date.now(),
                        blockX: b.x, blockY: b.y,  // para eliminarse si el bloque se destruye
                        lifetime: 90000 + Math.random() * 60000
                    });
                }

                if (b.hp <= 0) {
                    window.destroyBlockLocally(b);
                    window.sendWorldUpdate('hit_block', { x: b.x, y: b.y, dmg: 9999, destroyed: true });
                } else {
                    window.sendWorldUpdate('hit_block', { x: b.x, y: b.y, dmg: woodDmg });
                }
            }
        }

        if (fire.life <= 0) {
            window.fires.splice(i, 1);
        }
    }
};

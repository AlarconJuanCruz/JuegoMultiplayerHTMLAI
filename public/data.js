// === data.js - VARIABLES GLOBALES Y DEFINICIONES ===

window.getEl = function(id) { return document.getElementById(id); };

window.canvas = document.getElementById('gameCanvas');
window.ctx = window.canvas.getContext('2d');

// Alta resolución (2x) para canvas nítido
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
    window._dpr = dpr;
})();

window.lightCanvas = document.createElement('canvas');
window.lightCanvas.width  = window.canvas.width;
window.lightCanvas.height = window.canvas.height;
window.lightCtx = window.lightCanvas.getContext('2d');
window.lightCtx.scale(window._dpr, window._dpr);

window.socket = null; window.otherPlayers = {}; 

window.game = { gravity: 0.5, blockSize: 30, groundLevel: 580, chunkSize: 1280, exploredRight: 1280, frameCount: 0, screenShake: 0, days: 1, shoreX: 200, isRunning: false, isMultiplayer: false, isRaining: false, serverStartTime: 0 };
window.camera = { x: 0, y: 0 }; window.mouseWorldX = 0; window.mouseWorldY = 0; window.screenMouseX = 1280 / 2; window.screenMouseY = 720 / 2;
window.keys = { w: false, a: false, d: false, space: false, shift: false, jumpPressed: false, y: false };

window.trees = []; window.rocks = []; window.blocks = []; window.particles = []; window.entities = []; window.damageTexts = []; window.droppedItems = []; window.projectiles = [];
window.removedTrees = []; window.removedRocks = []; window.treeState = {}; window.killedEntities = [];
window.currentOpenBox = null; window.currentCampfire = null;

window.toolDefs = { 'hand': { id: 'hand', name: 'Mano' }, 'torch': { id: 'torch', name: 'Antorcha' }, 'axe': { id: 'axe', name: 'Hacha' }, 'hammer': { id: 'hammer', name: 'Mart.' }, 'bow': { id: 'bow', name: 'Arco' }, 'pickaxe': { id: 'pickaxe', name: 'Pico'}, 'sword': {id: 'sword', name: 'Espada'} };

window.itemDefs = { 
    'wood': { name: 'Madera', color: '#c19a6b', size: 12, maxStack: 500 }, 
    'stone': { name: 'Piedra', color: '#999', size: 10, maxStack: 500 }, 
    'meat': { name: 'Carne Cruda', color: '#ff5555', size: 10, maxStack: 100 }, 
    'cooked_meat': { name: 'Carne Asada', color: '#c0392b', size: 11, maxStack: 100 }, 
    'web':  { name: 'Tela Araña', color: '#e0e0e0', size: 8, maxStack: 100 }, 
    'arrows': { name: 'Flechas', color: '#888', size: 6, maxStack: 100 }, 
    'boxes': { name: 'Caja', color: '#8B4513', size: 14, maxStack: 10 }, 
    'campfire_item': { name: 'Fogata', color: '#e67e22', size: 14, maxStack: 10 },
    'bed_item': { name: 'Cama', color: '#8B0000', size: 16, maxStack: 1 },
    'barricade_item': { name: 'Barricada con Púas', color: '#8B4513', size: 14, maxStack: 5 }
};
window.toolMaxDurability = { torch: 300, axe: 40, hammer: 50, pickaxe: 40, bow: 30, sword: 60 };

window.player = {
    name: "Invitado", x: 250, y: 100, width: 24, height: 48, vx: 0, vy: 0, 
    baseSpeed: 3.5, baseJump: -9.0, baseHp: 100, baseHunger: 100, speed: 3.5, jumpPower: -9.0, hp: 100, maxHp: 100, hunger: 100, maxHunger: 100,
    baseDamage: { hand: 9, torch: 10, hammer: 15, pickaxe: 15, axe: 25, sword: 60 }, level: 1, xp: 0, maxXp: 100, statPoints: 0, stats: { str: 0, agi: 0, vit: 0, sta: 0, int: 0 },
    isGrounded: false, coyoteTime: 0, isJumping: false, animTime: 0, jumpKeyReleased: true, isDead: false, bedPos: null,
    inventory: { wood: 200, stone: 0, meat: 0, cooked_meat: 0, web: 10, arrows: 0, boxes: 0, campfire_item: 0, bed_item: 0, barricade_item: 0 }, 
    
    // SISTEMA CINTURÓN 100% GARANTIZADO
    toolbar: ['hand', null, null, null, null, null],
    activeSlot: 0,
    activeTool: 'hand', 
    availableTools: ['hand'], 
    toolHealth: {}, buildMode: 'block', inBackground: false, wantsBackground: false,
    miningRange: 150, isHit: false, attackFrame: 0, facingRight: true, isAiming: false, isCharging: false, chargeLevel: 0, isStealth: false, nearbyItem: null, placementMode: null, chatText: '', chatExpires: 0
};

window.canAddItem = function(type, amountToAdd) {
    let simulatedInv = { ...window.player.inventory }; simulatedInv[type] = (simulatedInv[type] || 0) + amountToAdd;
    let slotsUsed = 0;
    for (const [t, amt] of Object.entries(simulatedInv)) { if (amt <= 0) continue; let max = window.itemDefs[t].maxStack || 100; slotsUsed += Math.ceil(amt / max); } 
    return slotsUsed <= 10; 
};

window.stars = Array.from({length: 150}, () => ({x: Math.random() * 1280, y: Math.random() * 450, s: Math.random() * 2 + 1}));
window.clouds = Array.from({length: 10}, () => ({x: Math.random() * 1280, y: Math.random() * 250 + 20, s: Math.random() * 0.6 + 0.4, v: Math.random() * 0.15 + 0.05}));
window.checkRectIntersection = function(x1, y1, w1, h1, x2, y2, w2, h2) { return (x2 < x1 + w1 && x2 + w2 > x1 && y2 < y1 + h1 && y2 + h2 > y1); };
window.setHit = function(t) { t.isHit = true; t.lastHitTime = Date.now(); setTimeout(() => { t.isHit = false; }, 150); };
window.getBlocksForCol = function(x) { return window.blocks.filter(b => b.x === x && (b.type === 'block' || (b.type === 'door' && !b.open) || b.type === 'box' || b.type === 'campfire' || b.type === 'bed' || b.type === 'grave')); };
window.spawnParticles = function(x, y, color, count, speed = 1) { for (let i = 0; i < count; i++) window.particles.push({ x, y, vx: (Math.random() - 0.5) * 4 * speed, vy: (Math.random() - 1) * 4 * speed, life: 1.0, decay: 0.02 + Math.random() * 0.03, color, size: Math.random() * 4 + 2 }); };
window.spawnDamageText = function(x, y, text, color = '#ff4444') { window.damageTexts.push({ x, y, text, life: 1.0, color }); };
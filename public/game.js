// === game.js - MOTOR PRINCIPAL Y FÍSICAS ===

window.sendWorldUpdate = function(action, payload) {
    if (window.game.isMultiplayer && window.socket) { window.socket.emit('worldUpdate', { action: action, payload: payload }); }
};

window.spawnDroppedItem = function(x, y, type, amount) {
    if(amount <= 0) return; 
    let newItem = { id: Math.random().toString(36).substring(2,15), x: x + (Math.random() * 10 - 5), y: y + (Math.random() * 10 - 5), vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 1) * 3 - 1, type: type, amount: amount, life: 1.0 };
    window.droppedItems.push(newItem); window.sendWorldUpdate('drop_item', { item: newItem });
};

window.openChat = function() {
    let chatContainer = window.getEl('chat-container'); let chatInput = window.getEl('chat-input');
    if (chatContainer && chatInput && !window.player.isDead) { 
        chatContainer.style.display = 'block'; 
        chatInput.focus(); 
        if(window.keys) {
            window.keys.a = false; window.keys.d = false; window.keys.w = false; 
            window.keys.shift = false; window.keys.y = false; window.keys.jumpPressed = false;
        }
        if(window.player) window.player.isCharging = false;
    }
};

window.isValidPlacement = function(x, y, w, h, requireAdjacency = true, isStructure = false) {
    if (y + h > window.game.groundLevel) return false;
    if (window.checkRectIntersection(x, y, w, h, window.player.x, window.player.y, window.player.width, window.player.height)) return false;
    if (window.game.isMultiplayer && window.otherPlayers) {
        for (let id in window.otherPlayers) { let op = window.otherPlayers[id]; if (window.checkRectIntersection(x, y, w, h, op.x, op.y, op.width||24, op.height||48)) return false; }
    }
    for (let b of window.blocks) { 
        let bh = b.type === 'door' ? window.game.blockSize * 2 : window.game.blockSize; 
        if (window.checkRectIntersection(x, y, w, h, b.x, b.y, window.game.blockSize, bh)) return false; 
        if (isStructure && (b.type === 'door' || h > window.game.blockSize)) {
            if (x === b.x && (y <= b.y + bh && y + h >= b.y)) return false;
        }
    }
    for (let t of window.trees) { let th = t.isStump ? 15 + t.width*0.2 : t.height; let ty = t.isStump ? t.y + t.height - th : t.y; if (window.checkRectIntersection(x, y, w, h, t.x, ty, t.width, th)) return false; }
    for (let r of window.rocks) { if (window.checkRectIntersection(x, y, w, h, r.x, r.y, r.width, r.height)) return false; }
    if (requireAdjacency) { if (!window.isAdjacentToBlockOrGround(x, y, w, h)) return false; }
    return true;
};

window.isOverlappingSolidBlock = function() {
    for (let b of window.blocks) {
        if ((b.type === 'door' && b.open) || b.type === 'box' || b.type === 'campfire' || b.type === 'bed' || b.type === 'grave') continue; 
        let itemHeight = b.type === 'door' ? window.game.blockSize * 2 : window.game.blockSize;
        if (window.checkRectIntersection(window.player.x, window.player.y, window.player.width, window.player.height, b.x, b.y, window.game.blockSize, itemHeight)) return true;
    } return false;
};

window.isAdjacentToBlockOrGround = function(x, y, w, h) {
    if (y + h >= window.game.groundLevel) return true; 
    const expX = x - 2, expY = y - 2, expW = w + 4, expH = h + 4;
    for (let b of window.blocks) { let bh = b.type === 'door' ? window.game.blockSize * 2 : window.game.blockSize; if (window.checkRectIntersection(expX, expY, expW, expH, b.x, b.y, window.game.blockSize, bh)) return true; } return false;
}

window.checkBlockCollisions = function(axis) {
    if (window.player.inBackground) return;
    for (let b of window.blocks) {
        if ((b.type === 'door' && b.open) || b.type === 'box' || b.type === 'campfire' || b.type === 'bed' || b.type === 'grave') continue; 
        let itemHeight = b.type === 'door' ? window.game.blockSize * 2 : window.game.blockSize;
        if (window.checkRectIntersection(window.player.x, window.player.y, window.player.width, window.player.height, b.x, b.y, window.game.blockSize, itemHeight)) {
            if (axis === 'x') { if (window.player.vx > 0) window.player.x = b.x - window.player.width - 0.05; else if (window.player.vx < 0) window.player.x = b.x + window.game.blockSize + 0.05; window.player.vx = 0; } 
            else if (axis === 'y') { if (window.player.vy > 0) { window.player.y = b.y - window.player.height; window.player.isGrounded = true; } else if (window.player.vy < 0) window.player.y = b.y + itemHeight; window.player.vy = 0; }
        }
    }
};

window.checkEntityCollisions = function(ent, axis) {
    let hitWall = false;
    for (let i = window.blocks.length - 1; i >= 0; i--) {
        let b = window.blocks[i];
        if ((b.type === 'door' && b.open) || b.type === 'box' || b.type === 'campfire' || b.type === 'bed' || b.type === 'grave') continue; 
        let itemHeight = b.type === 'door' ? window.game.blockSize * 2 : window.game.blockSize;
        if (window.checkRectIntersection(ent.x, ent.y, ent.width, ent.height, b.x, b.y, window.game.blockSize, itemHeight)) {
            if (axis === 'x') {
                if (ent.vx > 0) { ent.x = b.x - ent.width; ent.vx *= -1; hitWall = true; } else if (ent.vx < 0) { ent.x = b.x + window.game.blockSize; ent.vx *= -1; hitWall = true; }
                if (ent.type === 'zombie' && b.type === 'door') {
                    if (window.game.frameCount % 40 === 0) { 
                        b.hp -= 20; window.setHit(b); window.spawnParticles(b.x + 10, b.y + 10, '#ff4444', 5); window.sendWorldUpdate('hit_block', { x: b.x, y: b.y, dmg: 20 });
                        if (b.hp <= 0) { let ni = { id: Math.random().toString(36).substring(2,9), x: b.x, y: b.y, vx: 0, vy: -2, type: 'wood', amount: 2, life: 1.0 }; window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', { item: ni }); window.blocks.splice(i, 1); window.spawnParticles(b.x, b.y, '#C19A6B', 15); }
                    }
                }
            } else if (axis === 'y') { if (ent.vy > 0) { ent.y = b.y - ent.height; ent.vy = 0; } else if (ent.vy < 0) { ent.y = b.y + itemHeight; ent.vy = 0; } }
        }
    } return hitWall;
};

window.generateWorldSector = function(startX, endX) {
    if (startX < window.game.shoreX + 50) startX = window.game.shoreX + 50; 
    let seed = Math.floor(startX); function sRandom() { let x = Math.sin(seed++) * 10000; return x - Math.floor(x); }
    const numTrees = Math.floor(sRandom() * 6) + 4; 
    
    if (!window.removedTrees) window.removedTrees = [];
    if (!window.treeState) window.treeState = {};
    if (!window.removedRocks) window.removedRocks = [];
    if (!window.killedEntities) window.killedEntities = [];

    for (let i = 0; i < numTrees; i++) { 
        let tx = startX + 50 + sRandom() * (endX - startX - 100); 
        let tHeight = 160 + sRandom() * 120; let tWidth = 28 + sRandom() * 16;
        if (!window.removedTrees.includes(tx)) {
            let tState = window.treeState[tx];
            let isStump = tState ? tState.isStump : false; let rCount = tState ? tState.regrowthCount : 0; let gDay = tState ? tState.grownDay : -1;
            let hp = isStump ? 50 : 100;
            window.trees.push({ id: 't_'+Math.floor(tx), x: tx, y: window.game.groundLevel - tHeight, width: tWidth, height: tHeight, hp: hp, maxHp: hp, isHit: false, type: Math.floor(sRandom() * 3), isStump: isStump, regrowthCount: rCount, grownDay: gDay }); 
        }
    }
    if (startX > 800 && sRandom() < 0.75) { 
        const numRocks = Math.floor(sRandom() * 3) + 2; 
        for (let i=0; i<numRocks; i++) { 
            let rx = startX + sRandom() * (endX - startX); let rW = 30 + sRandom()*20; let rH = 20 + sRandom()*15; 
            if (!window.removedRocks.includes(rx)) window.rocks.push({id: 'r_'+Math.floor(rx), x: rx, y: window.game.groundLevel - rH, width: rW, height: rH, hp: 150, maxHp: 150, isHit: false}); 
        }
    }
    let cx = startX + 100 + sRandom() * (endX - startX - 200); let distToShore = Math.abs(cx - window.game.shoreX); let lvl = Math.floor(distToShore / 1000) + window.game.days; 
    let newId = 'e_' + Math.floor(cx);
    if (!window.entities.some(e => e.id === newId) && !window.killedEntities.includes(newId)) {
        if (distToShore > 2000) {
            if (distToShore > 3000 && sRandom() < 0.4) { let aMaxHp = 30 + (lvl * 20); window.entities.push({ id: newId, type: 'archer', name: 'Cazador', level: lvl, x: cx, y: window.game.groundLevel - 40, width: 20, height: 40, vx: (sRandom() > 0.5 ? 0.8 : -0.8), vy: 0, hp: aMaxHp, maxHp: aMaxHp, damage: 8 + (lvl * 3), isHit: false, attackCooldown: 0, stuckFrames: 0, ignorePlayer: 0, lastX: cx }); } 
            else if (sRandom() < 0.6) { window.entities.push({ id: newId, type: 'chicken', name: 'Pollo', level: lvl, x: cx, y: window.game.groundLevel - 20, width: 20, height: 20, vx: (sRandom() > 0.5 ? 0.3 : -0.3), vy: 0, hp: 25 + (lvl*5), maxHp: 25 + (lvl*5), isHit: false, attackCooldown: 0, stuckFrames: 0, fleeTimer: 0, fleeDir: 1, lastX: cx }); } 
            else { let spiderMaxHp = 20 + (lvl * 15); let sWidth = 14 + (lvl * 2), sHeight = 8 + (lvl * 1.5); window.entities.push({ id: newId, type: 'spider', name: 'Araña', level: lvl, x: cx, y: window.game.groundLevel - sHeight, width: sWidth, height: sHeight, vx: (sRandom() > 0.5 ? 0.6 : -0.6), vy: 0, hp: spiderMaxHp, maxHp: spiderMaxHp, damage: 8 + (lvl * 3), isHit: false, attackCooldown: 0, stuckFrames: 0, ignorePlayer: 0, lastX: cx }); }
        } else { window.entities.push({ id: newId, type: 'chicken', name: 'Pollo', level: 1, x: cx, y: window.game.groundLevel - 20, width: 20, height: 20, vx: (sRandom() > 0.5 ? 0.3 : -0.3), vy: 0, hp: 25, maxHp: 25, isHit: false, attackCooldown: 0, stuckFrames: 0, fleeTimer: 0, fleeDir: 1, lastX: cx }); }
    }
};

window.startGame = function(multiplayer, ip = null) {
    const nameInput = window.getEl('player-name'); 
    let rawName = (nameInput && nameInput.value) ? nameInput.value.trim() : "Jugador " + Math.floor(Math.random()*1000);
    window.player.name = rawName.substring(0, 15);

    let menu = window.getEl('main-menu'); if(menu) menu.style.display = 'none'; let ui = window.getEl('ui-layer'); if(ui) ui.style.display = 'block';
    window.game.isRunning = true; window.game.isMultiplayer = multiplayer;
    
    window.generateWorldSector(window.game.shoreX, window.game.exploredRight);

    if (multiplayer && typeof io !== 'undefined') {
        try {
            const connectionURL = ip ? `http://${ip}:3000` : window.location.origin; window.socket = io(connectionURL);
            let sInfo = window.getEl('server-info'); if(sInfo) { sInfo.style.display = 'flex'; window.getEl('sv-ip').innerText = ip ? ip : 'Servidor Web'; }
            if (ip && ip !== window.location.hostname && ip !== 'localhost' && ip !== '127.0.0.1') { let list = JSON.parse(localStorage.getItem('savedServers') || '[]'); if (!list.includes(ip)) { list.push(ip); localStorage.setItem('savedServers', JSON.stringify(list)); if(window.refreshServerList) window.refreshServerList(); } }
            
            window.socket.on('connect', () => { window.socket.emit('joinGame', { name: window.player.name, x: window.player.x, y: window.player.y, level: window.player.level }); });
            window.socket.on('disconnect', () => { alert("⚠ Se perdió la conexión con el Servidor. La partida se reiniciará."); window.location.reload(); });
            window.socket.on('currentPlayers', (srvPlayers) => { window.otherPlayers = srvPlayers; let pCount = window.getEl('sv-players'); if(pCount) pCount.innerText = Object.keys(srvPlayers).length; });
            window.socket.on('playerMoved', (pInfo) => { if(window.otherPlayers[pInfo.id]) { let cText = window.otherPlayers[pInfo.id].chatText || ''; let cExpires = window.otherPlayers[pInfo.id].chatExpires || 0; Object.assign(window.otherPlayers[pInfo.id], pInfo); window.otherPlayers[pInfo.id].chatText = cText; window.otherPlayers[pInfo.id].chatExpires = cExpires; } });
            window.socket.on('timeSync', (serverUptimeMs) => { window.game.serverStartTime = Date.now() - serverUptimeMs; });
            
            window.socket.on('initWorldState', (state) => {
                window.blocks = state.blocks; window.removedTrees = state.removedTrees; window.removedRocks = state.removedRocks; window.treeState = state.treeState || {}; window.killedEntities = state.killedEntities || [];
                window.trees = window.trees.filter(t => !window.removedTrees.includes(t.x)); 
                window.trees.forEach(t => { if (window.treeState[t.x]) { t.isStump = window.treeState[t.x].isStump; t.regrowthCount = window.treeState[t.x].regrowthCount; t.grownDay = window.treeState[t.x].grownDay; if (t.isStump) { t.hp = 50; t.maxHp = 50; } } });
                window.rocks = window.rocks.filter(r => !window.removedRocks.includes(r.x));
                window.entities = window.entities.filter(e => !window.killedEntities.includes(e.id));
                if(window.updateUI) window.updateUI();
            });

            window.socket.on('chatMessage', (data) => { 
                if (data.id === window.socket.id) return;
                if (window.otherPlayers[data.id]) { 
                    window.otherPlayers[data.id].chatText = data.text; 
                    window.otherPlayers[data.id].chatExpires = Date.now() + 6500; 
                    if(window.addGlobalMessage) window.addGlobalMessage(`💬 [${window.otherPlayers[data.id].name}]: ${data.text}`, '#a29bfe');
                } 
            });
            
            window.socket.on('worldUpdate', (data) => {
                if (data.action === 'player_death') { if(window.addGlobalMessage) window.addGlobalMessage(`☠️ ${data.payload.name} murió por ${data.payload.source}`, '#e74c3c'); }
                else if (data.action === 'hit_tree') { let t = window.trees.find(tr => Math.abs(tr.x - data.payload.x) < 1); if (t) { t.hp -= data.payload.dmg; window.setHit(t); } }
                else if (data.action === 'stump_tree') { let t = window.trees.find(tr => Math.abs(tr.x - data.payload.x) < 1); if (t) { t.isStump = true; t.hp = 50; t.maxHp = 50; t.regrowthCount = data.payload.regrowthCount; t.grownDay = data.payload.grownDay; window.treeState[t.x] = { isStump: true, regrowthCount: t.regrowthCount, grownDay: t.grownDay }; } }
                else if (data.action === 'grow_tree') { let t = window.trees.find(tr => Math.abs(tr.x - data.payload.x) < 1); if (t) { t.isStump = false; t.hp = 100; t.maxHp = 100; t.regrowthCount = data.payload.regrowthCount; t.grownDay = data.payload.grownDay; window.treeState[t.x] = { isStump: false, regrowthCount: t.regrowthCount, grownDay: t.grownDay }; } }
                else if (data.action === 'destroy_tree') { window.removedTrees.push(data.payload.x); delete window.treeState[data.payload.x]; window.trees = window.trees.filter(t => t.x !== data.payload.x); }
                else if (data.action === 'hit_rock') { let r = window.rocks.find(ro => Math.abs(ro.x - data.payload.x) < 1); if (r) { r.hp -= data.payload.dmg; window.setHit(r); } }
                else if (data.action === 'destroy_rock') { window.removedRocks.push(data.payload.x); window.rocks = window.rocks.filter(r => r.x !== data.payload.x); }
                else if (data.action === 'hit_block') { let b = window.blocks.find(bl => bl.x === data.payload.x && bl.y === data.payload.y); if (b) { b.hp -= data.payload.dmg; window.setHit(b); if(data.payload.destroyed || b.hp <= 0) { if (window.currentOpenBox && window.currentOpenBox.x === b.x) { window.currentOpenBox = null; let dBox = window.getEl('menu-box'); if (dBox) dBox.classList.remove('open'); } window.blocks = window.blocks.filter(bl => bl !== b); } } }
                else if (data.action === 'destroy_grave') { if (window.currentOpenBox && window.currentOpenBox.id === data.payload.id) { window.currentOpenBox = null; let dBox = window.getEl('menu-box'); if (dBox) dBox.classList.remove('open'); } window.blocks = window.blocks.filter(b => b.id !== data.payload.id); }
                else if (data.action === 'place_block') { let exists = window.blocks.find(bl => bl.x === data.payload.block.x && bl.y === data.payload.block.y); if (!exists) window.blocks.push(data.payload.block); }
                else if (data.action === 'remove_old_bed') { window.blocks = window.blocks.filter(b => b.type !== 'bed' || b.owner !== data.payload.owner); }
                else if (data.action === 'interact_door') { let d = window.blocks.find(bl => bl.x === data.payload.x && bl.y === data.payload.y); if (d) d.open = !d.open; }
                else if (data.action === 'drop_item') { let exists = window.droppedItems.find(i => i.id === data.payload.item.id); if(!exists) window.droppedItems.push(data.payload.item); }
                else if (data.action === 'pickup_item') { let index = window.droppedItems.findIndex(i => i.id === data.payload.id); if (index !== -1) window.droppedItems.splice(index, 1); }
                else if (data.action === 'spawn_projectile') { window.projectiles.push(data.payload); }
                else if (data.action === 'spawn_entity') { if (!window.entities.some(e => e.id === data.payload.entity.id) && !window.killedEntities.includes(data.payload.entity.id)) { window.entities.push(data.payload.entity); } }
                else if (data.action === 'kill_entity') { window.killedEntities.push(data.payload.id); window.entities = window.entities.filter(en => en.id !== data.payload.id); }
                else if (data.action === 'hit_entity') { let e = window.entities.find(en => en.id === data.payload.id); if (e) { e.hp -= data.payload.dmg; window.setHit(e); } }
                else if (data.action === 'flee_entity') { let e = window.entities.find(en => en.id === data.payload.id); if (e) { e.fleeTimer = 180; e.fleeDir = data.payload.dir; } }
                else if (data.action === 'update_box') { let b = window.blocks.find(bl => bl.x === data.payload.x && bl.y === data.payload.y && (bl.type === 'box' || bl.type === 'grave')); if (b) { b.inventory = data.payload.inventory; if (window.currentOpenBox && window.currentOpenBox.x === b.x) if(window.renderBoxUI) window.renderBoxUI(); } }
                else if (data.action === 'update_campfire') { let b = window.blocks.find(bl => bl.x === data.payload.x && bl.y === data.payload.y && bl.type === 'campfire'); if (b) { b.wood = data.payload.wood; b.meat = data.payload.meat; b.cooked = data.payload.cooked; b.isBurning = data.payload.isBurning; if (window.currentCampfire && window.currentCampfire.x === b.x) if(window.renderCampfireUI) window.renderCampfireUI(); } }
            });
        } catch(e) { console.error("Error Socket:", e); alert("No se pudo conectar al servidor. Verifica la IP."); }
    }
    
    window.recalculateStats(); 
    if(window.updateUI) window.updateUI(); 
    if(window.renderToolbar) window.renderToolbar(); 
};

window.addEventListener('contextmenu', (e) => { e.preventDefault(); });
window.addEventListener('blur', () => { if(window.keys) { window.keys.a = false; window.keys.d = false; window.keys.w = false; window.keys.shift = false; window.keys.y = false; window.keys.jumpPressed = false; } if(window.player) window.player.isCharging = false; });

window.addEventListener('keyup', (e) => {
    if (!window.game || !window.game.isRunning) return;
    let chatInput = window.getEl('chat-input');
    if (chatInput && document.activeElement === chatInput) return;

    if (e.key === 'a' || e.key === 'A') window.keys.a = false;
    if (e.key === 'd' || e.key === 'D') window.keys.d = false;
    if (e.key === 'Shift') window.keys.shift = false;
    if (e.key === 'y' || e.key === 'Y') window.keys.y = false;
    if (e.key === 'w' || e.key === 'W' || e.key === ' ') {
        window.keys.jumpPressed = false;
        window.player.jumpKeyReleased = true;
    }
});

window.addEventListener('keydown', (e) => {
    if (!window.game || !window.game.isRunning) return;
    let chatContainer = window.getEl('chat-container'); let chatInput = window.getEl('chat-input');
    
    if (chatContainer && chatInput && !window.player.isDead) {
        if (e.key === 'Enter') {
            if (document.activeElement === chatInput) {
                let msg = chatInput.value.trim();
                if (msg.length > 0) {
                    window.player.chatText = msg; window.player.chatExpires = Date.now() + 6500;
                    if(window.addGlobalMessage) window.addGlobalMessage(`💬 [Tú]: ${msg}`, '#3498db');
                    if (window.socket) window.socket.emit('chatMessage', msg);
                }
                chatInput.value = ''; chatInput.blur(); chatContainer.style.display = 'none';
            } else {
                e.preventDefault(); window.openChat();
            }
            return;
        }
        if (document.activeElement === chatInput) return; 
    }

    if (window.player.isDead || window.player.placementMode) return; 
    if (e.key === 'a' || e.key === 'A') window.keys.a = true; if (e.key === 'd' || e.key === 'D') window.keys.d = true; if (e.key === 'Shift') window.keys.shift = true; 
    if (e.key === 'w' || e.key === 'W' || e.key === ' ') window.keys.jumpPressed = true; if (e.key === 'y' || e.key === 'Y') window.keys.y = true; 
    if (e.key === 'i' || e.key === 'I') { if(window.toggleMenu) window.toggleMenu('inventory'); } if (e.key === 'c' || e.key === 'C') { if(window.toggleMenu) window.toggleMenu('crafting'); } if (e.key === 'f' || e.key === 'F') { if(window.eatFood) window.eatFood(15, 30); }
    if (e.key === 'r' || e.key === 'R') { if(window.player.activeTool === 'hammer') { window.player.buildMode = window.player.buildMode === 'block' ? 'door' : 'block'; window.spawnDamageText(window.player.x+window.player.width/2, window.player.y-20, `Modo: ${window.player.buildMode}`, '#fff'); } }

    if (e.key === 'e' || e.key === 'E') {
        const pCX = window.player.x + window.player.width / 2, pCY = window.player.y + window.player.height / 2; let actionDone = false;
        let interactables = window.blocks.filter(b => (b.type === 'box' || b.type === 'campfire' || b.type === 'door' || b.type === 'grave') && window.checkRectIntersection(window.player.x - 15, window.player.y - 15, window.player.width + 30, window.player.height + 30, b.x, b.y, window.game.blockSize, b.type==='door'?window.game.blockSize*2:window.game.blockSize));
        if (interactables.length > 0) {
            let b = interactables[0];
            if (b.type === 'door') { b.open = !b.open; window.spawnParticles(b.x + window.game.blockSize / 2, b.y + window.game.blockSize, '#5C4033', 5); window.sendWorldUpdate('interact_door', { x: b.x, y: b.y });
            } else if (b.type === 'box' || b.type === 'grave') { window.currentOpenBox = b; if(window.toggleMenu) window.toggleMenu('box');
            } else if (b.type === 'campfire') { window.currentCampfire = b; if(window.toggleMenu) window.toggleMenu('campfire'); }
        }
    }
    const num = parseInt(e.key); 
    if (!isNaN(num) && num >= 1 && num <= 6) { 
        if(window.selectToolbarSlot) window.selectToolbarSlot(num - 1); 
        if(window.renderToolbar) window.renderToolbar(); 
    }
});

window.addEventListener('mousemove', (e) => {
    if(!window.canvas || !window.player || window.player.isDead) return;
    const rect = window.canvas.getBoundingClientRect(); const scaleX = window._canvasLogicW / rect.width; const scaleY = window._canvasLogicH / rect.height;
    window.screenMouseX = (e.clientX - rect.left) * scaleX; window.screenMouseY = (e.clientY - rect.top) * scaleY; window.mouseWorldX = window.screenMouseX + window.camera.x; window.mouseWorldY = window.screenMouseY + window.camera.y;
    if (window.player.isAiming || window.player.attackFrame > 0) window.player.facingRight = window.mouseWorldX >= window.player.x + window.player.width / 2;
});

window.addEventListener('wheel', (e) => {
    if (!window.game || !window.game.isRunning || window.player.isDead || document.querySelector('.window-menu.open')) return;
    if (e.deltaY > 0) window.selectToolbarSlot((window.player.activeSlot + 1) % 6);
    else window.selectToolbarSlot((window.player.activeSlot - 1 + 6) % 6);
    if(window.renderToolbar) window.renderToolbar();
}, {passive: false}); 

document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
    e.preventDefault(); if (!window.player || e.target.closest('.window-menu') || window.player.isDead) return; 
    const type = e.dataTransfer.getData('text/plain');
    if (type && window.player.inventory[type] > 0) { 
        let amt = window.player.inventory[type]; let ni = { id: Math.random().toString(36).substring(2,9), x: window.player.x + window.player.width/2 + (Math.random() * 10 - 5), y: window.player.y - 20 + (Math.random() * 10 - 5), vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 1) * 3 - 1, type: type, amount: amt, life: 1.0 };
        window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', { item: ni }); window.player.inventory[type] = 0; if(window.updateUI) window.updateUI(); 
    }
});

window.addEventListener('mousedown', (e) => {
    if (!window.game || !window.game.isRunning || window.player.isDead || document.querySelector('.window-menu.open')) return;
    
    if (window.player.placementMode) {
        if (e.button === 2) { window.player.placementMode = null; return; } 
        if (e.button === 0) {
            const gridX = Math.floor(window.mouseWorldX / window.game.blockSize) * window.game.blockSize; const gridY = Math.floor(window.mouseWorldY / window.game.blockSize) * window.game.blockSize;
            if (Math.hypot((window.player.x + window.player.width/2) - (gridX + window.game.blockSize/2), (window.player.y + window.player.height/2) - (gridY + window.game.blockSize/2)) <= window.player.miningRange) {
                let type = window.player.placementMode === 'boxes' ? 'box' : (window.player.placementMode === 'bed_item' ? 'bed' : 'campfire');
                if (window.isValidPlacement(gridX, gridY, window.game.blockSize, window.game.blockSize, true, false)) {
                    let newB = { x: gridX, y: gridY, type: type, hp: 200, maxHp: 200, isHit: false };
                    if (type === 'box') newB.inventory = {wood:0, stone:0, meat:0, web:0, arrows:0, cooked_meat:0};
                    if (type === 'campfire') { newB.wood = 0; newB.meat = 0; newB.cooked = 0; newB.isBurning = false; newB.burnTime = 0; newB.cookTimer = 0; }
                    if (type === 'bed') {
                        window.blocks = window.blocks.filter(b => b.type !== 'bed' || b.owner !== window.player.name);
                        newB.owner = window.player.name; window.player.bedPos = { x: gridX, y: gridY };
                        window.spawnDamageText(gridX + 15, gridY - 10, "Punto Respawn", '#4CAF50');
                        window.sendWorldUpdate('remove_old_bed', { owner: window.player.name }); 
                    }
                    window.blocks.push(newB); window.sendWorldUpdate('place_block', { block: newB }); 
                    window.player.inventory[window.player.placementMode]--; window.spawnParticles(gridX+15, gridY+15, '#fff', 10);
                    
                    if (window.player.inventory[window.player.placementMode] <= 0) {
                        window.player.toolbar[window.player.activeSlot] = null;
                        window.selectToolbarSlot(0); 
                    }
                    if(window.updateUI) window.updateUI();
                    if(window.renderToolbar) window.renderToolbar();
                }
            }
        } return;
    }

    if (window.player.activeTool === 'bow') { if (e.button === 2) window.player.isAiming = true; if (e.button === 0 && window.player.isAiming && window.player.inventory.arrows > 0) window.player.isCharging = true; return; }
    if (e.button !== 0) return; 

    window.player.attackFrame = 12; 
    const pCX = window.player.x + window.player.width / 2, pCY = window.player.y + window.player.height / 2; 
    const baseDmg = window.getMeleeDamage(); const tool = window.player.activeTool; let actionDone = false;

    let entityDmg = tool === 'hammer' ? 0 : Math.max(1, Math.floor(tool === 'pickaxe' ? baseDmg * 0.3 : (tool === 'axe' ? baseDmg * 0.6 : baseDmg)));
    let treeDmg = tool === 'axe' ? Math.floor(baseDmg * 1.5) : (tool === 'sword' ? Math.floor(baseDmg * 0.25) : (tool === 'hand' ? baseDmg : 0));
    let rockDmg = tool === 'pickaxe' ? Math.floor(baseDmg * 3) : (tool === 'hammer' ? 0 : 1);
    let blockDmg = tool === 'hammer' ? Math.floor(baseDmg * 3) : (tool === 'sword' ? Math.max(1, Math.floor(baseDmg * 0.2)) : baseDmg);

    if (entityDmg > 0) {
        for (let i = window.entities.length - 1; i >= 0; i--) {
            let ent = window.entities[i];
            if (window.mouseWorldX >= ent.x - 10 && window.mouseWorldX <= ent.x + ent.width + 10 && window.mouseWorldY >= ent.y - 10 && window.mouseWorldY <= ent.y + ent.height + 10) {
                if (Math.hypot(pCX - (ent.x + ent.width/2), pCY - (ent.y + ent.height/2)) <= window.player.miningRange) {
                    ent.hp -= entityDmg; window.setHit(ent); window.spawnParticles(ent.x + ent.width/2, ent.y + ent.height/2, '#ff4444', 5); window.spawnDamageText(ent.x + ent.width/2, ent.y - 5, `-${entityDmg}`, '#ff4444'); 
                    
                    if (ent.hp <= 0) { 
                        window.killedEntities.push(ent.id); window.sendWorldUpdate('kill_entity', { id: ent.id });
                        window.spawnParticles(ent.x, ent.y, '#ff4444', 15); 
                        if (ent.type === 'spider') { let ni = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:0, vy:-1, type:'web', amount:1+Math.floor(ent.level/2), life:1.0}; window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni}); window.gainXP(20 * ent.level); }
                        else if (ent.type === 'chicken') { let ni = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:0, vy:-1, type:'meat', amount:1, life:1.0}; window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni}); window.gainXP(10); }
                        else if (ent.type === 'zombie') { let ni = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:0, vy:-1, type:'meat', amount:2, life:1.0}; window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni}); window.gainXP(50 * ent.level); }
                        else if (ent.type === 'archer') { 
                            let ni1 = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:-1, vy:-1, type:'arrows', amount:2+Math.floor(Math.random()*4), life:1.0}; window.droppedItems.push(ni1); window.sendWorldUpdate('drop_item', {item:ni1}); 
                            let ni2 = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:1, vy:-1, type:'wood', amount:3, life:1.0}; window.droppedItems.push(ni2); window.sendWorldUpdate('drop_item', {item:ni2}); window.gainXP(40 * ent.level); 
                        }
                        window.entities.splice(i, 1); if(window.updateUI) window.updateUI(); 
                    } else {
                        window.sendWorldUpdate('hit_entity', { id: ent.id, dmg: entityDmg });
                        if (ent.type === 'chicken') { ent.fleeTimer = 180; ent.fleeDir = (ent.x > pCX) ? 1 : -1; window.sendWorldUpdate('flee_entity', { id: ent.id, dir: ent.fleeDir }); }
                    }
                    actionDone = true; break; 
                }
            }
        }
    }

    if (!actionDone && blockDmg > 0) {
        let clickedBlockIndex = -1;
        for (let i = window.blocks.length - 1; i >= 0; i--) {
            let b = window.blocks[i], h = b.type === 'door' ? window.game.blockSize * 2 : window.game.blockSize;
            if (window.mouseWorldX >= b.x && window.mouseWorldX <= b.x + window.game.blockSize && window.mouseWorldY >= b.y && window.mouseWorldY <= b.y + h) { clickedBlockIndex = i; break; }
        }
        if (clickedBlockIndex !== -1) {
            let b = window.blocks[clickedBlockIndex], h = b.type === 'door' ? window.game.blockSize * 2 : window.game.blockSize;
            if (Math.hypot(pCX - (b.x + window.game.blockSize/2), pCY - (b.y + h/2)) <= window.player.miningRange) {
                b.hp -= blockDmg; window.setHit(b); window.spawnParticles(window.mouseWorldX, window.mouseWorldY, '#ff4444', 5);
                if (b.hp <= 0) { 
                    window.sendWorldUpdate('hit_block', { x: b.x, y: b.y, dmg: blockDmg, destroyed: true });
                    if (window.currentOpenBox && window.currentOpenBox.x === b.x) { window.currentOpenBox = null; let dBox = window.getEl('menu-box'); if(dBox) dBox.classList.remove('open'); }
                    let refundType = b.type === 'box' ? 'boxes' : (b.type === 'campfire' ? 'campfire_item' : (b.type === 'bed' ? 'bed_item' : 'wood')); let refundAmt = b.type === 'door' ? 2 : 1;
                    if (b.type !== 'grave') { let ni = { id: Math.random().toString(36).substring(2,9), x:b.x+15, y:b.y+15, vx:0, vy:-2, type:refundType, amount:refundAmt, life:1.0}; window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni}); }
                    if((b.type === 'box' || b.type === 'grave') && b.inventory) { for(const [t, amt] of Object.entries(b.inventory)) { if (amt > 0) { let ni2 = { id: Math.random().toString(36).substring(2,9), x:b.x+15, y:b.y+15, vx:(Math.random()-0.5)*2, vy:-2, type:t, amount:amt, life:1.0}; window.droppedItems.push(ni2); window.sendWorldUpdate('drop_item', {item:ni2}); } } }
                    if(b.type === 'campfire') { let c1={ id: Math.random().toString(36).substring(2,9), x:b.x+15,y:b.y+15,vx:-1,vy:-2,type:'wood',amount:b.wood,life:1.0}; let c2={ id: Math.random().toString(36).substring(2,9), x:b.x+15,y:b.y+15,vx:0,vy:-2,type:'meat',amount:b.meat,life:1.0}; let c3={ id: Math.random().toString(36).substring(2,9), x:b.x+15,y:b.y+15,vx:1,vy:-2,type:'cooked_meat',amount:b.cooked,life:1.0}; window.droppedItems.push(c1,c2,c3); window.sendWorldUpdate('drop_item', {item:c1}); window.sendWorldUpdate('drop_item', {item:c2}); window.sendWorldUpdate('drop_item', {item:c3}); }
                    if(b.type === 'bed' && window.player.bedPos && window.player.bedPos.x === b.x) window.player.bedPos = null;
                    if(b.type === 'grave') window.sendWorldUpdate('destroy_grave', { id: b.id });
                    window.blocks.splice(clickedBlockIndex, 1); window.spawnParticles(b.x + 15, b.y + 15, '#C19A6B', 15, 1.2); window.gainXP(2); 
                } else { window.sendWorldUpdate('hit_block', { x: b.x, y: b.y, dmg: blockDmg }); }
                actionDone = true;
            }
        }
    }

    if (!actionDone && rockDmg > 0) {
        for (let i = window.rocks.length - 1; i >= 0; i--) {
            const r = window.rocks[i];
            if (window.mouseWorldX >= r.x && window.mouseWorldX <= r.x + r.width && window.mouseWorldY >= r.y && window.mouseWorldY <= r.y + r.height) { 
                if (Math.hypot(pCX - (r.x + r.width/2), pCY - (r.y + r.height/2)) <= window.player.miningRange) {
                    r.hp -= rockDmg; window.setHit(r); window.spawnParticles(window.mouseWorldX, window.mouseWorldY, '#fff', 8); window.spawnDamageText(window.mouseWorldX, window.mouseWorldY - 10, `-${rockDmg}`, '#fff');
                    if (r.hp <= 0) { 
                        window.sendWorldUpdate('destroy_rock', { x: r.x });
                        window.spawnParticles(r.x + 15, r.y + 15, '#888', 20, 1.5); 
                        let ni = { id: Math.random().toString(36).substring(2,9), x:r.x+15, y:r.y+15, vx:(Math.random()-0.5)*3, vy:-2, type:'stone', amount:6 + Math.floor(Math.random()*5), life:1.0};
                        window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni});
                        window.rocks.splice(i, 1); window.gainXP(25); 
                    } else { window.sendWorldUpdate('hit_rock', { x: r.x, dmg: rockDmg }); }
                    actionDone = true; break;
                }
            }
        }
    }

    if (!actionDone && treeDmg > 0) {
        for (let i = window.trees.length - 1; i >= 0; i--) {
            const t = window.trees[i];
            if (t.isStump) continue; 
            
            if (window.mouseWorldX >= t.x - 20 && window.mouseWorldX <= t.x + t.width + 20 && window.mouseWorldY >= t.y - 100 && window.mouseWorldY <= t.y + t.height) { 
                if (Math.hypot(pCX - (t.x + t.width/2), pCY - (t.y + t.height/2)) <= window.player.miningRange) {
                    t.hp -= treeDmg; window.setHit(t); window.spawnParticles(window.mouseWorldX, window.mouseWorldY, '#ff4444', 8); window.spawnDamageText(window.mouseWorldX, window.mouseWorldY - 10, `-${treeDmg}`, '#ff4444');
                    if (t.hp <= 0) {
                        if (t.regrowthCount >= 3) {
                            window.spawnParticles(t.x + 15, t.y + t.height, '#C19A6B', 15, 1.2);
                            let ni = { id: Math.random().toString(36).substring(2,9), x:t.x+15, y:t.y+t.height-10, vx:(Math.random()-0.5)*3, vy:-2, type:'wood', amount:3, life:1.0};
                            window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni});
                            window.sendWorldUpdate('destroy_tree', { x: t.x }); window.trees.splice(i, 1); window.gainXP(5); 
                        } else {
                            window.spawnParticles(t.x + 15, t.y + t.height - 20, '#2E8B57', 20, 1.5); 
                            let ni = { id: Math.random().toString(36).substring(2,9), x:t.x+15, y:t.y+t.height-30, vx:(Math.random()-0.5)*3, vy:-2, type:'wood', amount:5, life:1.0};
                            window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni});
                            t.isStump = true; t.hp = 50; t.maxHp = 50; window.sendWorldUpdate('stump_tree', { x: t.x, regrowthCount: t.regrowthCount, grownDay: t.grownDay }); window.gainXP(15);
                        }
                    } else { window.sendWorldUpdate('hit_tree', { x: t.x, dmg: treeDmg }); }
                    actionDone = true; break;
                }
            }
        }
    }

    if (!actionDone && window.player.activeTool === 'hammer') {
        const gridX = Math.floor(window.mouseWorldX / window.game.blockSize) * window.game.blockSize; const gridY = Math.floor(window.mouseWorldY / window.game.blockSize) * window.game.blockSize;
        const isDoorMode = window.player.buildMode === 'door'; const itemHeight = isDoorMode ? window.game.blockSize * 2 : window.game.blockSize; const cost = isDoorMode ? 4 : 2; 
        if (Math.hypot(pCX - (gridX + window.game.blockSize/2), pCY - (gridY + itemHeight/2)) <= window.player.miningRange) {
            if (window.player.inventory.wood >= cost && window.isValidPlacement(gridX, gridY, window.game.blockSize, itemHeight, true, true)) {
                let newB = { x: gridX, y: gridY, type: isDoorMode ? 'door' : 'block', open: false, hp: 300, maxHp: 300, isHit: false };
                window.blocks.push(newB); window.sendWorldUpdate('place_block', { block: newB }); window.player.inventory.wood -= cost; window.spawnParticles(gridX + 15, gridY + 15, '#D2B48C', 5, 0.5); if(window.updateUI) window.updateUI();
            }
        }
    }
    if(actionDone && window.useTool) window.useTool();
});

window.addEventListener('mouseup', (e) => {
    if (!window.game || !window.game.isRunning || window.player.isDead) return;
    if (window.player.activeTool === 'bow') {
        if (e.button === 2) { window.player.isAiming = false; window.player.isCharging = false; window.player.chargeLevel = 0; }
        if (e.button === 0 && window.player.isCharging) {
            if (window.player.chargeLevel > 5 && window.player.inventory.arrows > 0) {
                window.player.inventory.arrows--;
                let pCX = window.player.x + window.player.width/2; 
                let pCY = window.player.y + 20; 
                let dx = window.mouseWorldX - pCX, dy = window.mouseWorldY - pCY; let angle = Math.atan2(dy, dx);
                let power = 4 + (window.player.chargeLevel / 100) * 6; 
                let newArrow = { x: pCX, y: pCY, vx: Math.cos(angle)*power, vy: Math.sin(angle)*power, life: 250, damage: window.getBowDamage(), isEnemy: false };
                window.projectiles.push(newArrow); window.sendWorldUpdate('spawn_projectile', newArrow); if(window.useTool) window.useTool();
            }
            window.player.isCharging = false; window.player.chargeLevel = 0; if(window.updateUI) window.updateUI();
        }
    }
});

function update() {
    try {
        if (!window.game || !window.game.isRunning) return;
        if (!window.canvas) return;

        window.game.frameCount++;
        if (window.game.screenShake > 0) window.game.screenShake--;
        if (window.player.attackFrame > 0) window.player.attackFrame--;
        
        if (window.game.frameCount % 60 === 0 && !window.player.isDead) {
            if (window.player.activeTool === 'torch' && window.player.toolHealth['torch']) {
                window.player.toolHealth['torch']--;
                if (window.renderToolbar) window.renderToolbar(); 
                if (window.player.toolHealth['torch'] <= 0) {
                    window.player.toolbar[window.player.activeSlot] = null;
                    window.selectToolbarSlot(0); 
                    window.spawnDamageText(window.player.x + window.player.width/2, window.player.y - 20, "¡Antorcha Apagada!", '#ff4444');
                    if (window.renderToolbar) window.renderToolbar();
                }
            }
        }

        if (window.player.isCharging) { window.player.chargeLevel += 1.0 * (1 + window.player.stats.agi * 0.2); if (window.player.chargeLevel > 100) window.player.chargeLevel = 100; }
        
        let currentUptime = window.game.serverStartTime ? (Date.now() - window.game.serverStartTime) : (window.game.frameCount * (1000/60));
        let totalFrames = Math.floor(currentUptime / (1000 / 60)) + 28800; 
        let dayFloat = totalFrames / 86400; window.game.days = Math.floor(dayFloat) + 1; 
        let hourFloat = (totalFrames / 3600) % 24; let clockH = Math.floor(hourFloat); let clockM = Math.floor((totalFrames % 3600) / 60);
        let isNight = hourFloat >= 23 || hourFloat < 5; let isDay = hourFloat >= 6 && hourFloat < 18;

        let dailySeed = Math.sin(window.game.days * 8765.4); let nSeed = (dailySeed + 1) / 2;
        window.game.isRaining = false;
        if (nSeed > 0.65) { 
            let rainStart = 9 + (nSeed * 4); let rainDuration = 1 + (nSeed * 1.5); 
            window.game.isRaining = isDay && (hourFloat >= rainStart && hourFloat <= (rainStart + rainDuration));
        }

        // SEGURIDAD: Evita que un error matemático congele al personaje
        if (isNaN(window.player.vx) || !isFinite(window.player.vx)) window.player.vx = 0;
        if (isNaN(window.player.vy) || !isFinite(window.player.vy)) window.player.vy = 0;

        if (!window.player.isAiming && window.player.attackFrame <= 0 && !window.player.isDead) {
            if (window.player.vx > 0.1) window.player.facingRight = true;
            else if (window.player.vx < -0.1) window.player.facingRight = false;
        }

        if (window.player.isDead) {
            window.player.vx = 0; window.player.isStealth = false;
            let pO = window.getEl('placement-overlay'); if(pO) pO.style.display = 'none';
        } else if (window.keys && window.keys.shift) { window.player.wantsBackground = true; 
        } else { window.player.wantsBackground = false; }
        
        if (!window.player.isDead && !window.player.wantsBackground) { if (!window.isOverlappingSolidBlock()) window.player.inBackground = false; } 
        else if (!window.player.isDead) { window.player.inBackground = true; }

        if (window.player.placementMode && !window.player.isDead) {
            window.player.vx = 0; let pO = window.getEl('placement-overlay'); if(pO) pO.style.display = 'block';
        } else if (!window.player.isDead) {
            let pO = window.getEl('placement-overlay'); if(pO) pO.style.display = 'none';
            const accel = window.player.isGrounded ? 0.6 : 0.4; const fric = window.player.isGrounded ? 0.8 : 0.95; 
            if (window.keys && window.keys.a) window.player.vx -= accel; 
            if (window.keys && window.keys.d) window.player.vx += accel;
            window.player.vx *= fric;
            if (window.player.vx > window.player.speed) window.player.vx = window.player.speed; 
            if (window.player.vx < -window.player.speed) window.player.vx = -window.player.speed;
        }

        let isMoving = Math.abs(window.player.vx) > 0.2 || !window.player.isGrounded;
        window.player.isStealth = window.player.inBackground && !isMoving && window.player.attackFrame <= 0 && !window.player.isDead;
        
        let timeText = `${clockH.toString().padStart(2, '0')}:${clockM.toString().padStart(2, '0')}`;
        let cDisp = window.getEl('clock-display');
        if (cDisp) {
            if (window.player.isStealth) { cDisp.innerText = `[OCULTO] Día ${window.game.days} - ${timeText}`; cDisp.classList.add('stealth-mode'); } 
            else { cDisp.innerText = `Día ${window.game.days} - ${timeText}`; cDisp.classList.remove('stealth-mode'); }
        }

        let distMeters = Math.max(0, Math.floor((window.player.x - window.game.shoreX) / 10));
        let dTxt = window.getEl('dist-text'); if(dTxt) dTxt.innerText = `${distMeters}m`;

        if (Math.abs(window.player.vx) > 0.5 && window.player.isGrounded) window.player.animTime += Math.abs(window.player.vx) * 0.04; else window.player.animTime = 0; 

        window.player.x += window.player.vx; 
        if (window.player.x < window.game.shoreX) { window.player.x = window.game.shoreX; if (window.player.vx < 0) window.player.vx = 0; }
        window.checkBlockCollisions('x');
        
        window.player.vy += window.game.gravity; window.player.isGrounded = false; window.player.y += window.player.vy; window.checkBlockCollisions('y');
        if (window.player.y + window.player.height >= window.game.groundLevel) { window.player.y = window.game.groundLevel - window.player.height; window.player.vy = 0; window.player.isGrounded = true; }
        if (window.player.isGrounded) { window.player.coyoteTime = 10; window.player.isJumping = false; } else window.player.coyoteTime--;
        if (window.keys && window.keys.jumpPressed && window.player.jumpKeyReleased && window.player.coyoteTime > 0 && !window.player.isJumping && !window.player.placementMode && !window.player.isDead) { window.player.vy = window.player.jumpPower; window.player.isJumping = true; window.player.coyoteTime = 0; window.player.jumpKeyReleased = false; }
        if (window.keys && !window.keys.jumpPressed && window.player.vy < 0) window.player.vy *= 0.5;

        if (window.game.isMultiplayer && window.socket) {
            if (window.game.frameCount % 2 === 0 || window.player.attackFrame > 0 || window.player.isAiming || window.player.isDead) {
                window.socket.emit('playerMovement', { 
                    x: window.player.x, y: window.player.y, facingRight: window.player.facingRight, activeTool: window.player.activeTool, animTime: window.player.animTime, attackFrame: window.player.attackFrame,
                    isAiming: window.player.isAiming, isCharging: window.player.isCharging, chargeLevel: window.player.chargeLevel, mouseX: window.mouseWorldX, mouseY: window.mouseWorldY, isDead: window.player.isDead,
                    level: window.player.level
                });
            }
        }

        window.blocks = window.blocks.filter(b => {
            if (b.type === 'grave' && Date.now() - b.createdAt > 300000) {
                window.spawnParticles(b.x + 15, b.y + 15, '#7f8c8d', 15);
                window.sendWorldUpdate('destroy_grave', { id: b.id }); return false;
            } return true;
        });

        window.blocks.forEach(b => {
            if (b.type === 'campfire' && b.isBurning) {
                b.burnTime--;
                if (window.game.frameCount % 5 === 0) window.spawnParticles(b.x+15, b.y+10, '#e67e22', 1, 0.5); 
                if (b.meat > 0) { b.cookTimer++; if (b.cookTimer > 300) { b.meat--; b.cooked++; b.cookTimer = 0; if (window.currentCampfire === b && typeof window.renderCampfireUI==='function') window.renderCampfireUI(); } }
                if (window.game.isRaining) {
                    let hasRoof = window.blocks.some(roof => (roof.type === 'block' || roof.type === 'door') && roof.x === b.x && roof.y < b.y);
                    if (!hasRoof) {
                        b.rainExtinguishTimer = (b.rainExtinguishTimer || 0) + 1;
                        if (b.rainExtinguishTimer > 150) { 
                            b.isBurning = false; b.rainExtinguishTimer = 0;
                            window.spawnParticles(b.x+15, b.y+15, '#aaaaaa', 10, 0.5); 
                            if (window.currentCampfire === b && typeof window.renderCampfireUI==='function') window.renderCampfireUI();
                            if (window.sendWorldUpdate) window.sendWorldUpdate('update_campfire', { x: b.x, y: b.y, wood: b.wood, meat: b.meat, cooked: b.cooked, isBurning: false });
                        }
                    } else { b.rainExtinguishTimer = 0; }
                } else { b.rainExtinguishTimer = 0; }

                if (b.burnTime <= 0) { if (b.wood > 0) { b.wood--; b.burnTime = 1800; } else { b.isBurning = false; } if (window.currentCampfire === b && typeof window.renderCampfireUI==='function') window.renderCampfireUI(); }
            }
        });

        let pCX = window.player.x + window.player.width/2; let pCY = window.player.y + window.player.height/2;
        let anyItemHovered = false;

        let interactables = window.blocks.filter(b => (b.type === 'box' || b.type === 'campfire' || b.type === 'door' || b.type === 'grave') && window.checkRectIntersection(window.player.x - 15, window.player.y - 15, window.player.width + 30, window.player.height + 30, b.x, b.y, window.game.blockSize, b.type==='door'?window.game.blockSize*2:window.game.blockSize));
        let promptEl = window.getEl('interaction-prompt'); let textEl = window.getEl('prompt-text');
        
        window.player.nearbyItem = null;
        for (let i = window.droppedItems.length - 1; i >= 0; i--) {
            let item = window.droppedItems[i]; let s = window.itemDefs[item.type].size; let d = Math.hypot(pCX - item.x, pCY - item.y);
            if (window.keys && window.keys.y && d < 250 && !window.player.isDead) {
                item.x += (pCX - item.x) * 0.15; item.y += (pCY - item.y) * 0.15; item.vy = 0;
                if (d < 25) { 
                    if (window.canAddItem(item.type, item.amount)) {
                        window.player.inventory[item.type] = (window.player.inventory[item.type]||0) + item.amount; 
                        window.droppedItems.splice(i, 1); window.sendWorldUpdate('pickup_item', { id: item.id }); 
                        
                        if (['boxes', 'campfire_item', 'bed_item'].includes(item.type) || window.toolDefs[item.type]) { 
                            if(typeof window.autoEquip==='function') window.autoEquip(item.type); 
                        }
                        
                        window.spawnParticles(pCX, pCY, window.itemDefs[item.type].color, 5); if(typeof window.updateUI==='function') window.updateUI(); continue; 
                    } else { if (window.game.frameCount % 60 === 0) window.spawnDamageText(pCX, pCY - 30, "Inv. Lleno", '#fff'); }
                }
            } else {
                item.vy += window.game.gravity * 0.5; item.x += item.vx; item.y += item.vy; item.vx *= 0.95; 
                if (item.y + s >= window.game.groundLevel) { item.y = window.game.groundLevel - s; item.vy *= -0.5; item.vx *= 0.8; }
                for (let b of window.blocks) {
                    if ((b.type === 'door' && b.open) || b.type === 'box' || b.type === 'campfire' || b.type === 'bed') continue; let itemHeight = b.type === 'door' ? window.game.blockSize * 2 : window.game.blockSize;
                    if (window.checkRectIntersection(item.x, item.y, s, s, b.x, b.y, window.game.blockSize, itemHeight)) { if (item.vy > 0 && item.y + s - item.vy <= b.y) { item.y = b.y - s; item.vy *= -0.5; item.vx *= 0.8; } }
                }
                if (d < 60 && !window.player.isDead) { anyItemHovered = true; window.player.nearbyItem = item; }
            }
            item.life += 0.05;
        }

        if (promptEl && textEl) {
            if (interactables.length > 0 && !document.querySelector('.window-menu.open') && !window.player.isDead) {
                let hoveringInteractable = interactables[0];
                if (hoveringInteractable.type !== 'bed') {
                    promptEl.style.display = 'block'; 
                    let tName = hoveringInteractable.type === 'box' ? 'Caja' : (hoveringInteractable.type === 'campfire' ? 'Fogata' : (hoveringInteractable.type === 'grave' ? 'Tumba' : 'Puerta'));
                    textEl.innerHTML = `Presiona <span class="key-btn">E</span> para usar <span style="color:#D2B48C;">${tName}</span>`; 
                } else { promptEl.style.display = 'none'; }
            } else if (anyItemHovered && !window.player.isDead && window.player.nearbyItem) {
                let type = window.player.nearbyItem.type;
                let itData = window.itemDefs[type] || window.toolDefs[type];
                if(itData) {
                    let color = itData.color || '#FFD700';
                    let amtText = window.player.nearbyItem.amount > 1 ? ` x${window.player.nearbyItem.amount}` : '';
                    promptEl.style.display = 'block'; 
                    textEl.innerHTML = `Mantén <span class="key-btn">Y</span> para recoger <strong style="color:${color};">${itData.name}${amtText}</strong>`;
                } else { promptEl.style.display = 'none'; }
            } else { promptEl.style.display = 'none'; }
        }

        for (let i = window.projectiles.length - 1; i >= 0; i--) {
            let pr = window.projectiles[i]; pr.x += pr.vx; pr.vy += window.game.gravity * 0.4; pr.y += pr.vy; pr.angle = Math.atan2(pr.vy, pr.vx); pr.life--;
            if(pr.y >= window.game.groundLevel || pr.x < window.game.shoreX) { window.spawnParticles(pr.x, pr.y, '#557A27', 3); window.projectiles.splice(i, 1); continue; } 
            let hitBlock = false;
            for(let b of window.blocks) { let bh = b.type === 'door' ? window.game.blockSize * 2 : window.game.blockSize; if (!b.open && window.checkRectIntersection(pr.x, pr.y, 4, 4, b.x, b.y, window.game.blockSize, bh) && b.type !== 'box' && b.type !== 'campfire') { hitBlock = true; break; } }
            if(hitBlock) { window.spawnParticles(pr.x, pr.y, '#C19A6B', 5); window.projectiles.splice(i,1); continue; }
            
            if (pr.isEnemy) {
                if (!window.player.inBackground && !window.player.isDead && window.checkRectIntersection(pr.x, pr.y, 4, 4, window.player.x, window.player.y, window.player.width, window.player.height)) { window.damagePlayer(pr.damage, 'Flecha de Cazador'); window.spawnParticles(pr.x, pr.y, '#ff4444', 5); window.projectiles.splice(i, 1); continue; }
            } else {
                let hitEnt = false;
                for(let e = window.entities.length - 1; e >= 0; e--) {
                let ent = window.entities[e];
                if (window.checkRectIntersection(pr.x, pr.y, 4, 4, ent.x, ent.y, ent.width, ent.height)) {
                    ent.hp -= pr.damage; window.setHit(ent); window.spawnDamageText(ent.x, ent.y, "-"+Math.floor(pr.damage), '#ff4444'); window.spawnParticles(pr.x, pr.y, '#ff4444', 5);
                    if(ent.hp <= 0) {
                            window.killedEntities.push(ent.id); window.sendWorldUpdate('kill_entity', { id: ent.id });
                            window.spawnParticles(ent.x, ent.y, '#ff4444', 15); 
                            if (ent.type === 'spider') { let ni = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:0, vy:-1, type:'web', amount:1+Math.floor(ent.level/2), life:1.0}; window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni}); window.gainXP(20 * ent.level); }
                            else if (ent.type === 'chicken') { let ni = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:0, vy:-1, type:'meat', amount:1, life:1.0}; window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni}); window.gainXP(10); }
                            else if (ent.type === 'zombie') { let ni = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:0, vy:-1, type:'meat', amount:2, life:1.0}; window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni}); window.gainXP(50 * ent.level); }
                            else if (ent.type === 'archer') { 
                                let ni1 = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:-1, vy:-1, type:'arrows', amount:2+Math.floor(Math.random()*4), life:1.0}; window.droppedItems.push(ni1); window.sendWorldUpdate('drop_item', {item:ni1}); 
                                let ni2 = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:1, vy:-1, type:'wood', amount:3, life:1.0}; window.droppedItems.push(ni2); window.sendWorldUpdate('drop_item', {item:ni2}); window.gainXP(40 * ent.level); 
                            }
                            window.entities.splice(e, 1); if(window.updateUI) window.updateUI(); 
                    } else {
                        window.sendWorldUpdate('hit_entity', { id: ent.id, dmg: pr.damage });
                        if (ent.type === 'chicken') { ent.fleeTimer = 180; ent.fleeDir = (ent.x > pr.x) ? 1 : -1; window.sendWorldUpdate('flee_entity', { id: ent.id, dir: ent.fleeDir }); }
                    }
                    hitEnt = true; break;
                }
                } if(hitEnt) { window.projectiles.splice(i,1); continue; }
            }
            if(pr.life <= 0) window.projectiles.splice(i, 1);
        }

        let isMasterClient = true;
        if (window.game.isMultiplayer && window.otherPlayers) {
            let allIds = Object.keys(window.otherPlayers); allIds.push(window.socket?.id || ''); allIds.sort();
            if (allIds[0] !== window.socket?.id) isMasterClient = false;
        }

        if (window.game.isRaining && isMasterClient && window.game.frameCount % 60 === 0) {
            window.trees.forEach(t => {
                if (t.isStump && t.regrowthCount < 3 && t.grownDay !== window.game.days) {
                    let isOffScreen = (t.x < window.camera.x - 300 || t.x > window.camera.x + window._canvasLogicW + 300);
                    if (isOffScreen && Math.random() < 0.2) {
                        t.isStump = false; t.hp = 100; t.maxHp = 100; t.regrowthCount++; t.grownDay = window.game.days;
                        window.sendWorldUpdate('grow_tree', { x: t.x, regrowthCount: t.regrowthCount, grownDay: t.grownDay });
                    }
                }
            });
        }

        let spawnRate = Math.max(150, 600 - (window.game.days * 20) - Math.floor(window.player.x / 50));
        if (isNight && window.game.frameCount % spawnRate === 0 && isMasterClient) { 
            let cx = window.player.x + 800; if (Math.random() > 0.5 && window.player.x - 800 > window.game.shoreX + 2000) cx = window.player.x - 800; 
            let distToShore = Math.abs(cx - window.game.shoreX); let lvl = Math.floor(distToShore / 1000) + window.game.days; 
            if (distToShore > 2000) { 
                let newEnt = null;
                if (distToShore > 3000 && Math.random() < 0.4 && window.entities.filter(e => e.type === 'archer').length < 3) {
                    newEnt = { id: 'en_'+Math.random().toString(36).substr(2,9), type: 'archer', name: 'Cazador', level: lvl, x: cx, y: window.game.groundLevel - 40, width: 20, height: 40, vx: (window.player.x > cx ? 0.8 : -0.8), vy: 0, hp: 30 + (lvl * 20), maxHp: 30 + (lvl * 20), damage: 8 + (lvl * 3), isHit: false, attackCooldown: 0, stuckFrames: 0, ignorePlayer: 0, lastX: cx };
                } else if (window.entities.filter(e => e.type === 'zombie').length < 3) {
                    newEnt = { id: 'en_'+Math.random().toString(36).substr(2,9), type: 'zombie', name: 'Mutante', level: lvl, x: cx, y: window.game.groundLevel - 44, width: 24, height: 44, vx: (window.player.x > cx ? 0.4 : -0.4), vy: 0, hp: 60 + (lvl * 30), maxHp: 60 + (lvl * 30), damage: 15 + (lvl * 4), isHit: false, attackCooldown: 0, stuckFrames: 0, ignorePlayer: 0, lastX: cx };
                }
                if (newEnt) { window.entities.push(newEnt); window.sendWorldUpdate('spawn_entity', { entity: newEnt }); }
            }
        }

        let isHoldingTorch = window.player.activeTool === 'torch' && !window.player.inBackground && !window.player.isDead;

        window.entities.forEach((ent, i) => {
            let lastX = ent.x; ent.x += ent.vx; let hitWall = window.checkEntityCollisions(ent, 'x'); 
            if (ent.x < window.game.shoreX + 2000) { ent.x = window.game.shoreX + 2000; ent.vx = Math.abs(ent.vx); hitWall = true; }
            ent.vy += window.game.gravity; ent.y += ent.vy; window.checkEntityCollisions(ent, 'y'); 
            if (ent.y + ent.height >= window.game.groundLevel) { ent.y = window.game.groundLevel - ent.height; ent.vy = 0; }
            
            if (isDay && ent.type === 'zombie') {
                if (window.game.frameCount % 30 === 0) {
                    ent.hp -= 5; window.setHit(ent); window.spawnParticles(ent.x + ent.width/2, ent.y + ent.height/2, '#ffa500', 5); window.spawnDamageText(ent.x, ent.y, "-5", '#ffa500');
                    if (ent.hp <= 0) { 
                        window.killedEntities.push(ent.id); window.sendWorldUpdate('kill_entity', { id: ent.id });
                        window.spawnParticles(ent.x, ent.y, '#ff4444', 15); let ni = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:0, vy:-1, type:'meat', amount:2, life:1.0}; window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni}); window.gainXP(40 * ent.level); window.entities.splice(i, 1); return; 
                    }
                }
            }

            let repelled = false;
            for (let b of window.blocks) { if (b.type === 'campfire' && b.isBurning) { if (Math.hypot((ent.x+ent.width/2) - (b.x+15), (ent.y+ent.height/2) - (b.y+15)) < 150) { ent.vx = (ent.x > b.x ? 1.5 : -1.5); repelled = true; break; } } }

            if (!repelled && (ent.type === 'spider' || ent.type === 'zombie')) {
                if (ent.ignorePlayer > 0) ent.ignorePlayer--;
                let distToPlayer = Math.hypot(pCX - (ent.x + ent.width/2), pCY - (ent.y + ent.height/2));
                let aggroRange = 180; if (isNight && !window.player.isStealth) aggroRange = 600; if (ent.type === 'zombie' && !window.player.isStealth) aggroRange = 800; 

                let repelledByTorch = isHoldingTorch && distToPlayer < 250 && ent.level <= 3;

                if (repelledByTorch) {
                    ent.vx = (ent.x > pCX) ? 1.5 : -1.5;
                    ent.ignorePlayer = 60; 
                } else if (distToPlayer < aggroRange && ent.ignorePlayer <= 0) {
                    let speed = ent.type === 'zombie' ? 0.4 : 0.8; let targetVx = (window.player.x > ent.x) ? speed : -speed; ent.vx = targetVx;
                    if (hitWall || Math.abs(ent.x - lastX) < 0.1) { ent.stuckFrames++; if (ent.stuckFrames > 60 && ent.type !== 'zombie') { ent.ignorePlayer = 180; ent.vx = -targetVx * 1.5; ent.stuckFrames = 0; } } else ent.stuckFrames = 0;
                    if (distToPlayer < 40 && ent.attackCooldown <= 0 && !window.player.inBackground && !window.player.isDead) { window.damagePlayer(ent.damage, ent.name); ent.attackCooldown = 150; }
                } else { if(ent.type === 'spider' && Math.random() < 0.02 && ent.ignorePlayer <= 0) ent.vx = (Math.random() > 0.5 ? 0.5 : -0.5); }
                if (ent.attackCooldown > 0) ent.attackCooldown--;
            } 
            else if (!repelled && ent.type === 'archer') {
                let distToPlayer = Math.hypot(pCX - (ent.x + ent.width/2), pCY - (ent.y + ent.height/2));
                let aggroRange = (isNight && !window.player.isStealth) ? 1000 : 800; 
                if (distToPlayer < aggroRange && ent.ignorePlayer <= 0 && !window.player.inBackground && !window.player.isDead) {
                    let dirX = window.player.x > ent.x ? 1 : -1;
                    if (distToPlayer > 600) ent.vx = dirX * 0.5; else if (distToPlayer < 400) ent.vx = -dirX * 0.8; else ent.vx = 0;
                    if (hitWall || (Math.abs(ent.x - lastX) < 0.1 && ent.vx !== 0)) { ent.stuckFrames++; if (ent.stuckFrames > 60) { ent.ignorePlayer = 180; ent.vx = -dirX * 1.5; ent.stuckFrames = 0; } } else ent.stuckFrames = 0;
                    if (ent.attackCooldown <= 0 && distToPlayer < 950) {
                        let vx_base = pCX - (ent.x + ent.width/2); let vy_base = pCY - (ent.y + ent.height/2); let currentSpeed = Math.max(0.1, Math.hypot(vx_base, vy_base));
                        let arrowSpeed = 9; let vx = (vx_base / currentSpeed) * arrowSpeed; let vy = (vy_base / currentSpeed) * arrowSpeed;
                        let timeInAir = distToPlayer / arrowSpeed; vy -= (timeInAir * window.game.gravity * 0.4 * 0.5); 
                        let angle = Math.atan2(vy, vx); let errorMargin = Math.max(0, 0.2 - (ent.level * 0.02)); angle += (Math.random() - 0.5) * errorMargin;
                        window.projectiles.push({ x: ent.x + ent.width/2, y: ent.y + ent.height/2, vx: Math.cos(angle)*arrowSpeed, vy: Math.sin(angle)*arrowSpeed, life: 250, damage: ent.damage, isEnemy: true });
                        ent.attackCooldown = Math.max(180, 350 - (ent.level * 10)); 
                    }
                } else { if(Math.random() < 0.02 && ent.ignorePlayer <= 0) ent.vx = (Math.random() > 0.5 ? 0.6 : -0.6); }
                if (ent.attackCooldown > 0) ent.attackCooldown--;
            }
            else if (ent.type === 'chicken') { 
                if (ent.fleeTimer > 0) { ent.fleeTimer--; ent.vx = ent.fleeDir * 1.5; } 
                else if(Math.random() < 0.02) { ent.vx = (Math.random() > 0.5 ? 0.3 : -0.3); } 
            }
        });

        window.camera.x = window.player.x - (window._canvasLogicW / 2) + (window.player.width / 2);
        if (window.camera.x < window.game.shoreX - window._canvasLogicW/2) window.camera.x = window.game.shoreX - window._canvasLogicW/2; 
        if (window.player.x + (window._canvasLogicW / 2) > window.game.exploredRight) { window.generateWorldSector(window.game.exploredRight, window.game.exploredRight + window.game.chunkSize); window.game.exploredRight += window.game.chunkSize; }

        for (let i = window.particles.length - 1; i >= 0; i--) {
            let p = window.particles[i]; p.x += p.vx; p.y += p.vy; p.vy += window.game.gravity * 0.4; p.life -= p.decay;
            if (p.y >= window.game.groundLevel) { p.y = window.game.groundLevel; p.vy = -p.vy * 0.5; p.vx *= 0.8; }
            if (p.life <= 0.05 || isNaN(p.life)) window.particles.splice(i, 1);
        }

        for (let i = window.damageTexts.length - 1; i >= 0; i--) { 
            let dt = window.damageTexts[i]; dt.y -= 0.2; dt.life -= 0.008; 
            if (dt.life <= 0.05 || isNaN(dt.life)) window.damageTexts.splice(i, 1); 
        }

        if (window.game.frameCount % 60 === 0 && !window.player.isDead) {
            window.player.hunger -= isMoving ? 0.1 : 0.02; 
            if (window.player.hunger <= 0) { window.player.hunger = 0; window.damagePlayer(2, 'Hambre'); } 
            if (window.player.hunger > 50 && window.player.hp < window.player.maxHp) { window.player.hp += 0.5; if(typeof window.updateUI==='function') window.updateUI(); }
        }
        
        if (typeof window.updateEntityHUD === 'function') window.updateEntityHUD();

    } catch (err) {
        console.error("Motor de juego protegido:", err);
    }
}

window.gameLoop = function() { 
    if (window.game && window.game.isRunning) { update(); }
    if (typeof window.draw === 'function') { window.draw(); }
    requestAnimationFrame(window.gameLoop); 
};

window.addEventListener('DOMContentLoaded', () => { window.gameLoop(); });
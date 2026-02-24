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
        chatContainer.style.display = 'block'; chatInput.focus(); 
        if(window.keys) { window.keys.a = false; window.keys.d = false; window.keys.w = false; window.keys.shift = false; window.keys.y = false; window.keys.jumpPressed = false; window.keys.mouseLeft = false; }
        if(window.player) window.player.isCharging = false;
    }
};

window.destroyBlockLocally = function(b) {
    let index = window.blocks.indexOf(b);
    if (index === -1) return;

    if (window.currentOpenBox && window.currentOpenBox.x === b.x && window.currentOpenBox.y === b.y) { window.currentOpenBox = null; let dBox = window.getEl('menu-box'); if(dBox) dBox.classList.remove('open'); }
    
    let refundType = b.type === 'box' ? 'boxes' : (b.type === 'campfire' ? 'campfire_item' : (b.type === 'bed' ? 'bed_item' : (b.type === 'barricade' ? 'barricade_item' : (b.type === 'ladder' ? 'ladder_item' : 'wood')))); 
    let refundAmt = b.type === 'door' ? 2 : 1;
    if (b.type !== 'grave') { let ni = { id: Math.random().toString(36).substring(2,9), x:b.x+15, y:b.y+15, vx:0, vy:-2, type:refundType, amount:refundAmt, life:1.0}; window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni}); }

    if((b.type === 'box' || b.type === 'grave') && b.inventory) { for(const [t, amt] of Object.entries(b.inventory)) { if (amt > 0) { let ni2 = { id: Math.random().toString(36).substring(2,9), x:b.x+15, y:b.y+15, vx:(Math.random()-0.5)*2, vy:-2, type:t, amount:amt, life:1.0}; window.droppedItems.push(ni2); window.sendWorldUpdate('drop_item', {item:ni2}); } } }
    
    if(b.type === 'campfire') { 
        if (b.wood && b.wood > 0) { let c1={ id: Math.random().toString(36).substring(2,9), x:b.x+15,y:b.y+15,vx:-1,vy:-2,type:'wood',amount:b.wood,life:1.0}; window.droppedItems.push(c1); window.sendWorldUpdate('drop_item', {item:c1}); }
        if (b.meat && b.meat > 0) { let c2={ id: Math.random().toString(36).substring(2,9), x:b.x+15,y:b.y+15,vx:0,vy:-2,type:'meat',amount:b.meat,life:1.0}; window.droppedItems.push(c2); window.sendWorldUpdate('drop_item', {item:c2}); }
        if (b.cooked && b.cooked > 0) { let c3={ id: Math.random().toString(36).substring(2,9), x:b.x+15,y:b.y+15,vx:1,vy:-2,type:'cooked_meat',amount:b.cooked,life:1.0}; window.droppedItems.push(c3); window.sendWorldUpdate('drop_item', {item:c3}); }
    }

    if(b.type === 'bed' && window.player.bedPos && window.player.bedPos.x === b.x && window.player.bedPos.y === b.y) window.player.bedPos = null;
    if(b.type === 'grave') window.sendWorldUpdate('destroy_grave', { id: b.id });

    window.blocks.splice(index, 1); window.spawnParticles(b.x + 15, b.y + 15, '#C19A6B', 15, 1.2); window.gainXP(2); window.sendWorldUpdate('hit_block', { x: b.x, y: b.y, dmg: 9999, destroyed: true });

    let toBreak = [];
    for (let obj of window.blocks) {
        if (['door', 'campfire', 'box', 'bed', 'barricade'].includes(obj.type)) {
            let objH = obj.type === 'door' ? window.game.blockSize * 2 : window.game.blockSize;
            if (obj.x === b.x && obj.y + objH === b.y) toBreak.push(obj);
        }
    }
    for (let obj of toBreak) { window.destroyBlockLocally(obj); }
};

window.isValidPlacement = function(x, y, w, h, requireAdjacency = true, isStructure = false) {
    const bs = window.game.blockSize;
    let localGY = window.getGroundY ? window.getGroundY(x + w/2) : window.game.groundLevel;
    // No permitir colocar bloques dentro o debajo del suelo
    if (y + h > localGY) return false;
    if (window.checkRectIntersection(x, y, w, h, window.player.x, window.player.y, window.player.width, window.player.height)) return false;
    if (window.game.isMultiplayer && window.otherPlayers) { for (let id in window.otherPlayers) { let op = window.otherPlayers[id]; if (window.checkRectIntersection(x, y, w, h, op.x, op.y, op.width||24, op.height||48)) return false; } }
    
    let isItem = !isStructure; let isDoor = isStructure && h > bs;
    if (isItem || isDoor) {
        let supported = false;
        // Soportado si el fondo toca el suelo (con tolerancia de 1px por snapping)
        if (Math.abs((y + h) - localGY) <= bs) supported = true;
        if (!supported) { for (let b of window.blocks) { if ((b.type === 'block' || b.type === 'ladder') && Math.abs(b.x - x) < 1 && Math.abs(b.y - (y + h)) < bs / 2) { supported = true; break; } } }
        if (!supported) return false; 
    }

    for (let b of window.blocks) { 
        // Escaleras son atravesables: no bloquean colocación de otras escaleras en la misma posición X
        if (b.type === 'ladder') continue;
        let bh = b.type === 'door' ? bs * 2 : bs; 
        if (window.checkRectIntersection(x, y, w, h, b.x, b.y, bs, bh)) return false; 
        
        let isHorizontallyAdjacent = (Math.abs(x - (b.x - bs)) < 1 || Math.abs(x - (b.x + bs)) < 1);
        let isVerticallyOverlapping = (y < b.y + bh && y + h > b.y);

        if (isHorizontallyAdjacent && isVerticallyOverlapping) {
            if (isDoor || b.type === 'door') return false; 
        }
        
        if (isDoor && b.type === 'door' && Math.abs(b.x - x) < 1 && (Math.abs(b.y - (y + h)) < 1 || Math.abs((b.y + bh) - y) < 1)) return false;

        if (isItem && (b.type === 'box' || b.type === 'campfire' || b.type === 'bed' || b.type === 'grave' || b.type === 'barricade')) { 
            if (Math.abs(b.x - x) < bs && Math.abs(b.y - (y + h)) < 1) return false; 
        }
    }
    for (let t of window.trees) { 
        const tFY = window.getGroundY ? window.getGroundY(t.x + t.width/2) : (t.groundY || t.y + t.height);
        let th = t.isStump ? 80 : t.height; 
        let ty = tFY - th; 
        if (window.checkRectIntersection(x, y, w, h, t.x, ty, t.width, th)) return false; 
    }
    for (let r of window.rocks) { 
        const rFY2 = window.getGroundY ? window.getGroundY(r.x + r.width/2) : (r.y + r.height);
        if (window.checkRectIntersection(x, y, w, h, r.x, rFY2 - r.height, r.width, r.height)) return false; 
    }
    if (requireAdjacency) { if (!window.isAdjacentToBlockOrGround(x, y, w, h)) return false; }
    return true;
};

window.isOverlappingSolidBlock = function() {
    for (let b of window.blocks) {
        if ((b.type === 'door' && b.open) || b.type === 'box' || b.type === 'campfire' || b.type === 'bed' || b.type === 'grave' || b.type === 'barricade' || b.type === 'ladder') continue; 
        let itemHeight = b.type === 'door' ? window.game.blockSize * 2 : window.game.blockSize;
        if (window.checkRectIntersection(window.player.x, window.player.y, window.player.width, window.player.height, b.x, b.y, window.game.blockSize, itemHeight)) return true;
    } return false;
};

window.isAdjacentToBlockOrGround = function(x, y, w, h) {
    let localGY = window.getGroundY ? window.getGroundY(x + w/2) : window.game.groundLevel;
    if (y + h >= localGY - 2) return true; 
    const expX = x - 2, expY = y - 2, expW = w + 4, expH = h + 4;
    for (let b of window.blocks) { let bh = b.type === 'door' ? window.game.blockSize * 2 : window.game.blockSize; if (window.checkRectIntersection(expX, expY, expW, expH, b.x, b.y, window.game.blockSize, bh)) return true; } return false;
}

// Devuelve verdadero si el jugador está dentro de una escalera (para trepar)
window.isOnLadder = function() {
    const pCX = window.player.x + window.player.width / 2;
    for (let b of window.blocks) {
        if (b.type !== 'ladder') continue;
        const bs = window.game.blockSize;
        if (pCX >= b.x && pCX <= b.x + bs &&
            window.player.y + window.player.height > b.y &&
            window.player.y < b.y + bs) return true;
    }
    return false;
};

window.checkBlockCollisions = function(axis) {
    if (window.player.inBackground) return;
    for (let b of window.blocks) {
        // Escaleras: traversables, colisión sólo gestionada por trepado
        if ((b.type === 'door' && b.open) || b.type === 'box' || b.type === 'campfire' || b.type === 'bed' || b.type === 'grave' || b.type === 'barricade' || b.type === 'ladder') continue; 
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
                if ((ent.type === 'zombie' || ent.type === 'spider') && b.type === 'door') {
                    if (window.game.frameCount % 40 === 0) { 
                        b.hp -= 20; window.setHit(b); window.spawnParticles(b.x + 10, b.y + 10, '#ff4444', 5); 
                        if (b.hp <= 0) { window.destroyBlockLocally(b); } else { window.sendWorldUpdate('hit_block', { x: b.x, y: b.y, dmg: 20 }); }
                    }
                }
                if ((ent.type === 'spider' || ent.type === 'zombie') && b.type === 'barricade') {
                    if (window.game.frameCount % 40 === 0) {
                        const dmgToBarricade = ent.type === 'spider' ? 8 : 15;
                        b.hp -= dmgToBarricade; window.setHit(b); window.spawnParticles(b.x + 15, b.y + 15, '#ff4444', 4);
                        if (b.hp <= 0) { window.destroyBlockLocally(b); } else { window.sendWorldUpdate('hit_block', { x: b.x, y: b.y, dmg: dmgToBarricade }); }
                        const dmgToEnt = ent.type === 'spider' ? 6 : 4;
                        ent.hp -= dmgToEnt; window.setHit(ent); window.spawnParticles(ent.x + ent.width/2, ent.y + ent.height/2, '#ffa500', 3); window.spawnDamageText(ent.x + ent.width/2, ent.y - 4, `-${dmgToEnt}`, 'melee');
                    }
                    hitWall = true;
                }
            } else if (axis === 'y') { if (ent.vy > 0) { ent.y = b.y - ent.height; ent.vy = 0; } else if (ent.vy < 0) { ent.y = b.y + itemHeight; ent.vy = 0; } }
        }
    } return hitWall;
};

window.generateWorldSector = function(startX, endX) {
    if (startX < window.game.shoreX + 50) startX = window.game.shoreX + 50; 
    let seed = Math.floor(startX) + 12345; function sRandom() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    
    if (!window.removedTrees) window.removedTrees = []; if (!window.treeState) window.treeState = {}; if (!window.removedRocks) window.removedRocks = []; if (!window.killedEntities) window.killedEntities = [];

    // --- Helper: verifica exactamente 2 columnas de blockSize planas a cada lado del centro ---
    // Muestrea sobre el grid real (múltiplos de bs) igual que getGroundY los produce.
    // "Plano" = misma Y exacta (getGroundY ya snapea, así que igualdad estricta funciona).
    const bs = window.game.blockSize;
    function isTerrainFlat(cx) {
        if (!window.getGroundY) return true;
        // Snap al grid de blockSize
        const col = Math.round(cx / bs) * bs;
        const baseY = window.getGroundY(col);
        // Exigir 2 bloques consecutivos idénticos ANTES y DESPUÉS
        for (let s = 1; s <= 2; s++) {
            if (window.getGroundY(col - s * bs) !== baseY) return false;
            if (window.getGroundY(col + s * bs) !== baseY) return false;
        }
        return true;
    }

    const numTrees = Math.floor(sRandom() * 5) + 3; 
    let localTreeX = []; 
    const TREE_W = 40; const TREE_H = 240; // constantes fijas para el check de posición
    
    for (let i = 0; i < numTrees; i++) { 
        let tx; let validPos = false; let attempts = 0;
        while (attempts < 15 && !validPos) {
            tx = Math.floor(startX + 50 + sRandom() * (endX - startX - 100)); 
            validPos = true;
            for (let existingX of localTreeX) { if (Math.abs(tx - existingX) < 140) { validPos = false; break; } }
            // Verificar terreno plano: 2 bloques idénticos a cada lado del centro del árbol
            if (validPos && !isTerrainFlat(tx + TREE_W / 2)) validPos = false;
            attempts++;
        }
        if (validPos) {
            localTreeX.push(tx);
            let tHeight = TREE_H; let tWidth = TREE_W; 
            if (!window.removedTrees.some(rx => Math.abs(rx - tx) < 1)) {
                let stateKey = Object.keys(window.treeState).find(kx => Math.abs(parseFloat(kx) - tx) < 1);
                let tState = stateKey ? window.treeState[stateKey] : false;
                let isStump = tState ? tState.isStump : false; let rCount = tState ? tState.regrowthCount : 0; let gDay = tState ? tState.grownDay : -1;
                let hp = isStump ? 50 : 100;
                let tGroundY = window.getGroundY ? window.getGroundY(tx + tWidth/2) : window.game.groundLevel;
                if(!window.trees.some(t => Math.abs(t.x - tx) < 1)) { window.trees.push({ id: 't_'+tx, x: tx, y: tGroundY - tHeight, width: tWidth, height: tHeight, hp: hp, maxHp: hp, isHit: false, type: Math.floor(sRandom() * 3), isStump: isStump, regrowthCount: rCount, grownDay: gDay, groundY: tGroundY }); }
            }
        }
    }

    if (startX > 800 && sRandom() < 0.75) { 
        const numRocks = Math.floor(sRandom() * 3) + 2; 
        for (let i=0; i<numRocks; i++) { 
            let rx = Math.floor(startX + sRandom() * (endX - startX)); let rW = 50 + Math.floor(sRandom()*40); let rH = 35 + Math.floor(sRandom()*25); 
            // Verificar terreno plano: 2 bloques idénticos a cada lado del centro de la roca
            const rcx = rx + rW / 2;
            if (!isTerrainFlat(rcx)) continue;
            let rGroundY = window.getGroundY ? window.getGroundY(rcx) : window.game.groundLevel;
            if (!window.removedRocks.some(rrx => Math.abs(rrx - rx) < 1) && !window.rocks.some(r => Math.abs(r.x - rx) < 1)) { window.rocks.push({id: 'r_'+rx, x: rx, y: rGroundY - rH, width: rW, height: rH, hp: 300, maxHp: 300, isHit: false}); }
        }
    }
    
    let cx = Math.floor(startX + 100 + sRandom() * (endX - startX - 200)); let distToShore = Math.abs(cx - window.game.shoreX); let lvl = Math.floor(distToShore / 1000) + window.game.days; let newId = 'e_' + cx;
    let cGroundY = window.getGroundY ? window.getGroundY(cx) : window.game.groundLevel;
    if (!window.entities.some(e => e.id === newId) && !window.killedEntities.includes(newId)) {
        if (distToShore > 2000) {
            if (distToShore > 3000 && sRandom() < 0.4) { let aMaxHp = 30 + (lvl * 20); window.entities.push({ id: newId, type: 'archer', name: 'Cazador', level: lvl, x: cx, y: cGroundY - 40, width: 20, height: 40, vx: (sRandom() > 0.5 ? 0.8 : -0.8), vy: 0, hp: aMaxHp, maxHp: aMaxHp, damage: 8 + (lvl * 3), isHit: false, attackCooldown: 0, stuckFrames: 0, ignorePlayer: 0, lastX: cx }); } 
            else if (sRandom() < 0.6) { window.entities.push({ id: newId, type: 'chicken', name: 'Pollo', level: lvl, x: cx, y: cGroundY - 20, width: 20, height: 20, vx: (sRandom() > 0.5 ? 0.3 : -0.3), vy: 0, hp: 25 + (lvl*5), maxHp: 25 + (lvl*5), isHit: false, attackCooldown: 0, stuckFrames: 0, fleeTimer: 0, fleeDir: 1, lastX: cx }); } 
            else { let spiderMaxHp = 20 + (lvl * 15); let sWidth = 14 + (lvl * 2), sHeight = 8 + (lvl * 1.5); window.entities.push({ id: newId, type: 'spider', name: 'Araña', level: lvl, x: cx, y: cGroundY - sHeight, width: sWidth, height: sHeight, vx: (sRandom() > 0.5 ? 0.6 : -0.6), vy: 0, hp: spiderMaxHp, maxHp: spiderMaxHp, damage: 8 + (lvl * 3), isHit: false, attackCooldown: 0, stuckFrames: 0, ignorePlayer: 0, lastX: cx }); }
        } else { window.entities.push({ id: newId, type: 'chicken', name: 'Pollo', level: 1, x: cx, y: cGroundY - 20, width: 20, height: 20, vx: (sRandom() > 0.5 ? 0.3 : -0.3), vy: 0, hp: 25, maxHp: 25, isHit: false, attackCooldown: 0, stuckFrames: 0, fleeTimer: 0, fleeDir: 1, lastX: cx }); }
    }
};

window.startGame = function(multiplayer, ip = null) {
    const nameInput = window.getEl('player-name'); 
    let rawName = (nameInput && nameInput.value) ? nameInput.value.trim() : "Jugador " + Math.floor(Math.random()*1000);
    window.player.name = rawName.substring(0, 15);

    let menu = window.getEl('main-menu'); if(menu) menu.style.display = 'none'; let ui = window.getEl('ui-layer'); if(ui) ui.style.display = 'block';
    window.game.isRunning = true; window.game.isMultiplayer = multiplayer;
    if (window.initRenderCaches) window.initRenderCaches(); 
    window.generateWorldSector(window.game.shoreX, window.game.exploredRight);

    if (multiplayer && typeof io !== 'undefined') {
        try {
            const connectionURL = ip ? `http://${ip}:3000` : window.location.origin; window.socket = io(connectionURL);
            let sInfo = window.getEl('server-info'); if(sInfo) { sInfo.style.display = 'flex'; window.getEl('sv-ip').innerText = ip ? ip : 'Servidor Web'; }
            if (ip && ip !== window.location.hostname && ip !== 'localhost' && ip !== '127.0.0.1') { let list = JSON.parse(localStorage.getItem('savedServers') || '[]'); if (!list.includes(ip)) { list.push(ip); localStorage.setItem('savedServers', JSON.stringify(list)); if(window.refreshServerList) window.refreshServerList(); } }
            
            window.socket.on('connect', () => { window.socket.emit('joinGame', { name: window.player.name, x: window.player.x, y: window.player.y, level: window.player.level }); });
            window.socket.on('disconnect', () => { alert("⚠ Se perdió la conexión con el Servidor. La partida se reiniciará."); window.location.reload(); });
            window.socket.on('currentPlayers', (srvPlayers) => { window.otherPlayers = srvPlayers; let pCount = window.getEl('sv-players'); if(pCount) pCount.innerText = Object.keys(srvPlayers).length; });
            
            window.socket.on('playerMoved', (pInfo) => { 
                if(window.otherPlayers[pInfo.id]) { 
                    let op = window.otherPlayers[pInfo.id];
                    op.targetX = pInfo.x; op.targetY = pInfo.y; op.vx = pInfo.vx; op.vy = pInfo.vy;
                    op.facingRight = pInfo.facingRight; op.activeTool = pInfo.activeTool; op.animTime = pInfo.animTime;
                    op.attackFrame = pInfo.attackFrame; op.isAiming = pInfo.isAiming; op.isCharging = pInfo.isCharging;
                    op.chargeLevel = pInfo.chargeLevel; op.isDead = pInfo.isDead; op.level = pInfo.level;
                    op.mouseX = pInfo.mouseX; op.mouseY = pInfo.mouseY;
                } 
            });
            
            window.socket.on('timeSync', (serverUptimeMs) => { window.game.serverStartTime = Date.now() - serverUptimeMs; });
            
            window.socket.on('initWorldState', (state) => {
                window.blocks = state.blocks; window.removedTrees = state.removedTrees; window.removedRocks = state.removedRocks; window.treeState = state.treeState || {}; window.killedEntities = state.killedEntities || [];
                window.trees = window.trees.filter(t => !window.removedTrees.some(rx => Math.abs(rx - t.x) < 1)); 
                window.trees.forEach(t => { 
                    let stateKey = Object.keys(window.treeState).find(kx => Math.abs(parseFloat(kx) - t.x) < 1);
                    if (stateKey) { t.isStump = window.treeState[stateKey].isStump; t.regrowthCount = window.treeState[stateKey].regrowthCount; t.grownDay = window.treeState[stateKey].grownDay; if (t.isStump) { t.hp = 50; t.maxHp = 50; } } 
                });
                window.rocks = window.rocks.filter(r => !window.removedRocks.some(rx => Math.abs(rx - r.x) < 1));
                window.entities = window.entities.filter(e => !window.killedEntities.includes(e.id));
                if(window.updateUI) window.updateUI();
            });

            window.socket.on('chatMessage', (data) => { 
                if (data.id === window.socket.id) return;
                if (window.otherPlayers[data.id]) { window.otherPlayers[data.id].chatText = data.text; window.otherPlayers[data.id].chatExpires = Date.now() + 6500; if(window.addGlobalMessage) window.addGlobalMessage(`💬 [${window.otherPlayers[data.id].name}]: ${data.text}`, '#a29bfe'); } 
            });
            
            window.socket.on('worldUpdate', (data) => {
                if (data.action === 'player_death') { if(window.addGlobalMessage) window.addGlobalMessage(`☠️ ${data.payload.name} murió por ${data.payload.source}`, '#e74c3c'); }
                else if (data.action === 'hit_tree') { let t = window.trees.find(tr => Math.abs(tr.x - data.payload.x) < 1); if (t) { t.hp -= data.payload.dmg; window.setHit(t); } }
                else if (data.action === 'stump_tree') { let t = window.trees.find(tr => Math.abs(tr.x - data.payload.x) < 1); if (t) { t.isStump = true; t.hp = 50; t.maxHp = 50; t.regrowthCount = data.payload.regrowthCount; t.grownDay = data.payload.grownDay; window.treeState[t.x] = { isStump: true, regrowthCount: t.regrowthCount, grownDay: t.grownDay }; } }
                else if (data.action === 'grow_tree') { let t = window.trees.find(tr => Math.abs(tr.x - data.payload.x) < 1); if (t) { t.isStump = false; t.hp = 100; t.maxHp = 100; t.regrowthCount = data.payload.regrowthCount; t.grownDay = data.payload.grownDay; window.treeState[t.x] = { isStump: false, regrowthCount: t.regrowthCount, grownDay: t.grownDay }; } }
                else if (data.action === 'destroy_tree') { window.removedTrees.push(data.payload.x); let stateKey = Object.keys(window.treeState).find(kx => Math.abs(parseFloat(kx) - data.payload.x) < 1); if(stateKey) delete window.treeState[stateKey]; window.trees = window.trees.filter(t => Math.abs(t.x - data.payload.x) > 1); }
                else if (data.action === 'hit_rock') { let r = window.rocks.find(ro => Math.abs(ro.x - data.payload.x) < 1); if (r) { r.hp -= data.payload.dmg; window.setHit(r); } }
                else if (data.action === 'destroy_rock') { window.removedRocks.push(data.payload.x); window.rocks = window.rocks.filter(r => Math.abs(r.x - data.payload.x) > 1); }
                else if (data.action === 'hit_block') { let b = window.blocks.find(bl => Math.abs(bl.x - data.payload.x) < 1 && Math.abs(bl.y - data.payload.y) < 1); if (b) { b.hp -= data.payload.dmg; window.setHit(b); if(data.payload.destroyed || b.hp <= 0) { if (window.currentOpenBox && window.currentOpenBox.x === b.x && window.currentOpenBox.y === b.y) { window.currentOpenBox = null; let dBox = window.getEl('menu-box'); if (dBox) dBox.classList.remove('open'); } window.blocks = window.blocks.filter(bl => bl !== b); } } }
                else if (data.action === 'destroy_grave') { if (window.currentOpenBox && window.currentOpenBox.id === data.payload.id) { window.currentOpenBox = null; let dBox = window.getEl('menu-box'); if (dBox) dBox.classList.remove('open'); } window.blocks = window.blocks.filter(b => b.id !== data.payload.id); }
                else if (data.action === 'place_block') { let exists = window.blocks.find(bl => bl.x === data.payload.block.x && bl.y === data.payload.block.y); if (!exists) window.blocks.push(data.payload.block); }
                else if (data.action === 'remove_old_bed') { window.blocks = window.blocks.filter(b => b.type !== 'bed' || b.owner !== data.payload.owner); }
                else if (data.action === 'interact_door') { let d = window.blocks.find(bl => Math.abs(bl.x - data.payload.x) < 1 && Math.abs(bl.y - data.payload.y) < 1); if (d) d.open = !d.open; }
                else if (data.action === 'drop_item') { let exists = window.droppedItems.find(i => i.id === data.payload.item.id); if(!exists) window.droppedItems.push(data.payload.item); }
                else if (data.action === 'pickup_item') { let index = window.droppedItems.findIndex(i => i.id === data.payload.id); if (index !== -1) window.droppedItems.splice(index, 1); }
                else if (data.action === 'spawn_projectile') { window.projectiles.push(data.payload); }
                else if (data.action === 'spawn_stuck_arrow') { window.stuckArrows.push(data.payload); }
                else if (data.action === 'remove_stuck_arrow') { window.stuckArrows = window.stuckArrows.filter(sa => sa.id !== data.payload.id); }
                else if (data.action === 'spawn_entity') { if (!window.entities.some(e => e.id === data.payload.entity.id) && !window.killedEntities.includes(data.payload.entity.id)) { window.entities.push(data.payload.entity); } }
                else if (data.action === 'kill_entity') { window.killedEntities.push(data.payload.id); window.entities = window.entities.filter(en => en.id !== data.payload.id); }
                else if (data.action === 'hit_entity') { let e = window.entities.find(en => en.id === data.payload.id); if (e) { e.hp -= data.payload.dmg; window.setHit(e); } }
                else if (data.action === 'flee_entity') { let e = window.entities.find(en => en.id === data.payload.id); if (e) { e.fleeTimer = 180; e.fleeDir = data.payload.dir; } }
                else if (data.action === 'sync_entities') { data.payload.forEach(snap => { let e = window.entities.find(en => en.id === snap.id); if (e) { e.x += (snap.x - e.x) * 0.3; e.y += (snap.y - e.y) * 0.3; e.vx = snap.vx; e.vy = snap.vy; e.hp = snap.hp; } }); }
                else if (data.action === 'update_box') { let b = window.blocks.find(bl => Math.abs(bl.x - data.payload.x) < 1 && Math.abs(bl.y - data.payload.y) < 1 && (bl.type === 'box' || bl.type === 'grave')); if (b) { b.inventory = data.payload.inventory; if (window.currentOpenBox && Math.abs(window.currentOpenBox.x - b.x) < 1) if(window.renderBoxUI) window.renderBoxUI(); } }
                else if (data.action === 'update_campfire') { let b = window.blocks.find(bl => Math.abs(bl.x - data.payload.x) < 1 && Math.abs(bl.y - data.payload.y) < 1 && bl.type === 'campfire'); if (b) { b.wood = data.payload.wood; b.meat = data.payload.meat; b.cooked = data.payload.cooked; b.isBurning = data.payload.isBurning; if (window.currentCampfire && Math.abs(window.currentCampfire.x - b.x) < 1) if(window.renderCampfireUI) window.renderCampfireUI(); } }
            });
        } catch(e) { console.error("Error Socket:", e); alert("No se pudo conectar al servidor. Verifica la IP."); }
    }
    window.recalculateStats(); if(window.updateUI) window.updateUI(); if(window.renderToolbar) window.renderToolbar(); 
};

// === EVENTOS ===

window.addEventListener('contextmenu', (e) => { e.preventDefault(); });

window.addEventListener('blur', () => { 
    if(window.keys) { 
        window.keys.a = false; window.keys.d = false; window.keys.w = false; 
        window.keys.shift = false; window.keys.y = false; window.keys.jumpPressed = false; 
        window.keys.mouseLeft = false; 
    } 
    if(window.player) window.player.isCharging = false; 
});

window.addEventListener('keyup', (e) => {
    if (!window.game || !window.game.isRunning) return;
    let chatInput = window.getEl('chat-input');
    if (chatInput && document.activeElement === chatInput) return;
    if (!window.keys) return;
    if (e.key === 'a' || e.key === 'A') window.keys.a = false; if (e.key === 'd' || e.key === 'D') window.keys.d = false; if (e.key === 'Shift') window.keys.shift = false; if (e.key === 'y' || e.key === 'Y') window.keys.y = false;
    if (e.key === 'w' || e.key === 'W' || e.key === ' ') { window.keys.jumpPressed = false; if(window.player) window.player.jumpKeyReleased = true; }
});

window.addEventListener('keydown', (e) => {
    if (!window.game || !window.game.isRunning || !window.player) return;
    let chatContainer = window.getEl('chat-container'); let chatInput = window.getEl('chat-input');
    
    if (chatContainer && chatInput && !window.player.isDead) {
        if (e.key === 'Enter') {
            if (document.activeElement === chatInput) {
                let msg = chatInput.value.trim();
                if (msg.length > 0) {
                    // --- COMANDOS DE CHAT ---
                    if (msg.startsWith('/')) {
                        const cmd = msg.toLowerCase();
                        if (cmd === '/madera') {
                            window.player.inventory.wood = (window.player.inventory.wood || 0) + 100;
                            window.spawnDamageText(window.player.x + window.player.width/2, window.player.y - 20, '+100 Madera 🌲', '#c19a6b');
                            if (window.updateUI) window.updateUI();
                        } else if (cmd === '/piedra') {
                            window.player.inventory.stone = (window.player.inventory.stone || 0) + 100;
                            window.spawnDamageText(window.player.x + window.player.width/2, window.player.y - 20, '+100 Piedra ⛏️', '#999');
                            if (window.updateUI) window.updateUI();
                        } else if (cmd === '/flechas') {
                            window.player.inventory.arrows = (window.player.inventory.arrows || 0) + 10;
                            window.spawnDamageText(window.player.x + window.player.width/2, window.player.y - 20, '+10 Flechas 🏹', '#e67e22');
                            if (window.updateUI) window.updateUI();
                        } else if (cmd === '/escalera') {
                            window.player.inventory.ladder_item = (window.player.inventory.ladder_item || 0) + 10;
                            window.spawnDamageText(window.player.x + window.player.width/2, window.player.y - 20, '+10 Escaleras 🪜', '#c8a86a');
                            if (window.updateUI) window.updateUI();
                        } else if (cmd === '/dance') {
                            window.player.isDancing = true;
                            window.player.danceStart = window.game.frameCount;
                            window.player.chatText = '🕺 ¡A bailar!';
                            window.player.chatExpires = Date.now() + 3000;
                        } else {
                            window.spawnDamageText(window.player.x + window.player.width/2, window.player.y - 20, 'Comando desconocido', '#e74c3c');
                        }
                        chatInput.value = ''; chatInput.blur(); chatContainer.style.display = 'none'; window.player.isTyping = false;
                        return;
                    }
                    // Mensaje normal
                    window.player.chatText = msg; window.player.chatExpires = Date.now() + 6500;
                    if(window.addGlobalMessage) window.addGlobalMessage(`💬 [Tú]: ${msg}`, '#3498db');
                    if (window.socket) window.socket.emit('chatMessage', msg);
                }
                chatInput.value = ''; chatInput.blur(); chatContainer.style.display = 'none'; window.player.isTyping = false; 
            } else { e.preventDefault(); window.openChat(); }
            return;
        }
        if (document.activeElement === chatInput) return; 
    }

    if (window.player.isDead) return; 

    if (!window.keys) window.keys = {};
    // Cancelar baile con cualquier tecla de movimiento/acción
    if (window.player.isDancing) { window.player.isDancing = false; }
    if (e.key === 'a' || e.key === 'A') window.keys.a = true; if (e.key === 'd' || e.key === 'D') window.keys.d = true; if (e.key === 'Shift') window.keys.shift = true; if (e.key === 'w' || e.key === 'W' || e.key === ' ') window.keys.jumpPressed = true; if (e.key === 'y' || e.key === 'Y') window.keys.y = true; 
    
    if (!window.player.placementMode) {
        if (e.key === 'i' || e.key === 'I') { if(window.toggleMenu) window.toggleMenu('inventory'); } 
        if (e.key === 'c' || e.key === 'C') { if(window.toggleMenu) window.toggleMenu('crafting'); } 
        if (e.key === 'f' || e.key === 'F') { if(window.eatFood) window.eatFood(15, 30); }
        if (e.key === 'r' || e.key === 'R') { if(window.player.activeTool === 'hammer') { window.player.buildMode = window.player.buildMode === 'block' ? 'door' : 'block'; window.spawnDamageText(window.player.x+window.player.width/2, window.player.y-20, `Modo: ${window.player.buildMode}`, '#fff'); } }

        if (e.key === 'e' || e.key === 'E') {
            const pCX = window.player.x + window.player.width / 2, pCY = window.player.y + window.player.height / 2;
            
            let arrowToPick = window.stuckArrows.find(sa => Math.hypot(pCX - sa.x, pCY - sa.y) < 60);
            if (arrowToPick) {
                if (window.canAddItem('arrows', 1)) {
                    window.player.inventory.arrows = (window.player.inventory.arrows || 0) + 1;
                    window.stuckArrows = window.stuckArrows.filter(sa => sa.id !== arrowToPick.id);
                    window.sendWorldUpdate('remove_stuck_arrow', { id: arrowToPick.id });
                    if (window.playSound) window.playSound('pickup');
                    if (window.updateUI) window.updateUI(); if (window.renderToolbar) window.renderToolbar();
                } else { window.spawnDamageText(pCX, pCY - 30, "Inv. Lleno", '#fff'); }
                return;
            }

            let interactables = window.blocks.filter(b => (b.type === 'box' || b.type === 'campfire' || b.type === 'door' || b.type === 'grave') && window.checkRectIntersection(window.player.x - 15, window.player.y - 15, window.player.width + 30, window.player.height + 30, b.x, b.y, window.game.blockSize, b.type==='door'?window.game.blockSize*2:window.game.blockSize));
            if (interactables.length > 0) {
                let b = interactables[0];
                if (b.type === 'door') { b.open = !b.open; window.spawnParticles(b.x + window.game.blockSize / 2, b.y + window.game.blockSize, '#5C4033', 5); window.sendWorldUpdate('interact_door', { x: b.x, y: b.y }); if (window.playSound) window.playSound('door'); } 
                else if (b.type === 'box' || b.type === 'grave') { window.currentOpenBox = b; if(window.toggleMenu) window.toggleMenu('box'); } 
                else if (b.type === 'campfire') { window.currentCampfire = b; if(window.toggleMenu) window.toggleMenu('campfire'); }
            }
        }
        
        if (e.key === 'z' || e.key === 'Z') { window.game.zoomTarget = 1.0; window.spawnDamageText(window.player.x+window.player.width/2, window.player.y-20, `Zoom: 1.0×`, '#aaddff'); }
        if (e.key === '+' || e.key === '=') { window.game.zoomTarget = Math.min(window.game.maxZoom, (window.game.zoomTarget||1) + 0.15); }
        if (e.key === '-' || e.key === '_') { window.game.zoomTarget = Math.max(window.game.minZoom, (window.game.zoomTarget||1) - 0.15); }

        const num = parseInt(e.key); if (!isNaN(num) && num >= 1 && num <= 6) { if(window.selectToolbarSlot) window.selectToolbarSlot(num - 1); if(window.renderToolbar) window.renderToolbar(); }
    }
});

window.addEventListener('mousemove', (e) => {
    if(!window.canvas || !window.player || window.player.isDead) return;
    const rect = window.canvas.getBoundingClientRect(); const scaleX = window._canvasLogicW / rect.width; const scaleY = window._canvasLogicH / rect.height;
    window.screenMouseX = (e.clientX - rect.left) * scaleX; window.screenMouseY = (e.clientY - rect.top) * scaleY;
    const W = window._canvasLogicW || 1280; const H = window._canvasLogicH || 720; const z = window.game.zoom || 1;
    window.mouseWorldX = (window.screenMouseX - W/2) / z + window.camera.x + W/2;
    window.mouseWorldY = (window.screenMouseY - H/2) / z + window.camera.y + H/2;
    if (window.player.isAiming || window.player.attackFrame > 0) window.player.facingRight = window.mouseWorldX >= window.player.x + window.player.width / 2;
});

document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
    e.preventDefault(); if (!window.player || window.player.isDead) return; if (e.target.closest('.window-menu') || e.target.closest('#toolbar')) return;
    const type = e.dataTransfer.getData('text/plain');
    if (type && window.player.inventory[type] > 0) { 
        let amt = window.player.inventory[type]; let ni = { id: Math.random().toString(36).substring(2,9), x: window.player.x + window.player.width/2 + (Math.random() * 10 - 5), y: window.player.y - 20 + (Math.random() * 10 - 5), vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 1) * 3 - 1, type: type, amount: amt, life: 1.0 };
        window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', { item: ni }); window.player.inventory[type] = 0; if(window.updateUI) window.updateUI(); 
    }
});

window.tryHitEntity = function(pCX, pCY, dmg, meleeRange) {
    const range = meleeRange || window.player.miningRange;
    for (let i = window.entities.length - 1; i >= 0; i--) {
        let ent = window.entities[i];
        // Usar distancia directa al jugador, sin requerir que el cursor esté sobre la entidad
        const dist = Math.hypot(pCX - (ent.x + ent.width/2), pCY - (ent.y + ent.height/2));
        if (dist <= range) {
                ent.hp -= dmg; window.setHit(ent); window.spawnParticles(ent.x + ent.width/2, ent.y + ent.height/2, '#ff4444', 5);
                if (window.playSound) window.playSound('hit_entity');
                window.spawnDamageText(ent.x+ent.width/2+(Math.random()-0.5)*16, ent.y-5-Math.random()*8, `-${dmg}`, 'melee');
                ent.vx = (ent.x+ent.width/2 > pCX ? 1 : -1) * 3.5; ent.vy = -5.0; ent.knockbackFrames = 10;
                window.player.meleeCooldown = 18;
                if (ent.hp <= 0) { 
                    window.killedEntities.push(ent.id); window.sendWorldUpdate('kill_entity', { id: ent.id }); window.spawnParticles(ent.x, ent.y, '#ff4444', 15); 
                    if (ent.type === 'spider') { let ni = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:0, vy:-1, type:'web', amount:2, life:1.0}; window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni}); window.gainXP(20 * ent.level); }
                    else if (ent.type === 'chicken') { let ni = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:0, vy:-1, type:'meat', amount:1, life:1.0}; window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni}); window.gainXP(10); }
                    else if (ent.type === 'zombie') { let ni = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:0, vy:-1, type:'meat', amount:2, life:1.0}; window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni}); window.gainXP(50 * ent.level); }
                    else if (ent.type === 'archer') { let ni1 = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:-1, vy:-1, type:'arrows', amount:2+Math.floor(Math.random()*4), life:1.0}; window.droppedItems.push(ni1); window.sendWorldUpdate('drop_item', {item:ni1}); let ni2 = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:1, vy:-1, type:'wood', amount:3, life:1.0}; window.droppedItems.push(ni2); window.sendWorldUpdate('drop_item', {item:ni2}); window.gainXP(40 * ent.level); }
                    window.entities.splice(i, 1); if(window.updateUI) window.updateUI(); 
                } else { window.sendWorldUpdate('hit_entity', { id: ent.id, dmg: dmg }); if (ent.type === 'chicken') { ent.fleeTimer = 180; ent.fleeDir = (ent.x > pCX) ? 1 : -1; window.sendWorldUpdate('flee_entity', { id: ent.id, dir: ent.fleeDir }); } }
                return true; 
        }
    } return false;
};

window.tryHitBlock = function(pCX, pCY, dmg, meleeRange) {
    const range = meleeRange || window.player.miningRange;
    let clickedBlockIndex = -1;
    for (let i = window.blocks.length - 1; i >= 0; i--) { let b = window.blocks[i], h = b.type === 'door' ? window.game.blockSize * 2 : window.game.blockSize; if (window.mouseWorldX >= b.x && window.mouseWorldX <= b.x + window.game.blockSize && window.mouseWorldY >= b.y && window.mouseWorldY <= b.y + h) { clickedBlockIndex = i; break; } }
    if (clickedBlockIndex !== -1) {
        let b = window.blocks[clickedBlockIndex], h = b.type === 'door' ? window.game.blockSize * 2 : window.game.blockSize;
        if (Math.hypot(pCX - (b.x + window.game.blockSize/2), pCY - (b.y + h/2)) <= range) {
            b.hp -= dmg; window.setHit(b); window.spawnParticles(window.mouseWorldX, window.mouseWorldY, '#ff4444', 5);
            if (window.playSound) window.playSound('hit_block');
            if (b.hp <= 0) { window.destroyBlockLocally(b); } else { window.sendWorldUpdate('hit_block', { x: b.x, y: b.y, dmg: dmg }); }
            window.player.meleeCooldown = Math.max(22, 45 - Math.floor((window.player.stats.agi||0) * 3));
            return true;
        }
    } return false;
};

window.tryHitRock = function(pCX, pCY, dmg, meleeRange) {
    const range = meleeRange || window.player.miningRange;
    // Dirección del golpe: del jugador hacia el cursor del mouse
    const swingAngle = Math.atan2(window.mouseWorldY - pCY, window.mouseWorldX - pCX);
    const halfArc = Math.PI * 0.55; // arco de ~110° (±55° del eje del golpe)

    for (let i = window.rocks.length - 1; i >= 0; i--) {
        const r = window.rocks[i];
        const rFY = window.getGroundY ? window.getGroundY(r.x + r.width/2) : (r.y + r.height);
        const rTopY = rFY - r.height;
        const rCX = r.x + r.width / 2;
        const rCY = rTopY + r.height / 2;

        const dist = Math.hypot(pCX - rCX, pCY - rCY);
        if (dist > range) continue;

        // Verificar que la roca esté dentro del arco de golpe
        const angleToRock = Math.atan2(rCY - pCY, rCX - pCX);
        let angleDiff = Math.abs(angleToRock - swingAngle);
        if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
        if (angleDiff > halfArc) continue;

        r.hp -= dmg; window.setHit(r); window.spawnParticles(rCX, rCY, '#fff', 8); 
        if (window.playSound) window.playSound('hit_rock');
        window.spawnDamageText(rCX + (Math.random()-0.5)*16, rCY - Math.random()*8, `-${dmg}`, 'melee');
        if (r.hp <= 0) { 
            window.sendWorldUpdate('destroy_rock', { x: r.x }); window.spawnParticles(rCX, rTopY + 15, '#888', 20, 1.5); 
            let ni = { id: Math.random().toString(36).substring(2,9), x:rCX, y:rTopY+15, vx:(Math.random()-0.5)*3, vy:-2, type:'stone', amount:15 + Math.floor(Math.random()*10), life:1.0}; window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni}); window.rocks.splice(i, 1); window.gainXP(25); 
        } else { window.sendWorldUpdate('hit_rock', { x: r.x, dmg: dmg }); }
        window.player.meleeCooldown = Math.max(22, 45 - Math.floor((window.player.stats.agi||0) * 3));
        return true;
    } return false;
};

window.tryHitTree = function(pCX, pCY, dmg, meleeRange) {
    const range = meleeRange || window.player.miningRange;
    // Dirección del golpe: del jugador hacia el cursor del mouse
    const swingAngle = Math.atan2(window.mouseWorldY - pCY, window.mouseWorldX - pCX);
    const halfArc = Math.PI * 0.55; // arco de ~110°

    for (let i = window.trees.length - 1; i >= 0; i--) {
        const t = window.trees[i];
        const tFootY = window.getGroundY ? window.getGroundY(t.x + t.width/2) : (t.groundY || t.y + t.height);
        const tCX = t.x + t.width / 2;
        // Centro de golpe: parte baja del árbol (tronco), accesible desde el suelo
        const tHitY = t.isStump ? tFootY - 40 : tFootY - Math.min(t.height * 0.35, range * 0.6);

        const dist = Math.hypot(pCX - tCX, pCY - tHitY);
        if (dist > range) continue;

        // Verificar arco de golpe
        const angleToTree = Math.atan2(tHitY - pCY, tCX - pCX);
        let angleDiff = Math.abs(angleToTree - swingAngle);
        if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
        if (angleDiff > halfArc) continue;

        t.hp -= dmg; window.setHit(t); window.spawnParticles(tCX, tHitY, '#c8a96b', 8); 
        if (window.playSound) window.playSound('hit_tree');
        window.spawnDamageText(tCX + (Math.random()-0.5)*16, tHitY - Math.random()*8, `-${dmg}`, 'melee');
        if (t.hp <= 0) {
            if (t.isStump || t.regrowthCount >= 3) {
                window.spawnParticles(tCX, tFootY, '#C19A6B', 15, 1.2); 
                let ni = { id: Math.random().toString(36).substring(2,9), x:tCX, y:tFootY-10, vx:(Math.random()-0.5)*3, vy:-2, type:'wood', amount: (t.isStump ? 4 : 6), life:1.0}; 
                window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni}); window.sendWorldUpdate('destroy_tree', { x: t.x }); window.trees.splice(i, 1); window.gainXP(5); 
            } else {
                window.spawnParticles(tCX, tFootY - 20, '#2E8B57', 20, 1.5); 
                let ni = { id: Math.random().toString(36).substring(2,9), x:tCX, y:tFootY-30, vx:(Math.random()-0.5)*3, vy:-2, type:'wood', amount:10, life:1.0}; 
                window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni}); t.isStump = true; t.hp = 50; t.maxHp = 50; window.sendWorldUpdate('stump_tree', { x: t.x, regrowthCount: t.regrowthCount, grownDay: t.grownDay }); window.gainXP(15);
            }
        } else { window.sendWorldUpdate('hit_tree', { x: t.x, dmg: dmg }); }
        window.player.meleeCooldown = Math.max(22, 45 - Math.floor((window.player.stats.agi||0) * 3));
        return true;
    } return false;
};

// --- NUEVA FUNCIÓN MAESTRA DE AUTO-ATAQUE / CONSTRUCCIÓN ---
window.attemptAction = function() {
    if (!window.player || window.player.isDead || document.querySelector('.window-menu.open')) return;
    if (window.player.placementMode) return;
    if (window.player.activeTool === 'bow') return;
    if ((window.player.meleeCooldown || 0) > 0) return; 

    window.player.attackFrame = 28; 
    const pCX = window.player.x + window.player.width / 2;
    const pCY = window.player.y + window.player.height / 2; 
    const baseDmg = typeof window.getMeleeDamage === 'function' ? window.getMeleeDamage() : (window.player.baseDamage[window.player.activeTool] || 9); 
    const tool = window.player.activeTool; 
    let actionDone = false;

    // Rango de MELEE: corto, para combate y tala/minería cercana
    // Rango de CONSTRUCCIÓN (miningRange) se mantiene intacto para el martillo
    const meleeRange = 80 + (window.player.stats.str || 0) * 2; // ~80px base, crece con STR

    let entityDmg = tool === 'hammer' ? 0 : Math.max(1, Math.floor(tool === 'pickaxe' ? baseDmg * 0.3 : (tool === 'axe' ? baseDmg * 0.6 : baseDmg)));
    let treeDmg = tool === 'axe' ? Math.floor(baseDmg * 1.5) : (tool === 'sword' ? Math.floor(baseDmg * 0.25) : (tool === 'hand' ? baseDmg : 0));
    let rockDmg = tool === 'pickaxe' ? Math.floor(baseDmg * 3) : (tool === 'hammer' ? 0 : 1);
    let blockDmg = tool === 'hammer' ? Math.floor(baseDmg * 3) : (tool === 'sword' ? Math.max(1, Math.floor(baseDmg * 0.2)) : baseDmg);

    // Aplicar cooldown base para evitar que hacer "clic al aire" ocurra 60 veces por segundo
    window.player.meleeCooldown = Math.max(22, 45 - Math.floor((window.player.stats.agi||0) * 3));

    if (entityDmg > 0 && window.tryHitEntity(pCX, pCY, entityDmg, meleeRange)) actionDone = true;
    if (!actionDone && blockDmg > 0 && window.tryHitBlock(pCX, pCY, blockDmg, meleeRange)) actionDone = true;
    if (!actionDone && rockDmg > 0 && window.tryHitRock(pCX, pCY, rockDmg, meleeRange)) actionDone = true;
    if (!actionDone && treeDmg > 0 && window.tryHitTree(pCX, pCY, treeDmg, meleeRange)) actionDone = true;

    if (!actionDone && tool === 'hammer') {
        // La cuadrícula se alinea al terreno local: como getGroundY ya snapea a blockSize,
        // simplemente snapeamos X e Y a múltiplos de blockSize.
        const bs = window.game.blockSize;
        const gridX = Math.floor(window.mouseWorldX / bs) * bs;
        const gridY = Math.floor(window.mouseWorldY / bs) * bs;
        const isDoorMode = window.player.buildMode === 'door'; 
        const itemHeight = isDoorMode ? window.game.blockSize * 2 : window.game.blockSize; 
        const cost = isDoorMode ? 4 : 2; 
        if (Math.hypot(pCX - (gridX + window.game.blockSize/2), pCY - (gridY + itemHeight/2)) <= window.player.miningRange) {
            if (window.player.inventory.wood >= cost) {
                if (window.isValidPlacement(gridX, gridY, window.game.blockSize, itemHeight, true, true)) {
                    let newB = { x: gridX, y: gridY, type: isDoorMode ? 'door' : 'block', open: false, hp: 300, maxHp: 300, isHit: false };
                    window.blocks.push(newB); window.sendWorldUpdate('place_block', { block: newB }); window.player.inventory.wood -= cost; window.spawnParticles(gridX + 15, gridY + 15, '#D2B48C', 5, 0.5); if (window.playSound) window.playSound('build'); if(window.updateUI) window.updateUI();
                } else { 
                    if (window.game.frameCount % 30 === 0) window.spawnDamageText(window.mouseWorldX, window.mouseWorldY - 10, "Lugar Inválido", '#ffaa00'); 
                }
            } else { 
                if (window.game.frameCount % 30 === 0) window.spawnDamageText(window.mouseWorldX, window.mouseWorldY - 10, `Faltan ${cost} Mad.`, '#ff4444'); 
            }
        }
    }
    if(actionDone && window.useTool) window.useTool();
};

window.addEventListener('mousedown', (e) => {
    if (!window.game || !window.game.isRunning || !window.player || window.player.isDead || document.querySelector('.window-menu.open')) return;
    if (e.target.closest('#global-chat-log') || e.target.closest('.log-msg') || e.target.closest('#chat-container')) return;

    if (e.button === 0) {
        if (!window.keys) window.keys = {};
        window.keys.mouseLeft = true;
    }

    if (window.player.placementMode) {
        if (e.button === 2) { window.player.placementMode = null; return; } 
        if (e.button === 0) {
            const bs2 = window.game.blockSize;
            const gridX = Math.floor(window.mouseWorldX / bs2) * bs2;
            const gridY = Math.floor(window.mouseWorldY / bs2) * bs2;
            if (Math.hypot((window.player.x + window.player.width/2) - (gridX + window.game.blockSize/2), (window.player.y + window.player.height/2) - (gridY + window.game.blockSize/2)) <= window.player.miningRange) {
                let type = window.player.placementMode === 'boxes' ? 'box' 
                         : window.player.placementMode === 'bed_item' ? 'bed' 
                         : window.player.placementMode === 'barricade_item' ? 'barricade'
                         : window.player.placementMode === 'ladder_item' ? 'ladder'
                         : 'campfire';
                // Escalera: validación especial — solo sobre suelo, block, o otra escalera
                let validPlace = false;
                if (type === 'ladder') {
                    const localGY = window.getGroundY ? window.getGroundY(gridX + bs2/2) : window.game.groundLevel;
                    const onGround = Math.abs((gridY + bs2) - localGY) <= bs2;
                    const onBlock = window.blocks.some(b => (b.type === 'block' || b.type === 'ladder') && Math.abs(b.x - gridX) < 1 && Math.abs(b.y - (gridY + bs2)) < bs2/2);
                    const noPlayerOverlap = !window.checkRectIntersection(gridX, gridY, bs2, bs2, window.player.x, window.player.y, window.player.width, window.player.height);
                    validPlace = (onGround || onBlock) && noPlayerOverlap;
                } else {
                    validPlace = window.isValidPlacement(gridX, gridY, window.game.blockSize, window.game.blockSize, true, false);
                }
                if (validPlace) {
                    let newB = { x: gridX, y: gridY, type: type, hp: type === 'barricade' ? 150 : (type === 'ladder' ? 50 : 200), maxHp: type === 'barricade' ? 150 : (type === 'ladder' ? 50 : 200), isHit: false };
                    if (type === 'box') newB.inventory = {wood:0, stone:0, meat:0, web:0, arrows:0, cooked_meat:0};
                    if (type === 'campfire') { newB.wood = 0; newB.meat = 0; newB.cooked = 0; newB.isBurning = false; newB.burnTime = 0; newB.cookTimer = 0; }
                    if (type === 'bed') { window.blocks = window.blocks.filter(b => b.type !== 'bed' || b.owner !== window.player.name); newB.owner = window.player.name; window.player.bedPos = { x: gridX, y: gridY }; window.spawnDamageText(gridX + 15, gridY - 10, "Punto Respawn", '#4CAF50'); window.sendWorldUpdate('remove_old_bed', { owner: window.player.name }); }
                    window.blocks.push(newB); window.sendWorldUpdate('place_block', { block: newB }); window.player.inventory[window.player.placementMode]--; window.spawnParticles(gridX+15, gridY+15, '#fff', 10); if (window.playSound) window.playSound('build');
                    if (window.player.inventory[window.player.placementMode] <= 0) { window.player.toolbar[window.player.activeSlot] = null; window.selectToolbarSlot(0); }
                    if(window.updateUI) window.updateUI(); if(window.renderToolbar) window.renderToolbar();
                } else { window.spawnDamageText(window.mouseWorldX, window.mouseWorldY - 10, "Lugar Inválido", '#ffaa00'); }
            }
        } return;
    }

    if (window.player.activeTool === 'bow') { 
        if (e.button === 2) window.player.isAiming = true; 
        if (e.button === 0 && window.player.isAiming && window.player.inventory.arrows > 0) window.player.isCharging = true; 
        return; 
    }
    
    // Disparo inmediato para evitar lag visual al hacer clic simple
    if (e.button === 0) {
        window.attemptAction();
    }
});

window.addEventListener('mouseup', (e) => {
    if (!window.game || !window.game.isRunning || window.player.isDead) return;
    if (e.button === 0 && window.keys) window.keys.mouseLeft = false;

    if (window.player.activeTool === 'bow') {
        if (e.button === 2) { window.player.isAiming = false; window.player.isCharging = false; window.player.chargeLevel = 0; }
        if (e.button === 0 && window.player.isCharging) {
            if (window.player.chargeLevel > 5 && window.player.inventory.arrows > 0) {
                window.player.inventory.arrows--;
                let pCX = window.player.x + window.player.width/2; let pCY = window.player.y + 6; let dx = window.mouseWorldX - pCX, dy = window.mouseWorldY - pCY; let angle = Math.atan2(dy, dx); let power = 4 + (window.player.chargeLevel / 100) * 6; 
                let newArrow = { x: pCX, y: pCY, vx: Math.cos(angle)*power, vy: Math.sin(angle)*power, life: 250, damage: window.getBowDamage(), isEnemy: false, owner: window.socket?.id }; 
                window.projectiles.push(newArrow); window.sendWorldUpdate('spawn_projectile', newArrow); if (window.playSound) window.playSound('arrow_shoot'); if(window.useTool) window.useTool();
            }
            window.player.isCharging = false; window.player.chargeLevel = 0; if(window.updateUI) window.updateUI();
        }
    }
});

window.addEventListener('wheel', (e) => {
    if (!window.game || !window.game.isRunning || !window.player || window.player.isDead) return;
    // Ctrl / Meta + scroll → Zoom (siempre, incluso en placement)
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        let delta = e.deltaY > 0 ? -0.1 : 0.1;
        window.game.zoomTarget = Math.min(window.game.maxZoom, Math.max(window.game.minZoom, (window.game.zoomTarget || 1) + delta));
        return;
    }

    let dir = Math.sign(e.deltaY);

    // En modo de colocación: scroll cambia de slot y actualiza el item a colocar
    if (window.player.placementMode) {
        e.preventDefault();
        // Cambiar al siguiente slot con item colocable
        const placeableItems = ['boxes', 'campfire_item', 'bed_item', 'barricade_item', 'ladder_item'];
        let nextSlot = window.player.activeSlot;
        for (let tries = 0; tries < 6; tries++) {
            nextSlot = (nextSlot + (dir > 0 ? 1 : -1) + 6) % 6;
            const toolInSlot = window.player.toolbar[nextSlot];
            if (toolInSlot && placeableItems.includes(toolInSlot) && window.player.inventory[toolInSlot] > 0) {
                window.selectToolbarSlot(nextSlot);
                window.player.placementMode = toolInSlot;
                if(window.renderToolbar) window.renderToolbar();
                break;
            } else if (!toolInSlot) {
                // Slot vacío: cancelar colocación
                window.player.placementMode = null;
                window.selectToolbarSlot(nextSlot);
                if(window.renderToolbar) window.renderToolbar();
                break;
            }
        }
        return;
    }

    // Scroll normal → cambiar slot toolbar
    if (dir > 0) window.player.activeSlot = (window.player.activeSlot + 1) % 6; else if (dir < 0) window.player.activeSlot = (window.player.activeSlot - 1 + 6) % 6;
    if(window.selectToolbarSlot) window.selectToolbarSlot(window.player.activeSlot); if(window.renderToolbar) window.renderToolbar();
}, { passive: false });

function update() {
    try {
        if (!window.game || !window.game.isRunning || !window.canvas || !window.player) return;
        const bs = window.game.blockSize; // ← disponible en todo update() incl. el loop de IA
        let pCX = window.player.x + window.player.width/2; let pCY = window.player.y + window.player.height/2;

        // Recalcular coordenadas de mundo del mouse cada frame usando la posición de cámara actual.
        // Esto es esencial para que la mira del arco no se mueva al desplazarse la cámara.
        {
            const _W = window._canvasLogicW || 1280; const _H = window._canvasLogicH || 720;
            const _z = window.game.zoom || 1;
            window.mouseWorldX = (window.screenMouseX - _W/2) / _z + window.camera.x + _W/2;
            window.mouseWorldY = (window.screenMouseY - _H/2) / _z + window.camera.y + _H/2;
        }

        window.game.frameCount++;
        if (window.game.screenShake > 0) window.game.screenShake--;
        if (window.player.attackFrame > 0) window.player.attackFrame--;
        if ((window.player.meleeCooldown||0) > 0) window.player.meleeCooldown--;
        
        if (window.game.frameCount % 60 === 0 && !window.player.isDead) {
            if (window.player.activeTool === 'torch' && window.player.toolHealth && window.player.toolHealth['torch']) {
                window.player.toolHealth['torch']--; if (window.renderToolbar) window.renderToolbar(); 
                if (window.player.toolHealth['torch'] <= 0) { window.player.toolbar[window.player.activeSlot] = null; window.selectToolbarSlot(0); window.spawnDamageText(pCX, window.player.y - 20, "¡Antorcha Apagada!", '#ff4444'); if (window.renderToolbar) window.renderToolbar(); }
            }
        }

        if (window.player.isCharging) { window.player.chargeLevel += 1.0 * (1 + window.player.stats.agi * 0.2); if (window.player.chargeLevel > 100) window.player.chargeLevel = 100; }
        
        let currentUptime = window.game.serverStartTime ? (Date.now() - window.game.serverStartTime) : (window.game.frameCount * (1000/60));
        let totalFrames = Math.floor(currentUptime / (1000 / 60)) + 28800; let dayFloat = totalFrames / 86400; window.game.days = Math.floor(dayFloat) + 1; 
        let hourFloat = (totalFrames / 3600) % 24; let clockH = Math.floor(hourFloat); let clockM = Math.floor((totalFrames % 3600) / 60);
        let isNight = hourFloat >= 23 || hourFloat < 5; let isDay = hourFloat >= 6 && hourFloat < 18;

        let dailySeed = Math.sin(window.game.days * 8765.4); let nSeed = (dailySeed + 1) / 2; window.game.isRaining = false;
        if (nSeed > 0.65) { let rainStart = 9 + (nSeed * 4); let rainDuration = 1 + (nSeed * 1.5); window.game.isRaining = isDay && (hourFloat >= rainStart && hourFloat <= (rainStart + rainDuration)); }

        if (isNaN(window.player.vx) || !isFinite(window.player.vx)) window.player.vx = 0; if (isNaN(window.player.vy) || !isFinite(window.player.vy)) window.player.vy = 0;
        if (!window.player.isAiming && window.player.attackFrame <= 0 && !window.player.isDead) { if (window.player.vx > 0.1) window.player.facingRight = true; else if (window.player.vx < -0.1) window.player.facingRight = false; }

        if (window.player.isDead) { window.player.vx = 0; window.player.isStealth = false; let pO = window.getEl('placement-overlay'); if(pO) pO.style.display = 'none'; } 
        else if (window.keys && window.keys.shift) { window.player.wantsBackground = true; } else { window.player.wantsBackground = false; }
        
        if (!window.player.isDead && !window.player.wantsBackground) { if (!window.isOverlappingSolidBlock()) window.player.inBackground = false; } else if (!window.player.isDead) { window.player.inBackground = true; }

        if (!window.player.isDead) {
            let pO = window.getEl('placement-overlay'); if (window.player.placementMode) { if(pO) pO.style.display = 'block'; } else { if(pO) pO.style.display = 'none'; }
            const accel = window.player.isGrounded ? 0.6 : 0.4; const fric = window.player.isGrounded ? 0.8 : 0.95; 
            if (window.keys && window.keys.a) window.player.vx -= accel; if (window.keys && window.keys.d) window.player.vx += accel;
            window.player.vx *= fric; if (window.player.vx > window.player.speed) window.player.vx = window.player.speed; if (window.player.vx < -window.player.speed) window.player.vx = -window.player.speed;
        }

        let isMoving = Math.abs(window.player.vx) > 0.2 || !window.player.isGrounded; window.player.isStealth = window.player.inBackground && !isMoving && window.player.attackFrame <= 0 && !window.player.isDead;
        
        let timeText = `${clockH.toString().padStart(2, '0')}:${clockM.toString().padStart(2, '0')}`; let cDisp = window.getEl('clock-display');
        if (cDisp) { if (window.player.isStealth) { cDisp.innerText = `[OCULTO] Día ${window.game.days} - ${timeText}`; cDisp.classList.add('stealth-mode'); } else { cDisp.innerText = `Día ${window.game.days} - ${timeText}`; cDisp.classList.remove('stealth-mode'); } }

        let distMeters = Math.max(0, Math.floor((window.player.x - window.game.shoreX) / 10)); let dTxt = window.getEl('dist-text'); if(dTxt) dTxt.innerText = `${distMeters}m`;

        if (Math.abs(window.player.vx) > 0.5 && window.player.isGrounded) window.player.animTime += Math.abs(window.player.vx) * 0.025; else window.player.animTime = 0; 

        window.player.x += window.player.vx; if (window.player.x < window.game.shoreX) { window.player.x = window.game.shoreX; if (window.player.vx < 0) window.player.vx = 0; }
        window.checkBlockCollisions('x');

        // === ESCALERA: si el jugador está sobre una, cancelar gravedad y trepar con W ===
        const _onLadder = !window.player.isDead && window.isOnLadder();
        if (_onLadder) {
            window.player.vy = 0; // cancelar gravedad mientras esté en la escalera
            if (window.keys && window.keys.jumpPressed) {
                window.player.vy = -3.5; // subir escalera
            }
            window.player.isGrounded = false; // no cuenta como suelo (sigue en escalera)
            window.player.isJumping = false;
            window.player.coyoteTime = 10; // puede saltar desde escalera
        } else {
            window.player.vy += window.game.gravity;
        }
        window.player.isGrounded = false; window.player.y += window.player.vy; window.checkBlockCollisions('y');
        let _pGroundY = window.getGroundY ? window.getGroundY(window.player.x + window.player.width / 2) : window.game.groundLevel;
        if (window.player.y + window.player.height >= _pGroundY) { window.player.y = _pGroundY - window.player.height; window.player.vy = 0; window.player.isGrounded = true; }
        if (window.player.isGrounded || _onLadder) { window.player.coyoteTime = 10; window.player.isJumping = false; } else window.player.coyoteTime--;
        if (window.keys && window.keys.jumpPressed && window.player.jumpKeyReleased && window.player.coyoteTime > 0 && !window.player.isJumping && !window.player.isDead && !_onLadder) { window.player.vy = window.player.jumpPower; window.player.isJumping = true; window.player.coyoteTime = 0; window.player.jumpKeyReleased = false; }
        if (window.keys && !window.keys.jumpPressed && window.player.vy < 0 && !_onLadder) window.player.vy *= 0.5;

        // EJECUTAR AUTO-ATAQUE SI SE MANTIENE EL CLIC
        if (window.keys && window.keys.mouseLeft && !window.player.isDead) {
            window.attemptAction();
        }

        if (window.game.isMultiplayer) {
            if (window.socket && (window.game.frameCount % 2 === 0 || window.player.attackFrame > 0 || window.player.isAiming || window.player.isDead || window.player.isTyping !== window.player._lastTypingState)) {
                window.socket.emit('playerMovement', { x: window.player.x, y: window.player.y, vx: window.player.vx, vy: window.player.vy, facingRight: window.player.facingRight, activeTool: window.player.activeTool, animTime: window.player.animTime, attackFrame: window.player.attackFrame, isAiming: window.player.isAiming, isCharging: window.player.isCharging, chargeLevel: window.player.chargeLevel, mouseX: window.mouseWorldX, mouseY: window.mouseWorldY, isDead: window.player.isDead, level: window.player.level, isTyping: window.player.isTyping || false });
                window.player._lastTypingState = window.player.isTyping;
            }
            if (window.otherPlayers) {
                Object.values(window.otherPlayers).forEach(op => {
                    if (op.targetX !== undefined) {
                        op.x += (op.targetX - op.x) * 0.35;
                        op.y += (op.targetY - op.y) * 0.35;
                    }
                });
            }
        }

        window.blocks = window.blocks.filter(b => { if (b.type === 'grave' && Date.now() - b.createdAt > 300000) { window.spawnParticles(b.x + 15, b.y + 15, '#7f8c8d', 15); window.sendWorldUpdate('destroy_grave', { id: b.id }); return false; } return true; });

        window.blocks.forEach(b => {
            if (b.type === 'campfire' && b.isBurning) {
                b.burnTime--; if (window.game.frameCount % 5 === 0) window.spawnParticles(b.x+15, b.y+10, '#e67e22', 1, 0.5); 
                if (b.meat > 0) { b.cookTimer++; if (b.cookTimer > 300) { b.meat--; b.cooked++; b.cookTimer = 0; if (window.currentCampfire === b && typeof window.renderCampfireUI==='function') window.renderCampfireUI(); } }
                if (window.game.isRaining) {
                    let hasRoof = window.blocks.some(roof => (roof.type === 'block' || roof.type === 'door') && roof.x === b.x && roof.y < b.y);
                    if (!hasRoof) { b.rainExtinguishTimer = (b.rainExtinguishTimer || 0) + 1; if (b.rainExtinguishTimer > 150) { b.isBurning = false; b.rainExtinguishTimer = 0; window.spawnParticles(b.x+15, b.y+15, '#aaaaaa', 10, 0.5); if (window.currentCampfire === b && typeof window.renderCampfireUI==='function') window.renderCampfireUI(); if (window.sendWorldUpdate) window.sendWorldUpdate('update_campfire', { x: b.x, y: b.y, wood: b.wood, meat: b.meat, cooked: b.cooked, isBurning: false }); } } else { b.rainExtinguishTimer = 0; }
                } else { b.rainExtinguishTimer = 0; }
                if (b.burnTime <= 0) { if (b.wood > 0) { b.wood--; b.burnTime = 1800; } else { b.isBurning = false; } if (window.currentCampfire === b && typeof window.renderCampfireUI==='function') window.renderCampfireUI(); }
            }
            if (b.type === 'barricade') {
                window.entities.forEach(ent => {
                    if (window.checkRectIntersection(ent.x, ent.y, ent.width, ent.height, b.x, b.y, window.game.blockSize, window.game.blockSize)) {
                        if (window.game.frameCount % 30 === 0) { ent.hp -= 5; b.hp -= 10; window.setHit(ent); window.setHit(b); window.spawnParticles(ent.x + ent.width/2, ent.y + ent.height/2, '#ff4444', 5); window.spawnParticles(b.x + 15, b.y + 15, '#bdc3c7', 3); if (b.hp <= 0) { window.destroyBlockLocally(b); } else { window.sendWorldUpdate('hit_block', { x: b.x, y: b.y, dmg: 10 }); } }
                    }
                });
            }
        });

        for (let i = window.stuckArrows.length - 1; i >= 0; i--) {
            let sa = window.stuckArrows[i];
            sa.life--;
            if (sa.blockX !== undefined && sa.blockX !== null) {
                let stillExists = window.blocks.some(b => b.x === sa.blockX && b.y === sa.blockY);
                if (!stillExists) sa.life = 0; 
            }
            if (sa.life <= 0) window.stuckArrows.splice(i, 1);
        }

        let anyItemHovered = false; let interactables = window.blocks.filter(b => (b.type === 'box' || b.type === 'campfire' || b.type === 'door' || b.type === 'grave') && window.checkRectIntersection(window.player.x - 15, window.player.y - 15, window.player.width + 30, window.player.height + 30, b.x, b.y, window.game.blockSize, b.type==='door'?window.game.blockSize*2:window.game.blockSize));
        let promptEl = window.getEl('interaction-prompt'); let textEl = window.getEl('prompt-text');
        
        window.player.nearbyItem = null;
        for (let i = window.droppedItems.length - 1; i >= 0; i--) {
            let item = window.droppedItems[i]; let s = window.itemDefs[item.type].size; let d = Math.hypot(pCX - item.x, pCY - item.y);
            if (window.keys && window.keys.y && d < 250 && !window.player.isDead) {
                item.x += (pCX - item.x) * 0.15; item.y += (pCY - item.y) * 0.15; item.vy = 0;
                if (d < 25) { 
                    if (window.canAddItem(item.type, item.amount)) { window.player.inventory[item.type] = (window.player.inventory[item.type]||0) + item.amount; window.droppedItems.splice(i, 1); window.sendWorldUpdate('pickup_item', { id: item.id }); if (window.playSound) window.playSound('pickup'); if (window.toolDefs[item.type]) { if(typeof window.autoEquip==='function') window.autoEquip(item.type); } window.spawnParticles(pCX, pCY, window.itemDefs[item.type].color, 5); if(typeof window.updateUI==='function') window.updateUI(); continue; } else { if (window.game.frameCount % 60 === 0) window.spawnDamageText(pCX, pCY - 30, "Inv. Lleno", '#fff'); }
                }
            } else {
                item.vy += window.game.gravity * 0.5; item.x += item.vx; item.y += item.vy; item.vx *= 0.95; 
                let _itemGY = window.getGroundY ? window.getGroundY(item.x) : window.game.groundLevel;
                if (item.y + s >= _itemGY) { item.y = _itemGY - s; item.vy *= -0.5; item.vx *= 0.8; }
                for (let b of window.blocks) { if ((b.type === 'door' && b.open) || b.type === 'box' || b.type === 'campfire' || b.type === 'bed' || b.type === 'barricade') continue; let itemHeight = b.type === 'door' ? window.game.blockSize * 2 : window.game.blockSize; if (window.checkRectIntersection(item.x, item.y, s, s, b.x, b.y, window.game.blockSize, itemHeight)) { if (item.vy > 0 && item.y + s - item.vy <= b.y) { item.y = b.y - s; item.vy *= -0.5; item.vx *= 0.8; } } }
                if (d < 60 && !window.player.isDead) { anyItemHovered = true; window.player.nearbyItem = item; }
            }
            item.life += 0.05;
        }

        let hoveringArrow = window.stuckArrows.find(sa => Math.hypot(pCX - sa.x, pCY - sa.y) < 60);

        if (promptEl && textEl) {
            if (interactables.length > 0 && !document.querySelector('.window-menu.open') && !window.player.isDead) {
                let hoveringInteractable = interactables[0];
                if (hoveringInteractable.type !== 'bed') { promptEl.style.display = 'block'; let tName = hoveringInteractable.type === 'box' ? 'Caja' : (hoveringInteractable.type === 'campfire' ? 'Fogata' : (hoveringInteractable.type === 'grave' ? 'Tumba' : 'Puerta')); textEl.innerHTML = `Presiona <span class="key-btn">E</span> para usar <span style="color:#D2B48C;">${tName}</span>`; } else { promptEl.style.display = 'none'; }
            } else if (hoveringArrow && !window.player.isDead) { 
                promptEl.style.display = 'block'; textEl.innerHTML = `Presiona <span class="key-btn">E</span> para agarrar <strong style="color:#ccc;">Flecha</strong>`;
            } else if (anyItemHovered && !window.player.isDead && window.player.nearbyItem) {
                let type = window.player.nearbyItem.type; let itData = window.itemDefs[type] || window.toolDefs[type];
                if(itData) { let color = itData.color || '#FFD700'; let amtText = window.player.nearbyItem.amount > 1 ? ` x${window.player.nearbyItem.amount}` : ''; promptEl.style.display = 'block'; textEl.innerHTML = `Mantén <span class="key-btn">Y</span> para recoger <strong style="color:${color};">${itData.name}${amtText}</strong>`; } else { promptEl.style.display = 'none'; }
            } else { promptEl.style.display = 'none'; }
        }

        for (let i = window.projectiles.length - 1; i >= 0; i--) {
            let pr = window.projectiles[i]; pr.x += pr.vx; pr.vy += window.game.gravity * 0.4; pr.y += pr.vy; pr.angle = Math.atan2(pr.vy, pr.vx); pr.life--;
            
            let isMyArrow = (pr.owner === window.socket?.id) || (!window.game.isMultiplayer);
            let _prGroundY = window.getGroundY ? window.getGroundY(pr.x) : window.game.groundLevel;

            if(pr.y >= _prGroundY || pr.x < window.game.shoreX) { 
                if (isMyArrow && !pr.isEnemy && Math.random() < 0.5) { 
                    let newSa = { id: Math.random().toString(36).substring(2,9), x: pr.x, y: _prGroundY, angle: pr.angle, life: 18000 };
                    window.stuckArrows.push(newSa); window.sendWorldUpdate('spawn_stuck_arrow', newSa);
                } else if (isMyArrow && !pr.isEnemy) window.playSound('arrow_break');
                
                window.spawnParticles(pr.x, pr.y, '#557A27', 3); window.projectiles.splice(i, 1); continue; 
            } 
            
            let hitBlockRef = null;
            for(let b of window.blocks) { let bh = b.type === 'door' ? window.game.blockSize * 2 : window.game.blockSize; if (!b.open && window.checkRectIntersection(pr.x, pr.y, 4, 4, b.x, b.y, window.game.blockSize, bh) && b.type !== 'box' && b.type !== 'campfire' && b.type !== 'barricade') { hitBlockRef = b; break; } }
            
            if(hitBlockRef) { 
                if (isMyArrow && !pr.isEnemy && Math.random() < 0.5) { 
                    let newSa = { id: Math.random().toString(36).substring(2,9), x: pr.x, y: pr.y, angle: pr.angle, blockX: hitBlockRef.x, blockY: hitBlockRef.y, life: 18000 };
                    window.stuckArrows.push(newSa); window.sendWorldUpdate('spawn_stuck_arrow', newSa); window.playSound('arrow_stick');
                } else if (isMyArrow && !pr.isEnemy) window.playSound('arrow_break');
                
                window.spawnParticles(pr.x, pr.y, '#C19A6B', 5); window.projectiles.splice(i,1); continue; 
            }
            
            if (pr.isEnemy) {
                if (!window.player.inBackground && !window.player.isDead && window.checkRectIntersection(pr.x, pr.y, 4, 4, window.player.x, window.player.y, window.player.width, window.player.height)) { window.damagePlayer(pr.damage, 'Flecha de Cazador'); window.spawnParticles(pr.x, pr.y, '#ff4444', 5); window.projectiles.splice(i, 1); continue; }
            } else {
                let hitEnt = false;
                for(let e = window.entities.length - 1; e >= 0; e--) {
                    let ent = window.entities[e];
                    if (window.checkRectIntersection(pr.x, pr.y, 4, 4, ent.x, ent.y, ent.width, ent.height)) {
                        ent.hp -= pr.damage; window.setHit(ent); window.spawnDamageText(ent.x+ent.width/2+(Math.random()-0.5)*16, ent.y-Math.random()*8, "-"+Math.floor(pr.damage), 'melee'); window.spawnParticles(pr.x, pr.y, '#ff4444', 5); ent.vx=(pr.vx>0?1:-1)*2.0; ent.vy=-4.5; ent.knockbackFrames=8;
                        if(ent.hp <= 0) { window.killedEntities.push(ent.id); window.sendWorldUpdate('kill_entity', { id: ent.id }); window.spawnParticles(ent.x, ent.y, '#ff4444', 15); if (ent.type === 'spider') { let ni = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:0, vy:-1, type:'web', amount:2, life:1.0}; window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni}); window.gainXP(20 * ent.level); } else if (ent.type === 'chicken') { let ni = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:0, vy:-1, type:'meat', amount:1, life:1.0}; window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni}); window.gainXP(10); } else if (ent.type === 'zombie') { let ni = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:0, vy:-1, type:'meat', amount:2, life:1.0}; window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni}); window.gainXP(50 * ent.level); } else if (ent.type === 'archer') { let ni1 = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:-1, vy:-1, type:'arrows', amount:2+Math.floor(Math.random()*4), life:1.0}; window.droppedItems.push(ni1); window.sendWorldUpdate('drop_item', {item:ni1}); let ni2 = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:1, vy:-1, type:'wood', amount:3, life:1.0}; window.droppedItems.push(ni2); window.sendWorldUpdate('drop_item', {item:ni2}); window.gainXP(40 * ent.level); } window.entities.splice(e, 1); if(window.updateUI) window.updateUI(); } else { window.sendWorldUpdate('hit_entity', { id: ent.id, dmg: pr.damage }); if (ent.type === 'chicken') { ent.fleeTimer = 180; ent.fleeDir = (ent.x > pr.x) ? 1 : -1; window.sendWorldUpdate('flee_entity', { id: ent.id, dir: ent.fleeDir }); } }
                        hitEnt = true; break;
                    }
                } if(hitEnt) { window.playSound('arrow_hit_flesh'); window.projectiles.splice(i,1); continue; }
            }
            if(pr.life <= 0) window.projectiles.splice(i, 1);
        }

        let isMasterClient = true; if (window.game.isMultiplayer && window.otherPlayers) { let allIds = Object.keys(window.otherPlayers); allIds.push(window.socket?.id || ''); allIds.sort(); if (allIds[0] !== window.socket?.id) isMasterClient = false; }

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
                let newEnt = null; let _spawnGY = window.getGroundY ? window.getGroundY(cx) : window.game.groundLevel;
                if (distToShore > 3000 && Math.random() < 0.4 && window.entities.filter(e => e.type === 'archer').length < 3) { newEnt = { id: 'en_'+Math.random().toString(36).substr(2,9), type: 'archer', name: 'Cazador', level: lvl, x: cx, y: _spawnGY - 40, width: 20, height: 40, vx: (window.player.x > cx ? 0.8 : -0.8), vy: 0, hp: 30 + (lvl * 20), maxHp: 30 + (lvl * 20), damage: 8 + (lvl * 3), isHit: false, attackCooldown: 0, stuckFrames: 0, ignorePlayer: 0, lastX: cx }; } else if (window.entities.filter(e => e.type === 'zombie').length < 3) { newEnt = { id: 'en_'+Math.random().toString(36).substr(2,9), type: 'zombie', name: 'Mutante', level: lvl, x: cx, y: _spawnGY - 44, width: 24, height: 44, vx: (window.player.x > cx ? 0.4 : -0.4), vy: 0, hp: 60 + (lvl * 30), maxHp: 60 + (lvl * 30), damage: 15 + (lvl * 4), isHit: false, attackCooldown: 0, stuckFrames: 0, ignorePlayer: 0, lastX: cx }; }
                if (newEnt) { window.entities.push(newEnt); window.sendWorldUpdate('spawn_entity', { entity: newEnt }); }
            }
        }

        if (window.game.isMultiplayer && window.socket && isMasterClient && window.game.frameCount % 6 === 0 && window.entities.length > 0) { let snap = window.entities.map(e => ({ id: e.id, x: e.x, y: e.y, vx: e.vx, vy: e.vy, hp: e.hp })); window.sendWorldUpdate('sync_entities', snap); }

        let isHoldingTorch = window.player.activeTool === 'torch' && !window.player.inBackground && !window.player.isDead;

        window.entities.forEach((ent, i) => {
            if (ent.hp <= 0) {
                window.killedEntities.push(ent.id); window.sendWorldUpdate('kill_entity', { id: ent.id }); window.spawnParticles(ent.x, ent.y, '#ff4444', 15); 
                if (ent.type === 'spider') { let ni = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:0, vy:-1, type:'web', amount:2, life:1.0}; window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni}); window.gainXP(20 * ent.level); } else if (ent.type === 'chicken') { let ni = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:0, vy:-1, type:'meat', amount:1, life:1.0}; window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni}); window.gainXP(10); } else if (ent.type === 'zombie') { let ni = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:0, vy:-1, type:'meat', amount:2, life:1.0}; window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni}); window.gainXP(50 * ent.level); } else if (ent.type === 'archer') { let ni1 = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:-1, vy:-1, type:'arrows', amount:2+Math.floor(Math.random()*4), life:1.0}; window.droppedItems.push(ni1); window.sendWorldUpdate('drop_item', {item:ni1}); let ni2 = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:1, vy:-1, type:'wood', amount:3, life:1.0}; window.droppedItems.push(ni2); window.sendWorldUpdate('drop_item', {item:ni2}); window.gainXP(40 * ent.level); }
                window.entities.splice(i, 1); if(window.updateUI) window.updateUI(); return;
            }

            if ((ent.knockbackFrames||0) > 0) { ent.knockbackFrames--; if (ent.knockbackFrames === 0) ent.enragedFrames = 160; }
            if ((ent.enragedFrames||0) > 0) ent.enragedFrames--;

            let lastX = ent.x; ent.x += ent.vx; let hitWall = window.checkEntityCollisions(ent, 'x'); 
            if (ent.x < window.game.shoreX + 2000) { ent.x = window.game.shoreX + 2000; ent.vx = Math.abs(ent.vx); hitWall = true; }
            ent.vy += window.game.gravity; ent.y += ent.vy; window.checkEntityCollisions(ent, 'y'); 
            let _entGroundY = window.getGroundY ? window.getGroundY(ent.x + ent.width / 2) : window.game.groundLevel;
            if (ent.y + ent.height >= _entGroundY) { ent.y = _entGroundY - ent.height; ent.vy = 0; }
            
            let targetPlayer = window.player; let targetCX = pCX, targetCY = pCY; let minDist = Math.hypot(pCX - (ent.x + ent.width/2), pCY - (ent.y + ent.height/2));
            if (window.game.isMultiplayer && window.otherPlayers) { Object.values(window.otherPlayers).forEach(op => { if (op.isDead) return; let opCX = op.x + (op.width||24)/2; let opCY = op.y + (op.height||48)/2; let dist = Math.hypot(opCX - (ent.x + ent.width/2), opCY - (ent.y + ent.height/2)); if (dist < minDist) { minDist = dist; targetPlayer = op; targetCX = opCX; targetCY = opCY; } }); }

            if (isDay && ent.type === 'zombie') { if (window.game.frameCount % 30 === 0) { ent.hp -= 5; window.setHit(ent); window.spawnParticles(ent.x + ent.width/2, ent.y + ent.height/2, '#ffa500', 5); window.spawnDamageText(ent.x, ent.y, "-5", '#ffa500'); } }

            let repelled = false; for (let b of window.blocks) { if (b.type === 'campfire' && b.isBurning) { if (Math.hypot((ent.x+ent.width/2) - (b.x+15), (ent.y+ent.height/2) - (b.y+15)) < 150) { ent.vx = (ent.x > b.x ? 1.5 : -1.5); repelled = true; break; } } }

            if (!repelled && (ent.type === 'spider' || ent.type === 'zombie')) {
                if (ent.ignorePlayer > 0) ent.ignorePlayer--;
                let aggroRange = 180; if (isNight && !targetPlayer.isStealth) aggroRange = 600; if (ent.type === 'zombie' && !targetPlayer.isStealth) aggroRange = 800; 
                let repelledByTorch = isHoldingTorch && minDist < 250 && ent.level <= 3 && targetPlayer === window.player;
                const isGrounded = (ent.y + ent.height >= _entGroundY - 2);

                if (repelledByTorch) { ent.vx = (ent.x > targetCX) ? 1.5 : -1.5; ent.ignorePlayer = 60; } 
                else if ((ent.knockbackFrames||0) > 0) {} 
                else if (minDist < aggroRange && ent.ignorePlayer <= 0) {
                    let _spd = ent.type === 'zombie' ? 0.4 : 0.8; _spd *= ((ent.enragedFrames||0) > 0 ? 1.6 : 1.0);
                    let dirX = (targetPlayer.x > ent.x) ? 1 : -1;
                    ent.vx = dirX * _spd;

                    // --- Detección de terreno adelante: saltar si el suelo sube ---
                    if (isGrounded && window.getGroundY) {
                        const lookDist = bs * 1.5;
                        const groundHere  = window.getGroundY(ent.x + ent.width / 2);
                        const groundAhead = window.getGroundY(ent.x + ent.width / 2 + dirX * lookDist);
                        // El terreno sube más de medio bloque → saltar proactivamente
                        if (groundAhead < groundHere - bs * 0.4) {
                            ent.vy = ent.type === 'zombie' ? -7 : -9;
                            ent.stuckFrames = 0;
                        }
                    }

                    // --- Stuck fallback: saltar si bloqueado por pared o bloque ---
                    if (hitWall || Math.abs(ent.x - lastX) < 0.1) {
                        ent.stuckFrames++;
                        const hasBarricadeAhead = window.blocks.some(b => b.type === 'barricade' && Math.abs((ent.x + ent.width/2) - (b.x + window.game.blockSize/2)) < ent.width + 5 && Math.abs((ent.y + ent.height/2) - (b.y + window.game.blockSize/2)) < ent.height + 5);
                        if (ent.stuckFrames > 20 && isGrounded) {
                            // Saltar para superar el obstáculo
                            ent.vy = ent.type === 'zombie' ? -7 : -9;
                            if (ent.stuckFrames > 60 && ent.type !== 'zombie' && !hasBarricadeAhead) {
                                ent.ignorePlayer = 180; ent.vx = -dirX * _spd * 1.5; ent.stuckFrames = 0;
                            }
                        }
                    } else { ent.stuckFrames = 0; }

                    if (minDist < 40 && ent.attackCooldown <= 0 && !targetPlayer.inBackground && !targetPlayer.isDead) { if (targetPlayer === window.player) window.damagePlayer(ent.damage, ent.name); ent.attackCooldown = 150; }
                } else { if(ent.type === 'spider' && Math.random() < 0.02 && ent.ignorePlayer <= 0) ent.vx = (Math.random() > 0.5 ? 0.5 : -0.5); }
                if (ent.attackCooldown > 0) ent.attackCooldown--;
            } 
            else if (!repelled && ent.type === 'archer') {
                if (ent.ignorePlayer > 0) ent.ignorePlayer--;
                let aggroRange = (isNight && !targetPlayer.isStealth) ? 1000 : 800;
                const isGrounded = (ent.y + ent.height >= _entGroundY - 2);
                if (minDist < aggroRange && ent.ignorePlayer <= 0 && !targetPlayer.inBackground && !targetPlayer.isDead) {
                    let dirX = targetPlayer.x > ent.x ? 1 : -1;
                    // Posicionamiento: acercarse si lejos, retroceder si muy cerca, mantenerse en rango ideal
                    if (minDist > 500) ent.vx = dirX * 0.9; 
                    else if (minDist < 250) ent.vx = -dirX * 1.1; 
                    else ent.vx = 0;

                    // --- Detección de terreno adelante para el archer ---
                    if (isGrounded && window.getGroundY && ent.vx !== 0) {
                        const mvDir = ent.vx > 0 ? 1 : -1;
                        const groundHere  = window.getGroundY(ent.x + ent.width / 2);
                        const groundAhead = window.getGroundY(ent.x + ent.width / 2 + mvDir * bs * 1.5);
                        if (groundAhead < groundHere - bs * 0.4) {
                            ent.vy = -7; // saltar pendiente
                            ent.stuckFrames = 0;
                        }
                    }

                    // Stuck: saltar sobre bloque/pared
                    if (hitWall || (Math.abs(ent.x - lastX) < 0.1 && ent.vx !== 0)) {
                        ent.stuckFrames++;
                        if (ent.stuckFrames > 20 && isGrounded) { ent.vy = -7; }
                        if (ent.stuckFrames > 60) { ent.ignorePlayer = 60; ent.stuckFrames = 0; }
                    } else { ent.stuckFrames = 0; }

                    // Disparar
                    if (ent.attackCooldown <= 0 && minDist < 550) {
                        let vx_base = targetCX - (ent.x + ent.width/2); let vy_base = targetCY - (ent.y + ent.height/2);
                        let currentSpeed = Math.max(0.1, Math.hypot(vx_base, vy_base));
                        let arrowSpeed = 11; let vx = (vx_base / currentSpeed) * arrowSpeed; let vy = (vy_base / currentSpeed) * arrowSpeed;
                        let timeInAir = minDist / arrowSpeed; vy -= (timeInAir * window.game.gravity * 0.4 * 0.5); 
                        let angle = Math.atan2(vy, vx); let errorMargin = Math.max(0, 0.2 - (ent.level * 0.02)); angle += (Math.random() - 0.5) * errorMargin;
                        window.projectiles.push({ x: ent.x + ent.width/2, y: ent.y + ent.height/2, vx: Math.cos(angle)*arrowSpeed, vy: Math.sin(angle)*arrowSpeed, life: 250, damage: ent.damage, isEnemy: true, owner: ent.id });
                        ent.attackCooldown = Math.max(120, 250 - (ent.level * 10)); 
                    }
                } else { if(Math.random() < 0.02 && ent.ignorePlayer <= 0) ent.vx = (Math.random() > 0.5 ? 0.6 : -0.6); }
                if (ent.attackCooldown > 0) ent.attackCooldown--;
            }
            else if (ent.type === 'chicken') { if (ent.fleeTimer > 0) { ent.fleeTimer--; ent.vx = ent.fleeDir * 1.5; } else if(Math.random() < 0.02) { ent.vx = (Math.random() > 0.5 ? 0.3 : -0.3); } }
        });

        // Zoom suave con interpolación
        if (window.game.zoomTarget !== undefined) {
            window.game.zoom += (window.game.zoomTarget - window.game.zoom) * 0.12;
        }
        const _W = window._canvasLogicW || 1280;
        const _H = window._canvasLogicH || 720;
        // Cámara X: directa, sin lag
        window.camera.x = window.player.x + window.player.width/2 - _W/2;
        // Cámara Y estilo Terraria: jugador en el ~38% superior → más suelo visible abajo
        let idealCamY = window.player.y + window.player.height - _H * 0.62;
        if (window.camera._targetY === undefined) window.camera._targetY = idealCamY;
        // Lerp más rápido (0.18) para que la cámara no parezca trabada.
        // Si la diferencia es mayor a 200px (cambio brusco de terreno) → snap directo.
        const camDiff = idealCamY - window.camera._targetY;
        if (Math.abs(camDiff) > 200) {
            window.camera._targetY = idealCamY;
        } else {
            window.camera._targetY += camDiff * 0.18;
        }
        window.camera.y = window.camera._targetY;
        // Límite izquierdo
        if (window.camera.x < window.game.shoreX - _W/2) window.camera.x = window.game.shoreX - _W/2;
        if (window.player.x + (window._canvasLogicW / 2) > window.game.exploredRight) { window.generateWorldSector(window.game.exploredRight, window.game.exploredRight + window.game.chunkSize); window.game.exploredRight += window.game.chunkSize; }

        for (let i = window.particles.length - 1; i >= 0; i--) { let p = window.particles[i]; p.x += p.vx; p.y += p.vy; p.vy += window.game.gravity * 0.4; p.life -= p.decay; let _pGY = window.getGroundY ? window.getGroundY(p.x) : window.game.groundLevel; if (p.y >= _pGY) { p.y = _pGY; p.vy = -p.vy * 0.5; p.vx *= 0.8; } if (p.life <= 0.05 || isNaN(p.life)) window.particles.splice(i, 1); }
        for (let i = window.damageTexts.length - 1; i >= 0; i--) { let dt = window.damageTexts[i]; dt.y -= 0.2; dt.life -= 0.008; if (dt.life <= 0.05 || isNaN(dt.life)) window.damageTexts.splice(i, 1); }

        if (window.game.frameCount % 60 === 0 && !window.player.isDead) { window.player.hunger -= isMoving ? 0.1 : 0.02; if (window.player.hunger <= 0) { window.player.hunger = 0; window.damagePlayer(2, 'Hambre'); } if (window.player.hunger > 50 && window.player.hp < window.player.maxHp) { window.player.hp += 0.5; if(typeof window.updateUI==='function') window.updateUI(); } }
        
        if (typeof window.updateEntityHUD === 'function') window.updateEntityHUD();
    } catch (err) { console.error("Motor de juego protegido:", err); }
}

window.gameLoop = function() { if (window.game && window.game.isRunning) { update(); } if (typeof window.draw === 'function') { window.draw(); } requestAnimationFrame(window.gameLoop); };

window.addEventListener('DOMContentLoaded', () => { window.gameLoop(); });
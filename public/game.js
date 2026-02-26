// === game.js - MOTOR PRINCIPAL Y FÍSICAS ===

window.sendWorldUpdate = function(action, payload) {
    if (window.game.isMultiplayer && window.socket) { window.socket.emit('worldUpdate', { action: action, payload: payload }); }
};

window.spawnDustPuff = function(x, y, facingRight, isRemote) {
    if (!window.dustParticles) window.dustParticles = [];
    const count = 3;
    for (let i = 0; i < count; i++) {
        const spread = (Math.random() - 0.5) * 6;
        const speed = 0.4 + Math.random() * 0.6;
        const dir = facingRight ? -1 : 1; // humo sale al lado contrario del movimiento
        window.dustParticles.push({
            x: x + spread,
            y: y - 2 + (Math.random() - 0.5) * 4,
            vx: dir * speed * (0.6 + Math.random() * 0.8),
            vy: -(0.3 + Math.random() * 0.5),
            r: 3 + Math.random() * 3,       // radio inicial
            growRate: 0.18 + Math.random() * 0.12, // crece mientras sube
            life: 1.0,
            decay: 0.022 + Math.random() * 0.012,
            alpha: 0.28 + Math.random() * 0.18,
            gray: Math.floor(180 + Math.random() * 50), // tono grisáceo natural
        });
    }
    // Sincronizar con otros jugadores
    if (!isRemote && window.game.isMultiplayer && window.socket) {
        window.socket.emit('worldUpdate', { action: 'dust_puff', payload: { x, y, facingRight } });
    }
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
        if(window.keys) { window.keys.a = false; window.keys.d = false; window.keys.w = false; window.keys.s = false; window.keys.shift = false; window.keys.y = false; window.keys.jumpPressed = false; window.keys.mouseLeft = false; }
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
    let smoothY = window.getGroundY ? window.getGroundY(x + w/2) : window.game.groundLevel;
    let groundGridY = Math.ceil(smoothY / bs) * bs;
    
    if (y > groundGridY) return false; 
    
    // Límite de profundidad absoluta: no más de 3 bloques bajo el nivel base del suelo
    const absMaxY = window.game.baseGroundLevel + (3 * bs);
    if (y + h > absMaxY) return false;
    
    if (window.checkRectIntersection(x, y, w, h, window.player.x, window.player.y, window.player.width, window.player.height)) return false;
    if (window.game.isMultiplayer && window.otherPlayers) { for (let id in window.otherPlayers) { let op = window.otherPlayers[id]; if (window.checkRectIntersection(x, y, w, h, op.x, op.y, op.width||24, op.height||40)) return false; } }
    
    let isItem = !isStructure; let isDoor = isStructure && h > bs;

    if (isDoor) {
        const gyLeft  = Math.ceil((window.getGroundY ? window.getGroundY(x - bs / 2) : window.game.groundLevel) / bs) * bs;
        const gyRight = Math.ceil((window.getGroundY ? window.getGroundY(x + bs + bs / 2) : window.game.groundLevel) / bs) * bs;
        if (gyLeft < y + h || gyRight < y + h) return false;

        const leftBlocked  = window.blocks.some(b => !['ladder','campfire','bed','grave'].includes(b.type) && Math.abs(b.x - (x - bs)) < 1 && b.y < y + h && b.y + bs > y);
        const rightBlocked = window.blocks.some(b => !['ladder','campfire','bed','grave'].includes(b.type) && Math.abs(b.x - (x + bs)) < 1 && b.y < y + h && b.y + bs > y);
        if (leftBlocked && rightBlocked) return false;
    }

    if (isItem || isDoor) {
        let supported = false;
        if (y + h >= groundGridY) supported = true; 
        if (!supported) { for (let b of window.blocks) { if ((b.type === 'block' || b.type === 'ladder' || b.type === 'stair') && Math.abs(b.x - x) < 1 && Math.abs(b.y - (y + h)) < bs / 2) { supported = true; break; } } }
        if (!supported) return false; 
    }

    for (let b of window.blocks) { 
        if (b.type === 'ladder') continue;
        let bh = b.type === 'door' ? bs * 2 : bs; 
        // Permitir colocar un bloque directamente encima de una puerta (misma columna, y adyacente)
        if (b.type === 'door' && !isDoor && Math.abs(b.x - x) < 1 && Math.abs(b.y - (y + h)) < 1) continue;
        if (window.checkRectIntersection(x, y, w, h, b.x, b.y, bs, bh)) return false; 
        
        let isHorizontallyAdjacent = (Math.abs(x - (b.x - bs)) < 1 || Math.abs(x - (b.x + bs)) < 1);
        let isVerticallyOverlapping = (y < b.y + bh && y + h > b.y);

        if (isHorizontallyAdjacent && isVerticallyOverlapping) { if (isDoor || b.type === 'door') return false; }
        if (isDoor && b.type === 'door' && Math.abs(b.x - x) < 1 && (Math.abs(b.y - (y + h)) < 1 || Math.abs((b.y + bh) - y) < 1)) return false;

        if (isItem && (b.type === 'box' || b.type === 'campfire' || b.type === 'bed' || b.type === 'grave' || b.type === 'barricade')) { 
            if (Math.abs(b.x - x) < bs && Math.abs(b.y - (y + h)) < 1) return false; 
        }
    }
    for (let t of window.trees) { 
        const tFY = window.getGroundY ? window.getGroundY(t.x + t.width/2) : (t.groundY || t.y + t.height);
        let th = t.isStump ? 80 : t.height; let ty = tFY - th; 
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
        if ((b.type === 'door' && b.open) || b.type === 'box' || b.type === 'campfire' || b.type === 'bed' || b.type === 'grave' || b.type === 'barricade' || b.type === 'ladder' || b.type === 'stair') continue; 
        let itemHeight = b.type === 'door' ? window.game.blockSize * 2 : window.game.blockSize;
        if (window.checkRectIntersection(window.player.x, window.player.y, window.player.width, window.player.height, b.x, b.y, window.game.blockSize, itemHeight)) return true;
    } return false;
};

window.isAdjacentToBlockOrGround = function(x, y, w, h) {
    const bs = window.game.blockSize;
    let smoothY = window.getGroundY ? window.getGroundY(x + w/2) : window.game.groundLevel;
    let groundGridY = Math.ceil(smoothY / bs) * bs; 

    if (y + h >= groundGridY) return true; 
    const expX = x - 2, expY = y - 2, expW = w + 4, expH = h + 4;
    for (let b of window.blocks) { if (b.type === 'campfire' || b.type === 'bed' || b.type === 'grave') continue; let bh = b.type === 'door' ? window.game.blockSize * 2 : window.game.blockSize; if (window.checkRectIntersection(expX, expY, expW, expH, b.x, b.y, window.game.blockSize, bh)) return true; } return false;
}

window.isOnLadder = function() {
    const pCX = window.player.x + window.player.width / 2;
    for (let b of window.blocks) {
        if (b.type !== 'ladder') continue;
        const bs = window.game.blockSize;
        if (pCX >= b.x && pCX <= b.x + bs && window.player.y + window.player.height > b.y && window.player.y < b.y + bs) return true;
    }
    return false;
};

window.checkBlockCollisions = function(axis) {
    if (window.player.inBackground) return;
    const p = window.player;
    const bs = window.game.blockSize;

    for (let b of window.blocks) {
        if ((b.type === 'door' && b.open) || b.type === 'box' || b.type === 'campfire' || b.type === 'bed' || b.type === 'grave' || b.type === 'barricade' || b.type === 'ladder' || b.type === 'stair') continue; 
        let itemHeight = b.type === 'door' ? bs * 2 : bs;

        if (window.checkRectIntersection(p.x, p.y, p.width, p.height, b.x, b.y, bs, itemHeight)) {
            if (axis === 'x') { 
                // Ignorar colisión de pared si los pies están cerca de la cima (esquina)
                if (p.y + p.height <= b.y + 18) continue;
                // Ignorar si el jugador va hacia arriba O si está a punto de saltar (coyoteTime activo + jumpPressed)
                if (p.vy < 0) continue;
                const wantsJump = window.keys && window.keys.jumpPressed && p.jumpKeyReleased && p.coyoteTime > 0;
                if (wantsJump) continue;

                if (p.vx > 0) p.x = b.x - p.width - 0.1; 
                else if (p.vx < 0) p.x = b.x + bs + 0.1; 
                p.vx = 0; 
            } 
            else if (axis === 'y') { 
                if (p.vy > 0) { p.y = b.y - p.height; p.vy = 0; p.isGrounded = true; } 
                else if (p.vy < 0) { p.y = b.y + itemHeight + 0.1; p.vy = 0; }
            }
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
                if (ent.y + ent.height <= b.y + 12) continue;

                if (ent.vx > 0) { ent.x = b.x - ent.width; ent.vx *= -1; hitWall = true; } 
                else if (ent.vx < 0) { ent.x = b.x + window.game.blockSize; ent.vx *= -1; hitWall = true; }
                
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
            } else if (axis === 'y') { 
                if (ent.vy > 0) { ent.y = b.y - ent.height; ent.vy = 0; } 
                else if (ent.vy < 0) { ent.y = b.y + itemHeight; ent.vy = 0; } 
            }
        }
    } return hitWall;
};

window.generateWorldSector = function(startX, endX) {
    if (startX < window.game.shoreX + 50) startX = window.game.shoreX + 50; 
    let seed = (Math.floor(startX) + 12345) ^ ((window.worldSeed || 12345) & 0xFFFF); function sRandom() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    
    if (!window.removedTrees) window.removedTrees = []; if (!window.treeState) window.treeState = {}; if (!window.removedRocks) window.removedRocks = []; if (!window.killedEntities) window.killedEntities = [];

    const bs = window.game.blockSize;
    
    function isTerrainTooSteep(cx) {
        if (!window.getGroundY) return false;
        const baseY = window.getGroundY(cx);
        if (Math.abs(window.getGroundY(cx - 30) - baseY) > 45) return true;
        if (Math.abs(window.getGroundY(cx + 30) - baseY) > 45) return true;
        return false;
    }

    const numTrees = Math.floor(sRandom() * 5) + 3; 
    let localTreeX = []; 
    const TREE_W = 40; const TREE_H = 240; 
    
    for (let i = 0; i < numTrees; i++) { 
        let tx; let validPos = false; let attempts = 0;
        while (attempts < 15 && !validPos) {
            tx = Math.floor(startX + 50 + sRandom() * (endX - startX - 100)); 
            validPos = true;
            for (let existingX of localTreeX) { if (Math.abs(tx - existingX) < 140) { validPos = false; break; } }
            if (validPos && isTerrainTooSteep(tx + TREE_W / 2)) validPos = false;
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
                let tGroundY = window.getGroundY ? (window.getGroundY(tx + tWidth/2) + 12) : window.game.groundLevel;
                
                const _dStartTree = (window.game.desertStart || 2600) + window.game.shoreX;
                const _dWidthTree = window.game.desertWidth || 800;
                const _txDist = tx + tWidth / 2;
                const _isDesertHere = _txDist > _dStartTree + _dWidthTree * 0.6;
                const _isDesertEdge = _txDist > _dStartTree && !_isDesertHere;
                let treeType;
                if (_isDesertHere) treeType = 3; 
                else if (_isDesertEdge) treeType = sRandom() < 0.4 ? 3 : Math.floor(sRandom() * 3); 
                else treeType = Math.floor(sRandom() * 3); 
                if(!window.trees.some(t => Math.abs(t.x - tx) < 1)) { window.trees.push({ id: 't_'+tx, x: tx, y: tGroundY - tHeight, width: tWidth, height: tHeight, hp: hp, maxHp: hp, isHit: false, type: treeType, isStump: isStump, regrowthCount: rCount, grownDay: gDay, groundY: tGroundY }); }
            }
        }
    }

    if (startX > 800 && sRandom() < 0.75) { 
        const numRocks = Math.floor(sRandom() * 3) + 2; 
        for (let i=0; i<numRocks; i++) { 
            let rx = Math.floor(startX + sRandom() * (endX - startX)); let rW = 50 + Math.floor(sRandom()*40); let rH = 35 + Math.floor(sRandom()*25); 
            const rcx = rx + rW / 2;
            if (isTerrainTooSteep(rcx)) continue;
            let rGroundY = window.getGroundY ? (window.getGroundY(rcx) + 10) : window.game.groundLevel;
            if (!window.removedRocks.some(rrx => Math.abs(rrx - rx) < 1) && !window.rocks.some(r => Math.abs(r.x - rx) < 1)) { window.rocks.push({id: 'r_'+rx, x: rx, y: rGroundY - rH, width: rW, height: rH, hp: 300, maxHp: 300, isHit: false}); }
        }
    }
    
    let cx = Math.floor(startX + 100 + sRandom() * (endX - startX - 200)); let distToShore = Math.abs(cx - window.game.shoreX); 
    let lvl = Math.max(1, Math.floor(distToShore / 4000)) + Math.max(0, window.game.days - 1);
    let newId = 'e_' + cx;
    let cGroundY = window.getGroundY ? window.getGroundY(cx) : window.game.groundLevel;
    if (!window.entities.some(e => e.id === newId) && !window.killedEntities.includes(newId)) {
        if (distToShore > 5000) {
            if (distToShore > 7000 && sRandom() < 0.35) { 
                let aMaxHp = 20 + (lvl * 12); 
                window.entities.push({ id: newId, type: 'archer', name: 'Cazador', level: lvl, x: cx, y: cGroundY - 40, width: 20, height: 40, vx: (sRandom() > 0.5 ? 0.8 : -0.8), vy: 0, hp: aMaxHp, maxHp: aMaxHp, damage: 5 + (lvl * 2), isHit: false, attackCooldown: 0, stuckFrames: 0, ignorePlayer: 0, lastX: cx }); 
            } else if (sRandom() < 0.55) { 
                window.entities.push({ id: newId, type: 'chicken', name: 'Pollo', level: 1, x: cx, y: cGroundY - 20, width: 20, height: 20, vx: (sRandom() > 0.5 ? 0.3 : -0.3), vy: 0, hp: 25, maxHp: 25, isHit: false, attackCooldown: 0, stuckFrames: 0, fleeTimer: 0, fleeDir: 1, lastX: cx }); 
            } else { 
                let spiderMaxHp = 15 + (lvl * 10); let sWidth = 14 + (lvl * 1), sHeight = 8 + (lvl * 1); 
                window.entities.push({ id: newId, type: 'spider', name: 'Araña', level: lvl, x: cx, y: cGroundY - sHeight, width: sWidth, height: sHeight, vx: (sRandom() > 0.5 ? 0.6 : -0.6), vy: 0, hp: spiderMaxHp, maxHp: spiderMaxHp, damage: 5 + (lvl * 2), isHit: false, attackCooldown: 0, stuckFrames: 0, ignorePlayer: 0, lastX: cx }); 
            }
        } else { 
            window.entities.push({ id: newId, type: 'chicken', name: 'Pollo', level: 1, x: cx, y: cGroundY - 20, width: 20, height: 20, vx: (sRandom() > 0.5 ? 0.3 : -0.3), vy: 0, hp: 25, maxHp: 25, isHit: false, attackCooldown: 0, stuckFrames: 0, fleeTimer: 0, fleeDir: 1, lastX: cx }); 
        }
    }
};

window.startGame = function(multiplayer, ip = null) {
    const nameInput = window.getEl('player-name'); 
    let rawName = (nameInput && nameInput.value) ? nameInput.value.trim() : "Jugador " + Math.floor(Math.random()*1000);
    window.player.name = rawName.substring(0, 15);

    let menu = window.getEl('main-menu'); if(menu) menu.style.display = 'none'; let ui = window.getEl('ui-layer'); if(ui) ui.style.display = 'block';
    window.game.isRunning = true; window.game.isMultiplayer = multiplayer;
    if (window.initRenderCaches) window.initRenderCaches();
    
    if (!window.worldSeed || window.worldSeed === 0) {
        const savedSeed = localStorage.getItem('worldSeedCode');
        if (savedSeed && window.setSeedFromCode) window.setSeedFromCode(savedSeed);
        else if (window.generateSeed) window.generateSeed();
    }
    if (window.applySeed) window.applySeed();
    window.generateWorldSector(window.game.shoreX, window.game.exploredRight);

    if (multiplayer && typeof io !== 'undefined') {
        try {
            const connectionURL = ip ? `http://${ip}:3000` : window.location.origin; window.socket = io(connectionURL);
            let sInfo = window.getEl('server-info'); if(sInfo) { sInfo.style.display = 'flex'; window.getEl('sv-ip').innerText = ip ? ip : 'Servidor Web'; }
            if (ip && ip !== window.location.hostname && ip !== 'localhost' && ip !== '127.0.0.1') { let list = JSON.parse(localStorage.getItem('savedServers') || '[]'); if (!list.includes(ip)) { list.push(ip); localStorage.setItem('savedServers', JSON.stringify(list)); if(window.refreshServerList) window.refreshServerList(); } }
            
            // Enviamos la semilla del host por si es el primer jugador en entrar
            window.socket.on('connect', () => { window.socket.emit('joinGame', { name: window.player.name, x: window.player.x, y: window.player.y, level: window.player.level, seedCode: window.seedCode }); });
            
            window.socket.on('disconnect', () => { alert("⚠ Se perdió la conexión con el Servidor. La partida se reiniciará."); window.location.reload(); });
            window.socket.on('currentPlayers', (srvPlayers) => { window.otherPlayers = srvPlayers; let pCount = window.getEl('sv-players'); if(pCount) pCount.innerText = Object.keys(srvPlayers).length; });
            
            window.socket.on('playerMoved', (pInfo) => {
                // Spawn dust for running remote players
                if (pInfo.id !== window.socket?.id) {
                    const op = window.otherPlayers && window.otherPlayers[pInfo.id];
                    if (op && Math.abs(pInfo.vx) > 2.5 && pInfo.isGrounded && !pInfo.isDead && window.game.frameCount % 4 === 0) {
                        const footX = pInfo.x + (op.width||24) / 2 + (pInfo.facingRight ? -8 : 8);
                        const footY = pInfo.y + (op.height||40);
                        window.spawnDustPuff(footX, footY, pInfo.facingRight, true);
                    }
                }
                if(window.otherPlayers[pInfo.id]) { 
                    let op = window.otherPlayers[pInfo.id];
                    op.targetX = pInfo.x; op.targetY = pInfo.y; op.vx = pInfo.vx; op.vy = pInfo.vy;
                    op.facingRight = pInfo.facingRight; op.activeTool = pInfo.activeTool; op.animTime = pInfo.animTime;
                    op.attackFrame = pInfo.attackFrame; op.isAiming = pInfo.isAiming; op.isCharging = pInfo.isCharging;
                    op.chargeLevel = pInfo.chargeLevel; op.level = pInfo.level;
                    op.mouseX = pInfo.mouseX; op.mouseY = pInfo.mouseY;
                    op.isDancing = pInfo.isDancing || false; op.danceStart = pInfo.danceStart || 0;
                    op.isClimbing = pInfo.isClimbing || false;
                    
                    // --- DISPARAR ANIMACIÓN DE MUERTE REMOTA ---
                    if (pInfo.isDead && !op.isDead) {
                        op.deathAnimFrame = 40; 
                    }
                    op.isDead = pInfo.isDead;
                } 
            });
            
            // --- DETECTAR SI UN JUGADOR SE FUE PARA CANCELAR PVP ---
            window.socket.on('playerDisconnected', (id) => {
                if (window.pvp && window.pvp.activeOpponent === id) {
                    window.pvp.activeOpponent = null;
                    if(window.addGlobalMessage) window.addGlobalMessage('🛑 Tu rival se ha desconectado. PVP finalizado.', '#aaa');
                    if(window.updatePlayerList) window.updatePlayerList();
                }
                delete window.otherPlayers[id];
                if(window.updatePlayerList) window.updatePlayerList();
            });

            window.socket.on('timeSync', (serverUptimeMs) => { window.game.serverStartTime = Date.now() - serverUptimeMs; });

            window.socket.on('worldSeed', (data) => {
                if (data && data.seed && window.setSeedFromCode) {
                    window.setSeedFromCode(data.seed);
                    localStorage.setItem('worldSeedCode', window.seedCode);
                    const el = document.getElementById('seed-display');
                    if (el) el.textContent = window.seedCode;
                }
            });

            window.socket.on('serverFull', () => { alert('⚠️ El servidor está lleno. Inténtalo más tarde.'); window.location.reload(); });

            window.socket.on('worldReset', (data) => {
                if (data && data.seed && window.setSeedFromCode) { window.setSeedFromCode(data.seed); localStorage.setItem('worldSeedCode', window.seedCode); }
                window.blocks = []; window.droppedItems = []; window.removedTrees = []; window.removedRocks = []; window.treeState = {}; window.killedEntities = []; window.stuckArrows = []; window.trees = []; window.rocks = []; window.entities = []; window.game.exploredRight = window.game.shoreX;
                if (window.applySeed) window.applySeed();
                window.generateWorldSector(window.game.shoreX, window.game.shoreX + window.game.chunkSize);
                window.game.exploredRight = window.game.shoreX + window.game.chunkSize;
                const el = document.getElementById('seed-display'); if (el) el.textContent = window.seedCode || '-----';
                if (window.addGlobalMessage) window.addGlobalMessage('🌍 Mundo reseteado — nueva semilla: ' + (window.seedCode || '?'), '#3ddc84');
            });
            
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
                const myId = window.socket.id;

                if (data.action === 'pvp_challenge') {
                    if (data.payload.toId !== myId) return;
                    window.pvp = window.pvp || {};
                    window.pvp.pendingChallenge = { fromId: data.payload.fromId, fromName: data.payload.fromName };
                    window.showPvpNotification(data.payload.fromName, data.payload.fromId);
                    return;
                }
                if (data.action === 'pvp_accepted') {
                    if (data.payload.fromId !== myId) return;
                    window.pvp = window.pvp || {};
                    const opName = window.otherPlayers[data.payload.toId]?.name || data.payload.toName;
                    window.pvp.activeOpponent = data.payload.toId;
                    if(window.otherPlayers[data.payload.toId]) window.otherPlayers[data.payload.toId].pvpActive = true;
                    if(window.addGlobalMessage) window.addGlobalMessage(`⚔️ PVP activo con ${opName}! ¡Lucha!`, '#ff4444');
                    if(window.updatePlayerList) window.updatePlayerList();
                    return;
                }
                if (data.action === 'pvp_declined') {
                    if (data.payload.fromId !== myId) return;
                    const opName = window.otherPlayers[data.payload.toId]?.name || '?';
                    if(window.addGlobalMessage) window.addGlobalMessage(`❌ ${opName} rechazó el duelo.`, '#aaa');
                    return;
                }
                if (data.action === 'pvp_ended') {
                    window.pvp = window.pvp || {};
                    if (window.pvp.activeOpponent === data.payload.p1 || window.pvp.activeOpponent === data.payload.p2) {
                        window.pvp.activeOpponent = null;
                        if(window.addGlobalMessage) window.addGlobalMessage(`🏁 El duelo PVP terminó.`, '#f0a020');
                        if(window.updatePlayerList) window.updatePlayerList();
                    }
                    if (window.otherPlayers[data.payload.p1]) window.otherPlayers[data.payload.p1].pvpActive = false;
                    if (window.otherPlayers[data.payload.p2]) window.otherPlayers[data.payload.p2].pvpActive = false;
                    return;
                }
                if (data.action === 'pvp_hit') {
                    if (data.payload.targetId !== myId) return;
                    window.pvp = window.pvp || {};
                    if (window.pvp.activeOpponent !== data.payload.sourceId) return;
                    window.damagePlayer(data.payload.dmg, window.otherPlayers[data.payload.sourceId]?.name || 'Rival');
                    window.player.pvpHitFlash = 8;
                    return;
                }

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
                else if (data.action === 'dust_puff') { window.spawnDustPuff(data.payload.x, data.payload.y, data.payload.facingRight, true); }
            });
        } catch(e) { console.error("Error Socket:", e); alert("No se pudo conectar al servidor. Verifica la IP."); }
    }
    window.recalculateStats(); if(window.updateUI) window.updateUI(); if(window.renderToolbar) window.renderToolbar(); 
};

// ============================================================
// === SISTEMA PVP ===
// ============================================================
window.pvp = { activeOpponent: null, pendingChallenge: null };

window.showPvpNotification = function(fromName, fromId) {
    let notif = document.createElement('div');
    notif.id = 'pvp-notif';
    notif.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(20,0,0,0.95);border:2px solid #ff4444;color:#fff;padding:24px 32px;border-radius:12px;z-index:9999;text-align:center;font-family:inherit;backdrop-filter:blur(8px);';
    notif.innerHTML = `<div style="font-size:22px;font-weight:700;color:#ff4444;margin-bottom:8px;">⚔️ ¡Desafío PVP!</div>
<div style="margin-bottom:18px;"><span style="color:#f0a020;font-weight:600;">${fromName}</span> te desafía a un duelo.</div>
<div style="display:flex;gap:12px;justify-content:center;">
  <button onclick="window.acceptPvp('${fromId}')" style="background:#c0392b;color:#fff;border:none;padding:10px 22px;border-radius:6px;cursor:pointer;font-weight:700;font-size:14px;">✅ Aceptar</button>
  <button onclick="window.declinePvp('${fromId}')" style="background:#2c2c2c;color:#aaa;border:1px solid #555;padding:10px 22px;border-radius:6px;cursor:pointer;font-size:14px;">❌ Rechazar</button>
</div>`;
    document.body.appendChild(notif);
    setTimeout(() => { if(document.getElementById('pvp-notif') === notif) notif.remove(); }, 15000);
};

window.challengePvp = function(targetId) {
    if (!window.socket || !window.game.isMultiplayer) { 
        if(window.addGlobalMessage) window.addGlobalMessage('⚠️ PVP requiere modo multijugador.', '#f0a020'); return; 
    }
    const targetName = window.otherPlayers[targetId]?.name || '?';
    window.sendWorldUpdate('pvp_challenge', { toId: targetId, fromId: window.socket.id, fromName: window.player.name });
    if(window.addGlobalMessage) window.addGlobalMessage(`⚔️ Desafío enviado a ${targetName}...`, '#f0a020');
};

window.acceptPvp = function(fromId) {
    let notif = document.getElementById('pvp-notif'); if(notif) notif.remove();
    if (!window.socket) return;
    window.pvp.activeOpponent = fromId;
    if(window.otherPlayers[fromId]) window.otherPlayers[fromId].pvpActive = true;
    window.sendWorldUpdate('pvp_accepted', { fromId: fromId, toId: window.socket.id, toName: window.player.name });
    if(window.addGlobalMessage) window.addGlobalMessage(`⚔️ ¡Duelo aceptado! A luchar.`, '#ff4444');
    if(window.updatePlayerList) window.updatePlayerList();
};

window.declinePvp = function(fromId) {
    let notif = document.getElementById('pvp-notif'); if(notif) notif.remove();
    if (!window.socket) return;
    window.sendWorldUpdate('pvp_declined', { fromId: fromId, toId: window.socket.id });
};

window.updatePlayerList = function() {
    let inner = document.getElementById('pvp-player-list-inner');
    if (!inner) return;
    if (!window.game.isMultiplayer || !window.otherPlayers) { 
        inner.innerHTML = '<div style="color:#5a6475; font-size:12px; text-align:center; padding:16px 0; font-family:var(--font-ui);">🔌 Solo multijugador<br><span style="font-size:10px;">Conecta a un servidor para duelos</span></div>'; 
        return; 
    }
    const myId = window.socket?.id;
    const ops = Object.values(window.otherPlayers).filter(p => p.name);
    if (ops.length === 0) { 
        inner.innerHTML = '<div style="color:#5a6475; font-size:12px; text-align:center; padding:16px 0; font-family:var(--font-ui);">Sin jugadores en línea</div>'; 
        return; 
    }
    inner.innerHTML = ops.map(op => {
        const isSelf = op.id === myId;
        const isPvpActive = window.pvp.activeOpponent === op.id;
        const opName = op.name || '?';
        const dist = Math.round(Math.hypot((op.x||0) - window.player.x, (op.y||0) - window.player.y) / 10);
        const deadBadge = op.isDead ? '<span style="color:#e74c3c; font-size:10px;"> ☠</span>' : '';
        
        let actionEl;
        if (isSelf) {
            actionEl = `<span style="color:#5a6475; font-size:10px; font-family:var(--font-ui); font-style:italic;">Tú</span>`;
        } else if (isPvpActive) {
            actionEl = `<span style="color:#ff6666; font-weight:700; font-size:11px; white-space:nowrap; font-family:var(--font-ui);">⚔ DUELO</span>`;
        } else {
            actionEl = `<button onclick="window.challengePvp('${op.id}')"
                style="background:linear-gradient(135deg,rgba(120,15,15,0.9),rgba(80,5,5,0.95));
                       color:#ff9090; border:1px solid rgba(200,50,50,0.35); border-radius:5px;
                       padding:4px 9px; cursor:pointer; font-size:11px; font-weight:700;
                       font-family:var(--font-ui); white-space:nowrap;"
                onmouseover="this.style.background='linear-gradient(135deg,rgba(180,20,20,0.95),rgba(120,5,5,0.99))'"
                onmouseout="this.style.background='linear-gradient(135deg,rgba(120,15,15,0.9),rgba(80,5,5,0.95))'">
                ⚔ PVP
               </button>`;
        }

        return `<div style="display:flex; align-items:center; justify-content:space-between; gap:8px;
                    padding:7px 8px; margin-bottom:4px; border-radius:6px;
                    background:${isSelf ? 'rgba(61,220,132,0.04)' : 'rgba(255,255,255,0.03)'}; 
                    border:1px solid ${isSelf ? 'rgba(61,220,132,0.12)' : 'rgba(255,255,255,0.05)'};">
            <div style="min-width:0;">
                <div style="color:${isSelf ? '#3ddc84' : '#d8dde6'}; font-weight:700; font-size:12px; font-family:var(--font-ui);">${opName}${deadBadge}</div>
                <div style="color:#5a6475; font-size:10px; font-family:var(--font-ui);">Niv.${op.level||1}${!isSelf ? ` &nbsp;·&nbsp; ${dist}m` : ''}</div>
            </div>
            ${actionEl}
        </div>`;
    }).join('');
};

window.togglePlayerList = function() {
    let panel = document.getElementById('pvp-player-panel');
    if (!panel) return;
    const isVisible = panel.style.display === 'block';
    panel.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) window.updatePlayerList();
};

window.addEventListener('contextmenu', (e) => { e.preventDefault(); });
window.addEventListener('blur', () => { if(window.keys) { window.keys.a = false; window.keys.d = false; window.keys.w = false; window.keys.s = false; window.keys.shift = false; window.keys.y = false; window.keys.jumpPressed = false; window.keys.mouseLeft = false; } if(window.player) { window.player.isCharging = false; window.player.isClimbing = false; } });
window.addEventListener('keyup', (e) => {
    if (!window.game || !window.game.isRunning) return;
    let chatInput = window.getEl('chat-input');
    if (chatInput && document.activeElement === chatInput) return;
    if (!window.keys) return;
    if (e.key === 'a' || e.key === 'A') window.keys.a = false; if (e.key === 'd' || e.key === 'D') window.keys.d = false; if (e.key === 's' || e.key === 'S') window.keys.s = false; if (e.key === 'Shift') window.keys.shift = false; if (e.key === 'y' || e.key === 'Y') window.keys.y = false;
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
                    if (msg.startsWith('/')) {
                        const cmd = msg.toLowerCase();
                        if (cmd === '/madera') { window.player.inventory.wood = (window.player.inventory.wood || 0) + 100; window.spawnDamageText(window.player.x + window.player.width/2, window.player.y - 20, '+100 Madera 🌲', '#c19a6b'); if (window.updateUI) window.updateUI(); } 
                        else if (cmd === '/piedra') { window.player.inventory.stone = (window.player.inventory.stone || 0) + 100; window.spawnDamageText(window.player.x + window.player.width/2, window.player.y - 20, '+100 Piedra ⛏️', '#999'); if (window.updateUI) window.updateUI(); } 
                        else if (cmd === '/flechas') { window.player.inventory.arrows = (window.player.inventory.arrows || 0) + 10; window.spawnDamageText(window.player.x + window.player.width/2, window.player.y - 20, '+10 Flechas 🏹', '#e67e22'); if (window.updateUI) window.updateUI(); } 
                        else if (cmd === '/dance') { window.player.isDancing = true; window.player.danceStart = window.game.frameCount; window.player.chatText = '🕺 ¡A bailar!'; window.player.chatExpires = Date.now() + 3000; } 
                        else { window.spawnDamageText(window.player.x + window.player.width/2, window.player.y - 20, 'Comando desconocido', '#e74c3c'); }
                        chatInput.value = ''; chatInput.blur(); chatContainer.style.display = 'none'; window.player.isTyping = false; return;
                    }
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
    if (window.player.isDancing) { window.player.isDancing = false; }
    if (e.key === 'a' || e.key === 'A') window.keys.a = true; if (e.key === 'd' || e.key === 'D') window.keys.d = true; if (e.key === 's' || e.key === 'S') window.keys.s = true; if (e.key === 'Shift') window.keys.shift = true; if (e.key === 'w' || e.key === 'W' || e.key === ' ') window.keys.jumpPressed = true; if (e.key === 'y' || e.key === 'Y') window.keys.y = true; 
    
    if (!window.player.placementMode) {
        if (e.key === 'i' || e.key === 'I') { if(window.toggleMenu) window.toggleMenu('inventory'); } 
        if (e.key === 'c' || e.key === 'C') { if(window.toggleMenu) window.toggleMenu('crafting'); } 
        if (e.key === 'f' || e.key === 'F') { if(window.eatFood) window.eatFood(15, 30); }
        if (e.key === 'r' || e.key === 'R') { if(window.player.activeTool === 'hammer') { const modes = ['block', 'door', 'stair']; const idx = modes.indexOf(window.player.buildMode); window.player.buildMode = modes[(idx + 1) % modes.length]; let modeLabel = window.player.buildMode === 'stair' ? `Escalón (${window.player.stairMirror ? '◀' : '▶'})` : window.player.buildMode; window.spawnDamageText(window.player.x+window.player.width/2, window.player.y-20, `Modo: ${modeLabel}`, '#fff'); } }
        if (e.key === 't' || e.key === 'T') { if(window.player.activeTool === 'hammer' && window.player.buildMode === 'stair') { window.player.stairMirror = !window.player.stairMirror; window.spawnDamageText(window.player.x+window.player.width/2, window.player.y-20, `Escalón: ${window.player.stairMirror ? '◀ izq' : '▶ der'}`, '#aaddff'); } }

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
            if (interactables.length > 1) {
                const _pCX2 = window.player.x + window.player.width / 2;
                interactables.sort((a, b) => {
                    const aCX = a.x + window.game.blockSize/2, bCX = b.x + window.game.blockSize/2;
                    const aFacing = window.player.facingRight ? (aCX >= _pCX2) : (aCX <= _pCX2);
                    const bFacing = window.player.facingRight ? (bCX >= _pCX2) : (bCX <= _pCX2);
                    if (aFacing && !bFacing) return -1;
                    if (!aFacing && bFacing) return 1;
                    return Math.abs(aCX - _pCX2) - Math.abs(bCX - _pCX2);
                });
            }
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
    const swingAngle = Math.atan2(window.mouseWorldY - pCY, window.mouseWorldX - pCX);
    const halfArc = Math.PI * 0.55;

    for (let i = window.rocks.length - 1; i >= 0; i--) {
        const r = window.rocks[i];
        const rFY = window.getGroundY ? window.getGroundY(r.x + r.width/2) : (r.y + r.height);
        const rTopY = rFY - r.height;
        const rCX = r.x + r.width / 2;
        const rCY = rTopY + r.height / 2;

        const dist = Math.hypot(pCX - rCX, pCY - rCY);
        if (dist > range) continue;

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
    const swingAngle = Math.atan2(window.mouseWorldY - pCY, window.mouseWorldX - pCX);
    const halfArc = Math.PI * 0.55;

    for (let i = window.trees.length - 1; i >= 0; i--) {
        const t = window.trees[i];
        const tFootY = window.getGroundY ? window.getGroundY(t.x + t.width/2) : (t.groundY || t.y + t.height);
        const tCX = t.x + t.width / 2;
        const tHitY = t.isStump ? tFootY - 40 : tFootY - Math.min(t.height * 0.35, range * 0.6);

        const dist = Math.hypot(pCX - tCX, pCY - tHitY);
        if (dist > range) continue;

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

    const meleeRange = 80 + (window.player.stats.str || 0) * 2; 

    let entityDmg = tool === 'hammer' ? 0 : Math.max(1, Math.floor(tool === 'pickaxe' ? baseDmg * 0.3 : (tool === 'axe' ? baseDmg * 0.6 : baseDmg)));
    let treeDmg = tool === 'axe' ? Math.floor(baseDmg * 1.5) : (tool === 'sword' ? Math.floor(baseDmg * 0.25) : (tool === 'hand' ? baseDmg : 0));
    let rockDmg = tool === 'pickaxe' ? Math.floor(baseDmg * 3) : (tool === 'hammer' ? 0 : 1);
    let blockDmg = tool === 'hammer' ? Math.floor(baseDmg * 3) : (tool === 'sword' ? Math.max(1, Math.floor(baseDmg * 0.2)) : baseDmg);

    window.player.meleeCooldown = Math.max(22, 45 - Math.floor((window.player.stats.agi||0) * 3));

    if (entityDmg > 0 && window.tryHitEntity(pCX, pCY, entityDmg, meleeRange)) actionDone = true;

    if (!actionDone && entityDmg > 0 && window.pvp && window.pvp.activeOpponent && window.game.isMultiplayer) {
        const op = window.otherPlayers && window.otherPlayers[window.pvp.activeOpponent];
        if (op && !op.isDead) {
            const opCX = op.x + (op.width || 24) / 2;
            const opCY = op.y + (op.height || 40) / 2;
            const dist = Math.hypot(opCX - pCX, opCY - pCY);
            if (dist <= meleeRange) {
                const swingAngle = Math.atan2(window.mouseWorldY - pCY, window.mouseWorldX - pCX);
                const angleToOp = Math.atan2(opCY - pCY, opCX - pCX);
                let aDiff = Math.abs(angleToOp - swingAngle);
                if (aDiff > Math.PI) aDiff = Math.PI * 2 - aDiff;
                if (aDiff <= Math.PI * 0.6) {
                    window.sendWorldUpdate('pvp_hit', { targetId: window.pvp.activeOpponent, sourceId: window.socket.id, dmg: entityDmg });
                    window.spawnDamageText(opCX, opCY - 20, `-${Math.floor(entityDmg)}`, '#ff4444');
                    window.spawnParticles(opCX, opCY, '#ff4444', 6);
                    actionDone = true;
                }
            }
        }
    }
    if (!actionDone && blockDmg > 0 && window.tryHitBlock(pCX, pCY, blockDmg, meleeRange)) actionDone = true;
    if (!actionDone && rockDmg > 0 && window.tryHitRock(pCX, pCY, rockDmg, meleeRange)) actionDone = true;
    if (!actionDone && treeDmg > 0 && window.tryHitTree(pCX, pCY, treeDmg, meleeRange)) actionDone = true;

    if (!actionDone && tool === 'hammer') {
        const bs = window.game.blockSize;
        const gridX = Math.floor(window.mouseWorldX / bs) * bs;
        const gridY = Math.floor(window.mouseWorldY / bs) * bs;
        const isDoorMode  = window.player.buildMode === 'door'; 
        const isStairMode = window.player.buildMode === 'stair';
        const itemHeight = isDoorMode ? window.game.blockSize * 2 : window.game.blockSize; 
        const cost = isDoorMode ? 4 : 2; 
        if (Math.hypot(pCX - (gridX + window.game.blockSize/2), pCY - (gridY + itemHeight/2)) <= window.player.miningRange) {
            if (window.player.inventory.wood >= cost) {
                if (window.isValidPlacement(gridX, gridY, window.game.blockSize, itemHeight, true, true)) {
                    let newType = isDoorMode ? 'door' : (isStairMode ? 'stair' : 'block');
                    let newB = { x: gridX, y: gridY, type: newType, open: false, hp: 300, maxHp: 300, isHit: false };
                    if (isStairMode) newB.facingRight = !window.player.stairMirror;
                    window.blocks.push(newB); window.sendWorldUpdate('place_block', { block: newB }); window.player.inventory.wood -= cost; window.spawnParticles(gridX + 15, gridY + 15, '#D2B48C', 5, 0.5); if (window.playSound) window.playSound('build'); if(window.updateUI) window.updateUI();
                } else { 
                    if (window.game.frameCount % 30 === 0) window.spawnDamageText(window.mouseWorldX, window.mouseWorldY - 10, "Lugar Inválido", '#ffaa00'); 
                }
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
                let validPlace;
                if (type === 'ladder') {
                    const bs_l = window.game.blockSize;
                    const lGY = window.getGroundY ? window.getGroundY(gridX + bs_l/2) : window.game.groundLevel;
                    const lGroundGridY = Math.ceil(lGY / bs_l) * bs_l;
                    const noOverlapPlayer = !window.checkRectIntersection(gridX, gridY, bs_l, bs_l, window.player.x, window.player.y, window.player.width, window.player.height);
                    const alreadyHere = window.blocks.some(b => b.type === 'ladder' && Math.abs(b.x - gridX) < 1 && Math.abs(b.y - gridY) < 1);
                    const onGround = (gridY + bs_l) >= lGroundGridY;
                    const onLadder = window.blocks.some(b => b.type === 'ladder' && Math.abs(b.x - gridX) < 1 && Math.abs(b.y - (gridY + bs_l)) < 2);
                    const onBlock  = window.blocks.some(b => (b.type === 'block' || b.type === 'stair') && Math.abs(b.x - gridX) < 1 && Math.abs(b.y - (gridY + bs_l)) < 2);
                    const inRange  = Math.hypot((window.player.x + window.player.width/2) - (gridX + bs_l/2), (window.player.y + window.player.height/2) - (gridY + bs_l/2)) <= window.player.miningRange + 60;
                    validPlace = noOverlapPlayer && !alreadyHere && (onGround || onLadder || onBlock) && inRange;
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
    
    if (e.button === 0) { window.attemptAction(); }
});

window.addEventListener('mouseup', (e) => {
    if (!window.game || !window.game.isRunning) return;
    if (e.button === 0 && window.keys) { window.keys.mouseLeft = false; }
    if (!window.player || window.player.isDead) return;

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
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        let delta = e.deltaY > 0 ? -0.1 : 0.1;
        window.game.zoomTarget = Math.min(window.game.maxZoom, Math.max(window.game.minZoom, (window.game.zoomTarget || 1) + delta));
        return;
    }

    let dir = Math.sign(e.deltaY);

    if (window.player.placementMode) {
        e.preventDefault();
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
                window.player.placementMode = null;
                window.selectToolbarSlot(nextSlot);
                if(window.renderToolbar) window.renderToolbar();
                break;
            }
        }
        return;
    }

    if (dir > 0) window.player.activeSlot = (window.player.activeSlot + 1) % 6; else if (dir < 0) window.player.activeSlot = (window.player.activeSlot - 1 + 6) % 6;
    if(window.selectToolbarSlot) window.selectToolbarSlot(window.player.activeSlot); if(window.renderToolbar) window.renderToolbar();
}, { passive: false });

function update() {
    try {
        if (!window.game || !window.game.isRunning || !window.canvas || !window.player) return;
        const bs = window.game.blockSize; 
        let pCX = window.player.x + window.player.width/2; let pCY = window.player.y + window.player.height/2;

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

        if (window.player.isDead) { 
            window.player.vx = 0; window.player.isStealth = false; window.player.isClimbing = false;
            let pO = window.getEl('placement-overlay'); if(pO) pO.style.display = 'none';
            if ((window.player.deathAnimFrame || 0) > 0) window.player.deathAnimFrame--;
        }
        if ((window.player.pvpHitFlash || 0) > 0) window.player.pvpHitFlash--;
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

        const _onLadder = !window.player.isDead && window.isOnLadder();
        
        // --- SISTEMA DE ESCALERA COMPLETO ---
        if (_onLadder) {
            // Auto-agarrar escalera si está cayendo o presiona W
            if (!window.player.isClimbing) {
                if (window.player.vy > 1.5) {
                    // auto-agarrar al caer sobre escalera
                    window.player.isClimbing = true;
                } else if (window.keys && window.keys.jumpPressed) {
                    // agarrar manualmente con W
                    window.player.isClimbing = true;
                }
            }
            
            if (window.player.isClimbing) {
                // Controles de escalada: W = subir, S = bajar, nada = flotar
                if (window.keys && window.keys.jumpPressed) {
                    window.player.vy = -2.5; // subir
                } else if (window.keys && window.keys.s) {
                    window.player.vy = 2.5;  // bajar
                } else {
                    window.player.vy = 0;    // flotar
                }
                // Soltar con A o D (sin W/S) → salto lateral
                if (window.keys && (window.keys.a || window.keys.d) && !window.keys.jumpPressed && !window.keys.s) {
                    window.player.isClimbing = false;
                    window.player.vy = -2.0; // pequeño impulso hacia arriba al soltar
                }
                window.player.isGrounded = false; window.player.isJumping = false; window.player.coyoteTime = 10;
            } else {
                // Está en escalera pero sin agarrar aún: gravedad normal
                window.player.vy += window.game.gravity;
            }
        } else {
            // Fuera de escalera: desactivar climbing
            if (window.player.isClimbing) window.player.isClimbing = false;
            window.player.vy += window.game.gravity;
        }
        const _isClimbing = window.player.isClimbing && _onLadder;
        
        window.player.isGrounded = false; window.player.y += window.player.vy; window.checkBlockCollisions('y');
        
        // --- FÍSICA DE ESCALONES: subir rampa sin saltar ---
        if (!window.player.isDead && !window.player.inBackground && Math.abs(window.player.vx) > 0.1) {
            for (let b of window.blocks) {
                if (b.type !== 'stair') continue;
                const bs = window.game.blockSize;
                // El escalón ocupa el cuadrado completo pero la rampa va de 0 altura en un lado a bs en el otro
                // Calcular qué fracción horizontal del escalón pisamos
                const relX = (window.player.x + window.player.width / 2) - b.x;
                if (relX < 0 || relX > bs) continue;
                if (window.player.y + window.player.height < b.y - 2 || window.player.y + window.player.height > b.y + bs + 4) continue;
                // Altura de la rampa en la posición X del jugador
                const frac = b.facingRight ? (relX / bs) : (1 - relX / bs);
                const rampY = b.y + bs - frac * bs; // de bs (fondo) a 0 (cima) según dirección
                const footY2 = window.player.y + window.player.height;
                if (footY2 >= rampY - 2 && footY2 <= rampY + bs * 0.8) {
                    // No aplicar rampa si hay una puerta cerrada bloqueando en esa posición
                    const newPlayerY = rampY - window.player.height;
                    const blockedByDoor = window.blocks.some(d => d.type === 'door' && !d.open &&
                        window.checkRectIntersection(window.player.x, newPlayerY, window.player.width, window.player.height, d.x, d.y, bs, bs * 2));
                    if (!blockedByDoor) {
                        window.player.y = newPlayerY;
                        window.player.vy = 0;
                        window.player.isGrounded = true;
                    }
                }
            }
        }
        
        let _pGroundY = window.getGroundY ? window.getGroundY(window.player.x + window.player.width / 2) : window.game.groundLevel;
        let footY = window.player.y + window.player.height;
        let wasGrounded = window.player.coyoteTime > 0 && !window.player.isJumping;

        if (footY > _pGroundY) { 
            window.player.y = _pGroundY - window.player.height; 
            window.player.vy = 0; 
            window.player.isGrounded = true; 
            if (_isClimbing) window.player.isClimbing = false; // llegó al suelo: soltar escalera
        } else if (!window.player.isGrounded && wasGrounded && window.player.vy >= 0 && footY >= _pGroundY - 22) {
            window.player.y = _pGroundY - window.player.height;
            window.player.vy = 0;
            window.player.isGrounded = true;
            if (_isClimbing) window.player.isClimbing = false;
        }

        if (window.player.isGrounded || _isClimbing) { window.player.coyoteTime = 10; window.player.isJumping = false; } else window.player.coyoteTime--;
        // --- HUMO AL CORRER (después de calcular isGrounded definitivo) ---
        if (window.player.isGrounded && Math.abs(window.player.vx) > 1.5 && !window.player.isDead && !_isClimbing && window.game.frameCount % 5 === 0) {
            const footX = window.player.x + window.player.width / 2 + (window.player.facingRight ? -8 : 8);
            const footY = window.player.y + window.player.height;
            window.spawnDustPuff(footX, footY, window.player.facingRight);
        }
        // Salto normal: solo si NO está en escalera activa
        if (window.keys && window.keys.jumpPressed && window.player.jumpKeyReleased && window.player.coyoteTime > 0 && !window.player.isJumping && !window.player.isDead && !_isClimbing) { window.player.vy = window.player.jumpPower; window.player.isJumping = true; window.player.coyoteTime = 0; window.player.jumpKeyReleased = false; }
        if (window.keys && !window.keys.jumpPressed && window.player.vy < 0 && !_isClimbing) window.player.vy *= 0.5;

        if (window.keys && window.keys.mouseLeft && !window.player.isDead) { window.attemptAction(); }

        if (window.game.isMultiplayer) {
            if (window.socket && (window.game.frameCount % 2 === 0 || window.player.attackFrame > 0 || window.player.isAiming || window.player.isDead || window.player.isTyping !== window.player._lastTypingState)) {
                window.socket.emit('playerMovement', { x: window.player.x, y: window.player.y, vx: window.player.vx, vy: window.player.vy, facingRight: window.player.facingRight, activeTool: window.player.activeTool, animTime: window.player.animTime, attackFrame: window.player.attackFrame, isAiming: window.player.isAiming, isCharging: window.player.isCharging, chargeLevel: window.player.chargeLevel, mouseX: window.mouseWorldX, mouseY: window.mouseWorldY, isDead: window.player.isDead, level: window.player.level, isTyping: window.player.isTyping || false, isDancing: window.player.isDancing || false, danceStart: window.player.danceStart || 0, deathAnimFrame: window.player.deathAnimFrame || 0, isClimbing: window.player.isClimbing || false });
                window.player._lastTypingState = window.player.isTyping;
            }
            if (window.otherPlayers) { 
                Object.values(window.otherPlayers).forEach(op => { 
                    if (op.targetX !== undefined) { op.x += (op.targetX - op.x) * 0.35; op.y += (op.targetY - op.y) * 0.35; } 
                    if ((op.pvpHitFlash || 0) > 0) op.pvpHitFlash--; 
                    
                    // --- CORRECCIÓN ANIMACIÓN DE MUERTE MULTIJUGADOR ---
                    if (op.isDead && (op.deathAnimFrame || 0) > 0) op.deathAnimFrame--;
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
            if (b.type === 'barricade') { window.entities.forEach(ent => { if (window.checkRectIntersection(ent.x, ent.y, ent.width, ent.height, b.x, b.y, window.game.blockSize, window.game.blockSize)) { if (window.game.frameCount % 30 === 0) { ent.hp -= 5; b.hp -= 10; window.setHit(ent); window.setHit(b); window.spawnParticles(ent.x + ent.width/2, ent.y + ent.height/2, '#ff4444', 5); window.spawnParticles(b.x + 15, b.y + 15, '#bdc3c7', 3); if (b.hp <= 0) { window.destroyBlockLocally(b); } else { window.sendWorldUpdate('hit_block', { x: b.x, y: b.y, dmg: 10 }); } } } }); }
        });

        for (let i = window.stuckArrows.length - 1; i >= 0; i--) {
            let sa = window.stuckArrows[i]; sa.life--;
            if (sa.blockX !== undefined && sa.blockX !== null) { let stillExists = window.blocks.some(b => b.x === sa.blockX && b.y === sa.blockY); if (!stillExists) sa.life = 0; }
            if (sa.life <= 0) window.stuckArrows.splice(i, 1);
        }

        let anyItemHovered = false; let interactables = window.blocks.filter(b => (b.type === 'box' || b.type === 'campfire' || b.type === 'door' || b.type === 'grave') && window.checkRectIntersection(window.player.x - 15, window.player.y - 15, window.player.width + 30, window.player.height + 30, b.x, b.y, window.game.blockSize, b.type==='door'?window.game.blockSize*2:window.game.blockSize));
        if (interactables.length > 1) {
            const _pCX3 = window.player.x + window.player.width / 2;
            interactables.sort((a, b) => {
                const aCX = a.x + window.game.blockSize/2, bCX = b.x + window.game.blockSize/2;
                const aFacing = window.player.facingRight ? (aCX >= _pCX3) : (aCX <= _pCX3);
                const bFacing = window.player.facingRight ? (bCX >= _pCX3) : (bCX <= _pCX3);
                if (aFacing && !bFacing) return -1;
                if (!aFacing && bFacing) return 1;
                return Math.abs(aCX - _pCX3) - Math.abs(bCX - _pCX3);
            });
        }
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
                if (isMyArrow && !pr.isEnemy && Math.random() < 0.5) { let newSa = { id: Math.random().toString(36).substring(2,9), x: pr.x, y: _prGroundY, angle: pr.angle, life: 18000 }; window.stuckArrows.push(newSa); window.sendWorldUpdate('spawn_stuck_arrow', newSa); } else if (isMyArrow && !pr.isEnemy) window.playSound('arrow_break');
                window.spawnParticles(pr.x, pr.y, '#557A27', 3); window.projectiles.splice(i, 1); continue; 
            } 
            let hitBlockRef = null; for(let b of window.blocks) { let bh = b.type === 'door' ? window.game.blockSize * 2 : window.game.blockSize; if (!b.open && window.checkRectIntersection(pr.x, pr.y, 4, 4, b.x, b.y, window.game.blockSize, bh) && b.type !== 'box' && b.type !== 'campfire' && b.type !== 'barricade') { hitBlockRef = b; break; } }
            if(hitBlockRef) { 
                if (isMyArrow && !pr.isEnemy && Math.random() < 0.5) { let newSa = { id: Math.random().toString(36).substring(2,9), x: pr.x, y: pr.y, angle: pr.angle, blockX: hitBlockRef.x, blockY: hitBlockRef.y, life: 18000 }; window.stuckArrows.push(newSa); window.sendWorldUpdate('spawn_stuck_arrow', newSa); window.playSound('arrow_stick'); } else if (isMyArrow && !pr.isEnemy) window.playSound('arrow_break');
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
                }
                if (!hitEnt && window.pvp && window.pvp.activeOpponent && window.game.isMultiplayer && pr.owner === window.socket?.id) {
                    const opPvp = window.otherPlayers && window.otherPlayers[window.pvp.activeOpponent];
                    if (opPvp && !opPvp.isDead && window.checkRectIntersection(pr.x, pr.y, 4, 4, opPvp.x, opPvp.y, opPvp.width||24, opPvp.height||40)) {
                        window.sendWorldUpdate('pvp_hit', { targetId: window.pvp.activeOpponent, sourceId: window.socket.id, dmg: pr.damage });
                        window.spawnDamageText(opPvp.x + (opPvp.width||24)/2, opPvp.y - 10, `-${Math.floor(pr.damage)}`, '#ff4444');
                        window.spawnParticles(pr.x, pr.y, '#ff4444', 5); hitEnt = true;
                    }
                }
                if(hitEnt) { window.playSound('arrow_hit_flesh'); window.projectiles.splice(i,1); continue; }
            }
            if(pr.life <= 0) window.projectiles.splice(i, 1);
        }

        let isMasterClient = true; if (window.game.isMultiplayer && window.otherPlayers) { let allIds = Object.keys(window.otherPlayers); allIds.push(window.socket?.id || ''); allIds.sort(); if (allIds[0] !== window.socket?.id) isMasterClient = false; }

        if (window.game.isRaining && isMasterClient && window.game.frameCount % 60 === 0) { 
            window.trees.forEach(t => { 
                if (t.isStump && t.regrowthCount < 3 && t.grownDay !== window.game.days) { 
                    let isOffScreen = (t.x < window.camera.x - 300 || t.x > window.camera.x + window._canvasLogicW + 300); 
                    if (isOffScreen && Math.random() < 0.2) { t.isStump = false; t.hp = 100; t.maxHp = 100; t.regrowthCount++; t.grownDay = window.game.days; window.sendWorldUpdate('grow_tree', { x: t.x, regrowthCount: t.regrowthCount, grownDay: t.grownDay }); } 
                } 
            }); 
        }

        let spawnRate = Math.max(150, 600 - (window.game.days * 20) - Math.floor(window.player.x / 50));
        if (isNight && window.game.frameCount % spawnRate === 0 && isMasterClient) { 
            let cx = window.player.x + 800; if (Math.random() > 0.5 && window.player.x - 800 > window.game.shoreX + 2000) cx = window.player.x - 800; 
            let distToShore = Math.abs(cx - window.game.shoreX); 
            let lvl = Math.max(1, Math.floor(distToShore / 4000)) + Math.max(0, window.game.days - 1);
            if (distToShore > 2000) { 
                let newEnt = null; let _spawnGY = window.getGroundY ? window.getGroundY(cx) : window.game.groundLevel;
                if (distToShore > 5000 && Math.random() < 0.35 && window.entities.filter(e => e.type === 'archer').length < 3) { newEnt = { id: 'en_'+Math.random().toString(36).substr(2,9), type: 'archer', name: 'Cazador', level: lvl, x: cx, y: _spawnGY - 40, width: 20, height: 40, vx: (window.player.x > cx ? 0.8 : -0.8), vy: 0, hp: 20 + (lvl * 12), maxHp: 20 + (lvl * 12), damage: 5 + (lvl * 2), isHit: false, attackCooldown: 0, stuckFrames: 0, ignorePlayer: 0, lastX: cx }; } 
                else if (window.entities.filter(e => e.type === 'zombie').length < 3) { newEnt = { id: 'en_'+Math.random().toString(36).substr(2,9), type: 'zombie', name: 'Mutante', level: lvl, x: cx, y: _spawnGY - 44, width: 24, height: 44, vx: (window.player.x > cx ? 0.4 : -0.4), vy: 0, hp: 35 + (lvl * 15), maxHp: 35 + (lvl * 15), damage: 8 + (lvl * 3), isHit: false, attackCooldown: 0, stuckFrames: 0, ignorePlayer: 0, lastX: cx }; }
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
            
            if (ent.y + ent.height >= _entGroundY) { ent.y = _entGroundY - ent.height; ent.vy = 0; } else if (ent.vy >= 0 && ent.y + ent.height >= _entGroundY - 22) { ent.y = _entGroundY - ent.height; ent.vy = 0; }
            
            let targetPlayer = window.player; let targetCX = pCX, targetCY = pCY; let minDist = Math.hypot(pCX - (ent.x + ent.width/2), pCY - (ent.y + ent.height/2));
            if (window.game.isMultiplayer && window.otherPlayers) { Object.values(window.otherPlayers).forEach(op => { if (op.isDead) return; let opCX = op.x + (op.width||24)/2; let opCY = op.y + (op.height||40)/2; let dist = Math.hypot(opCX - (ent.x + ent.width/2), opCY - (ent.y + ent.height/2)); if (dist < minDist) { minDist = dist; targetPlayer = op; targetCX = opCX; targetCY = opCY; } }); }

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

                    if (isGrounded && window.getGroundY) {
                        const lookDist = window.game.blockSize * 1.5;
                        const groundHere  = window.getGroundY(ent.x + ent.width / 2);
                        const groundAhead = window.getGroundY(ent.x + ent.width / 2 + dirX * lookDist);
                        if (groundAhead < groundHere - window.game.blockSize * 0.4) { ent.vy = ent.type === 'zombie' ? -7 : -9; ent.stuckFrames = 0; }
                    }

                    if (hitWall || Math.abs(ent.x - lastX) < 0.1) {
                        ent.stuckFrames++;
                        const hasBarricadeAhead = window.blocks.some(b => b.type === 'barricade' && Math.abs((ent.x + ent.width/2) - (b.x + window.game.blockSize/2)) < ent.width + 5 && Math.abs((ent.y + ent.height/2) - (b.y + window.game.blockSize/2)) < ent.height + 5);
                        if (ent.stuckFrames > 20 && isGrounded) { ent.vy = ent.type === 'zombie' ? -7 : -9; if (ent.stuckFrames > 60 && ent.type !== 'zombie' && !hasBarricadeAhead) { ent.ignorePlayer = 180; ent.vx = -dirX * _spd * 1.5; ent.stuckFrames = 0; } }
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
                    if (minDist > 500) ent.vx = dirX * 0.9; else if (minDist < 250) ent.vx = -dirX * 1.1; else ent.vx = 0;

                    if (isGrounded && window.getGroundY && ent.vx !== 0) {
                        const mvDir = ent.vx > 0 ? 1 : -1; const groundHere  = window.getGroundY(ent.x + ent.width / 2); const groundAhead = window.getGroundY(ent.x + ent.width / 2 + mvDir * window.game.blockSize * 1.5);
                        if (groundAhead < groundHere - window.game.blockSize * 0.4) { ent.vy = -7; ent.stuckFrames = 0; }
                    }

                    if (hitWall || (Math.abs(ent.x - lastX) < 0.1 && ent.vx !== 0)) {
                        ent.stuckFrames++;
                        if (ent.stuckFrames > 20 && isGrounded) { ent.vy = -7; }
                        if (ent.stuckFrames > 60) { ent.ignorePlayer = 60; ent.stuckFrames = 0; }
                    } else { ent.stuckFrames = 0; }

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

        if (window.game.zoomTarget !== undefined) { window.game.zoom += (window.game.zoomTarget - window.game.zoom) * 0.12; }
        const _W = window._canvasLogicW || 1280; const _H = window._canvasLogicH || 720;
        window.camera.x = window.player.x + window.player.width/2 - _W/2;

        {
            if (window.camera._targetY === undefined) window.camera._targetY = window.player.y + window.player.height - _H * 0.62;
            const targetCamY = window.player.y + window.player.height - _H * 0.62;
            window.camera._targetY += (targetCamY - window.camera._targetY) * 0.08;
            window.camera.y = window.camera._targetY;
        }
        
        if (window.camera.x < window.game.shoreX - _W/2) window.camera.x = window.game.shoreX - _W/2;
        if (window.player.x + (window._canvasLogicW / 2) > window.game.exploredRight) { window.generateWorldSector(window.game.exploredRight, window.game.exploredRight + window.game.chunkSize); window.game.exploredRight += window.game.chunkSize; }

        for (let i = window.particles.length - 1; i >= 0; i--) { let p = window.particles[i]; p.x += p.vx; p.y += p.vy; p.vy += window.game.gravity * 0.4; p.life -= p.decay; let _pGY = window.getGroundY ? window.getGroundY(p.x) : window.game.groundLevel; if (p.y >= _pGY) { p.y = _pGY; p.vy = -p.vy * 0.5; p.vx *= 0.8; } if (p.life <= 0.05 || isNaN(p.life)) window.particles.splice(i, 1); }
        // Actualizar partículas de polvo/humo
        if (!window.dustParticles) window.dustParticles = [];
        for (let i = window.dustParticles.length - 1; i >= 0; i--) {
            const d = window.dustParticles[i];
            d.x += d.vx; d.y += d.vy;
            d.vx *= 0.92; d.vy *= 0.88;
            d.life -= d.decay;
            d.r += d.growRate; // crece con el tiempo
            if (d.life <= 0) window.dustParticles.splice(i, 1);
        }
        for (let i = window.damageTexts.length - 1; i >= 0; i--) { let dt = window.damageTexts[i]; dt.y -= 0.2; dt.life -= 0.008; if (dt.life <= 0.05 || isNaN(dt.life)) window.damageTexts.splice(i, 1); }

        if (window.game.frameCount % 60 === 0 && !window.player.isDead) { window.player.hunger -= isMoving ? 0.1 : 0.02; if (window.player.hunger <= 0) { window.player.hunger = 0; window.damagePlayer(2, 'Hambre'); } if (window.player.hunger > 50 && window.player.hp < window.player.maxHp) { window.player.hp += 0.5; if(typeof window.updateUI==='function') window.updateUI(); } }
        
        if (typeof window.updateEntityHUD === 'function') window.updateEntityHUD();
    } catch (err) { console.error("Motor de juego protegido:", err); }
}

window.gameLoop = function() { if (window.game && window.game.isRunning) { update(); } if (typeof window.draw === 'function') { window.draw(); } requestAnimationFrame(window.gameLoop); };

window.addEventListener('DOMContentLoaded', () => { window.gameLoop(); });
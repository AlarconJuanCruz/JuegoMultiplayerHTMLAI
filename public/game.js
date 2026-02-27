// === game.js - MOTOR PRINCIPAL (REFACTORIZADO) ===
// Responsabilidades de este archivo:
//   - Comunicación con servidor (sendWorldUpdate)
//   - startGame() y manejo de socket
//   - Sistema PVP
//   - Input handlers (teclado, ratón, rueda)
//   - tryHit*, attemptAction
//   - Loop principal update() + gameLoop()
//
// Funciones movidas a módulos separados:
//   physics.js   → checkBlockCollisions, checkEntityCollisions,
//                   isValidPlacement, isAdjacentToBlockOrGround,
//                   isOnLadder, isOverlappingSolidBlock,
//                   applyStairPhysicsPlayer, applyStairPhysicsEntity
//   entities.js  → generateWorldSector, updateEntities, killEntityLoot
//   terrain.js   → getGroundY, generateSeed, setSeedFromCode, applySeed
//   inventory.js → canAddItem, tryAddItem, autoEquip, getBlockRefund

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

window.startGame = function(multiplayer, ip = null, roomId = null) {
    window._currentRoomId = roomId;
    const nameInput = window.getEl('player-name'); 
    let rawName = (nameInput && nameInput.value) ? nameInput.value.trim() : "Jugador " + Math.floor(Math.random()*1000);
    window.player.name = rawName.substring(0, 15);

    let menu = window.getEl('main-menu'); if(menu) menu.style.display = 'none'; let ui = window.getEl('ui-layer'); if(ui) ui.style.display = 'block';
    window.game.isRunning = true; window.game.isMultiplayer = multiplayer;

    // --- CÓDIGO NUEVO: Mostrar el botón de Sala si es multijugador ---
    let btnServerMenu = window.getEl('btn-server-menu');
    if (btnServerMenu) btnServerMenu.style.display = multiplayer ? 'inline-block' : 'none';
    // -----------------------------------------------------------------

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
            const connectionURL = ip ? `http://${ip}:3000` : window.BACKEND_URL; 
            window.socket = io(connectionURL);
 
            let sInfo = window.getEl('server-info'); if(sInfo) { sInfo.style.display = 'flex'; window.getEl('sv-ip').innerText = roomId ? 'Sala ' + roomId : (ip ? ip : 'Global'); }
            if (ip && ip !== window.location.hostname && ip !== 'localhost' && ip !== '127.0.0.1') { let list = JSON.parse(localStorage.getItem('savedServers') || '[]'); if (!list.includes(ip)) { list.push(ip); localStorage.setItem('savedServers', JSON.stringify(list)); if(window.refreshServerList) window.refreshServerList(); } }
            
            // Enviamos la semilla del host por si es el primer jugador en entrar
            window.socket.on('connect', () => {
                const _pd = { name: window.player.name, x: window.player.x, y: window.player.y, level: window.player.level, seedCode: window.seedCode };
                if (window._currentRoomId) {
                    window.socket.emit('joinRoom', { roomId: window._currentRoomId, playerData: _pd });
                } else {
                    window.socket.emit('joinGame', _pd);
                }
            });
            
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
                    op.isClimbing = pInfo.isClimbing || false; op.isGrounded = pInfo.isGrounded || false;
                    
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
            window.socket.on('roomError', (err) => { alert('⚠️ ' + err.message); window.location.reload(); });

            window.socket.on('roomListUpdate', (list) => {
                window._serverRoomList = list;
                if (typeof window.renderRoomList === 'function') window.renderRoomList(list);
            });
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
    // Priorizar entidad bajo el cursor, luego la más cercana al jugador
    let target = null;
    if (window.hoveredEntity && !window.hoveredEntity.isDead) {
        const hd = Math.hypot(pCX - (window.hoveredEntity.x+window.hoveredEntity.width/2), pCY - (window.hoveredEntity.y+window.hoveredEntity.height/2));
        if (hd <= range) target = window.hoveredEntity;
    }
    if (!target) {
        let minD = Infinity;
        for (let _e of window.entities) {
            const d = Math.hypot(pCX - (_e.x+_e.width/2), pCY - (_e.y+_e.height/2));
            if (d <= range && d < minD) { minD = d; target = _e; }
        }
    }
    const _hitFn = (target) => {
        let i = window.entities.indexOf(target);
        if (i === -1) return false;
        let ent = target;
        {
                ent.hp -= dmg; window.setHit(ent); window.spawnParticles(ent.x + ent.width/2, ent.y + ent.height/2, '#ff4444', 5);
                if (window.playSound) window.playSound('hit_entity');
                window.spawnDamageText(ent.x+ent.width/2+(Math.random()-0.5)*16, ent.y-5-Math.random()*8, `-${dmg}`, 'melee');
                ent.vx = (ent.x+ent.width/2 > pCX ? 1 : -1) * 3.5; ent.vy = -5.0; ent.knockbackFrames = 10;
                window.player.meleeCooldown = 18;
                if (ent.hp <= 0) {
                    window.killedEntities.push(ent.id);
                    window.sendWorldUpdate('kill_entity', { id: ent.id });
                    window.spawnParticles(ent.x, ent.y, '#ff4444', 15);
                    window.killEntityLoot(ent);   // ← entities.js (centralizado)
                    window.entities.splice(i, 1);
                    if (window.updateUI) window.updateUI();
                } else { window.sendWorldUpdate('hit_entity', { id: ent.id, dmg: dmg }); if (ent.type === 'chicken') { ent.fleeTimer = 180; ent.fleeDir = (ent.x > pCX) ? 1 : -1; window.sendWorldUpdate('flee_entity', { id: ent.id, dir: ent.fleeDir }); } }
                return true;
        }
        return false;
    };
    if (target) return _hitFn(target);
    return false;
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
            } else {
                // Feedback sin materiales — se dispara en cada click (mousedown lo maneja)
                // Aquí solo mostramos el texto flotante con cooldown para no saturar al mantener click
                if (!window._noMatCooldown || window.game.frameCount - window._noMatCooldown > 20) {
                    window._noMatCooldown = window.game.frameCount;
                    window.spawnDamageText(window.mouseWorldX, window.mouseWorldY - 10, `¡Faltan ${cost} madera!`, '#ff6b6b');
                    if (window.playSound) window.playSound('arrow_break');
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
            
            // --- CÓDIGO NUEVO: Feedback de sin materiales para colocar objetos ---
            if (!window.player.inventory[window.player.placementMode] || window.player.inventory[window.player.placementMode] <= 0) {
                window.spawnDamageText(window.mouseWorldX, window.mouseWorldY - 10, "¡Sin materiales!", "#ff4444");
                if (window.playSound) window.playSound('arrow_break');
                window.player.placementMode = null;
                if (window.renderToolbar) window.renderToolbar();
                return;
            }

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
    
    if (e.button === 0) {
        window.attemptAction();
    }
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
        let pCX = window.player.x + window.player.width / 2;
        let pCY = window.player.y + window.player.height / 2;

        // ── Mundo mouse ──────────────────────────────────────────────────────
        const _W = window._canvasLogicW || 1280;
        const _H = window._canvasLogicH || 720;
        const _z = window.game.zoom || 1;
        window.mouseWorldX = (window.screenMouseX - _W / 2) / _z + window.camera.x + _W / 2;
        window.mouseWorldY = (window.screenMouseY - _H / 2) / _z + window.camera.y + _H / 2;

        // Entidad bajo el cursor
        window.hoveredEntity = null;
        let _bestDist = Infinity;
        for (const _he of window.entities) {
            if (_he.x < window.mouseWorldX && _he.x + _he.width > window.mouseWorldX &&
                _he.y < window.mouseWorldY && _he.y + _he.height > window.mouseWorldY) {
                const _hd = Math.hypot(window.mouseWorldX - (_he.x + _he.width / 2), window.mouseWorldY - (_he.y + _he.height / 2));
                if (_hd < _bestDist) { _bestDist = _hd; window.hoveredEntity = _he; }
            }
        }

        // ── Contadores globales ───────────────────────────────────────────────
        window.game.frameCount++;
        if (window.game.screenShake > 0) window.game.screenShake--;
        if (window.player.attackFrame > 0) window.player.attackFrame--;
        if ((window.player.meleeCooldown || 0) > 0) window.player.meleeCooldown--;

        // ── Antorcha: consumo de durabilidad ──────────────────────────────────
        if (window.game.frameCount % 60 === 0 && !window.player.isDead) {
            if (window.player.activeTool === 'torch' && window.player.toolHealth?.torch) {
                window.player.toolHealth.torch--;
                if (window.renderToolbar) window.renderToolbar();
                if (window.player.toolHealth.torch <= 0) {
                    window.player.toolbar[window.player.activeSlot] = null;
                    window.selectToolbarSlot(0);
                    window.spawnDamageText(pCX, window.player.y - 20, '¡Antorcha Apagada!', '#ff4444');
                    if (window.renderToolbar) window.renderToolbar();
                }
            }
        }

        // ── Carga del arco ────────────────────────────────────────────────────
        if (window.player.isCharging) {
            window.player.chargeLevel += 1.0 * (1 + window.player.stats.agi * 0.2);
            if (window.player.chargeLevel > 100) window.player.chargeLevel = 100;
        }

        // ── Tiempo del mundo ──────────────────────────────────────────────────
        const currentUptime = window.game.serverStartTime
            ? (Date.now() - window.game.serverStartTime)
            : (window.game.frameCount * (1000 / 60));
        const totalFrames = Math.floor(currentUptime / (1000 / 60)) + 28800;
        const dayFloat    = totalFrames / 86400;
        window.game.days  = Math.floor(dayFloat) + 1;
        const hourFloat   = (totalFrames / 3600) % 24;
        const clockH      = Math.floor(hourFloat);
        const clockM      = Math.floor((totalFrames % 3600) / 60);
        const isNight     = hourFloat >= 23 || hourFloat < 5;
        const isDay       = hourFloat >= 6  && hourFloat < 18;

        // ── Lluvia ────────────────────────────────────────────────────────────
        const nSeed = ((Math.sin(window.game.days * 8765.4) + 1) / 2);
        window.game.isRaining = false;
        if (nSeed > 0.65) {
            const rainStart = 9 + nSeed * 4;
            const rainEnd   = rainStart + 1 + nSeed * 1.5;
            window.game.isRaining = isDay && hourFloat >= rainStart && hourFloat <= rainEnd;
        }

        // ── Sanidad de velocidades ────────────────────────────────────────────
        if (!isFinite(window.player.vx)) window.player.vx = 0;
        if (!isFinite(window.player.vy)) window.player.vy = 0;

        // ── Orientación ───────────────────────────────────────────────────────
        if (!window.player.isAiming && window.player.attackFrame <= 0 && !window.player.isDead) {
            if (window.player.vx > 0.1)       window.player.facingRight = true;
            else if (window.player.vx < -0.1)  window.player.facingRight = false;
        }

        // ── Estado muerto ─────────────────────────────────────────────────────
        if (window.player.isDead) {
            window.player.vx = 0;
            window.player.isStealth = false;
            window.player.isClimbing = false;
            const pO = window.getEl('placement-overlay');
            if (pO) pO.style.display = 'none';
            if ((window.player.deathAnimFrame || 0) > 0) window.player.deathAnimFrame--;
        }

        if ((window.player.pvpHitFlash || 0) > 0) window.player.pvpHitFlash--;

        // ── Modo fondo (Shift) ────────────────────────────────────────────────
        if (window.keys && window.keys.shift) window.player.wantsBackground = true;
        else window.player.wantsBackground = false;

        if (!window.player.isDead && !window.player.wantsBackground) {
            if (!window.isOverlappingSolidBlock()) window.player.inBackground = false;
        } else if (!window.player.isDead) {
            window.player.inBackground = true;
        }

        // ── Movimiento horizontal ─────────────────────────────────────────────
        if (!window.player.isDead) {
            const pO = window.getEl('placement-overlay');
            if (pO) pO.style.display = window.player.placementMode ? 'block' : 'none';

            const accel = window.player.isGrounded ? 0.6 : 0.4;
            const fric  = window.player.isGrounded ? 0.8 : 0.95;
            if (window.keys?.a) window.player.vx -= accel;
            if (window.keys?.d) window.player.vx += accel;
            window.player.vx *= fric;
            window.player.vx = Math.max(-window.player.speed, Math.min(window.player.speed, window.player.vx));
        }

        const isMoving = Math.abs(window.player.vx) > 0.2 || !window.player.isGrounded;
        window.player.isStealth = window.player.inBackground && !isMoving && window.player.attackFrame <= 0 && !window.player.isDead;

        // ── HUD de reloj y distancia ──────────────────────────────────────────
        const timeText = `${String(clockH).padStart(2,'0')}:${String(clockM).padStart(2,'0')}`;
        const cDisp = window.getEl('clock-display');
        if (cDisp) {
            cDisp.innerText = window.player.isStealth
                ? `[OCULTO] Día ${window.game.days} - ${timeText}`
                : `Día ${window.game.days} - ${timeText}`;
            cDisp.classList.toggle('stealth-mode', window.player.isStealth);
        }
        const dTxt = window.getEl('dist-text');
        if (dTxt) dTxt.innerText = `${Math.max(0, Math.floor((window.player.x - window.game.shoreX) / 10))}m`;

        // ── Animación de caminar ──────────────────────────────────────────────
        if (Math.abs(window.player.vx) > 0.5 && window.player.isGrounded)
            window.player.animTime += Math.abs(window.player.vx) * 0.025;
        else
            window.player.animTime = 0;

        // ── Física X ──────────────────────────────────────────────────────────
        window.player.x += window.player.vx;
        if (window.player.x < window.game.shoreX) {
            window.player.x = window.game.shoreX;
            if (window.player.vx < 0) window.player.vx = 0;
        }
        window.checkBlockCollisions('x');   // ← physics.js

        // ── Escalera ──────────────────────────────────────────────────────────
        const _onLadder = !window.player.isDead && window.isOnLadder();

        if (_onLadder) {
            if (!window.player.isClimbing) {
                if (window.player.vy > 1.5 || window.keys?.jumpPressed)
                    window.player.isClimbing = true;
            }
            if (window.player.isClimbing) {
                if (window.keys?.jumpPressed) window.player.vy = -2.5;
                else if (window.keys?.s)       window.player.vy =  2.5;
                else                            window.player.vy =  0;
                if (window.keys && (window.keys.a || window.keys.d) && !window.keys.jumpPressed && !window.keys.s) {
                    window.player.isClimbing = false;
                    window.player.vy = -2.0;
                }
                window.player.isGrounded = false;
                window.player.isJumping  = false;
                window.player.coyoteTime = 10;
            } else {
                window.player.vy += window.game.gravity;
            }
        } else {
            if (window.player.isClimbing) window.player.isClimbing = false;
            window.player.vy += window.game.gravity;
        }
        const _isClimbing = window.player.isClimbing && _onLadder;

        // ── Física Y ──────────────────────────────────────────────────────────
        window.player.isGrounded = false;
        window.player.y += window.player.vy;
        window.checkBlockCollisions('y');   // ← physics.js

        // ── Rampas ────────────────────────────────────────────────────────────
        window.applyStairPhysicsPlayer();   // ← physics.js

        // ── Colisión con suelo ────────────────────────────────────────────────
        const _pGroundY = window.getGroundY ? window.getGroundY(window.player.x + window.player.width / 2) : window.game.groundLevel;
        const footY     = window.player.y + window.player.height;

        if (footY > _pGroundY) {
            window.player.y  = _pGroundY - window.player.height;
            window.player.vy = 0;
            window.player.isGrounded = true;
            if (_isClimbing) window.player.isClimbing = false;
        } else if (!window.player.isGrounded && window.player.coyoteTime > 0 && window.player.vy >= 0 && footY >= _pGroundY - 22) {
            window.player.y  = _pGroundY - window.player.height;
            window.player.vy = 0;
            window.player.isGrounded = true;
            if (_isClimbing) window.player.isClimbing = false;
        }

        if (window.player.isGrounded || _isClimbing) {
            window.player.coyoteTime = 10;
            window.player.isJumping  = false;
        } else {
            window.player.coyoteTime--;
        }

        // ── Polvo al correr ────────────────────────────────────────────────────
        if (window.player.isGrounded && Math.abs(window.player.vx) > 1.5 && !window.player.isDead && !_isClimbing && window.game.frameCount % 5 === 0) {
            window.spawnDustPuff(
                window.player.x + window.player.width / 2 + (window.player.facingRight ? -8 : 8),
                window.player.y + window.player.height,
                window.player.facingRight
            );
        }

        // ── Salto ─────────────────────────────────────────────────────────────
        if (window.keys?.jumpPressed && window.player.jumpKeyReleased && window.player.coyoteTime > 0 && !window.player.isJumping && !window.player.isDead && !_isClimbing) {
            window.player.vy = window.player.jumpPower;
            window.player.isJumping  = true;
            window.player.coyoteTime = 0;
            window.player.jumpKeyReleased = false;
        }
        if (window.keys && !window.keys.jumpPressed && window.player.vy < 0 && !_isClimbing)
            window.player.vy *= 0.5;

        // ── Acción con mouse sostenido ────────────────────────────────────────
        if (window.keys?.mouseLeft && !window.player.isDead) window.attemptAction();

        // ── Sync multijugador ─────────────────────────────────────────────────
        if (window.game.isMultiplayer) {
            if (window.socket && (window.game.frameCount % 2 === 0 || window.player.attackFrame > 0 || window.player.isAiming || window.player.isDead || window.player.isTyping !== window.player._lastTypingState)) {
                window.socket.emit('playerMovement', {
                    x: window.player.x, y: window.player.y,
                    vx: window.player.vx, vy: window.player.vy,
                    isGrounded: window.player.isGrounded,
                    facingRight: window.player.facingRight,
                    activeTool: window.player.activeTool,
                    animTime: window.player.animTime,
                    attackFrame: window.player.attackFrame,
                    isAiming: window.player.isAiming,
                    isCharging: window.player.isCharging,
                    chargeLevel: window.player.chargeLevel,
                    mouseX: window.mouseWorldX, mouseY: window.mouseWorldY,
                    isDead: window.player.isDead, level: window.player.level,
                    isTyping: window.player.isTyping || false,
                    isDancing: window.player.isDancing || false,
                    danceStart: window.player.danceStart || 0,
                    deathAnimFrame: window.player.deathAnimFrame || 0,
                    isClimbing: window.player.isClimbing || false
                });
                window.player._lastTypingState = window.player.isTyping;
            }
            if (window.otherPlayers) {
                for (const op of Object.values(window.otherPlayers)) {
                    if (op.targetX !== undefined) {
                        op.x += (op.targetX - op.x) * 0.35;
                        op.y += (op.targetY - op.y) * 0.35;
                    }
                    if ((op.pvpHitFlash || 0) > 0) op.pvpHitFlash--;
                    if (op.isDead && (op.deathAnimFrame || 0) > 0) op.deathAnimFrame--;
                }
            }
        }

        // ── Tumbas expiradas ──────────────────────────────────────────────────
        window.blocks = window.blocks.filter(b => {
            if (b.type === 'grave' && Date.now() - b.createdAt > 300000) {
                window.spawnParticles(b.x + 15, b.y + 15, '#7f8c8d', 15);
                window.sendWorldUpdate('destroy_grave', { id: b.id });
                return false;
            }
            return true;
        });

        // ── Bloques activos (hoguera, barricada) ──────────────────────────────
        window.blocks.forEach(b => {
            if (b.type === 'campfire' && b.isBurning) {
                b.burnTime--;
                if (window.game.frameCount % 5 === 0) window.spawnParticles(b.x + 15, b.y + 10, '#e67e22', 1, 0.5);
                if (b.meat > 0) {
                    b.cookTimer++;
                    if (b.cookTimer > 300) { b.meat--; b.cooked++; b.cookTimer = 0; if (window.currentCampfire === b && window.renderCampfireUI) window.renderCampfireUI(); }
                }
                if (window.game.isRaining) {
                    const hasRoof = window.blocks.some(r => (r.type === 'block' || r.type === 'door') && r.x === b.x && r.y < b.y);
                    if (!hasRoof) {
                        b.rainExtinguishTimer = (b.rainExtinguishTimer || 0) + 1;
                        if (b.rainExtinguishTimer > 150) {
                            b.isBurning = false; b.rainExtinguishTimer = 0;
                            window.spawnParticles(b.x + 15, b.y + 15, '#aaaaaa', 10, 0.5);
                            if (window.currentCampfire === b && window.renderCampfireUI) window.renderCampfireUI();
                            window.sendWorldUpdate('update_campfire', { x: b.x, y: b.y, wood: b.wood, meat: b.meat, cooked: b.cooked, isBurning: false });
                        }
                    } else { b.rainExtinguishTimer = 0; }
                } else { b.rainExtinguishTimer = 0; }
                if (b.burnTime <= 0) {
                    if (b.wood > 0) { b.wood--; b.burnTime = 1800; }
                    else             { b.isBurning = false; }
                    if (window.currentCampfire === b && window.renderCampfireUI) window.renderCampfireUI();
                }
            }

            if (b.type === 'barricade') {
                window.entities.forEach(ent => {
                    if (window.checkRectIntersection(ent.x, ent.y, ent.width, ent.height, b.x, b.y, window.game.blockSize, window.game.blockSize) && window.game.frameCount % 30 === 0) {
                        ent.hp -= 5; b.hp -= 10;
                        window.setHit(ent); window.setHit(b);
                        window.spawnParticles(ent.x + ent.width / 2, ent.y + ent.height / 2, '#ff4444', 5);
                        window.spawnParticles(b.x + 15, b.y + 15, '#bdc3c7', 3);
                        if (b.hp <= 0) window.destroyBlockLocally(b);
                        else window.sendWorldUpdate('hit_block', { x: b.x, y: b.y, dmg: 10 });
                    }
                });
            }
        });

        // ── Flechas clavadas ──────────────────────────────────────────────────
        for (let i = window.stuckArrows.length - 1; i >= 0; i--) {
            const sa = window.stuckArrows[i];
            sa.life--;
            if (sa.blockX !== undefined && !window.blocks.some(b => b.x === sa.blockX && b.y === sa.blockY)) sa.life = 0;
            if (sa.life <= 0) window.stuckArrows.splice(i, 1);
        }

        // ── Prompts de interacción ────────────────────────────────────────────
        pCX = window.player.x + window.player.width / 2;
        pCY = window.player.y + window.player.height / 2;

        let interactables = window.blocks.filter(b =>
            ['box','campfire','door','grave'].includes(b.type) &&
            window.checkRectIntersection(window.player.x - 15, window.player.y - 15, window.player.width + 30, window.player.height + 30, b.x, b.y, window.game.blockSize, b.type === 'door' ? window.game.blockSize * 2 : window.game.blockSize)
        );
        if (interactables.length > 1) {
            interactables.sort((a, b) => {
                const aCX = a.x + window.game.blockSize / 2, bCX = b.x + window.game.blockSize / 2;
                const aF = window.player.facingRight ? (aCX >= pCX) : (aCX <= pCX);
                const bF = window.player.facingRight ? (bCX >= pCX) : (bCX <= pCX);
                if (aF && !bF) return -1; if (!aF && bF) return 1;
                return Math.abs(aCX - pCX) - Math.abs(bCX - pCX);
            });
        }

        const promptEl = window.getEl('interaction-prompt');
        const textEl   = window.getEl('prompt-text');
        window.player.nearbyItem = null;
        let anyItemHovered = false;

        // ── Items en suelo ────────────────────────────────────────────────────
        for (let i = window.droppedItems.length - 1; i >= 0; i--) {
            const item = window.droppedItems[i];
            const s    = window.itemDefs[item.type].size;
            const d    = Math.hypot(pCX - item.x, pCY - item.y);

            if (window.keys?.y && d < 250 && !window.player.isDead) {
                item.x += (pCX - item.x) * 0.15;
                item.y += (pCY - item.y) * 0.15;
                item.vy = 0;
                if (d < 25) {
                    if (window.canAddItem(item.type, item.amount)) {
                        window.player.inventory[item.type] = (window.player.inventory[item.type] || 0) + item.amount;
                        window.droppedItems.splice(i, 1);
                        window.sendWorldUpdate('pickup_item', { id: item.id });
                        if (window.playSound) window.playSound('pickup');
                        if (window.toolDefs[item.type] && typeof window.autoEquip === 'function') window.autoEquip(item.type);
                        window.spawnParticles(pCX, pCY, window.itemDefs[item.type].color, 5);
                        if (window.updateUI) window.updateUI();
                        continue;
                    } else if (window.game.frameCount % 60 === 0) {
                        window.spawnDamageText(pCX, pCY - 30, 'Inv. Lleno', '#fff');
                    }
                }
            } else {
                item.vy += window.game.gravity * 0.5;
                item.x  += item.vx; item.y += item.vy;
                item.vx *= 0.95;
                const _iGY = window.getGroundY ? window.getGroundY(item.x) : window.game.groundLevel;
                if (item.y + s >= _iGY) { item.y = _iGY - s; item.vy *= -0.5; item.vx *= 0.8; }
                for (const b of window.blocks) {
                    if ((b.type === 'door' && b.open) || b.type === 'box' || b.type === 'campfire' || b.type === 'bed' || b.type === 'barricade') continue;
                    const bh = b.type === 'door' ? window.game.blockSize * 2 : window.game.blockSize;
                    if (window.checkRectIntersection(item.x, item.y, s, s, b.x, b.y, window.game.blockSize, bh) && item.vy > 0 && item.y + s - item.vy <= b.y) {
                        item.y = b.y - s; item.vy *= -0.5; item.vx *= 0.8;
                    }
                }
                if (d < 60 && !window.player.isDead) { anyItemHovered = true; window.player.nearbyItem = item; }
            }
            item.life += 0.05;
        }

        const hoveringArrow = window.stuckArrows.find(sa => Math.hypot(pCX - sa.x, pCY - sa.y) < 60);

        if (promptEl && textEl) {
            if (interactables.length > 0 && !document.querySelector('.window-menu.open') && !window.player.isDead) {
                const h = interactables[0];
                if (h.type !== 'bed') {
                    const tName = { box: 'Caja', campfire: 'Fogata', grave: 'Tumba', door: 'Puerta' }[h.type] || h.type;
                    promptEl.style.display = 'block';
                    textEl.innerHTML = `Presiona <span class="key-btn">E</span> para usar <span style="color:#D2B48C;">${tName}</span>`;
                } else { promptEl.style.display = 'none'; }
            } else if (hoveringArrow && !window.player.isDead) {
                promptEl.style.display = 'block';
                textEl.innerHTML = `Presiona <span class="key-btn">E</span> para agarrar <strong style="color:#ccc;">Flecha</strong>`;
            } else if (anyItemHovered && window.player.nearbyItem && !window.player.isDead) {
                const itd = window.itemDefs[window.player.nearbyItem.type];
                if (itd) {
                    const amtTxt = window.player.nearbyItem.amount > 1 ? ` x${window.player.nearbyItem.amount}` : '';
                    promptEl.style.display = 'block';
                    textEl.innerHTML = `Mantén <span class="key-btn">Y</span> para recoger <strong style="color:${itd.color};">${itd.name}${amtTxt}</strong>`;
                } else { promptEl.style.display = 'none'; }
            } else { promptEl.style.display = 'none'; }
        }

        // ── Proyectiles ───────────────────────────────────────────────────────
        for (let i = window.projectiles.length - 1; i >= 0; i--) {
            const pr = window.projectiles[i];
            pr.x += pr.vx; pr.vy += window.game.gravity * 0.4; pr.y += pr.vy;
            pr.angle = Math.atan2(pr.vy, pr.vx); pr.life--;
            const isMyArrow = pr.owner === window.socket?.id || !window.game.isMultiplayer;
            const _prGY = window.getGroundY ? window.getGroundY(pr.x) : window.game.groundLevel;

            if (pr.y >= _prGY || pr.x < window.game.shoreX) {
                if (isMyArrow && !pr.isEnemy && Math.random() < 0.5) {
                    const sa = { id: Math.random().toString(36).substring(2, 9), x: pr.x, y: _prGY, angle: pr.angle, life: 18000 };
                    window.stuckArrows.push(sa); window.sendWorldUpdate('spawn_stuck_arrow', sa);
                } else if (isMyArrow && !pr.isEnemy) { if (window.playSound) window.playSound('arrow_break'); }
                window.spawnParticles(pr.x, pr.y, '#557A27', 3);
                window.projectiles.splice(i, 1); continue;
            }

            let hitBlock = null;
            for (const b of window.blocks) {
                const bh = b.type === 'door' ? window.game.blockSize * 2 : window.game.blockSize;
                if (!b.open && b.type !== 'box' && b.type !== 'campfire' && b.type !== 'barricade' && window.checkRectIntersection(pr.x, pr.y, 4, 4, b.x, b.y, window.game.blockSize, bh)) { hitBlock = b; break; }
            }
            if (hitBlock) {
                if (isMyArrow && !pr.isEnemy && Math.random() < 0.5) {
                    const sa = { id: Math.random().toString(36).substring(2, 9), x: pr.x, y: pr.y, angle: pr.angle, blockX: hitBlock.x, blockY: hitBlock.y, life: 18000 };
                    window.stuckArrows.push(sa); window.sendWorldUpdate('spawn_stuck_arrow', sa); if (window.playSound) window.playSound('arrow_stick');
                } else if (isMyArrow && !pr.isEnemy) { if (window.playSound) window.playSound('arrow_break'); }
                window.spawnParticles(pr.x, pr.y, '#C19A6B', 5);
                window.projectiles.splice(i, 1); continue;
            }

            if (pr.isEnemy) {
                if (!window.player.inBackground && !window.player.isDead && window.checkRectIntersection(pr.x, pr.y, 4, 4, window.player.x, window.player.y, window.player.width, window.player.height)) {
                    window.damagePlayer(pr.damage, 'Flecha de Cazador');
                    window.spawnParticles(pr.x, pr.y, '#ff4444', 5);
                    window.projectiles.splice(i, 1); continue;
                }
            } else {
                let hitEnt = false;
                for (let e = window.entities.length - 1; e >= 0; e--) {
                    const ent = window.entities[e];
                    if (!window.checkRectIntersection(pr.x, pr.y, 4, 4, ent.x, ent.y, ent.width, ent.height)) continue;
                    ent.hp -= pr.damage; window.setHit(ent);
                    window.spawnDamageText(ent.x + ent.width / 2 + (Math.random() - 0.5) * 16, ent.y - Math.random() * 8, '-' + Math.floor(pr.damage), 'melee');
                    window.spawnParticles(pr.x, pr.y, '#ff4444', 5);
                    ent.vx = (pr.vx > 0 ? 1 : -1) * 2.0; ent.vy = -4.5; ent.knockbackFrames = 8;
                    if (ent.hp <= 0) {
                        window.killedEntities.push(ent.id);
                        window.sendWorldUpdate('kill_entity', { id: ent.id });
                        window.spawnParticles(ent.x, ent.y, '#ff4444', 15);
                        window.killEntityLoot(ent);    // ← entities.js
                        window.entities.splice(e, 1);
                        if (window.updateUI) window.updateUI();
                    } else { window.sendWorldUpdate('hit_entity', { id: ent.id, dmg: pr.damage }); if (ent.type === 'chicken') { ent.fleeTimer = 180; ent.fleeDir = ent.x > pr.x ? 1 : -1; window.sendWorldUpdate('flee_entity', { id: ent.id, dir: ent.fleeDir }); } }
                    if (window.playSound) window.playSound('arrow_hit_flesh');
                    hitEnt = true; break;
                }
                // PVP arrow
                if (!hitEnt && window.pvp?.activeOpponent && window.game.isMultiplayer && pr.owner === window.socket?.id) {
                    const opPvp = window.otherPlayers?.[window.pvp.activeOpponent];
                    if (opPvp && !opPvp.isDead && window.checkRectIntersection(pr.x, pr.y, 4, 4, opPvp.x, opPvp.y, opPvp.width || 24, opPvp.height || 40)) {
                        window.sendWorldUpdate('pvp_hit', { targetId: window.pvp.activeOpponent, sourceId: window.socket.id, dmg: pr.damage });
                        window.spawnDamageText(opPvp.x + (opPvp.width || 24) / 2, opPvp.y - 10, `-${Math.floor(pr.damage)}`, '#ff4444');
                        window.spawnParticles(pr.x, pr.y, '#ff4444', 5);
                        hitEnt = true;
                    }
                }
                if (hitEnt) { window.projectiles.splice(i, 1); continue; }
            }
            if (pr.life <= 0) window.projectiles.splice(i, 1);
        }

        // ── Master client: regrowth + spawns nocturnos + sync ─────────────────
        let isMasterClient = true;
        if (window.game.isMultiplayer && window.otherPlayers) {
            const allIds = [...Object.keys(window.otherPlayers), window.socket?.id || ''].sort();
            if (allIds[0] !== window.socket?.id) isMasterClient = false;
        }

        if (window.game.isRaining && isMasterClient && window.game.frameCount % 60 === 0) {
            window.trees.forEach(t => {
                if (t.isStump && t.regrowthCount < 3 && t.grownDay !== window.game.days) {
                    const offScreen = t.x < window.camera.x - 300 || t.x > window.camera.x + _W + 300;
                    if (offScreen && Math.random() < 0.2) {
                        t.isStump = false; t.hp = 100; t.maxHp = 100; t.regrowthCount++; t.grownDay = window.game.days;
                        window.sendWorldUpdate('grow_tree', { x: t.x, regrowthCount: t.regrowthCount, grownDay: t.grownDay });
                    }
                }
            });
        }

        const spawnRate = Math.max(150, 600 - window.game.days * 20 - Math.floor(window.player.x / 50));
        if (isNight && window.game.frameCount % spawnRate === 0 && isMasterClient) {
            let cx = window.player.x + 800;
            if (Math.random() > 0.5 && window.player.x - 800 > window.game.shoreX + 2000) cx = window.player.x - 800;
            const distShore = Math.abs(cx - window.game.shoreX);
            const lvl       = Math.max(1, Math.floor(distShore / 4000)) + Math.max(0, window.game.days - 1);
            if (distShore > 2000) {
                const _sGY  = window.getGroundY ? window.getGroundY(cx) : window.game.groundLevel;
                let newEnt  = null;
                if (distShore > 5000 && Math.random() < 0.35 && window.entities.filter(e => e.type === 'archer').length < 3) {
                    const aHp = 20 + lvl * 12;
                    newEnt = { id: 'en_' + Math.random().toString(36).substr(2, 9), type: 'archer', name: 'Cazador', level: lvl, x: cx, y: _sGY - 40, width: 20, height: 40, vx: window.player.x > cx ? 0.8 : -0.8, vy: 0, hp: aHp, maxHp: aHp, damage: 5 + lvl * 2, isHit: false, attackCooldown: 0, stuckFrames: 0, ignorePlayer: 0, lastX: cx };
                } else if (window.entities.filter(e => e.type === 'zombie').length < 3) {
                    const zHp = 35 + lvl * 15;
                    newEnt = { id: 'en_' + Math.random().toString(36).substr(2, 9), type: 'zombie', name: 'Mutante', level: lvl, x: cx, y: _sGY - 44, width: 24, height: 44, vx: window.player.x > cx ? 0.4 : -0.4, vy: 0, hp: zHp, maxHp: zHp, damage: 8 + lvl * 3, isHit: false, attackCooldown: 0, stuckFrames: 0, ignorePlayer: 0, lastX: cx };
                }
                if (newEnt) { window.entities.push(newEnt); window.sendWorldUpdate('spawn_entity', { entity: newEnt }); }
            }
        }

        if (window.game.isMultiplayer && window.socket && isMasterClient && window.game.frameCount % 6 === 0 && window.entities.length > 0) {
            window.sendWorldUpdate('sync_entities', window.entities.map(e => ({ id: e.id, x: e.x, y: e.y, vx: e.vx, vy: e.vy, hp: e.hp })));
        }

        // ── AI de entidades (delegado a entities.js) ──────────────────────────
        const isHoldingTorch = window.player.activeTool === 'torch' && !window.player.inBackground && !window.player.isDead;
        window.updateEntities(isDay, isNight, isHoldingTorch, pCX, pCY);  // ← entities.js

        // ── Cámara ────────────────────────────────────────────────────────────
        window.game.zoom += (window.game.zoomTarget - window.game.zoom) * 0.12;
        window.camera.x = window.player.x + window.player.width / 2 - _W / 2;

        if (window.camera._targetY === undefined) window.camera._targetY = window.player.y + window.player.height - _H * 0.62;
        const targetCamY = window.player.y + window.player.height - _H * 0.62;
        window.camera._targetY += (targetCamY - window.camera._targetY) * 0.08;
        window.camera.y = window.camera._targetY;

        if (window.camera.x < window.game.shoreX - _W / 2) window.camera.x = window.game.shoreX - _W / 2;

        if (window.player.x + _W / 2 > window.game.exploredRight) {
            window.generateWorldSector(window.game.exploredRight, window.game.exploredRight + window.game.chunkSize);
            window.game.exploredRight += window.game.chunkSize;
        }

        // ── Partículas ────────────────────────────────────────────────────────
        for (let i = window.particles.length - 1; i >= 0; i--) {
            const p = window.particles[i];
            p.x += p.vx; p.y += p.vy; p.vy += window.game.gravity * 0.4; p.life -= p.decay;
            const _pGY = window.getGroundY ? window.getGroundY(p.x) : window.game.groundLevel;
            if (p.y >= _pGY) { p.y = _pGY; p.vy = -p.vy * 0.5; p.vx *= 0.8; }
            if (p.life <= 0.05 || isNaN(p.life)) window.particles.splice(i, 1);
        }

        if (!window.dustParticles) window.dustParticles = [];
        for (let i = window.dustParticles.length - 1; i >= 0; i--) {
            const d = window.dustParticles[i];
            d.x += d.vx; d.y += d.vy;
            d.vx *= 0.92; d.vy *= 0.88;
            d.life -= d.decay; d.r += d.growRate;
            if (d.life <= 0) window.dustParticles.splice(i, 1);
        }

        for (let i = window.damageTexts.length - 1; i >= 0; i--) {
            const dt = window.damageTexts[i];
            dt.y -= 0.2; dt.life -= 0.008;
            if (dt.life <= 0.05 || isNaN(dt.life)) window.damageTexts.splice(i, 1);
        }

        // ── Hambre ────────────────────────────────────────────────────────────
        if (window.game.frameCount % 60 === 0 && !window.player.isDead) {
            window.player.hunger -= isMoving ? 0.1 : 0.02;
            if (window.player.hunger <= 0) { window.player.hunger = 0; window.damagePlayer(2, 'Hambre'); }
            if (window.player.hunger > 50 && window.player.hp < window.player.maxHp) {
                window.player.hp += 0.5;
                if (window.updateUI) window.updateUI();
            }
        }

        if (typeof window.updateEntityHUD === 'function') window.updateEntityHUD();

    } catch (err) { console.error('Motor de juego protegido:', err); }
}

window.gameLoop = function () {
    if (window.game && window.game.isRunning) update();
    if (typeof window.draw === 'function') window.draw();
    requestAnimationFrame(window.gameLoop);
};

window.addEventListener('DOMContentLoaded', () => { window.gameLoop(); });

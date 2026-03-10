// === game.js - MOTOR PRINCIPAL ===
// Módulos externos: physics.js, entities.js, terrain.js, inventory.js

window.sendWorldUpdate = function(action, payload) {
    if (window.game.isMultiplayer && window.socket) { window.socket.emit('worldUpdate', { action, payload }); }
};

window.spawnDustPuff = function(x, y, facingRight, isRemote) {
    if (!window.dustParticles) window.dustParticles = [];
    for (let i = 0; i < 3; i++) {
        const spread = (Math.random() - 0.5) * 6, speed = 0.4 + Math.random() * 0.6, dir = facingRight ? -1 : 1;
        window.dustParticles.push({ x: x + spread, y: y - 2 + (Math.random() - 0.5) * 4, vx: dir * speed * (0.6 + Math.random() * 0.8), vy: -(0.3 + Math.random() * 0.5), r: 3 + Math.random() * 3, growRate: 0.18 + Math.random() * 0.12, life: 1.0, decay: 0.022 + Math.random() * 0.012, alpha: 0.28 + Math.random() * 0.18, gray: Math.floor(180 + Math.random() * 50) });
    }
    if (!isRemote && window.game.isMultiplayer && window.socket) {
        // Limitar dust_puff a red a máximo ~2/seg para no saturar el canal
        const _now = Date.now();
        if (!window._lastDustNet || _now - window._lastDustNet > 500) {
            window._lastDustNet = _now;
            window.socket.emit('worldUpdate', { action: 'dust_puff', payload: { x, y, facingRight } });
        }
    }
};

window.spawnDroppedItem = function(x, y, type, amount) {
    if (amount <= 0) return;
    let ni = { id: Math.random().toString(36).substring(2,15), x: x + (Math.random()*10-5), y: y + (Math.random()*10-5), vx: (Math.random()-0.5)*3, vy: (Math.random()-1)*3-1, type, amount, life: 1.0 };
    window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', { item: ni });
};

window.openChat = function() {
    let chatContainer = window.getEl('chat-container'), chatInput = window.getEl('chat-input');
    if (chatContainer && chatInput && !window.player.isDead) {
        chatContainer.style.display = 'block'; chatInput.focus();
        if (window.keys) { window.keys.a = window.keys.d = window.keys.w = window.keys.s = window.keys.shift = window.keys.y = window.keys.jumpPressed = window.keys.mouseLeft = false; }
        if (window.player) window.player.isCharging = false;
    }
};

window.destroyBlockLocally = function(b) {
    let index = window.blocks.indexOf(b);
    if (index === -1) return;

    if (window.currentOpenBox && window.currentOpenBox.x === b.x && window.currentOpenBox.y === b.y) { window.currentOpenBox = null; let dBox = window.getEl('menu-box'); if (dBox) dBox.classList.remove('open'); }

    let refundType = b.type === 'box' ? 'boxes' : (b.type === 'campfire' ? 'campfire_item' : (b.type === 'bed' ? 'bed_item' : (b.type === 'barricade' ? 'barricade_item' : (b.type === 'ladder' ? 'ladder_item' : (b.type === 'turret' ? 'turret_item' : 'wood')))));
    let refundAmt = b.type === 'door' ? 2 : 1;
    if (b.type !== 'grave') { let ni = { id: Math.random().toString(36).substring(2,9), x:b.x+15, y:b.y+15, vx:0, vy:-2, type:refundType, amount:refundAmt, life:1.0 }; window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni}); }

    if ((b.type === 'box' || b.type === 'grave') && b.inventory)
        for (const [t, amt] of Object.entries(b.inventory))
            if (amt > 0) { let ni2 = { id: Math.random().toString(36).substring(2,9), x:b.x+15, y:b.y+15, vx:(Math.random()-0.5)*2, vy:-2, type:t, amount:amt, life:1.0 }; window.droppedItems.push(ni2); window.sendWorldUpdate('drop_item', {item:ni2}); }

    if (b.type === 'campfire') {
        if (b.wood > 0)   { let c1 = { id: Math.random().toString(36).substring(2,9), x:b.x+15,y:b.y+15,vx:-1,vy:-2,type:'wood',amount:b.wood,life:1.0 };         window.droppedItems.push(c1); window.sendWorldUpdate('drop_item',{item:c1}); }
        if (b.meat > 0)   { let c2 = { id: Math.random().toString(36).substring(2,9), x:b.x+15,y:b.y+15,vx:0,vy:-2,type:'meat',amount:b.meat,life:1.0 };           window.droppedItems.push(c2); window.sendWorldUpdate('drop_item',{item:c2}); }
        if (b.cooked > 0) { let c3 = { id: Math.random().toString(36).substring(2,9), x:b.x+15,y:b.y+15,vx:1,vy:-2,type:'cooked_meat',amount:b.cooked,life:1.0 }; window.droppedItems.push(c3); window.sendWorldUpdate('drop_item',{item:c3}); }
    }

    if (b.type === 'bed' && window.player.bedPos && window.player.bedPos.x === b.x && window.player.bedPos.y === b.y) window.player.bedPos = null;
    if (b.type === 'grave') window.sendWorldUpdate('destroy_grave', { id: b.id });

    window.blocks.splice(index, 1); window.spawnParticles(b.x+15, b.y+15, '#C19A6B', 15, 1.2); window.gainXP(2);
    window.sendWorldUpdate('hit_block', { x: b.x, y: b.y, dmg: 9999, destroyed: true });
    if (window.scorchMarks) window.scorchMarks = window.scorchMarks.filter(s => !(s.blockX !== undefined && Math.abs(s.blockX-b.x) < 2 && Math.abs(s.blockY-b.y) < 2));

    // Destruir objetos apoyados encima
    let toBreak = window.blocks.filter(obj => ['door','campfire','box','bed','barricade'].includes(obj.type) && obj.x === b.x && obj.y + (obj.type==='door' ? window.game.blockSize*2 : window.game.blockSize) === b.y);
    for (let obj of toBreak) window.destroyBlockLocally(obj);
};

window.startGame = function(multiplayer, ip = null, roomId = null) {
    window._currentRoomId = roomId;
    const nameInput = window.getEl('player-name');
    let rawName = (nameInput && nameInput.value) ? nameInput.value.trim() : "Jugador " + Math.floor(Math.random()*1000);
    window.player.name = rawName.substring(0, 15);

    let menu = window.getEl('main-menu'); if (menu) menu.style.display = 'none';
    let ui = window.getEl('ui-layer'); if (ui) ui.style.display = 'block';
    window.game.isRunning = true; window.game.isMultiplayer = multiplayer;
    if (window.startMusic) window.startMusic();

    let btnServerMenu = window.getEl('btn-server-menu');
    if (btnServerMenu) btnServerMenu.style.display = multiplayer ? 'inline-block' : 'none';

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

            let sInfo = window.getEl('server-info');
            if (sInfo) { sInfo.style.display = 'flex'; window.getEl('sv-ip').innerText = roomId ? 'Sala ' + roomId : (ip || 'Global'); }
            if (ip && ip !== window.location.hostname && ip !== 'localhost' && ip !== '127.0.0.1') {
                let list = JSON.parse(localStorage.getItem('savedServers') || '[]');
                if (!list.includes(ip)) { list.push(ip); localStorage.setItem('savedServers', JSON.stringify(list)); if (window.refreshServerList) window.refreshServerList(); }
            }

            window.socket.on('connect', () => {
                const _pd = { name: window.player.name, x: window.player.x, y: window.player.y, level: window.player.level, seedCode: window.seedCode };
                window.socket.emit(window._currentRoomId ? 'joinRoom' : 'joinGame', window._currentRoomId ? { roomId: window._currentRoomId, playerData: _pd } : _pd);
            });

            window.socket.on('disconnect', () => { alert("⚠ Conexión perdida. La partida se reiniciará."); window.location.reload(); });

            // ── Verificación de versión: si el servidor tiene versión distinta, recargar ──
            // Esto garantiza que todos los clientes usen la misma versión de los archivos JS.
            // Cuando despliegues una actualización, incrementa SERVER_VERSION en server.js.
            window._CLIENT_VERSION = 32;  // ← debe coincidir con SERVER_VERSION en server.js
            window.socket.on('serverVersion', (v) => {
                if (v !== window._CLIENT_VERSION) {
                    console.warn(`[versión] Servidor v${v} ≠ Cliente v${window._CLIENT_VERSION} → recargando…`);
                    // Forzar recarga ignorando caché del navegador
                    window.location.reload(true);
                }
            });
            window.socket.on('currentPlayers', (srvPlayers) => { window.otherPlayers = srvPlayers; let pCount = window.getEl('sv-players'); if (pCount) pCount.innerText = Object.keys(srvPlayers).length; });

            window.socket.on('playerMoved', (pInfo) => {
                if (pInfo.id !== window.socket?.id) {
                    const op = window.otherPlayers?.[pInfo.id];
                    if (op && Math.abs(pInfo.vx) > 2.5 && pInfo.isGrounded && !pInfo.isDead && window.game.frameCount % 4 === 0)
                        window.spawnDustPuff(pInfo.x + (op.width||20)/2 + (pInfo.facingRight ? -8 : 8), pInfo.y + (op.height||56), pInfo.facingRight, true);
                }
                if (window.otherPlayers[pInfo.id]) {
                    let op = window.otherPlayers[pInfo.id];
                    // Campos siempre presentes
                    Object.assign(op, {
                        targetX: pInfo.x, targetY: pInfo.y,
                        vx: pInfo.vx, vy: pInfo.vy,
                        facingRight: pInfo.facingRight,
                        animTime: pInfo.animTime,
                        isClimbing: pInfo.isClimbing || false,
                        isGrounded: pInfo.isGrounded || false,
                        isSprinting: pInfo.isSprinting || false,
                        isTyping: pInfo.isTyping || false,
                    });
                    // Campos opcionales: solo actualizar si vienen en el paquete
                    if (pInfo.activeTool  !== undefined) op.activeTool  = pInfo.activeTool;
                    if (pInfo.attackFrame !== undefined) op.attackFrame = pInfo.attackFrame;
                    if (pInfo.isAiming    !== undefined) op.isAiming    = pInfo.isAiming;
                    if (pInfo.isCharging  !== undefined) op.isCharging  = pInfo.isCharging;
                    if (pInfo.chargeLevel !== undefined) op.chargeLevel = pInfo.chargeLevel;
                    if (pInfo.level       !== undefined) op.level       = pInfo.level;
                    if (pInfo.mouseX      !== undefined) op.mouseX      = pInfo.mouseX;
                    if (pInfo.mouseY      !== undefined) op.mouseY      = pInfo.mouseY;
                    if (pInfo.isDancing   !== undefined) op.isDancing   = pInfo.isDancing;
                    if (pInfo.danceStart  !== undefined) op.danceStart  = pInfo.danceStart;
                    if (pInfo.isDead && !op.isDead) op.deathAnimFrame = 40;
                    op.isDead = pInfo.isDead;
                }
            });

            window.socket.on('playerDisconnected', (id) => {
                if (window.pvp?.activeOpponent === id) { window.pvp.activeOpponent = null; if (window.addGlobalMessage) window.addGlobalMessage('🛑 Tu rival se desconectó. PVP finalizado.', '#aaa'); if (window.updatePlayerList) window.updatePlayerList(); }
                delete window.otherPlayers[id];
                if (window.updatePlayerList) window.updatePlayerList();
            });

            window.socket.on('timeSync', (ms) => { window.game.serverStartTime = Date.now() - ms; });

            window.socket.on('worldSeed', (data) => {
                if (data?.seed && window.setSeedFromCode) {
                    window.setSeedFromCode(data.seed);
                    localStorage.setItem('worldSeedCode', window.seedCode);
                    let el = document.getElementById('seed-display'); if (el) el.textContent = window.seedCode;
                }
                // Re-aplicar celdas minadas DESPUÉS de applySeed para que no se pierdan.
                // applySeed limpia _ugCellCache y _terrainColCache pero NO _minedCells.
                // Aun así, guardamos una copia defensiva en _pendingMinedCells por si
                // alguna ruta de código inesperada borra _minedCells antes de llegar aquí.
                if (window._pendingMinedCells && Object.keys(window._pendingMinedCells).length > 0) {
                    Object.assign(window._minedCells, window._pendingMinedCells);
                    window._ugCellCache     = {};
                    window._terrainColCache = {};
                    window._pendingMinedCells = null;
                }
            });

            window.socket.on('serverFull', () => { alert('⚠️ Servidor lleno.'); window.location.reload(); });
            window.socket.on('roomError', (err) => { alert('⚠️ ' + err.message); window.location.reload(); });
            window.socket.on('roomListUpdate', (list) => { window._serverRoomList = list; if (typeof window.renderRoomList === 'function') window.renderRoomList(list); });

            window.socket.on('worldReset', (data) => {
                if (data?.seed && window.setSeedFromCode) { window.setSeedFromCode(data.seed); localStorage.setItem('worldSeedCode', window.seedCode); }
                window.blocks = []; window.droppedItems = []; window.removedTrees = []; window.removedRocks = []; window.treeState = {}; window.killedEntities = []; window.stuckArrows = []; window.fires = []; window.scorchMarks = []; window.trees = []; window.rocks = []; window.entities = []; window.game.exploredRight = window.game.shoreX;
                // Reset explícito del mundo: limpiar terreno minado (applySeed ya no lo hace)
                window._minedCells = {}; window._cellDamage = {}; window._ugCellCache = {};
                if (window.applySeed) window.applySeed();
                window.generateWorldSector(window.game.shoreX, window.game.shoreX + window.game.chunkSize);
                window.game.exploredRight = window.game.shoreX + window.game.chunkSize;
                let el = document.getElementById('seed-display'); if (el) el.textContent = window.seedCode || '-----';
                if (window.addGlobalMessage) window.addGlobalMessage('🌍 Mundo reseteado — semilla: ' + (window.seedCode || '?'), '#3ddc84');
            });

            window.socket.on('initWorldState', (state) => {
                window.blocks = state.blocks; window.removedTrees = state.removedTrees; window.removedRocks = state.removedRocks; window.treeState = state.treeState || {}; window.killedEntities = state.killedEntities || [];
                window.trees = window.trees.filter(t => !window.removedTrees.some(rx => Math.abs(rx - t.x) < 1));
                window.trees.forEach(t => { let sk = Object.keys(window.treeState).find(kx => Math.abs(parseFloat(kx) - t.x) < 1); if (sk) { t.isStump = window.treeState[sk].isStump; t.regrowthCount = window.treeState[sk].regrowthCount; t.grownDay = window.treeState[sk].grownDay; if (t.isStump) { t.hp = 50; t.maxHp = 50; } } });
                window.rocks = window.rocks.filter(r => !window.removedRocks.some(rx => Math.abs(rx - r.x) < 1));
                window.entities = window.entities.filter(e => !window.killedEntities.includes(e.id));

                // ── Restaurar terreno minado ──────────────────────────────────────────
                // Guardamos en _pendingMinedCells además de _minedCells.
                // Si worldSeed llega después y llama a applySeed, el handler de worldSeed
                // re-aplica _pendingMinedCells para garantizar que no se pierdan.
                if (state.minedCells && typeof state.minedCells === 'object') {
                    window._minedCells         = Object.assign({}, state.minedCells);
                    window._pendingMinedCells  = Object.assign({}, state.minedCells);  // copia defensiva
                    if (window._ugCellCache)     window._ugCellCache     = {};
                    if (window._terrainColCache) window._terrainColCache = {};
                } else {
                    window._pendingMinedCells = null;
                }
                window._serverMinedCells = {}; // limpiar por si quedó algo de sesiones anteriores

                if (window.updateUI) window.updateUI();
            });

            window.socket.on('chatMessage', (data) => {
                if (data.id === window.socket.id) return;
                if (window.otherPlayers[data.id]) { window.otherPlayers[data.id].chatText = data.text; window.otherPlayers[data.id].chatExpires = Date.now() + 6500; if (window.addGlobalMessage) window.addGlobalMessage(`💬 [${window.otherPlayers[data.id].name}]: ${data.text}`, '#a29bfe'); }
            });

            window.socket.on('worldUpdate', (data) => {
                const myId = window.socket.id;

                // PVP
                if (data.action === 'pvp_challenge') { if (data.payload.toId !== myId) return; window.pvp = window.pvp || {}; window.pvp.pendingChallenge = { fromId: data.payload.fromId, fromName: data.payload.fromName }; window.showPvpNotification(data.payload.fromName, data.payload.fromId); return; }
                if (data.action === 'pvp_accepted') { if (data.payload.fromId !== myId) return; window.pvp = window.pvp || {}; const opName = window.otherPlayers[data.payload.toId]?.name || data.payload.toName; window.pvp.activeOpponent = data.payload.toId; if (window.otherPlayers[data.payload.toId]) window.otherPlayers[data.payload.toId].pvpActive = true; if (window.addGlobalMessage) window.addGlobalMessage(`⚔️ PVP activo con ${opName}!`, '#ff4444'); if (window.updatePlayerList) window.updatePlayerList(); return; }
                if (data.action === 'pvp_declined') { if (data.payload.fromId !== myId) return; if (window.addGlobalMessage) window.addGlobalMessage(`❌ ${window.otherPlayers[data.payload.toId]?.name || '?'} rechazó el duelo.`, '#aaa'); return; }
                if (data.action === 'pvp_ended') { window.pvp = window.pvp || {}; if (window.pvp.activeOpponent === data.payload.p1 || window.pvp.activeOpponent === data.payload.p2) { window.pvp.activeOpponent = null; if (window.addGlobalMessage) window.addGlobalMessage('🏁 El duelo PVP terminó.', '#f0a020'); if (window.updatePlayerList) window.updatePlayerList(); } if (window.otherPlayers[data.payload.p1]) window.otherPlayers[data.payload.p1].pvpActive = false; if (window.otherPlayers[data.payload.p2]) window.otherPlayers[data.payload.p2].pvpActive = false; return; }
                if (data.action === 'pvp_hit') { if (data.payload.targetId !== myId) return; window.pvp = window.pvp || {}; if (window.pvp.activeOpponent !== data.payload.sourceId) return; window.damagePlayer(data.payload.dmg, window.otherPlayers[data.payload.sourceId]?.name || 'Rival'); window.player.pvpHitFlash = 8; return; }

                // Mundo
                if      (data.action === 'player_death')    { if (window.addGlobalMessage) window.addGlobalMessage(`☠️ ${data.payload.name} murió por ${data.payload.source}`, '#e74c3c'); }
                else if (data.action === 'hit_tree')         { let t = window.trees.find(tr => Math.abs(tr.x - data.payload.x) < 1); if (t) { t.hp -= data.payload.dmg; window.setHit(t); } }
                else if (data.action === 'stump_tree')       { let t = window.trees.find(tr => Math.abs(tr.x - data.payload.x) < 1); if (t) { t.isStump = true; t.hp = 50; t.maxHp = 50; t.regrowthCount = data.payload.regrowthCount; t.grownDay = data.payload.grownDay; window.treeState[t.x] = { isStump: true, regrowthCount: t.regrowthCount, grownDay: t.grownDay }; } }
                else if (data.action === 'grow_tree')        { let t = window.trees.find(tr => Math.abs(tr.x - data.payload.x) < 1); if (t) { t.isStump = false; t.hp = 100; t.maxHp = 100; t.regrowthCount = data.payload.regrowthCount; t.grownDay = data.payload.grownDay; window.treeState[t.x] = { isStump: false, regrowthCount: t.regrowthCount, grownDay: t.grownDay }; } }
                else if (data.action === 'destroy_tree')     { window.removedTrees.push(data.payload.x); let sk = Object.keys(window.treeState).find(kx => Math.abs(parseFloat(kx) - data.payload.x) < 1); if (sk) delete window.treeState[sk]; window.trees = window.trees.filter(t => Math.abs(t.x - data.payload.x) > 1); }
                else if (data.action === 'hit_rock')         { let r = window.rocks.find(ro => Math.abs(ro.x - data.payload.x) < 1); if (r) { r.hp -= data.payload.dmg; window.setHit(r); } }
                else if (data.action === 'destroy_rock')     { window.removedRocks.push(data.payload.x); window.rocks = window.rocks.filter(r => Math.abs(r.x - data.payload.x) > 1); }
                else if (data.action === 'hit_block')        { let b = window.blocks.find(bl => Math.abs(bl.x - data.payload.x) < 1 && Math.abs(bl.y - data.payload.y) < 1); if (b) { b.hp -= data.payload.dmg; window.setHit(b); if (data.payload.destroyed || b.hp <= 0) { if (window.currentOpenBox?.x === b.x && window.currentOpenBox?.y === b.y) { window.currentOpenBox = null; let dBox = window.getEl('menu-box'); if (dBox) dBox.classList.remove('open'); } window.blocks = window.blocks.filter(bl => bl !== b); } } }
                else if (data.action === 'destroy_grave')    { if (window.currentOpenBox?.id === data.payload.id) { window.currentOpenBox = null; let dBox = window.getEl('menu-box'); if (dBox) dBox.classList.remove('open'); } window.blocks = window.blocks.filter(b => b.id !== data.payload.id); }
                else if (data.action === 'place_block')      { if (!window.blocks.find(bl => bl.x === data.payload.block.x && bl.y === data.payload.block.y)) window.blocks.push(data.payload.block); }
                else if (data.action === 'remove_old_bed')   { window.blocks = window.blocks.filter(b => b.type !== 'bed' || b.owner !== data.payload.owner); }
                else if (data.action === 'interact_door')    { let d = window.blocks.find(bl => Math.abs(bl.x - data.payload.x) < 1 && Math.abs(bl.y - data.payload.y) < 1); if (d) d.open = !d.open; }
                else if (data.action === 'drop_item')        { if (!window.droppedItems.find(i => i.id === data.payload.item.id)) window.droppedItems.push(data.payload.item); }
                else if (data.action === 'pickup_item')      { let idx = window.droppedItems.findIndex(i => i.id === data.payload.id); if (idx !== -1) window.droppedItems.splice(idx, 1); }
                else if (data.action === 'spawn_projectile') { window.projectiles.push(data.payload); }
                else if (data.action === 'spawn_stuck_arrow'){ window.stuckArrows.push(data.payload); }
                else if (data.action === 'remove_stuck_arrow'){ window.stuckArrows = window.stuckArrows.filter(sa => sa.id !== data.payload.id); }
                else if (data.action === 'spawn_entity')     { if (!window.entities.some(e => e.id === data.payload.entity.id) && !window.killedEntities.includes(data.payload.entity.id)) window.entities.push(data.payload.entity); }
                else if (data.action === 'kill_entity')      { window.killedEntities.push(data.payload.id); window.entities = window.entities.filter(en => en.id !== data.payload.id); }
                else if (data.action === 'hit_entity')       { let e = window.entities.find(en => en.id === data.payload.id); if (e) { e.hp -= data.payload.dmg; window.setHit(e); } }
                else if (data.action === 'flee_entity')      { let e = window.entities.find(en => en.id === data.payload.id); if (e) { e.fleeTimer = 180; e.fleeDir = data.payload.dir; } }
                else if (data.action === 'sync_entities')    { data.payload.forEach(snap => { let e = window.entities.find(en => en.id === snap.id); if (e) { e.x += (snap.x-e.x)*0.3; e.y += (snap.y-e.y)*0.3; e.vx = snap.vx; e.vy = snap.vy; e.hp = snap.hp; } }); }
                else if (data.action === 'update_box')       { let b = window.blocks.find(bl => Math.abs(bl.x-data.payload.x) < 1 && Math.abs(bl.y-data.payload.y) < 1 && (bl.type==='box'||bl.type==='grave')); if (b) { b.inventory = data.payload.inventory; if (window.currentOpenBox && Math.abs(window.currentOpenBox.x-b.x) < 1 && window.renderBoxUI) window.renderBoxUI(); } }
                else if (data.action === 'update_campfire')  { let b = window.blocks.find(bl => Math.abs(bl.x-data.payload.x) < 1 && Math.abs(bl.y-data.payload.y) < 1 && bl.type==='campfire'); if (b) { b.wood = data.payload.wood; b.meat = data.payload.meat; b.cooked = data.payload.cooked; b.isBurning = data.payload.isBurning; if (window.currentCampfire?.x === b.x && window.renderCampfireUI) window.renderCampfireUI(); } }
                else if (data.action === 'dust_puff')        { window.spawnDustPuff(data.payload.x, data.payload.y, data.payload.facingRight, true); }
                else if (data.action === 'spawn_fire')       { if (window.spawnFireFromNetwork) window.spawnFireFromNetwork(data.payload); }
                else if (data.action === 'fire_damage')      { if (data.payload.targetId === myId) window.damagePlayer(data.payload.dmg, '🔥 Fuego'); }
                else if (data.action === 'mine_cell') {
                    // Otro jugador minó una celda — aplicar localmente.
                    // Si broken:true, marcar directamente como minada (no acumular HP
                    // que podría desincronizarse si se perdieron paquetes).
                    if (window.damageCellUG && window.mineCell) {
                        const _mc = data.payload;
                        if (_mc.broken === true) {
                            // La celda ya se destruyó en el cliente origen → marcar directo
                            window.mineCell(_mc.col, _mc.row);
                            if (window._ugCellCache) delete window._ugCellCache[_mc.col + '_' + _mc.row];
                        } else {
                            window.damageCellUG(_mc.col, _mc.row, _mc.dmg);
                        }
                        // Si se rompió la superficie, limpiar árboles/rocas encima
                        if (_mc.row === 0 && _mc.broken === true) {
                            const _bs = window.game.blockSize;
                            const _cx = _mc.col * _bs, _cxr = _cx + _bs;
                            window.trees = window.trees.filter(t => {
                                const tCX = t.x + t.width/2;
                                if (tCX >= _cx && tCX < _cxr) { window.removedTrees.push(t.x); return false; }
                                return true;
                            });
                            window.rocks = window.rocks.filter(r => {
                                const rCX = r.x + r.width/2;
                                return !(rCX >= _cx && rCX < _cxr);
                            });
                            if (window._terrainColCache) delete window._terrainColCache[_mc.col];
                        }
                    }
                }
            });
        } catch(e) { console.error("Error Socket:", e); alert("No se pudo conectar al servidor."); }
    }
    window.recalculateStats(); if (window.updateUI) window.updateUI(); if (window.renderToolbar) window.renderToolbar();
};

// === PVP ===
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
    setTimeout(() => { if (document.getElementById('pvp-notif') === notif) notif.remove(); }, 15000);
};

window.challengePvp = function(targetId) {
    if (!window.socket || !window.game.isMultiplayer) { if (window.addGlobalMessage) window.addGlobalMessage('⚠️ PVP requiere multijugador.', '#f0a020'); return; }
    const targetName = window.otherPlayers[targetId]?.name || '?';
    window.sendWorldUpdate('pvp_challenge', { toId: targetId, fromId: window.socket.id, fromName: window.player.name });
    if (window.addGlobalMessage) window.addGlobalMessage(`⚔️ Desafío enviado a ${targetName}...`, '#f0a020');
};

window.acceptPvp = function(fromId) {
    let notif = document.getElementById('pvp-notif'); if (notif) notif.remove();
    if (!window.socket) return;
    window.pvp.activeOpponent = fromId;
    if (window.otherPlayers[fromId]) window.otherPlayers[fromId].pvpActive = true;
    window.sendWorldUpdate('pvp_accepted', { fromId, toId: window.socket.id, toName: window.player.name });
    if (window.addGlobalMessage) window.addGlobalMessage('⚔️ ¡Duelo aceptado!', '#ff4444');
    if (window.updatePlayerList) window.updatePlayerList();
};

window.declinePvp = function(fromId) {
    let notif = document.getElementById('pvp-notif'); if (notif) notif.remove();
    if (!window.socket) return;
    window.sendWorldUpdate('pvp_declined', { fromId, toId: window.socket.id });
};

window.updatePlayerList = function() {
    let inner = document.getElementById('pvp-player-list-inner');
    if (!inner) return;
    if (!window.game.isMultiplayer || !window.otherPlayers) { inner.innerHTML = '<div style="color:#5a6475;font-size:16px;text-align:center;padding:16px 0;">🔌 Solo multijugador</div>'; return; }
    const myId = window.socket?.id;
    const ops = Object.values(window.otherPlayers).filter(p => p.name);
    if (ops.length === 0) { inner.innerHTML = '<div style="color:#5a6475;font-size:16px;text-align:center;padding:16px 0;">Sin jugadores en línea</div>'; return; }
    inner.innerHTML = ops.map(op => {
        const isSelf = op.id === myId, isPvpActive = window.pvp.activeOpponent === op.id;
        const dist = Math.round(Math.hypot((op.x||0)-window.player.x, (op.y||0)-window.player.y) / 10);
        const deadBadge = op.isDead ? '<span style="color:#e74c3c;"> ☠</span>' : '';
        let actionEl = isSelf
            ? `<span style="color:#5a6475;font-size:14px;font-style:italic;">Tú</span>`
            : isPvpActive
                ? `<span style="color:#ff6666;font-weight:700;font-size:15px;">⚔ DUELO</span>`
                : `<button onclick="window.challengePvp('${op.id}')" style="background:linear-gradient(135deg,rgba(120,15,15,0.9),rgba(80,5,5,0.95));color:#ff9090;border:1px solid rgba(200,50,50,0.35);border-radius:5px;padding:4px 9px;cursor:pointer;font-size:15px;font-weight:700;" onmouseover="this.style.background='linear-gradient(135deg,rgba(180,20,20,0.95),rgba(120,5,5,0.99))'" onmouseout="this.style.background='linear-gradient(135deg,rgba(120,15,15,0.9),rgba(80,5,5,0.95))'">⚔ PVP</button>`;
        return `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 8px;margin-bottom:4px;border-radius:6px;background:${isSelf?'rgba(61,220,132,0.04)':'rgba(255,255,255,0.03)'};border:1px solid ${isSelf?'rgba(61,220,132,0.12)':'rgba(255,255,255,0.05)'};">
            <div><div style="color:${isSelf?'#3ddc84':'#d8dde6'};font-weight:700;font-size:16px;">${op.name||'?'}${deadBadge}</div><div style="color:#5a6475;font-size:14px;">Niv.${op.level||1}${!isSelf?` &nbsp;·&nbsp; ${dist}m`:''}</div></div>
            ${actionEl}</div>`;
    }).join('');
};

window.togglePlayerList = function() {
    let panel = document.getElementById('pvp-player-panel');
    if (!panel) return;
    const isVisible = panel.style.display === 'block';
    panel.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) window.updatePlayerList();
};

// === INPUT ===
window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('blur', () => {
    if (window.keys) { window.keys.a = window.keys.d = window.keys.w = window.keys.s = window.keys.shift = window.keys.y = window.keys.jumpPressed = window.keys.mouseLeft = false; }
    if (window.player) { window.player.isCharging = false; window.player.isClimbing = false; }
});

window.addEventListener('keyup', (e) => {
    if (!window.game?.isRunning) return;
    let chatInput = window.getEl('chat-input');
    if (chatInput && document.activeElement === chatInput) return;
    if (!window.keys) return;
    if (e.key === 'a' || e.key === 'A') window.keys.a = false;
    if (e.key === 'd' || e.key === 'D') window.keys.d = false;
    if (e.key === 's' || e.key === 'S') window.keys.s = false;
    if (e.key === 'Shift') window.keys.shift = false;
    if (e.key === 'y' || e.key === 'Y') window.keys.y = false;
    if (e.key === 'w' || e.key === 'W') { window.keys.w = false; window.keys.jumpPressed = false; if (window.player) window.player.jumpKeyReleased = true; }
    if (e.key === ' ') { window.keys.jumpPressed = false; if (window.player) window.player.jumpKeyReleased = true; }
});

window.addEventListener('keydown', (e) => {
    if (!window.game?.isRunning || !window.player) return;
    let chatContainer = window.getEl('chat-container'), chatInput = window.getEl('chat-input');

    if (chatContainer && chatInput && !window.player.isDead) {
        if (e.key === 'Enter') {
            if (document.activeElement === chatInput) {
                let msg = chatInput.value.trim();
                if (msg.length > 0) {
                    if (msg.startsWith('/')) {
                        const cmd = msg.toLowerCase();
                        if      (cmd === '/madera')  { window.player.inventory.wood    = (window.player.inventory.wood    || 0) + 100; window.spawnDamageText(window.player.x+window.player.width/2, window.player.y-20, '+100 Madera 🌲', '#c19a6b'); if (window.updateUI) window.updateUI(); }
                        else if (cmd === '/piedra')  { window.player.inventory.stone   = (window.player.inventory.stone   || 0) + 100; window.spawnDamageText(window.player.x+window.player.width/2, window.player.y-20, '+100 Piedra ⛏️', '#999'); if (window.updateUI) window.updateUI(); }
                        else if (cmd === '/flechas') { window.player.inventory.arrows  = (window.player.inventory.arrows  || 0) + 50;  window.spawnDamageText(window.player.x+window.player.width/2, window.player.y-20, '+50 Flechas 🏹', '#e67e22'); if (window.updateUI) window.updateUI(); }
                        else if (cmd === '/dance')   { window.player.isDancing = true; window.player.danceStart = window.game.frameCount; window.player.chatText = '🕺 ¡A bailar!'; window.player.chatExpires = Date.now() + 3000; }
                        else { window.spawnDamageText(window.player.x+window.player.width/2, window.player.y-20, 'Comando desconocido', '#e74c3c'); }
                        chatInput.value = ''; chatInput.blur(); chatContainer.style.display = 'none'; window.player.isTyping = false; return;
                    }
                    window.player.chatText = msg; window.player.chatExpires = Date.now() + 6500;
                    if (window.addGlobalMessage) window.addGlobalMessage(`💬 [Tú]: ${msg}`, '#3498db');
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
    if (window.player.isDancing) window.player.isDancing = false;

    if (e.key === 'a' || e.key === 'A') window.keys.a = true;
    if (e.key === 'd' || e.key === 'D') window.keys.d = true;
    if (e.key === 's' || e.key === 'S') window.keys.s = true;
    if (e.key === 'Shift') window.keys.shift = true;
    if (e.key === 'w' || e.key === 'W') { window.keys.w = true; window.keys.jumpPressed = true; }
    if (e.key === ' ') window.keys.jumpPressed = true;
    if (e.key === 'y' || e.key === 'Y') window.keys.y = true;

    if (e.key === 'e' || e.key === 'E') {
        const pCX = window.player.x + window.player.width / 2, pCY = window.player.y + window.player.height / 2;

        // Soltar escalera
        if (window.player.isClimbing) { window.player.isClimbing = false; window.player._climbGrace = 0; return; }

        // Engancharse a escalera
        if (!window.player.isDead) {
            const bs = window.game.blockSize;
            const nearLadder = window.blocks.find(b => b.type === 'ladder' && Math.abs(pCX - (b.x + bs/2)) < bs * 0.7 && window.player.y + window.player.height > b.y - bs * 0.5 && window.player.y < b.y + bs * 2.0);
            if (nearLadder) { window.player.x = nearLadder.x + bs/2 - window.player.width/2; window.player._climbLadderX = nearLadder.x; window.player.isClimbing = true; window.player._climbGrace = 0; window.player.vy = 0; window.player.vx = 0; return; }
        }

        if (window.player.placementMode) return;

        // Recoger flecha clavada
        let arrowToPick = window.stuckArrows.find(sa => Math.hypot(pCX - sa.x, pCY - sa.y) < 60);
        if (arrowToPick) {
            if (window.canAddItem('arrows', 1)) { window.player.inventory.arrows = (window.player.inventory.arrows || 0) + 1; window.stuckArrows = window.stuckArrows.filter(sa => sa.id !== arrowToPick.id); window.sendWorldUpdate('remove_stuck_arrow', { id: arrowToPick.id }); if (window.playSound) window.playSound('pickup'); if (window.updateUI) window.updateUI(); if (window.renderToolbar) window.renderToolbar(); }
            else window.spawnDamageText(pCX, pCY - 30, "Inv. Lleno", '#fff');
            return;
        }

        // Interactuar con objetos cercanos
        let interactables = window.blocks.filter(b => ['box','campfire','door','grave','turret'].includes(b.type) && window.checkRectIntersection(window.player.x-15, window.player.y-15, window.player.width+30, window.player.height+30, b.x, b.y, window.game.blockSize, b.type==='door'?window.game.blockSize*2:window.game.blockSize));
        if (interactables.length > 1) {
            interactables.sort((a, b) => {
                const aCX = a.x + window.game.blockSize/2, bCX = b.x + window.game.blockSize/2;
                const aF = window.player.facingRight ? (aCX >= pCX) : (aCX <= pCX), bF = window.player.facingRight ? (bCX >= pCX) : (bCX <= pCX);
                if (aF && !bF) return -1; if (!aF && bF) return 1;
                return Math.abs(aCX - pCX) - Math.abs(bCX - pCX);
            });
        }
        if (interactables.length > 0) {
            let b = interactables[0];
            if      (b.type === 'door')                   { b.open = !b.open; window.spawnParticles(b.x+window.game.blockSize/2, b.y+window.game.blockSize, '#5C4033', 5); window.sendWorldUpdate('interact_door', { x: b.x, y: b.y }); if (window.playSound) window.playSound('door'); }
            else if (b.type === 'box' || b.type === 'grave') { window.currentOpenBox = b; if (window.toggleMenu) window.toggleMenu('box'); }
            else if (b.type === 'campfire')               { window.currentCampfire = b; if (window.toggleMenu) window.toggleMenu('campfire'); }
            else if (b.type === 'turret')                 { window.currentTurret = b; if (window.toggleMenu) window.toggleMenu('turret'); }
        }
    }

    // Atajos de mapa/menú — M gestionado en map.js con listener propio
    // Solo dejamos aquí el guard de input para prevenir acciones de juego

    if (!window.player.placementMode) {
        if (e.key === 'i' || e.key === 'I') { if (window.toggleMenu) window.toggleMenu('inventory'); }
        if (e.key === 'c' || e.key === 'C') { if (window.toggleMenu) window.toggleMenu('crafting'); }
        if (e.key === 'f' || e.key === 'F') {
            const _isTorch = window.player.activeTool === 'torch' || window.player.activeTool === 'torch_item';
            if (_isTorch) {
                window.player.torchLit = !window.player.torchLit;
                const _litMsg = window.player.torchLit ? '🔥 Antorcha encendida' : '💨 Antorcha apagada';
                window.spawnDamageText(window.player.x + window.player.width/2, window.player.y - 24, _litMsg, window.player.torchLit ? '#f39c12' : '#aaa');
            } else {
                if (window.eatFood) window.eatFood(15, 30);
            }
        }
        if (e.key === 'r' || e.key === 'R') { if (window.player.activeTool === 'hammer') { const modes = ['block','door','stair','dirt_block'], idx = modes.indexOf(window.player.buildMode); window.player.buildMode = modes[(idx+1)%modes.length]; let lbl = window.player.buildMode === 'stair' ? `Escalón (${window.player.stairMirror?'◀':'▶'})` : window.player.buildMode === 'dirt_block' ? '🪨 Bloque de Tierra' : window.player.buildMode; window.spawnDamageText(window.player.x+window.player.width/2, window.player.y-20, `Modo: ${lbl}`, '#fff'); } }
        if (e.key === 't' || e.key === 'T') { if (window.player.activeTool === 'hammer' && window.player.buildMode === 'stair') { window.player.stairMirror = !window.player.stairMirror; window.spawnDamageText(window.player.x+window.player.width/2, window.player.y-20, `Escalón: ${window.player.stairMirror?'◀ izq':'▶ der'}`, '#aaddff'); } }
        if (e.key === 'z' || e.key === 'Z') { window.game.zoomTarget = 1.0; window.spawnDamageText(window.player.x+window.player.width/2, window.player.y-20, 'Zoom: 1.0×', '#aaddff'); }
        if (e.key === '+' || e.key === '=') window.game.zoomTarget = Math.min(window.game.maxZoom, (window.game.zoomTarget||1) + 0.15);
        if (e.key === '-' || e.key === '_') window.game.zoomTarget = Math.max(window.game.minZoom, (window.game.zoomTarget||1) - 0.15);
        const num = parseInt(e.key); if (!isNaN(num) && num >= 1 && num <= 6) { if (window.selectToolbarSlot) window.selectToolbarSlot(num-1); if (window.renderToolbar) window.renderToolbar(); }
    }
});

window.addEventListener('mousemove', (e) => {
    if (!window.canvas || !window.player || window.player.isDead) return;
    const rect = window.canvas.getBoundingClientRect(), scaleX = window._canvasLogicW / rect.width, scaleY = window._canvasLogicH / rect.height;
    window.screenMouseX = (e.clientX - rect.left) * scaleX; window.screenMouseY = (e.clientY - rect.top) * scaleY;
    const W = window._canvasLogicW || 1280, H = window._canvasLogicH || 720, z = window.game.zoom || 1;
    window.mouseWorldX = (window.screenMouseX - W/2) / z + window.camera.x + W/2;
    window.mouseWorldY = (window.screenMouseY - H/2) / z + window.camera.y + H/2;
    if (window.player.isAiming || window.player.attackFrame > 0) window.player.facingRight = window.mouseWorldX >= window.player.x + window.player.width/2;
});

document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', (e) => {
    e.preventDefault(); if (!window.player || window.player.isDead) return;
    if (e.target.closest('.window-menu') || e.target.closest('#toolbar')) return;
    const type = e.dataTransfer.getData('text/plain');
    if (type && window.player.inventory[type] > 0) {
        let amt = window.player.inventory[type];
        let ni = { id: Math.random().toString(36).substring(2,9), x: window.player.x+window.player.width/2+(Math.random()*10-5), y: window.player.y-20+(Math.random()*10-5), vx: (Math.random()-0.5)*3, vy: (Math.random()-1)*3-1, type, amount: amt, life: 1.0 };
        window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', { item: ni }); window.player.inventory[type] = 0; if (window.updateUI) window.updateUI();
    }
});

// === COMBATE ===
window.tryHitEntity = function(pCX, pCY, dmg, meleeRange) {
    const range = meleeRange || window.player.miningRange;
    // Ángulo del swing hacia el mouse (o la dirección en que mira el personaje)
    const _mWX = window.mouseWorldX || pCX;
    const _mWY = window.mouseWorldY || pCY;
    const _swingAngle = Math.atan2(_mWY - pCY, _mWX - pCX);
    const _halfArc = Math.PI * 0.60; // ±108°: amplio para que sea jugable, pero no 360°

    function _inArc(ex, ey) {
        const _ea = Math.atan2(ey - pCY, ex - pCX);
        let _diff = Math.abs(_swingAngle - _ea);
        if (_diff > Math.PI) _diff = Math.PI * 2 - _diff;
        return _diff <= _halfArc;
    }

    let target = null;
    if (window.hoveredEntity && !window.hoveredEntity.isDead) {
        const hd = Math.hypot(pCX - (window.hoveredEntity.x+window.hoveredEntity.width/2), pCY - (window.hoveredEntity.y+window.hoveredEntity.height/2));
        // Solo usar hoveredEntity si está dentro del arco de swing
        if (hd <= range && _inArc(window.hoveredEntity.x+window.hoveredEntity.width/2, window.hoveredEntity.y+window.hoveredEntity.height/2))
            target = window.hoveredEntity;
    }
    if (!target) {
        let minD = Infinity;
        for (let _e of window.entities) {
            if (_e.isDead) continue;
            const d = Math.hypot(pCX - (_e.x+_e.width/2), pCY - (_e.y+_e.height/2));
            if (d > range || d >= minD) continue;
            // Filtro direccional: entidad debe estar dentro del arco de golpe
            if (!_inArc(_e.x+_e.width/2, _e.y+_e.height/2)) continue;
            minD = d; target = _e;
        }
    }
    if (!target) return false;
    let i = window.entities.indexOf(target); if (i === -1) return false;
    const missChance = Math.max(0.02, 0.15 - (window.player.stats.agi||0) * 0.02);
    if (Math.random() < missChance) { window.spawnDamageText(target.x+target.width/2+(Math.random()-0.5)*16, target.y-5-Math.random()*8, 'MISS', 'miss'); return true; }
    target.hp -= dmg; window.setHit(target); window.spawnParticles(target.x+target.width/2, target.y+target.height/2, '#ff4444', 5);
    if (window.playSound) window.playSound('hit_entity');
    window.spawnDamageText(target.x+target.width/2+(Math.random()-0.5)*16, target.y-5-Math.random()*8, `-${dmg}`, 'melee');
    target.vx = (target.x+target.width/2 > pCX ? 1 : -1) * 3.5; target.vy = -3.5; target.knockbackFrames = 10;
    if (target.hp <= 0) {
        window.killedEntities.push(target.id);
        window.sendWorldUpdate('kill_entity', { id: target.id });
        if (target.type === 'slime' && target.slimeSize === 2) {
            window.spawnParticles(target.x+target.width/2, target.y+target.height/2, '#55dd55', 20);
            window.spawnDamageText(target.x+target.width/2, target.y-10, '¡SPLIT!', '#55dd55');
            const _mW=Math.round(target.width*0.55), _mH=Math.round(target.height*0.55);
            for (let _s=0;_s<2;_s++) {
                window.entities.push({ id:'sl_mini_'+Date.now()+'_'+_s, type:'slime', name:'Slime', level:target.level,
                    x:target.x+target.width/2+(_s===0?-_mW*1.2:_mW*0.2), y:target.y+target.height-_mH,
                    width:_mW, height:_mH, vx:(_s===0?-3.2:3.2), vy:-4.5,
                    hp:Math.max(8,Math.floor(target.maxHp*0.3)), maxHp:Math.max(8,Math.floor(target.maxHp*0.3)),
                    damage:Math.max(2,Math.floor(target.damage*0.6)), isHit:false, attackCooldown:0,
                    slimeSize:1, slimeJumpTimer:15+Math.floor(Math.random()*20), slimeBounce:18, lastX:target.x });
            }
        } else { window.spawnParticles(target.x, target.y, '#ff4444', 15); }
        window.killEntityLoot(target);
        if (!window._deadMobLog) window._deadMobLog = [];
        if (target.type !== 'chicken' || Math.random() < 0.5)
            if (!(target.type === 'slime' && target.slimeSize === 1))
                window._deadMobLog.push({ type: target.type, level: target.level || 1, x: target.x });
        window.entities.splice(i, 1);
        if (window.updateUI) window.updateUI();
    }
    else { window.sendWorldUpdate('hit_entity', { id: target.id, dmg }); if (target.type === 'chicken') { target.fleeTimer = 180; target.fleeDir = target.x > pCX ? 1 : -1; window.sendWorldUpdate('flee_entity', { id: target.id, dir: target.fleeDir }); } }
    return true;
};

window.tryHitBlock = function(pCX, pCY, dmg, meleeRange) {
    const range = meleeRange || window.player.miningRange;
    let clickedBlockIndex = -1;
    for (let i = window.blocks.length - 1; i >= 0; i--) { let b = window.blocks[i], h = b.type==='door' ? window.game.blockSize*2 : window.game.blockSize; if (window.mouseWorldX >= b.x && window.mouseWorldX <= b.x+window.game.blockSize && window.mouseWorldY >= b.y && window.mouseWorldY <= b.y+h) { clickedBlockIndex = i; break; } }
    if (clickedBlockIndex === -1) return false;
    let b = window.blocks[clickedBlockIndex], h = b.type==='door' ? window.game.blockSize*2 : window.game.blockSize;
    if (Math.hypot(pCX - (b.x+window.game.blockSize/2), pCY - (b.y+h/2)) <= range) {
        b.hp -= dmg; window.setHit(b); window.spawnParticles(window.mouseWorldX, window.mouseWorldY, '#ff4444', 5);
        if (window.playSound) window.playSound('hit_block');
        if (b.hp <= 0) window.destroyBlockLocally(b); else window.sendWorldUpdate('hit_block', { x: b.x, y: b.y, dmg });
        window.player.meleeCooldown = Math.max(45, 90 - Math.floor((window.player.stats.agi||0) * 6));
        return true;
    }
    return false;
};

window.tryHitRock = function(pCX, pCY, dmg, meleeRange) {
    const range = meleeRange || window.player.miningRange;
    const swingAngle = Math.atan2(window.mouseWorldY - pCY, window.mouseWorldX - pCX), halfArc = Math.PI * 0.55;
    for (let i = window.rocks.length - 1; i >= 0; i--) {
        const r = window.rocks[i];
        const rFY = window.getGroundY ? window.getGroundY(r.x + r.width/2) : r.y + r.height;
        const rCX = r.x + r.width/2, rCY = rFY - r.height - r.height/2;
        const dist = Math.hypot(pCX - rCX, pCY - rCY); if (dist > range) continue;
        let ad = Math.abs(Math.atan2(rCY-pCY, rCX-pCX) - swingAngle); if (ad > Math.PI) ad = Math.PI*2 - ad; if (ad > halfArc) continue;
        r.hp -= dmg; window.setHit(r); window.spawnParticles(rCX, rCY, '#fff', 8);
        if (window.playSound) window.playSound('hit_rock');
        window.spawnDamageText(rCX+(Math.random()-0.5)*16, rCY-Math.random()*8, `-${dmg}`, 'melee');
        if (r.hp <= 0) {
            window.sendWorldUpdate('destroy_rock', { x: r.x }); window.spawnParticles(rCX, rFY-r.height+15, '#888', 20, 1.5);
            let ni = { id: Math.random().toString(36).substring(2,9), x:rCX, y:rFY-r.height+15, vx:(Math.random()-0.5)*3, vy:-1.5, type:'stone', amount:15+Math.floor(Math.random()*10), life:1.0 }; window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni}); window.rocks.splice(i, 1); window.gainXP(25);
        } else window.sendWorldUpdate('hit_rock', { x: r.x, dmg });
        window.player.meleeCooldown = Math.max(45, 90 - Math.floor((window.player.stats.agi||0) * 6));
        return true;
    }
    return false;
};

window.tryHitTree = function(pCX, pCY, dmg, meleeRange) {
    const range = meleeRange || window.player.miningRange;
    const swingAngle = Math.atan2(window.mouseWorldY - pCY, window.mouseWorldX - pCX), halfArc = Math.PI * 0.55;
    for (let i = window.trees.length - 1; i >= 0; i--) {
        const t = window.trees[i];
        const tFootY = window.getGroundY ? window.getGroundY(t.x + t.width/2) : (t.groundY || t.y + t.height);
        const tCX = t.x + t.width/2, tHitY = t.isStump ? tFootY-40 : tFootY - Math.min(t.height*0.35, range*0.6);
        const dist = Math.hypot(pCX - tCX, pCY - tHitY); if (dist > range) continue;
        let ad = Math.abs(Math.atan2(tHitY-pCY, tCX-pCX) - swingAngle); if (ad > Math.PI) ad = Math.PI*2 - ad; if (ad > halfArc) continue;
        t.hp -= dmg; window.setHit(t); window.spawnParticles(tCX, tHitY, '#c8a96b', 8);
        if (window.playSound) window.playSound('hit_tree');
        window.spawnDamageText(tCX+(Math.random()-0.5)*16, tHitY-Math.random()*8, `-${dmg}`, 'melee');
        if (t.hp <= 0) {
            if (t.isStump || t.regrowthCount >= 3) {
                window.spawnParticles(tCX, tFootY, '#C19A6B', 15, 1.2);
                let ni = { id: Math.random().toString(36).substring(2,9), x:tCX, y:tFootY-10, vx:(Math.random()-0.5)*3, vy:-1.5, type:'wood', amount: t.isStump?4:6, life:1.0 }; window.droppedItems.push(ni); window.sendWorldUpdate('drop_item',{item:ni}); window.sendWorldUpdate('destroy_tree', { x: t.x }); window.trees.splice(i, 1); window.gainXP(5);
            } else {
                window.spawnParticles(tCX, tFootY-20, '#2E8B57', 20, 1.5);
                let ni = { id: Math.random().toString(36).substring(2,9), x:tCX, y:tFootY-30, vx:(Math.random()-0.5)*3, vy:-1.5, type:'wood', amount:10, life:1.0 }; window.droppedItems.push(ni); window.sendWorldUpdate('drop_item',{item:ni}); t.isStump = true; t.hp = 50; t.maxHp = 50; window.sendWorldUpdate('stump_tree', { x: t.x, regrowthCount: t.regrowthCount, grownDay: t.grownDay }); window.gainXP(15);
            }
        } else window.sendWorldUpdate('hit_tree', { x: t.x, dmg });
        window.player.meleeCooldown = Math.max(45, 90 - Math.floor((window.player.stats.agi||0) * 6));
        return true;
    }
    return false;
};

window.attemptAction = function() {
    if (!window.player || window.player.isDead || document.querySelector('.window-menu.open')) return;
    if (window.player.placementMode) return;
    if (window.player.activeTool === 'bow') return;
    if (window.player.activeTool === 'molotov' && window.player.isCharging) return;
    if ((window.player.meleeCooldown || 0) > 0) return;

    window.player.attackFrame = 28;
    const pCX = window.player.x + window.player.width/2, pCY = window.player.y + window.player.height/2;
    const baseDmg = typeof window.getMeleeDamage === 'function' ? window.getMeleeDamage() : (window.player.baseDamage[window.player.activeTool] || 9);
    const tool = window.player.activeTool;
    let actionDone = false;
    const meleeRange = 80 + (window.player.stats.str || 0) * 2;
    const isHammer = tool === 'hammer';

    let entityDmg = isHammer ? 0 : Math.max(1, Math.floor(tool==='pickaxe' ? baseDmg*0.3 : (tool==='axe' ? baseDmg*0.6 : baseDmg)));
    let treeDmg   = isHammer ? 0 : (tool==='axe' ? Math.floor(baseDmg*1.5) : (tool==='sword' ? Math.floor(baseDmg*0.25) : (tool==='hand' ? baseDmg : 0)));
    let rockDmg   = isHammer ? 0 : (tool==='pickaxe' ? Math.floor(baseDmg*3) : 1);
    let blockDmg  = isHammer ? 0 : (tool==='sword' ? Math.max(1, Math.floor(baseDmg*0.2)) : baseDmg);

    window.player.meleeCooldown = Math.max(45, 90 - Math.floor((window.player.stats.agi||0) * 6));

    if (entityDmg > 0 && window.tryHitEntity(pCX, pCY, entityDmg, meleeRange)) actionDone = true;

    // PVP melee
    if (!actionDone && entityDmg > 0 && window.pvp?.activeOpponent && window.game.isMultiplayer) {
        const op = window.otherPlayers?.[window.pvp.activeOpponent];
        if (op && !op.isDead) {
            const opCX = op.x + (op.width||20)/2, opCY = op.y + (op.height||56)/2;
            if (Math.hypot(opCX-pCX, opCY-pCY) <= meleeRange) {
                let ad = Math.abs(Math.atan2(opCY-pCY, opCX-pCX) - Math.atan2(window.mouseWorldY-pCY, window.mouseWorldX-pCX));
                if (ad > Math.PI) ad = Math.PI*2 - ad;
                if (ad <= Math.PI*0.6) { window.sendWorldUpdate('pvp_hit', { targetId: window.pvp.activeOpponent, sourceId: window.socket.id, dmg: entityDmg }); window.spawnDamageText(opCX, opCY-20, `-${Math.floor(entityDmg)}`, '#ff4444'); window.spawnParticles(opCX, opCY, '#ff4444', 6); actionDone = true; }
            }
        }
    }

    if (!actionDone && blockDmg > 0 && window.tryHitBlock(pCX, pCY, blockDmg, meleeRange)) actionDone = true;

    // ── Telas de araña: golpear destruye y da tela ─────────────────────────
    if (!actionDone && window.caveCobwebs?.length > 0) {
        for (let _ci = window.caveCobwebs.length - 1; _ci >= 0; _ci--) {
            const _cw = window.caveCobwebs[_ci];
            const _cwCX = _cw.x + _cw.w / 2, _cwCY = _cw.y + _cw.h / 2;
            if (Math.hypot(_cwCX - pCX, _cwCY - pCY) > meleeRange + 20) continue;
            _cw.hp -= baseDmg;
            window.spawnParticles(_cwCX, _cwCY, '#ffffff', 5, 0.4);
            if (_cw.hp <= 0) {
                window.caveCobwebs.splice(_ci, 1);
                // Drop de tela directamente al inventario
                const _webAmt = 1 + Math.floor(Math.random() * 2);
                window.player.inventory.web = (window.player.inventory.web || 0) + _webAmt;
                window.spawnDamageText(_cwCX, _cwCY - 10, `+${_webAmt} 🕸️`, '#e0e0e0');
                if (window.updateUI) window.updateUI();
                actionDone = true;
            }
            break;
        }
    }

    // Árbol vs piedra: priorizar el más cercano al cursor
    if (!actionDone && (treeDmg > 0 || rockDmg > 0)) {
        const distToTree = (() => { for (const t of window.trees) { const tFY = window.getGroundY ? window.getGroundY(t.x+t.width/2) : t.y+t.height; const tHY = t.isStump ? tFY-40 : tFY-Math.min(t.height*0.35, meleeRange*0.6); const d = Math.hypot(window.mouseWorldX-(t.x+t.width/2), window.mouseWorldY-tHY); if (d <= meleeRange) return d; } return Infinity; })();
        const distToRock = (() => { for (const r of window.rocks) { const rFY = window.getGroundY ? window.getGroundY(r.x+r.width/2) : r.y+r.height; const d = Math.hypot(window.mouseWorldX-(r.x+r.width/2), window.mouseWorldY-(rFY-r.height/2)); if (d <= meleeRange) return d; } return Infinity; })();
        if (distToTree <= distToRock) {
            if (treeDmg > 0 && window.tryHitTree(pCX, pCY, treeDmg, meleeRange)) actionDone = true;
            if (!actionDone && rockDmg > 0 && window.tryHitRock(pCX, pCY, rockDmg, meleeRange)) actionDone = true;
        } else {
            if (rockDmg > 0 && window.tryHitRock(pCX, pCY, rockDmg, meleeRange)) actionDone = true;
            if (!actionDone && treeDmg > 0 && window.tryHitTree(pCX, pCY, treeDmg, meleeRange)) actionDone = true;
        }
    }

    // ── Minar terreno estilo Terraria ─────────────────────────────────────
    // Cooldown SEPARADO del melee → puede minar rápido sin bloquear combate
    if (!isHammer && window.getUGCellV && window.damageCellUG && window.worldYToUGRow) {
        const bs   = window.game.blockSize;
        const mCol = Math.floor(window.mouseWorldX / bs);
        let   mRow = window.worldYToUGRow(mCol, window.mouseWorldY);
        // Si el cursor está ligeramente sobre la superficie (pasto), clampar a row 0
        // Esto permite minar la capa de tierra superficial al hacer click sobre el pasto
        if (mRow < 0) {
            const cd = window.getTerrainCol ? window.getTerrainCol(mCol) : null;
            const topY = cd ? cd.topY : (window.game.baseGroundLevel || 510);
            if (window.mouseWorldY >= topY - bs * 0.5) mRow = 0; // dentro de 0.5 bloques de la superficie
        }
        const cellMat = (mRow >= 0) ? window.getUGCellV(mCol, mRow) : 'air';

        // Guardar celda apuntada para highlight visual
        window._mineCursor = null;

        if (cellMat && cellMat !== 'air' && cellMat !== 'bedrock') {
            const cellWCX = mCol * bs + bs/2;
            const cellWCY = window.ugRowToWorldY(mCol, mRow) + bs/2;
            const distToCell = Math.hypot(pCX - cellWCX, pCY - cellWCY);
            const mineRange  = (window.player.miningRange || 150) + bs * 1.5;

            if (distToCell <= mineRange) {
                // Highlight de cursor (para render)
                window._mineCursor = { col: mCol, row: mRow, mat: cellMat };

                // Cooldown por material — mucho más rápido que melee
                const matCD = (window.UG_MINE_CD && window.UG_MINE_CD[cellMat]) || 8;
                const toolCD = tool === 'pickaxe' ? matCD
                             : tool === 'axe'     ? Math.ceil(matCD * 1.6)
                             : tool === 'sword'   ? Math.ceil(matCD * 2.0)
                             : Math.ceil(matCD * 3.5); // mano/antorcha

                if ((window.player._mineCooldown || 0) <= 0) {
                    const toolMult = tool === 'pickaxe' ? 1.0
                                   : tool === 'axe'     ? 0.6
                                   : tool === 'sword'   ? 0.5
                                   : 0.28;
                    const terrainDmg = Math.max(1, Math.floor(baseDmg * toolMult));
                    const broken = window.damageCellUG(mCol, mRow, terrainDmg);

                    // Explorar zona al minar (fog of war)
                    if (window.exploreArea) window.exploreArea(mCol * bs + bs/2, cellWCY, 80);

                    // Sync multijugador: enviar daño de celda a otros jugadores.
                    // broken=true cuando la celda se destruyó en este golpe → el servidor
                    // la guarda en worldState.minedCells para persistirla entre sesiones.
                    if (window.game.isMultiplayer && window.sendWorldUpdate) {
                        window.sendWorldUpdate('mine_cell', {
                            col: mCol, row: mRow, dmg: terrainDmg,
                            broken: !!broken   // true solo cuando la celda se destruyó
                        });
                    }

                    if (broken) {
                        // Materiales que se dropean: todo lo mineable cae como item físico
                        // Con pickaxe se obtiene el material real; con otras herramientas solo dirt/stone
                        const canDropRare = (tool === 'pickaxe');
                        const dropMap = { dirt:'dirt', stone:'stone', coal:'coal', sulfur:'sulfur', diamond:'diamond' };
                        const rawDrop = dropMap[broken] || 'stone';
                        const effectiveDrop = (broken === 'diamond' || broken === 'sulfur') && !canDropRare ? 'stone' : rawDrop;
                        const dropAmt = broken === 'diamond' ? 1 : broken === 'sulfur' ? 2 : broken === 'coal' ? 2 : 3;

                        // Spawnar item físico que cae con gravedad (se recoge con Y)
                        const dropId = Math.random().toString(36).substring(2, 9);
                        const dropItem = {
                            id: dropId,
                            x: cellWCX - 6 + (Math.random()-0.5)*8,
                            y: cellWCY - 4,
                            vx: (Math.random()-0.5) * 2.5,
                            vy: -2.5 - Math.random() * 1.5,
                            type: effectiveDrop,
                            amount: dropAmt,
                            life: 1.0
                        };
                        window.droppedItems.push(dropItem);
                        if (window.sendWorldUpdate) window.sendWorldUpdate('drop_item', { item: dropItem });

                        const pColor = broken==='diamond'?'#7df9ff': broken==='sulfur'?'#e8c830': broken==='coal'?'#555':'#8a7060';
                        window.spawnParticles(cellWCX, cellWCY, pColor, 10);
                        if (window.playSound) window.playSound('hit_entity');
                        window._mineCursor = null;

                        // Si se rompe row=0 (superficie), limpiar árboles/rocas encima
                        if (mRow === 0) {
                            const colX = mCol * bs, colXR = colX + bs;
                            for (let ti = window.trees.length-1; ti >= 0; ti--) {
                                const t = window.trees[ti];
                                const tCX = t.x + t.width/2;
                                if (tCX >= colX && tCX < colXR) {
                                    window.spawnParticles(tCX, cellWCY-20, '#528c2a', 12);
                                    window.removedTrees.push(t.x);
                                    window.sendWorldUpdate('destroy_tree', { x: t.x });
                                    window.trees.splice(ti, 1);
                                }
                            }
                            for (let ri = window.rocks.length-1; ri >= 0; ri--) {
                                const r = window.rocks[ri];
                                const rCX = r.x + r.width/2;
                                if (rCX >= colX && rCX < colXR) {
                                    window.spawnParticles(rCX, cellWCY-20, '#888', 10);
                                    window.rocks.splice(ri, 1);
                                }
                            }
                            if (window._terrainColCache) delete window._terrainColCache[mCol];
                            // Invalidar cache de tiles para que el pasto desaparezca visualmente
                            if (window._terrainTileCache) delete window._terrainTileCache[mCol];
                            if (window._bgStripCache)     window._bgStripCache = null;
                        }
                    } else {
                        // Partículas de impacto leves
                        const pC = cellMat==='coal'?'#555': cellMat==='sulfur'?'#c8a000': cellMat==='diamond'?'#7df9ff':'#7a6a58';
                        window.spawnParticles(cellWCX, cellWCY, pC, 3);
                        if (window.playSound) window.playSound('hit_entity');
                    }
                    window.player._mineCooldown = toolCD;
                    if (!actionDone) actionDone = true;
                } else {
                    // Cooldown activo — bloquear solo si apunta a celda
                    if (!actionDone) actionDone = true;
                }
            }
        }
    }

    // Martillo: construir
    if (!actionDone && tool === 'hammer') {
        const bs = window.game.blockSize;
        const gridX = Math.floor(window.mouseWorldX/bs)*bs, gridY = Math.floor(window.mouseWorldY/bs)*bs;
        const isDoorMode = window.player.buildMode === 'door', isStairMode = window.player.buildMode === 'stair';
        const isDirtMode = window.player.buildMode === 'dirt_block';
        const itemHeight = isDoorMode ? bs*2 : bs;
        const woodCost = isDoorMode ? 4 : (isDirtMode ? 0 : 2);
        const dirtCost = isDirtMode ? 2 : 0;
        if (Math.hypot(pCX-(gridX+bs/2), pCY-(gridY+itemHeight/2)) <= window.player.miningRange) {
            const hasWood = (window.player.inventory.wood || 0) >= woodCost;
            const hasDirt = (window.player.inventory.dirt  || 0) >= dirtCost;
            if ((woodCost === 0 || hasWood) && (dirtCost === 0 || hasDirt)) {
                if (window.isValidPlacement(gridX, gridY, bs, itemHeight, true, true)) {
                    let newB = { x: gridX, y: gridY, type: isDoorMode?'door':(isStairMode?'stair':(isDirtMode?'dirt_block':'block')), open: false, hp: isDirtMode?80:300, maxHp: isDirtMode?80:300, isHit: false };
                    if (isStairMode) newB.facingRight = !window.player.stairMirror;
                    window.blocks.push(newB); window.sendWorldUpdate('place_block', { block: newB });
                    if (woodCost > 0) window.player.inventory.wood -= woodCost;
                    if (dirtCost > 0) window.player.inventory.dirt = Math.max(0, (window.player.inventory.dirt||0) - dirtCost);
                    window.spawnParticles(gridX+15, gridY+15, isDirtMode?'#7a5230':'#D2B48C', 5, 0.5);
                    if (window.playSound) window.playSound('build'); if (window.updateUI) window.updateUI();
                    window.player.meleeCooldown = 8;
                } else if (window.game.frameCount % 30 === 0) window.spawnDamageText(window.mouseWorldX, window.mouseWorldY-10, "Lugar Inválido", '#ffaa00');
            } else {
                const missing = !hasWood ? `¡Faltan ${woodCost} madera!` : `¡Faltan ${dirtCost} tierra!`;
                if (!window._noMatCooldown || window.game.frameCount - window._noMatCooldown > 20) { window._noMatCooldown = window.game.frameCount; window.spawnDamageText(window.mouseWorldX, window.mouseWorldY-10, missing, '#ff6b6b'); if (window.playSound) window.playSound('arrow_break'); }
            }
        }
    }
    if (actionDone && window.useTool) window.useTool();
};

window.addEventListener('mousedown', (e) => {
    if (!window.game?.isRunning || !window.player || window.player.isDead || document.querySelector('.window-menu.open')) return;
    if (e.target.closest('#global-chat-log') || e.target.closest('.log-msg') || e.target.closest('#chat-container')) return;
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select') ||
        e.target.closest('#top-controls') || e.target.closest('#server-info') || e.target.closest('#server-menu-panel') ||
        e.target.closest('#pvp-player-panel') || e.target.closest('#ui-layer button') ||
        e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' ||
        e.target.closest('.toggle-btn') || e.target.closest('.action-btn') ||
        e.target.closest('#interaction-prompt') || e.target.closest('#hud-bars') ||
        e.target.closest('#toolbar-container') || e.target.closest('.tab-btn')) return;

    if (e.button === 0) { if (!window.keys) window.keys = {}; window.keys.mouseLeft = true; }

    if (window.player.placementMode) {
        if (e.button === 2) { window.player.placementMode = null; return; }
        if (e.button === 0) {
            if (!window.player.inventory[window.player.placementMode] || window.player.inventory[window.player.placementMode] <= 0) { window.spawnDamageText(window.mouseWorldX, window.mouseWorldY-10, "¡Sin materiales!", "#ff4444"); if (window.playSound) window.playSound('arrow_break'); window.player.placementMode = null; if (window.renderToolbar) window.renderToolbar(); return; }
            const bs2 = window.game.blockSize, gridX = Math.floor(window.mouseWorldX/bs2)*bs2, gridY = Math.floor(window.mouseWorldY/bs2)*bs2;
            if (Math.hypot((window.player.x+window.player.width/2)-(gridX+bs2/2), (window.player.y+window.player.height/2)-(gridY+bs2/2)) <= window.player.miningRange) {
                let type = window.player.placementMode === 'boxes' ? 'box' : window.player.placementMode === 'bed_item' ? 'bed' : window.player.placementMode === 'barricade_item' ? 'barricade' : window.player.placementMode === 'ladder_item' ? 'ladder' : window.player.placementMode === 'turret_item' ? 'turret' : window.player.placementMode === 'dirt' ? 'dirt_block' : 'campfire';
                let validPlace;
                if (type === 'ladder') {
                    const lGY = window.getGroundY ? window.getGroundY(gridX+bs2/2) : window.game.groundLevel;
                    const lGroundGridY = Math.ceil(lGY/bs2)*bs2;
                    validPlace = !window.checkRectIntersection(gridX,gridY,bs2,bs2,window.player.x,window.player.y,window.player.width,window.player.height) && !window.blocks.some(b=>b.type==='ladder'&&Math.abs(b.x-gridX)<1&&Math.abs(b.y-gridY)<1) && ((gridY+bs2)>=lGroundGridY || window.blocks.some(b=>b.type==='ladder'&&Math.abs(b.x-gridX)<1&&Math.abs(b.y-(gridY+bs2))<2) || window.blocks.some(b=>(b.type==='block'||b.type==='stair')&&Math.abs(b.x-gridX)<1&&Math.abs(b.y-(gridY+bs2))<2)) && Math.hypot((window.player.x+window.player.width/2)-(gridX+bs2/2),(window.player.y+window.player.height/2)-(gridY+bs2/2)) <= window.player.miningRange+60;
                } else if (type === 'turret') {
                    const blockBelow = window.blocks.some(b => b.type==='block' && Math.abs(b.x-gridX)<bs2-1 && Math.abs(b.y-(gridY+bs2))<4);
                    const noOverlap  = !window.blocks.some(b => Math.abs(b.x-gridX)<bs2-1 && Math.abs(b.y-gridY)<bs2-1);
                    const inRange    = Math.hypot((window.player.x+window.player.width/2)-(gridX+bs2/2),(window.player.y+window.player.height/2)-(gridY+bs2/2)) <= (window.player.miningRange||150)+40;
                    if (!blockBelow) window.spawnDamageText(window.mouseWorldX, window.mouseWorldY-10, 'Necesita un bloque debajo', '#ffaa00');
                    validPlace = blockBelow && noOverlap && inRange;
                } else validPlace = window.isValidPlacement(gridX, gridY, bs2, bs2, true, false);

                if (validPlace) {
                    let newB = { x: gridX, y: gridY, type, hp: type==='barricade'?150:(type==='ladder'?50:(type==='turret'?300:(type==='dirt_block'?80:200))), maxHp: type==='barricade'?150:(type==='ladder'?50:(type==='turret'?300:(type==='dirt_block'?80:200))), isHit: false };
                    if (type === 'box')      newB.inventory = { wood:0, stone:0, meat:0, web:0, arrows:0, cooked_meat:0 };
                    if (type === 'campfire') { newB.wood = 0; newB.meat = 0; newB.cooked = 0; newB.isBurning = false; newB.burnTime = 0; newB.cookTimer = 0; }
                    if (type === 'turret')   { newB.arrows = 0; newB.fireCooldown = 0; newB.aimAngle = 0; }
                    if (type === 'bed')      { window.blocks = window.blocks.filter(b => b.type!=='bed'||b.owner!==window.player.name); newB.owner = window.player.name; window.player.bedPos = { x: gridX, y: gridY }; window.spawnDamageText(gridX+15, gridY-10, "Punto Respawn", '#4CAF50'); window.sendWorldUpdate('remove_old_bed', { owner: window.player.name }); }
                    window.blocks.push(newB); window.sendWorldUpdate('place_block', { block: newB }); window.player.inventory[window.player.placementMode]--; window.spawnParticles(gridX+15, gridY+15, '#fff', 10); if (window.playSound) window.playSound('build');
                    if (window.player.inventory[window.player.placementMode] <= 0) { window.player.toolbar[window.player.activeSlot] = null; window.selectToolbarSlot(0); }
                    if (window.updateUI) window.updateUI(); if (window.renderToolbar) window.renderToolbar();
                } else window.spawnDamageText(window.mouseWorldX, window.mouseWorldY-10, "Lugar Inválido", '#ffaa00');
            }
        }
        return;
    }

    if (window.player.activeTool === 'bow') { if (e.button === 2) window.player.isAiming = true; if (e.button === 0 && window.player.isAiming && window.player.inventory.arrows > 0) window.player.isCharging = true; return; }
    if (window.player.activeTool === 'molotov') { if (e.button === 2) window.player.isAiming = true; if (e.button === 0 && window.player.isAiming && (window.player.inventory.molotov||0) > 0) window.player.isCharging = true; return; }

    // Antorcha (herramienta o ítem): click derecho → clavar antorcha en superficie sólida
    if ((window.player.activeTool === 'torch' || window.player.activeTool === 'torch_item') && e.button === 2) {
        const torchCount = (window.player.inventory.torch_item || 0);
        if (torchCount <= 0 && window.player.activeTool !== 'torch') {
            window.spawnDamageText(window.mouseWorldX, window.mouseWorldY-10, '¡Sin antorchas!', '#ffaa00');
            return;
        }
        const bs2 = window.game.blockSize;
        const pCX2 = window.player.x + window.player.width/2;
        const pCY2 = window.player.y + window.player.height/2;

        // ── Detectar superficie sólida más cercana al cursor ──────────────────
        // Primero intentar con la celda UG exacta del cursor.
        // Si es sólida → encontrar la cara más cercana y colocar en la celda adyacente.
        // Si es aire → buscar los 4 vecinos (arriba/abajo/izq/der) para la cara de apoyo.
        let torchGridX = null, torchGridY = null;

        const mMouseCol = Math.floor(window.mouseWorldX / bs2);
        const mMouseRow = window.worldYToUGRow ? window.worldYToUGRow(mMouseCol, window.mouseWorldY) : -1;
        const mCD       = window.getTerrainCol ? window.getTerrainCol(mMouseCol) : null;

        function _isSolidAt(col, row) {
            if (row < 0) return false;
            // Comprobar bloque construido sólido en esa celda
            const cx = col * bs2, cy = (mCD ? mCD.topY : 0) + row * bs2;
            if (window.blocks.some(b => !['door','box','campfire','bed','grave','barricade','ladder','placed_torch'].includes(b.type) && Math.abs(b.x - cx) < 2 && Math.abs(b.y - cy) < 2)) return true;
            // Comprobar celda UG
            const mat = window.getUGCellV ? window.getUGCellV(col, row) : null;
            return mat && mat !== 'air';
        }

        function _isEmptyAt(col, row) {
            // Verifica que la celda esté libre (sin bloque y sin terreno sólido)
            if (!window.getTerrainCol || !window.getUGCellV) return false;
            const cd2 = window.getTerrainCol(col);
            if (!cd2 || cd2.type === 'hole') return false;
            const mat2 = row >= 0 ? window.getUGCellV(col, row) : 'air';
            if (mat2 && mat2 !== 'air') return false;
            const cx2 = col * bs2, cy2 = cd2.topY + row * bs2;
            return !window.blocks.some(b => Math.abs(b.x - cx2) < 2 && Math.abs(b.y - cy2) < 2);
        }

        if (mMouseRow >= 0 && _isSolidAt(mMouseCol, mMouseRow)) {
            // Cursor sobre celda sólida → colocar en la cara más cercana
            const cTopY = (mCD ? mCD.topY : 0) + mMouseRow * bs2;
            const cBotY = cTopY + bs2;
            const cLftX = mMouseCol * bs2;
            const cRgtX = cLftX + bs2;
            const dTop = Math.abs(window.mouseWorldY - cTopY);
            const dBot = Math.abs(window.mouseWorldY - cBotY);
            const dLft = Math.abs(window.mouseWorldX - cLftX);
            const dRgt = Math.abs(window.mouseWorldX - cRgtX);
            const minD = Math.min(dTop, dBot, dLft, dRgt);
            if (minD === dTop  && _isEmptyAt(mMouseCol, mMouseRow - 1)) { torchGridX = cLftX;        torchGridY = cTopY - bs2; }
            else if (minD === dLft  && _isEmptyAt(mMouseCol - 1, mMouseRow)) { torchGridX = cLftX - bs2; torchGridY = cTopY; }
            else if (minD === dRgt  && _isEmptyAt(mMouseCol + 1, mMouseRow)) { torchGridX = cRgtX;       torchGridY = cTopY; }
            else if (minD === dBot  && _isEmptyAt(mMouseCol, mMouseRow + 1)) { torchGridX = cLftX;        torchGridY = cBotY; }
            // Fallback: cara superior
            if (torchGridX === null && _isEmptyAt(mMouseCol, mMouseRow - 1)) { torchGridX = cLftX; torchGridY = cTopY - bs2; }
        } else {
            // Cursor sobre celda vacía → usar la celda del cursor si hay un vecino sólido
            if (mMouseRow >= 0 && mCD) {
                const cTopY = mCD.topY + mMouseRow * bs2;
                const cLftX = mMouseCol * bs2;
                // Vecino inferior (suelo), luego izq/der, luego superior
                if (_isSolidAt(mMouseCol, mMouseRow + 1))     { torchGridX = cLftX;        torchGridY = cTopY; }
                else if (_isSolidAt(mMouseCol - 1, mMouseRow)){ torchGridX = cLftX;        torchGridY = cTopY; }
                else if (_isSolidAt(mMouseCol + 1, mMouseRow)){ torchGridX = cLftX;        torchGridY = cTopY; }
                else if (_isSolidAt(mMouseCol, mMouseRow - 1)){ torchGridX = cLftX;        torchGridY = cTopY; }
            }
            // Fallback: snap de grilla normal (comportamiento anterior)
            if (torchGridX === null) {
                torchGridX = Math.floor(window.mouseWorldX / bs2) * bs2;
                torchGridY = Math.floor(window.mouseWorldY / bs2) * bs2;
            }
        }

        if (torchGridX === null) { window.spawnDamageText(window.mouseWorldX, window.mouseWorldY-10, 'Sin superficie', '#ffaa00'); return; }

        const dist = Math.hypot(pCX2 - (torchGridX + bs2/2), pCY2 - (torchGridY + bs2/2));
        if (dist > (window.player.miningRange || 150) + bs2) return;

        const alreadyThere = window.blocks.some(b => Math.abs(b.x - torchGridX) < 2 && Math.abs(b.y - torchGridY) < 2);
        if (alreadyThere) { window.spawnDamageText(window.mouseWorldX, window.mouseWorldY-10, "Lugar ocupado", '#ffaa00'); return; }

        const torchBlock = { x: torchGridX, y: torchGridY, type: 'placed_torch', hp: 600, maxHp: 600 };
        window.blocks.push(torchBlock);
        window.sendWorldUpdate('place_block', { block: torchBlock });
        if (window.player.activeTool === 'torch_item') {
            window.player.inventory.torch_item = Math.max(0, torchCount - 1);
            if (window.player.inventory.torch_item <= 0) { window.player.toolbar[window.player.activeSlot] = null; window.selectToolbarSlot(0); }
        }
        window.spawnParticles(torchGridX + bs2/2, torchGridY + bs2/2, '#f39c12', 8);
        if (window.playSound) window.playSound('build');
        if (window.updateUI) window.updateUI();
        if (window.renderToolbar) window.renderToolbar();
        return;
    }


    if (window.player.activeTool === 'hammer' && e.button === 2) {
        if ((window.player.meleeCooldown || 0) > 0) return;
        const pCX = window.player.x + window.player.width/2, pCY = window.player.y + window.player.height/2, range = (window.player.miningRange||120) + 20;
        let repaired = false;
        for (const b of window.blocks) {
            if (!b.maxHp || b.hp >= b.maxHp) continue;
            const bh = b.type==='door' ? window.game.blockSize*2 : window.game.blockSize;
            if (Math.hypot(window.mouseWorldX - (b.x+window.game.blockSize/2), window.mouseWorldY - (b.y+bh/2)) > range) continue;
            const missing = b.maxHp - b.hp, healAmt = Math.min(missing, 60), woodCost = Math.max(1, Math.min(5, Math.ceil(healAmt/20)));
            if ((window.player.inventory.wood||0) < woodCost) { window.spawnDamageText(b.x+window.game.blockSize/2, b.y+bh/2-20, '¡Sin madera!', '#ffaa00'); break; }
            b.hp = Math.min(b.maxHp, b.hp + healAmt); window.player.inventory.wood -= woodCost; window.setHit(b); window.spawnParticles(b.x+window.game.blockSize/2, b.y+bh/2, '#D2B48C', 8); window.spawnDamageText(b.x+window.game.blockSize/2, b.y+bh/2-16, `+${healAmt} 🔨`, '#7ec850');
            window.sendWorldUpdate('hit_block', { x: b.x, y: b.y, dmg: -healAmt }); if (window.playSound) window.playSound('build'); if (window.updateUI) window.updateUI();
            window.player.meleeCooldown = Math.max(45, 90 - Math.floor((window.player.stats.agi||0) * 6));
            repaired = true; break;
        }
        if (!repaired && window.game.frameCount % 20 === 0) window.spawnDamageText(window.mouseWorldX, window.mouseWorldY-10, 'Nada que reparar', '#888');
        return;
    }

    if (e.button === 0) window.attemptAction();
});

window.addEventListener('mouseup', (e) => {
    if (!window.game?.isRunning) return;
    if (e.button === 0 && window.keys) window.keys.mouseLeft = false;
    if (!window.player || window.player.isDead) return;

    if (window.player.activeTool === 'bow') {
        if (e.button === 2) { window.player.isAiming = false; window.player.isCharging = false; window.player.chargeLevel = 0; }
        if (e.button === 0 && window.player.isCharging) {
            if (window.player.chargeLevel > 5 && window.player.inventory.arrows > 0) {
                window.player.inventory.arrows--;
                let pCX = window.player.x + window.player.width/2, pCY = window.player.y + 6, angle = Math.atan2(window.mouseWorldY-pCY, window.mouseWorldX-pCX), power = 4 + (window.player.chargeLevel/100)*6;
                let newArrow = { x: pCX, y: pCY, vx: Math.cos(angle)*power, vy: Math.sin(angle)*power, life: 250, damage: window.getBowDamage(), isEnemy: false, owner: window.socket?.id };
                window.projectiles.push(newArrow); window.sendWorldUpdate('spawn_projectile', newArrow); if (window.playSound) window.playSound('arrow_shoot'); if (window.useTool) window.useTool();
            }
            window.player.isCharging = false; window.player.chargeLevel = 0; if (window.updateUI) window.updateUI();
        }
    }

    if (window.player.activeTool === 'molotov') {
        if (e.button === 2) { window.player.isAiming = false; window.player.isCharging = false; window.player.chargeLevel = 0; }
        if (e.button === 0 && window.player.isCharging) {
            if (window.player.chargeLevel > 5 && (window.player.inventory.molotov||0) > 0) {
                window.player.inventory.molotov--;
                const pCX = window.player.x + window.player.width/2, pCY = window.player.y + 8, angle = Math.atan2(window.mouseWorldY-pCY, window.mouseWorldX-pCX), power = 5.0 + (window.player.chargeLevel/100)*9.0;
                const newMolotov = { x: pCX, y: pCY, vx: Math.cos(angle)*power, vy: Math.sin(angle)*power, life: 180, isMolotov: true, isEnemy: false, owner: window.socket?.id };
                window.projectiles.push(newMolotov); window.sendWorldUpdate('spawn_projectile', newMolotov); if (window.playSound) window.playSound('throw_molotov'); if (window.useTool) window.useTool(); if (window.updateUI) window.updateUI(); if (window.renderToolbar) window.renderToolbar();
            }
            window.player.isCharging = false; window.player.chargeLevel = 0; if (window.updateUI) window.updateUI();
        }
    }
});

window.addEventListener('wheel', (e) => {
    if (!window.game?.isRunning || !window.player || window.player.isDead) return;
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); window.game.zoomTarget = Math.min(window.game.maxZoom, Math.max(window.game.minZoom, (window.game.zoomTarget||1) + (e.deltaY > 0 ? -0.1 : 0.1))); return; }
    let dir = Math.sign(e.deltaY);
    if (dir > 0) window.player.activeSlot = (window.player.activeSlot + 1) % 6; else if (dir < 0) window.player.activeSlot = (window.player.activeSlot - 1 + 6) % 6;
    if (window.selectToolbarSlot) window.selectToolbarSlot(window.player.activeSlot); if (window.renderToolbar) window.renderToolbar();
}, { passive: false });

// === LOOP PRINCIPAL ===
function update() {
    try {
        if (!window.game?.isRunning || !window.canvas || !window.player) return;
        const bs = window.game.blockSize;
        let pCX = window.player.x + window.player.width/2, pCY = window.player.y + window.player.height/2;
        const _W = window._canvasLogicW || 1280, _H = window._canvasLogicH || 720, _z = window.game.zoom || 1;

        window.mouseWorldX = (window.screenMouseX - _W/2) / _z + window.camera.x + _W/2;
        window.mouseWorldY = (window.screenMouseY - _H/2) / _z + window.camera.y + _H/2;

        // Entidad bajo el cursor
        window.hoveredEntity = null; let _bestDist = Infinity;
        for (const _he of window.entities) {
            if (_he.x < window.mouseWorldX && _he.x+_he.width > window.mouseWorldX && _he.y < window.mouseWorldY && _he.y+_he.height > window.mouseWorldY) {
                const _hd = Math.hypot(window.mouseWorldX-(_he.x+_he.width/2), window.mouseWorldY-(_he.y+_he.height/2));
                if (_hd < _bestDist) { _bestDist = _hd; window.hoveredEntity = _he; }
            }
        }

        window.game.frameCount++;
        // Exploración automática (fog of war) — cada 6 frames para rendimiento
        if (window.game.frameCount % 6 === 0 && window.updateExploration) window.updateExploration();
        // Actualizar mapa si está abierto
        if (window._mapOpen && window._mapDirty && window.renderMap) window.renderMap();
        if (window.game.screenShake > 0) window.game.screenShake--;
        if (window.player.attackFrame > 0) window.player.attackFrame--;
        if ((window.player.meleeCooldown || 0) > 0) window.player.meleeCooldown--;
        if ((window.player._mineCooldown || 0) > 0) window.player._mineCooldown--;

        // Durabilidad de antorcha: solo consume cuando está encendida (F)
        if (window.game.frameCount % 60 === 0 && !window.player.isDead && window.player.activeTool === 'torch' && window.player.torchLit && window.player.toolHealth?.torch) {
            window.player.toolHealth.torch--;
            if (window.renderToolbar) window.renderToolbar();
            if (window.player.toolHealth.torch <= 0) { window.player.torchLit = false; window.player.toolbar[window.player.activeSlot] = null; window.selectToolbarSlot(0); window.spawnDamageText(pCX, window.player.y-20, '¡Antorcha Apagada!', '#ff4444'); if (window.renderToolbar) window.renderToolbar(); }
        }

        // Antorchas clavadas: duran 10 min en el suelo (36000 frames). Cada 60 frames restan 1 de hp.
        // maxHp=600 → 600*60 frames = 36000 frames ≈ 10 minutos de juego real.
        if (window.game.frameCount % 60 === 0) {
            for (let _bi = window.blocks.length - 1; _bi >= 0; _bi--) {
                const _tb = window.blocks[_bi];
                if (_tb.type !== 'placed_torch') continue;
                _tb.hp--;
                if (_tb.hp <= 0) {
                    window.blocks.splice(_bi, 1);
                    window.sendWorldUpdate('hit_block', { x: _tb.x, y: _tb.y, dmg: 9999, destroyed: true });
                    window.spawnParticles(_tb.x + bs/2, _tb.y + bs/2, '#888', 6);
                }
            }
        }

        // Carga del arco/molotov
        if (window.player.isCharging) { window.player.chargeLevel = Math.min(100, window.player.chargeLevel + 0.55 * (1 + (window.player.stats.agi||0)*0.18)); }

        // Tiempo del mundo
        const currentUptime = window.game.serverStartTime ? (Date.now() - window.game.serverStartTime) : (window.game.frameCount * (1000/60));
        const totalFrames = Math.floor(currentUptime / (1000/60)) + 28800;
        const dayFloat = totalFrames / 86400;
        const _prevDay = window.game.days || 1;
        window.game.days = Math.floor(dayFloat) + 1;
        const hourFloat = (totalFrames / 3600) % 24;
        const clockH = Math.floor(hourFloat), clockM = Math.floor((totalFrames % 3600) / 60);
        const isNight = hourFloat >= 23 || hourFloat < 5, isDay = hourFloat >= 6 && hourFloat < 18;

        // ── Nuevo día: limpiar lista de muertos y respawnear mobs con +nivel ──
        if (window.game.days > _prevDay && isMasterClient !== false) {
            const _newDay = window.game.days;
            // Guardar snapshot de los mobs muertos para respawnearlos
            if (!window._deadMobLog) window._deadMobLog = [];
            // Limpiar killedEntities al amanecer para permitir respawn
            // (solo los mobs del mundo, no los de generación de sector)
            window.killedEntities = window.killedEntities.filter(id =>
                id.startsWith('e_') || id.startsWith('w_') || id.startsWith('sl_')
            );
            // Respawnear mobs eliminados con nivel escalado
            const _dayLvlBonus = _newDay - 1;
            const _respawnList = (window._deadMobLog || []).splice(0);
            for (const mob of _respawnList) {
                // Saltar lobos en día 1
                if (mob.type === 'wolf' && _newDay <= 1) continue;
                const _rId = mob.type + '_r_' + Math.random().toString(36).substr(2,6);
                const _rX  = mob.x + (Math.random() - 0.5) * 200;
                const _rGY = window.getGroundY ? window.getGroundY(_rX) : window.game.groundLevel;
                const _rLvl = Math.max(1, (mob.level || 1) + _dayLvlBonus);
                let _rEnt = null;
                if (mob.type === 'zombie') {
                    const hp = 35+_rLvl*15;
                    _rEnt = {id:_rId,type:'zombie',name:'Mutante',level:_rLvl,x:_rX,y:_rGY-99,width:54,height:99,vx:0.4,vy:0,hp,maxHp:hp,damage:8+_rLvl*3,isHit:false,attackCooldown:0,stuckFrames:0,ignorePlayer:0,lastX:_rX};
                } else if (mob.type === 'archer') {
                    const hp = 20+_rLvl*12;
                    _rEnt = {id:_rId,type:'archer',name:'Cazador',level:_rLvl,x:_rX,y:_rGY-90,width:45,height:90,vx:0.8,vy:0,hp,maxHp:hp,damage:5+_rLvl*2,isHit:false,attackCooldown:0,stuckFrames:0,ignorePlayer:0,lastX:_rX};
                } else if (mob.type === 'spider') {
                    const hp=15+_rLvl*10, sw=32+_rLvl*2, sh=18+_rLvl;
                    _rEnt = {id:_rId,type:'spider',name:'Araña',level:_rLvl,x:_rX,y:_rGY-sh,width:sw,height:sh,vx:0.7,vy:0,hp,maxHp:hp,damage:5+_rLvl*2,isHit:false,attackCooldown:0,stuckFrames:0,ignorePlayer:0,lastX:_rX};
                } else if (mob.type === 'wolf' && _newDay > 1) {
                    const hp = 40+_rLvl*10;
                    _rEnt = {id:_rId,type:'wolf',name:'Lobo',level:_rLvl,x:_rX,y:_rGY-50,width:63,height:50,vx:0.5,vy:0,hp,maxHp:hp,damage:7+_rLvl*2,isHit:false,attackCooldown:0,stuckFrames:0,ignorePlayer:0,lastX:_rX,packId:'rp_'+_newDay,wolfState:'patrol',wolfStateTimer:0,wolfLeader:true};
                } else if (mob.type === 'slime') {
                    const sHp = 30+_rLvl*8;
                    _rEnt = {id:_rId,type:'slime',name:'Slime',level:_rLvl,x:_rX,y:_rGY-54,width:54,height:54,vx:0,vy:0,hp:sHp,maxHp:sHp,damage:4+_rLvl*2,isHit:false,attackCooldown:0,slimeSize:2,slimeJumpTimer:40,slimeBounce:0,lastX:_rX};
                } else if (mob.type === 'chicken') {
                    _rEnt = {id:_rId,type:'chicken',name:'Pollo',level:1,x:_rX,y:_rGY-28,width:28,height:28,vx:0.3,vy:0,hp:25,maxHp:25,isHit:false,attackCooldown:0,stuckFrames:0,fleeTimer:0,fleeDir:1,lastX:_rX};
                }
                if (_rEnt && !window.killedEntities.includes(_rId)) {
                    window.entities.push(_rEnt);
                    if (window.sendWorldUpdate) window.sendWorldUpdate('spawn_entity', {entity:_rEnt});
                }
            }
            window._deadMobLog = [];
        }

        // Lluvia
        const nSeed = ((Math.sin(window.game.days * 8765.4) + 1) / 2);
        window.game.isRaining = false;
        if (nSeed > 0.65) { const rainStart = 9 + nSeed*4, rainEnd = rainStart + 1 + nSeed*1.5; window.game.isRaining = isDay && hourFloat >= rainStart && hourFloat <= rainEnd; }

        if (!isFinite(window.player.vx)) window.player.vx = 0;
        if (!isFinite(window.player.vy)) window.player.vy = 0;

        // Orientación automática
        if (!window.player.isAiming && window.player.attackFrame <= 0 && !window.player.isDead) {
            if (window.player.vx > 0.1) window.player.facingRight = true;
            else if (window.player.vx < -0.1) window.player.facingRight = false;
        }

        if (window.player.isDead) {
            window.player.vx = 0; window.player.isStealth = false; window.player.isClimbing = false; window.player._wallDir = 0;
            let pO = window.getEl('placement-overlay'); if (pO) pO.style.display = 'none';
            if ((window.player.deathAnimFrame || 0) > 0) window.player.deathAnimFrame--;
        }
        if ((window.player.pvpHitFlash || 0) > 0) window.player.pvpHitFlash--;
        window.player.inBackground = false; window.player.wantsBackground = false;

        // Movimiento horizontal con aceleración suave
        if (!window.player.isDead) {
            let pO = window.getEl('placement-overlay'); if (pO) pO.style.display = window.player.placementMode ? 'block' : 'none';
            const isPressingMove = window.keys?.a || window.keys?.d;

            // ── Anti-jitter de pared: si el frame anterior detectó colisión X y el
            // jugador sigue presionando en esa misma dirección, cancelar aceleración
            // antes de aplicarla para que vx no acumule los ~0.04-0.12px que causan
            // la micro-oscilación y la "vibración" visual contra bloques de superficie.
            const _wallDir = window.player._wallDir || 0;  // 1=derecha, -1=izquierda, 0=libre
            const _pressingIntoWall = (_wallDir === 1 && window.keys?.d) || (_wallDir === -1 && window.keys?.a);
            // Si el jugador quiere saltar MIENTRAS está contra una pared de 1 bloque,
            // NO suprimimos vx — así puede saltar hacia adelante en lugar de subir en vertical.
            const _wantsJump = !!(window.keys?.jumpPressed && window.player.jumpKeyReleased &&
                                  window.player.coyoteTime > 0 && !window.player.isJumping && !window.player.isDead);
            if (_pressingIntoWall && !_wantsJump) {
                // Mantener vx en 0, no ramp, no animar
                window.player.vx = 0;
                window.player._accelRamp = 0;
                window.player.animTime   = 0;
            } else {
                window.player._accelRamp = isPressingMove ? Math.min(1.0, (window.player._accelRamp||0) + 0.09) : Math.max(0.0, (window.player._accelRamp||0) - 0.18);
                const accel = (window.player.isGrounded ? 0.6 : 0.4) * window.player._accelRamp, fric = window.player.isGrounded ? 0.78 : 0.95;
                if (window.keys?.a) window.player.vx -= accel;
                if (window.keys?.d) window.player.vx += accel;
                window.player.vx *= fric;
            }

            // Ralentizar en rampas
            let stairSpeedMult = 1.0;
            const pMidX = window.player.x + window.player.width/2, pFoot = window.player.y + window.player.height;
            for (const b of window.blocks) {
                if (b.type !== 'stair') continue;
                const relX = pMidX - b.x; if (relX < 0 || relX > bs) continue;
                if (pFoot < b.y - 2 || pFoot > b.y + bs + 4) continue;
                const frac = b.facingRight ? relX/bs : 1 - relX/bs, rampY = b.y + bs - frac*bs;
                if (Math.abs(pFoot - rampY) < 10) stairSpeedMult = ((b.facingRight && window.player.vx > 0) || (!b.facingRight && window.player.vx < 0)) ? 0.55 : 0.8;
                break;
            }
            window.player.vx = Math.max(-window.player.speed * stairSpeedMult, Math.min(window.player.speed * stairSpeedMult, window.player.vx));
        }

        window.player.isStealth = false;

        // HUD
        const timeText = `${String(clockH).padStart(2,'0')}:${String(clockM).padStart(2,'0')}`;
        const cDisp = window.getEl('clock-display'); if (cDisp) { cDisp.innerText = `Día ${window.game.days} - ${timeText}`; cDisp.classList.toggle('stealth-mode', false); }
        const dTxt = window.getEl('dist-text'); if (dTxt) dTxt.innerText = `${Math.max(0, Math.floor((window.player.x - window.game.shoreX) / 10))}m`;

        // Sprint / velocidad
        const _isSprinting = !!(window.keys?.shift) && window.player.hunger > 0 && !window.player.isClimbing;
        const _baseAgi = window.player.stats?.agi || 0;
        const _walkSpd = (window.player.walkSpeed||1.1) + _baseAgi*0.12, _runSpd = (window.player.runSpeed||2.8) + _baseAgi*0.6;
        const _staminaDrain = Math.max(0.0005, 0.002 - _baseAgi*0.0002);
        window.player.speed = _isSprinting ? _runSpd : _walkSpd; window.player.isSprinting = _isSprinting;

        // Física X
        // NOTA: animTime se actualiza DESPUÉS de la colisión X (ver bloque abajo)
        // para que la animación refleje el movimiento REAL, no la intención de tecla.
        window.player.x += window.player.vx;
        if (window.player.x < window.game.shoreX) { window.player.x = window.game.shoreX; if (window.player.vx < 0) window.player.vx = 0; }
        const _hitWallX = window.checkBlockCollisions('x');
        // Guardar dirección de la pared para cancelar accel el frame siguiente.
        // Si no hay colisión, limpiar la dirección para que el jugador pueda volver a moverse.
        if (_hitWallX) {
            // Colisión física real con pared este frame (el player tenía vx != 0).
            window.player._wallDir   = window.player.vx > 0 ? 1 : (window.player.vx < 0 ? -1 : 0);
            // Si vx ya fue puesto a 0 por la colisión, usar la tecla como proxy.
            if (window.player._wallDir === 0) window.player._wallDir = window.keys?.d ? 1 : (window.keys?.a ? -1 : 0);
            window.player._accelRamp = 0;
            window.player.animTime   = 0;
        } else if (window.player._wallDir !== 0 &&
                   ((window.player._wallDir === 1 && window.keys?.d) ||
                    (window.player._wallDir === -1 && window.keys?.a))) {
            // vx fue suprimido a 0 por _pressingIntoWall el frame anterior → hitWallX=false.
            // Esto causa la oscilación: vx=0 → sin colisión → _wallDir=0 → vx crece → colisión → etc.
            // Solución: probar si la pared sigue ahí antes de limpiar _wallDir.
            const _probeDir = window.player._wallDir;
            const _pbs      = window.game.blockSize;
            // Punto de prueba: 2px fuera del borde del jugador en la dirección bloqueada
            const _probeX   = _probeDir > 0
                ? window.player.x + window.player.width + 2
                : window.player.x - 2;
            const _probeCol = Math.floor(_probeX / _pbs);
            const _probeCD  = window.getTerrainCol ? window.getTerrainCol(_probeCol) : null;
            // Pared de terreno (acantilado de superficie)
            const _terrainWall = _probeCD && _probeCD.type !== 'hole' &&
                _probeCD.topY < (window.player.y + window.player.height) - _pbs * 0.85;
            // Pared de celda UG (cueva)
            const _ugWall = !_terrainWall && !!window.getUGCellV && (() => {
                if (!_probeCD || _probeCD.type === 'hole') return false;
                const _topY = _probeCD.topY;
                const _foot = window.player.y + window.player.height;
                const _rTop = Math.max(0, Math.floor((window.player.y - _topY) / _pbs));
                const _rBot = Math.max(0, Math.floor((_foot - 2 - _topY) / _pbs));
                for (let _r = _rTop; _r <= _rBot; _r++) {
                    if (window.getUGCellV(_probeCol, _r) !== 'air') return true;
                }
                return false;
            })();
            // Pared de bloque colocado por el jugador
            const _blockWall = !_terrainWall && !_ugWall && !!window.blocks && window.blocks.some(_wb => {
                if (_wb.type === 'ladder' || (_wb.type === 'door' && _wb.open)) return false;
                const _wbh = _wb.type === 'door' ? _pbs * 2 : _pbs;
                return Math.abs(_wb.x - _probeCol * _pbs) < _pbs &&
                    _wb.y < window.player.y + window.player.height &&
                    _wb.y + _wbh > window.player.y;
            });
            if (!_terrainWall && !_ugWall && !_blockWall) {
                window.player._wallDir = 0;  // pared desapareció → liberar movimiento
            }
            // Si la pared sigue ahí: mantener _wallDir y el bloqueo de vx ya está activo
        } else {
            window.player._wallDir = 0;  // tecla soltada → libre
        }

        // ── animTime: recalcular con el vx REAL post-colisión ──────────────────
        // Si _hitWallX=true, vx ya fue puesto a 0 por la colisión → animTime=0 (Idle).
        // Esto garantiza que la animación de caminar se detenga al tocar una pared,
        // incluso si el jugador mantiene la tecla presionada.
        if (window.player.isGrounded) {
            if (Math.abs(window.player.vx) > 0.3) {
                window.player.animTime += Math.abs(window.player.vx) * 0.025 * (_isSprinting ? 2.1 : 2.2);
            } else {
                window.player.animTime = 0;   // Idle: personaje quieto o bloqueado por pared
            }
        }

        // Escalera: auto-enganche con W
        const _onLadder = !window.player.isDead && window.isOnLadder();
        if (!window.player.isClimbing && !window.player.isDead && window.keys?.w) {
            const pCX_l = window.player.x + window.player.width/2;
            const autoLadder = window.blocks.find(b => b.type==='ladder' && Math.abs(pCX_l-(b.x+bs/2)) < bs*0.7 && window.player.y+window.player.height >= b.y-4 && window.player.y+window.player.height <= b.y+bs+8);
            if (autoLadder && window.player.isGrounded) { window.player._climbLadderX = autoLadder.x; window.player.x = autoLadder.x+bs/2-window.player.width/2; window.player.isClimbing = true; window.player.vy = 0; window.player.vx = 0; }
        }

        if (window.player.isClimbing) {
            const pCX2 = window.player.x + window.player.width/2;
            const ladderCol = window.blocks.filter(b => b.type==='ladder' && Math.abs(pCX2-(b.x+bs/2)) < bs*1.2);
            if (ladderCol.length === 0 || (!_onLadder && !window.player._climbGrace)) { window.player.isClimbing = false; window.player._climbGrace = 0; window.player.vy += window.game.gravity; }
            else {
                if (!_onLadder) { window.player._climbGrace = (window.player._climbGrace||0) + 1; if (window.player._climbGrace > 6) { window.player.isClimbing = false; window.player._climbGrace = 0; window.player.vy += window.game.gravity; } }
                else window.player._climbGrace = 0;
                if (window.player.isClimbing) {
                    if (window.player._climbLadderX !== undefined) window.player.x = window.player._climbLadderX + bs/2 - window.player.width/2;
                    window.player.vx = 0;
                    if (window.keys?.w) {
                        const topY = Math.min(...ladderCol.map(b => b.y));
                        if (window.player.y <= topY + 4) { window.player.isClimbing = false; window.player._climbGrace = 0; window.player.vy = -4.2; window.player.isJumping = true; if (window.playSound) window.playSound('jump'); }
                        else window.player.vy = -2.2;
                    } else if (window.keys?.s) { window.player.vy = 2.2; if (window.player.isGrounded) { window.player.isClimbing = false; window.player._climbGrace = 0; } }
                    else window.player.vy = 0;
                    window.player.isGrounded = false; window.player.isJumping = false; window.player.coyoteTime = 10;
                }
            }
        } else window.player.vy += window.game.gravity;

        const _isClimbing = window.player.isClimbing;

        // Física Y
        window.player.isGrounded = false;
        window.player.y += window.player.vy;
        window.checkBlockCollisions('y');
        window.applyStairPhysicsPlayer();

        // ── Snap de superficie ──────────────────────────────────────────────
        // REGLA: snap solo actúa cuando el terreno real (_pGroundY) coincide con
        // la superficie original (_surfTopYG). Si hay celdas minadas debajo de la
        // superficie, _pGroundY > _surfTopYG → snap se desactiva y UG toma control.
        // Esto elimina el solapamiento entre los dos sistemas.
        const _pMidColG  = Math.floor((window.player.x + window.player.width/2) / window.game.blockSize);
        const _pColDataG = window.getTerrainCol ? window.getTerrainCol(_pMidColG) : null;
        const _surfTopYG = (_pColDataG && _pColDataG.type !== 'hole')
                           ? _pColDataG.topY : (window.game.baseGroundLevel || 510);
        const _pGroundY  = window.getGroundY
                           ? window.getGroundY(window.player.x + window.player.width/2)
                           : window.game.groundLevel;
        const _pIsOverHole = _pGroundY > (window.game.baseGroundLevel || 510) + 500;
        const footY = window.player.y + window.player.height;

        // Solo snap si el suelo real ES la superficie original (no hay mining debajo)
        // Tolerancia de 4px para errores de float entre topY del jugador y getGroundY
        // GUARD DE PROFUNDIDAD: no snap si los pies están más de 1 bloque bajo la superficie.
        // Sin este guard, el snap disparaba cuando el jugador underground empujaba su columna
        // central a una no-minada (footY >> topY pero _groundIsOriginalSurface = true → teleport).
        const _snapDepthOK = footY < _surfTopYG + window.game.blockSize * 1.1;
        const _groundIsOriginalSurface = Math.abs(_pGroundY - _surfTopYG) < 4;
        if (_groundIsOriginalSurface && _snapDepthOK && !_pIsOverHole && footY > _pGroundY && window.player.vy >= 0) {
            window.player.y = _pGroundY - window.player.height;
            window.player.vy = 0; window.player.isGrounded = true;
            if (_isClimbing) window.player.isClimbing = false;
        } else if (_groundIsOriginalSurface && _snapDepthOK && !_pIsOverHole && !window.player.isGrounded
                   && window.player.coyoteTime > 0 && window.player.vy >= 0
                   && footY >= _pGroundY - 18) {
            window.player.y = _pGroundY - window.player.height;
            window.player.vy = 0; window.player.isGrounded = true;
            if (_isClimbing) window.player.isClimbing = false;
        }

        // ── Muerte por caída en pozo ─────────────────────────────────────────
        if (!window.player.isDead && window.getTerrainCol) {
            const _pHoleCol = Math.floor((window.player.x + window.player.width / 2) / window.game.blockSize);
            const _pHoleData = window.getTerrainCol(_pHoleCol);
            if (_pHoleData && _pHoleData.type === 'hole' && window.player.y > (window.game.baseGroundLevel || 400) + 200) {
                window.damagePlayer(window.player.hp + 1, 'caída en un pozo');
            }
        }

        if (window.player.isGrounded || _isClimbing) { window.player.coyoteTime = 10; window.player.isJumping = false; } else window.player.coyoteTime--;

        // Drenaje de stamina al correr
        if (window.player.isSprinting && Math.abs(window.player.vx) > 0.3 && !window.player.isDead) {
            window.player.hunger = Math.max(0, window.player.hunger - _staminaDrain);
            if (window.player.hunger <= 0) { window.player.isSprinting = false; window.player.speed = _walkSpd; }
            if (window.game.frameCount % 30 === 0 && window.updateUI) window.updateUI();
        }
        if (window.player.isGrounded && window.player.isSprinting && Math.abs(window.player.vx) > 1.5 && !window.player.isDead && !_isClimbing && window.game.frameCount % 5 === 0)
            window.spawnDustPuff(window.player.x + window.player.width/2 + (window.player.facingRight ? -8 : 8), window.player.y + window.player.height, window.player.facingRight);

        // Salto
        if (window.keys?.jumpPressed && window.player.jumpKeyReleased && window.player.coyoteTime > 0 && !window.player.isJumping && !window.player.isDead && !_isClimbing) {
            const jumpPower = Math.abs(window.player.jumpPower), headroom = Math.ceil((jumpPower*jumpPower) / (2*0.5));
            window.player.vy = (window.hasCeilingAbove && window.hasCeilingAbove(headroom)) ? Math.max(window.player.jumpPower, -3) : window.player.jumpPower;
            window.player.isJumping = true; window.player.coyoteTime = 0; window.player.jumpKeyReleased = false;
            window.player._wallDir = 0;  // al saltar, liberar bloqueo de pared
        }
        if (window.keys && !window.keys.jumpPressed && window.player.vy < 0 && !_isClimbing) window.player.vy *= 0.5;

        if (window.keys?.mouseLeft && !window.player.isDead) window.attemptAction();

        // Sync multijugador — emisión con dirty-check para reducir tráfico
        if (window.game.isMultiplayer) {
            if (window.socket) {
                // Estado que cambia rápido (posición/velocidad): cada 2 frames
                const _frame2 = window.game.frameCount % 2 === 0;
                // Estado que cambia lento (herramienta, animación especial): solo cuando varía
                const _toolChg  = window.player.activeTool  !== window.player._lastTool;
                const _deadChg  = window.player.isDead       !== window.player._lastDead;
                const _aimChg   = window.player.isAiming     !== window.player._lastAim;
                const _typChg   = (window.player.isTyping||false) !== (window.player._lastTypingState||false);
                const _atkChg   = window.player.attackFrame  > 0;
                const _danceChg = window.player.isDancing    !== window.player._lastDancing;
                if (_frame2 || _toolChg || _deadChg || _aimChg || _typChg || _atkChg || _danceChg) {
                    // Payload dividido: frecuente vs infrecuente para ahorrar bytes
                    const _pm = {
                        x: window.player.x, y: window.player.y,
                        vx: window.player.vx, vy: window.player.vy,
                        facingRight: window.player.facingRight,
                        isGrounded: window.player.isGrounded,
                        animTime: window.player.animTime,
                        isDead: window.player.isDead,
                        isClimbing: window.player.isClimbing || false,
                        deathAnimFrame: window.player.deathAnimFrame || 0,
                        isSprinting: window.player.isSprinting || false,
                        isTyping: window.player.isTyping || false,
                    };
                    // Solo añadir campos infrecuentes cuando cambian
                    if (_toolChg || _aimChg || _atkChg) {
                        _pm.activeTool   = window.player.activeTool;
                        _pm.attackFrame  = window.player.attackFrame;
                        _pm.isAiming     = window.player.isAiming;
                        _pm.isCharging   = window.player.isCharging;
                        _pm.chargeLevel  = window.player.chargeLevel;
                    }
                    // mouseX/mouseY: siempre en cada paquete frecuente cuando se está apuntando,
                    // o cada 4 frames si no (para que los remotos sepan la orientación general).
                    // Esto resuelve que el arco/molotov de otros jugadores apuntara siempre
                    // al mismo sitio (solo se enviaba al cambiar isAiming).
                    if (window.player.isAiming || _toolChg || _atkChg || window.game.frameCount % 4 === 0) {
                        _pm.mouseX = window.mouseWorldX;
                        _pm.mouseY = window.mouseWorldY;
                    }
                    if (_typChg || _danceChg) {
                        _pm.isDancing    = window.player.isDancing || false;
                        _pm.danceStart   = window.player.danceStart || 0;
                        _pm.level        = window.player.level;
                    }
                    window.socket.emit('playerMovement', _pm);
                    window.player._lastTool     = window.player.activeTool;
                    window.player._lastDead     = window.player.isDead;
                    window.player._lastAim      = window.player.isAiming;
                    window.player._lastTypingState = window.player.isTyping || false;
                    window.player._lastDancing  = window.player.isDancing;
                }
            }
            if (window.otherPlayers) {
                for (const op of Object.values(window.otherPlayers)) {
                    if (op.targetX !== undefined) { op.x += (op.targetX - op.x) * 0.35; op.y += (op.targetY - op.y) * 0.35; }
                    if ((op.pvpHitFlash||0) > 0) op.pvpHitFlash--;
                    if (op.isDead && (op.deathAnimFrame||0) > 0) op.deathAnimFrame--;
                }
            }
        }

        // Tumbas expiradas (5 min)
        window.blocks = window.blocks.filter(b => { if (b.type==='grave' && Date.now()-b.createdAt > 300000) { window.spawnParticles(b.x+15,b.y+15,'#7f8c8d',15); window.sendWorldUpdate('destroy_grave',{id:b.id}); return false; } return true; });

        // Bloques activos
        window.blocks.forEach(b => {
            // Fogata
            if (b.type === 'campfire' && b.isBurning) {
                b.burnTime--;
                if (window.game.frameCount % 5 === 0) window.spawnParticles(b.x+15, b.y+10, '#e67e22', 1, 0.5);
                if (b.meat > 0) { b.cookTimer++; if (b.cookTimer > 300) { b.meat--; b.cooked++; b.cookTimer = 0; if (window.currentCampfire===b && window.renderCampfireUI) window.renderCampfireUI(); } }
                if (window.game.isRaining) {
                    const hasRoof = window.blocks.some(r => (r.type==='block'||r.type==='door') && r.x===b.x && r.y<b.y);
                    if (!hasRoof) { b.rainExtinguishTimer = (b.rainExtinguishTimer||0)+1; if (b.rainExtinguishTimer > 150) { b.isBurning = false; b.rainExtinguishTimer = 0; window.spawnParticles(b.x+15,b.y+15,'#aaaaaa',10,0.5); if (window.currentCampfire===b&&window.renderCampfireUI) window.renderCampfireUI(); window.sendWorldUpdate('update_campfire',{x:b.x,y:b.y,wood:b.wood,meat:b.meat,cooked:b.cooked,isBurning:false}); } }
                    else b.rainExtinguishTimer = 0;
                } else b.rainExtinguishTimer = 0;
                if (b.burnTime <= 0) { if (b.wood > 0) { b.wood--; b.burnTime = 1800; } else b.isBurning = false; if (window.currentCampfire===b&&window.renderCampfireUI) window.renderCampfireUI(); }
            }

            // Barricada: daña entidades al contacto
            if (b.type === 'barricade') {
                window.entities.forEach(ent => {
                    if (window.checkRectIntersection(ent.x,ent.y,ent.width,ent.height,b.x,b.y,bs,bs) && window.game.frameCount % 30 === 0) {
                        ent.hp -= 5; b.hp -= 10; window.setHit(ent); window.setHit(b); window.spawnParticles(ent.x+ent.width/2,ent.y+ent.height/2,'#ff4444',5); window.spawnParticles(b.x+15,b.y+15,'#bdc3c7',3);
                        if (b.hp <= 0) window.destroyBlockLocally(b); else window.sendWorldUpdate('hit_block',{x:b.x,y:b.y,dmg:10});
                    }
                });
            }

            // Torreta: disparo automático a enemigos cercanos
            if (b.type === 'turret') {
                if (b.fireCooldown > 0) { b.fireCooldown--; }
                if (b.arrows > 0 && b.fireCooldown <= 0) {
                    const TURRET_RANGE = 420, TURRET_DAMAGE = 12;
                    const tCX = b.x + bs/2, tCY = b.y + 8;
                    const hostBlock = window.blocks.find(sb => sb!==b && sb.type!=='turret' && Math.abs(sb.x-b.x)<2 && Math.abs(sb.y-b.y)<2);
                    const hasLOS = (x1,y1,x2,y2) => {
                        const steps = Math.ceil(Math.hypot(x2-x1,y2-y1)/8);
                        for (let s = 1; s < steps; s++) {
                            const rx = x1+(x2-x1)*s/steps, ry = y1+(y2-y1)*s/steps;
                            for (const bl of window.blocks) {
                                if (bl===b||bl===hostBlock) continue;
                                if (['turret','box','campfire','barricade','ladder','grave','bed','stair'].includes(bl.type)) continue;
                                const bh = bl.type==='door' ? bs*2 : bs;
                                if (rx>=bl.x && rx<=bl.x+bs && ry>=bl.y && ry<=bl.y+bh) return false;
                            }
                        }
                        return true;
                    };
                    const candidates = window.entities.filter(ent => ent.type!=='chicken' && ent.hp>0 && Math.hypot(ent.x+ent.width/2-tCX, ent.y+ent.height/2-tCY) <= TURRET_RANGE).sort((a,b2) => Math.hypot(a.x+a.width/2-tCX,a.y+a.height/2-tCY) - Math.hypot(b2.x+b2.width/2-tCX,b2.y+b2.height/2-tCY));
                    let bestTarget = null; for (const ent of candidates) { if (hasLOS(tCX, tCY, ent.x+ent.width/2, ent.y+ent.height/2)) { bestTarget = ent; break; } }
                    if (bestTarget) {
                        const eCX = bestTarget.x+bestTarget.width/2, eCY = bestTarget.y+bestTarget.height/2;
                        const predX = eCX+(bestTarget.vx||0)*12, predY = eCY+(bestTarget.vy||0)*6;
                        const dx = predX-tCX, dy = predY-tCY, dist = Math.max(0.1, Math.hypot(dx,dy)), aSpd = 11, tFlight = dist/aSpd;
                        const angle = Math.atan2(dy/tFlight - window.game.gravity*0.4*tFlight*0.5, dx/tFlight);
                        b.aimAngle = Math.atan2(predY-tCY, predX-tCX);
                        const arrow = { x:tCX, y:tCY, vx:Math.cos(angle)*aSpd, vy:Math.sin(angle)*aSpd, life:Math.ceil(dist/aSpd)+20, damage:TURRET_DAMAGE, isEnemy:false, fromTurret:true, sourceTurret:{x:b.x,y:b.y}, hostBlockX:hostBlock?hostBlock.x:b.x, hostBlockY:hostBlock?hostBlock.y:b.y, owner:'turret_'+b.x+'_'+b.y };
                        window.projectiles.push(arrow); window.sendWorldUpdate('spawn_projectile', arrow); if (window.playSound) window.playSound('arrow_shoot'); b.arrows--; b.fireCooldown = 180; window.sendWorldUpdate('update_turret',{x:b.x,y:b.y,arrows:b.arrows}); if (window.currentTurret===b&&window.renderTurretUI) window.renderTurretUI();
                    }
                }
            }
        });

        // Flechas clavadas
        for (let i = window.stuckArrows.length - 1; i >= 0; i--) {
            const sa = window.stuckArrows[i]; sa.life--;
            if (sa.blockX !== undefined && !window.blocks.some(b => b.x===sa.blockX && b.y===sa.blockY)) sa.life = 0;
            if (sa.life <= 0) window.stuckArrows.splice(i, 1);
        }

        // Prompts de interacción
        pCX = window.player.x + window.player.width/2; pCY = window.player.y + window.player.height/2;
        let interactables = window.blocks.filter(b => ['box','campfire','door','grave','turret'].includes(b.type) && window.checkRectIntersection(window.player.x-15,window.player.y-15,window.player.width+30,window.player.height+30,b.x,b.y,bs,b.type==='door'?bs*2:bs));
        if (interactables.length > 1) interactables.sort((a,b) => { const aCX=a.x+bs/2,bCX=b.x+bs/2,aF=window.player.facingRight?(aCX>=pCX):(aCX<=pCX),bF=window.player.facingRight?(bCX>=pCX):(bCX<=pCX); if(aF&&!bF)return -1;if(!aF&&bF)return 1;return Math.abs(aCX-pCX)-Math.abs(bCX-pCX); });

        const promptEl = window.getEl('interaction-prompt'), textEl = window.getEl('prompt-text');
        window.player.nearbyItem = null; let anyItemHovered = false;

        // ── Merge de items en suelo ────────────────────────────────────────
        // Recorrer de atrás hacia adelante; cuando dos items del mismo tipo están
        // cerca y en reposo (|vx|+|vy| < 0.5), fusionar el menor en el mayor.
        for (let i = window.droppedItems.length - 1; i >= 1; i--) {
            const ia = window.droppedItems[i];
            if (!ia) continue;
            const _defA = window.itemDefs[ia.type];
            if (!_defA) continue;
            const maxStack = _defA.maxStack || 500;
            if (ia.amount >= maxStack) continue;  // ya lleno
            const iMoving = Math.abs(ia.vx||0) + Math.abs(ia.vy||0) > 0.5;
            for (let j = i - 1; j >= 0; j--) {
                const ib = window.droppedItems[j];
                if (!ib || ib.type !== ia.type) continue;
                const dist = Math.hypot(ia.x - ib.x, ia.y - ib.y);
                if (dist > 40) continue;
                const jMoving = Math.abs(ib.vx||0) + Math.abs(ib.vy||0) > 0.5;
                if (iMoving && jMoving) continue;  // ambos en vuelo, esperar
                // Fusionar ib dentro de ia
                const canAbsorb = Math.min(ib.amount, maxStack - ia.amount);
                if (canAbsorb <= 0) continue;
                ia.amount += canAbsorb;
                ib.amount -= canAbsorb;
                if (ib.amount <= 0) {
                    window.droppedItems.splice(j, 1);
                    i--;  // el índice i se desplazó
                    if (window.sendWorldUpdate) window.sendWorldUpdate('pickup_item', { id: ib.id });
                }
                break;
            }
        }

        // Items en suelo
        for (let i = window.droppedItems.length - 1; i >= 0; i--) {
            const item = window.droppedItems[i];
            const _iDef = window.itemDefs[item.type];
            if (!_iDef) continue;  // item type desconocido, ignorar silenciosamente
            const s = _iDef.size, d = Math.hypot(pCX-item.x, pCY-item.y);
            if (window.keys?.y && d < 250 && !window.player.isDead) {
                item.x += (pCX - item.x) * 0.15; item.y += (pCY - item.y) * 0.15; item.vy = 0;
                if (d < 25) {
                    if (window.canAddItem(item.type, item.amount)) { window.player.inventory[item.type] = (window.player.inventory[item.type]||0) + item.amount; window.droppedItems.splice(i,1); window.sendWorldUpdate('pickup_item',{id:item.id}); if(window.playSound) window.playSound('pickup');
                        // Auto-equip items que se pueden usar desde toolbar
                        if (window.toolDefs && window.toolDefs[item.type] && typeof window.autoEquip==='function') window.autoEquip(item.type);
                        const _tbEquip = ['dirt','coal','sulfur','diamond','torch_item'];
                        if (_tbEquip.includes(item.type) && !window.player.toolbar.includes(item.type)) {
                            const _fi = window.player.toolbar.indexOf(null);
                            if (_fi !== -1) { window.player.toolbar[_fi] = item.type; if (window.renderToolbar) window.renderToolbar(); }
                        }
                        window.spawnParticles(pCX,pCY,window.itemDefs[item.type].color,5); if(window.updateUI) window.updateUI(); continue; }
                    else if (window.game.frameCount % 60 === 0) window.spawnDamageText(pCX, pCY-30, 'Inv. Lleno', '#fff');
                }
            } else {
                item.vy += window.game.gravity * 0.5; item.x += item.vx; item.y += item.vy; item.vx *= 0.95;
                const _iGY = window.getGroundY ? window.getGroundY(item.x) : window.game.groundLevel;
                if (item.y+s >= _iGY) { item.y = _iGY-s; item.vy *= -0.5; item.vx *= 0.8; }
                for (const b of window.blocks) {
                    if ((b.type==='door'&&b.open)||b.type==='box'||b.type==='campfire'||b.type==='bed'||b.type==='barricade'||b.type==='placed_torch') continue;
                    const bh = b.type==='door'?bs*2:bs;
                    if (window.checkRectIntersection(item.x,item.y,s,s,b.x,b.y,bs,bh)&&item.vy>0&&item.y+s-item.vy<=b.y) { item.y = b.y-s; item.vy *= -0.5; item.vx *= 0.8; }
                }
                if (d < 60 && !window.player.isDead) { anyItemHovered = true; window.player.nearbyItem = item; }
            }
            item.life += 0.05;
        }

        const hoveringArrow = window.stuckArrows.find(sa => Math.hypot(pCX-sa.x, pCY-sa.y) < 60);

        if (promptEl && textEl) {
            const pCX2 = window.player.x+window.player.width/2, pCY2 = window.player.y+window.player.height/2;
            const nearLadderPrompt = !window.player.isDead && !window.player.isClimbing && window.blocks.some(b => b.type==='ladder'&&Math.abs(pCX2-(b.x+bs/2))<bs*0.9&&pCY2>b.y-bs*0.5&&pCY2<b.y+bs*1.5);
            const isTorchEquipped = !window.player.isDead && (window.player.activeTool === 'torch' || window.player.activeTool === 'torch_item');
            if (nearLadderPrompt) { promptEl.style.display='block'; textEl.innerHTML=`Presiona <span class="key-btn">E</span> para usar la <span style="color:#C19A6B;">escalera</span>`; }
            else if (window.player.isClimbing) { promptEl.style.display='block'; textEl.innerHTML=`<span class="key-btn">W</span> subir &nbsp; <span class="key-btn">S</span> bajar &nbsp; <span class="key-btn">E</span> soltar`; }
            else if (isTorchEquipped) {
                promptEl.style.display='block';
                if (window.player.torchLit) {
                    textEl.innerHTML=`🔥 Encendida &nbsp;|&nbsp; <span class="key-btn">F</span> apagar &nbsp;|&nbsp; <span class="key-btn">Click derecho 🖱️</span> clavar`;
                } else {
                    textEl.innerHTML=`<span class="key-btn">F</span> encender &nbsp;|&nbsp; <span class="key-btn">Click derecho 🖱️</span> clavar`;
                }
            } else if (interactables.length > 0 && !document.querySelector('.window-menu.open') && !window.player.isDead) {
                const h = interactables[0];
                if (h.type !== 'bed') { promptEl.style.display='block'; textEl.innerHTML=`Presiona <span class="key-btn">E</span> para usar <span style="color:#D2B48C;">${{box:'Caja',campfire:'Fogata',grave:'Tumba',door:'Puerta'}[h.type]||h.type}</span>`; }
                else promptEl.style.display = 'none';
            } else if (hoveringArrow && !window.player.isDead) { promptEl.style.display='block'; textEl.innerHTML=`Presiona <span class="key-btn">E</span> para agarrar <strong style="color:#ccc;">Flecha</strong>`; }
            else if (anyItemHovered && window.player.nearbyItem && !window.player.isDead) {
                const itd = window.itemDefs[window.player.nearbyItem.type];
                if (itd) { const amtTxt = window.player.nearbyItem.amount>1?` x${window.player.nearbyItem.amount}`:''; promptEl.style.display='block'; textEl.innerHTML=`Mantén <span class="key-btn">Y</span> para recoger <strong style="color:${itd.color};">${itd.name}${amtTxt}</strong>`; }
                else promptEl.style.display = 'none';
            } else promptEl.style.display = 'none';
        }

        // Proyectiles
        for (let i = window.projectiles.length - 1; i >= 0; i--) {
            const pr = window.projectiles[i];
            pr.x += pr.vx; pr.vy += window.game.gravity * (pr.isMolotov ? 0.9 : 0.25); pr.y += pr.vy;
            pr.angle = Math.atan2(pr.vy, pr.vx); pr.life--;
            const isMyArrow = pr.owner === window.socket?.id || !window.game.isMultiplayer;
            const _prGY = window.getGroundY ? window.getGroundY(pr.x) : window.game.groundLevel;

            if (pr.isMolotov) {
                let hitGround = pr.y >= _prGY, hitBlockM = null;
                if (!hitGround) for (const b of window.blocks) { const bh=b.type==='door'?bs*2:bs; if(!b.open&&window.checkRectIntersection(pr.x-4,pr.y-4,10,10,b.x,b.y,bs,bh)){hitBlockM=b;break;} }
                if (hitGround || hitBlockM || pr.life <= 0) {
                    const impY = hitGround ? _prGY : (hitBlockM ? hitBlockM.y : pr.y);
                    if (isMyArrow) {
                        // Jugador local: crear fuego y broadcast a todos
                        const fireParams = window.spawnMolotovFire(pr.x, impY, true);
                        if (fireParams && window.game.isMultiplayer)
                            window.sendWorldUpdate('spawn_fire', fireParams);
                    }
                    // Remotos: NO crear fuego aquí — lo reciben vía evento 'spawn_fire'
                    window.projectiles.splice(i, 1);
                }
                continue;
            }

            if (pr.y >= _prGY || pr.x < window.game.shoreX) {
                if (isMyArrow && !pr.isEnemy && Math.random() < 0.5) { const sa={id:Math.random().toString(36).substring(2,9),x:pr.x,y:_prGY,angle:pr.angle,life:18000}; window.stuckArrows.push(sa); window.sendWorldUpdate('spawn_stuck_arrow',sa); }
                else if (isMyArrow && !pr.isEnemy && window.playSound) window.playSound('arrow_break');
                window.spawnParticles(pr.x,pr.y,'#557A27',3); window.projectiles.splice(i,1); continue;
            }

            let hitBlock = null;
            for (const b of window.blocks) {
                const bh = b.type==='door'?bs*2:bs;
                if (pr.fromTurret && b.type==='turret') continue;
                if (pr.fromTurret && pr.hostBlockX!==undefined && Math.abs(b.x-pr.hostBlockX)<2 && Math.abs(b.y-pr.hostBlockY)<2) continue;
                if (!b.open && b.type!=='box' && b.type!=='campfire' && b.type!=='barricade' && b.type!=='turret' && b.type!=='placed_torch' && window.checkRectIntersection(pr.x,pr.y,4,4,b.x,b.y,bs,bh)) { hitBlock=b; break; }
            }
            if (hitBlock) {
                if (isMyArrow && !pr.isEnemy && Math.random() < 0.5) { const sa={id:Math.random().toString(36).substring(2,9),x:pr.x,y:pr.y,angle:pr.angle,blockX:hitBlock.x,blockY:hitBlock.y,life:18000}; window.stuckArrows.push(sa); window.sendWorldUpdate('spawn_stuck_arrow',sa); if(window.playSound) window.playSound('arrow_stick'); }
                else if (isMyArrow && !pr.isEnemy && window.playSound) window.playSound('arrow_break');
                window.spawnParticles(pr.x,pr.y,'#C19A6B',5); window.projectiles.splice(i,1); continue;
            }

            if (pr.isEnemy) {
                if (!window.player.inBackground && !window.player.isDead && window.checkRectIntersection(pr.x,pr.y,4,4,window.player.x,window.player.y,window.player.width,window.player.height)) { window.damagePlayer(pr.damage,'Flecha de Cazador'); window.spawnParticles(pr.x,pr.y,'#ff4444',5); window.projectiles.splice(i,1); continue; }
            } else {
                let hitEnt = false;
                for (let e = window.entities.length - 1; e >= 0; e--) {
                    const ent = window.entities[e]; if (!window.checkRectIntersection(pr.x,pr.y,4,4,ent.x,ent.y,ent.width,ent.height)) continue;
                    ent.hp -= pr.damage; window.setHit(ent); window.spawnDamageText(ent.x+ent.width/2+(Math.random()-0.5)*16,ent.y-Math.random()*8,'-'+Math.floor(pr.damage),'melee'); window.spawnParticles(pr.x,pr.y,'#ff4444',5);
                    ent.vx = (pr.vx>0?1:-1)*2.0; ent.vy = -3.0; ent.knockbackFrames = 8;
                    if (ent.hp <= 0) {
                        window.killedEntities.push(ent.id); window.sendWorldUpdate('kill_entity',{id:ent.id});
                        if (ent.type==='slime' && ent.slimeSize===2) {
                            window.spawnParticles(ent.x+ent.width/2,ent.y+ent.height/2,'#55dd55',20);
                            window.spawnDamageText(ent.x+ent.width/2,ent.y-10,'¡SPLIT!','#55dd55');
                            const _aW=Math.round(ent.width*0.55),_aH=Math.round(ent.height*0.55);
                            for(let _as=0;_as<2;_as++){
                                window.entities.push({id:'sl_mini_'+Date.now()+'_'+_as,type:'slime',name:'Slime',level:ent.level,
                                    x:ent.x+ent.width/2+(_as===0?-_aW*1.2:_aW*0.2),y:ent.y+ent.height-_aH,
                                    width:_aW,height:_aH,vx:(_as===0?-3.2:3.2),vy:-4.5,
                                    hp:Math.max(8,Math.floor(ent.maxHp*0.3)),maxHp:Math.max(8,Math.floor(ent.maxHp*0.3)),
                                    damage:Math.max(2,Math.floor(ent.damage*0.6)),isHit:false,attackCooldown:0,
                                    slimeSize:1,slimeJumpTimer:15+Math.floor(Math.random()*20),slimeBounce:18,lastX:ent.x});
                            }
                        } else { window.spawnParticles(ent.x,ent.y,'#ff4444',15); }
                        window.killEntityLoot(ent); window.entities.splice(e,1); if(window.updateUI) window.updateUI();
                    }
                    else { window.sendWorldUpdate('hit_entity',{id:ent.id,dmg:pr.damage}); if(ent.type==='chicken'){ent.fleeTimer=180;ent.fleeDir=ent.x>pr.x?1:-1;window.sendWorldUpdate('flee_entity',{id:ent.id,dir:ent.fleeDir});} }
                    if (window.playSound) window.playSound('arrow_hit_flesh'); hitEnt = true; break;
                }
                // PVP flechas
                if (!hitEnt && window.pvp?.activeOpponent && window.game.isMultiplayer && pr.owner===window.socket?.id) {
                    const opPvp = window.otherPlayers?.[window.pvp.activeOpponent];
                    if (opPvp && !opPvp.isDead && window.checkRectIntersection(pr.x,pr.y,4,4,opPvp.x,opPvp.y,opPvp.width||20,opPvp.height||56)) { window.sendWorldUpdate('pvp_hit',{targetId:window.pvp.activeOpponent,sourceId:window.socket.id,dmg:pr.damage}); window.spawnDamageText(opPvp.x+(opPvp.width||20)/2,opPvp.y-10,`-${Math.floor(pr.damage)}`,'#ff4444'); window.spawnParticles(pr.x,pr.y,'#ff4444',5); hitEnt = true; }
                }
                if (hitEnt) { window.projectiles.splice(i,1); continue; }
            }
            if (pr.life <= 0) window.projectiles.splice(i,1);
        }

        // Master client: regrowth + spawns + sync
        let isMasterClient = true;
        if (window.game.isMultiplayer && window.otherPlayers) { const allIds = [...Object.keys(window.otherPlayers), window.socket?.id||''].sort(); if (allIds[0] !== window.socket?.id) isMasterClient = false; }

        if (window.game.isRaining && isMasterClient && window.game.frameCount % 60 === 0) {
            window.trees.forEach(t => { if (t.isStump && t.regrowthCount < 3 && t.grownDay !== window.game.days) { const offScreen = t.x < window.camera.x-300 || t.x > window.camera.x+_W+300; if (offScreen && Math.random() < 0.2) { t.isStump=false; t.hp=100; t.maxHp=100; t.regrowthCount++; t.grownDay=window.game.days; window.sendWorldUpdate('grow_tree',{x:t.x,regrowthCount:t.regrowthCount,grownDay:t.grownDay}); } } });
        }

        // Spawn nocturno escalado por día
        const _day = window.game.days || 1;
        const spawnRate = Math.max(120, 500 - _day*25 - Math.floor(Math.abs(window.player.x)/80));
        if (isNight && window.game.frameCount % spawnRate === 0 && isMasterClient) {
            let cx = window.player.x + 850;
            if (Math.random() > 0.5 && window.player.x - 850 > window.game.shoreX + 1500) cx = window.player.x - 850;
            const distShore = Math.abs(cx - (window.game.shoreX || 0));
            if (distShore > 1500) {
                const _sGY = window.getGroundY ? window.getGroundY(cx) : window.game.groundLevel;
                const lvl = Math.max(1, Math.floor(distShore/3500) + _day - 1);
                const _id = () => 'en_' + Math.random().toString(36).substr(2,9);
                const _vx = (spd) => window.player.x > cx ? spd : -spd;
                const capZ=2+Math.floor(_day*0.8), capA=1+Math.floor(_day*0.5), capS=1+Math.floor(_day*0.6), capW=Math.floor(_day*0.4);
                const cntZ=window.entities.filter(e=>e.type==='zombie').length, cntA=window.entities.filter(e=>e.type==='archer').length, cntS=window.entities.filter(e=>e.type==='spider').length, cntW=window.entities.filter(e=>e.type==='wolf').length;
                const weights = [];
                if (cntZ < capZ) weights.push({w:40,t:'zombie'});
                if (cntA < capA) weights.push({w:20,t:'archer'});
                if (cntS < capS) weights.push({w:30,t:'spider'});
                if (capW > 0 && cntW < capW && _day > 1) weights.push({w:10,t:'wolf'});
                if (weights.length === 0) { if (cntZ<3) weights.push({w:1,t:'zombie'}); else if (cntS<2) weights.push({w:1,t:'spider'}); else return; }
                const total = weights.reduce((s,x)=>s+x.w,0); let roll = Math.random()*total, pick = weights[weights.length-1].t;
                for (const entry of weights) { roll -= entry.w; if (roll <= 0) { pick = entry.t; break; } }
                let newEnt = null;
                if      (pick==='zombie') { const hp=35+lvl*15; newEnt={id:_id(),type:'zombie',name:'Mutante',level:lvl,x:cx,y:_sGY-99,width:54,height:99,vx:_vx(0.4),vy:0,hp,maxHp:hp,damage:8+lvl*3,isHit:false,attackCooldown:0,stuckFrames:0,ignorePlayer:0,lastX:cx}; }
                else if (pick==='archer') { const hp=20+lvl*12; newEnt={id:_id(),type:'archer',name:'Cazador',level:lvl,x:cx,y:_sGY-90,width:45,height:90,vx:_vx(0.8),vy:0,hp,maxHp:hp,damage:5+lvl*2,isHit:false,attackCooldown:0,stuckFrames:0,ignorePlayer:0,lastX:cx}; }
                else if (pick==='spider') { const hp=15+lvl*10,sw=32+lvl*2,sh=18+lvl; newEnt={id:_id(),type:'spider',name:'Araña',level:lvl,x:cx,y:_sGY-sh,width:sw,height:sh,vx:_vx(0.7),vy:0,hp,maxHp:hp,damage:5+lvl*2,isHit:false,attackCooldown:0,stuckFrames:0,ignorePlayer:0,lastX:cx}; }
                else if (pick==='wolf')   { const hp=40+lvl*10; newEnt={id:_id(),type:'wolf',name:'Lobo',level:lvl,x:cx,y:_sGY-50,width:63,height:50,vx:_vx(0.5),vy:0,hp,maxHp:hp,damage:7+lvl*2,isHit:false,attackCooldown:0,stuckFrames:0,ignorePlayer:0,lastX:cx,packId:'np_'+Math.floor(cx/100),wolfState:'patrol',wolfStateTimer:0,wolfLeader:true}; }
                if (newEnt) { window.entities.push(newEnt); window.sendWorldUpdate('spawn_entity',{entity:newEnt}); }
            }
        }

        // ── Spawn de arañas de cueva (independiente de día/noche) ───────────────
        // Activo cuando el jugador está bajo el suelo en una cueva real.
        // Se generan 2 tipos: araña pequeña (nivel bajo) y araña grande (nivel alto).
        {
            const _ugSurf  = window.getTerrainCol ? window.getTerrainCol(Math.floor(pCX / bs)) : null;
            const _ugSurfY = _ugSurf ? _ugSurf.topY : (window.game.baseGroundLevel || 510);
            const _playerInCave = window.player.y + window.player.height > _ugSurfY + bs * 2
                && !window.player.isDead;

            if (_playerInCave && isMasterClient && window.game.frameCount % 360 === 0) {
                const _caveSpiders = window.entities.filter(e => e.type === 'spider' && e.inCave).length;
                const _caveSpiderCap = 2 + Math.floor((window.game.days || 1) * 0.4);
                if (_caveSpiders < _caveSpiderCap) {
                    // Elegir X de spawn: offset lateral 400-700px del jugador
                    const _side   = Math.random() > 0.5 ? 1 : -1;
                    const _spawnX = window.player.x + _side * (400 + Math.random() * 300);
                    const _spCol  = Math.floor(_spawnX / bs);
                    const _spCD   = window.getTerrainCol ? window.getTerrainCol(_spCol) : null;
                    if (_spCD && _spCD.type !== 'hole') {
                        // Buscar suelo de cueva: primera fila sólida debajo de al menos 1 fila de aire
                        let _caveFloorY = null;
                        let _inAir = false;
                        for (let _sr = 0; _sr < (window.UG_MAX_DEPTH || 50); _sr++) {
                            const _smat = window.getUGCellV ? window.getUGCellV(_spCol, _sr) : 'stone';
                            if (_smat === 'air') { _inAir = true; }
                            else if (_inAir && _smat !== 'air' && _smat !== 'bedrock') {
                                _caveFloorY = _spCD.topY + _sr * bs;
                                break;
                            }
                        }
                        if (_caveFloorY !== null && _caveFloorY > _ugSurfY + bs) {
                            // Asegurar distancia mínima al jugador (evita que aparezcan "de la nada")
                            const _spDistX = Math.abs(_spawnX - (window.player.x + window.player.width/2));
                            const _spDistY = Math.abs(_caveFloorY - (window.player.y + window.player.height));
                            if (_spDistX < 280 || _spDistY < 60) { /* demasiado cerca — no spawnear */ } else {
                            const _isBig  = Math.random() < 0.22 && (window.game.days || 1) > 2;
                            const _spLvl  = Math.max(1, Math.floor(((window.game.days || 1) - 1) * 0.6) + (_isBig ? 3 : 0));
                            const _spHp   = _isBig ? 70 + _spLvl * 18 : 18 + _spLvl * 7;
                            const _spW    = _isBig ? 44 : 22;
                            const _spH    = _isBig ? 26 : 13;
                            const _spEnt  = {
                                id: 'csv_' + Math.random().toString(36).substr(2, 9),
                                type: 'spider',
                                name: _isBig ? 'Araña Caverna' : 'Araña de Cueva',
                                level: _spLvl,
                                x: _spawnX, y: _caveFloorY - _spH,
                                width: _spW, height: _spH,
                                vx: _side > 0 ? -0.6 : 0.6, vy: 0,
                                hp: _spHp, maxHp: _spHp,
                                damage: _isBig ? 14 + _spLvl * 3 : 4 + _spLvl * 2,
                                isHit: false, attackCooldown: 0,
                                stuckFrames: 0, ignorePlayer: 180, lastX: _spawnX,
                                inCave: true,  // flag para distinguirlas de arañas de superficie
                            };
                            window.entities.push(_spEnt);
                            if (window.sendWorldUpdate) window.sendWorldUpdate('spawn_entity', { entity: _spEnt });
                            } // end distance check else
                        }
                    }
                }
            }
            // Se generan cerca del jugador cuando está bajo tierra en una cueva.
            // Se almacenan en window.caveCobwebs y persisten hasta ser destruidas.
            if (_playerInCave && window.game.frameCount % 90 === 0) {
                window.caveCobwebs = window.caveCobwebs || [];
                window._cobwebGenSet = window._cobwebGenSet || new Set();
                const _ugSurfY2 = _ugSurfY;
                // Escanear columnas cercanas al jugador en busca de esquinas de cueva
                const _cwStartCol = Math.floor((window.player.x - 400) / bs);
                const _cwEndCol   = Math.floor((window.player.x + 400) / bs);
                for (let _cwC = _cwStartCol; _cwC <= _cwEndCol; _cwC++) {
                    const _cwCD = window.getTerrainCol ? window.getTerrainCol(_cwC) : null;
                    if (!_cwCD || _cwCD.type === 'hole') continue;
                    const _cwTopY = _cwCD.topY;
                    // Escanear filas en esta columna buscando celdas de aire con techo/pared sólidos
                    for (let _cwR = 1; _cwR < Math.min(window.UG_MAX_DEPTH || 50, 25); _cwR++) {
                        const _cwKey = `${_cwC}_${_cwR}`;
                        if (window._cobwebGenSet.has(_cwKey)) continue;
                        const _cwMat = window.getUGCellV ? window.getUGCellV(_cwC, _cwR) : 'stone';
                        if (_cwMat !== 'air') continue;
                        // ¿Es un rincón de cueva? (aire aquí, sólido arriba y a un lado)
                        const _cwAbove = window.getUGCellV ? window.getUGCellV(_cwC, _cwR - 1) : 'stone';
                        const _cwLeft  = window.getUGCellV ? window.getUGCellV(_cwC - 1, _cwR) : 'stone';
                        const _cwRight = window.getUGCellV ? window.getUGCellV(_cwC + 1, _cwR) : 'stone';
                        const _isCeiling = _cwAbove !== 'air' && _cwAbove !== 'bedrock';
                        const _isCornerL = _isCeiling && _cwLeft  !== 'air' && _cwLeft  !== 'bedrock';
                        const _isCornerR = _isCeiling && _cwRight !== 'air' && _cwRight !== 'bedrock';
                        // Probabilidad baja: no saturar el mundo de telas
                        const _cwHash = (((_cwC * 374761393) ^ (_cwR * 1103515245)) >>> 0) / 0xFFFFFFFF;
                        const _cwChance = _isCornerL || _isCornerR ? 0.09 : (_isCeiling ? 0.04 : 0);
                        window._cobwebGenSet.add(_cwKey);
                        if (_cwHash > _cwChance) continue;
                        // Crear tela
                        const _cwX  = _cwC * bs + (_isCornerL ? 0 : (_isCornerR ? bs - 10 : bs * 0.2));
                        const _cwY  = _cwTopY + (_cwR) * bs;
                        const _cwW  = _isCornerL || _isCornerR ? bs * 0.7 : bs;
                        const _cwH  = _isCornerL || _isCornerR ? bs * 0.7 : bs * 0.5;
                        const _cwHp = 20 + Math.floor(_cwHash * 15);
                        window.caveCobwebs.push({
                            id: `cw_${_cwC}_${_cwR}`,
                            x: _cwX, y: _cwY, w: _cwW, h: _cwH,
                            hp: _cwHp, maxHp: _cwHp,
                            style: _isCornerL ? 0 : (_isCornerR ? 1 : 2),
                            seed: _cwHash,
                        });
                    }
                }
                // Limitar tamaño del array de telas
                if (window.caveCobwebs.length > 120) window.caveCobwebs.splice(0, window.caveCobwebs.length - 120);
            }

            // ── Exploración de cuevas (fog of war bajo tierra) ─────────────────
            // Marca celdas UG como exploradas para que el renderer las muestre.
            // Las celdas NO exploradas se renderizan como roca oscura sólida.
            if (_playerInCave) {
                if (!window._caveExplored) window._caveExplored = new Set();
                const _ePCol = Math.floor(pCX / bs);
                const _ePRow = Math.floor((window.player.y + window.player.height/2 - _ugSurfY) / bs);
                const _eRadH = 14, _eRadV = 9;  // radio de visión horizontal/vertical
                for (let _ec = _ePCol - _eRadH; _ec <= _ePCol + _eRadH; _ec++) {
                    for (let _er = Math.max(0, _ePRow - _eRadV); _er <= _ePRow + _eRadV; _er++) {
                        const _ef = (_ec-_ePCol)/_eRadH; const _ef2 = (_er-_ePRow)/_eRadV;
                        if (_ef*_ef + _ef2*_ef2 > 1.2) continue;  // elipse
                        window._caveExplored.add(`${_ec}_${_er}`);
                    }
                }
            }
        }

        if (window.game.isMultiplayer && window.socket && isMasterClient && window.game.frameCount % 10 === 0 && window.entities.length > 0) {
            // Solo enviar entidades que se movieron >2px desde el último sync para reducir tráfico
            const _esnap = window.entities.reduce((acc, e) => {
                const _prev = window._entLastSync && window._entLastSync[e.id];
                if (!_prev || Math.abs(e.x - _prev.x) > 2 || Math.abs(e.y - _prev.y) > 2 || Math.abs(e.hp - _prev.hp) > 0) {
                    acc.push({id:e.id,x:e.x,y:e.y,vx:e.vx,vy:e.vy,hp:e.hp});
                }
                return acc;
            }, []);
            if (_esnap.length > 0) {
                if (!window._entLastSync) window._entLastSync = {};
                _esnap.forEach(s => { window._entLastSync[s.id] = {x:s.x, y:s.y, hp:s.hp}; });
                window.sendWorldUpdate('sync_entities', _esnap);
            }
        }

        const isHoldingTorch = window.player.activeTool==='torch' && !window.player.inBackground && !window.player.isDead;
        window.updateEntities(isDay, isNight, isHoldingTorch, pCX, pCY);
        if (window.fires?.length > 0) window.updateFires();

        // Partículas
        for (let i = window.particles.length - 1; i >= 0; i--) { const p=window.particles[i]; p.x+=p.vx;p.y+=p.vy;p.vy+=window.game.gravity*0.4;p.life-=p.decay; const _pGY=window.getGroundY?window.getGroundY(p.x):window.game.groundLevel; if(p.y>=_pGY){p.y=_pGY;p.vy=-p.vy*0.5;p.vx*=0.8;} if(p.life<=0.05||isNaN(p.life)) window.particles.splice(i,1); }
        if (!window.dustParticles) window.dustParticles = [];
        for (let i = window.dustParticles.length - 1; i >= 0; i--) { const d=window.dustParticles[i]; d.x+=d.vx;d.y+=d.vy;d.vx*=0.92;d.vy*=0.88;d.life-=d.decay;d.r+=d.growRate; if(d.life<=0) window.dustParticles.splice(i,1); }
        for (let i = window.damageTexts.length - 1; i >= 0; i--) { const dt=window.damageTexts[i]; dt.y-=0.2;dt.life-=0.008; if(dt.life<=0.05||isNaN(dt.life)) window.damageTexts.splice(i,1); }

        // Hambre
        if (window.game.frameCount % 60 === 0 && !window.player.isDead) {
            const hungerRate = window.player.isSprinting && Math.abs(window.player.vx)>0.3 ? 0.35 : (Math.abs(window.player.vx)>0.1 ? 0.10 : 0.02);
            window.player.hunger -= hungerRate;
            if (window.player.hunger <= 0) { window.player.hunger = 0; window.damagePlayer(2, 'Hambre'); }
            if (window.player.hunger > 50 && window.player.hp < window.player.maxHp) { window.player.hp += 0.5; if (window.updateUI) window.updateUI(); }
        }

        if (typeof window.updateEntityHUD === 'function') window.updateEntityHUD();

    } catch (err) { console.error('Motor de juego protegido:', err); }

    // ── Cámara — FUERA del try/catch para que siempre se actualice ──────────
    if (window.game?.isRunning && window.player && window.camera) {
        const _W = window._canvasLogicW || 1280, _H = window._canvasLogicH || 720;
        window.game.zoom += (window.game.zoomTarget - window.game.zoom) * 0.12;
        window.camera.x = window.player.x + window.player.width/2 - _W/2;
        if (window.camera._targetY === undefined) window.camera._targetY = window.player.y + window.player.height - _H*0.62;
        window.camera._targetY += (window.player.y + window.player.height - _H*0.62 - window.camera._targetY) * 0.08;
        window.camera.y = window.camera._targetY;
        if (window.camera.x < (window.game.shoreX||0) - _W/2) window.camera.x = (window.game.shoreX||0) - _W/2;
        if (window.player.x + _W/2 > window.game.exploredRight) { window.generateWorldSector(window.game.exploredRight, window.game.exploredRight + window.game.chunkSize); window.game.exploredRight += window.game.chunkSize; }
    }
}

window.gameLoop = function(timestamp) {
    // ── Cálculo de FPS ────────────────────────────────────────────────
    if (window._fpsLastTime === undefined) { window._fpsLastTime = timestamp; window._fpsFrames = 0; window._fps = 60; }
    window._fpsFrames++;
    const fpsDelta = timestamp - window._fpsLastTime;
    if (fpsDelta >= 500) {
        window._fps = Math.round(window._fpsFrames / (fpsDelta / 1000));
        window._fpsFrames = 0;
        window._fpsLastTime = timestamp;
    }

    // ── Fixed-timestep accumulator ────────────────────────────────────
    const FIXED_DT = 1000 / 60;
    if (window._lastLoopTime === undefined) { window._gameAccum = 0; window._lastLoopTime = timestamp; window._upsFrames = 0; window._upsLastTime = timestamp; window._ups = 60; }
    let elapsed = timestamp - window._lastLoopTime;
    window._lastLoopTime = timestamp;
    if (elapsed > FIXED_DT * 3) elapsed = FIXED_DT * 3;
    window._gameAccum += elapsed;

    while (window._gameAccum >= FIXED_DT) {
        if (window.game?.isRunning && !document.hidden) {
            // Guardar posiciones previas ANTES de update para interpolación de render
            if (window.player) {
                window.player._prevX = window.player.x;
                window.player._prevY = window.player.y;
            }
            if (window.camera) {
                window._prevCamX = window.camera.x;
                window._prevCamY = window.camera.y;
            }
            window.entities?.forEach(e => { e._prevX = e.x; e._prevY = e.y; });
            update();
            window._upsFrames++;
        }
        window._gameAccum -= FIXED_DT;
    }

    // Fracción de interpolación: cuánto del siguiente step ya transcurrió
    window._renderAlpha = Math.min(1, window._gameAccum / FIXED_DT);

    // UPS real (actualizaciones de lógica por segundo)
    const _upsDelta = timestamp - window._upsLastTime;
    if (_upsDelta >= 500) {
        window._ups = Math.round(window._upsFrames / (_upsDelta / 1000));
        window._upsFrames = 0;
        window._upsLastTime = timestamp;
    }

    if (typeof window.draw === 'function' && !document.hidden) window.draw();
    requestAnimationFrame(window.gameLoop);
};

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.game?.isRunning) {
        if (window.player) { window.player.attackCooldown = Math.max(window.player.attackCooldown||0, 0); window.player._prevVy = 0; }
        if (window.keys) { window.keys.mouseLeft = false; window.keys.jumpPressed = false; }
    }
});

window.addEventListener('DOMContentLoaded', () => { window.gameLoop(); });
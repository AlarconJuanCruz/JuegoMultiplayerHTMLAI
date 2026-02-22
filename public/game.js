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

// === (1) REEMPLAZA ESTA FUNCIÓN ===
window.isValidPlacement = function(x, y, w, h, requireAdjacency = true, isStructure = false) {
    if (y + h > window.game.groundLevel) return false;
    if (window.checkRectIntersection(x, y, w, h, window.player.x, window.player.y, window.player.width, window.player.height)) return false;
    if (window.game.isMultiplayer && window.otherPlayers) {
        for (let id in window.otherPlayers) { let op = window.otherPlayers[id]; if (window.checkRectIntersection(x, y, w, h, op.x, op.y, op.width||24, op.height||48)) return false; }
    }
    for (let b of window.blocks) { 
        let bh = b.type === 'door' ? window.game.blockSize * 2 : window.game.blockSize; 
        
        // Verifica si choca con otro bloque (No se puede pisar nada)
        if (window.checkRectIntersection(x, y, w, h, b.x, b.y, window.game.blockSize, bh)) return false; 
        
        // REGLAS ESPECÍFICAS DE ESTRUCTURA Y PUERTAS
        if (isStructure && b.type === 'door') {
            // Verifica si intentas poner un bloque exactamente pegado A LOS LADOS de la puerta
            if ((x === b.x - window.game.blockSize || x === b.x + window.game.blockSize) &&
                (y < b.y + bh && y + h > b.y)) {
                return false; // NO permite construir a los lados
            }
            // Pero al no hacer "return false" si (y + h <= b.y), SÍ permitirá construir ARRIBA.
        }
    }
    for (let t of window.trees) { let th = t.isStump ? 15 + t.width*0.2 : t.height; let ty = t.isStump ? t.y + t.height - th : t.y; if (window.checkRectIntersection(x, y, w, h, t.x, ty, t.width, th)) return false; }
    for (let r of window.rocks) { if (window.checkRectIntersection(x, y, w, h, r.x, r.y, r.width, r.height)) return false; }
    if (requireAdjacency) { if (!window.isAdjacentToBlockOrGround(x, y, w, h)) return false; }
    return true;
};

// === (2) REEMPLAZA ESTE EVENTO COMPLETO ===
window.addEventListener('mousedown', (e) => {
    if (!window.game || !window.game.isRunning || window.player.isDead || document.querySelector('.window-menu.open')) return;
    
    // MODO COLOCACIÓN DE OBJETOS (Cajas, Fogatas, Camas)
    if (window.player.placementMode) {
        if (e.button === 2) { window.player.placementMode = null; return; } 
        if (e.button === 0) {
            let offsetY = window.game.groundLevel % window.game.blockSize;
            const gridX = Math.floor(window.mouseWorldX / window.game.blockSize) * window.game.blockSize; 
            const gridY = Math.floor((window.mouseWorldY - offsetY) / window.game.blockSize) * window.game.blockSize + offsetY;
            
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
                } else {
                    window.spawnDamageText(window.mouseWorldX, window.mouseWorldY - 10, "Lugar Inválido", '#ffaa00');
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
                        if (ent.type === 'spider') { let ni = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:0, vy:-1, type:'web', amount:2, life:1.0}; window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni}); window.gainXP(20 * ent.level); }
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
                        let ni = { id: Math.random().toString(36).substring(2,9), x:r.x+15, y:r.y+15, vx:(Math.random()-0.5)*3, vy:-2, type:'stone', amount:15 + Math.floor(Math.random()*10), life:1.0};
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

    // MODO CONSTRUCCIÓN DE ESTRUCTURAS (Martillo)
    if (!actionDone && window.player.activeTool === 'hammer') {
        let offsetY = window.game.groundLevel % window.game.blockSize;
        const gridX = Math.floor(window.mouseWorldX / window.game.blockSize) * window.game.blockSize; 
        const gridY = Math.floor((window.mouseWorldY - offsetY) / window.game.blockSize) * window.game.blockSize + offsetY;
        
        const isDoorMode = window.player.buildMode === 'door'; const itemHeight = isDoorMode ? window.game.blockSize * 2 : window.game.blockSize; const cost = isDoorMode ? 4 : 2; 
        
        if (Math.hypot(pCX - (gridX + window.game.blockSize/2), pCY - (gridY + itemHeight/2)) <= window.player.miningRange) {
            if (window.player.inventory.wood >= cost) {
                if (window.isValidPlacement(gridX, gridY, window.game.blockSize, itemHeight, true, true)) {
                    let newB = { x: gridX, y: gridY, type: isDoorMode ? 'door' : 'block', open: false, hp: 300, maxHp: 300, isHit: false };
                    window.blocks.push(newB); window.sendWorldUpdate('place_block', { block: newB }); window.player.inventory.wood -= cost; window.spawnParticles(gridX + 15, gridY + 15, '#D2B48C', 5, 0.5); if(window.updateUI) window.updateUI();
                } else {
                    // Texto cuando estás demasiado cerca de ti mismo, bloques, o una zona indebida.
                    window.spawnDamageText(window.mouseWorldX, window.mouseWorldY - 10, "Lugar Inválido", '#ffaa00');
                }
            } else {
                // TEXTO FLOTANTE DE ADVERTENCIA POR MATERIALES
                window.spawnDamageText(window.mouseWorldX, window.mouseWorldY - 10, `Faltan ${cost} Mad.`, '#ff4444');
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
                    let pCY = window.player.y + 6; // <-- DISPARA DESDE LA ALTURA DE LA CARA
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
                            if (ent.type === 'spider') { let ni = { id: Math.random().toString(36).substring(2,9), x:ent.x, y:ent.y, vx:0, vy:-1, type:'web', amount:2, life:1.0}; window.droppedItems.push(ni); window.sendWorldUpdate('drop_item', {item:ni}); window.gainXP(20 * ent.level); }
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

        if (window.game.isMultiplayer && window.socket && isMasterClient && window.game.frameCount % 6 === 0 && window.entities.length > 0) {
            let snap = window.entities.map(e => ({ id: e.id, x: e.x, y: e.y, vx: e.vx, vy: e.vy, hp: e.hp }));
            window.sendWorldUpdate('sync_entities', snap);
        }

        let isHoldingTorch = window.player.activeTool === 'torch' && !window.player.inBackground && !window.player.isDead;

        window.entities.forEach((ent, i) => {
            let lastX = ent.x; ent.x += ent.vx; let hitWall = window.checkEntityCollisions(ent, 'x'); 
            if (ent.x < window.game.shoreX + 2000) { ent.x = window.game.shoreX + 2000; ent.vx = Math.abs(ent.vx); hitWall = true; }
            ent.vy += window.game.gravity; ent.y += ent.vy; window.checkEntityCollisions(ent, 'y'); 
            if (ent.y + ent.height >= window.game.groundLevel) { ent.y = window.game.groundLevel - ent.height; ent.vy = 0; }
            
            let targetPlayer = window.player;
            let targetCX = pCX, targetCY = pCY;
            let minDist = Math.hypot(pCX - (ent.x + ent.width/2), pCY - (ent.y + ent.height/2));
            
            if (window.game.isMultiplayer && window.otherPlayers) {
                Object.values(window.otherPlayers).forEach(op => {
                    if (op.isDead) return;
                    let opCX = op.x + (op.width||24)/2;
                    let opCY = op.y + (op.height||48)/2;
                    let dist = Math.hypot(opCX - (ent.x + ent.width/2), opCY - (ent.y + ent.height/2));
                    if (dist < minDist) { minDist = dist; targetPlayer = op; targetCX = opCX; targetCY = opCY; }
                });
            }

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
                let aggroRange = 180; if (isNight && !targetPlayer.isStealth) aggroRange = 600; if (ent.type === 'zombie' && !targetPlayer.isStealth) aggroRange = 800; 

                let repelledByTorch = isHoldingTorch && minDist < 250 && ent.level <= 3 && targetPlayer === window.player;

                if (repelledByTorch) {
                    ent.vx = (ent.x > targetCX) ? 1.5 : -1.5;
                    ent.ignorePlayer = 60; 
                } else if (minDist < aggroRange && ent.ignorePlayer <= 0) {
                    let speed = ent.type === 'zombie' ? 0.4 : 0.8; let targetVx = (targetPlayer.x > ent.x) ? speed : -speed; ent.vx = targetVx;
                    if (hitWall || Math.abs(ent.x - lastX) < 0.1) { ent.stuckFrames++; if (ent.stuckFrames > 60 && ent.type !== 'zombie') { ent.ignorePlayer = 180; ent.vx = -targetVx * 1.5; ent.stuckFrames = 0; } } else ent.stuckFrames = 0;
                    if (minDist < 40 && ent.attackCooldown <= 0 && !targetPlayer.inBackground && !targetPlayer.isDead) { 
                        if (targetPlayer === window.player) window.damagePlayer(ent.damage, ent.name); 
                        ent.attackCooldown = 150; 
                    }
                } else { if(ent.type === 'spider' && Math.random() < 0.02 && ent.ignorePlayer <= 0) ent.vx = (Math.random() > 0.5 ? 0.5 : -0.5); }
                if (ent.attackCooldown > 0) ent.attackCooldown--;
            } 
            else if (!repelled && ent.type === 'archer') {
                let aggroRange = (isNight && !targetPlayer.isStealth) ? 1000 : 800; 
                if (minDist < aggroRange && ent.ignorePlayer <= 0 && !targetPlayer.inBackground && !targetPlayer.isDead) {
                    let dirX = targetPlayer.x > ent.x ? 1 : -1;
                    if (minDist > 600) ent.vx = dirX * 0.5; else if (minDist < 400) ent.vx = -dirX * 0.8; else ent.vx = 0;
                    if (hitWall || (Math.abs(ent.x - lastX) < 0.1 && ent.vx !== 0)) { ent.stuckFrames++; if (ent.stuckFrames > 60) { ent.ignorePlayer = 180; ent.vx = -dirX * 1.5; ent.stuckFrames = 0; } } else ent.stuckFrames = 0;
                    if (ent.attackCooldown <= 0 && minDist < 950) {
                        let vx_base = targetCX - (ent.x + ent.width/2); let vy_base = targetCY - (ent.y + ent.height/2); let currentSpeed = Math.max(0.1, Math.hypot(vx_base, vy_base));
                        let arrowSpeed = 9; let vx = (vx_base / currentSpeed) * arrowSpeed; let vy = (vy_base / currentSpeed) * arrowSpeed;
                        let timeInAir = minDist / arrowSpeed; vy -= (timeInAir * window.game.gravity * 0.4 * 0.5); 
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
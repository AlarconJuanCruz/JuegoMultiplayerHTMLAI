// === player.js - LÓGICA DE RPG Y JUGADOR ===

window.useTool = function() {
    if (window.player.activeTool === 'hand') return;
    window.player.toolHealth[window.player.activeTool]--;
    if (window.player.toolHealth[window.player.activeTool] <= 0) {
        window.spawnDamageText(window.player.x + window.player.width/2, window.player.y - 20, `¡${window.toolDefs[window.player.activeTool].name} Rota!`, '#ff4444');
        
        window.player.toolbar[window.player.activeSlot] = null;
        window.selectToolbarSlot(0); 
        
        if(window.updateUI) window.updateUI();
        if(window.renderToolbar) window.renderToolbar();
    }
};

window.gainXP = function(amount) {
    if (window.player.isDead) return;
    window.player.xp += amount; let leveledUp = false;
    while (window.player.xp >= window.player.maxXp) {
        window.player.xp -= window.player.maxXp; window.player.level++; window.player.statPoints++;
        window.player.maxXp = Math.floor(100 * Math.pow(1.8, window.player.level - 1)); leveledUp = true;
    }
    if (leveledUp) { 
        window.spawnDamageText(window.player.x + window.player.width/2, window.player.y - 20, "¡NIVEL " + window.player.level + "!", '#FFD700'); 
        window.spawnParticles(window.player.x + window.player.width/2, window.player.y, '#FFD700', 30, 2); 
        window.player.hp = window.player.maxHp; 
    }
    if(window.updateUI) window.updateUI();
};

window.recalculateStats = function() {
    let oldMaxHp = window.player.maxHp;
    window.player.maxHp = window.player.baseHp + (window.player.stats.vit * 15); 
    window.player.hp += (window.player.maxHp - oldMaxHp); 
    window.player.maxHunger = window.player.baseHunger + (window.player.stats.sta * 15); 
    window.player.speed = window.player.baseSpeed + (window.player.stats.agi * 0.15); 
    window.player.jumpPower = window.player.baseJump - (window.player.stats.agi * 0.2); 
    if(window.updateUI) window.updateUI();
};

window.getMeleeDamage = function() { return window.player.baseDamage[window.player.activeTool] * (1 + window.player.stats.str * 0.1); };
window.getBowDamage = function() { return (8 + (window.player.chargeLevel/100)*25) * (1 + window.player.stats.int * 0.15); };

window.damagePlayer = function(amount, source = 'Causas Misteriosas') {
    if (window.player.isDead) return;

    window.player.hp -= amount; 
    window.setHit(window.player); 
    window.game.screenShake = 10;
    
    window.spawnDamageText(window.player.x + window.player.width/2, window.player.y - 10, `-${Math.floor(amount)}`, '#ff4444'); 
    window.spawnParticles(window.player.x + window.player.width/2, window.player.y + window.player.height/2, '#ff4444', 8);
    
    if (window.player.hp <= 0) { 
        window.player.hp = 0;
        window.player.isDead = true;
        
        if(window.addGlobalMessage) window.addGlobalMessage(`☠️ Has muerto por ${source}`, '#e74c3c');
        if(window.sendWorldUpdate) window.sendWorldUpdate('player_death', { name: window.player.name, source: source });

        window.keys.a = false; window.keys.d = false; window.keys.w = false; window.keys.shift = false; window.keys.y = false; window.keys.jumpPressed = false;
        window.player.isCharging = false; window.player.isAiming = false;
        
        let graveId = 'g_' + Math.random().toString(36).substr(2, 9);
        let graveX = Math.floor((window.player.x + window.player.width/2) / window.game.blockSize) * window.game.blockSize;
        let grave = { id: graveId, x: graveX, y: window.game.groundLevel - window.game.blockSize, type: 'grave', owner: window.player.name, inventory: { ...window.player.inventory }, hp: 200, maxHp: 200, isHit: false, createdAt: Date.now() };
        window.blocks.push(grave);
        if(window.sendWorldUpdate) window.sendWorldUpdate('place_block', { block: grave });

        window.player.inventory = { wood: 0, stone: 0, meat: 0, cooked_meat: 0, web: 0, arrows: 0, boxes: 0, campfire_item: 0, bed_item: 0 }; 
        window.player.toolbar = ['hand', null, null, null, null, null];
        if(window.selectToolbarSlot) window.selectToolbarSlot(0);
        window.player.xp = 0; 
        
        let deathScreen = window.getEl('death-screen');
        let bedBtn = window.getEl('btn-respawn-bed');
        if (deathScreen) deathScreen.style.display = 'block';
        if (bedBtn) { if (window.player.bedPos) bedBtn.style.display = 'inline-block'; else bedBtn.style.display = 'none'; }
    }
    if(window.updateUI) window.updateUI();
    if(window.renderToolbar) window.renderToolbar();
};

window.respawn = function(locationType) {
    window.recalculateStats();
    window.player.hp = window.player.maxHp; 
    window.player.hunger = window.player.maxHunger;

    let spawnX = 250; let spawnY = 100;

    if (locationType === 'bed' && window.player.bedPos) {
        let bed = window.blocks.find(b => b.x === window.player.bedPos.x && b.y === window.player.bedPos.y && b.type === 'bed');
        if (bed) {
            bed.uses = (bed.uses !== undefined ? bed.uses : 10) - 1;
            spawnX = bed.x; spawnY = bed.y - window.player.height;
            if (bed.uses <= 0) {
                window.spawnDamageText(bed.x + 15, bed.y - 20, `¡CAMA ROTA!`, '#ff4444');
                window.blocks = window.blocks.filter(b => b !== bed); window.player.bedPos = null;
                window.spawnParticles(bed.x + 15, bed.y + 10, '#8B0000', 15);
                if(window.sendWorldUpdate) window.sendWorldUpdate('remove_old_bed', { owner: window.player.name });
            } else { window.spawnDamageText(bed.x + 15, bed.y - 20, `Cama: ${bed.uses}/10`, '#FFD700'); }
        } else { window.player.bedPos = null; }
    }

    window.player.x = spawnX; window.player.y = spawnY;

    let deathScreen = window.getEl('death-screen');
    if (deathScreen) deathScreen.style.display = 'none';
    window.player.isDead = false;
    window.spawnParticles(window.player.x + window.player.width/2, window.player.y + window.player.height/2, '#4CAF50', 20, 2);

    if(window.updateUI) window.updateUI(); if(window.renderToolbar) window.renderToolbar();
};
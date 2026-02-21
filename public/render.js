// === render.js - LÓGICA DE DIBUJADO, LUCES Y RIGGING 2D ===

// Utilidad para dibujar formas redondeadas
window.roundRect = function(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y); ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath(); ctx.fill();
};

// FUNCIÓN MAESTRA: Dibuja a CUALQUIER personaje (Local o Red)
window.drawCharacter = function(charData, isLocal) {
    if (!window.ctx || charData.isDead) return;
    window.ctx.save();
    
    // Posición base
    const pCX = charData.x + (charData.width || 24) / 2;
    const pCY = charData.y + (charData.height || 48); 
    window.ctx.translate(pCX, pCY);
    
    // Transparencias y Sigilo
    if (isLocal && charData.isStealth) { window.ctx.globalAlpha = 0.3; } 
    else if (charData.inBackground) { window.ctx.globalAlpha = 0.5; window.ctx.scale(0.9, 0.9); }

    let targetX = isLocal ? window.mouseWorldX : (charData.mouseX || pCX);
    let targetY = isLocal ? window.mouseWorldY : (charData.mouseY || pCY);
    let isFacingR = charData.facingRight; 
    if (charData.activeTool === 'bow' && charData.isAiming) isFacingR = targetX >= pCX;
    if (!isFacingR) window.ctx.scale(-1, 1); 
    
    // --- NUEVO FÍSICA PARA ANIMACIONES EN RED (Interpolación) ---
    let isJumping = false;
    let isRunning = false;
    
    if (isLocal) {
        isJumping = !charData.isGrounded;
        isRunning = Math.abs(charData.vx || 0) > 0.1 && !isJumping;
        charData.renderAnimTime = charData.animTime; 
    } else {
        // Suavizador de movimiento para jugadores de red (porque los paquetes llegan con delay)
        let dx = Math.abs(charData.x - (charData.lastX || charData.x));
        charData.lastX = charData.x;
        if (dx > 0.1) charData.isMovingFrames = 10; // Mantiene el estado de correr entre paquetes
        else if (charData.isMovingFrames > 0) charData.isMovingFrames--;
        
        let dy = charData.y - (charData.lastY || charData.y);
        charData.lastY = charData.y;
        if (Math.abs(dy) > 0.5) charData.isJumpingFrames = 10;
        else if (charData.isJumpingFrames > 0) charData.isJumpingFrames--;

        isJumping = charData.isJumpingFrames > 0;
        isRunning = charData.isMovingFrames > 0 && !isJumping;

        // Avanzar el tiempo de animación de forma artificial para que muevan las piernas
        if (isRunning) charData.renderAnimTime = (charData.renderAnimTime || 0) + 0.15;
        else charData.renderAnimTime = 0;
    }

    let time = (charData.renderAnimTime || 0) * 1.5; 
    
    // Ángulos de Rigging
    let legR = 0, legL = 0, kneeR = 0, kneeL = 0;
    let armR = 0, armL = 0, elbowR = 0, elbowL = 0;
    let torsoR = 0, headR = 0;
    let bob = 0;

    if (isJumping) {
        legR = -0.5; kneeR = 0.8;
        legL = 0.3; kneeL = 0.1;
        armR = -2.5; elbowR = -0.2;
        armL = -1.5; elbowL = -0.5;
        torsoR = 0.1; headR = -0.2;
        bob = -4;
    } else if (isRunning) {
        legR = Math.sin(time) * 1.0;
        kneeR = Math.max(0, Math.sin(time - Math.PI/2) * 1.5);
        legL = Math.sin(time + Math.PI) * 1.0;
        kneeL = Math.max(0, Math.sin(time + Math.PI/2) * 1.5);
        
        armR = Math.cos(time) * 1.0;
        elbowR = -0.2 + Math.sin(time)*0.4;
        armL = Math.cos(time + Math.PI) * 1.0;
        elbowL = -0.2 + Math.sin(time + Math.PI)*0.4;
        
        torsoR = 0.15; headR = -0.05;
        bob = Math.abs(Math.sin(time * 2)) * 3;
    } else {
        let idleTime = window.game.frameCount * 0.05;
        torsoR = Math.sin(idleTime) * 0.02;
        headR = Math.sin(idleTime - 1) * 0.03;
        armR = 0.1 + Math.sin(idleTime) * 0.03;
        armL = -0.1 - Math.sin(idleTime) * 0.03;
        elbowR = -0.1; elbowL = -0.1;
        bob = Math.sin(idleTime) * 1;
    }

    let aimAngle = 0;
    if (charData.activeTool === 'bow' && charData.isAiming) {
        aimAngle = Math.atan2(targetY - (pCY - 24 - bob), isFacingR ? (targetX - pCX) : -(targetX - pCX));
        armR = aimAngle - Math.PI/2;
        elbowR = 0; 
        armL = aimAngle - Math.PI/2 + 0.3; elbowL = -1.5;
        torsoR = aimAngle * 0.2; headR = aimAngle * 0.3;
    } else if (charData.attackFrame > 0) {
        let progress = charData.attackFrame / 12; 
        armR = -Math.PI * 0.9 * progress + (1 - progress) * 0.8; 
        elbowR = -0.2;
        torsoR += 0.3 * progress; 
    }

    // Colores
    let skin = charData.isHit ? '#ff4444' : '#f1c27d';
    let shirt = charData.isHit ? '#ff4444' : (isLocal ? '#3498db' : '#686868'); 
    let shirtDark = charData.isHit ? '#cc0000' : (isLocal ? '#2980b9' : '#4a4a4a');
    let pants = '#2c3e50'; let pantsDark = '#1a252f';
    let shoes = '#222'; let shoesDark = '#111';
    
    if (charData.inBackground) { skin='#888'; shirt='#666'; shirtDark='#555'; pants='#444'; pantsDark='#333'; }

    window.ctx.translate(0, -bob);

    // --- CAPA 1: FONDO ---
    window.ctx.save(); 
    window.ctx.translate(-3, -24); 
    window.ctx.rotate(legL);
    window.ctx.fillStyle = pantsDark; window.roundRect(window.ctx, -4.5, 0, 9, 14, 4); 
    window.ctx.translate(0, 12); window.ctx.rotate(kneeL);
    window.ctx.fillStyle = pantsDark; window.roundRect(window.ctx, -3.5, 0, 7, 14, 3); 
    window.ctx.fillStyle = shoesDark; window.roundRect(window.ctx, -4.5, 12, 11, 5, 2); 
    window.ctx.restore();

    window.ctx.save(); 
    window.ctx.translate(0, -24); 
    window.ctx.rotate(torsoR);

    window.ctx.save(); 
    window.ctx.translate(2, -20); 
    window.ctx.rotate(armL);
    window.ctx.fillStyle = shirtDark; window.roundRect(window.ctx, -3.5, 0, 7, 12, 3);
    window.ctx.translate(0, 10); window.ctx.rotate(elbowL);
    window.ctx.fillStyle = skin; window.roundRect(window.ctx, -2.5, 0, 5, 10, 2);
    window.ctx.restore();

    window.ctx.fillStyle = shirt;
    window.roundRect(window.ctx, -9, -22, 18, 24, 6);

    window.ctx.save(); 
    window.ctx.translate(0, -24); 
    window.ctx.rotate(headR);
    window.ctx.fillStyle = skin; window.roundRect(window.ctx, -10, -18, 20, 20, 8);
    window.ctx.fillStyle = '#333'; window.ctx.fillRect(4, -10, 3, 4); 
    window.ctx.fillStyle = '#3E2723'; window.ctx.beginPath(); window.ctx.arc(0, -14, 11, Math.PI, 0); window.ctx.fill(); 
    window.ctx.restore();
    window.ctx.restore(); 

    // --- CAPA 2: FRENTE ---
    window.ctx.save(); 
    window.ctx.translate(3, -24); 
    window.ctx.rotate(legR);
    window.ctx.fillStyle = pants; window.roundRect(window.ctx, -4.5, 0, 9, 14, 4); 
    window.ctx.translate(0, 12); window.ctx.rotate(kneeR);
    window.ctx.fillStyle = pants; window.roundRect(window.ctx, -3.5, 0, 7, 14, 3); 
    window.ctx.fillStyle = shoes; window.roundRect(window.ctx, -4.5, 12, 11, 5, 2); 
    window.ctx.restore();

    window.ctx.save();
    window.ctx.translate(0, -24); 
    window.ctx.rotate(torsoR);    
    window.ctx.translate(-3, -20); 
    window.ctx.rotate(armR);
    
    window.ctx.fillStyle = shirt; window.roundRect(window.ctx, -3.5, 0, 7, 12, 3);
    window.ctx.translate(0, 10); window.ctx.rotate(elbowR);
    window.ctx.fillStyle = skin; window.roundRect(window.ctx, -2.5, 0, 5, 10, 2);
    
    // --- HERRAMIENTAS ---
    window.ctx.translate(0, 8); 
    
    if (charData.activeTool === 'bow') {
        window.ctx.rotate(Math.PI/2);
        window.ctx.strokeStyle = charData.inBackground ? '#4a250a' : '#8B4513'; window.ctx.lineWidth = 3; 
        window.ctx.beginPath(); window.ctx.arc(0, 0, 15, -Math.PI/2.5, Math.PI/2.5); window.ctx.stroke();
        
        let pull = charData.isAiming ? ((charData.chargeLevel || 0) / 100) * 15 : 0; 
        window.ctx.strokeStyle = '#eee'; window.ctx.lineWidth = 1; 
        window.ctx.beginPath(); window.ctx.moveTo(4.6, -14.2); window.ctx.lineTo(4.6 - pull, 0); window.ctx.lineTo(4.6, 14.2); window.ctx.stroke();
        
        if (charData.isCharging && (isLocal ? charData.inventory.arrows > 0 : true)) { 
            window.ctx.fillStyle = '#eee'; window.ctx.fillRect(4.6 - pull, -1, 20 + pull, 2); 
            window.ctx.fillStyle = '#666'; window.ctx.fillRect(4.6 - pull + 20 + pull, -2, 4, 4); 
        }
    } else if (charData.activeTool && charData.activeTool !== 'hand') {
        window.ctx.rotate(Math.PI/2); 
        
        if (charData.activeTool === 'axe' || charData.activeTool === 'hammer' || charData.activeTool === 'pickaxe') {
            window.ctx.fillStyle = charData.inBackground ? '#4a250a' : '#8B4513'; 
            window.ctx.fillRect(-2, -20, 4, 28); 
            
            window.ctx.fillStyle = charData.inBackground ? '#666' : '#444'; 
            if (charData.activeTool === 'axe') { window.ctx.fillStyle = '#AAA'; window.ctx.fillRect(-10, -22, 14, 10); }
            else if (charData.activeTool === 'pickaxe') { window.ctx.fillStyle = '#999'; window.ctx.beginPath(); window.ctx.moveTo(0,-24); window.ctx.lineTo(14,-16); window.ctx.lineTo(-14,-16); window.ctx.fill(); }
            else { window.ctx.fillRect(-6, -22, 12, 10); } 
        } else if (charData.activeTool === 'sword') {
            window.ctx.fillStyle = '#8B4513'; window.ctx.fillRect(-2, -5, 4, 10); 
            window.ctx.fillStyle = '#FFD700'; window.ctx.fillRect(-6, -7, 12, 4); window.ctx.fillRect(-3, 3, 6, 2); 
            window.ctx.fillStyle = '#E0E0E0'; window.ctx.beginPath(); window.ctx.moveTo(-3,-7); window.ctx.lineTo(3,-7); window.ctx.lineTo(0,-30); window.ctx.fill(); 
        }
    }
    window.ctx.restore(); 
    window.ctx.restore(); 
};

// === DIBUJADO DEL MUNDO ===
window.draw = function() {
    if (!window.ctx) return;
    if (!window.game.isRunning) { window.ctx.fillStyle = '#050505'; window.ctx.fillRect(0, 0, window.canvas.width, window.canvas.height); return; }

    let currentUptime = window.game.serverStartTime ? (Date.now() - window.game.serverStartTime) : (window.game.frameCount * (1000/60));
    let totalFrames = Math.floor(currentUptime / (1000 / 60)) + 28800; 
    let hourFloat = (totalFrames / 3600) % 24; 
    let darkness = (Math.cos((hourFloat / 24) * Math.PI * 2) + 1) / 2;
    let r = Math.floor(135 - (130 * darkness)); let g = Math.floor(206 - (200 * darkness)); let b = Math.floor(235 - (215 * darkness)); 
    
    window.ctx.fillStyle = `rgb(${r},${g},${b})`; window.ctx.fillRect(0, 0, window.canvas.width, window.canvas.height);
    window.ctx.save(); 
    if (window.game.screenShake > 0) { let dx = (Math.random() - 0.5) * window.game.screenShake; let dy = (Math.random() - 0.5) * window.game.screenShake; window.ctx.translate(dx, dy); }
    
    if (hourFloat > 5 && hourFloat < 19) {
        let dayProgress = (hourFloat - 5) / 14; let sunX = window.canvas.width * dayProgress; let sunY = window.canvas.height * 0.8 - Math.sin(dayProgress * Math.PI) * (window.canvas.height * 0.7);
        window.ctx.fillStyle = '#FFD700'; window.ctx.shadowColor = '#FF8C00'; window.ctx.shadowBlur = 50; window.ctx.beginPath(); window.ctx.arc(sunX, sunY, 45, 0, Math.PI*2); window.ctx.fill(); window.ctx.shadowBlur = 0;
    }
    if (hourFloat >= 17 || hourFloat <= 7) {
        let nightProgress = hourFloat >= 17 ? (hourFloat - 17) / 14 : (hourFloat + 7) / 14; let moonX = window.canvas.width * nightProgress; let moonY = window.canvas.height * 0.8 - Math.sin(nightProgress * Math.PI) * (window.canvas.height * 0.7);
        window.ctx.fillStyle = '#F4F6F0'; window.ctx.shadowColor = '#FFF'; window.ctx.shadowBlur = 40; window.ctx.beginPath(); window.ctx.arc(moonX, moonY, 35, 0, Math.PI*2); window.ctx.fill();
        window.ctx.fillStyle = 'rgba(0,0,0,0.1)'; window.ctx.beginPath(); window.ctx.arc(moonX - 10, moonY + 5, 8, 0, Math.PI*2); window.ctx.fill(); window.ctx.beginPath(); window.ctx.arc(moonX + 12, moonY - 8, 5, 0, Math.PI*2); window.ctx.fill(); window.ctx.beginPath(); window.ctx.arc(moonX + 2, moonY + 12, 6, 0, Math.PI*2); window.ctx.fill(); window.ctx.shadowBlur = 0;
    }

    if (darkness > 0.5) { window.ctx.fillStyle = `rgba(255, 255, 255, ${(darkness - 0.5) * 2})`; window.stars.forEach(st => { window.ctx.fillRect(st.x, st.y, st.s, st.s); }); }

    window.clouds.forEach(c => {
        c.x += c.v; if (c.x > window.canvas.width + 100) c.x = -100; window.ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - darkness)})`;
        window.ctx.beginPath(); window.ctx.arc(c.x, c.y, 30*c.s, 0, Math.PI*2); window.ctx.arc(c.x + 25*c.s, c.y - 15*c.s, 35*c.s, 0, Math.PI*2); window.ctx.arc(c.x + 50*c.s, c.y, 25*c.s, 0, Math.PI*2); window.ctx.fill();
    });

    let gradMountains = window.ctx.createLinearGradient(0, window.game.groundLevel - 200, 0, window.game.groundLevel);
    gradMountains.addColorStop(0, `rgb(${Math.max(5, r-30)},${Math.max(5, g-30)},${Math.max(15, b-20)})`); gradMountains.addColorStop(1, `rgb(${Math.max(5, r-50)},${Math.max(5, g-50)},${Math.max(15, b-40)})`);
    window.ctx.fillStyle = gradMountains; window.ctx.beginPath(); let mX = -(window.camera.x * 0.1) % 600; 
    for(let i=0; i<5; i++) { window.ctx.moveTo(mX + i*600, window.game.groundLevel); window.ctx.lineTo(mX + i*600 + 300, window.game.groundLevel - 200); window.ctx.lineTo(mX + i*600 + 600, window.game.groundLevel); } window.ctx.fill();

    window.ctx.fillStyle = `rgb(${Math.max(5, r-60)},${Math.max(5, g-50)},${Math.max(15, b-30)})`; window.ctx.beginPath(); let hX = -(window.camera.x * 0.3) % 800; 
    for(let i=0; i<4; i++) { window.ctx.moveTo(hX + i*800, window.game.groundLevel); window.ctx.quadraticCurveTo(hX + i*800 + 400, window.game.groundLevel - 150, hX + i*800 + 800, window.game.groundLevel); } window.ctx.fill();

    window.ctx.translate(-window.camera.x, -window.camera.y);

    window.ctx.fillStyle = '#557A27'; window.ctx.fillRect(Math.max(window.camera.x, window.game.shoreX), window.game.groundLevel, window.canvas.width, 10);
    window.ctx.fillStyle = '#654321'; window.ctx.fillRect(Math.max(window.camera.x, window.game.shoreX), window.game.groundLevel + 10, window.canvas.width, window.canvas.height - window.game.groundLevel - 10);
    
    if (window.camera.x < window.game.shoreX) {
        window.ctx.fillStyle = '#E2D2A0'; window.ctx.fillRect(window.game.shoreX - 60, window.game.groundLevel, 60, window.canvas.height - window.game.groundLevel);
        let waveOffset = Math.sin(window.game.frameCount * 0.03) * 5;
        window.ctx.fillStyle = '#0a5c8a'; window.ctx.fillRect(window.camera.x, window.game.groundLevel + 15, window.game.shoreX - 60 - window.camera.x, window.canvas.height - window.game.groundLevel - 15);
        window.ctx.fillStyle = '#1ca3ec'; window.ctx.fillRect(window.camera.x, window.game.groundLevel + 5 + waveOffset, window.game.shoreX - 60 - window.camera.x, 15 - waveOffset);
    }

    window.rocks.forEach(r => {
        if (r.x + r.width > window.camera.x && r.x < window.camera.x + window.canvas.width) {
            window.ctx.fillStyle = r.isHit ? '#ff4444' : '#666'; window.ctx.beginPath(); window.ctx.moveTo(r.x, r.y + r.height); window.ctx.lineTo(r.x + r.width * 0.2, r.y); window.ctx.lineTo(r.x + r.width * 0.8, r.y + 5); window.ctx.lineTo(r.x + r.width, r.y + r.height); window.ctx.fill();
            if (r.hp < r.maxHp) { window.ctx.fillStyle = 'black'; window.ctx.fillRect(r.x, r.y - 10, r.width, 4); window.ctx.fillStyle = '#4CAF50'; window.ctx.fillRect(r.x+1, r.y - 9, (r.hp / r.maxHp) * (r.width-2), 2); }
        }
    });

    window.trees.forEach(t => {
        if (t.x + t.width > window.camera.x && t.x < window.camera.x + window.canvas.width) {
            let isHitColor = t.isHit ? '#ff4444' : null; window.ctx.save(); window.ctx.translate(t.x + t.width/2, t.y + t.height); 
            if (t.type === 0) { 
                let trunkGrad = window.ctx.createLinearGradient(-t.width/2, 0, t.width/2, 0); trunkGrad.addColorStop(0, '#3E2723'); trunkGrad.addColorStop(1, '#5D4037');
                window.ctx.fillStyle = isHitColor || trunkGrad; window.ctx.fillRect(-t.width/2+4, -t.height, t.width-8, t.height); 
                window.ctx.fillStyle = isHitColor || '#388E3C'; window.ctx.beginPath(); window.ctx.arc(0, -t.height+20, 40, 0, Math.PI*2); window.ctx.arc(-20, -t.height+50, 35, 0, Math.PI*2); window.ctx.arc(20, -t.height+50, 35, 0, Math.PI*2); window.ctx.fill();
                window.ctx.fillStyle = isHitColor || '#4CAF50'; window.ctx.beginPath(); window.ctx.arc(0, -t.height+10, 30, 0, Math.PI*2); window.ctx.arc(-10, -t.height+40, 25, 0, Math.PI*2); window.ctx.fill();
            } else if (t.type === 1) { 
                window.ctx.fillStyle = isHitColor || '#3E2723'; window.ctx.fillRect(-t.width/2+6, -t.height, t.width-12, t.height);
                window.ctx.fillStyle = isHitColor || '#1B5E20'; for(let i=0; i<4; i++) { window.ctx.beginPath(); window.ctx.moveTo(0, -t.height - 20 + (i*25)); window.ctx.lineTo(-30 + (i*5), -t.height + 40 + (i*25)); window.ctx.lineTo(30 - (i*5), -t.height + 40 + (i*25)); window.ctx.fill(); }
            } else if (t.type === 2) { 
                window.ctx.fillStyle = isHitColor || '#D7CCC8'; window.ctx.fillRect(-t.width/2+4, -t.height, t.width-8, t.height);
                if(!t.isHit) { window.ctx.fillStyle = '#4E342E'; window.ctx.fillRect(-t.width/2+4, -t.height+30, 8, 3); window.ctx.fillRect(-t.width/2+8, -t.height+70, 10, 4); }
                window.ctx.fillStyle = isHitColor || '#8BC34A'; window.ctx.beginPath(); window.ctx.arc(0, -t.height+10, 35, 0, Math.PI*2); window.ctx.fill(); window.ctx.beginPath(); window.ctx.arc(-15, -t.height+35, 30, 0, Math.PI*2); window.ctx.arc(15, -t.height+35, 30, 0, Math.PI*2); window.ctx.fill();
            }
            if (t.hp < t.maxHp) { window.ctx.fillStyle = 'black'; window.ctx.fillRect(-t.width/2-5, -t.height - 20, t.width + 10, 6); window.ctx.fillStyle = '#4CAF50'; window.ctx.fillRect(-t.width/2-4, -t.height - 19, (t.hp / t.maxHp) * (t.width + 8), 4); }
            window.ctx.restore();
        }
    });

    window.droppedItems.forEach(item => {
        if (item.x + 20 > window.camera.x && item.x < window.camera.x + window.canvas.width) {
            window.ctx.fillStyle = window.itemDefs[item.type].color; let s = window.itemDefs[item.type].size; let floatOffset = Math.sin(item.life) * 3; window.ctx.fillRect(item.x, item.y + floatOffset, s, s);
        }
    });

    if (window.game.isMultiplayer) Object.values(window.otherPlayers).forEach(p => { if (p.x > window.camera.x - 50 && p.x < window.camera.x + window.canvas.width + 50) window.drawCharacter(p, false); });
    if (!window.player.inBackground) window.drawCharacter(window.player, true);

    window.entities.forEach(ent => {
        if (ent.x + ent.width > window.camera.x && ent.x < window.camera.x + window.canvas.width) {
            if (ent.type === 'chicken') {
                window.ctx.fillStyle = ent.isHit ? '#ff4444' : '#fff'; window.ctx.fillRect(ent.x, ent.y, ent.width, ent.height);
                if(!ent.isHit) { window.ctx.fillStyle = '#ff0000'; window.ctx.fillRect(ent.x + (ent.vx > 0 ? ent.width : -4), ent.y, 4, 6); }
            } else if (ent.type === 'spider') {
                window.ctx.fillStyle = ent.isHit ? '#ff4444' : '#222'; window.ctx.fillRect(ent.x, ent.y, ent.width, ent.height);
                if(!ent.isHit) { window.ctx.fillStyle = '#ff0000'; let eyeSize = Math.max(2, ent.width * 0.15); let eyeX = ent.vx > 0 ? ent.x + ent.width - eyeSize - 2 : ent.x + 2; window.ctx.fillRect(eyeX, ent.y + ent.height * 0.25, eyeSize, eyeSize); }
            } else if (ent.type === 'zombie') {
                window.ctx.fillStyle = ent.isHit ? '#ff4444' : '#228b22'; window.ctx.fillRect(ent.x, ent.y, ent.width, ent.height);
                if(!ent.isHit) { window.ctx.fillStyle = '#000'; window.ctx.fillRect(ent.x + (ent.vx > 0 ? 16 : 4), ent.y + 6, 4, 4); }
            } else if (ent.type === 'archer') {
                window.ctx.fillStyle = ent.isHit ? '#ff4444' : '#8e44ad'; window.ctx.fillRect(ent.x, ent.y, ent.width, ent.height);
                window.ctx.save(); let isFacingR = ent.vx >= 0; if (ent.attackCooldown < 100) isFacingR = window.player.x > ent.x; 
                window.ctx.translate(ent.x + ent.width/2, ent.y + ent.height/2); if (!isFacingR) window.ctx.scale(-1, 1);
                window.ctx.strokeStyle = '#8B4513'; window.ctx.lineWidth = 2; window.ctx.beginPath(); window.ctx.arc(8, 0, 10, -Math.PI/2.5, Math.PI/2.5); window.ctx.stroke(); window.ctx.restore();
            }
        }
    });

    window.blocks.forEach(b => {
        if (b.x + window.game.blockSize > window.camera.x && b.x < window.camera.x + window.canvas.width) {
            if (b.type === 'block') {
                window.ctx.fillStyle = b.isHit ? '#ff4444' : '#C19A6B'; window.ctx.fillRect(b.x, b.y, window.game.blockSize, window.game.blockSize);
                window.ctx.strokeStyle = '#8B5A2B'; window.ctx.lineWidth = 2; window.ctx.strokeRect(b.x, b.y, window.game.blockSize, window.game.blockSize);
            } else if (b.type === 'door') {
                if (b.open) { window.ctx.fillStyle = '#3a2518'; window.ctx.fillRect(b.x + 12, b.y, 6, window.game.blockSize * 2); } 
                else { window.ctx.fillStyle = b.isHit ? '#ff4444' : '#5C4033'; window.ctx.fillRect(b.x + 4, b.y, 22, window.game.blockSize * 2); window.ctx.fillStyle = '#FFD700'; window.ctx.fillRect(b.x + 20, b.y + window.game.blockSize, 4, 4); }
            } else if (b.type === 'box') {
                window.ctx.fillStyle = b.isHit ? '#ff4444' : '#8B4513'; window.ctx.fillRect(b.x + 2, b.y + 10, window.game.blockSize - 4, window.game.blockSize - 10);
                window.ctx.fillStyle = '#C19A6B'; window.ctx.fillRect(b.x, b.y + 10, window.game.blockSize, 4); window.ctx.fillStyle = '#333'; window.ctx.fillRect(b.x + window.game.blockSize/2 - 2, b.y + 12, 4, 6);
            } else if (b.type === 'campfire') {
                window.ctx.fillStyle = '#5c4033'; window.ctx.fillRect(b.x + 2, b.y + 20, 26, 10); window.ctx.fillStyle = '#3e2723'; window.ctx.fillRect(b.x + 10, b.y + 15, 10, 15);
                if (b.isBurning) {
                    window.ctx.fillStyle = '#e67e22'; window.ctx.beginPath(); window.ctx.moveTo(b.x+5, b.y+20); window.ctx.lineTo(b.x+15, b.y+Math.random()*10); window.ctx.lineTo(b.x+25, b.y+20); window.ctx.fill();
                    window.ctx.fillStyle = '#f1c40f'; window.ctx.beginPath(); window.ctx.moveTo(b.x+10, b.y+20); window.ctx.lineTo(b.x+15, b.y+10+Math.random()*5); window.ctx.lineTo(b.x+20, b.y+20); window.ctx.fill();
                }
            } else if (b.type === 'bed') {
                window.ctx.fillStyle = b.isHit ? '#ff4444' : '#8B4513'; window.ctx.fillRect(b.x, b.y + 20, 30, 10);
                window.ctx.fillStyle = b.isHit ? '#ff4444' : '#5C4033'; window.ctx.fillRect(b.x, b.y + 20, 4, 10); window.ctx.fillRect(b.x + 26, b.y + 20, 4, 10);
                window.ctx.fillStyle = '#e0e0e0'; window.ctx.fillRect(b.x + 2, b.y + 16, 10, 4);
                window.ctx.fillStyle = '#c0392b'; window.ctx.fillRect(b.x + 12, b.y + 16, 18, 4);
            }
        }
    });

    if (window.player.placementMode && !window.player.isDead) {
        const gridX = Math.floor(window.mouseWorldX / window.game.blockSize) * window.game.blockSize; const gridY = Math.floor(window.mouseWorldY / window.game.blockSize) * window.game.blockSize;
        window.ctx.globalAlpha = 0.6;
        if (window.player.placementMode === 'boxes') { window.ctx.fillStyle = '#8B4513'; window.ctx.fillRect(gridX + 2, gridY + 10, window.game.blockSize - 4, window.game.blockSize - 10); } 
        else if (window.player.placementMode === 'campfire_item') { window.ctx.fillStyle = '#5c4033'; window.ctx.fillRect(gridX + 2, gridY + 20, 26, 10); }
        else if (window.player.placementMode === 'bed_item') { window.ctx.fillStyle = '#8B4513'; window.ctx.fillRect(gridX, gridY + 20, 30, 10); window.ctx.fillStyle = '#e0e0e0'; window.ctx.fillRect(gridX + 2, gridY + 16, 10, 4); window.ctx.fillStyle = '#c0392b'; window.ctx.fillRect(gridX + 12, gridY + 16, 18, 4); }
        window.ctx.strokeStyle = '#FFD700'; window.ctx.lineWidth = 2; window.ctx.strokeRect(gridX, gridY, window.game.blockSize, window.game.blockSize); window.ctx.globalAlpha = 1.0;
    }

    if (window.player.activeTool === 'bow' && window.player.isAiming && window.player.isCharging && window.player.inventory.arrows > 0 && !window.player.isDead) {
        let pCX = window.player.x + window.player.width/2; let pCY = window.player.y + window.player.height/2;
        let dx = window.mouseWorldX - pCX; let dy = window.mouseWorldY - pCY; let angle = Math.atan2(dy, dx);
        let power = 4 + (window.player.chargeLevel / 100) * 6; let vx = Math.cos(angle) * power; let vy = Math.sin(angle) * power;
        window.ctx.save(); window.ctx.lineWidth = 2; window.ctx.setLineDash([6, 4]); 
        let simX = pCX; let simY = pCY; let simVy = vy; let pointsToDraw = Math.floor(10 + (window.player.chargeLevel / 100) * 30); 
        window.ctx.beginPath(); window.ctx.moveTo(pCX, pCY);
        for(let i=0; i<pointsToDraw; i++) { simX += vx; simVy += window.game.gravity * 0.4; simY += simVy; window.ctx.lineTo(simX, simY); }
        let grad = window.ctx.createLinearGradient(pCX, pCY, simX, simY);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)'); grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        window.ctx.strokeStyle = grad; window.ctx.stroke(); window.ctx.setLineDash([]); window.ctx.restore();
    }

    window.projectiles.forEach(pr => {
        if (pr.x + 20 > window.camera.x && pr.x - 20 < window.camera.x + window.canvas.width) {
            window.ctx.save(); window.ctx.translate(pr.x, pr.y); window.ctx.rotate(pr.angle);
            if (pr.isEnemy) { window.ctx.fillStyle = '#ff4444'; window.ctx.fillRect(-15, -1, 20, 2); window.ctx.fillStyle = '#000'; window.ctx.fillRect(5, -2, 4, 4); } 
            else { window.ctx.fillStyle = '#eee'; window.ctx.fillRect(-15, -1, 20, 2); window.ctx.fillStyle = '#666'; window.ctx.fillRect(5, -2, 4, 4); window.ctx.fillStyle = '#fff'; window.ctx.fillRect(-17, -2, 4, 4); }
            window.ctx.restore();
        }
    });

    window.particles.forEach(p => { window.ctx.globalAlpha = Math.max(0, Math.min(1, p.life)); window.ctx.fillStyle = p.color; window.ctx.fillRect(p.x, p.y, p.size, p.size); });
    window.damageTexts.forEach(dt => { window.ctx.globalAlpha = Math.max(0, Math.min(1, dt.life)); window.ctx.fillStyle = dt.color; window.ctx.font = 'bold 18px Inter, sans-serif'; window.ctx.fillText(dt.text, dt.x, dt.y); });
    window.ctx.globalAlpha = 1.0; window.ctx.restore(); 

    if (window.lightCtx) {
        window.lightCtx.clearRect(0, 0, window.canvas.width, window.canvas.height);
        let ambientDarkness = 0.2 + (0.75 * darkness); 
        window.lightCtx.fillStyle = `rgba(5, 5, 10, ${ambientDarkness})`; window.lightCtx.fillRect(0, 0, window.canvas.width, window.canvas.height);
        window.lightCtx.fillStyle = 'rgba(5, 5, 10, 0.95)'; 
        for (let x = Math.floor(window.camera.x / 30) * 30; x < window.camera.x + window.canvas.width + 30; x += 30) {
            let blocksInCol = window.getBlocksForCol(x);
            if (blocksInCol.length > 0) { let shadowStartY = Math.min(...blocksInCol.map(b => b.y)); window.lightCtx.fillRect(x - window.camera.x, shadowStartY + 30 - window.camera.y, 30, window.canvas.height); }
        }
        window.lightCtx.globalCompositeOperation = 'destination-out';
        
        if (!window.player.isDead) {
            let pGlowSize = window.player.isStealth ? 80 : 160 + (60 * darkness); 
            let pGrad = window.lightCtx.createRadialGradient(window.player.x + window.player.width/2 - window.camera.x, window.player.y + window.player.height/2 - window.camera.y, 0, window.player.x + window.player.width/2 - window.camera.x, window.player.y + window.player.height/2 - window.camera.y, pGlowSize);
            pGrad.addColorStop(0, window.player.isStealth ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 1)'); pGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            window.lightCtx.fillStyle = pGrad; window.lightCtx.beginPath(); window.lightCtx.arc(window.player.x + window.player.width/2 - window.camera.x, window.player.y + window.player.height/2 - window.camera.y, pGlowSize, 0, Math.PI*2); window.lightCtx.fill();
        }

        window.blocks.forEach(b => {
            if (b.type === 'campfire' && b.isBurning) {
                let glow = 250 + Math.random()*10; 
                let cGrad = window.lightCtx.createRadialGradient(b.x+15 - window.camera.x, b.y+15 - window.camera.y, 0, b.x+15 - window.camera.x, b.y+15 - window.camera.y, glow);
                cGrad.addColorStop(0, 'rgba(255, 200, 100, 0.8)'); cGrad.addColorStop(1, 'rgba(255, 200, 100, 0)');
                window.lightCtx.fillStyle = cGrad; window.lightCtx.beginPath(); window.lightCtx.arc(b.x+15 - window.camera.x, b.y+15 - window.camera.y, glow, 0, Math.PI*2); window.lightCtx.fill();
            }
        });
        window.lightCtx.globalCompositeOperation = 'source-over'; 
        window.ctx.drawImage(window.lightCanvas, 0, 0);
    }

    // UI NOMBRES Y CHAT (ARREGLADO Y CON RESTRICCIÓN DE DISTANCIA)
    window.ctx.save(); window.ctx.translate(-window.camera.x, -window.camera.y);
    const drawNameAndChat = (charData, isLocal) => {
        if (charData.isDead) return;
        
        // No dibujar nombres si están a más de 500 píxeles de distancia (1 pantalla apróx)
        if (!isLocal) {
            let dist = Math.hypot(window.player.x - charData.x, window.player.y - charData.y);
            if (dist > 500) return;
        }

        const pCX = charData.x + (charData.width || 24) / 2; 
        const pCY = charData.y + (charData.height || 48); 
        const bob = Math.abs(Math.sin((charData.renderAnimTime || 0) * 3)) * 3; 

        // Altura correcta por encima de la nueva cabeza
        const nameY = pCY - 80 - bob;
        const chatY = pCY - 110 - bob;

        if (!isLocal) {
            window.ctx.fillStyle = 'rgba(255,255,255,0.9)'; window.ctx.font = 'bold 12px Inter, sans-serif'; window.ctx.textAlign = 'center'; 
            window.ctx.fillText(charData.name, pCX, nameY);
        }

        if (charData.chatExpires && Date.now() < charData.chatExpires && charData.chatText) {
            window.ctx.font = 'bold 13px Inter, sans-serif';
            let tW = window.ctx.measureText(charData.chatText).width;
            window.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            window.ctx.fillRect(pCX - tW/2 - 8, chatY - 15, tW + 16, 24);
            window.ctx.fillStyle = '#fff';
            window.ctx.textAlign = 'center';
            window.ctx.fillText(charData.chatText, pCX, chatY + 2);
        }
    };
    if (window.game.isMultiplayer) Object.values(window.otherPlayers).forEach(p => drawNameAndChat(p, false));
    if (!window.player.inBackground) drawNameAndChat(window.player, true);
    window.ctx.restore();
};
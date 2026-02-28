// === render_character.js - DIBUJADO DE PERSONAJES Y ANIMACIÓN RIG ===
// Extraído de render.js. Contiene drawCharacter() y roundRect().
// Depende de: window.ctx, window.game, window.player, window.mouseWorldX/Y


window.initRenderCaches = function() {}; 

window.roundRect = function(ctx, x, y, width, height, radius) {
    ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.lineTo(x + width - radius, y); ctx.quadraticCurveTo(x + width, y, x + width, y + radius); ctx.lineTo(x + width, y + height - radius); ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height); ctx.lineTo(x + radius, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - radius); ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y); ctx.closePath(); ctx.fill();
};

window.drawCharacter = function(charData, isLocal) {
    if (!window.ctx) return;

    if (charData.isDead) {
        const daf = charData.deathAnimFrame !== undefined ? charData.deathAnimFrame : 0;
        if (daf <= 0 && !isLocal) return; 
        if (isLocal && daf <= 0) return;  

        window.ctx.save();
        const pCX = charData.x + (charData.width || 24) / 2;
        const pCY = charData.y + (charData.height || 40);
        window.ctx.translate(pCX, pCY);
        window.ctx.scale(0.78, 0.78);
        if (!charData.facingRight) window.ctx.scale(-1, 1);

        const maxFrames = 40;
        const t = Math.max(0, Math.min(1, 1 - daf / maxFrames));
        const fallAngle = t * (-Math.PI / 2);
        const fallY = t * 20; 

        window.ctx.translate(0, fallY);
        window.ctx.rotate(fallAngle);

        window.ctx.globalAlpha = Math.max(0.4, 1 - t * 0.4);
        const skin = '#cc8855'; const shirt = isLocal ? '#1a5c8a' : '#404040';
        window.ctx.fillStyle = '#1a252f'; window.roundRect(window.ctx, -12, -10, 24, 10, 3);
        window.ctx.fillStyle = shirt; window.roundRect(window.ctx, -10, -30, 20, 22, 5);
        window.ctx.fillStyle = skin; window.roundRect(window.ctx, -9, -48, 18, 18, 7);
        window.ctx.strokeStyle = '#333'; window.ctx.lineWidth = 1.5;
        window.ctx.beginPath();
        window.ctx.moveTo(-3, -42); window.ctx.lineTo(-1, -40); window.ctx.moveTo(-1, -42); window.ctx.lineTo(-3, -40);
        window.ctx.moveTo(3, -42); window.ctx.lineTo(5, -40); window.ctx.moveTo(5, -42); window.ctx.lineTo(3, -40);
        window.ctx.stroke();
        window.ctx.globalAlpha = 1; window.ctx.restore();
        return;
    }
    window.ctx.save();
    
    const pCX = charData.x + (charData.width || 24) / 2;
    const pCY = charData.y + (charData.height || 40); 
    window.ctx.translate(pCX, pCY);
    
    // Escala visual del personaje: sprite dibujado es ~50px, lo reducimos para que sea proporcional
    window.ctx.scale(0.78, 0.78);

    if (isLocal && charData.isStealth) { window.ctx.globalAlpha = 0.3; } 
    else if (charData.inBackground) { window.ctx.globalAlpha = 0.5; window.ctx.scale(0.9, 0.9); }

    let targetX = isLocal ? window.mouseWorldX : (charData.mouseX || pCX);
    let targetY = isLocal ? window.mouseWorldY : (charData.mouseY || pCY);
    let isFacingR = charData.facingRight; 
    if (charData.activeTool === 'bow' && charData.isAiming) isFacingR = targetX >= pCX;
    if (!isFacingR) window.ctx.scale(-1, 1); 
    
    let isJumping = false; let isRunning = false; let isClimbing = false;
    
    if (isLocal) {
        isClimbing = charData.isClimbing && !charData.isGrounded;
        isJumping = !charData.isGrounded && !isClimbing;
        const isMovingH = Math.abs(charData.vx || 0) > 0.1 && !isJumping && !isClimbing;
        isRunning = isMovingH && !!(charData.isSprinting);
        window._charIsWalking = isMovingH && !isRunning; // flag para animación caminata
        charData.renderAnimTime = charData.animTime; 
    } else {
        isClimbing = charData.isClimbing || false;
        // Usar vx/vy/isGrounded recibidos por red en vez de calcular delta-Y localmente
        // Así el terreno ondulado no confunde caminar con saltar
        const remVx = charData.vx || 0;
        const remVy = charData.vy || 0;
        const remGrounded = charData.isGrounded || false;
        isJumping = !remGrounded && Math.abs(remVy) > 1.5 && !isClimbing;
        isRunning = Math.abs(remVx) > 0.1 && !isJumping && !isClimbing;
        if (isRunning || isClimbing) charData.renderAnimTime = (charData.renderAnimTime || 0) + Math.abs(remVx) * 0.025;
        else if (!isJumping) charData.renderAnimTime = 0;
    }

    let time = (charData.renderAnimTime || 0) * 1.0; 
    let legR = 0, legL = 0, kneeR = 0, kneeL = 0, armR = 0, armL = 0, elbowR = 0, elbowL = 0, torsoR = 0, headR = 0, bob = 0;

    if (isJumping) {
        legR = -0.5; kneeR = 0.8; legL = 0.3; kneeL = 0.1; armR = -2.5; elbowR = -0.2; armL = -1.5; elbowL = -0.5; torsoR = 0.1; headR = -0.2; bob = -4;
    } else if (isRunning) {
        // Sprint: pasos amplios y rápidos
        legR = Math.sin(time) * 1.0; kneeR = Math.max(0, Math.sin(time - Math.PI/2) * 1.5); legL = Math.sin(time + Math.PI) * 1.0; kneeL = Math.max(0, Math.sin(time + Math.PI/2) * 1.5);
        armR = Math.cos(time) * 1.0; elbowR = -0.2 + Math.sin(time)*0.4; armL = Math.cos(time + Math.PI) * 1.0; elbowL = -0.2 + Math.sin(time + Math.PI)*0.4;
        torsoR = 0.15; headR = -0.05; bob = Math.abs(Math.sin(time * 2)) * 3;
    } else if (window._charIsWalking) {
        // Caminata: pasos más cortos y suaves, sin torso inclinado
        legR = Math.sin(time) * 0.55; kneeR = Math.max(0, Math.sin(time - Math.PI/2) * 0.7); legL = Math.sin(time + Math.PI) * 0.55; kneeL = Math.max(0, Math.sin(time + Math.PI/2) * 0.7);
        armR = Math.cos(time) * 0.45; elbowR = -0.1 + Math.sin(time)*0.15; armL = Math.cos(time + Math.PI) * 0.45; elbowL = -0.1 + Math.sin(time + Math.PI)*0.15;
        torsoR = 0.04; headR = 0; bob = Math.abs(Math.sin(time * 2)) * 1.2;
    } else {
        let idleTime = window.game.frameCount * 0.03; torsoR = Math.sin(idleTime) * 0.02; headR = Math.sin(idleTime - 1) * 0.03; armR = 0.1 + Math.sin(idleTime) * 0.03; armL = -0.1 - Math.sin(idleTime) * 0.03; elbowR = -0.1; elbowL = -0.1; bob = Math.sin(idleTime) * 1;
    }

    let aimAngle = 0;
    if (charData.isDancing) {
        const dt = (window.game.frameCount - (charData.danceStart || 0)) * 0.07;
        legR   =  Math.sin(dt * 2.1) * 1.2; kneeR  =  Math.max(0, Math.sin(dt * 2.1 - 0.8) * 1.8);
        legL   =  Math.sin(dt * 2.1 + Math.PI) * 1.2; kneeL  =  Math.max(0, Math.sin(dt * 2.1 + Math.PI - 0.8) * 1.8);
        armR   = -Math.PI * 0.5 + Math.sin(dt * 1.7) * 0.9; elbowR =  Math.cos(dt * 2.3) * 0.7 - 0.3;
        armL   = -Math.PI * 0.3 + Math.sin(dt * 1.7 + Math.PI) * 0.9; elbowL =  Math.cos(dt * 2.3 + Math.PI) * 0.7 - 0.3;
        torsoR =  Math.sin(dt * 1.4) * 0.25; headR  =  Math.sin(dt * 0.9 + 0.5) * 0.18; bob    =  Math.abs(Math.sin(dt * 2.1)) * 6;
    }

    // --- ANIMACIÓN DE ESCALADA (sobrescribe todo lo anterior si aplica) ---
    if (isClimbing) {
        // Avanzar timer solo si se está moviendo verticalmente
        const isMovingOnLadder = isLocal 
            ? Math.abs(charData.vy || 0) > 0.5
            : Math.abs((charData.y || 0) - (charData._climbLastY || charData.y)) > 0.15;
        if (!isLocal) charData._climbLastY = charData.y;
        
        if (isMovingOnLadder) {
            charData._climbAnim = ((charData._climbAnim || 0) + 0.07) % (Math.PI * 2);
        }
        const ct = charData._climbAnim || 0;
        
        // Brazos: alternando hacia arriba como si agarraran peldaños
        armR = -Math.PI * 0.55 + Math.sin(ct) * 0.4;
        armL = -Math.PI * 0.55 + Math.sin(ct + Math.PI) * 0.4;
        elbowR = 0.5 + Math.sin(ct) * 0.2;
        elbowL = 0.5 + Math.sin(ct + Math.PI) * 0.2;
        // Piernas: ligera flexión alterna, movimiento sutil
        legR = Math.sin(ct + Math.PI) * 0.25; kneeR = Math.max(0, Math.sin(ct + Math.PI) * 0.45);
        legL = Math.sin(ct) * 0.25;           kneeL = Math.max(0, Math.sin(ct) * 0.45);
        torsoR = 0; headR = 0.05; bob = 0;
    }

    if (!isClimbing) {
    if (charData.activeTool === 'torch') {
        armR = -Math.PI / 2.5; elbowR = -0.3; 
    } else if (charData.activeTool === 'bow' && charData.isAiming) {
        aimAngle = Math.atan2(targetY - (pCY - 42 - bob), isFacingR ? (targetX - pCX) : -(targetX - pCX));
        armR = aimAngle - Math.PI/2; elbowR = 0; armL = aimAngle - Math.PI/2 + 0.3; elbowL = -1.5; torsoR = aimAngle * 0.2; headR = aimAngle * 0.3;
    } else if (charData.attackFrame > 0) {
        let progress = charData.attackFrame / 30; armR = -Math.PI * 0.9 * progress + (1 - progress) * 0.8; elbowR = -0.2; torsoR += 0.3 * progress; 
    }
    } // end !isClimbing

    let skin = charData.isHit ? '#ff4444' : (charData.pvpHitFlash ? '#ff6600' : '#f1c27d');
    let shirt = charData.isHit ? '#ff4444' : (charData.pvpHitFlash ? '#ff6600' : (isLocal ? '#3498db' : '#686868'));
    let shirtDark = charData.isHit ? '#cc0000' : (charData.pvpHitFlash ? '#cc3300' : (isLocal ? '#2980b9' : '#4a4a4a'));
    let pants = '#2c3e50'; let pantsDark = '#1a252f'; let shoes = '#222'; let shoesDark = '#111';
    if (charData.inBackground) { skin='#888'; shirt='#666'; shirtDark='#555'; pants='#444'; pantsDark='#333'; }

    window.ctx.translate(0, -bob);

    window.ctx.save(); window.ctx.translate(-3, -24); window.ctx.rotate(legL); window.ctx.fillStyle = pantsDark; window.roundRect(window.ctx, -4.5, 0, 9, 14, 4); window.ctx.translate(0, 12); window.ctx.rotate(kneeL); window.ctx.fillStyle = pantsDark; window.roundRect(window.ctx, -3.5, 0, 7, 14, 3); window.ctx.fillStyle = shoesDark; window.roundRect(window.ctx, -4.5, 12, 11, 5, 2); window.ctx.restore();
    window.ctx.save(); window.ctx.translate(0, -24); window.ctx.rotate(torsoR); window.ctx.save(); window.ctx.translate(2, -20); window.ctx.rotate(armL); window.ctx.fillStyle = shirtDark; window.roundRect(window.ctx, -3.5, 0, 7, 12, 3); window.ctx.translate(0, 10); window.ctx.rotate(elbowL); window.ctx.fillStyle = skin; window.roundRect(window.ctx, -2.5, 0, 5, 10, 2); window.ctx.restore(); window.ctx.fillStyle = isClimbing ? shirtDark : shirt; window.roundRect(window.ctx, -9, -22, 18, 24, 6); window.ctx.save(); window.ctx.translate(0, -24); window.ctx.rotate(headR);
    if (isClimbing) {
        // Vista trasera (nuca) cuando escala
        window.ctx.fillStyle = '#3E2723'; window.roundRect(window.ctx, -10, -18, 20, 18, 8); // cabello cubre toda la cabeza
        window.ctx.fillStyle = skin; window.roundRect(window.ctx, -7, -4, 14, 4, 2); // pequeña franja de piel (nuca)
    } else {
        window.ctx.fillStyle = skin; window.roundRect(window.ctx, -10, -18, 20, 20, 8); window.ctx.fillStyle = '#333'; window.ctx.fillRect(4, -10, 3, 4); window.ctx.fillStyle = '#3E2723'; window.ctx.beginPath(); window.ctx.arc(0, -14, 11, Math.PI, 0); window.ctx.fill();
    }
    window.ctx.restore(); window.ctx.restore();
    window.ctx.save(); window.ctx.translate(3, -24); window.ctx.rotate(legR); window.ctx.fillStyle = pants; window.roundRect(window.ctx, -4.5, 0, 9, 14, 4); window.ctx.translate(0, 12); window.ctx.rotate(kneeR); window.ctx.fillStyle = pants; window.roundRect(window.ctx, -3.5, 0, 7, 14, 3); window.ctx.fillStyle = shoes; window.roundRect(window.ctx, -4.5, 12, 11, 5, 2); window.ctx.restore();
    window.ctx.save(); window.ctx.translate(0, -24); window.ctx.rotate(torsoR); window.ctx.translate(-3, -20); window.ctx.rotate(armR); window.ctx.fillStyle = shirt; window.roundRect(window.ctx, -3.5, 0, 7, 12, 3); window.ctx.translate(0, 10); window.ctx.rotate(elbowR); window.ctx.fillStyle = skin; window.roundRect(window.ctx, -2.5, 0, 5, 10, 2);
    
    window.ctx.translate(0, 8); 
    if (!isClimbing && charData.activeTool === 'bow') {
        window.ctx.rotate(Math.PI/2); window.ctx.strokeStyle = charData.inBackground ? '#4a250a' : '#8B4513'; window.ctx.lineWidth = 3; window.ctx.beginPath(); window.ctx.arc(0, 0, 15, -Math.PI/2.5, Math.PI/2.5); window.ctx.stroke();
        let pull = charData.isAiming ? ((charData.chargeLevel || 0) / 100) * 15 : 0; window.ctx.strokeStyle = '#eee'; window.ctx.lineWidth = 1; window.ctx.beginPath(); window.ctx.moveTo(4.6, -14.2); window.ctx.lineTo(4.6 - pull, 0); window.ctx.lineTo(4.6, 14.2); window.ctx.stroke();
        if (charData.isCharging && (isLocal ? charData.inventory.arrows > 0 : true)) { window.ctx.fillStyle = '#eee'; window.ctx.fillRect(4.6 - pull, -1, 20 + pull, 2); window.ctx.fillStyle = '#666'; window.ctx.fillRect(4.6 - pull + 20 + pull, -2, 4, 4); }
    } else if (!isClimbing && charData.activeTool === 'torch') {
        window.ctx.rotate(Math.PI/2); window.ctx.fillStyle = charData.inBackground ? '#4a250a' : '#8B4513'; window.ctx.fillRect(-2, -20, 4, 25); let fSize = 5 + Math.random() * 3;
        window.ctx.fillStyle = charData.inBackground ? '#888' : '#e67e22'; window.ctx.beginPath(); window.ctx.arc(0, -22, fSize, 0, Math.PI*2); window.ctx.fill();
        window.ctx.fillStyle = charData.inBackground ? '#aaa' : '#f1c40f'; window.ctx.beginPath(); window.ctx.arc(0, -22, fSize*0.6, 0, Math.PI*2); window.ctx.fill();
    } else if (!isClimbing && charData.activeTool && charData.activeTool !== 'hand') {
        window.ctx.rotate(Math.PI/2); 
        if (charData.activeTool === 'axe' || charData.activeTool === 'hammer' || charData.activeTool === 'pickaxe') {
            window.ctx.fillStyle = charData.inBackground ? '#4a250a' : '#8B4513'; window.ctx.fillRect(-2, -20, 4, 28); window.ctx.fillStyle = charData.inBackground ? '#666' : '#444'; 
            if (charData.activeTool === 'axe') { window.ctx.fillStyle = '#AAA'; window.ctx.fillRect(-10, -22, 14, 10); } else if (charData.activeTool === 'pickaxe') { window.ctx.fillStyle = '#999'; window.ctx.beginPath(); window.ctx.moveTo(0,-24); window.ctx.lineTo(14,-16); window.ctx.lineTo(-14,-16); window.ctx.fill(); } else { window.ctx.fillRect(-6, -22, 12, 10); } 
        } else if (charData.activeTool === 'sword') {
            window.ctx.fillStyle = '#8B4513'; window.ctx.fillRect(-2, -5, 4, 10); window.ctx.fillStyle = '#FFD700'; window.ctx.fillRect(-6, -7, 12, 4); window.ctx.fillRect(-3, 3, 6, 2); window.ctx.fillStyle = '#E0E0E0'; window.ctx.beginPath(); window.ctx.moveTo(-3,-7); window.ctx.lineTo(3,-7); window.ctx.lineTo(0,-30); window.ctx.fill(); 
        }
    }
    window.ctx.restore(); window.ctx.restore(); 
};


// === render.js - LÓGICA DE DIBUJADO Y RIGGING ===

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
        isRunning = Math.abs(charData.vx || 0) > 0.1 && !isJumping && !isClimbing;
        charData.renderAnimTime = charData.animTime; 
    } else {
        isClimbing = charData.isClimbing || false;
        let dx = Math.abs(charData.x - (charData.lastX || charData.x)); charData.lastX = charData.x;
        if (dx > 0.1) charData.isMovingFrames = 10; else if (charData.isMovingFrames > 0) charData.isMovingFrames--;
        let dy = charData.y - (charData.lastY || charData.y); charData.lastY = charData.y;
        if (Math.abs(dy) > 0.5 && !isClimbing) charData.isJumpingFrames = 10; else if (charData.isJumpingFrames > 0) charData.isJumpingFrames--;
        isJumping = charData.isJumpingFrames > 0 && !isClimbing; isRunning = charData.isMovingFrames > 0 && !isJumping && !isClimbing;
        if (isRunning || isClimbing) charData.renderAnimTime = (charData.renderAnimTime || 0) + 0.033; 
        else charData.renderAnimTime = 0;
    }

    let time = (charData.renderAnimTime || 0) * 1.0; 
    let legR = 0, legL = 0, kneeR = 0, kneeL = 0, armR = 0, armL = 0, elbowR = 0, elbowL = 0, torsoR = 0, headR = 0, bob = 0;

    if (isJumping) {
        legR = -0.5; kneeR = 0.8; legL = 0.3; kneeL = 0.1; armR = -2.5; elbowR = -0.2; armL = -1.5; elbowL = -0.5; torsoR = 0.1; headR = -0.2; bob = -4;
    } else if (isRunning) {
        legR = Math.sin(time) * 1.0; kneeR = Math.max(0, Math.sin(time - Math.PI/2) * 1.5); legL = Math.sin(time + Math.PI) * 1.0; kneeL = Math.max(0, Math.sin(time + Math.PI/2) * 1.5);
        armR = Math.cos(time) * 1.0; elbowR = -0.2 + Math.sin(time)*0.4; armL = Math.cos(time + Math.PI) * 1.0; elbowL = -0.2 + Math.sin(time + Math.PI)*0.4;
        torsoR = 0.15; headR = -0.05; bob = Math.abs(Math.sin(time * 2)) * 3;
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

window.draw = function() {
    if (!window.ctx) return;
    const W = window._canvasLogicW || 1280;
    const H = window._canvasLogicH || 720;
    if (!window.game.isRunning) { window.ctx.fillStyle = '#050505'; window.ctx.fillRect(0, 0, W, H); return; }

    let currentUptime = window.game.serverStartTime ? (Date.now() - window.game.serverStartTime) : (window.game.frameCount * (1000/60));
    let totalFrames = Math.floor(currentUptime / (1000 / 60)) + 28800; 
    let hourFloat = (totalFrames / 3600) % 24; 
    
    // El día brillante (Darkness en 0 la mayor parte del día)
    let rawDarkness = (Math.cos((hourFloat / 24) * Math.PI * 2) + 1) / 2;
    let darkness = Math.max(0, (rawDarkness - 0.25) * 1.4); 

    let r = Math.floor(165 - (148 * darkness));
    let g = Math.floor(220 - (202 * darkness));
    let b = Math.floor(255 - (225 * darkness));
    
    if (darkness > 0.6) {
        const nightBlend = (darkness - 0.6) / 0.4;
        r = Math.max(r, Math.floor(8  + 22 * (1-nightBlend)));
        g = Math.max(g, Math.floor(12 + 28 * (1-nightBlend)));
        b = Math.max(b, Math.floor(35 + 45 * (1-nightBlend)));
    }
    if (window.game.isRaining) { r = Math.max(28, r - 55); g = Math.max(38, g - 55); b = Math.max(55, b - 35); }

    let skyGrad = window.ctx.createLinearGradient(0, 0, 0, window.game.groundLevel);
    if (darkness < 0.3) {
        skyGrad.addColorStop(0, `rgb(${r},${g},${b})`); skyGrad.addColorStop(0.5, `rgb(${Math.min(255,r+18)},${Math.min(255,g+12)},${Math.min(255,b+5)})`); skyGrad.addColorStop(1, `rgb(${Math.min(255,r+50)},${Math.min(255,g+38)},${Math.min(255,b+18)})`);
    } else if (darkness < 0.6) {
        skyGrad.addColorStop(0, `rgb(${r},${g},${b})`); skyGrad.addColorStop(0.4, `rgb(${Math.min(255,r+50)},${Math.min(255,g+30)},${Math.min(255,b-15)})`); skyGrad.addColorStop(1, `rgb(${Math.min(255,r+100)},${Math.min(255,g+55)},${Math.min(255,b-10)})`);
    } else {
        skyGrad.addColorStop(0, `rgb(${r},${g},${b})`); skyGrad.addColorStop(0.5, `rgb(${Math.max(0,r+8)},${Math.max(0,g+8)},${Math.max(0,b+18)})`); skyGrad.addColorStop(1, `rgb(${Math.max(0,r+14)},${Math.max(0,g+12)},${Math.max(0,b+28)})`);
    }
    window.ctx.fillStyle = skyGrad; window.ctx.fillRect(0, 0, W, H);

    window.ctx.save(); 
    if (window.game.screenShake > 0) { let dx = (Math.random() - 0.5) * window.game.screenShake; let dy = (Math.random() - 0.5) * window.game.screenShake; window.ctx.translate(dx, dy); }
    
    if (darkness > 0.45 && !window.game.isRaining) {
        let starAlpha = Math.min(1, (darkness - 0.45) * 3);
        window.stars.forEach(st => { let twinkle = 0.5 + 0.5 * Math.sin(window.game.frameCount * 0.05 + st.x * 0.1); window.ctx.globalAlpha = starAlpha * (0.6 + 0.4 * twinkle); window.ctx.fillStyle = '#fff'; window.ctx.fillRect(st.x, st.y, st.s * 0.8, st.s * 0.8); });
        window.ctx.globalAlpha = 1;
    }

    if (hourFloat > 5 && hourFloat < 19) {
        let dayProgress = (hourFloat - 5) / 14; let sunX = W * dayProgress; let sunY = H * 0.8 - Math.sin(dayProgress * Math.PI) * (H * 0.7); const sunPulse = 1 + Math.sin(window.game.frameCount * 0.02) * 0.04;
        for (let r = 140; r >= 20; r -= 20) { const a = 0.03 * (1 - r/160) * sunPulse; const glowGrad = window.ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, r * 2.5); glowGrad.addColorStop(0, `rgba(255,240,100,${a * 3})`); glowGrad.addColorStop(0.4, `rgba(255,200,50,${a})`); glowGrad.addColorStop(1, 'rgba(255,180,0,0)'); window.ctx.fillStyle = glowGrad; window.ctx.beginPath(); window.ctx.arc(sunX, sunY, r * 2.5, 0, Math.PI*2); window.ctx.fill(); }
        let sunSize = 140;
        if (window.sprites.sprite_sun && window.sprites.sprite_sun.complete && window.sprites.sprite_sun.naturalWidth > 0) { window.ctx.drawImage(window.sprites.sprite_sun, sunX - sunSize/2, sunY - sunSize/2, sunSize, sunSize); } 
        else { window.ctx.fillStyle = '#FFE566'; window.ctx.beginPath(); window.ctx.arc(sunX, sunY, 42, 0, Math.PI*2); window.ctx.fill(); }
    }

    if (hourFloat >= 17 || hourFloat <= 7) {
        let nightProgress = hourFloat >= 17 ? (hourFloat - 17) / 14 : (hourFloat + 7) / 14; let moonX = W * nightProgress; let moonY = H * 0.8 - Math.sin(nightProgress * Math.PI) * (H * 0.7); const moonPulse = 1 + Math.sin(window.game.frameCount * 0.015 + 1.5) * 0.05;
        for (let r = 100; r >= 15; r -= 15) { const a = 0.025 * (1 - r/110) * moonPulse; const moonGrad = window.ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, r * 2.8); moonGrad.addColorStop(0, `rgba(200,220,255,${a * 4})`); moonGrad.addColorStop(0.4, `rgba(170,200,240,${a})`); moonGrad.addColorStop(1, 'rgba(140,170,220,0)'); window.ctx.fillStyle = moonGrad; window.ctx.beginPath(); window.ctx.arc(moonX, moonY, r * 2.8, 0, Math.PI*2); window.ctx.fill(); }
        let moonSize = 120;
        if (window.sprites.sprite_moon && window.sprites.sprite_moon.complete && window.sprites.sprite_moon.naturalWidth > 0) { window.ctx.drawImage(window.sprites.sprite_moon, moonX - moonSize/2, moonY - moonSize/2, moonSize, moonSize); } 
        else { window.ctx.fillStyle = '#E8EEE0'; window.ctx.beginPath(); window.ctx.arc(moonX, moonY, 32, 0, Math.PI*2); window.ctx.fill(); }
    }

    window.clouds.forEach(c => {
        c.x += c.v; if (c.x > W + 150) c.x = -150; let cloudAlpha = window.game.isRaining ? 0.75 : Math.max(0, 0.7 * (1 - darkness * 1.2)); if (cloudAlpha <= 0) return;
        window.ctx.save(); window.ctx.globalAlpha = cloudAlpha;
        if (window.game.isRaining) { window.ctx.filter = 'brightness(45%)'; }
        if (window.sprites.sprite_cloud.complete && window.sprites.sprite_cloud.naturalWidth > 0) { let cW = 200 * c.s; let cH = 100 * c.s; window.ctx.drawImage(window.sprites.sprite_cloud, c.x, c.y - cH/2, cW, cH); } 
        else { window.ctx.fillStyle = 'rgba(255,255,255,0.8)'; window.ctx.beginPath(); window.ctx.arc(c.x, c.y, 28*c.s, 0, Math.PI*2); window.ctx.fill(); }
        window.ctx.restore();
    });

    const bgW = 1280; const bgBackH = 500; const bgMidH  = 350;
    let backX = -(window.camera.x * 0.05) % bgW; if (backX > 0) backX -= bgW;
    let midX = -(window.camera.x * 0.15) % bgW; if (midX > 0) midX -= bgW;
    const camYOffset = window.camera.y - (window.game.baseGroundLevel - H * 0.62);
    const backY = window.game.groundLevel - bgBackH + 80 + camYOffset * 0.06;
    const midY  = window.game.groundLevel - bgMidH  + 30 + camYOffset * 0.12;

    const bgDimAlpha = darkness * 0.55;

    if (window.sprites.bg_mountains_back.complete && window.sprites.bg_mountains_back.naturalWidth > 0) { for (let i = -1; i <= Math.ceil(W / bgW) + 1; i++) { window.ctx.drawImage(window.sprites.bg_mountains_back, backX + (i * bgW), backY, bgW, bgBackH); } }
    if (bgDimAlpha > 0.04) { window.ctx.fillStyle = `rgba(5,8,20,${bgDimAlpha * 0.8})`; window.ctx.fillRect(0, backY, W, bgBackH); }

    if (window.sprites.bg_mountains_mid.complete && window.sprites.bg_mountains_mid.naturalWidth > 0) { for (let i = -1; i <= Math.ceil(W / bgW) + 1; i++) { window.ctx.drawImage(window.sprites.bg_mountains_mid, midX + (i * bgW), midY, bgW, bgMidH); } }
    if (bgDimAlpha > 0.04) { window.ctx.fillStyle = `rgba(5,8,20,${bgDimAlpha * 0.65})`; window.ctx.fillRect(0, midY, W, bgMidH); }


    const z = window.game.zoom || 1;
    window.ctx.save();
    window.ctx.translate(W / 2, H / 2); window.ctx.scale(z, z); window.ctx.translate(-W / 2, -H / 2); window.ctx.translate(-window.camera.x, -window.camera.y);

    const step = 15; 
    const _visHalfW = (W / 2) / z;  
    const _visCenterX = window.camera.x + W / 2;
    const _visLeft  = _visCenterX - _visHalfW;
    const _visRight = _visCenterX + _visHalfW;
    
    const startX = Math.floor((_visLeft - 100) / step) * step;
    const endX   = Math.ceil((_visRight + 100) / step) * step;
    const bottomY = window.camera.y + H / z + 200;

    if (!window.hitCanvas) { window.hitCanvas = document.createElement('canvas'); window.hitCtx = window.hitCanvas.getContext('2d', { willReadFrequently: true }); }

    // =========================================================================
    // DIBUJAR BLOQUES, ROCAS Y ÁRBOLES ANTES DEL TERRENO (Z-INDEX TRICK)
    // Así el pasto curvo tapa la parte plana y cuadrada de abajo.
    // =========================================================================

    window.blocks.forEach(b => {
        if (b.x + window.game.blockSize > _visLeft && b.x < _visRight + 120) {
            if (b.type === 'block') {
                window.ctx.fillStyle = b.isHit ? '#ff4444' : '#C19A6B'; window.ctx.fillRect(b.x, b.y, window.game.blockSize, window.game.blockSize);
                if (!b.isHit) { window.ctx.fillStyle = 'rgba(255,255,255,0.12)'; window.ctx.fillRect(b.x, b.y, window.game.blockSize, 4); window.ctx.fillStyle = 'rgba(0,0,0,0.22)'; window.ctx.fillRect(b.x, b.y + window.game.blockSize - 5, window.game.blockSize, 5); window.ctx.fillStyle = 'rgba(0,0,0,0.1)'; window.ctx.fillRect(b.x + window.game.blockSize - 4, b.y, 4, window.game.blockSize); }
                window.ctx.strokeStyle = '#8B5A2B'; window.ctx.lineWidth = 2; window.ctx.strokeRect(b.x, b.y, window.game.blockSize, window.game.blockSize);
            } else if (b.type === 'door') {
                if (b.open) { window.ctx.fillStyle = '#3a2518'; window.ctx.fillRect(b.x + 12, b.y, 6, window.game.blockSize * 2); } 
                else { window.ctx.fillStyle = b.isHit ? '#ff4444' : '#5C4033'; window.ctx.fillRect(b.x + 4, b.y, 22, window.game.blockSize * 2); window.ctx.fillStyle = '#FFD700'; window.ctx.fillRect(b.x + 20, b.y + window.game.blockSize, 4, 4); }
            } else if (b.type === 'box') {
                window.ctx.fillStyle = b.isHit ? '#ff4444' : '#8B4513'; window.ctx.fillRect(b.x + 2, b.y + 10, window.game.blockSize - 4, window.game.blockSize - 10); window.ctx.fillStyle = '#C19A6B'; window.ctx.fillRect(b.x, b.y + 10, window.game.blockSize, 4); window.ctx.fillStyle = '#333'; window.ctx.fillRect(b.x + window.game.blockSize/2 - 2, b.y + 12, 4, 6);
            } else if (b.type === 'campfire') {
                window.ctx.fillStyle = '#5c4033'; window.ctx.fillRect(b.x + 2, b.y + 20, 26, 10); window.ctx.fillStyle = '#3e2723'; window.ctx.fillRect(b.x + 10, b.y + 15, 10, 15);
                if (b.isBurning) { window.ctx.fillStyle = '#e67e22'; window.ctx.beginPath(); window.ctx.moveTo(b.x+5, b.y+20); window.ctx.lineTo(b.x+15, b.y+Math.random()*10); window.ctx.lineTo(b.x+25, b.y+20); window.ctx.fill(); window.ctx.fillStyle = '#f1c40f'; window.ctx.beginPath(); window.ctx.moveTo(b.x+10, b.y+20); window.ctx.lineTo(b.x+15, b.y+10+Math.random()*5); window.ctx.lineTo(b.x+20, b.y+20); window.ctx.fill(); }
            } else if (b.type === 'bed') {
                window.ctx.fillStyle = b.isHit ? '#ff4444' : '#8B4513'; window.ctx.fillRect(b.x, b.y + 20, 30, 10); window.ctx.fillStyle = b.isHit ? '#ff4444' : '#5C4033'; window.ctx.fillRect(b.x, b.y + 20, 4, 10); window.ctx.fillRect(b.x + 26, b.y + 20, 4, 10); window.ctx.fillStyle = '#e0e0e0'; window.ctx.fillRect(b.x + 2, b.y + 16, 10, 4); window.ctx.fillStyle = '#c0392b'; window.ctx.fillRect(b.x + 12, b.y + 16, 18, 4);
            } else if (b.type === 'grave') {
                window.ctx.fillStyle = b.isHit ? '#ff4444' : '#7f8c8d'; window.ctx.fillRect(b.x + 12, b.y + 5, 6, 25); window.ctx.fillRect(b.x + 5, b.y + 12, 20, 6); window.ctx.fillStyle = '#fff'; window.ctx.font = 'bold 8px Inter, sans-serif'; window.ctx.textAlign = 'center'; window.ctx.fillText("RIP", b.x + 15, b.y + 17);
            } else if (b.type === 'barricade') {
                window.ctx.fillStyle = '#5D4037'; window.ctx.fillRect(b.x + 2, b.y + 24, 26, 6); window.ctx.fillStyle = b.isHit ? '#ff4444' : '#bdc3c7'; window.ctx.beginPath(); window.ctx.moveTo(b.x + 5, b.y + 24); window.ctx.lineTo(b.x + 2, b.y + 5); window.ctx.lineTo(b.x + 10, b.y + 24); window.ctx.moveTo(b.x + 12, b.y + 24); window.ctx.lineTo(b.x + 15, b.y + 2); window.ctx.lineTo(b.x + 18, b.y + 24); window.ctx.moveTo(b.x + 20, b.y + 24); window.ctx.lineTo(b.x + 28, b.y + 8); window.ctx.lineTo(b.x + 25, b.y + 24); window.ctx.fill();
            } else if (b.type === 'ladder') {
                const lc = b.isHit ? '#ff9966' : '#c8a86a'; const lsd = b.isHit ? '#cc6633' : '#8B6230';
                window.ctx.fillStyle = lsd; window.ctx.fillRect(b.x + 5, b.y, 5, 30); window.ctx.fillRect(b.x + 20, b.y, 5, 30);
                window.ctx.fillStyle = lc; for (let rung = 0; rung < 3; rung++) { window.ctx.fillRect(b.x + 5, b.y + 4 + rung * 9, 20, 3); }
            } else if (b.type === 'stair') {
                const bs = window.game.blockSize;
                const wood  = b.isHit ? '#ff4444' : '#C19A6B';
                const woodD = b.isHit ? '#cc2222' : '#8B5A2B';
                window.ctx.fillStyle = wood;
                // Dibuja 3 peldaños en forma de L (escalón)
                // facingRight=true: escalón sube de izquierda a derecha
                // facingRight=false: escalón sube de derecha a izquierda
                const fr = b.facingRight !== false; // default true
                const step = bs / 3; // cada peldaño = 10px
                for (let i = 0; i < 3; i++) {
                    const sx = fr ? b.x + i * step : b.x + (2 - i) * step;
                    const sy = b.y + (2 - i) * step;
                    window.ctx.fillStyle = wood;
                    window.ctx.fillRect(sx, sy, step, bs - (2 - i) * step);
                    // borde oscuro superior e izquierdo/derecho
                    window.ctx.fillStyle = woodD;
                    window.ctx.fillRect(sx, sy, step, 2); // borde top
                    window.ctx.fillRect(fr ? sx : sx + step - 2, sy, 2, bs - (2 - i) * step); // borde lateral
                }
            }
        }
    });

    window.rocks.forEach(r => {
        if (r.x + r.width > _visLeft - 100 && r.x < _visRight + 100) {
            window.ctx.save();
            window.ctx.translate(r.x + r.width/2, r.y + r.height);
            let hw = r.width / 2;
            let img = (r.hp <= r.maxHp / 2) ? window.sprites.rock_damaged : window.sprites.rock_full;
            let drawW = 80; let drawH = 80; let drawX = -drawW / 2; let drawY = -drawH;

            if (img && img.complete && img.naturalWidth > 0) {
                if (r.isHit) {
                    window.hitCanvas.width = drawW; window.hitCanvas.height = drawH;
                    window.hitCtx.clearRect(0, 0, drawW, drawH); window.hitCtx.drawImage(img, 0, 0, drawW, drawH);
                    window.hitCtx.globalCompositeOperation = 'source-atop'; window.hitCtx.fillStyle = 'rgba(255, 68, 68, 0.65)';
                    window.hitCtx.fillRect(0, 0, drawW, drawH); window.hitCtx.globalCompositeOperation = 'source-over'; 
                    window.ctx.drawImage(window.hitCanvas, drawX, drawY);
                } else { window.ctx.drawImage(img, drawX, drawY, drawW, drawH); }
            } else {
                window.ctx.fillStyle = r.isHit ? '#ff4444' : '#666'; window.ctx.beginPath(); window.ctx.moveTo(-hw, 0); window.ctx.lineTo(-hw + r.width * 0.2, -r.height); window.ctx.lineTo(-hw + r.width * 0.8, -r.height + 5); window.ctx.lineTo(hw, 0); window.ctx.fill();
            }

            if (r.hp < r.maxHp && (Date.now() - (r.lastHitTime || 0) < 3000)) {
                let barY = drawY - 12; window.ctx.fillStyle = 'rgba(0,0,0,0.6)'; window.ctx.fillRect(-hw, barY, r.width, 6); window.ctx.fillStyle = '#4CAF50'; window.ctx.fillRect(-hw + 1, barY + 1, (r.hp / r.maxHp) * (r.width - 2), 4);
            }
            window.ctx.restore();
        }
    });

    window.trees.forEach(t => {
        if (t.x + t.width > _visLeft - 200 && t.x < _visRight + 200) {
            window.ctx.save();
            window.ctx.translate(t.x + t.width / 2, t.y + t.height);
            let hw = t.width / 2; let img = null;
            if (t.isStump) img = window.sprites.tree_stump; else if (t.type === 0) img = window.sprites.tree_oak; else if (t.type === 1) img = window.sprites.tree_pine; else if (t.type === 2) img = window.sprites.tree_birch;

            let drawH = 256; let drawW = 128; let drawX = -drawW / 2; let drawY = -drawH;

            if (t.type === 3 && !t.isStump) {
                const C2 = window.ctx; const hit = t.isHit; const ch  = t.height * 0.9; const cw  = 10; const rad = 4;
                const varSeed = (Math.sin(t.x * 0.047) * 0.5 + 0.5);
                const green1 = hit ? '#ff5555' : `hsl(${108 + varSeed*16},${52+varSeed*12}%,${28+varSeed*8}%)`;
                const green2 = hit ? '#cc2222' : `hsl(${110 + varSeed*14},${45+varSeed*10}%,${20+varSeed*6}%)`;
                const spine  = hit ? '#ffaaaa' : '#c8d6a0';

                C2.save(); C2.fillStyle = green1; C2.beginPath(); C2.roundRect(-cw/2, -ch, cw, ch, rad); C2.fill(); C2.strokeStyle = green2; C2.lineWidth = 1.5; C2.beginPath(); C2.moveTo(0, -ch + 4); C2.lineTo(0, -4); C2.stroke();
                const armLY = -ch * (0.48 + varSeed * 0.14); const armLH = ch * (0.28 + varSeed * 0.08); const armW  = 8; const armLX = -cw/2 - armW;
                C2.fillStyle = green1; C2.beginPath(); C2.roundRect(armLX, armLY - armW*0.6, armW + cw/2, armW*0.65, 2); C2.fill(); C2.strokeStyle = green2; C2.lineWidth = 0.8; C2.stroke(); C2.beginPath(); C2.roundRect(armLX, armLY - armLH, armW, armLH, [rad, rad, 2, 2]); C2.fill(); C2.stroke();
                const armRY = -ch * (0.60 + varSeed * 0.10); const armRH = ch * (0.22 + varSeed * 0.06); const armRX = cw/2;
                C2.fillStyle = green1; C2.beginPath(); C2.roundRect(armRX - 2, armRY - armW*0.6, armW + 2, armW*0.65, 2); C2.fill(); C2.strokeStyle = green2; C2.lineWidth = 0.8; C2.stroke(); C2.beginPath(); C2.roundRect(armRX + armW - 2, armRY - armRH, armW, armRH, [rad, rad, 2, 2]); C2.fill(); C2.stroke();
                C2.strokeStyle = spine; C2.lineWidth = 0.8;
                for (let sy = -ch + 10; sy < -8; sy += 12) { C2.beginPath(); C2.moveTo(-cw/2, sy); C2.lineTo(-cw/2 - 5, sy - 2); C2.stroke(); C2.beginPath(); C2.moveTo(cw/2,  sy + 4); C2.lineTo(cw/2  + 5, sy + 2); C2.stroke(); }
                if (varSeed > 0.35) { const petals = 5; const pr = 4.5; C2.fillStyle = varSeed > 0.65 ? '#f06090' : '#f0b040'; for (let pi = 0; pi < petals; pi++) { const angle = (pi / petals) * Math.PI * 2 - Math.PI / 2; C2.beginPath(); C2.ellipse(Math.cos(angle) * pr, -ch - Math.sin(angle) * pr, 2.5, 4, angle, 0, Math.PI * 2); C2.fill(); } C2.fillStyle = '#ffe066'; C2.beginPath(); C2.arc(0, -ch, 3, 0, Math.PI * 2); C2.fill(); }
                C2.restore();
            } else if (img && img.complete && img.naturalWidth > 0) {
                if (t.isHit) {
                    window.hitCanvas.width = drawW; window.hitCanvas.height = drawH; window.hitCtx.clearRect(0, 0, drawW, drawH); window.hitCtx.drawImage(img, 0, 0, drawW, drawH);
                    window.hitCtx.globalCompositeOperation = 'source-atop'; window.hitCtx.fillStyle = 'rgba(255, 68, 68, 0.65)'; window.hitCtx.fillRect(0, 0, drawW, drawH); window.hitCtx.globalCompositeOperation = 'source-over'; 
                    window.ctx.drawImage(window.hitCanvas, drawX, drawY);
                } else { window.ctx.drawImage(img, drawX, drawY, drawW, drawH); }
            } else if (t.type !== 3) { window.ctx.fillStyle = t.isHit ? '#ff4444' : (t.isStump ? '#5D4037' : '#2E7D32'); window.ctx.fillRect(-hw, -t.height, t.width, t.isStump ? 15 : t.height); }

            if (t.hp < t.maxHp && (Date.now() - (t.lastHitTime || 0) < 3000)) { let barY = t.isStump ? -25 : drawY - 12; window.ctx.fillStyle = 'rgba(0,0,0,0.6)'; window.ctx.fillRect(-hw-5, barY, t.width + 10, 7); window.ctx.fillStyle = '#4CAF50'; window.ctx.fillRect(-hw-4, barY + 1, (t.hp / t.maxHp) * (t.width + 8), 5); }
            window.ctx.restore();
        }
    });

    // =========================================================================
    // CREAR LA MÁSCARA DEL TERRENO CURVO (Cubre lo de arriba)
    // =========================================================================
    window.ctx.save();
    window.ctx.beginPath();
    window.ctx.moveTo(startX, bottomY);
    for (let px = startX; px <= endX; px += step) {
        window.ctx.lineTo(px, window.getGroundY(px));
    }
    window.ctx.lineTo(endX, bottomY);
    window.ctx.closePath();
    window.ctx.clip(); // ✂️ Recortamos el pincel a la forma del suelo

    if (!window._dirtPattern && window.sprites.tile_dirt.complete && window.sprites.tile_dirt.naturalWidth > 0) { const tc = document.createElement('canvas'); tc.width=64; tc.height=64; tc.getContext('2d').drawImage(window.sprites.tile_dirt, 0, 0); window._dirtPattern = window.ctx.createPattern(tc, 'repeat'); }
    if (window._dirtPattern) { window.ctx.fillStyle = window._dirtPattern; window.ctx.fillRect(startX, window.camera.y - 300, endX - startX, bottomY - window.camera.y + 300); } 
    else { window.ctx.fillStyle = '#3d2412'; window.ctx.fillRect(startX, window.camera.y - 300, endX - startX, bottomY - window.camera.y + 300); }

    if (!window._sandPattern && window.sprites.tile_sand_base.complete && window.sprites.tile_sand_base.naturalWidth > 0) { const sc = document.createElement('canvas'); sc.width=64; sc.height=64; sc.getContext('2d').drawImage(window.sprites.tile_sand_base, 0, 0); window._sandPattern = window.ctx.createPattern(sc, 'repeat'); }

    for (let px = startX; px < endX; px += step) {
        const gY = window.getGroundY(px); const colCenterX = px + step / 2;
        const _dStart = (window.game.desertStart || 2600) + window.game.shoreX; const _dWidth = window.game.desertWidth || 800;
        let desertAlpha = 0; if (colCenterX > _dStart + _dWidth) desertAlpha = 1; else if (colCenterX > _dStart) desertAlpha = (colCenterX - _dStart) / _dWidth;

        if (desertAlpha > 0) { window.ctx.globalAlpha = desertAlpha; window.ctx.fillStyle = window._sandPattern || '#d4a853'; window.ctx.fillRect(px, window.camera.y - 300, step + 1, bottomY - window.camera.y + 300); window.ctx.globalAlpha = 1; }

        const texX = (px % 64 + 64) % 64; const drawW = Math.min(step + 0.5, 64 - texX);

        if (desertAlpha < 1) {
            window.ctx.globalAlpha = 1 - desertAlpha;
            const fImg = window.sprites.tile_grass_top;
            if (fImg && fImg.complete && fImg.naturalWidth > 0) { window.ctx.drawImage(fImg, texX, 0, drawW, 64, px, gY - 1, drawW, 64); if (drawW < step) window.ctx.drawImage(fImg, 0, 0, step - drawW + 0.5, 64, px + drawW, gY - 1, step - drawW + 0.5, 64); } 
            else { window.ctx.fillStyle = '#528c2a'; window.ctx.fillRect(px, gY - 1, step + 1, 24); }
            window.ctx.globalAlpha = 1;
        }

        if (desertAlpha > 0) {
            window.ctx.globalAlpha = desertAlpha;
            const sImg = window.sprites.tile_sand_top;
            if (sImg && sImg.complete && sImg.naturalWidth > 0) { window.ctx.drawImage(sImg, texX, 0, drawW, 64, px, gY - 1, drawW, 64); if (drawW < step) window.ctx.drawImage(sImg, 0, 0, step - drawW + 0.5, 64, px + drawW, gY - 1, step - drawW + 0.5, 64); } 
            else { window.ctx.fillStyle = '#e6c280'; window.ctx.fillRect(px, gY - 1, step + 1, 24); }
            window.ctx.globalAlpha = 1;
        }
    }
    
    window.ctx.restore();

    window.ctx.save();
    window.ctx.beginPath();
    window.ctx.moveTo(startX, window.getGroundY(startX));
    for (let px = startX; px <= endX; px += step) { window.ctx.lineTo(px, window.getGroundY(px)); }
    window.ctx.lineWidth = 1.5; window.ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)'; window.ctx.stroke();
    window.ctx.restore();

    for (let px = startX; px < endX; px += step) {
        const gY = window.getGroundY(px); const colCenterX = px + step / 2;
        const _dStart = (window.game.desertStart || 2600) + window.game.shoreX; const _dWidth = window.game.desertWidth || 800;
        let desertAlpha = colCenterX > _dStart + _dWidth ? 1 : (colCenterX > _dStart ? (colCenterX - _dStart) / _dWidth : 0);

        if (desertAlpha < 1 && darkness < 0.8) {
            window.ctx.globalAlpha = (1 - desertAlpha) * 0.75; window.ctx.fillStyle = 'rgba(70,110,30,0.8)';
            const seed = Math.sin(px * 0.0173) * 0.5 + 0.5; const grassH = 5 + seed * 7;
            window.ctx.fillRect(px + seed * (step - 4), gY - grassH, 2, grassH);
            if (seed > 0.3) window.ctx.fillRect(px + seed * (step - 10) + 4, gY - grassH * 0.65, 2, grassH * 0.65);
            window.ctx.globalAlpha = 1;
        }
    }

    if (window.camera.x < window.game.shoreX) {
        const gL = window.game.baseGroundLevel || window.game.groundLevel;
        window.ctx.fillStyle = '#C8B878'; window.ctx.fillRect(window.game.shoreX - 70, gL, 70, (window.camera.y + H / (window.game.zoom||1)) - gL);
        let waveOffset = Math.sin(window.game.frameCount * 0.04) * 6; let waterGrad = window.ctx.createLinearGradient(0, gL, 0, gL + 60); waterGrad.addColorStop(0, '#1a8fc0'); waterGrad.addColorStop(1, '#0a5c8a');
        window.ctx.fillStyle = waterGrad; window.ctx.fillRect(window.camera.x, gL + 16 + waveOffset, window.game.shoreX - 70 - window.camera.x, H);
        window.ctx.fillStyle = 'rgba(100,200,255,0.4)'; window.ctx.fillRect(window.camera.x, gL + 6 + waveOffset, window.game.shoreX - 70 - window.camera.x, 12);
        window.ctx.fillStyle = 'rgba(255,255,255,0.6)'; window.ctx.fillRect(window.game.shoreX - 70 - 5, gL + 8, 5, 8);
    }

    window.droppedItems.forEach(item => {
        if (item.x + 20 > _visLeft && item.x < _visRight + 60) {
            window.ctx.fillStyle = window.itemDefs[item.type] ? window.itemDefs[item.type].color : '#fff'; let s = window.itemDefs[item.type] ? window.itemDefs[item.type].size : 10; let floatOffset = Math.sin(item.life) * 3; window.ctx.fillRect(item.x, item.y + floatOffset, s, s);
        }
    });

    if (window.game.isMultiplayer) { Object.values(window.otherPlayers).forEach(p => { if (p.id !== window.socket?.id && p.x > _visLeft - 50 && p.x < _visRight + 150) { window.drawCharacter(p, false); } }); }

    if (!window.player.inBackground) window.drawCharacter(window.player, true);

    window.entities.forEach(ent => {
        if (!(ent.x + ent.width > _visLeft && ent.x < _visRight + 120)) return;
        const C = window.ctx; const H = ent.isHit; const ER = (ent.enragedFrames||0) > 0; const FR = ent.vx >= 0; const T = window.game.frameCount;

        C.save();
        if (ent.type === 'chicken') {
            const x=ent.x, y=ent.y, w=ent.width, h=ent.height; const moving = Math.abs(ent.vx) > 0.05; const bob = moving ? Math.sin(T*0.28)*2.5 : 0; const headBob = moving ? Math.sin(T*0.28+0.5)*3 : 0; 
            if (!FR) { C.translate(x+w, 0); C.scale(-1,1); } const bx = FR ? x : 0;
            C.globalAlpha=0.18; C.fillStyle='#000'; C.beginPath(); C.ellipse(bx+w/2, y+h+1, w*0.45, 2.5, 0, 0, Math.PI*2); C.fill(); C.globalAlpha=1;
            const legColor = H ? '#ff6644' : '#e07820'; const lw1 = moving ? Math.sin(T*0.28)*5 : 0; const lw2 = moving ? -Math.sin(T*0.28)*5 : 0; C.strokeStyle=legColor; C.lineWidth=2; C.beginPath(); C.moveTo(bx+7,y+h-4+bob); C.lineTo(bx+7+lw1,y+h+1); C.lineTo(bx+5+lw1,y+h+3); C.stroke(); C.beginPath(); C.moveTo(bx+13,y+h-4+bob); C.lineTo(bx+13+lw2,y+h+1); C.lineTo(bx+15+lw2,y+h+3); C.stroke();
            C.fillStyle = H ? '#ffaaaa' : '#f0d080'; C.beginPath(); C.moveTo(bx+2,y+h*0.55+bob); C.quadraticCurveTo(bx-6,y+h*0.4+bob, bx-3,y+h*0.3+bob); C.quadraticCurveTo(bx+0,y+h*0.45+bob, bx+2,y+h*0.55+bob); C.fill();
            const bodyG = C.createRadialGradient(bx+w*0.42,y+h*0.58+bob,2, bx+w*0.5,y+h*0.6+bob,w*0.55); bodyG.addColorStop(0, H?'#ffbbbb':'#fffef0'); bodyG.addColorStop(1, H?'#ff5544':'#f0e070'); C.fillStyle=bodyG; C.beginPath(); C.ellipse(bx+w*0.52, y+h*0.62+bob, w*0.52, h*0.37, 0, 0, Math.PI*2); C.fill();
            C.fillStyle = H?'#ff7755':'#d8c060'; C.beginPath(); C.moveTo(bx+w*0.8,y+h*0.5+bob); C.quadraticCurveTo(bx+w*1.05,y+h*0.63+bob, bx+w*0.85,y+h*0.78+bob); C.quadraticCurveTo(bx+w*0.68,y+h*0.72+bob, bx+w*0.8,y+h*0.5+bob); C.fill();
            C.fillStyle = H?'#ff6644':'#f5e888'; C.beginPath(); C.ellipse(bx+w*0.42, y+h*0.42+bob, w*0.18, h*0.1, -0.2, 0, Math.PI*2); C.fill();
            const hy = y+h*0.28+headBob; const hg = C.createRadialGradient(bx+w*0.4,hy,1, bx+w*0.42,hy,w*0.3); hg.addColorStop(0, H?'#ffcccc':'#fffff8'); hg.addColorStop(1, H?'#ff5544':'#f0e878'); C.fillStyle=hg; C.beginPath(); C.ellipse(bx+w*0.44, hy, w*0.32, h*0.22, 0, 0, Math.PI*2); C.fill();
            C.fillStyle=H?'#ff3333':'#dd2222'; C.beginPath(); C.moveTo(bx+w*0.3,hy-4); C.quadraticCurveTo(bx+w*0.25,hy-11,bx+w*0.35,hy-7); C.quadraticCurveTo(bx+w*0.42,hy-13,bx+w*0.47,hy-7); C.quadraticCurveTo(bx+w*0.52,hy-3,bx+w*0.3,hy-4); C.fill(); C.beginPath(); C.arc(bx+w*0.36,hy+6,2.5,0,Math.PI*2); C.fill();
            C.fillStyle='#e08020'; C.beginPath(); C.moveTo(bx+w*0.72,hy-1); C.lineTo(bx+w*0.98,hy); C.lineTo(bx+w*0.72,hy+3); C.fill(); C.strokeStyle='#c06010'; C.lineWidth=0.8; C.beginPath(); C.moveTo(bx+w*0.72,hy+1); C.lineTo(bx+w*0.92,hy+1); C.stroke();
            C.fillStyle='#111'; C.beginPath(); C.arc(bx+w*0.6,hy-1,2,0,Math.PI*2); C.fill(); C.fillStyle='#fff'; C.beginPath(); C.arc(bx+w*0.61,hy-1.5,0.8,0,Math.PI*2); C.fill();
        } else if (ent.type === 'spider') {
            const x=ent.x, y=ent.y, w=ent.width, h=ent.height; const faceX = FR ? x+w : x;
            C.fillStyle = H ? '#ff4444' : '#111'; C.beginPath(); C.ellipse(x + w/2, y + h/2 + 2, w/2, h/3, 0, 0, Math.PI*2); C.fill();
            const eyeX = FR ? x + w - 5 : x + 5; C.fillStyle = '#ff0000'; C.beginPath(); C.arc(eyeX, y + h/2, 2, 0, Math.PI*2); C.fill(); C.beginPath(); C.arc(eyeX - (FR?3:-3), y + h/2 - 2, 1.5, 0, Math.PI*2); C.fill();
            C.strokeStyle = H ? '#ff4444' : '#000'; C.lineWidth = 2; C.beginPath();
            let legMove = (Math.abs(ent.vx) > 0.1) ? Math.sin(T * 0.5) * 3 : 0;
            for(let i=0; i<4; i++) { let lx = x + w/2 - 2 + (i*2); let ly = y + h/2 + 2; let footX = x - 5 - (i*3) + (i%2==0 ? legMove : -legMove); let footY = y + h; C.moveTo(lx, ly); C.quadraticCurveTo(lx - 5, ly - 5, footX, footY); }
            for(let i=0; i<4; i++) { let lx = x + w/2 + 2 - (i*2); let ly = y + h/2 + 2; let footX = x + w + 5 + (i*3) + (i%2==0 ? legMove : -legMove); let footY = y + h; C.moveTo(lx, ly); C.quadraticCurveTo(lx + 5, ly - 5, footX, footY); }
            C.stroke();
        } else if (ent.type === 'zombie') {
            const x=ent.x, y=ent.y, w=ent.width, h=ent.height; const walk = Math.abs(ent.vx)>0.05 ? Math.sin(T*0.2)*0.3 : 0;
            if (!FR) { C.translate(x+w,0); C.scale(-1,1); } const bx = FR ? x : 0;
            C.globalAlpha=0.2; C.fillStyle='#000'; C.beginPath(); C.ellipse(bx+w/2,y+h+1,w*0.5,3,0,0,Math.PI*2); C.fill(); C.globalAlpha=1;
            for (let leg=0;leg<2;leg++) { const lx=bx+(leg===0?5:13); const la = leg===0 ? walk : -walk; C.fillStyle=H?'#ff5544':(ER?'#145a14':'#1a5a1a'); C.save(); C.translate(lx+2,y+h-18); C.rotate(la); C.fillRect(-3,0,7,10); C.translate(0,9); C.rotate(-la*0.4); C.fillRect(-2,0,6,9); C.fillStyle=H?'#ff3322':'#0d0d0d'; C.fillRect(-3,8,9,4); C.restore(); }
            const torsoG=C.createLinearGradient(bx,y+h*0.43,bx+w,y+h*0.43); torsoG.addColorStop(0, H?'#ff5544':(ER?'#1a6a1a':'#2a8a2a')); torsoG.addColorStop(1, H?'#cc2211':(ER?'#0f440f':'#1a5a1a')); C.fillStyle=torsoG; C.fillRect(bx+2,y+h*0.42,w-4,h*0.36);
            if (!H) { C.strokeStyle='rgba(0,0,0,0.5)'; C.lineWidth=1; C.beginPath(); C.moveTo(bx+7,y+h*0.46); C.lineTo(bx+9,y+h*0.57); C.stroke(); C.beginPath(); C.moveTo(bx+15,y+h*0.49); C.lineTo(bx+12,y+h*0.6); C.stroke(); }
            const armSw = Math.sin(T*0.15)*0.12;
            C.fillStyle=H?'#ff6655':(ER?'#2a9a2a':'#3a9a3a'); C.save(); C.translate(bx+4,y+h*0.44); C.rotate(-0.35+armSw); C.fillRect(-3,0,6,13); C.translate(0,12); C.rotate(0.1); C.fillRect(-2.5,0,5,10); C.fillStyle=H?'#ff8866':(ER?'#1a8a1a':'#4aaa4a'); for(let d=0;d<3;d++){C.fillRect(-2+d*2.5,9,2,5);} C.restore();
            C.fillStyle=H?'#ff4433':(ER?'#1a8a1a':'#2a8a2a'); C.save(); C.translate(bx+w-4,y+h*0.42); C.rotate(-0.6+armSw); C.fillRect(-3,0,6,13); C.translate(0,12); C.rotate(0.1); C.fillRect(-2.5,0,5,10); C.fillStyle=H?'#ff7755':(ER?'#1aaa1a':'#3aaa3a'); for(let d=0;d<3;d++){C.fillRect(-2+d*2.5,9,2,5);} C.restore();
            C.fillStyle=H?'#ff5544':'#5ab05a'; C.fillRect(bx+w*0.3,y+h*0.26,w*0.4,h*0.08);
            const hg=C.createLinearGradient(bx+2,y+h*0.06,bx+w-2,y+h*0.27); hg.addColorStop(0,H?'#ff8877':(ER?'#60c060':'#70d070')); hg.addColorStop(1,H?'#cc3322':(ER?'#3a8a3a':'#4a9a4a')); C.fillStyle=hg; C.fillRect(bx+2,y+h*0.06,w-4,h*0.22);
            C.fillStyle=H?'#cc2211':(ER?'#1a4a1a':'#1a5a1a'); C.fillRect(bx+2,y+h*0.05,w-4,4); C.fillRect(bx+4,y+h*0.03,4,4); C.fillRect(bx+13,y+h*0.02,5,5);
            C.fillStyle='#000'; C.fillRect(bx+4,y+h*0.11,6,5); C.fillRect(bx+13,y+h*0.11,6,5); C.fillStyle=ER?'#ff4400':'#cc0000'; C.fillRect(bx+5,y+h*0.12,4,3); C.fillRect(bx+14,y+h*0.12,4,3); C.fillStyle='rgba(255,180,0,0.6)'; C.fillRect(bx+5,y+h*0.12,2,1.5); C.fillRect(bx+14,y+h*0.12,2,1.5);
            C.fillStyle='#000'; C.fillRect(bx+w*0.4,y+h*0.19,2,3); C.fillRect(bx+5,y+h*0.23,w-10,3); C.fillStyle='#ddd'; for(let t=0;t<3;t++){C.fillRect(bx+7+t*5,y+h*0.23,3,2);}
            if (!H) { C.fillStyle='rgba(180,0,0,0.5)'; C.fillRect(bx+3,y+h*0.15,3,2); }
        } else if (ent.type === 'archer') {
            const x=ent.x, y=ent.y, w=ent.width, h=ent.height; const fR = ent.attackCooldown < 120 ? window.player.x > ent.x : ent.vx >= 0; const walk = Math.abs(ent.vx)>0.05 ? Math.sin(T*0.2)*0.25 : 0;
            if (!fR) { C.translate(x+w,0); C.scale(-1,1); } const bx = fR ? x : 0;
            C.globalAlpha=0.18; C.fillStyle='#000'; C.beginPath(); C.ellipse(bx+w/2,y+h+1,w*0.4,2.5,0,0,Math.PI*2); C.fill(); C.globalAlpha=1;
            for (let leg=0;leg<2;leg++) { const lx=bx+(leg===0?4:12); const la = leg===0 ? walk : -walk; C.fillStyle=H?'#ff4444':'#1e0f38'; C.save(); C.translate(lx+2,y+h-17); C.rotate(la); C.fillRect(-2,0,5,9); C.translate(0,8); C.rotate(-la*0.4); C.fillRect(-2,0,5,8); C.fillStyle=H?'#ff3333':'#0d0820'; C.fillRect(-3,7,7,3); C.restore(); }
            const capeWave = Math.sin(T*0.12)*3; C.fillStyle=H?'#aa2222':(ER?'#2a004a':'#3b0f6e'); C.beginPath(); C.moveTo(bx+w*0.15,y+h*0.37); C.lineTo(bx-4,y+h*0.75+capeWave); C.lineTo(bx+w*0.45,y+h*0.76+capeWave*0.5); C.closePath(); C.fill();
            const tg=C.createLinearGradient(bx,y+h*0.34,bx+w,y+h*0.34); tg.addColorStop(0,H?'#ff5544':(ER?'#5a0088':'#7c2fb8')); tg.addColorStop(1,H?'#cc2211':(ER?'#380060':'#51198a')); C.fillStyle=tg; C.fillRect(bx+1,y+h*0.34,w-2,h*0.36);
            if(!H){ C.fillStyle='#c8920f'; C.fillRect(bx+w*0.3,y+h*0.36,w*0.4,2); C.beginPath(); C.arc(bx+w/2,y+h*0.44,3,0,Math.PI*2); C.fill(); }
            C.fillStyle=H?'#ff5555':'#5a2888'; C.fillRect(bx-1,y+h*0.35,4,15); C.fillStyle=H?'#cc3322':'#5a2810'; C.fillRect(bx-3,y+h*0.37,5,14); C.strokeStyle='#c8a050'; C.lineWidth=1; for(let fi=0;fi<4;fi++){ C.beginPath(); C.moveTo(bx-2,y+h*0.39+fi*2.5); C.lineTo(bx+2,y+h*0.39+fi*2.5); C.stroke(); }
            const bowAngle = ent.attackCooldown<120 ? Math.atan2((window.player.y+24)-(y+h*0.44), fR ? (window.player.x+12)-(bx+w) : (bx)-(window.player.x+12)) : 0;
            C.save(); C.translate(bx+w,y+h*0.43); C.rotate(Math.max(-0.8,Math.min(0.8,bowAngle))); C.fillStyle=H?'#ff6666':'#6a3498'; C.fillRect(0,-3,13,6); C.strokeStyle=H?'#ff8844':'#7a4820'; C.lineWidth=3; C.beginPath(); C.arc(15,0,11,-1.1,1.1); C.stroke(); C.strokeStyle=H?'#ffaa66':'#9a6030'; C.lineWidth=1.5; C.beginPath(); C.arc(15,0,11,-0.4,0.4); C.stroke();
            const pull = ent.attackCooldown<120 ? Math.min(8,(120-ent.attackCooldown)/120*8) : 0; C.strokeStyle='rgba(220,210,190,0.9)'; C.lineWidth=1; C.beginPath(); C.moveTo(15+Math.cos(-1.1)*11, Math.sin(-1.1)*11); C.lineTo(15-pull, 0); C.lineTo(15+Math.cos(1.1)*11, Math.sin(1.1)*11); C.stroke();
            if (ent.attackCooldown<90) { C.fillStyle='#c8a050'; C.fillRect(15-pull,-1,16+pull,2); C.fillStyle='#607888'; C.fillRect(30,-2.5,5,5); C.fillStyle='#cc4444'; C.beginPath(); C.moveTo(14-pull,-1); C.lineTo(14-pull-4,-4); C.lineTo(14-pull,0); C.fill(); C.beginPath(); C.moveTo(14-pull,1); C.lineTo(14-pull-4,4); C.lineTo(14-pull,0); C.fill(); } C.restore();
            C.fillStyle=H?'#ff7755':'#c09070'; C.fillRect(bx+w*0.28,y+h*0.27,w*0.44,h*0.09); C.fillStyle=H?'#aa1122':(ER?'#300050':'#4c1590'); C.beginPath(); C.moveTo(bx+1,y+h*0.27); C.lineTo(bx+w/2,y+h*0.04); C.lineTo(bx+w-1,y+h*0.27); C.closePath(); C.fill();
            const faceG=C.createLinearGradient(bx+3,y+h*0.15,bx+w-3,y+h*0.27); faceG.addColorStop(0,H?'#ff9977':'#d4a880'); faceG.addColorStop(1,H?'#cc4433':'#b07850'); C.fillStyle=faceG; C.fillRect(bx+3,y+h*0.15,w-6,h*0.14); C.fillStyle='rgba(0,0,0,0.25)'; C.fillRect(bx+3,y+h*0.15,w-6,3);
            C.fillStyle=ER?'#ff3300':'#1a0a05'; C.fillRect(bx+5,y+h*0.175,4,2.5); C.fillRect(bx+11,y+h*0.175,4,2.5); C.fillStyle=ER?'#ff8800':'#4a2a10'; C.fillRect(bx+6,y+h*0.178,2,1.5); C.fillRect(bx+12,y+h*0.178,2,1.5);
            C.fillStyle='rgba(0,0,0,0.3)'; C.fillRect(bx+w*0.42,y+h*0.215,2,2); C.fillRect(bx+6,y+h*0.24,w-12,1.5);
        }

        {
            const isHostile = ent.type !== 'chicken';
            const timeSinceHit = Date.now() - (ent.lastHitTime || 0);
            const pct = Math.max(0, ent.hp / ent.maxHp);
            const showBar = isHostile || (ent.hp < ent.maxHp && timeSinceHit < 3000);
            if (showBar) {
                let barAlpha = 1.0;
                if (pct >= 1 && timeSinceHit > 1500) barAlpha = Math.max(0.35, 1 - (timeSinceHit - 1500) / 3000);
                const barW = Math.max(ent.width, 20);
                const barX = ent.x + (ent.width - barW) / 2;
                const barY = ent.y - 10;
                C.save();
                C.globalAlpha = barAlpha;
                C.fillStyle = 'rgba(0,0,0,0.6)';
                C.fillRect(barX - 1, barY - 1, barW + 2, 6);
                const hc = pct > 0.6 ? '#44dd44' : (pct > 0.3 ? '#f0a020' : '#ee3333');
                C.fillStyle = hc;
                C.fillRect(barX, barY, barW * pct, 4);
                C.strokeStyle = 'rgba(0,0,0,0.5)';
                C.lineWidth = 0.5;
                C.strokeRect(barX, barY, barW, 4);
                if (isHostile && (pct < 1 || timeSinceHit < 2000)) {
                    C.font = '7px monospace';
                    C.fillStyle = 'rgba(255,255,255,0.85)';
                    C.textAlign = 'center';
                    C.fillText(ent.name || ent.type, barX + barW / 2, barY - 2);
                }
                C.restore();
            }
        }
        C.restore();
    });

    if (window.player.placementMode && !window.player.isDead) {
        let offsetY = window.game.groundLevel % window.game.blockSize;
        const gridX = Math.floor(window.mouseWorldX / window.game.blockSize) * window.game.blockSize; 
        const gridY = Math.floor((window.mouseWorldY - offsetY) / window.game.blockSize) * window.game.blockSize + offsetY;
        const bs2 = window.game.blockSize;
        
        let valid;
        if (window.player.placementMode === 'ladder_item') {
            const lGY2 = window.getGroundY ? window.getGroundY(gridX + bs2/2) : window.game.groundLevel;
            const alreadyHere2 = window.blocks.some(b => b.type === 'ladder' && Math.abs(b.x - gridX) < 1 && Math.abs(b.y - gridY) < 1);
            valid = !alreadyHere2 && (
                Math.abs((gridY + bs2) - lGY2) <= 2 ||
                window.blocks.some(b => b.type === 'ladder' && Math.abs(b.x - gridX) < 1 && Math.abs(b.y - (gridY + bs2)) < 2) ||
                window.blocks.some(b => b.type === 'block' && Math.abs(b.x - gridX) < 1 && Math.abs(b.y - (gridY + bs2)) < 2)
            );
        } else {
            valid = window.isValidPlacement(gridX, gridY, bs2, bs2, true, false);
        }
        let validColor = valid ? '#00FF00' : '#FF0000'; let validFill = valid ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.3)';

        window.ctx.globalAlpha = 0.6;
        if (window.player.placementMode === 'boxes') { window.ctx.fillStyle = '#8B4513'; window.ctx.fillRect(gridX + 2, gridY + 10, window.game.blockSize - 4, window.game.blockSize - 10); } 
        else if (window.player.placementMode === 'campfire_item') { window.ctx.fillStyle = '#5c4033'; window.ctx.fillRect(gridX + 2, gridY + 20, 26, 10); }
        else if (window.player.placementMode === 'bed_item') { window.ctx.fillStyle = '#8B4513'; window.ctx.fillRect(gridX, gridY + 20, 30, 10); window.ctx.fillStyle = '#e0e0e0'; window.ctx.fillRect(gridX + 2, gridY + 16, 10, 4); window.ctx.fillStyle = '#c0392b'; window.ctx.fillRect(gridX + 12, gridY + 16, 18, 4); }
        else if (window.player.placementMode === 'barricade_item') { window.ctx.fillStyle = '#5D4037'; window.ctx.fillRect(gridX + 2, gridY + 24, 26, 6); window.ctx.fillStyle = '#bdc3c7'; window.ctx.beginPath(); window.ctx.moveTo(gridX + 5, gridY + 24); window.ctx.lineTo(gridX + 2, gridY + 5); window.ctx.lineTo(gridX + 10, gridY + 24); window.ctx.fill(); }
        else if (window.player.placementMode === 'ladder_item') {
            window.ctx.fillStyle = '#8B6230'; window.ctx.fillRect(gridX + 5, gridY, 5, 30); window.ctx.fillRect(gridX + 20, gridY, 5, 30);
            window.ctx.fillStyle = '#c8a86a';
            for (let r = 0; r < 3; r++) window.ctx.fillRect(gridX + 5, gridY + 4 + r * 9, 20, 3);
        }
        
        window.ctx.strokeStyle = validColor; window.ctx.lineWidth = 2; window.ctx.strokeRect(gridX, gridY, window.game.blockSize, window.game.blockSize); 
        window.ctx.fillStyle = validFill; window.ctx.fillRect(gridX, gridY, window.game.blockSize, window.game.blockSize); window.ctx.globalAlpha = 1.0;
    }

    if (window.player.activeTool === 'hammer' && !window.player.isDead && !window.player.placementMode) {
        let offsetY = window.game.groundLevel % window.game.blockSize;
        const gridX = Math.floor(window.mouseWorldX / window.game.blockSize) * window.game.blockSize; 
        const gridY = Math.floor((window.mouseWorldY - offsetY) / window.game.blockSize) * window.game.blockSize + offsetY;
        
        const isDoor  = window.player.buildMode === 'door';
        const isStair = window.player.buildMode === 'stair';
        const itemHeight = isDoor ? window.game.blockSize * 2 : window.game.blockSize;
        const bs = window.game.blockSize;
        
        let valid = window.isValidPlacement(gridX, gridY, bs, itemHeight, true, true);
        let validColor = valid ? '#00FF00' : '#FF0000';
        let validFill  = valid ? 'rgba(0,255,0,0.2)' : 'rgba(255,0,0,0.3)';

        window.ctx.save();
        window.ctx.globalAlpha = 0.6;
        window.ctx.strokeStyle = validColor;
        window.ctx.lineWidth = 2;
        window.ctx.setLineDash([4, 2]);

        if (isStair) {
            // Ghost triangular: dibuja el perfil de la escalera como un triángulo relleno
            const fr = !window.player.stairMirror; // facingRight
            window.ctx.beginPath();
            if (fr) {
                // sube de izquierda a derecha: esquina inf-izq, inf-der, sup-der
                window.ctx.moveTo(gridX,       gridY + bs);
                window.ctx.lineTo(gridX + bs,  gridY + bs);
                window.ctx.lineTo(gridX + bs,  gridY);
            } else {
                // sube de derecha a izquierda: esquina inf-izq, inf-der, sup-izq
                window.ctx.moveTo(gridX,       gridY + bs);
                window.ctx.lineTo(gridX + bs,  gridY + bs);
                window.ctx.lineTo(gridX,       gridY);
            }
            window.ctx.closePath();
            window.ctx.fillStyle = validFill;
            window.ctx.fill();
            window.ctx.stroke();
        } else {
            window.ctx.strokeRect(gridX, gridY, bs, itemHeight);
            window.ctx.fillStyle = validFill;
            window.ctx.fillRect(gridX, gridY, bs, itemHeight);
        }

        window.ctx.setLineDash([]);
        window.ctx.globalAlpha = 1.0;
        window.ctx.restore();
    }

    if (window.player.activeTool === 'bow' && window.player.isAiming && window.player.isCharging && window.player.inventory.arrows > 0 && !window.player.isDead) {
        let pCX = window.player.x + window.player.width / 2;
        let pCY = window.player.y + 6; 
        let dx = window.mouseWorldX - pCX; let dy = window.mouseWorldY - pCY;
        let angle = Math.atan2(dy, dx);
        let power = 4 + (window.player.chargeLevel / 100) * 6;
        let vx = Math.cos(angle) * power; let vy = Math.sin(angle) * power;
        let pointsToDraw = Math.floor(10 + (window.player.chargeLevel / 100) * 30);

        window.ctx.save();
        window.ctx.lineWidth = 1.5;
        window.ctx.setLineDash([5, 5]);

        let simX = pCX; let simY = pCY; let simVy = vy;
        window.ctx.beginPath(); window.ctx.moveTo(pCX, pCY);
        for (let i = 0; i < pointsToDraw; i++) {
            simX += vx; simVy += window.game.gravity * 0.4; simY += simVy;
            window.ctx.lineTo(simX, simY);
        }
        let grad = window.ctx.createLinearGradient(pCX, pCY, simX, simY);
        grad.addColorStop(0, 'rgba(255, 220, 100, 0.9)');
        grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        window.ctx.strokeStyle = grad;
        window.ctx.stroke();

        window.ctx.setLineDash([]);
        window.ctx.beginPath();
        window.ctx.arc(simX, simY, 4, 0, Math.PI * 2);
        window.ctx.fillStyle = 'rgba(255, 200, 80, 0.6)';
        window.ctx.fill();
        window.ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        window.ctx.lineWidth = 1;
        window.ctx.stroke();

        window.ctx.restore();
    }

    window.projectiles.forEach(pr => {
        if (pr.x + 20 > _visLeft && pr.x - 20 < _visRight + 60) {
            window.ctx.save(); window.ctx.translate(pr.x, pr.y); window.ctx.rotate(pr.angle);
            if (pr.isEnemy) { window.ctx.fillStyle = '#ff4444'; window.ctx.fillRect(-15, -1, 20, 2); window.ctx.fillStyle = '#000'; window.ctx.fillRect(5, -2, 4, 4); } 
            else { window.ctx.fillStyle = '#eee'; window.ctx.fillRect(-15, -1, 20, 2); window.ctx.fillStyle = '#666'; window.ctx.fillRect(5, -2, 4, 4); window.ctx.fillStyle = '#fff'; window.ctx.fillRect(-17, -2, 4, 4); }
            window.ctx.restore();
        }
    });

    window.stuckArrows.forEach(sa => {
        if (sa.x + 20 > _visLeft && sa.x - 20 < _visRight + 60) {
            window.ctx.save();
            window.ctx.translate(sa.x, sa.y);
            window.ctx.rotate(sa.angle);
            window.ctx.fillStyle = '#eee'; window.ctx.fillRect(-15, -1, 20, 2);
            window.ctx.fillStyle = '#666'; window.ctx.fillRect(5, -2, 4, 4);
            window.ctx.fillStyle = '#fff'; window.ctx.fillRect(-17, -2, 4, 4);
            window.ctx.restore();
        }
    });

    window.particles.forEach(p => { window.ctx.globalAlpha = Math.max(0, Math.min(1, p.life)); window.ctx.fillStyle = p.color; window.ctx.fillRect(p.x, p.y, p.size, p.size); });
    window.damageTexts.forEach(dt => {
        window.ctx.globalAlpha = Math.max(0, Math.min(1, dt.life));
        window.ctx.font = 'bold 15px Inter, sans-serif';
        window.ctx.textAlign = 'center';
        if (dt.color === 'melee') {
            window.ctx.strokeStyle = 'rgba(140,0,0,0.95)';
            window.ctx.lineWidth = 3;
            window.ctx.strokeText(dt.text, dt.x, dt.y);
            window.ctx.fillStyle = '#ffffff';
            window.ctx.fillText(dt.text, dt.x, dt.y);
        } else {
            window.ctx.fillStyle = dt.color;
            window.ctx.fillText(dt.text, dt.x, dt.y);
        }
    });
    window.ctx.textAlign = 'left';
    window.ctx.globalAlpha = 1.0; 

    window.ctx.restore(); 

    if (window.lightCtx) {
        window.lightCtx.clearRect(0, 0, window._canvasLogicW, window._canvasLogicH);
        
        let ambientDarkness = darkness * 0.65; 
        window.lightCtx.fillStyle = `rgba(5, 5, 10, ${ambientDarkness})`; 
        window.lightCtx.fillRect(0, 0, window._canvasLogicW, window._canvasLogicH);
        window.lightCtx.globalCompositeOperation = 'destination-out';
        
        const _lz = window.game.zoom || 1;
        const _lW = window._canvasLogicW, _lH = window._canvasLogicH;
        function _wts(wx, wy) { return [(wx - window.camera.x - _lW/2)*_lz + _lW/2, (wy - window.camera.y - _lH/2)*_lz + _lH/2]; }
        
        if (!window.player.isDead && window.player.activeTool === 'torch') {
            let flicker = Math.random() * 20; let pGlowSize = (250 + flicker) * _lz; 
            let [px, py] = _wts(window.player.x + window.player.width/2, window.player.y + window.player.height/2);
            let pGrad = window.lightCtx.createRadialGradient(px, py, 0, px, py, pGlowSize);
            pGrad.addColorStop(0, 'rgba(255, 180, 50, 0.8)'); pGrad.addColorStop(1, 'rgba(255, 150, 50, 0)');
            window.lightCtx.fillStyle = pGrad; window.lightCtx.beginPath(); window.lightCtx.arc(px, py, pGlowSize, 0, Math.PI*2); window.lightCtx.fill();
        }

        if (window.game.isMultiplayer) {
            Object.values(window.otherPlayers).forEach(p => { 
                if (p.id !== window.socket?.id && !p.isDead && p.activeTool === 'torch') {
                    let [cx, cy] = _wts(p.x + (p.width||24)/2, p.y + (p.height||40)/2);
                    let pGlowSize2 = (250 + Math.random()*20) * _lz;
                    let pGrad = window.lightCtx.createRadialGradient(cx, cy, 0, cx, cy, pGlowSize2);
                    pGrad.addColorStop(0, 'rgba(255, 180, 50, 0.8)'); pGrad.addColorStop(1, 'rgba(255, 150, 50, 0)');
                    window.lightCtx.fillStyle = pGrad; window.lightCtx.beginPath(); window.lightCtx.arc(cx, cy, 270*_lz, 0, Math.PI*2); window.lightCtx.fill();
                }
            });
        }

        window.blocks.forEach(b => {
            if (b.type === 'campfire' && b.isBurning) {
                let glow = (250 + Math.random()*10) * _lz; 
                let [bx, by] = _wts(b.x+15, b.y+15);
                let cGrad = window.lightCtx.createRadialGradient(bx, by, 0, bx, by, glow);
                cGrad.addColorStop(0, 'rgba(255, 200, 100, 0.8)'); cGrad.addColorStop(1, 'rgba(255, 200, 100, 0)');
                window.lightCtx.fillStyle = cGrad; window.lightCtx.beginPath(); window.lightCtx.arc(bx, by, glow, 0, Math.PI*2); window.lightCtx.fill();
            }
        });
        window.lightCtx.globalCompositeOperation = 'source-over'; 
        window.ctx.drawImage(window.lightCanvas, 0, 0, window._canvasLogicW, window._canvasLogicH);
    }

    const _ncz = window.game.zoom || 1;
    const _ncW = window._canvasLogicW, _ncH = window._canvasLogicH;
    window.ctx.save(); window.ctx.translate(_ncW/2, _ncH/2); window.ctx.scale(_ncz, _ncz); window.ctx.translate(-_ncW/2, -_ncH/2); window.ctx.translate(-window.camera.x, -window.camera.y);

    const PLAYER_COLORS = ['#4fc3f7','#81c784','#ffb74d','#f06292','#ce93d8','#80cbc4','#fff176','#ff8a65'];
    function playerColor(name) {
        let h = 0; for (let c of (name||'')) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
        return PLAYER_COLORS[h % PLAYER_COLORS.length];
    }

    const activeChatBoxes = [];

    const drawNameAndChat = (charData, isLocal) => {
        if (charData.isDead) return;
        if (!isLocal) { let dist = Math.hypot(window.player.x - charData.x, window.player.y - charData.y); if (dist > 500) return; }

        const pCX = charData.x + (charData.width || 24) / 2;
        const pCY = charData.y + (charData.height || 40); 
        const bob = Math.abs(Math.sin((charData.renderAnimTime || 0) * 3)) * 3; 
        const nameY = pCY - 80 - bob;

        if (!isLocal) {
            const col = playerColor(charData.name);
            window.ctx.fillStyle = col;
            window.ctx.font = 'bold 12px Inter, sans-serif';
            window.ctx.textAlign = 'center';
            window.ctx.shadowColor = 'rgba(0,0,0,0.9)';
            window.ctx.shadowBlur = 4;
            window.ctx.fillText(`${charData.name} (Nv. ${charData.level || 1})`, pCX, nameY);
            window.ctx.shadowBlur = 0;
        }

        if (charData.chatExpires && Date.now() < charData.chatExpires && charData.chatText) {
            window.ctx.font = 'bold 13px Inter, sans-serif';
            const tW = window.ctx.measureText(charData.chatText).width;
            const boxW = tW + 20;
            const boxH = 26;
            const col = playerColor(charData.name);

            let baseY = pCY - 115 - bob;

            let finalY = baseY;
            for (let attempt = 0; attempt < 8; attempt++) {
                let overlaps = false;
                for (const other of activeChatBoxes) {
                    const dx = Math.abs(pCX - other.cx);
                    const dy = Math.abs(finalY - other.cy);
                    if (dx < (boxW/2 + other.w/2 + 8) && dy < (boxH/2 + other.h/2 + 4)) {
                        overlaps = true;
                        break;
                    }
                }
                if (!overlaps) break;
                finalY -= boxH + 6;
            }

            activeChatBoxes.push({ cx: pCX, cy: finalY, w: boxW, h: boxH });

            const bx = pCX - boxW / 2;
            const by = finalY - boxH / 2;

            window.ctx.fillStyle = 'rgba(8,14,24,0.92)';
            window._roundRect(window.ctx, bx, by, boxW, boxH, 7);
            window.ctx.fill();

            window.ctx.strokeStyle = col;
            window.ctx.lineWidth = 1.5;
            window._roundRect(window.ctx, bx, by, boxW, boxH, 7);
            window.ctx.stroke();

            const tx = pCX;
            const ty = by + boxH;
            window.ctx.fillStyle = 'rgba(8,14,24,0.92)';
            window.ctx.beginPath();
            window.ctx.moveTo(tx - 5, ty);
            window.ctx.lineTo(tx + 5, ty);
            window.ctx.lineTo(tx, ty + 7);
            window.ctx.fill();
            window.ctx.strokeStyle = col;
            window.ctx.lineWidth = 1.5;
            window.ctx.beginPath();
            window.ctx.moveTo(tx - 5, ty - 1);
            window.ctx.lineTo(tx, ty + 7);
            window.ctx.lineTo(tx + 5, ty - 1);
            window.ctx.stroke();

            const nameLabel = (charData.name || '?').split(' ')[0];
            window.ctx.textAlign = 'center';
            window.ctx.shadowColor = 'rgba(0,0,0,0.8)';
            window.ctx.shadowBlur = 3;
            if (!isLocal) {
                window.ctx.font = 'bold 10px Inter, sans-serif';
                window.ctx.fillStyle = col;
                window.ctx.fillText(nameLabel + ':', bx + 6 + window.ctx.measureText(nameLabel + ':').width/2, by + 10);
                window.ctx.font = 'bold 13px Inter, sans-serif';
                window.ctx.fillStyle = '#fff';
                window.ctx.fillText(charData.chatText, pCX, by + boxH - 6);
            } else {
                window.ctx.font = 'bold 13px Inter, sans-serif';
                window.ctx.fillStyle = '#fff';
                window.ctx.fillText(charData.chatText, pCX, by + boxH/2 + 5);
            }
            window.ctx.shadowBlur = 0;
        }
    };

    window._roundRect = window._roundRect || function(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    };
    
    if (window.game.isMultiplayer) { Object.values(window.otherPlayers).forEach(p => { if (p.id !== window.socket?.id) drawNameAndChat(p, false); }); }
    if (!window.player.inBackground) drawNameAndChat(window.player, true);
    window.ctx.restore(); 
    window.ctx.restore(); 

    // --- TUTORIAL MODO CONSTRUIR (centrado en pantalla) ---
    if (window.player.activeTool === 'hammer' && !window.player.isDead && !window.player.placementMode) {
        const C = window.ctx;
        const W = window._canvasLogicW || 1280;
        const isStairMode = window.player.buildMode === 'stair';
        const boxW = 300, boxH = isStairMode ? 92 : 72;
        const tutX = (W - boxW) / 2, tutY = 60;
        C.save();
        C.globalAlpha = 0.82;
        C.fillStyle = 'rgba(10,10,10,0.75)';
        window.roundRect(C, tutX, tutY, boxW, boxH, 8);
        C.fill();
        C.globalAlpha = 1;
        C.textAlign = 'center';
        const cx = tutX + boxW / 2;
        C.font = 'bold 12px Inter, sans-serif';
        C.fillStyle = '#f0c040';
        C.fillText('🔨 MODO CONSTRUIR', cx, tutY + 18);
        C.font = '11px Inter, sans-serif';
        C.fillStyle = '#ddd';
        const modeNames = { block: 'Bloque', door: 'Puerta', stair: 'Escalón' };
        C.fillText(`Modo: ${modeNames[window.player.buildMode]}   |   R → cambiar   |   Clic → construir (2 🪵)`, cx, tutY + 36);
        C.fillStyle = '#aaa';
        if (isStairMode) {
            C.fillStyle = '#88ccff';
            C.fillText(`T → espejo  (${window.player.stairMirror ? '◀ sube a la izquierda' : '▶ sube a la derecha'})`, cx, tutY + 54);
            C.fillStyle = '#888';
            C.fillText('Caminar sobre el escalón para subir automáticamente', cx, tutY + 70);
        } else {
            C.fillStyle = '#888';
            C.fillText('Puerta cuesta 4 madera · Bloque/Escalón 2 madera', cx, tutY + 52);
        }
        C.restore();
    }

    if (window.pvp && window.pvp.activeOpponent && window.game.isMultiplayer) {
        const rival = window.otherPlayers && window.otherPlayers[window.pvp.activeOpponent];
        if (rival && !rival.isDead) {
            const rWorldX = rival.x + (rival.width||24)/2;
            const rWorldY = rival.y + (rival.height||40)/2;
            const pWorldX = window.player.x + window.player.width/2;
            const pWorldY = window.player.y + window.player.height/2;

            const _z2 = window.game.zoom || 1;
            const rSX = (rWorldX - window.camera.x - W/2) * _z2 + W/2;
            const rSY = (rWorldY - window.camera.y - H/2) * _z2 + H/2;

            const dist = Math.round(Math.hypot(rWorldX - pWorldX, rWorldY - pWorldY) / 10);
            const offScreen = rSX < 20 || rSX > W - 20 || rSY < 20 || rSY > H - 20;

            window.ctx.save();
            if (offScreen) {
                const angle = Math.atan2(rWorldY - pWorldY, rWorldX - pWorldX);
                const margin = 50;
                const cx2 = W / 2, cy2 = H / 2;
                const tx = cx2 + Math.cos(angle) * (cx2 - margin);
                const ty = cy2 + Math.sin(angle) * (cy2 - margin);
                const clampedX = Math.max(margin, Math.min(W - margin, tx));
                const clampedY = Math.max(margin, Math.min(H - margin, ty));

                window.ctx.translate(clampedX, clampedY);
                window.ctx.rotate(angle);

                window.ctx.fillStyle = 'rgba(180,20,20,0.85)';
                window.ctx.beginPath();
                window.ctx.roundRect(-32, -14, 64, 28, 6);
                window.ctx.fill();

                window.ctx.fillStyle = '#ff6666';
                window.ctx.beginPath();
                window.ctx.moveTo(22, 0); window.ctx.lineTo(10, -8); window.ctx.lineTo(10, 8);
                window.ctx.closePath(); window.ctx.fill();

                window.ctx.rotate(-angle);
                window.ctx.fillStyle = '#fff';
                window.ctx.font = 'bold 11px Inter, sans-serif';
                window.ctx.textAlign = 'center';
                window.ctx.textBaseline = 'middle';
                const rivalName = rival.name ? rival.name.substring(0,8) : '?';
                window.ctx.fillText(`${rivalName} ${dist}m`, 0, 0);
            } else {
                const pulse = Math.sin(window.game.frameCount * 0.12) * 0.3 + 0.85;
                const rivalH = (rival.height||40) * _z2;
                window.ctx.globalAlpha = pulse;
                window.ctx.fillStyle = 'rgba(160,10,10,0.82)';
                window.ctx.beginPath();
                const tagW = 54, tagH = 16, tagX = rSX - tagW/2, tagY = rSY - rivalH/2 - 48;
                window.ctx.roundRect(tagX, tagY, tagW, tagH, 4);
                window.ctx.fill();
                window.ctx.globalAlpha = 1;
                window.ctx.fillStyle = '#ffaaaa';
                window.ctx.font = 'bold 10px Inter, sans-serif';
                window.ctx.textAlign = 'center';
                window.ctx.textBaseline = 'middle';
                window.ctx.fillText(`⚔ ${dist}m`, rSX, tagY + tagH/2);
            }
            window.ctx.restore();

            if (window.game.frameCount % 60 === 0 && window.updatePlayerList) window.updatePlayerList();
        } else if (rival && rival.isDead) {
            window.pvp.activeOpponent = null;
            if(window.addGlobalMessage) window.addGlobalMessage('🏆 ¡Tu rival cayó! Ganaste el duelo.', '#f1c40f');
            if(window.updatePlayerList) window.updatePlayerList();
        }
    }
    
    const _ppW = window._canvasLogicW || 1280;
    const _ppH = window._canvasLogicH || 720;

    {
        const hp = (window.player && window.player.hp != null) ? window.player.hp : 100;
        const maxHp = (window.player && window.player.maxHp) ? window.player.maxHp : 100;
        const hpRatio = hp / maxHp;                    
        const dangerLevel = hpRatio < 0.4 ? Math.pow(1 - hpRatio / 0.4, 1.5) : 0; 

        const dangerPulse = dangerLevel > 0.4 ? 0.7 + 0.3 * Math.sin(window.game.frameCount * 0.08) : 1.0;

        const vigBase = darkness * 0.40;
        const vigOuter = vigBase + dangerLevel * 0.45 * dangerPulse;

        const vigGrad = window.ctx.createRadialGradient(_ppW/2, _ppH/2, _ppH * 0.28, _ppW/2, _ppH/2, _ppH * 0.9);
        vigGrad.addColorStop(0,   'rgba(0,0,0,0)');
        vigGrad.addColorStop(0.55, `rgba(0,0,0,${vigBase * 0.25})`);
        vigGrad.addColorStop(1,    `rgba(0,0,0,${vigOuter})`);
        window.ctx.fillStyle = vigGrad;
        window.ctx.fillRect(0, 0, _ppW, _ppH);

        if (dangerLevel > 0.01) {
            const redAlpha = dangerLevel * 0.38 * dangerPulse;
            const redGrad = window.ctx.createRadialGradient(_ppW/2, _ppH/2, _ppH * 0.22, _ppW/2, _ppH/2, _ppH * 0.88);
            redGrad.addColorStop(0,   'rgba(180,0,0,0)');
            redGrad.addColorStop(0.5, `rgba(160,0,0,${redAlpha * 0.4})`);
            redGrad.addColorStop(1,   `rgba(140,0,0,${redAlpha})`);
            window.ctx.fillStyle = redGrad;
            window.ctx.fillRect(0, 0, _ppW, _ppH);
        }
    }

    if (window.game.screenShake > 0 || (window.player && (window.player.pvpHitFlash||0) > 0)) {
        const aberAmt = window.game.screenShake > 0 ? Math.min(window.game.screenShake * 0.3, 4) : 3;
        window.ctx.globalAlpha = 0.08;
        window.ctx.globalCompositeOperation = 'screen';
        window.ctx.fillStyle = '#ff0000';
        window.ctx.fillRect(-aberAmt, 0, _ppW, _ppH);
        window.ctx.fillStyle = '#0000ff';
        window.ctx.fillRect(aberAmt, 0, _ppW, _ppH);
        window.ctx.globalCompositeOperation = 'source-over';
        window.ctx.globalAlpha = 1;
    }

    {
        const grainAmt = darkness > 0.5 ? 0.045 : 0.015;
        const grainSeed = window.game.frameCount * 7919;
        const gCanvas = window._grainCanvas || (window._grainCanvas = document.createElement('canvas'));
        gCanvas.width = 256; gCanvas.height = 256;
        const gCtx = gCanvas.getContext('2d');
        const imgData = gCtx.createImageData(256, 256);
        const data = imgData.data;
        
        let baseGrainAlpha = Math.floor(darkness * 35);
        
        for (let i = 0; i < data.length; i += 4) {
            const n = ((Math.sin(i * 0.0137 + grainSeed) * 43758.5453) % 1 + 1) % 1;
            const v = (n - 0.5) * 255 * grainAmt * 4;
            data[i] = data[i+1] = data[i+2] = 128 + v;
            data[i+3] = baseGrainAlpha; 
        }
        gCtx.putImageData(imgData, 0, 0);
        const grainPattern = window.ctx.createPattern(gCanvas, 'repeat');
        window.ctx.globalCompositeOperation = 'overlay';
        window.ctx.globalAlpha = 1;
        window.ctx.fillStyle = grainPattern;
        window.ctx.fillRect(0, 0, _ppW, _ppH);
        window.ctx.globalCompositeOperation = 'source-over';
    }

    if (window.game.isRaining) {
        const fc = window.game.frameCount;
        window.ctx.save();
        window.ctx.lineWidth = 1;
        window.ctx.beginPath();
        window.ctx.strokeStyle = 'rgba(180,210,240,0.35)';
        for (let i = 0; i < 200; i++) {
            const rx = ((i * 173 + fc * 9) % (_ppW + 60)) - 30;
            const ry = ((i * 97  + fc * 20) % _ppH);
            window.ctx.moveTo(rx, ry);
            window.ctx.lineTo(rx - 4, ry + 22);
        }
        window.ctx.stroke();
        window.ctx.lineWidth = 1.5;
        window.ctx.strokeStyle = 'rgba(200,225,255,0.22)';
        window.ctx.beginPath();
        for (let i = 0; i < 80; i++) {
            const rx = ((i * 311 + fc * 5) % (_ppW + 60)) - 30;
            const ry = ((i * 153 + fc * 14) % _ppH);
            window.ctx.moveTo(rx, ry);
            window.ctx.lineTo(rx - 5, ry + 30);
        }
        window.ctx.stroke();
        window.ctx.restore();
        window.ctx.fillStyle = 'rgba(40,60,90,0.04)';
        window.ctx.fillRect(0, 0, _ppW, _ppH);
    }

    {
        window.ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        window.ctx.lineWidth = 3;
        window.ctx.strokeRect(1, 1, _ppW - 2, _ppH - 2);
    }
};
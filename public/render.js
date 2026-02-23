// === render.js - LÓGICA DE DIBUJADO Y RIGGING ===

window.roundRect = function(ctx, x, y, width, height, radius) {
    ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.lineTo(x + width - radius, y); ctx.quadraticCurveTo(x + width, y, x + width, y + radius); ctx.lineTo(x + width, y + height - radius); ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height); ctx.lineTo(x + radius, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - radius); ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y); ctx.closePath(); ctx.fill();
};

window.drawCharacter = function(charData, isLocal) {
    if (!window.ctx || charData.isDead) return;
    window.ctx.save();
    
    const pCX = charData.x + (charData.width || 24) / 2;
    const pCY = charData.y + (charData.height || 48); 
    window.ctx.translate(pCX, pCY);
    
    if (isLocal && charData.isStealth) { window.ctx.globalAlpha = 0.3; } 
    else if (charData.inBackground) { window.ctx.globalAlpha = 0.5; window.ctx.scale(0.9, 0.9); }

    let targetX = isLocal ? window.mouseWorldX : (charData.mouseX || pCX);
    let targetY = isLocal ? window.mouseWorldY : (charData.mouseY || pCY);
    let isFacingR = charData.facingRight; 
    if (charData.activeTool === 'bow' && charData.isAiming) isFacingR = targetX >= pCX;
    if (!isFacingR) window.ctx.scale(-1, 1); 
    
    let isJumping = false; let isRunning = false;
    
    if (isLocal) {
        isJumping = !charData.isGrounded;
        isRunning = Math.abs(charData.vx || 0) > 0.1 && !isJumping;
        charData.renderAnimTime = charData.animTime; 
    } else {
        let dx = Math.abs(charData.x - (charData.lastX || charData.x)); charData.lastX = charData.x;
        if (dx > 0.1) charData.isMovingFrames = 10; else if (charData.isMovingFrames > 0) charData.isMovingFrames--;
        let dy = charData.y - (charData.lastY || charData.y); charData.lastY = charData.y;
        if (Math.abs(dy) > 0.5) charData.isJumpingFrames = 10; else if (charData.isJumpingFrames > 0) charData.isJumpingFrames--;
        isJumping = charData.isJumpingFrames > 0; isRunning = charData.isMovingFrames > 0 && !isJumping;
        if (isRunning) charData.renderAnimTime = (charData.renderAnimTime || 0) + 0.033; 
        else charData.renderAnimTime = 0;
    }

    let time = (charData.renderAnimTime || 0) * 1.0;  // era 1.5 - más lento
    let legR = 0, legL = 0, kneeR = 0, kneeL = 0, armR = 0, armL = 0, elbowR = 0, elbowL = 0, torsoR = 0, headR = 0, bob = 0;

    if (isJumping) {
        legR = -0.5; kneeR = 0.8; legL = 0.3; kneeL = 0.1; armR = -2.5; elbowR = -0.2; armL = -1.5; elbowL = -0.5; torsoR = 0.1; headR = -0.2; bob = -4;
    } else if (isRunning) {
        legR = Math.sin(time) * 0.85; kneeR = Math.max(0, Math.sin(time - Math.PI/2) * 1.2); legL = Math.sin(time + Math.PI) * 0.85; kneeL = Math.max(0, Math.sin(time + Math.PI/2) * 1.2);
        armR = Math.cos(time) * 0.85; elbowR = -0.2 + Math.sin(time)*0.35; armL = Math.cos(time + Math.PI) * 0.85; elbowL = -0.2 + Math.sin(time + Math.PI)*0.35;
        torsoR = 0.12; headR = -0.04; bob = Math.abs(Math.sin(time * 2)) * 2.5;
    } else {
        let idleTime = window.game.frameCount * 0.03; // era 0.05 - respira más despacio
        torsoR = Math.sin(idleTime) * 0.02; headR = Math.sin(idleTime - 1) * 0.03; armR = 0.1 + Math.sin(idleTime) * 0.03; armL = -0.1 - Math.sin(idleTime) * 0.03; elbowR = -0.1; elbowL = -0.1; bob = Math.sin(idleTime) * 1;
    }

    let aimAngle = 0;
    if (charData.activeTool === 'torch') {
        armR = -Math.PI / 2.5; elbowR = -0.3; 
    } else if (charData.activeTool === 'bow' && charData.isAiming) {
        aimAngle = Math.atan2(targetY - (pCY - 42 - bob), isFacingR ? (targetX - pCX) : -(targetX - pCX));
        armR = aimAngle - Math.PI/2; elbowR = 0; armL = aimAngle - Math.PI/2 + 0.3; elbowL = -1.5; torsoR = aimAngle * 0.2; headR = aimAngle * 0.3;
    } else if (charData.attackFrame > 0) {
        // attackFrame = 22, animación más lenta y pesada
        let progress = charData.attackFrame / 22; armR = -Math.PI * 0.9 * progress + (1 - progress) * 0.8; elbowR = -0.2; torsoR += 0.3 * progress; 
    }

    let skin = charData.isHit ? '#ff4444' : '#f1c27d'; let shirt = charData.isHit ? '#ff4444' : (isLocal ? '#3498db' : '#686868'); let shirtDark = charData.isHit ? '#cc0000' : (isLocal ? '#2980b9' : '#4a4a4a');
    let pants = '#2c3e50'; let pantsDark = '#1a252f'; let shoes = '#222'; let shoesDark = '#111';
    if (charData.inBackground) { skin='#888'; shirt='#666'; shirtDark='#555'; pants='#444'; pantsDark='#333'; }

    window.ctx.translate(0, -bob);

    window.ctx.save(); window.ctx.translate(-3, -24); window.ctx.rotate(legL); window.ctx.fillStyle = pantsDark; window.roundRect(window.ctx, -4.5, 0, 9, 14, 4); window.ctx.translate(0, 12); window.ctx.rotate(kneeL); window.ctx.fillStyle = pantsDark; window.roundRect(window.ctx, -3.5, 0, 7, 14, 3); window.ctx.fillStyle = shoesDark; window.roundRect(window.ctx, -4.5, 12, 11, 5, 2); window.ctx.restore();
    window.ctx.save(); window.ctx.translate(0, -24); window.ctx.rotate(torsoR); window.ctx.save(); window.ctx.translate(2, -20); window.ctx.rotate(armL); window.ctx.fillStyle = shirtDark; window.roundRect(window.ctx, -3.5, 0, 7, 12, 3); window.ctx.translate(0, 10); window.ctx.rotate(elbowL); window.ctx.fillStyle = skin; window.roundRect(window.ctx, -2.5, 0, 5, 10, 2); window.ctx.restore(); window.ctx.fillStyle = shirt; window.roundRect(window.ctx, -9, -22, 18, 24, 6); window.ctx.save(); window.ctx.translate(0, -24); window.ctx.rotate(headR); window.ctx.fillStyle = skin; window.roundRect(window.ctx, -10, -18, 20, 20, 8); window.ctx.fillStyle = '#333'; window.ctx.fillRect(4, -10, 3, 4); window.ctx.fillStyle = '#3E2723'; window.ctx.beginPath(); window.ctx.arc(0, -14, 11, Math.PI, 0); window.ctx.fill(); window.ctx.restore(); window.ctx.restore(); 
    window.ctx.save(); window.ctx.translate(3, -24); window.ctx.rotate(legR); window.ctx.fillStyle = pants; window.roundRect(window.ctx, -4.5, 0, 9, 14, 4); window.ctx.translate(0, 12); window.ctx.rotate(kneeR); window.ctx.fillStyle = pants; window.roundRect(window.ctx, -3.5, 0, 7, 14, 3); window.ctx.fillStyle = shoes; window.roundRect(window.ctx, -4.5, 12, 11, 5, 2); window.ctx.restore();
    window.ctx.save(); window.ctx.translate(0, -24); window.ctx.rotate(torsoR); window.ctx.translate(-3, -20); window.ctx.rotate(armR); window.ctx.fillStyle = shirt; window.roundRect(window.ctx, -3.5, 0, 7, 12, 3); window.ctx.translate(0, 10); window.ctx.rotate(elbowR); window.ctx.fillStyle = skin; window.roundRect(window.ctx, -2.5, 0, 5, 10, 2);
    
    window.ctx.translate(0, 8); 
    if (charData.activeTool === 'bow') {
        window.ctx.rotate(Math.PI/2); window.ctx.strokeStyle = charData.inBackground ? '#4a250a' : '#8B4513'; window.ctx.lineWidth = 3; window.ctx.beginPath(); window.ctx.arc(0, 0, 15, -Math.PI/2.5, Math.PI/2.5); window.ctx.stroke();
        let pull = charData.isAiming ? ((charData.chargeLevel || 0) / 100) * 15 : 0; window.ctx.strokeStyle = '#eee'; window.ctx.lineWidth = 1; window.ctx.beginPath(); window.ctx.moveTo(4.6, -14.2); window.ctx.lineTo(4.6 - pull, 0); window.ctx.lineTo(4.6, 14.2); window.ctx.stroke();
        if (charData.isCharging && (isLocal ? charData.inventory.arrows > 0 : true)) { window.ctx.fillStyle = '#eee'; window.ctx.fillRect(4.6 - pull, -1, 20 + pull, 2); window.ctx.fillStyle = '#666'; window.ctx.fillRect(4.6 - pull + 20 + pull, -2, 4, 4); }
    } else if (charData.activeTool === 'torch') {
        window.ctx.rotate(Math.PI/2); 
        window.ctx.fillStyle = charData.inBackground ? '#4a250a' : '#8B4513'; window.ctx.fillRect(-2, -20, 4, 25);
        let fSize = 5 + Math.random() * 3;
        window.ctx.fillStyle = charData.inBackground ? '#888' : '#e67e22'; window.ctx.beginPath(); window.ctx.arc(0, -22, fSize, 0, Math.PI*2); window.ctx.fill();
        window.ctx.fillStyle = charData.inBackground ? '#aaa' : '#f1c40f'; window.ctx.beginPath(); window.ctx.arc(0, -22, fSize*0.6, 0, Math.PI*2); window.ctx.fill();
    } else if (charData.activeTool && charData.activeTool !== 'hand') {
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
    let darkness = (Math.cos((hourFloat / 24) * Math.PI * 2) + 1) / 2;

    // ── CIELO CON GRADIENTE ───────────────────────────────────────────────
    let r = Math.floor(135 - (130 * darkness));
    let g = Math.floor(206 - (200 * darkness));
    let b = Math.floor(235 - (215 * darkness));
    if (window.game.isRaining) { r = Math.max(28, r - 65); g = Math.max(38, g - 65); b = Math.max(50, b - 45); }

    let skyGrad = window.ctx.createLinearGradient(0, 0, 0, window.game.groundLevel);
    if (darkness < 0.3) {
        skyGrad.addColorStop(0, `rgb(${r},${g},${b})`);
        skyGrad.addColorStop(0.5, `rgb(${Math.min(255,r+30)},${Math.min(255,g+20)},${Math.min(255,b+10)})`);
        skyGrad.addColorStop(1, `rgb(${Math.min(255,r+60)},${Math.min(255,g+45)},${Math.min(255,b+20)})`);
    } else if (darkness < 0.6) {
        skyGrad.addColorStop(0, `rgb(${r},${g},${b})`);
        skyGrad.addColorStop(0.4, `rgb(${Math.min(255,r+40)},${Math.min(255,g+25)},${Math.min(255,b-10)})`);
        skyGrad.addColorStop(1, `rgb(${Math.min(255,r+80)},${Math.min(255,g+50)},${Math.min(255,b)})`);
    } else {
        skyGrad.addColorStop(0, `rgb(${r},${g},${b})`);
        skyGrad.addColorStop(1, `rgb(${Math.max(0,r+15)},${Math.max(0,g+10)},${Math.max(0,b+20)})`);
    }
    window.ctx.fillStyle = skyGrad;
    window.ctx.fillRect(0, 0, W, H);

    window.ctx.save(); 
    if (window.game.screenShake > 0) {
        let dx = (Math.random() - 0.5) * window.game.screenShake;
        let dy = (Math.random() - 0.5) * window.game.screenShake;
        window.ctx.translate(dx, dy);
    }
    
    // ── ESTRELLAS ──────────────────────────────────────────────────────────
    if (darkness > 0.45 && !window.game.isRaining) {
        let starAlpha = Math.min(1, (darkness - 0.45) * 3);
        window.stars.forEach(st => {
            let twinkle = 0.5 + 0.5 * Math.sin(window.game.frameCount * 0.05 + st.x * 0.1);
            window.ctx.globalAlpha = starAlpha * (0.6 + 0.4 * twinkle);
            window.ctx.fillStyle = '#fff';
            window.ctx.fillRect(st.x, st.y, st.s * 0.8, st.s * 0.8);
        });
        window.ctx.globalAlpha = 1;
    }

    // ── SOL ────────────────────────────────────────────────────────────────
    if (hourFloat > 5 && hourFloat < 19) {
        let dayProgress = (hourFloat - 5) / 14;
        let sunX = W * dayProgress;
        let sunY = H * 0.8 - Math.sin(dayProgress * Math.PI) * (H * 0.7);
        if (!window.game.isRaining) {
            let haloGrad = window.ctx.createRadialGradient(sunX, sunY, 30, sunX, sunY, 120);
            haloGrad.addColorStop(0, 'rgba(255,220,80,0.25)');
            haloGrad.addColorStop(1, 'rgba(255,150,30,0)');
            window.ctx.fillStyle = haloGrad;
            window.ctx.beginPath(); window.ctx.arc(sunX, sunY, 120, 0, Math.PI*2); window.ctx.fill();
        }
        window.ctx.fillStyle = '#FFE566';
        window.ctx.shadowColor = '#FF9500'; window.ctx.shadowBlur = window.game.isRaining ? 8 : 45;
        window.ctx.beginPath(); window.ctx.arc(sunX, sunY, 42, 0, Math.PI*2); window.ctx.fill();
        window.ctx.fillStyle = '#FFF5A0';
        window.ctx.shadowBlur = 0;
        window.ctx.beginPath(); window.ctx.arc(sunX - 6, sunY - 8, 28, 0, Math.PI*2); window.ctx.fill();
        window.ctx.shadowBlur = 0;
    }

    // ── LUNA ───────────────────────────────────────────────────────────────
    if (hourFloat >= 17 || hourFloat <= 7) {
        let nightProgress = hourFloat >= 17 ? (hourFloat - 17) / 14 : (hourFloat + 7) / 14;
        let moonX = W * nightProgress;
        let moonY = H * 0.8 - Math.sin(nightProgress * Math.PI) * (H * 0.7);
        window.ctx.fillStyle = '#E8EEE0';
        window.ctx.shadowColor = '#CCDDFF'; window.ctx.shadowBlur = window.game.isRaining ? 4 : 30;
        window.ctx.beginPath(); window.ctx.arc(moonX, moonY, 32, 0, Math.PI*2); window.ctx.fill();
        window.ctx.shadowBlur = 0;
        window.ctx.fillStyle = 'rgba(0,0,0,0.08)';
        [[- 8, 6, 7], [11, -7, 5], [2, 11, 5], [-4, -10, 4]].forEach(([ox, oy, or]) => {
            window.ctx.beginPath(); window.ctx.arc(moonX + ox, moonY + oy, or, 0, Math.PI*2); window.ctx.fill();
        });
        window.ctx.shadowBlur = 0;
    }

    // ── NUBES ──────────────────────────────────────────────────────────────
    window.clouds.forEach(c => {
        c.x += c.v; if (c.x > W + 150) c.x = -150;
        let cloudAlpha = window.game.isRaining ? 0.75 : Math.max(0, 0.7 * (1 - darkness * 1.2));
        if (cloudAlpha <= 0) return;
        window.ctx.save();
        window.ctx.globalAlpha = cloudAlpha;
        window.ctx.fillStyle = window.game.isRaining ? 'rgba(70,80,100,0.6)' : 'rgba(200,215,240,0.4)';
        window.ctx.beginPath();
        window.ctx.arc(c.x + 2, c.y + 6, 28*c.s, 0, Math.PI*2);
        window.ctx.arc(c.x + 27*c.s + 2, c.y - 13*c.s + 6, 33*c.s, 0, Math.PI*2);
        window.ctx.arc(c.x + 52*c.s + 2, c.y + 6, 23*c.s, 0, Math.PI*2);
        window.ctx.fill();
        window.ctx.fillStyle = window.game.isRaining ? 'rgba(110,120,140,0.85)' : 'rgba(255,255,255,0.88)';
        window.ctx.beginPath();
        window.ctx.arc(c.x, c.y, 28*c.s, 0, Math.PI*2);
        window.ctx.arc(c.x + 25*c.s, c.y - 14*c.s, 33*c.s, 0, Math.PI*2);
        window.ctx.arc(c.x + 50*c.s, c.y, 23*c.s, 0, Math.PI*2);
        window.ctx.fill();
        if (!window.game.isRaining) {
            window.ctx.fillStyle = 'rgba(255,255,255,0.5)';
            window.ctx.beginPath();
            window.ctx.arc(c.x + 22*c.s, c.y - 18*c.s, 18*c.s, 0, Math.PI*2);
            window.ctx.fill();
        }
        window.ctx.restore();
    });

    // ── MONTAÑAS LEJANAS (parallax 0.05x) ─────────────────────────────────
    let mCol1 = `rgb(${Math.max(5,r-50)},${Math.max(5,g-50)},${Math.max(15,b-30)})`;
    let mCol2 = `rgb(${Math.max(5,r-35)},${Math.max(5,g-35)},${Math.max(15,b-18)})`;
    window.ctx.fillStyle = mCol1;
    window.ctx.beginPath();
    let mX = -(window.camera.x * 0.05) % 900;
    for (let i = -1; i < 5; i++) {
        let bx = mX + i * 900;
        window.ctx.moveTo(bx, window.game.groundLevel);
        window.ctx.lineTo(bx + 120, window.game.groundLevel - 260);
        window.ctx.lineTo(bx + 280, window.game.groundLevel - 210);
        window.ctx.lineTo(bx + 420, window.game.groundLevel - 320);
        window.ctx.lineTo(bx + 600, window.game.groundLevel - 180);
        window.ctx.lineTo(bx + 750, window.game.groundLevel - 240);
        window.ctx.lineTo(bx + 900, window.game.groundLevel);
    }
    window.ctx.fill();
    if (darkness < 0.7) {
        window.ctx.fillStyle = `rgba(255,255,255,${0.25 * (1-darkness)})`;
        window.ctx.beginPath();
        for (let i = -1; i < 5; i++) {
            let bx = mX + i * 900;
            [[120,260,50],[420,320,60],[750,240,45]].forEach(([px, py, pw]) => {
                window.ctx.moveTo(bx+px, window.game.groundLevel - py);
                window.ctx.lineTo(bx+px-pw*0.5, window.game.groundLevel - py + pw*0.7);
                window.ctx.lineTo(bx+px+pw*0.5, window.game.groundLevel - py + pw*0.7);
            });
        }
        window.ctx.fill();
    }

    // ── COLINAS MEDIAS (parallax 0.2x) ────────────────────────────────────
    window.ctx.fillStyle = mCol2;
    window.ctx.beginPath();
    let hX = -(window.camera.x * 0.2) % 1000;
    for (let i = -1; i < 4; i++) {
        let bx = hX + i * 1000;
        window.ctx.moveTo(bx, window.game.groundLevel);
        window.ctx.bezierCurveTo(bx + 100, window.game.groundLevel - 80, bx + 200, window.game.groundLevel - 130, bx + 350, window.game.groundLevel - 100);
        window.ctx.bezierCurveTo(bx + 500, window.game.groundLevel - 70, bx + 650, window.game.groundLevel - 160, bx + 800, window.game.groundLevel - 90);
        window.ctx.bezierCurveTo(bx + 900, window.game.groundLevel - 50, bx + 950, window.game.groundLevel - 30, bx + 1000, window.game.groundLevel);
    }
    window.ctx.fill();

    window.ctx.translate(-window.camera.x, -window.camera.y);

    // ── SUELO ──────────────────────────────────────────────────────────────
    const gL = window.game.groundLevel;
    const startX = Math.max(window.camera.x, window.game.shoreX);
    const endX = window.camera.x + W + 100;

    let grassGrad = window.ctx.createLinearGradient(0, gL, 0, gL + 16);
    grassGrad.addColorStop(0, window.game.isRaining ? '#3d6b24' : '#528c2a');
    grassGrad.addColorStop(1, window.game.isRaining ? '#2d5019' : '#3a6b1e');
    window.ctx.fillStyle = grassGrad;
    window.ctx.fillRect(startX, gL, endX - startX, 16);

    let dirtGrad = window.ctx.createLinearGradient(0, gL + 16, 0, gL + 80);
    dirtGrad.addColorStop(0, '#6b4226');
    dirtGrad.addColorStop(0.4, '#5a3620');
    dirtGrad.addColorStop(1, '#3d2412');
    window.ctx.fillStyle = dirtGrad;
    window.ctx.fillRect(startX, gL + 16, endX - startX, H - gL - 16);

    window.ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    window.ctx.lineWidth = 1;
    [30, 50, 75].forEach(dy => {
        window.ctx.beginPath();
        window.ctx.moveTo(startX, gL + dy);
        window.ctx.lineTo(endX, gL + dy);
        window.ctx.stroke();
    });

    if (darkness < 0.8) {
        window.ctx.fillStyle = 'rgba(80,120,40,0.6)';
        for (let px = startX - ((startX) % 80); px < endX; px += 80) {
            let seed = Math.sin(px * 0.017) * 0.5 + 0.5;
            let grassH = 4 + seed * 6;
            window.ctx.fillRect(px + seed * 30, gL - grassH, 2, grassH);
            window.ctx.fillRect(px + seed * 55, gL - grassH * 0.7, 2, grassH * 0.7);
        }
    }
    
    // ── AGUA / ORILLA ──────────────────────────────────────────────────────
    if (window.camera.x < window.game.shoreX) {
        window.ctx.fillStyle = '#C8B878';
        window.ctx.fillRect(window.game.shoreX - 70, gL, 70, H - gL);
        let waveOffset = Math.sin(window.game.frameCount * 0.04) * 6;
        let waterGrad = window.ctx.createLinearGradient(0, gL, 0, gL + 60);
        waterGrad.addColorStop(0, '#1a8fc0');
        waterGrad.addColorStop(1, '#0a5c8a');
        window.ctx.fillStyle = waterGrad;
        window.ctx.fillRect(window.camera.x, gL + 16 + waveOffset, window.game.shoreX - 70 - window.camera.x, H - gL);
        window.ctx.fillStyle = 'rgba(100,200,255,0.4)';
        window.ctx.fillRect(window.camera.x, gL + 6 + waveOffset, window.game.shoreX - 70 - window.camera.x, 12);
        window.ctx.fillStyle = 'rgba(255,255,255,0.6)';
        window.ctx.fillRect(window.game.shoreX - 70 - 5, gL + 8, 5, 8);
    }

    window.rocks.forEach(r => {
        if (r.x + r.width > window.camera.x && r.x < window.camera.x + window._canvasLogicW) {
            window.ctx.save();
            if (r.isHit) {
                window.ctx.fillStyle = '#ff4444';
                window.ctx.beginPath();
                window.ctx.moveTo(r.x, r.y + r.height);
                window.ctx.lineTo(r.x + r.width * 0.2, r.y);
                window.ctx.lineTo(r.x + r.width * 0.8, r.y + 5);
                window.ctx.lineTo(r.x + r.width, r.y + r.height);
                window.ctx.fill();
            } else {
                let darkGrad = window.ctx.createLinearGradient(r.x, r.y, r.x + r.width, r.y + r.height);
                darkGrad.addColorStop(0, '#5a5a5a');
                darkGrad.addColorStop(1, '#2e2e2e');
                window.ctx.fillStyle = darkGrad;
                window.ctx.beginPath();
                window.ctx.moveTo(r.x, r.y + r.height);
                window.ctx.lineTo(r.x + r.width * 0.2, r.y);
                window.ctx.lineTo(r.x + r.width * 0.8, r.y + 5);
                window.ctx.lineTo(r.x + r.width, r.y + r.height);
                window.ctx.fill();

                let lightGrad = window.ctx.createLinearGradient(r.x, r.y, r.x + r.width * 0.6, r.y + r.height * 0.6);
                lightGrad.addColorStop(0, '#9e9e9e');
                lightGrad.addColorStop(0.5, '#757575');
                lightGrad.addColorStop(1, '#616161');
                window.ctx.fillStyle = lightGrad;
                window.ctx.beginPath();
                window.ctx.moveTo(r.x, r.y + r.height);
                window.ctx.lineTo(r.x + r.width * 0.2, r.y);
                window.ctx.lineTo(r.x + r.width * 0.55, r.y + r.height * 0.35);
                window.ctx.lineTo(r.x + r.width * 0.15, r.y + r.height);
                window.ctx.fill();

                window.ctx.fillStyle = 'rgba(200,200,210,0.55)';
                window.ctx.beginPath();
                window.ctx.moveTo(r.x + r.width * 0.18, r.y + 2);
                window.ctx.lineTo(r.x + r.width * 0.82, r.y + 6);
                window.ctx.lineTo(r.x + r.width * 0.55, r.y + r.height * 0.38);
                window.ctx.lineTo(r.x + r.width * 0.2, r.y + r.height * 0.22);
                window.ctx.fill();

                window.ctx.strokeStyle = 'rgba(20,20,20,0.25)';
                window.ctx.lineWidth = 1;
                window.ctx.beginPath();
                window.ctx.moveTo(r.x + r.width * 0.2, r.y);
                window.ctx.lineTo(r.x + r.width * 0.55, r.y + r.height * 0.35);
                window.ctx.stroke();

                window.ctx.fillStyle = 'rgba(80,110,50,0.3)';
                window.ctx.beginPath();
                window.ctx.ellipse(r.x + r.width * 0.35, r.y + r.height - 2, r.width * 0.22, 4, -0.3, 0, Math.PI*2);
                window.ctx.fill();
            }

            if (r.hp < r.maxHp && (Date.now() - (r.lastHitTime || 0) < 3000)) {
                window.ctx.fillStyle = 'rgba(0,0,0,0.6)';
                window.ctx.fillRect(r.x, r.y - 12, r.width, 6);
                window.ctx.fillStyle = '#4CAF50';
                window.ctx.fillRect(r.x + 1, r.y - 11, (r.hp / r.maxHp) * (r.width - 2), 4);
            }
            window.ctx.restore();
        }
    });

    window.trees.forEach(t => {
        if (t.x + t.width > window.camera.x && t.x < window.camera.x + window._canvasLogicW) {
            let isHitColor = t.isHit ? '#ff4444' : null;
            window.ctx.save();
            window.ctx.translate(t.x + t.width/2, t.y + t.height);
            let hw = t.width / 2; let th = t.height;

            if (t.isStump) {
                let stumpH = 15 + t.width * 0.22;
                let trunkGrad = window.ctx.createLinearGradient(-hw*0.6, 0, hw*0.6, 0);
                trunkGrad.addColorStop(0, '#2d1a0e'); trunkGrad.addColorStop(0.4, '#5D4037'); trunkGrad.addColorStop(1, '#3E2723');
                window.ctx.fillStyle = isHitColor || trunkGrad;
                window.ctx.fillRect(-hw*0.6, -stumpH, hw*1.2, stumpH);
                window.ctx.fillStyle = isHitColor || '#c8a882';
                window.ctx.beginPath(); window.ctx.ellipse(0, -stumpH, hw*0.62, 4, 0, 0, Math.PI*2); window.ctx.fill();
                window.ctx.restore(); return;
            }

            let trunkGrad = window.ctx.createLinearGradient(-hw*0.5, 0, hw*0.5, 0);
            if(t.type === 2) { trunkGrad.addColorStop(0, '#bdbdbd'); trunkGrad.addColorStop(0.5, '#eeeeee'); trunkGrad.addColorStop(1, '#9e9e9e'); }
            else { trunkGrad.addColorStop(0, '#2d1a0e'); trunkGrad.addColorStop(0.5, '#5D4037'); trunkGrad.addColorStop(1, '#3E2723'); }
            
            window.ctx.fillStyle = isHitColor || trunkGrad;
            window.ctx.beginPath();
            window.ctx.moveTo(-hw*0.4, 0); window.ctx.lineTo(-hw*0.2, -th*0.8);
            window.ctx.lineTo(hw*0.2, -th*0.8); window.ctx.lineTo(hw*0.4, 0);
            window.ctx.fill();

            if(t.type === 2 && !isHitColor) {
                window.ctx.fillStyle = '#3E2723';
                window.ctx.fillRect(-hw*0.2, -th*0.6, hw*0.3, 2);
                window.ctx.fillRect(-hw*0.1, -th*0.3, hw*0.4, 3);
            }

            if (t.type === 0 || t.type === 2) {
                window.ctx.lineWidth = 4; window.ctx.strokeStyle = isHitColor || trunkGrad;
                window.ctx.beginPath(); window.ctx.moveTo(0, -th*0.4); window.ctx.lineTo(-t.width, -th*0.6); window.ctx.stroke();
                window.ctx.beginPath(); window.ctx.moveTo(0, -th*0.5); window.ctx.lineTo(t.width, -th*0.7); window.ctx.stroke();
            }

            if (t.type === 0 || t.type === 2) {
                let baseColor = t.type === 0 ? '#1B5E20' : '#33691E';
                let midColor = t.type === 0 ? '#2E7D32' : '#558B2F';
                let lightColor = t.type === 0 ? '#4CAF50' : '#8BC34A';

                let cy = -th * 0.75; 
                let cw = t.width; 

                const drawCanopy = (color, scale) => {
                    window.ctx.fillStyle = isHitColor || color;
                    window.ctx.beginPath();
                    window.ctx.arc(0, cy, cw * 1.1 * scale, 0, Math.PI*2); 
                    window.ctx.arc(-cw * 0.7 * scale, cy + cw * 0.2 * scale, cw * 0.8 * scale, 0, Math.PI*2); 
                    window.ctx.arc(cw * 0.7 * scale, cy + cw * 0.2 * scale, cw * 0.8 * scale, 0, Math.PI*2); 
                    window.ctx.arc(-cw * 0.45 * scale, cy - cw * 0.4 * scale, cw * 0.7 * scale, 0, Math.PI*2); 
                    window.ctx.arc(cw * 0.45 * scale, cy - cw * 0.4 * scale, cw * 0.7 * scale, 0, Math.PI*2); 
                    window.ctx.fill(); 
                };

                drawCanopy(baseColor, 1.0);
                drawCanopy(midColor, 0.8);

                window.ctx.fillStyle = isHitColor || lightColor;
                window.ctx.beginPath();
                window.ctx.arc(-cw * 0.3, cy - cw * 0.25, cw * 0.45, 0, Math.PI*2);
                window.ctx.arc(cw * 0.15, cy - cw * 0.4, cw * 0.35, 0, Math.PI*2);
                window.ctx.fill();

            } else if (t.type === 1) {  
                for (let i = 0; i < 4; i++) {
                    let layerW = t.width * 1.5 - (i * (t.width * 0.35));
                    let yPos = -th * 0.3 - (i * (th * 0.7 / 3)); 
                    
                    window.ctx.fillStyle = isHitColor || '#1B5E20';
                    window.ctx.beginPath(); 
                    window.ctx.moveTo(0, yPos - th*0.25); 
                    window.ctx.lineTo(-layerW, yPos + th*0.15); 
                    window.ctx.lineTo(layerW, yPos + th*0.15); 
                    window.ctx.fill();
                    
                    if(!isHitColor) {
                        window.ctx.fillStyle = '#2E7D32';
                        window.ctx.beginPath(); 
                        window.ctx.moveTo(0, yPos - th*0.25); 
                        window.ctx.lineTo(-layerW*0.85, yPos + th*0.15); 
                        window.ctx.lineTo(0, yPos + th*0.12); 
                        window.ctx.fill();
                    }
                }
            }

            if (t.hp < t.maxHp && (Date.now() - (t.lastHitTime || 0) < 3000)) {
                window.ctx.fillStyle = 'rgba(0,0,0,0.6)'; window.ctx.fillRect(-hw-5, -th - 30, t.width + 10, 7);
                window.ctx.fillStyle = '#4CAF50'; window.ctx.fillRect(-hw-4, -th - 29, (t.hp / t.maxHp) * (t.width + 8), 5);
            }
            window.ctx.restore();
        }
    });

    window.blocks.forEach(b => {
        if (b.x + window.game.blockSize > window.camera.x && b.x < window.camera.x + window._canvasLogicW) {
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
                window.ctx.fillStyle = '#e0e0e0'; window.ctx.fillRect(b.x + 2, b.y + 16, 10, 4); window.ctx.fillStyle = '#c0392b'; window.ctx.fillRect(b.x + 12, b.y + 16, 18, 4);
            } else if (b.type === 'grave') {
                window.ctx.fillStyle = b.isHit ? '#ff4444' : '#7f8c8d'; window.ctx.fillRect(b.x + 12, b.y + 5, 6, 25); window.ctx.fillRect(b.x + 5, b.y + 12, 20, 6); 
                window.ctx.fillStyle = '#fff'; window.ctx.font = 'bold 8px Inter, sans-serif'; window.ctx.textAlign = 'center'; window.ctx.fillText("RIP", b.x + 15, b.y + 17);
            } else if (b.type === 'barricade') {
                window.ctx.fillStyle = '#5D4037';
                window.ctx.fillRect(b.x + 2, b.y + 24, 26, 6); 
                window.ctx.fillStyle = b.isHit ? '#ff4444' : '#bdc3c7'; 
                window.ctx.beginPath();
                window.ctx.moveTo(b.x + 5, b.y + 24); window.ctx.lineTo(b.x + 2, b.y + 5); window.ctx.lineTo(b.x + 10, b.y + 24);
                window.ctx.moveTo(b.x + 12, b.y + 24); window.ctx.lineTo(b.x + 15, b.y + 2); window.ctx.lineTo(b.x + 18, b.y + 24);
                window.ctx.moveTo(b.x + 20, b.y + 24); window.ctx.lineTo(b.x + 28, b.y + 8); window.ctx.lineTo(b.x + 25, b.y + 24);
                window.ctx.fill();
            }
        }
    });

    window.droppedItems.forEach(item => {
        if (item.x + 20 > window.camera.x && item.x < window.camera.x + window._canvasLogicW) {
            window.ctx.fillStyle = window.itemDefs[item.type] ? window.itemDefs[item.type].color : '#fff'; let s = window.itemDefs[item.type] ? window.itemDefs[item.type].size : 10; let floatOffset = Math.sin(item.life) * 3; window.ctx.fillRect(item.x, item.y + floatOffset, s, s);
        }
    });

    if (window.game.isMultiplayer) {
        Object.values(window.otherPlayers).forEach(p => { 
            if (p.id !== window.socket?.id && p.x > window.camera.x - 50 && p.x < window.camera.x + window._canvasLogicW + 50) { window.drawCharacter(p, false); }
        });
    }

    if (!window.player.inBackground) window.drawCharacter(window.player, true);

    window.entities.forEach(ent => {
        if (!(ent.x + ent.width > window.camera.x && ent.x < window.camera.x + window._canvasLogicW)) return;
        const C = window.ctx;
        const H = ent.isHit;
        const ER = (ent.enragedFrames||0) > 0;
        const FR = ent.vx >= 0; 
        const T = window.game.frameCount;

        C.save();

        if (ent.type === 'chicken') {
            const x=ent.x, y=ent.y, w=ent.width, h=ent.height;
            const moving = Math.abs(ent.vx) > 0.05;
            const bob = moving ? Math.sin(T*0.28)*2.5 : 0;       
            const headBob = moving ? Math.sin(T*0.28+0.5)*3 : 0; 

            if (!FR) { C.translate(x+w, 0); C.scale(-1,1); }
            const bx = FR ? x : 0;

            C.globalAlpha=0.18; C.fillStyle='#000';
            C.beginPath(); C.ellipse(bx+w/2, y+h+1, w*0.45, 2.5, 0, 0, Math.PI*2); C.fill();
            C.globalAlpha=1;

            const legColor = H ? '#ff6644' : '#e07820';
            const lw1 = moving ? Math.sin(T*0.28)*5 : 0;
            const lw2 = moving ? -Math.sin(T*0.28)*5 : 0;
            C.strokeStyle=legColor; C.lineWidth=2;
            C.beginPath(); C.moveTo(bx+7,y+h-4+bob); C.lineTo(bx+7+lw1,y+h+1); C.lineTo(bx+5+lw1,y+h+3); C.stroke();
            C.beginPath(); C.moveTo(bx+13,y+h-4+bob); C.lineTo(bx+13+lw2,y+h+1); C.lineTo(bx+15+lw2,y+h+3); C.stroke();

            C.fillStyle = H ? '#ffaaaa' : '#f0d080';
            C.beginPath(); C.moveTo(bx+2,y+h*0.55+bob); C.quadraticCurveTo(bx-6,y+h*0.4+bob, bx-3,y+h*0.3+bob); C.quadraticCurveTo(bx+0,y+h*0.45+bob, bx+2,y+h*0.55+bob); C.fill();

            const bodyG = C.createRadialGradient(bx+w*0.42,y+h*0.58+bob,2, bx+w*0.5,y+h*0.6+bob,w*0.55);
            bodyG.addColorStop(0, H?'#ffbbbb':'#fffef0');
            bodyG.addColorStop(1, H?'#ff5544':'#f0e070');
            C.fillStyle=bodyG;
            C.beginPath(); C.ellipse(bx+w*0.52, y+h*0.62+bob, w*0.52, h*0.37, 0, 0, Math.PI*2); C.fill();

            C.fillStyle = H?'#ff7755':'#d8c060';
            C.beginPath(); C.moveTo(bx+w*0.8,y+h*0.5+bob); C.quadraticCurveTo(bx+w*1.05,y+h*0.63+bob, bx+w*0.85,y+h*0.78+bob); C.quadraticCurveTo(bx+w*0.68,y+h*0.72+bob, bx+w*0.8,y+h*0.5+bob); C.fill();

            C.fillStyle = H?'#ff6644':'#f5e888';
            C.beginPath(); C.ellipse(bx+w*0.42, y+h*0.42+bob, w*0.18, h*0.1, -0.2, 0, Math.PI*2); C.fill();

            const hy = y+h*0.28+headBob;
            const hg = C.createRadialGradient(bx+w*0.4,hy,1, bx+w*0.42,hy,w*0.3);
            hg.addColorStop(0, H?'#ffcccc':'#fffff8');
            hg.addColorStop(1, H?'#ff5544':'#f0e878');
            C.fillStyle=hg;
            C.beginPath(); C.ellipse(bx+w*0.44, hy, w*0.32, h*0.22, 0, 0, Math.PI*2); C.fill();

            C.fillStyle=H?'#ff3333':'#dd2222';
            C.beginPath(); C.moveTo(bx+w*0.3,hy-4); C.quadraticCurveTo(bx+w*0.25,hy-11,bx+w*0.35,hy-7); C.quadraticCurveTo(bx+w*0.42,hy-13,bx+w*0.47,hy-7); C.quadraticCurveTo(bx+w*0.52,hy-3,bx+w*0.3,hy-4); C.fill();
            C.beginPath(); C.arc(bx+w*0.36,hy+6,2.5,0,Math.PI*2); C.fill();

            C.fillStyle='#e08020';
            C.beginPath(); C.moveTo(bx+w*0.72,hy-1); C.lineTo(bx+w*0.98,hy); C.lineTo(bx+w*0.72,hy+3); C.fill();
            C.strokeStyle='#c06010'; C.lineWidth=0.8;
            C.beginPath(); C.moveTo(bx+w*0.72,hy+1); C.lineTo(bx+w*0.92,hy+1); C.stroke();

            C.fillStyle='#111';
            C.beginPath(); C.arc(bx+w*0.6,hy-1,2,0,Math.PI*2); C.fill();
            C.fillStyle='#fff';
            C.beginPath(); C.arc(bx+w*0.61,hy-1.5,0.8,0,Math.PI*2); C.fill();

        } else if (ent.type === 'spider') {
            // ── ARAÑA SIMPLIFICADA ───────────────────────────────────
            const x=ent.x, y=ent.y, w=ent.width, h=ent.height;
            const faceX = FR ? x+w : x;
            
            C.fillStyle = H ? '#ff4444' : '#111';
            C.beginPath();
            C.ellipse(x + w/2, y + h/2 + 2, w/2, h/3, 0, 0, Math.PI*2);
            C.fill();

            const eyeX = FR ? x + w - 5 : x + 5;
            C.fillStyle = '#ff0000';
            C.beginPath(); C.arc(eyeX, y + h/2, 2, 0, Math.PI*2); C.fill();
            C.beginPath(); C.arc(eyeX - (FR?3:-3), y + h/2 - 2, 1.5, 0, Math.PI*2); C.fill();

            C.strokeStyle = H ? '#ff4444' : '#000';
            C.lineWidth = 2;
            C.beginPath();
            
            let legMove = (Math.abs(ent.vx) > 0.1) ? Math.sin(T * 0.5) * 3 : 0;

            for(let i=0; i<4; i++) {
                let lx = x + w/2 - 2 + (i*2);
                let ly = y + h/2 + 2;
                let footX = x - 5 - (i*3) + (i%2==0 ? legMove : -legMove);
                let footY = y + h;
                C.moveTo(lx, ly);
                C.quadraticCurveTo(lx - 5, ly - 5, footX, footY);
            }
            for(let i=0; i<4; i++) {
                let lx = x + w/2 + 2 - (i*2);
                let ly = y + h/2 + 2;
                let footX = x + w + 5 + (i*3) + (i%2==0 ? legMove : -legMove);
                let footY = y + h;
                C.moveTo(lx, ly);
                C.quadraticCurveTo(lx + 5, ly - 5, footX, footY);
            }
            C.stroke();

        } else if (ent.type === 'zombie') {
            const x=ent.x, y=ent.y, w=ent.width, h=ent.height;
            const walk = Math.abs(ent.vx)>0.05 ? Math.sin(T*0.2)*0.3 : 0;

            if (!FR) { C.translate(x+w,0); C.scale(-1,1); }
            const bx = FR ? x : 0;

            C.globalAlpha=0.2; C.fillStyle='#000';
            C.beginPath(); C.ellipse(bx+w/2,y+h+1,w*0.5,3,0,0,Math.PI*2); C.fill();
            C.globalAlpha=1;

            for (let leg=0;leg<2;leg++) {
                const lx=bx+(leg===0?5:13);
                const la = leg===0 ? walk : -walk;
                C.fillStyle=H?'#ff5544':(ER?'#145a14':'#1a5a1a');
                C.save(); C.translate(lx+2,y+h-18); C.rotate(la);
                C.fillRect(-3,0,7,10); 
                C.translate(0,9); C.rotate(-la*0.4);
                C.fillRect(-2,0,6,9); 
                C.fillStyle=H?'#ff3322':'#0d0d0d';
                C.fillRect(-3,8,9,4); 
                C.restore();
            }

            const torsoG=C.createLinearGradient(bx,y+h*0.43,bx+w,y+h*0.43);
            torsoG.addColorStop(0, H?'#ff5544':(ER?'#1a6a1a':'#2a8a2a'));
            torsoG.addColorStop(1, H?'#cc2211':(ER?'#0f440f':'#1a5a1a'));
            C.fillStyle=torsoG;
            C.fillRect(bx+2,y+h*0.42,w-4,h*0.36);
            if (!H) {
                C.strokeStyle='rgba(0,0,0,0.5)'; C.lineWidth=1;
                C.beginPath(); C.moveTo(bx+7,y+h*0.46); C.lineTo(bx+9,y+h*0.57); C.stroke();
                C.beginPath(); C.moveTo(bx+15,y+h*0.49); C.lineTo(bx+12,y+h*0.6); C.stroke();
            }

            const armSw = Math.sin(T*0.15)*0.12;
            C.fillStyle=H?'#ff6655':(ER?'#2a9a2a':'#3a9a3a');
            C.save(); C.translate(bx+4,y+h*0.44); C.rotate(-0.35+armSw);
            C.fillRect(-3,0,6,13);
            C.translate(0,12); C.rotate(0.1);
            C.fillRect(-2.5,0,5,10);
            C.fillStyle=H?'#ff8866':(ER?'#1a8a1a':'#4aaa4a');
            for(let d=0;d<3;d++){C.fillRect(-2+d*2.5,9,2,5);}
            C.restore();
            C.fillStyle=H?'#ff4433':(ER?'#1a8a1a':'#2a8a2a');
            C.save(); C.translate(bx+w-4,y+h*0.42); C.rotate(-0.6+armSw);
            C.fillRect(-3,0,6,13);
            C.translate(0,12); C.rotate(0.1);
            C.fillRect(-2.5,0,5,10);
            C.fillStyle=H?'#ff7755':(ER?'#1aaa1a':'#3aaa3a');
            for(let d=0;d<3;d++){C.fillRect(-2+d*2.5,9,2,5);}
            C.restore();

            C.fillStyle=H?'#ff5544':'#5ab05a';
            C.fillRect(bx+w*0.3,y+h*0.26,w*0.4,h*0.08);

            const hg=C.createLinearGradient(bx+2,y+h*0.06,bx+w-2,y+h*0.27);
            hg.addColorStop(0,H?'#ff8877':(ER?'#60c060':'#70d070'));
            hg.addColorStop(1,H?'#cc3322':(ER?'#3a8a3a':'#4a9a4a'));
            C.fillStyle=hg; C.fillRect(bx+2,y+h*0.06,w-4,h*0.22);

            C.fillStyle=H?'#cc2211':(ER?'#1a4a1a':'#1a5a1a');
            C.fillRect(bx+2,y+h*0.05,w-4,4);
            C.fillRect(bx+4,y+h*0.03,4,4); C.fillRect(bx+13,y+h*0.02,5,5);

            C.fillStyle='#000';
            C.fillRect(bx+4,y+h*0.11,6,5); C.fillRect(bx+13,y+h*0.11,6,5);
            C.fillStyle=ER?'#ff4400':'#cc0000';
            C.fillRect(bx+5,y+h*0.12,4,3); C.fillRect(bx+14,y+h*0.12,4,3);
            C.fillStyle='rgba(255,180,0,0.6)';
            C.fillRect(bx+5,y+h*0.12,2,1.5); C.fillRect(bx+14,y+h*0.12,2,1.5);

            C.fillStyle='#000';
            C.fillRect(bx+w*0.4,y+h*0.19,2,3); 
            C.fillRect(bx+5,y+h*0.23,w-10,3); 
            C.fillStyle='#ddd';
            for(let t=0;t<3;t++){C.fillRect(bx+7+t*5,y+h*0.23,3,2);}
            if (!H) {
                C.fillStyle='rgba(180,0,0,0.5)';
                C.fillRect(bx+3,y+h*0.15,3,2);
            }

        } else if (ent.type === 'archer') {
            const x=ent.x, y=ent.y, w=ent.width, h=ent.height;
            const fR = ent.attackCooldown < 120 ? window.player.x > ent.x : ent.vx >= 0;
            const walk = Math.abs(ent.vx)>0.05 ? Math.sin(T*0.2)*0.25 : 0;

            if (!fR) { C.translate(x+w,0); C.scale(-1,1); }
            const bx = fR ? x : 0;

            C.globalAlpha=0.18; C.fillStyle='#000';
            C.beginPath(); C.ellipse(bx+w/2,y+h+1,w*0.4,2.5,0,0,Math.PI*2); C.fill();
            C.globalAlpha=1;

            for (let leg=0;leg<2;leg++) {
                const lx=bx+(leg===0?4:12);
                const la = leg===0 ? walk : -walk;
                C.fillStyle=H?'#ff4444':'#1e0f38';
                C.save(); C.translate(lx+2,y+h-17); C.rotate(la);
                C.fillRect(-2,0,5,9); C.translate(0,8); C.rotate(-la*0.4);
                C.fillRect(-2,0,5,8);
                C.fillStyle=H?'#ff3333':'#0d0820';
                C.fillRect(-3,7,7,3);
                C.restore();
            }

            const capeWave = Math.sin(T*0.12)*3;
            C.fillStyle=H?'#aa2222':(ER?'#2a004a':'#3b0f6e');
            C.beginPath(); C.moveTo(bx+w*0.15,y+h*0.37); C.lineTo(bx-4,y+h*0.75+capeWave); C.lineTo(bx+w*0.45,y+h*0.76+capeWave*0.5); C.closePath(); C.fill();

            const tg=C.createLinearGradient(bx,y+h*0.34,bx+w,y+h*0.34);
            tg.addColorStop(0,H?'#ff5544':(ER?'#5a0088':'#7c2fb8'));
            tg.addColorStop(1,H?'#cc2211':(ER?'#380060':'#51198a'));
            C.fillStyle=tg; C.fillRect(bx+1,y+h*0.34,w-2,h*0.36);
            if(!H){
                C.fillStyle='#c8920f';
                C.fillRect(bx+w*0.3,y+h*0.36,w*0.4,2);
                C.beginPath(); C.arc(bx+w/2,y+h*0.44,3,0,Math.PI*2); C.fill();
            }

            C.fillStyle=H?'#ff5555':'#5a2888';
            C.fillRect(bx-1,y+h*0.35,4,15);
            C.fillStyle=H?'#cc3322':'#5a2810';
            C.fillRect(bx-3,y+h*0.37,5,14);
            C.strokeStyle='#c8a050'; C.lineWidth=1;
            for(let fi=0;fi<4;fi++){
                C.beginPath(); C.moveTo(bx-2,y+h*0.39+fi*2.5); C.lineTo(bx+2,y+h*0.39+fi*2.5); C.stroke();
            }

            const bowAngle = ent.attackCooldown<120 ? Math.atan2(
                (window.player.y+24)-(y+h*0.44),
                fR ? (window.player.x+12)-(bx+w) : (bx)-(window.player.x+12)
            ) : 0;
            C.save();
            C.translate(bx+w,y+h*0.43);
            C.rotate(Math.max(-0.8,Math.min(0.8,bowAngle)));
            C.fillStyle=H?'#ff6666':'#6a3498';
            C.fillRect(0,-3,13,6);
            C.strokeStyle=H?'#ff8844':'#7a4820'; C.lineWidth=3;
            C.beginPath(); C.arc(15,0,11,-1.1,1.1); C.stroke();
            C.strokeStyle=H?'#ffaa66':'#9a6030'; C.lineWidth=1.5;
            C.beginPath(); C.arc(15,0,11,-0.4,0.4); C.stroke();
            const pull = ent.attackCooldown<120 ? Math.min(8,(120-ent.attackCooldown)/120*8) : 0;
            C.strokeStyle='rgba(220,210,190,0.9)'; C.lineWidth=1;
            C.beginPath();
            C.moveTo(15+Math.cos(-1.1)*11, Math.sin(-1.1)*11);
            C.lineTo(15-pull, 0);
            C.lineTo(15+Math.cos(1.1)*11, Math.sin(1.1)*11);
            C.stroke();
            if (ent.attackCooldown<90) {
                C.fillStyle='#c8a050'; C.fillRect(15-pull,-1,16+pull,2);
                C.fillStyle='#607888'; C.fillRect(30,-2.5,5,5); 
                C.fillStyle='#cc4444';
                C.beginPath(); C.moveTo(14-pull,-1); C.lineTo(14-pull-4,-4); C.lineTo(14-pull,0); C.fill();
                C.beginPath(); C.moveTo(14-pull,1); C.lineTo(14-pull-4,4); C.lineTo(14-pull,0); C.fill();
            }
            C.restore();

            C.fillStyle=H?'#ff7755':'#c09070';
            C.fillRect(bx+w*0.28,y+h*0.27,w*0.44,h*0.09);

            C.fillStyle=H?'#aa1122':(ER?'#300050':'#4c1590');
            C.beginPath(); C.moveTo(bx+1,y+h*0.27); C.lineTo(bx+w/2,y+h*0.04); C.lineTo(bx+w-1,y+h*0.27); C.closePath(); C.fill();
            const faceG=C.createLinearGradient(bx+3,y+h*0.15,bx+w-3,y+h*0.27);
            faceG.addColorStop(0,H?'#ff9977':'#d4a880');
            faceG.addColorStop(1,H?'#cc4433':'#b07850');
            C.fillStyle=faceG; C.fillRect(bx+3,y+h*0.15,w-6,h*0.14);
            C.fillStyle='rgba(0,0,0,0.25)';
            C.fillRect(bx+3,y+h*0.15,w-6,3);

            C.fillStyle=ER?'#ff3300':'#1a0a05';
            C.fillRect(bx+5,y+h*0.175,4,2.5); C.fillRect(bx+11,y+h*0.175,4,2.5);
            C.fillStyle=ER?'#ff8800':'#4a2a10';
            C.fillRect(bx+6,y+h*0.178,2,1.5); C.fillRect(bx+12,y+h*0.178,2,1.5);

            C.fillStyle='rgba(0,0,0,0.3)';
            C.fillRect(bx+w*0.42,y+h*0.215,2,2);
            C.fillRect(bx+6,y+h*0.24,w-12,1.5);
        }

        if (ent.hp < ent.maxHp && (Date.now()-(ent.lastHitTime||0)<3000)) {
            const pct=Math.max(0,ent.hp/ent.maxHp);
            C.fillStyle='rgba(0,0,0,0.55)'; C.fillRect(ent.x,ent.y-9,ent.width,4);
            const hc = pct>0.6?'#44dd44':(pct>0.3?'#f0a020':'#ee3333');
            C.fillStyle=hc; C.fillRect(ent.x,ent.y-9,ent.width*pct,4);
            C.strokeStyle='rgba(0,0,0,0.4)'; C.lineWidth=0.5;
            C.strokeRect(ent.x,ent.y-9,ent.width,4);
        }

        C.restore();
    });

    if (window.player.placementMode && !window.player.isDead) {
        let offsetY = window.game.groundLevel % window.game.blockSize;
        const gridX = Math.floor(window.mouseWorldX / window.game.blockSize) * window.game.blockSize; 
        const gridY = Math.floor((window.mouseWorldY - offsetY) / window.game.blockSize) * window.game.blockSize + offsetY;
        
        let valid = window.isValidPlacement(gridX, gridY, window.game.blockSize, window.game.blockSize, true, false);
        let validColor = valid ? '#00FF00' : '#FF0000'; let validFill = valid ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.3)';

        window.ctx.globalAlpha = 0.6;
        if (window.player.placementMode === 'boxes') { window.ctx.fillStyle = '#8B4513'; window.ctx.fillRect(gridX + 2, gridY + 10, window.game.blockSize - 4, window.game.blockSize - 10); } 
        else if (window.player.placementMode === 'campfire_item') { window.ctx.fillStyle = '#5c4033'; window.ctx.fillRect(gridX + 2, gridY + 20, 26, 10); }
        else if (window.player.placementMode === 'bed_item') { window.ctx.fillStyle = '#8B4513'; window.ctx.fillRect(gridX, gridY + 20, 30, 10); window.ctx.fillStyle = '#e0e0e0'; window.ctx.fillRect(gridX + 2, gridY + 16, 10, 4); window.ctx.fillStyle = '#c0392b'; window.ctx.fillRect(gridX + 12, gridY + 16, 18, 4); }
        else if (window.player.placementMode === 'barricade_item') { window.ctx.fillStyle = '#5D4037'; window.ctx.fillRect(gridX + 2, gridY + 24, 26, 6); window.ctx.fillStyle = '#bdc3c7'; window.ctx.beginPath(); window.ctx.moveTo(gridX + 5, gridY + 24); window.ctx.lineTo(gridX + 2, gridY + 5); window.ctx.lineTo(gridX + 10, gridY + 24); window.ctx.fill(); }
        
        window.ctx.strokeStyle = validColor; window.ctx.lineWidth = 2; window.ctx.strokeRect(gridX, gridY, window.game.blockSize, window.game.blockSize); 
        window.ctx.fillStyle = validFill; window.ctx.fillRect(gridX, gridY, window.game.blockSize, window.game.blockSize); window.ctx.globalAlpha = 1.0;
    }

    if (window.player.activeTool === 'hammer' && !window.player.isDead && !window.player.placementMode) {
        let offsetY = window.game.groundLevel % window.game.blockSize;
        const gridX = Math.floor(window.mouseWorldX / window.game.blockSize) * window.game.blockSize; 
        const gridY = Math.floor((window.mouseWorldY - offsetY) / window.game.blockSize) * window.game.blockSize + offsetY;
        
        const isDoor = window.player.buildMode === 'door'; const itemHeight = isDoor ? window.game.blockSize * 2 : window.game.blockSize;
        
        let valid = window.isValidPlacement(gridX, gridY, window.game.blockSize, itemHeight, true, true);
        let validColor = valid ? '#00FF00' : '#FF0000'; let validFill = valid ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.3)';

        window.ctx.globalAlpha = 0.5; window.ctx.strokeStyle = validColor; window.ctx.lineWidth = 2; window.ctx.setLineDash([4, 2]);
        window.ctx.strokeRect(gridX, gridY, window.game.blockSize, itemHeight);
        window.ctx.fillStyle = validFill; window.ctx.fillRect(gridX, gridY, window.game.blockSize, itemHeight);
        window.ctx.setLineDash([]); window.ctx.globalAlpha = 1.0;
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
        if (pr.x + 20 > window.camera.x && pr.x - 20 < window.camera.x + window._canvasLogicW) {
            window.ctx.save(); window.ctx.translate(pr.x, pr.y); window.ctx.rotate(pr.angle);
            if (pr.isEnemy) { window.ctx.fillStyle = '#ff4444'; window.ctx.fillRect(-15, -1, 20, 2); window.ctx.fillStyle = '#000'; window.ctx.fillRect(5, -2, 4, 4); } 
            else { window.ctx.fillStyle = '#eee'; window.ctx.fillRect(-15, -1, 20, 2); window.ctx.fillStyle = '#666'; window.ctx.fillRect(5, -2, 4, 4); window.ctx.fillStyle = '#fff'; window.ctx.fillRect(-17, -2, 4, 4); }
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

    if (window.game.isRaining) {
        window.ctx.save(); window.ctx.strokeStyle = 'rgba(150, 180, 220, 0.5)'; window.ctx.lineWidth = 1; window.ctx.beginPath();
        for(let i=0; i<300; i++) { let rx = (i * 137 + window.game.frameCount * 8) % window._canvasLogicW; let ry = (i * 93 + window.game.frameCount * 25) % window._canvasLogicH; window.ctx.moveTo(window.camera.x + rx, window.camera.y + ry); window.ctx.lineTo(window.camera.x + rx - 3, window.camera.y + ry + 25); }
        window.ctx.stroke(); window.ctx.restore();
        if (Math.random() < 0.005) { window.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'; window.ctx.fillRect(window.camera.x, window.camera.y, window._canvasLogicW, window._canvasLogicH); }
    }

    window.ctx.restore(); 

    if (window.lightCtx) {
        window.lightCtx.clearRect(0, 0, window._canvasLogicW, window._canvasLogicH);
        let ambientDarkness = 0.2 + (0.75 * darkness); 
        window.lightCtx.fillStyle = `rgba(5, 5, 10, ${ambientDarkness})`; window.lightCtx.fillRect(0, 0, window._canvasLogicW, window._canvasLogicH);
        
        window.lightCtx.globalCompositeOperation = 'destination-out';
        
        if (!window.player.isDead && window.player.activeTool === 'torch') {
            let flicker = Math.random() * 20; let pGlowSize = 250 + flicker; 
            let pGrad = window.lightCtx.createRadialGradient(window.player.x + window.player.width/2 - window.camera.x, window.player.y + window.player.height/2 - window.camera.y, 0, window.player.x + window.player.width/2 - window.camera.x, window.player.y + window.player.height/2 - window.camera.y, pGlowSize);
            pGrad.addColorStop(0, 'rgba(255, 180, 50, 0.8)'); pGrad.addColorStop(1, 'rgba(255, 150, 50, 0)');
            window.lightCtx.fillStyle = pGrad; window.lightCtx.beginPath(); window.lightCtx.arc(window.player.x + window.player.width/2 - window.camera.x, window.player.y + window.player.height/2 - window.camera.y, pGlowSize, 0, Math.PI*2); window.lightCtx.fill();
        }

        if (window.game.isMultiplayer) {
            Object.values(window.otherPlayers).forEach(p => { 
                if (p.id !== window.socket?.id && !p.isDead && p.activeTool === 'torch') {
                    let cx = p.x + (p.width||24)/2 - window.camera.x; let cy = p.y + (p.height||48)/2 - window.camera.y;
                    let pGrad = window.lightCtx.createRadialGradient(cx, cy, 0, cx, cy, 250 + Math.random()*20);
                    pGrad.addColorStop(0, 'rgba(255, 180, 50, 0.8)'); pGrad.addColorStop(1, 'rgba(255, 150, 50, 0)');
                    window.lightCtx.fillStyle = pGrad; window.lightCtx.beginPath(); window.lightCtx.arc(cx, cy, 270, 0, Math.PI*2); window.lightCtx.fill();
                }
            });
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
        window.ctx.drawImage(window.lightCanvas, 0, 0, window._canvasLogicW, window._canvasLogicH);
    }

    window.ctx.save(); window.ctx.translate(-window.camera.x, -window.camera.y);
    const drawNameAndChat = (charData, isLocal) => {
        if (charData.isDead) return;
        if (!isLocal) { let dist = Math.hypot(window.player.x - charData.x, window.player.y - charData.y); if (dist > 500) return; }

        const pCX = charData.x + (charData.width || 24) / 2; const pCY = charData.y + (charData.height || 48); 
        const bob = Math.abs(Math.sin((charData.renderAnimTime || 0) * 3)) * 3; 

        const nameY = pCY - 80 - bob; const chatY = pCY - 110 - bob;

        if (!isLocal) {
            window.ctx.fillStyle = 'rgba(255,255,255,0.9)'; window.ctx.font = 'bold 12px Inter, sans-serif'; window.ctx.textAlign = 'center'; 
            window.ctx.fillText(`${charData.name} (Nv. ${charData.level || 1})`, pCX, nameY);
        }

        if (charData.chatExpires && Date.now() < charData.chatExpires && charData.chatText) {
            window.ctx.font = 'bold 13px Inter, sans-serif'; let tW = window.ctx.measureText(charData.chatText).width;
            window.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; window.ctx.fillRect(pCX - tW/2 - 8, chatY - 15, tW + 16, 24); window.ctx.fillStyle = '#fff'; window.ctx.textAlign = 'center'; window.ctx.fillText(charData.chatText, pCX, chatY + 2);
        }
    };
    
    if (window.game.isMultiplayer) { Object.values(window.otherPlayers).forEach(p => { if (p.id !== window.socket?.id) drawNameAndChat(p, false); }); }
    if (!window.player.inBackground) drawNameAndChat(window.player, true);
    window.ctx.restore();
};
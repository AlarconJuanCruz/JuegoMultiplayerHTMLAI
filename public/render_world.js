// render_world.js — draw() principal. Deps: ctx, game, camera, player,
// blocks, trees, rocks, entities, sprites, getGroundY, drawCharacter

window.draw = function() {
    if (!window.ctx) return;
    const W = window._canvasLogicW || 1280;
    const H = window._canvasLogicH || 720;
    const Q = window.game.graphicsQuality || 'medium'; // 'low'|'medium'|'high'
    if (!window.game.isRunning) { window.ctx.fillStyle = '#050505'; window.ctx.fillRect(0, 0, W, H); return; }

    // === CICLO DÍA/NOCHE ===
    let currentUptime = window.game.serverStartTime ? (Date.now() - window.game.serverStartTime) : (window.game.frameCount * (1000/60));
    let totalFrames = Math.floor(currentUptime / (1000 / 60)) + 28800;
    let hourFloat = (totalFrames / 3600) % 24;

    let rawDarkness = (Math.cos((hourFloat / 24) * Math.PI * 2) + 1) / 2;
    let darkness = Math.max(0, (rawDarkness - 0.25) * 1.4);

    // Color cielo según oscuridad
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

    // Gradiente de cielo — se extiende hasta H para que el área bajo el terreno
    // sea oscura (tierra) y no el color claro del último stop del cielo.
    let skyGrad = window.ctx.createLinearGradient(0, 0, 0, H);
    const _skyFrac = Math.min(1, window.game.groundLevel / H); // fracción del cielo en la pantalla
    if (darkness < 0.3) {
        skyGrad.addColorStop(0,          `rgb(${r},${g},${b})`);
        skyGrad.addColorStop(_skyFrac*0.5,`rgb(${Math.min(255,r+18)},${Math.min(255,g+12)},${Math.min(255,b+5)})`);
        skyGrad.addColorStop(_skyFrac,   `rgb(${Math.min(255,r+50)},${Math.min(255,g+38)},${Math.min(255,b+18)})`);
    } else if (darkness < 0.6) {
        skyGrad.addColorStop(0,          `rgb(${r},${g},${b})`);
        skyGrad.addColorStop(_skyFrac*0.4,`rgb(${Math.min(255,r+50)},${Math.min(255,g+30)},${Math.min(255,b-15)})`);
        skyGrad.addColorStop(_skyFrac,   `rgb(${Math.min(255,r+100)},${Math.min(255,g+55)},${Math.min(255,b-10)})`);
    } else {
        skyGrad.addColorStop(0,          `rgb(${r},${g},${b})`);
        skyGrad.addColorStop(_skyFrac*0.5,`rgb(${Math.max(0,r+8)},${Math.max(0,g+8)},${Math.max(0,b+18)})`);
        skyGrad.addColorStop(_skyFrac,   `rgb(${Math.max(0,r+14)},${Math.max(0,g+12)},${Math.max(0,b+28)})`);
    }
    // Por debajo de la línea de horizonte: color tierra oscuro (nunca visible en condiciones normales,
    // pero cubre cualquier hueco/hole en el terreno para que no se vea el cyan del cielo)
    skyGrad.addColorStop(Math.min(1, _skyFrac + 0.01), '#1a1008');
    skyGrad.addColorStop(1, '#0d0804');
    window.ctx.fillStyle = skyGrad; window.ctx.fillRect(0, 0, W, H);

    // ── POSICIÓN EN PANTALLA DEL SUELO (con zoom) ─────────────────────────────
    // Usada para clipear montañas y parallax. Fórmula correcta con zoom:
    //   screenY = z * (worldY - camY) + H/2 * (1 - z)
    const _bgZ    = window.game.zoom || 1;
    const _bgCamY = window.camera ? window.camera.y : 0;
    const _surfSY = _bgZ * ((window.game.groundLevel || 510) - _bgCamY) + H / 2 * (1 - _bgZ);

    window.ctx.save();
    if (window.game.screenShake > 0) { let dx = (Math.random() - 0.5) * window.game.screenShake; let dy = (Math.random() - 0.5) * window.game.screenShake; window.ctx.translate(dx, dy); }

    // Estrellas (noche)
    if (darkness > 0.45 && !window.game.isRaining) {
        let starAlpha = Math.min(1, (darkness - 0.45) * 3);
        window.stars.forEach(st => { let twinkle = 0.5 + 0.5 * Math.sin(window.game.frameCount * 0.05 + st.x * 0.1); window.ctx.globalAlpha = starAlpha * (0.6 + 0.4 * twinkle); window.ctx.fillStyle = '#fff'; window.ctx.fillRect(st.x, st.y, st.s * 0.8, st.s * 0.8); });
        window.ctx.globalAlpha = 1;
    }

    // Sol
    if (hourFloat > 5 && hourFloat < 19) {
        let dayProgress = (hourFloat - 5) / 14; let sunX = W * dayProgress; let sunY = H * 0.8 - Math.sin(dayProgress * Math.PI) * (H * 0.7); const sunPulse = 1 + Math.sin(window.game.frameCount * 0.02) * 0.04;
        for (let r = 140; r >= 20; r -= 20) { const a = 0.03 * (1 - r/160) * sunPulse; const glowGrad = window.ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, r * 2.5); glowGrad.addColorStop(0, `rgba(255,240,100,${a * 3})`); glowGrad.addColorStop(0.4, `rgba(255,200,50,${a})`); glowGrad.addColorStop(1, 'rgba(255,180,0,0)'); window.ctx.fillStyle = glowGrad; window.ctx.beginPath(); window.ctx.arc(sunX, sunY, r * 2.5, 0, Math.PI*2); window.ctx.fill(); }
        let sunSize = 140;
        if (window.sprites.sprite_sun && window.sprites.sprite_sun.complete && window.sprites.sprite_sun.naturalWidth > 0) { window.ctx.drawImage(window.sprites.sprite_sun, sunX - sunSize/2, sunY - sunSize/2, sunSize, sunSize); }
        else { window.ctx.fillStyle = '#FFE566'; window.ctx.beginPath(); window.ctx.arc(sunX, sunY, 42, 0, Math.PI*2); window.ctx.fill(); }
    }

    // Luna
    if (hourFloat >= 17 || hourFloat <= 7) {
        let nightProgress = hourFloat >= 17 ? (hourFloat - 17) / 14 : (hourFloat + 7) / 14; let moonX = W * nightProgress; let moonY = H * 0.8 - Math.sin(nightProgress * Math.PI) * (H * 0.7); const moonPulse = 1 + Math.sin(window.game.frameCount * 0.015 + 1.5) * 0.05;
        for (let r = 100; r >= 15; r -= 15) { const a = 0.025 * (1 - r/110) * moonPulse; const moonGrad = window.ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, r * 2.8); moonGrad.addColorStop(0, `rgba(200,220,255,${a * 4})`); moonGrad.addColorStop(0.4, `rgba(170,200,240,${a})`); moonGrad.addColorStop(1, 'rgba(140,170,220,0)'); window.ctx.fillStyle = moonGrad; window.ctx.beginPath(); window.ctx.arc(moonX, moonY, r * 2.8, 0, Math.PI*2); window.ctx.fill(); }
        let moonSize = 120;
        if (window.sprites.sprite_moon && window.sprites.sprite_moon.complete && window.sprites.sprite_moon.naturalWidth > 0) { window.ctx.drawImage(window.sprites.sprite_moon, moonX - moonSize/2, moonY - moonSize/2, moonSize, moonSize); }
        else { window.ctx.fillStyle = '#E8EEE0'; window.ctx.beginPath(); window.ctx.arc(moonX, moonY, 32, 0, Math.PI*2); window.ctx.fill(); }
    }

    // Nubes con parallax
    window.clouds.forEach(c => {
        c.x += c.v; if (c.x > W + 150) c.x = -150; let cloudAlpha = window.game.isRaining ? 0.75 : Math.max(0, 0.7 * (1 - darkness * 1.2)); if (cloudAlpha <= 0) return;
        window.ctx.save(); window.ctx.globalAlpha = cloudAlpha;
        if (window.game.isRaining) { window.ctx.filter = 'brightness(45%)'; }
        if (window.sprites.sprite_cloud.complete && window.sprites.sprite_cloud.naturalWidth > 0) { let cW = 200 * c.s; let cH = 100 * c.s; window.ctx.drawImage(window.sprites.sprite_cloud, c.x, c.y - cH/2, cW, cH); }
        else { window.ctx.fillStyle = 'rgba(255,255,255,0.8)'; window.ctx.beginPath(); window.ctx.arc(c.x, c.y, 28*c.s, 0, Math.PI*2); window.ctx.fill(); }
        window.ctx.restore();
    });

    // === MONTAÑAS DE FONDO (parallax horizontal solamente) ===
    // Dimensiones naturales exactas de cada sprite:
    //   bg_mountains_back.png  →  512 × 153 px
    //   bg_mountains_mid.png   → 1705 × 350 px
    //
    // DISEÑO DE CAPAS:
    //   back (montañas lejanas) → zona media-alta del cielo, escala H*0.24
    //   mid  (bosque/pinos)     → borde inferior del cielo (horizonte), escala H*0.28
    //
    // Anclar ambas ABAJO en horizontes DISTINTOS para que back sea visible por encima de mid:
    //   mid  → bottom en bgHorizonY   (la línea de terreno)
    //   back → bottom en bgHorizonY - midDisplayH + H*0.06  (justo encima del mid, con pequeño solapamiento)
    //
    // bgHorizonY FIJO (independiente de camera.y): el cielo no se mueve verticalmente.
    // ─────────────────────────────────────────────────────────────────────────────
    const bgBackNW = 512,  bgBackNH = 153;
    const bgMidNW  = 1705, bgMidNH  = 350;

    // bgHorizonY: base del clip parallax. Subimos de 0.62 a 0.78 para bajar ambas capas.
    const bgHorizonY = H * 0.78;

    // Alturas de visualización (independientes de las dimensiones naturales del sprite)
    const bgMidDisplayH  = Math.round(H * 0.28);                                   // ~202px @720p
    const bgBackDisplayH = Math.round(H * 0.24);                                   // ~173px @720p

    // Anchos proporcionales al alto de visualización
    const bgMidDisplayW  = Math.round(bgMidNW  * (bgMidDisplayH  / bgMidNH));      // ~1051px @720p
    const bgBackDisplayW = Math.round(bgBackNW * (bgBackDisplayH / bgBackNH));     //  ~578px @720p

    // mid: anclado en el horizonte (su base toca bgHorizonY)
    const midY  = Math.floor(bgHorizonY - bgMidDisplayH);
    // back: ahora se ancla TAMBIÉN desde bgHorizonY con un offset menor,
    // solapando parcialmente con mid para que quede en la franja baja del cielo.
    const backY = Math.floor(bgHorizonY - bgBackDisplayH * 0.95);

    // Parallax X
    const _rawBackX = -(window.camera.x * 0.05) % bgBackDisplayW;
    let backX = Math.floor(_rawBackX <= 0 ? _rawBackX : _rawBackX - bgBackDisplayW);
    const _rawMidX  = -(window.camera.x * 0.15) % bgMidDisplayW;
    let midX  = Math.floor(_rawMidX  <= 0 ? _rawMidX  : _rawMidX  - bgMidDisplayW);

    const bgDimAlpha = darkness * 0.55;

    if (_surfSY > 0) {
        window.ctx.save();
        window.ctx.beginPath();
        window.ctx.rect(0, 0, W, Math.ceil(bgHorizonY));
        window.ctx.clip();

        // ── Capa trasera: montañas lejanas (parte alta del cielo) ───────────────
        if (window.sprites.bg_mountains_back.complete && window.sprites.bg_mountains_back.naturalWidth > 0) {
            const tilesNeeded = Math.ceil(W / bgBackDisplayW) + 2;
            for (let i = 0; i < tilesNeeded; i++) {
                window.ctx.drawImage(
                    window.sprites.bg_mountains_back,
                    backX + i * bgBackDisplayW, backY,
                    bgBackDisplayW, bgBackDisplayH
                );
            }
        }
        if (bgDimAlpha > 0.04) {
            window.ctx.fillStyle = `rgba(5,8,20,${bgDimAlpha * 0.8})`;
            window.ctx.fillRect(0, backY, W, bgBackDisplayH);
        }

        // ── Capa frontal: bosque de pinos (horizonte) ───────────────────────────
        if (window.sprites.bg_mountains_mid.complete && window.sprites.bg_mountains_mid.naturalWidth > 0) {
            const tilesNeeded = Math.ceil(W / bgMidDisplayW) + 2;
            for (let i = 0; i < tilesNeeded; i++) {
                window.ctx.drawImage(
                    window.sprites.bg_mountains_mid,
                    midX + i * bgMidDisplayW, midY,
                    bgMidDisplayW, bgMidDisplayH
                );
            }
        }
        if (bgDimAlpha > 0.04) {
            window.ctx.fillStyle = `rgba(5,8,20,${bgDimAlpha * 0.65})`;
            window.ctx.fillRect(0, midY, W, bgMidDisplayH);
        }

        window.ctx.restore();
    }

    // === ZOOM + TRANSFORMACIÓN DE CÁMARA ===
    const z = window.game.zoom || 1;
    // ── Interpolación de cámara para suavidad en 120/144Hz ──────────────
    const _ra = window._renderAlpha ?? 1;
    const _iCamX = window._prevCamX !== undefined
        ? window._prevCamX + (window.camera.x - window._prevCamX) * _ra
        : window.camera.x;
    const _iCamY = window._prevCamY !== undefined
        ? window._prevCamY + (window.camera.y - window._prevCamY) * _ra
        : window.camera.y;

    window.ctx.save();
    window.ctx.translate(W / 2, H / 2); window.ctx.scale(z, z); window.ctx.translate(-W / 2, -H / 2); window.ctx.translate(-_iCamX, -_iCamY);

    const step = 15;
    const _visHalfW = (W / 2) / z; const _visCenterX = _iCamX + W / 2;
    const _visLeft  = _visCenterX - _visHalfW; const _visRight = _visCenterX + _visHalfW;
    const startX = Math.floor((_visLeft - 120) / step) * step;
    const endX   = Math.ceil((_visRight + 120) / step) * step;
    const bottomY = _iCamY + H / z + 300;

    // ── Variables de culling de superficie — usadas en todo el draw ──────────
    // Se calculan una sola vez y se reusan en entidades, items, plantas.
    const bs = window.game.blockSize;
    const _surfUGCol  = window.getTerrainCol ? Math.floor((window.player.x + window.player.width/2) / bs) : 0;
    const _surfUGCD   = window.getTerrainCol ? window.getTerrainCol(_surfUGCol) : null;
    const _surfY      = (_surfUGCD && _surfUGCD.type !== 'hole') ? _surfUGCD.topY : (window.game.baseGroundLevel || 510);
    // El jugador está en superficie si su base está a < 2.5 bloques del topY
    const _onSurface  = (window.player.y + window.player.height) <= _surfY + bs * 2.5;
    // Y límite: por debajo de este Y se oculta todo cuando jugador está en superficie
    const _surfCutY   = _surfY + bs * 3;

    if (!window.hitCanvas) { window.hitCanvas = document.createElement('canvas'); window.hitCtx = window.hitCanvas.getContext('2d', { willReadFrequently: true }); }

    // === BLOQUES, ROCAS Y ÁRBOLES (antes del terreno para que el pasto los tape) ===

    // Grietas estilo Minecraft sobre bloques dañados (stage 1-3 según HP%)
    function drawCracks(C, x, y, w, h, hpPct) {
        if (hpPct >= 1.0) return;
        let stage; if (hpPct > 0.66) stage = 1; else if (hpPct > 0.33) stage = 2; else stage = 3;
        C.save(); C.beginPath(); C.rect(x, y, w, h); C.clip();
        const alpha = stage === 1 ? 0.45 : stage === 2 ? 0.72 : 0.90;
        C.strokeStyle = `rgba(0,0,0,${alpha})`; C.lineWidth = stage === 1 ? 0.8 : stage === 2 ? 1.0 : 1.3; C.lineCap = 'round';
        const seed = (Math.floor(x / w) * 7 + Math.floor(y / h) * 13) & 0xFFFF;
        function sr(n) { let v = ((seed ^ (seed >> 5)) * 0x45d9f3b + n * 0x9e3779b9) >>> 0; return (v >>> 0) / 0xFFFFFFFF; }
        const crackCount = stage;
        for (let c = 0; c < crackCount; c++) {
            const ox = x + w * (0.2 + sr(c * 10 + 1) * 0.6); const oy = y + h * (0.2 + sr(c * 10 + 2) * 0.6);
            const segments = stage === 3 ? 4 : 3;
            C.beginPath(); C.moveTo(ox, oy);
            let cx = ox, cy = oy;
            for (let s = 0; s < segments; s++) {
                const len = (w * 0.15) + sr(c * 20 + s * 5 + 3) * w * 0.22; const angle = sr(c * 20 + s * 5 + 4) * Math.PI * 2;
                cx += Math.cos(angle) * len; cy += Math.sin(angle) * len;
                cx = Math.max(x + 1, Math.min(x + w - 1, cx)); cy = Math.max(y + 1, Math.min(y + h - 1, cy));
                C.lineTo(cx, cy);
            }
            C.stroke();
            if (stage >= 2) {
                const branchIdx = c * 20 + 30; const bx = ox + (cx - ox) * 0.4; const by = oy + (cy - oy) * 0.4;
                const bLen = w * 0.12 + sr(branchIdx) * w * 0.14; const bAngle = sr(branchIdx + 1) * Math.PI * 2;
                C.beginPath(); C.moveTo(bx, by); C.lineTo(Math.max(x+1, Math.min(x+w-1, bx + Math.cos(bAngle) * bLen)), Math.max(y+1, Math.min(y+h-1, by + Math.sin(bAngle) * bLen))); C.stroke();
            }
        }
        if (stage === 3) { C.fillStyle = 'rgba(0,0,0,0.18)'; C.fillRect(x, y, w, h); }
        C.restore();
    }

    // Rocas con sprite (normal/dañada) y barra de HP con fade
    window.rocks.forEach(r => {
        if (r.x + r.width > _visLeft - 100 && r.x < _visRight + 100) {
            window.ctx.save(); window.ctx.translate(r.x + r.width/2, r.y + r.height);
            let hw = r.width / 2; let img = (r.hp <= r.maxHp / 2) ? window.sprites.rock_damaged : window.sprites.rock_full;
            let drawW = 80; let drawH = 80; let drawX = -drawW / 2; let drawY = -drawH;
            if (img && img.complete && img.naturalWidth > 0) {
                if (r.isHit) {
                    window.hitCanvas.width = drawW; window.hitCanvas.height = drawH; window.hitCtx.clearRect(0, 0, drawW, drawH); window.hitCtx.drawImage(img, 0, 0, drawW, drawH);
                    window.hitCtx.globalCompositeOperation = 'source-atop'; window.hitCtx.fillStyle = 'rgba(255, 68, 68, 0.65)'; window.hitCtx.fillRect(0, 0, drawW, drawH); window.hitCtx.globalCompositeOperation = 'source-over';
                    window.ctx.drawImage(window.hitCanvas, drawX, drawY);
                } else { window.ctx.drawImage(img, drawX, drawY, drawW, drawH); }
            } else { window.ctx.fillStyle = r.isHit ? '#ff4444' : '#666'; window.ctx.beginPath(); window.ctx.moveTo(-hw, 0); window.ctx.lineTo(-hw + r.width * 0.2, -r.height); window.ctx.lineTo(-hw + r.width * 0.8, -r.height + 5); window.ctx.lineTo(hw, 0); window.ctx.fill(); }
            if (r.hp < r.maxHp && (Date.now() - (r.lastHitTime || 0) < 3000)) {
                const pct = Math.max(0, r.hp / r.maxHp); const barW = Math.min(r.width + 8, 48); const barH = 5; const barX = -barW / 2; const barY = drawY - 14; const C = window.ctx;
                C.save(); C.globalAlpha = Math.min(1, (3000 - (Date.now() - r.lastHitTime)) / 400);
                C.fillStyle = 'rgba(0,0,0,0.72)'; C.beginPath(); C.roundRect(barX - 1, barY - 1, barW + 2, barH + 2, 3); C.fill();
                C.fillStyle = 'rgba(255,255,255,0.07)'; C.beginPath(); C.roundRect(barX, barY, barW, barH, 2); C.fill();
                const hc = pct > 0.6 ? '#2ecc71' : pct > 0.3 ? '#f39c12' : '#e74c3c'; const fw = Math.max(0, barW * pct);
                if (fw > 0) { C.fillStyle = hc; C.beginPath(); C.roundRect(barX, barY, fw, barH, [2, fw >= barW - 1 ? 2 : 0, fw >= barW - 1 ? 0 : 0, 2]); C.fill(); C.fillStyle = 'rgba(255,255,255,0.2)'; C.fillRect(barX + 1, barY + 1, Math.max(0, fw - 2), 1); }
                C.restore();
            }
            window.ctx.restore();
        }
    });

    // Árboles (oak/pine/birch/cactus) con sprite y barra de HP
    window.trees.forEach(t => {
        if (t.x + t.width > _visLeft - 200 && t.x < _visRight + 200) {
            window.ctx.save(); window.ctx.translate(t.x + t.width / 2, t.y + t.height);
            let hw = t.width / 2; let img = null;
            if (t.isStump) img = window.sprites.tree_stump; else if (t.type === 0) img = window.sprites.tree_oak; else if (t.type === 1) img = window.sprites.tree_pine; else if (t.type === 2) img = window.sprites.tree_birch;
            let drawH = 256; let drawW = 128; let drawX = -drawW / 2; let drawY = -drawH;
            if (t.type === 3 && !t.isStump) {
                // Cactus sintético con brazos opcionales y flor
                const C2 = window.ctx; const hit = t.isHit; const ch = t.height * 0.9; const cw = 10; const rad = 4; const varSeed = (Math.sin(t.x * 0.047) * 0.5 + 0.5);
                const green1 = hit ? '#ff5555' : `hsl(${108 + varSeed*16},${52+varSeed*12}%,${28+varSeed*8}%)`; const green2 = hit ? '#cc2222' : `hsl(${110 + varSeed*14},${45+varSeed*10}%,${20+varSeed*6}%)`; const spine = hit ? '#ffaaaa' : '#c8d6a0';
                C2.save(); C2.fillStyle = green1; C2.beginPath(); C2.roundRect(-cw/2, -ch, cw, ch, rad); C2.fill(); C2.strokeStyle = green2; C2.lineWidth = 1.5; C2.beginPath(); C2.moveTo(0, -ch + 4); C2.lineTo(0, -4); C2.stroke();
                const armLY = -ch * (0.48 + varSeed * 0.14); const armLH = ch * (0.28 + varSeed * 0.08); const armW = 8; const armLX = -cw/2 - armW;
                C2.fillStyle = green1; C2.beginPath(); C2.roundRect(armLX, armLY - armW*0.6, armW + cw/2, armW*0.65, 2); C2.fill(); C2.strokeStyle = green2; C2.lineWidth = 0.8; C2.stroke(); C2.beginPath(); C2.roundRect(armLX, armLY - armLH, armW, armLH, [rad, rad, 2, 2]); C2.fill(); C2.stroke();
                const armRY = -ch * (0.60 + varSeed * 0.10); const armRH = ch * (0.22 + varSeed * 0.06); const armRX = cw/2;
                C2.fillStyle = green1; C2.beginPath(); C2.roundRect(armRX - 2, armRY - armW*0.6, armW + 2, armW*0.65, 2); C2.fill(); C2.strokeStyle = green2; C2.lineWidth = 0.8; C2.stroke(); C2.beginPath(); C2.roundRect(armRX + armW - 2, armRY - armRH, armW, armRH, [rad, rad, 2, 2]); C2.fill(); C2.stroke();
                C2.strokeStyle = spine; C2.lineWidth = 0.8;
                for (let sy = -ch + 10; sy < -8; sy += 12) { C2.beginPath(); C2.moveTo(-cw/2, sy); C2.lineTo(-cw/2 - 5, sy - 2); C2.stroke(); C2.beginPath(); C2.moveTo(cw/2, sy + 4); C2.lineTo(cw/2 + 5, sy + 2); C2.stroke(); }
                if (varSeed > 0.35) { const petals = 5; const pr = 4.5; C2.fillStyle = varSeed > 0.65 ? '#f06090' : '#f0b040'; for (let pi = 0; pi < petals; pi++) { const angle = (pi / petals) * Math.PI * 2 - Math.PI / 2; C2.beginPath(); C2.ellipse(Math.cos(angle) * pr, -ch - Math.sin(angle) * pr, 2.5, 4, angle, 0, Math.PI * 2); C2.fill(); } C2.fillStyle = '#ffe066'; C2.beginPath(); C2.arc(0, -ch, 3, 0, Math.PI * 2); C2.fill(); }
                C2.restore();
            } else if (img && img.complete && img.naturalWidth > 0) {
                if (t.isHit) {
                    window.hitCanvas.width = drawW; window.hitCanvas.height = drawH; window.hitCtx.clearRect(0, 0, drawW, drawH); window.hitCtx.drawImage(img, 0, 0, drawW, drawH);
                    window.hitCtx.globalCompositeOperation = 'source-atop'; window.hitCtx.fillStyle = 'rgba(255, 68, 68, 0.65)'; window.hitCtx.fillRect(0, 0, drawW, drawH); window.hitCtx.globalCompositeOperation = 'source-over';
                    window.ctx.drawImage(window.hitCanvas, drawX, drawY);
                } else { window.ctx.drawImage(img, drawX, drawY, drawW, drawH); }
            } else if (t.type !== 3) { window.ctx.fillStyle = t.isHit ? '#ff4444' : (t.isStump ? '#5D4037' : '#2E7D32'); window.ctx.fillRect(-hw, -t.height, t.width, t.isStump ? 15 : t.height); }
            if (t.hp < t.maxHp && (Date.now() - (t.lastHitTime || 0) < 3000)) {
                const pct = Math.max(0, t.hp / t.maxHp); const barW = Math.min(t.width + 12, 48); const barH = 5; const barX = -barW / 2; const barY = t.isStump ? -28 : drawY - 14; const C = window.ctx;
                C.save(); C.globalAlpha = Math.min(1, (3000 - (Date.now() - t.lastHitTime)) / 400);
                C.fillStyle = 'rgba(0,0,0,0.72)'; C.beginPath(); C.roundRect(barX - 1, barY - 1, barW + 2, barH + 2, 3); C.fill();
                C.fillStyle = 'rgba(255,255,255,0.07)'; C.beginPath(); C.roundRect(barX, barY, barW, barH, 2); C.fill();
                const hc = pct > 0.6 ? '#2ecc71' : pct > 0.3 ? '#f39c12' : '#e74c3c'; const fw = Math.max(0, barW * pct);
                if (fw > 0) { C.fillStyle = hc; C.beginPath(); C.roundRect(barX, barY, fw, barH, [2, fw >= barW - 1 ? 2 : 0, fw >= barW - 1 ? 0 : 0, 2]); C.fill(); C.fillStyle = 'rgba(255,255,255,0.2)'; C.fillRect(barX + 1, barY + 1, Math.max(0, fw - 2), 1); }
                C.restore();
            }
            window.ctx.restore();
        }
    });

    // === TERRENO POR COLUMNAS (flat / ramp_r / ramp_l / hole) ===
    {
        const bs       = window.game.blockSize; const base = window.game.baseGroundLevel;
        const startCol = Math.floor(startX / bs) - 1; const endCol = Math.ceil(endX / bs) + 1;
        const _dStart  = (window.game.desertStart || 2600) + window.game.shoreX; const _dWidth = window.game.desertWidth || 800;

        // Patrones de textura dirt y sand (se crean una vez)
        if (!window._dirtPattern && window.sprites.tile_dirt.complete && window.sprites.tile_dirt.naturalWidth > 0) {
            const tc = document.createElement('canvas'); tc.width = 64; tc.height = 64; tc.getContext('2d').drawImage(window.sprites.tile_dirt, 0, 0); window._dirtPattern = window.ctx.createPattern(tc, 'repeat');
        }
        if (!window._sandPattern && window.sprites.tile_sand_base.complete && window.sprites.tile_sand_base.naturalWidth > 0) {
            const sc = document.createElement('canvas'); sc.width = 64; sc.height = 64; sc.getContext('2d').drawImage(window.sprites.tile_sand_base, 0, 0); window._sandPattern = window.ctx.createPattern(sc, 'repeat');
        }

        function colDesert(cx) { if (cx > _dStart + _dWidth) return 1; if (cx > _dStart) return (cx - _dStart) / _dWidth; return 0; }

        // Dibuja un tramo sólido [colA,colB]: dirt + arena + degradé profundidad
        function drawSolidSegment(colA, colB) {
            window.ctx.save(); window.ctx.beginPath(); window.ctx.moveTo(colA * bs, bottomY);
            for (let col = colA; col <= colB + 1; col++) {
                const d = window.getTerrainCol ? window.getTerrainCol(col) : { topY: base, type: 'flat' }; const x = col * bs; if (d.type === 'hole') break;
                if (d.type === 'ramp_r') { const nd = window.getTerrainCol ? window.getTerrainCol(col + 1) : d; const nY = (nd && nd.type !== 'hole') ? nd.topY : d.topY + bs; window.ctx.lineTo(x, d.topY); window.ctx.lineTo(x + bs, nY); }
                else if (d.type === 'ramp_l') { const pd = window.getTerrainCol ? window.getTerrainCol(col - 1) : d; const pY = (pd && pd.type !== 'hole') ? pd.topY : d.topY + bs; window.ctx.lineTo(x, pY); window.ctx.lineTo(x + bs, d.topY); }
                else { window.ctx.lineTo(x, d.topY); window.ctx.lineTo(x + bs, d.topY); }
            }
            window.ctx.lineTo((colB + 1) * bs, bottomY); window.ctx.closePath(); window.ctx.clip();
            window.ctx.fillStyle = window._dirtPattern || '#3d2412'; window.ctx.fillRect(colA * bs, window.camera.y - 400, (colB - colA + 2) * bs, bottomY - window.camera.y + 500);
            { const g = window.ctx.createLinearGradient(0, base - 40, 0, base + 660); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.08, 'rgba(0,0,0,0.06)'); g.addColorStop(0.28, 'rgba(0,0,0,0.20)'); g.addColorStop(0.55, 'rgba(0,0,0,0.38)'); g.addColorStop(1.0, 'rgba(0,0,0,0.58)'); window.ctx.fillStyle = g; window.ctx.fillRect(colA * bs, window.camera.y - 400, (colB - colA + 2) * bs, bottomY - window.camera.y + 500); }
            for (let c = colA; c <= colB; c++) { const da = colDesert(c * bs + bs / 2); if (da <= 0) continue; window.ctx.globalAlpha = da; window.ctx.fillStyle = window._sandPattern || '#d4a853'; window.ctx.fillRect(c * bs, window.camera.y - 400, bs + 1, bottomY - window.camera.y + 500); }
            window.ctx.globalAlpha = 1; window.ctx.restore();
        }

        // Iterar columnas, dibujar tramos sólidos (los pozos quedan transparentes)
        let segStart = null;
        for (let col = startCol; col <= endCol + 2; col++) {
            const d = window.getTerrainCol ? window.getTerrainCol(col) : { type: 'flat' }; const isHole = (d.type === 'hole');
            if (!isHole && segStart === null) { segStart = col; } else if (isHole && segStart !== null) { drawSolidSegment(segStart, col - 1); segStart = null; }
        }
        if (segStart !== null) drawSolidSegment(segStart, endCol + 1);

        // ── CELDAS UNDERGROUND: bloques con textura + fondo oscuro para cuevas ──
        // Principios:
        //   • Celda sólida (stone/dirt/coal/etc) → se dibuja con su color y detalle
        //   • Celda air (cueva natural o minada) → se dibuja un bloque de FONDO OSCURO
        //     indestructible y sin colisión — oculta el cielo/fondo que se vería detrás
        //   • SIN gradiente de oscuridad sobre tiles — el lightCanvas ya maneja la luz
        //   • Todo determinista: mismo resultado en todos los jugadores
        //   • Cache por frame para evitar recalcular noise varias veces por columna
        if (window.getUGCellV && window.getTerrainCol) {
            const C        = window.ctx;
            const bottomYu = _iCamY + H / z + bs * 4;
            const UG_COLOR = {
                dirt:    '#5c3d22', stone:   '#5a5a6a',
                coal:    '#2a2a30', sulfur:  '#7a6a10',
                diamond: '#1a6068', bedrock: '#1a1a1a',
            };
            const BG_DARK  = '#141210';
            const BG_VAR   = '#181512';

            // ── Player UG row para fog-of-war ──
            const _fogEnabled    = !!window._caveExplored;
            // Reusar variables de culling ya calculadas arriba
            const _playerOnSurf  = _onSurface;
            const _surfBlackRow  = 3;

            window._ugFrameCache = {};

            for (let col = startCol; col <= endCol; col++) {
                const cd = window.getTerrainCol(col);
                if (!cd || cd.type === 'hole') continue;
                const topY  = cd.topY;
                const x     = col * bs;
                const drawW = bs + 0.5;
                const maxRow = Math.min(window.UG_MAX_DEPTH || 90,
                                        Math.ceil((bottomYu - topY) / bs) + 1);

                for (let row = 0; row < maxRow; row++) {
                    const cellY = topY + row * bs;
                    if (cellY >= bottomYu) break;
                    const cH = Math.min(bs, bottomYu - cellY) + 1;

                    // ── Blackout de superficie: desde la superficie, >3 bloques = negro ──
                    if (_playerOnSurf && row >= _surfBlackRow) {
                        C.fillStyle = '#000000';
                        C.fillRect(x, Math.floor(cellY), drawW, cH);
                        continue;
                    }

                    // ── Fog de cueva: celdas no exploradas = roca oscura ──
                    if (_fogEnabled && row > 0 && !_playerOnSurf) {
                        if (!window._caveExplored.has(`${col}_${row}`)) {
                            C.fillStyle = '#0a0a0c';
                            C.fillRect(x, Math.floor(cellY), drawW, cH);
                            continue;
                        }
                    }

                    const _ck = col + '_' + row;
                    let mat = window._ugFrameCache[_ck];
                    if (mat === undefined) {
                        mat = window.getUGCellV(col, row);
                        window._ugFrameCache[_ck] = mat;
                    }

                    if (mat === 'air') {
                        const varH = ((col * 374761393 ^ row * 1103515245) >>> 0) / 0xFFFFFFFF;
                        C.fillStyle = varH > 0.55 ? BG_VAR : BG_DARK;
                        C.fillRect(x, Math.floor(cellY), drawW, cH);
                        if (row % 4 === 0) {
                            C.fillStyle = 'rgba(0,0,0,0.35)';
                            C.fillRect(x, Math.floor(cellY), drawW, 1);
                        }
                        if (varH > 0.82) {
                            C.fillStyle = 'rgba(255,255,255,0.025)';
                            C.fillRect(x + Math.floor(varH * bs * 0.6), Math.floor(cellY) + 2, 2, bs - 4);
                        }
                        continue;
                    }

                    // ── Celda sólida: dibujar con su material ──
                    C.fillStyle = UG_COLOR[mat] || '#5a5a6a';
                    C.fillRect(x, Math.floor(cellY), drawW, cH);

                    // Variación y detalle por material
                    const varH = ((col * 374761393 ^ row * 1103515245) >>> 0) / 0xFFFFFFFF;
                    if (mat === 'stone') {
                        if (row % 3 === 0) { C.fillStyle = 'rgba(255,255,255,0.04)'; C.fillRect(x, Math.floor(cellY), drawW, 1); }
                        if (varH > 0.7)    { C.fillStyle = 'rgba(0,0,0,0.08)';       C.fillRect(x, Math.floor(cellY), drawW, cH); }
                    } else if (mat === 'dirt') {
                        if (varH > 0.6)    { C.fillStyle = 'rgba(0,0,0,0.12)';       C.fillRect(x, Math.floor(cellY), drawW, cH); }
                    } else if (mat === 'coal') {
                        C.fillStyle = 'rgba(80,80,90,0.4)';   C.fillRect(x + Math.floor(varH*bs*0.4), Math.floor(cellY)+3, Math.ceil(bs*0.5), 3);
                        C.fillStyle = 'rgba(20,20,25,0.6)';   C.fillRect(x, Math.floor(cellY), drawW, 2);
                    } else if (mat === 'sulfur') {
                        C.fillStyle = 'rgba(255,220,0,0.18)'; C.fillRect(x + Math.floor(varH*bs*0.3), Math.floor(cellY)+2, Math.ceil(bs*0.4), Math.ceil(bs*0.5));
                        C.fillStyle = 'rgba(200,160,0,0.3)';  C.fillRect(x, Math.floor(cellY), drawW, 2);
                        if (varH > 0.78) { C.fillStyle = 'rgba(255,255,100,0.5)'; C.fillRect(x+4, Math.floor(cellY)+4, 3, 3); }
                    } else if (mat === 'diamond') {
                        C.fillStyle = 'rgba(100,240,255,0.22)'; C.fillRect(x + Math.floor(varH*bs*0.2), Math.floor(cellY)+1, Math.ceil(bs*0.6), Math.ceil(bs*0.4));
                        C.fillStyle = 'rgba(0,200,230,0.35)';   C.fillRect(x, Math.floor(cellY), drawW, 2);
                        if (varH > 0.60) { C.fillStyle = 'rgba(180,255,255,0.7)'; C.fillRect(x+2+Math.floor(varH*bs*0.5), Math.floor(cellY)+2, 2, 2); }
                        if (varH > 0.85) { C.fillStyle = 'rgba(255,255,255,0.8)'; C.fillRect(x+Math.floor(bs*0.6), Math.floor(cellY)+5, 2, 2); }
                        if ((window.game.frameCount & 3) === (col & 3)) {
                            const pulse = 0.10 + Math.abs(Math.sin(window.game.frameCount * 0.03 + col * 0.4 + row * 0.6)) * 0.12;
                            C.fillStyle = `rgba(120,255,255,${pulse})`; C.fillRect(x, Math.floor(cellY), drawW, cH);
                        }
                    }

                    // Grietas de minado (sin barra de HP — la textura de grietas es suficiente)
                    const frac = window.getCellDmgFrac ? window.getCellDmgFrac(col, row) : 0;
                    if (frac > 0) {
                        const crackAlpha = 0.18 + frac * 0.70;
                        const cSeed = (col * 7 + row * 13) & 0xFF;
                        C.fillStyle = `rgba(0,0,0,${crackAlpha})`;
                        const numCracks = 2 + Math.floor(frac * 4);
                        for (let cr = 0; cr < numCracks; cr++) {
                            const cx  = x + ((cSeed * (cr + 1) * 37) % (bs - 6)) + 2;
                            const cy  = Math.floor(cellY) + ((cSeed * (cr + 1) * 53) % (bs - 6)) + 2;
                            const cw  = 1 + Math.floor(frac * 3);
                            const ch  = Math.floor(frac * 10) + 2 + (cr & 1) * 4;
                            C.fillRect(cx, cy, cw, ch);
                            // grieta cruzada en ángulo para dar volumen
                            if (frac > 0.4) {
                                C.fillRect(cx + (cr & 1 ? 2 : -2), cy + Math.floor(ch * 0.4), ch, cw);
                            }
                        }
                        // Overlay semitransparente cuando está a punto de romperse
                        if (frac > 0.75) {
                            C.fillStyle = `rgba(255,180,60,${(frac - 0.75) * 0.28})`;
                            C.fillRect(x, Math.floor(cellY), drawW, cH);
                        }
                    }
                }
            }
        }

        // ── Cristales de cueva: estalactitas y estalagmitas decorativas ──────
        if (window.getUGCellV && window.getTerrainCol && !_onSurface) {
            const C = window.ctx;
            const _cFrame = window.game.frameCount;
            const _fogEnabledC = !!window._caveExplored;
            for (let _cc = startCol; _cc <= endCol; _cc++) {
                const _ccd = window.getTerrainCol(_cc);
                if (!_ccd || _ccd.type === 'hole') continue;
                const _ctopY = _ccd.topY;
                const _cx2 = _cc * bs;
                const _maxCRow = Math.min(window.UG_MAX_DEPTH || 90, Math.ceil((_iCamY + H/z + bs*3 - _ctopY) / bs) + 1);
                for (let _cr = 1; _cr < _maxCRow - 1; _cr++) {
                    const _cCellY = _ctopY + _cr * bs;
                    if (_cCellY < _iCamY - bs*2 || _cCellY > _iCamY + H/z + bs*2) continue;
                    if (_fogEnabledC && !window._caveExplored?.has(`${_cc}_${_cr}`)) continue;
                    const _hash = ((_cc * 374761393) ^ (_cr * 1103515245) ^ ((window.worldSeed||12345) * 2654435761)) >>> 0;
                    const _hf   = _hash / 0xFFFFFFFF;
                    const _matC = window.getUGCellV(_cc, _cr);
                    if (_matC === 'air') continue;
                    const _matBelow = window.getUGCellV(_cc, _cr + 1);
                    if (_matBelow === 'air' && _hf < 0.055) {
                        const _cLen = 5 + _hf * 30;
                        const _cX   = _cx2 + bs * (0.2 + _hf * 0.6);
                        const _cCol = _cr > 20 ? `rgba(180,80,255,0.85)` : (_cr > 12 ? `rgba(60,160,255,0.80)` : `rgba(200,235,255,0.65)`);
                        const _pulse = 0.7 + Math.sin(_cFrame * 0.06 + _cc * 0.7 + _cr * 1.1) * 0.3;
                        C.globalAlpha = _pulse;
                        C.fillStyle = _cCol;
                        C.beginPath(); C.moveTo(_cX-3, _cCellY+bs-1); C.lineTo(_cX+3, _cCellY+bs-1); C.lineTo(_cX, _cCellY+bs-1+_cLen); C.closePath(); C.fill();
                        C.globalAlpha = _pulse * 0.55;
                        C.fillStyle = 'rgba(255,255,255,0.8)';
                        C.fillRect(_cX-0.5, _cCellY+bs, 1, _cLen * 0.4);
                        C.globalAlpha = 1;
                    }
                    const _matAbove = window.getUGCellV(_cc, _cr - 1);
                    if (_matAbove === 'air' && _hf > 0.96) {
                        const _sLen = 4 + (_hf-0.96)*25*20;
                        const _sX   = _cx2 + bs * (0.15 + ((_hf*1.7)%1) * 0.7);
                        const _sCol = _cr > 20 ? `rgba(160,60,240,0.75)` : (_cr > 12 ? `rgba(40,140,230,0.70)` : `rgba(180,220,255,0.55)`);
                        const _spulse = 0.65 + Math.sin(_cFrame * 0.07 + _cc * 1.1 + _cr * 0.8) * 0.35;
                        C.globalAlpha = _spulse;
                        C.fillStyle = _sCol;
                        C.beginPath(); C.moveTo(_sX-2.5, _cCellY+1); C.lineTo(_sX+2.5, _cCellY+1); C.lineTo(_sX, _cCellY+1-_sLen); C.closePath(); C.fill();
                        C.globalAlpha = 1;
                    }
                }
            }
        }

        // ── Telas de araña de cueva ─────────────────────────────────────────
        if (window.caveCobwebs?.length > 0) {
            const C = window.ctx;
            for (const _cw of window.caveCobwebs) {
                if (_cw.x + _cw.w < startCol * bs || _cw.x > (endCol + 1) * bs) continue;
                const _hpFrac = _cw.hp / _cw.maxHp;
                // Más dañada → más transparente
                const _alpha = 0.35 + _hpFrac * 0.50;
                C.save();

                const seed  = _cw.seed || 0.5;
                const seed2 = ((seed * 137.508) % 1);
                const seed3 = ((seed * 251.133) % 1);

                // Centro de la red: en la esquina (style 0=izq, 1=der) o en el techo (2=centro)
                let _ox, _oy;
                if (_cw.style === 0)      { _ox = _cw.x;              _oy = _cw.y; }
                else if (_cw.style === 1) { _ox = _cw.x + _cw.w;     _oy = _cw.y; }
                else                      { _ox = _cw.x + _cw.w * 0.5; _oy = _cw.y; }

                // Radio de la red
                const _R = Math.min(_cw.w, _cw.h) * (0.7 + seed * 0.5);

                // Ángulo de barrido según posición:
                // esquina izq → abre hacia abajo-derecha (0 a π/2)
                // esquina der → abre hacia abajo-izquierda (π/2 a π)
                // techo centro → semicírculo completo (0 a π)
                let _angStart, _angEnd;
                if (_cw.style === 0)      { _angStart = 0;        _angEnd = Math.PI * 0.55; }
                else if (_cw.style === 1) { _angStart = Math.PI * 0.45; _angEnd = Math.PI; }
                else                      { _angStart = 0;        _angEnd = Math.PI; }

                const _threads = 6 + Math.floor(seed * 4);   // 6-9 hilos radiales
                const _rings   = 4 + Math.floor(seed2 * 3);  // 4-6 anillos concéntricos

                // Calcular puntos extremos de cada hilo radial
                const _tips = [];
                for (let _t = 0; _t < _threads; _t++) {
                    const _frac = _t / (_threads - 1);
                    // Leve variación de ángulo para que no sea perfecto
                    const _jitter = (seed3 + _t * 0.17) % 0.12 - 0.06;
                    const _ang = _angStart + (_angEnd - _angStart) * _frac + _jitter;
                    _tips.push({
                        x: _ox + Math.cos(_ang) * _R,
                        y: _oy + Math.sin(_ang) * _R,
                        ang: _ang
                    });
                }

                // Hilos radiales (del centro a cada punta)
                C.globalAlpha = _alpha;
                C.strokeStyle = 'rgba(230,230,230,1)';
                C.lineWidth = 0.9;
                C.beginPath();
                for (const _tip of _tips) {
                    C.moveTo(_ox, _oy);
                    C.lineTo(_tip.x, _tip.y);
                }
                C.stroke();

                // Anillos concéntricos: conectan las puntas de hilo a hilo con curvas suaves
                C.lineWidth = 0.65;
                for (let _r = 1; _r <= _rings; _r++) {
                    const _rf = _r / _rings;
                    // Variar ligeramente el radio por anillo para aspecto orgánico
                    const _rJit = 1 + (((seed + _r * 0.31) % 1) - 0.5) * 0.08;
                    C.globalAlpha = _alpha * (1 - _rf * 0.25); // anillos exteriores más tenues
                    C.strokeStyle = 'rgba(210,210,210,1)';
                    C.beginPath();
                    for (let _t = 0; _t < _tips.length; _t++) {
                        const _tip = _tips[_t];
                        const _px  = _ox + (_tip.x - _ox) * _rf * _rJit;
                        const _py  = _oy + (_tip.y - _oy) * _rf * _rJit;
                        // Punto de control ligeramente desplazado para dar la curva de seda
                        const _mid = _tips[Math.min(_t + 1, _tips.length - 1)];
                        const _cpx = (_ox + (_mid.x - _ox) * _rf * _rJit + _px) * 0.5;
                        const _cpy = (_oy + (_mid.y - _oy) * _rf * _rJit + _py) * 0.5 + (_rf * 3);
                        if (_t === 0) C.moveTo(_px, _py);
                        else C.quadraticCurveTo(_cpx, _cpy, _px, _py);
                    }
                    C.stroke();
                }

                // Gotitas de rocío (pequeños círculos en los hilos) — solo en HP alto
                if (_hpFrac > 0.5 && seed > 0.4) {
                    C.globalAlpha = _alpha * 0.6;
                    C.fillStyle = 'rgba(200,230,255,1)';
                    const _dropCount = 2 + Math.floor(seed * 3);
                    for (let _d = 0; _d < _dropCount; _d++) {
                        const _ti = _tips[Math.floor(((seed + _d * 0.33) % 1) * _tips.length)];
                        const _df = 0.25 + ((_d * 0.19 + seed2) % 0.65);
                        const _dx = _ox + (_ti.x - _ox) * _df;
                        const _dy = _oy + (_ti.y - _oy) * _df;
                        C.beginPath();
                        C.arc(_dx, _dy, 1.2, 0, Math.PI * 2);
                        C.fill();
                    }
                }

                // Agujeros si está muy dañada (HP < 40%)
                if (_hpFrac < 0.4) {
                    C.globalAlpha = _alpha * 0.4;
                    C.strokeStyle = 'rgba(80,80,80,1)';
                    C.lineWidth = 1.5;
                    C.setLineDash([2, 3]);
                    C.beginPath();
                    const _hx = _ox + (_tips[1]?.x - _ox || 0) * 0.5;
                    const _hy = _oy + (_tips[1]?.y - _oy || 0) * 0.5;
                    C.arc(_hx, _hy, _R * 0.18, 0, Math.PI * 2);
                    C.stroke();
                    C.setLineDash([]);
                }

                C.globalAlpha = 1;
                C.restore();
            }
        }

        // ── Plantas fluorescentes de cueva ──────────────────────────────────────
        if (window.cavePlants?.length > 0) {
            const C   = window.ctx;
            // Paleta: [color principal, color brillo, color glow]
            const _shroomPalette = [
                ['#1a4aff','#88aaff','rgba(40,80,255,'],   // azul
                ['#22cc44','#88ffaa','rgba(40,220,80,'],    // verde
                ['#aa22ee','#dd88ff','rgba(170,40,240,'],   // violeta
            ];
            for (const _cp of window.cavePlants) {
                // Culling lateral
                if (_cp.x + bs < startCol * bs || _cp.x > (endCol + 1) * bs) continue;
                // Ocultar cuando jugador está en superficie
                if (_onSurface && _cp.y > _surfCutY) continue;
                // Fog de cueva: no mostrar si no explorada
                if (window._caveExplored && !window._caveExplored.has(`${_cp.col}_${_cp.row}`)) continue;
                C.save();
                // Brillo fijo por planta (sin animación — determinado solo por seed)
                const _brightness = 0.65 + _cp.seed * 0.35;
                if (_cp.type === 'shroom') {
                    const _pal = _shroomPalette[_cp.variant % 3];
                    const _h = 8 + _cp.seed * 10;
                    // Pie
                    C.fillStyle = '#c8c0a8';
                    C.fillRect(_cp.x - 2, _cp.y + bs - _h, 4, _h);
                    // Sombrero
                    C.fillStyle = _pal[0];
                    C.beginPath();
                    C.ellipse(_cp.x, _cp.y + bs - _h - 1, 7 + _cp.seed * 4, 5, 0, 0, Math.PI * 2);
                    C.fill();
                    // Brillo estático (no se mueve)
                    C.globalAlpha = 0.55 * _brightness;
                    C.fillStyle = _pal[1];
                    C.beginPath();
                    C.ellipse(_cp.x - 2, _cp.y + bs - _h - 2, 3, 2, 0, 0, Math.PI * 2);
                    C.fill();
                    // Halo de luz estático
                    C.globalAlpha = 0.13 * _brightness;
                    const _gr = C.createRadialGradient(_cp.x, _cp.y + bs - _h, 0, _cp.x, _cp.y + bs - _h, 28);
                    _gr.addColorStop(0, _pal[2] + '0.7)');
                    _gr.addColorStop(1, _pal[2] + '0)');
                    C.fillStyle = _gr;
                    C.beginPath(); C.arc(_cp.x, _cp.y + bs - _h, 28, 0, Math.PI * 2); C.fill();
                } else if (_cp.type === 'moss') {
                    // Musgo colgante del techo — hebras estáticas (sin movimiento de onda)
                    const _len = 8 + _cp.seed * 14;
                    C.globalAlpha = 0.6 * _brightness;
                    C.strokeStyle = '#22cc55';
                    C.lineWidth = 1.5;
                    const _strands = 3 + Math.floor(_cp.seed * 3);
                    for (let _s = 0; _s < _strands; _s++) {
                        const _sx = _cp.x + (_s / Math.max(1,_strands-1)) * 10 - 5;
                        const _sLen = _len * (0.6 + ((_cp.seed + _s*0.3)%1) * 0.4);
                        // Curva estática por strand (sin _fc)
                        const _sCurve = Math.sin(_s * 2.1 + _cp.seed * 5.7) * 2.5;
                        C.beginPath();
                        C.moveTo(_sx, _cp.y);
                        C.quadraticCurveTo(_sx + _sCurve, _cp.y + _sLen * 0.5, _sx + _sCurve * 0.5, _cp.y + _sLen);
                        C.stroke();
                        // Punta brillante
                        C.fillStyle = '#88ffbb';
                        C.globalAlpha = _brightness * 0.55;
                        C.beginPath(); C.arc(_sx + _sCurve*0.5, _cp.y + _sLen, 1.5, 0, Math.PI * 2); C.fill();
                    }
                    // Halo tenue estático
                    C.globalAlpha = 0.08 * _brightness;
                    const _mgr = C.createRadialGradient(_cp.x, _cp.y + _len*0.5, 0, _cp.x, _cp.y + _len*0.5, 22);
                    _mgr.addColorStop(0, 'rgba(40,200,80,0.5)');
                    _mgr.addColorStop(1, 'rgba(40,200,80,0)');
                    C.fillStyle = _mgr;
                    C.beginPath(); C.arc(_cp.x, _cp.y + _len*0.5, 22, 0, Math.PI * 2); C.fill();
                }
                C.globalAlpha = 1;
                C.restore();
            }
        }

        // Superficie (grass/sand top) por columna
        for (let col = startCol; col <= endCol; col++) {
            const col_data = window.getTerrainCol ? window.getTerrainCol(col) : { topY: base, type: 'flat' }; if (col_data.type === 'hole') continue;
            const x = col * bs;
            // No dibujar pasto para columnas fuera del mundo jugable (antes del shore)
            if (x + bs <= (window.game.shoreX || 0)) continue;
            const topY = col_data.topY; const da = colDesert(x + bs / 2); const texX = (x % 64 + 64) % 64; const drawW = Math.min(bs + 0.5, 64 - texX);
            const row0Mined = window.getUGCellV && window.getUGCellV(col, 0) === 'air';
            if (row0Mined) continue;
            if (col_data.type === 'flat') {
                // Clip grass/sand tile to a thin surface band (20px) so it never bleeds below terrain at zoom-out
                window.ctx.save();
                window.ctx.beginPath(); window.ctx.rect(x - 0.5, topY - 2, bs + 2, 22); window.ctx.clip();
                if (da < 1) { window.ctx.globalAlpha = 1 - da; const fImg = window.sprites.tile_grass_top; if (fImg && fImg.complete && fImg.naturalWidth > 0) { window.ctx.drawImage(fImg, texX, 0, drawW, 64, x, topY - 1, drawW, 64); if (drawW < bs) window.ctx.drawImage(fImg, 0, 0, bs - drawW + 0.5, 64, x + drawW, topY - 1, bs - drawW + 0.5, 64); } else { window.ctx.fillStyle = '#528c2a'; window.ctx.fillRect(x, topY - 1, bs + 1, 20); } }
                if (da > 0) { window.ctx.globalAlpha = da; const sImg = window.sprites.tile_sand_top; if (sImg && sImg.complete && sImg.naturalWidth > 0) { window.ctx.drawImage(sImg, texX, 0, drawW, 64, x, topY - 1, drawW, 64); if (drawW < bs) window.ctx.drawImage(sImg, 0, 0, bs - drawW + 0.5, 64, x + drawW, topY - 1, bs - drawW + 0.5, 64); } else { window.ctx.fillStyle = '#e6c280'; window.ctx.fillRect(x, topY - 1, bs + 1, 20); } }
                window.ctx.globalAlpha = 1;
                window.ctx.restore();
                window.ctx.strokeStyle = 'rgba(0,0,0,0.22)'; window.ctx.lineWidth = 1; window.ctx.beginPath(); window.ctx.moveTo(x, topY); window.ctx.lineTo(x + bs, topY); window.ctx.stroke();
            } else if (col_data.type === 'ramp_r' || col_data.type === 'ramp_l') {
                // Franja de pasto/arena diagonal sobre la rampa
                const nextData = window.getTerrainCol ? window.getTerrainCol(col + 1) : null; const prevData = window.getTerrainCol ? window.getTerrainCol(col - 1) : null;
                let topYL, topYR;
                if (col_data.type === 'ramp_r') { topYL = topY; topYR = (nextData && nextData.type !== 'hole') ? nextData.topY : topY + bs; }
                else { topYL = (prevData && prevData.type !== 'hole') ? prevData.topY : topY + bs; topYR = topY; }
                window.ctx.save(); const surfaceThickness = 18;
                window.ctx.beginPath(); window.ctx.moveTo(x, topYL); window.ctx.lineTo(x + bs, topYR); window.ctx.lineTo(x + bs, topYR + surfaceThickness); window.ctx.lineTo(x, topYL + surfaceThickness); window.ctx.closePath(); window.ctx.clip();
                window.ctx.save(); const rampAngle = Math.atan2(topYR - topYL, bs); const midX = x + bs / 2; const midY = (topYL + topYR) / 2; window.ctx.translate(midX, midY); window.ctx.rotate(rampAngle);
                if (da < 1) { const fImg = window.sprites.tile_grass_top; window.ctx.globalAlpha = 1 - da; if (fImg && fImg.complete && fImg.naturalWidth > 0) { window.ctx.drawImage(fImg, -bs * 0.75, -2, bs * 1.5, 64); } else { window.ctx.fillStyle = '#528c2a'; window.ctx.fillRect(-bs * 0.75, -2, bs * 1.5, surfaceThickness); } }
                if (da > 0) { const sImg = window.sprites.tile_sand_top; window.ctx.globalAlpha = da; if (sImg && sImg.complete && sImg.naturalWidth > 0) { window.ctx.drawImage(sImg, -bs * 0.75, -2, bs * 1.5, 64); } else { window.ctx.fillStyle = '#e6c280'; window.ctx.fillRect(-bs * 0.75, -2, bs * 1.5, surfaceThickness); } }
                window.ctx.globalAlpha = 1; window.ctx.restore();
                window.ctx.strokeStyle = 'rgba(0,0,0,0.22)'; window.ctx.lineWidth = 1; window.ctx.beginPath(); window.ctx.moveTo(x, topYL); window.ctx.lineTo(x + bs, topYR); window.ctx.stroke();
                window.ctx.restore();
            }
            // Sombra en cara vertical de acantilado
            const leftData = window.getTerrainCol ? window.getTerrainCol(col - 1) : null;
            if (leftData && leftData.type !== 'hole' && leftData.topY > topY) { window.ctx.save(); window.ctx.beginPath(); window.ctx.rect(x, topY, 4, leftData.topY - topY); window.ctx.clip(); window.ctx.fillStyle = 'rgba(0,0,0,0.22)'; window.ctx.fill(); window.ctx.restore(); }
        }

        // Vegetación animada (pasto, flores, hongos, detalles desierto) por columna
        // PERF: la animación se congela cada 2 frames en medium (wt constante), pero
        // siempre se DIBUJA para evitar el parpadeo que causaba omitir el render.
        if (Q !== 'low') {
        const _vegFrame = window.game.frameCount || 0;
        // Congelar wt en frames impares (medium): misma pose, sin flicker
        const _wt_this = (_vegFrame % 2 === 0 || Q === 'high') ? _vegFrame : _vegFrame - 1;
        {
            const wt = _wt_this * 0.04;
            window.ctx.lineCap = 'round';
            for (let col = startCol; col <= endCol; col++) {
                const col_data = window.getTerrainCol ? window.getTerrainCol(col) : { topY: base, type: 'flat' }; if (col_data.type === 'hole') continue;
                // No dibujar vegetación si la superficie fue minada
                if (window.getUGCellV && window.getUGCellV(col, 0) === 'air') continue;
                const topY = col_data.topY; const x = col * bs; const colCX = x + bs / 2; const da = colDesert(colCX);
                const gY = window.getGroundY(colCX);
                if (da < 1 && colCX > (window.game.shoreX || 0) + 20) {
                    {
                        window.ctx.globalAlpha = (1 - da) * 0.9; window.ctx.lineWidth = 1;
                        const seed = Math.sin(colCX * 0.0173) * 0.5 + 0.5; const seed2 = Math.sin(colCX * 0.0531 + 1.2) * 0.5 + 0.5;
                        const h1 = 4 + seed * 6; const wx1 = Math.sin(wt + colCX * 0.11) * 2;
                        window.ctx.strokeStyle = seed > 0.5 ? '#4caf50' : '#2e7d32'; window.ctx.beginPath(); window.ctx.moveTo(colCX - bs * 0.3 + seed * bs * 0.5, gY + 2); window.ctx.quadraticCurveTo(colCX - bs * 0.3 + seed * bs * 0.5 + wx1, gY - h1 * 0.5, colCX - bs * 0.3 + seed * bs * 0.5 + wx1 * 1.5, gY - h1); window.ctx.stroke();
                        if (seed2 > 0.15) { const h2 = 3 + seed2 * 4; const wx2 = Math.sin(wt * 1.1 + colCX * 0.09 + 0.8) * 1.5; window.ctx.strokeStyle = '#388e3c'; window.ctx.beginPath(); window.ctx.moveTo(colCX + seed2 * bs * 0.4 - bs * 0.2, gY + 2); window.ctx.quadraticCurveTo(colCX + seed2 * bs * 0.4 - bs * 0.2 + wx2, gY - h2 * 0.5, colCX + seed2 * bs * 0.4 - bs * 0.2 + wx2 * 1.5, gY - h2); window.ctx.stroke(); }
                        const seed3 = Math.sin(colCX * 0.0812 + 3.3) * 0.5 + 0.5;
                        if (seed3 > 0.2) { const h3 = 2 + seed3 * 3; const wx3 = Math.sin(wt * 0.9 + colCX * 0.13 + 1.6) * 1.2; window.ctx.strokeStyle = seed3 > 0.6 ? '#1b5e20' : '#43a047'; window.ctx.beginPath(); window.ctx.moveTo(colCX - bs * 0.1 + seed3 * bs * 0.3, gY + 2); window.ctx.quadraticCurveTo(colCX - bs * 0.1 + seed3 * bs * 0.3 + wx3, gY - h3 * 0.5, colCX - bs * 0.1 + seed3 * bs * 0.3 + wx3 * 1.3, gY - h3); window.ctx.stroke(); }
                        if (Q === 'high') { const seed4 = Math.sin(colCX * 0.1041 + 5.1) * 0.5 + 0.5; if (seed4 > 0.2) { const h4 = 3 + seed4 * 5; const wx4 = Math.sin(wt * 1.3 + colCX * 0.15 + 2.2) * 1.8; window.ctx.strokeStyle = seed4 > 0.55 ? '#33691e' : '#558b2f'; window.ctx.lineWidth = 0.8; window.ctx.beginPath(); window.ctx.moveTo(colCX + seed4 * bs * 0.2 - bs * 0.05, gY + 2); window.ctx.quadraticCurveTo(colCX + seed4 * bs * 0.2 - bs * 0.05 + wx4, gY - h4 * 0.5, colCX + seed4 * bs * 0.2 - bs * 0.05 + wx4 * 1.4, gY - h4); window.ctx.stroke(); } }
                        window.ctx.globalAlpha = 1;
                    }
                    if (Q !== 'low') {
                        const dStart2 = (window.game.desertStart || 2600) + window.game.shoreX; const inForestZone = colCX > window.game.shoreX + 200 && colCX < dStart2 - 200;
                        if (inForestZone && col_data.type === 'flat') {
                            const fSeed1 = Math.sin(colCX * 0.0531 + 7.3) * 0.5 + 0.5; const fSeed2 = Math.sin(colCX * 0.0871 + 2.1) * 0.5 + 0.5; const fSeed3 = Math.sin(colCX * 0.1237 + 4.7) * 0.5 + 0.5; const C = window.ctx;
                            C.globalAlpha = (1 - da) * 0.88;
                            if (fSeed1 > 0.93) {
                                const mx = colCX + fSeed2 * bs * 0.3 - bs * 0.15; const isRed = fSeed3 > 0.5; const stemH = 5 + fSeed2 * 4;
                                C.fillStyle = '#e8dcc8'; C.fillRect(mx + 2, gY - stemH + 3, 4, stemH); C.fillStyle = isRed ? '#c0392b' : '#8B4513'; C.beginPath(); C.ellipse(mx + 4, gY - stemH + 4, 7, 5, 0, Math.PI, 0); C.fill(); C.fillStyle = 'rgba(255,255,255,0.75)'; C.beginPath(); C.arc(mx + 2, gY - stemH + 2, 1.2, 0, Math.PI * 2); C.fill(); C.beginPath(); C.arc(mx + 6, gY - stemH + 3, 0.9, 0, Math.PI * 2); C.fill();
                            }
                            if (fSeed2 > 0.91 && fSeed1 <= 0.93) {
                                const fx = colCX + fSeed1 * bs * 0.3 - bs * 0.1; const stemH2 = 6 + fSeed3 * 5; const flowerColors = ['#e74c3c','#9b59b6','#f39c12','#e91e8c','#3498db']; const fc = flowerColors[Math.floor(fSeed3 * flowerColors.length)];
                                C.fillStyle = '#27ae60'; C.fillRect(fx + 1, gY - stemH2 + 3, 2, stemH2); C.fillStyle = fc;
                                for (let p = 0; p < 4; p++) { const pa = (p / 4) * Math.PI * 2; C.beginPath(); C.ellipse(fx + 2 + Math.cos(pa) * 3, gY - stemH2 + 3 + Math.sin(pa) * 2.5, 2.2, 1.5, pa, 0, Math.PI * 2); C.fill(); }
                                C.fillStyle = '#f1c40f'; C.beginPath(); C.arc(fx + 2, gY - stemH2 + 3, 1.8, 0, Math.PI * 2); C.fill();
                            }
                            C.globalAlpha = 1;
                        }
                    }
                }
                if (da > 0.3 && col_data.type === 'flat') {
                    // Detalles del desierto: huesos y palitos
                    const dSeed1 = Math.sin(colCX * 0.0712 + 1.9) * 0.5 + 0.5; const dSeed2 = Math.sin(colCX * 0.1183 + 5.5) * 0.5 + 0.5; const dSeed3 = Math.sin(colCX * 0.0443 + 3.2) * 0.5 + 0.5; const C = window.ctx;
                    C.globalAlpha = da * 0.8;
                    if (dSeed1 > 0.97) { const bx2 = colCX + dSeed2 * bs * 0.3 - bs * 0.15; const bAng = (dSeed3 - 0.5) * 0.8; C.save(); C.translate(bx2, gY - 2); C.rotate(bAng); C.fillStyle = '#d4cdb8'; C.fillRect(-7, -1.5, 14, 3); C.beginPath(); C.arc(-7, 0, 3.5, 0, Math.PI * 2); C.fill(); C.beginPath(); C.arc(7, 0, 3.5, 0, Math.PI * 2); C.fill(); C.fillStyle = '#b8b0a0'; C.fillRect(-5, -1, 10, 2); C.restore(); }
                    if (dSeed2 > 0.96 && dSeed1 <= 0.97) { const tx = colCX + dSeed3 * bs * 0.2; C.strokeStyle = '#8B7355'; C.lineWidth = 1.5; C.beginPath(); C.moveTo(tx, gY); C.lineTo(tx + 3 + dSeed1 * 8, gY - 5 - dSeed2 * 7); C.stroke(); C.lineWidth = 1; C.strokeStyle = '#7a6545'; C.beginPath(); C.moveTo(tx + 4, gY - 3); C.lineTo(tx + 7, gY - 7); C.stroke(); C.beginPath(); C.moveTo(tx + 6, gY - 4); C.lineTo(tx + 4, gY - 8); C.stroke(); }
                    C.globalAlpha = 1;
                }
            }
        } // end veg draw block
        } // end Q !== 'low'
    } // fin terreno por columnas

    // Bloques colocados por el jugador — dibujados DESPUÉS del terreno para
    // que sean visibles tanto en superficie como dentro de cuevas.
    window.blocks.forEach(b => {
        if (b.x + window.game.blockSize > _visLeft && b.x < _visRight + 120) {
            if (b.type === 'block') {
                window.ctx.fillStyle = b.isHit ? '#ff4444' : '#C19A6B'; window.ctx.fillRect(b.x, b.y, window.game.blockSize, window.game.blockSize);
                if (!b.isHit) { window.ctx.fillStyle = 'rgba(255,255,255,0.12)'; window.ctx.fillRect(b.x, b.y, window.game.blockSize, 4); window.ctx.fillStyle = 'rgba(0,0,0,0.22)'; window.ctx.fillRect(b.x, b.y + window.game.blockSize - 5, window.game.blockSize, 5); window.ctx.fillStyle = 'rgba(0,0,0,0.1)'; window.ctx.fillRect(b.x + window.game.blockSize - 4, b.y, 4, window.game.blockSize); }
                window.ctx.strokeStyle = '#8B5A2B'; window.ctx.lineWidth = 2; window.ctx.strokeRect(b.x, b.y, window.game.blockSize, window.game.blockSize);
                if (b.maxHp) drawCracks(window.ctx, b.x, b.y, window.game.blockSize, window.game.blockSize, b.hp / b.maxHp);
            } else if (b.type === 'door') {
                if (b.open) { window.ctx.fillStyle = '#3a2518'; window.ctx.fillRect(b.x + 12, b.y, 6, window.game.blockSize * 2); }
                else { window.ctx.fillStyle = b.isHit ? '#ff4444' : '#5C4033'; window.ctx.fillRect(b.x + 4, b.y, 22, window.game.blockSize * 2); window.ctx.fillStyle = '#FFD700'; window.ctx.fillRect(b.x + 20, b.y + window.game.blockSize, 4, 4); }
                if (!b.open && b.maxHp) drawCracks(window.ctx, b.x + 4, b.y, 22, window.game.blockSize * 2, b.hp / b.maxHp);
            } else if (b.type === 'box') {
                window.ctx.fillStyle = b.isHit ? '#ff4444' : '#8B4513'; window.ctx.fillRect(b.x + 2, b.y + 10, window.game.blockSize - 4, window.game.blockSize - 10); window.ctx.fillStyle = '#C19A6B'; window.ctx.fillRect(b.x, b.y + 10, window.game.blockSize, 4); window.ctx.fillStyle = '#333'; window.ctx.fillRect(b.x + window.game.blockSize/2 - 2, b.y + 12, 4, 6);
            } else if (b.type === 'campfire') {
                window.ctx.fillStyle = '#5c4033'; window.ctx.fillRect(b.x + 2, b.y + 20, 26, 10); window.ctx.fillStyle = '#3e2723'; window.ctx.fillRect(b.x + 10, b.y + 15, 10, 15);
                if (b.isBurning) { window.ctx.fillStyle = '#e67e22'; window.ctx.beginPath(); window.ctx.moveTo(b.x+5, b.y+20); window.ctx.lineTo(b.x+15, b.y+Math.random()*10); window.ctx.lineTo(b.x+25, b.y+20); window.ctx.fill(); window.ctx.fillStyle = '#f1c40f'; window.ctx.beginPath(); window.ctx.moveTo(b.x+10, b.y+20); window.ctx.lineTo(b.x+15, b.y+10+Math.random()*5); window.ctx.lineTo(b.x+20, b.y+20); window.ctx.fill(); }
            } else if (b.type === 'bed') {
                window.ctx.fillStyle = b.isHit ? '#ff4444' : '#8B4513'; window.ctx.fillRect(b.x, b.y + 20, 30, 10); window.ctx.fillStyle = b.isHit ? '#ff4444' : '#5C4033'; window.ctx.fillRect(b.x, b.y + 20, 4, 10); window.ctx.fillRect(b.x + 26, b.y + 20, 4, 10); window.ctx.fillStyle = '#e0e0e0'; window.ctx.fillRect(b.x + 2, b.y + 16, 10, 4); window.ctx.fillStyle = '#c0392b'; window.ctx.fillRect(b.x + 12, b.y + 16, 18, 4);
            } else if (b.type === 'grave') {
                window.ctx.fillStyle = b.isHit ? '#ff4444' : '#7f8c8d'; window.ctx.fillRect(b.x + 12, b.y + 5, 6, 25); window.ctx.fillRect(b.x + 5, b.y + 12, 20, 6); window.ctx.fillStyle = '#fff'; window.ctx.font = 'bold 14px "VT323"'; window.ctx.textAlign = 'center'; window.ctx.fillText("RIP", b.x + 15, b.y + 17);
            } else if (b.type === 'barricade') {
                window.ctx.fillStyle = '#5D4037'; window.ctx.fillRect(b.x + 2, b.y + 24, 26, 6); window.ctx.fillStyle = b.isHit ? '#ff4444' : '#bdc3c7'; window.ctx.beginPath(); window.ctx.moveTo(b.x + 5, b.y + 24); window.ctx.lineTo(b.x + 2, b.y + 5); window.ctx.lineTo(b.x + 10, b.y + 24); window.ctx.moveTo(b.x + 12, b.y + 24); window.ctx.lineTo(b.x + 15, b.y + 2); window.ctx.lineTo(b.x + 18, b.y + 24); window.ctx.moveTo(b.x + 20, b.y + 24); window.ctx.lineTo(b.x + 28, b.y + 8); window.ctx.lineTo(b.x + 25, b.y + 24); window.ctx.fill();
                if (b.maxHp) drawCracks(window.ctx, b.x, b.y, window.game.blockSize, window.game.blockSize, b.hp / b.maxHp);
            } else if (b.type === 'ladder') {
                const lc = b.isHit ? '#ff9966' : '#c8a86a'; const lsd = b.isHit ? '#cc6633' : '#8B6230';
                window.ctx.fillStyle = lsd; window.ctx.fillRect(b.x + 5, b.y, 5, 30); window.ctx.fillRect(b.x + 20, b.y, 5, 30);
                window.ctx.fillStyle = lc; for (let rung = 0; rung < 3; rung++) { window.ctx.fillRect(b.x + 5, b.y + 4 + rung * 9, 20, 3); }
            } else if (b.type === 'stair') {
                const bs = window.game.blockSize; const wood = b.isHit ? '#ff4444' : '#C19A6B'; const woodD = b.isHit ? '#cc2222' : '#8B5A2B'; const fr = b.facingRight !== false; const step = bs / 3; const C = window.ctx;
                C.beginPath();
                if (fr) { C.moveTo(b.x, b.y + bs); C.lineTo(b.x + bs, b.y + bs); C.lineTo(b.x + bs, b.y); C.lineTo(b.x + 2*step, b.y); C.lineTo(b.x + 2*step, b.y + step); C.lineTo(b.x + step, b.y + step); C.lineTo(b.x + step, b.y + 2*step); C.lineTo(b.x, b.y + 2*step); }
                else { C.moveTo(b.x, b.y + bs); C.lineTo(b.x + bs, b.y + bs); C.lineTo(b.x + bs, b.y + 2*step); C.lineTo(b.x + 2*step, b.y + 2*step); C.lineTo(b.x + 2*step, b.y + step); C.lineTo(b.x + step, b.y + step); C.lineTo(b.x + step, b.y); C.lineTo(b.x, b.y); }
                C.closePath(); C.fillStyle = wood; C.fill(); C.strokeStyle = woodD; C.lineWidth = 2; C.stroke();
                if (b.maxHp) drawCracks(C, b.x, b.y, bs, bs, b.hp / b.maxHp);
            } else if (b.type === 'dirt_block') {
                const C = window.ctx; const bs = window.game.blockSize;
                C.fillStyle = b.isHit ? '#ff4444' : '#5c3d22';
                C.fillRect(b.x, b.y, bs, bs);
                if (!b.isHit) {
                    C.fillStyle = 'rgba(255,255,255,0.08)'; C.fillRect(b.x, b.y, bs, 3);
                    C.fillStyle = 'rgba(0,0,0,0.18)';       C.fillRect(b.x, b.y+bs-4, bs, 4);
                }
                C.strokeStyle = '#3a2210'; C.lineWidth = 1.5; C.strokeRect(b.x+0.5, b.y+0.5, bs-1, bs-1);
                if (b.maxHp) drawCracks(C, b.x, b.y, bs, bs, b.hp/b.maxHp);
            } else if (b.type === 'placed_torch') {
                const C = window.ctx; const bs = window.game.blockSize;
                const tx = b.x + bs*0.5, ty = b.y + bs*0.7;
                const flicker = 0.88 + Math.sin((window.game.frameCount||0)*0.25 + b.x*0.01)*0.12;
                C.strokeStyle = '#8B6230'; C.lineWidth = 3;
                C.beginPath(); C.moveTo(tx, ty+4); C.lineTo(tx, ty-8); C.stroke();
                C.fillStyle = `rgba(230,100,10,${0.7*flicker})`;
                C.beginPath(); C.moveTo(tx-5, ty-6); C.quadraticCurveTo(tx-3, ty-14*flicker, tx, ty-18*flicker); C.quadraticCurveTo(tx+3, ty-14*flicker, tx+5, ty-6); C.closePath(); C.fill();
                C.fillStyle = `rgba(255,200,50,${0.9*flicker})`;
                C.beginPath(); C.moveTo(tx-3, ty-8); C.quadraticCurveTo(tx, ty-16*flicker, tx+3, ty-8); C.closePath(); C.fill();
            } else if (b.type === 'turret') {
                const C = window.ctx; const bs = window.game.blockSize; const bx = b.x, by = b.y; const hasArrows = (b.arrows || 0) > 0; const ang = b.aimAngle || 0;
                C.fillStyle = b.isHit ? '#ff8866' : '#8B6230'; C.fillRect(bx + 4, by + 16, 22, 14);
                C.fillStyle = b.isHit ? '#cc5533' : '#5D3A1A'; C.fillRect(bx + 4, by + 14, 22, 4);
                C.fillStyle = b.isHit ? '#ffaa88' : '#a07840'; C.beginPath(); C.arc(bx + 15, by + 18, 5, 0, Math.PI * 2); C.fill();
                C.save(); C.translate(bx + 15, by + 18); C.rotate(ang);
                C.fillStyle = b.isHit ? '#ff6644' : '#6b4c24'; C.fillRect(0, -2, 16, 4);
                if (hasArrows) {
                    C.strokeStyle = b.isHit ? '#ffaa44' : '#c8a050'; C.lineWidth = 2.5; C.beginPath(); C.arc(14, 0, 7, -1.1, 1.1); C.stroke();
                    C.strokeStyle = b.isHit ? '#ffccaa' : 'rgba(210,195,160,0.9)'; C.lineWidth = 1; C.beginPath(); C.moveTo(14 + Math.cos(-1.1)*7, Math.sin(-1.1)*7); C.lineTo(8, 0); C.lineTo(14 + Math.cos(1.1)*7, Math.sin(1.1)*7); C.stroke();
                    C.fillStyle = '#c8a050'; C.fillRect(8, -1, 10, 2); C.fillStyle = '#607888'; C.fillRect(18, -2, 4, 4);
                } else { C.strokeStyle = 'rgba(100,80,40,0.5)'; C.lineWidth = 2; C.beginPath(); C.arc(14, 0, 7, -1.1, 1.1); C.stroke(); }
                C.restore();
                C.fillStyle = 'rgba(0,0,0,0.7)'; C.beginPath(); C.roundRect(bx + 6, by + 2, 18, 10, 3); C.fill();
                C.fillStyle = hasArrows ? '#f0c020' : '#888'; C.font = 'bold 14px "VT323"'; C.textAlign = 'center'; C.fillText(`🎯${b.arrows||0}`, bx + 15, by + 10); C.textAlign = 'left';
                if (b.hp < b.maxHp) { const pct = b.hp / b.maxHp; const bw = 24, bh = 3; C.fillStyle = 'rgba(0,0,0,0.7)'; C.fillRect(bx + 3, by + 29, bw, bh); C.fillStyle = pct > 0.5 ? '#2ecc71' : pct > 0.25 ? '#f39c12' : '#e74c3c'; C.fillRect(bx + 3, by + 29, bw * pct, bh); }
            }
        }
    });

    // Items en el suelo (flotan con seno)
    window.droppedItems.forEach(item => {
        if (item.x + 20 > _visLeft && item.x < _visRight + 60) {
            // Ocultar items subterráneos cuando jugador está en superficie
            if (_onSurface && item.y > _surfCutY) return;
            const _def = window.itemDefs[item.type];
            if (!_def) return;
            const s = _def.size; const floatOffset = Math.sin(item.life * 3 + item.x * 0.1) * 3;
            const ix = item.x, iy = item.y + floatOffset;
            // Sombra
            window.ctx.globalAlpha = 0.25; window.ctx.fillStyle = '#000';
            window.ctx.beginPath(); window.ctx.ellipse(ix + s/2, iy + s + 2, s*0.55, 2, 0, 0, Math.PI*2); window.ctx.fill();
            window.ctx.globalAlpha = 1;
            // Item cuadrado con borde
            window.ctx.fillStyle = _def.color; window.ctx.fillRect(ix, iy, s, s);
            window.ctx.strokeStyle = 'rgba(255,255,255,0.4)'; window.ctx.lineWidth = 1;
            window.ctx.strokeRect(ix + 0.5, iy + 0.5, s - 1, s - 1);
            // Cantidad si > 1
            if (item.amount > 1) {
                window.ctx.font = 'bold 8px sans-serif'; window.ctx.fillStyle = '#fff';
                window.ctx.textAlign = 'center';
                window.ctx.shadowColor = '#000'; window.ctx.shadowBlur = 2;
                window.ctx.fillText(item.amount, ix + s/2, iy + s + 8);
                window.ctx.shadowBlur = 0; window.ctx.textAlign = 'left';
            }
        }
    });

    if (window.game.isMultiplayer) { Object.values(window.otherPlayers).forEach(p => { if (p.id !== window.socket?.id && p.x > _visLeft - 50 && p.x < _visRight + 150) { window.drawCharacter(p, false); } }); }
    // Jugador: NO interpolar posición — el personaje del jugador siempre en posición física
    // exacta para evitar lag perceptible en input. Solo la cámara se interpola.
    if (!window.player.inBackground) window.drawCharacter(window.player, true);

    // === ENTIDADES (chicken, spider, zombie, archer, wolf) ===
    window.entities.forEach(ent => {
        if (!(ent.x + ent.width > _visLeft && ent.x < _visRight + 120)) return;
        // Ocultar entidades subterráneas cuando jugador está en superficie
        if (_onSurface && ent.y > _surfCutY) return;
        const C = window.ctx; const H = ent.isHit; const ER = (ent.enragedFrames||0) > 0; const FR = ent.vx >= 0; const T = window.game.frameCount;
        // Interpolación de posición de entidad
        const _ra3 = window._renderAlpha ?? 1;
        const _eOrigX = ent.x, _eOrigY = ent.y;
        if (ent._prevX !== undefined) {
            ent.x = ent._prevX + (_eOrigX - ent._prevX) * _ra3;
            ent.y = ent._prevY + (_eOrigY - ent._prevY) * _ra3;
        }
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
        } else if (ent.type === 'bat') {
            const x=ent.x, y=ent.y, w=ent.width, h=ent.height;
            const _fc = window.game.frameCount;
            const _sleeping = ent.batState === 'roost';
            const _swooping = ent.batState === 'swoop';
            // Wing flap — faster when swooping
            const _flapSpd = _swooping ? 0.75 : 0.32;
            const _flapAmp = _sleeping ? 0 : (_swooping ? 0.95 : 0.6);
            const _wf = Math.sin(_fc * _flapSpd) * _flapAmp;
            const _cx = x + w/2, _cy = y + h*0.5;
            const _lvlScale = Math.min(1.6, 1.0 + (ent.level||1)*0.08); // bigger at higher levels

            C.save(); C.translate(_cx, _cy); C.scale(_lvlScale, _lvlScale); C.translate(-_cx, -_cy);

            // Wing color — darker purple for cave bats, red if hit
            const _wCol  = H ? 'rgba(255,80,80,0.88)' : (ent.inCave ? 'rgba(30,10,55,0.92)' : 'rgba(40,15,65,0.88)');
            const _wVein = H ? 'rgba(255,160,120,0.5)' : 'rgba(80,40,120,0.45)';

            // Left wing — 3 finger bones + membrane
            C.save(); C.translate(_cx, _cy + h*0.05);
            const _lw1x = -w*0.3 - _wf*w*0.35, _lw1y = -h*0.15 + _wf*h*0.2;
            const _lw2x = -w*0.8 - _wf*w*0.1,  _lw2y =  h*0.1  + _wf*h*0.15;
            const _lw3x = -w*0.55,               _lw3y = -h*0.35 - _wf*h*0.1;
            C.fillStyle = _wCol;
            C.beginPath(); C.moveTo(0,0);
            C.lineTo(_lw3x, _lw3y);
            C.lineTo(_lw1x, _lw1y);
            C.lineTo(_lw2x, _lw2y);
            C.quadraticCurveTo(-w*0.2, h*0.18, 0, h*0.05);
            C.closePath(); C.fill();
            // Venas del ala izquierda
            C.strokeStyle = _wVein; C.lineWidth = 0.7;
            C.beginPath(); C.moveTo(0,0); C.lineTo(_lw1x, _lw1y); C.stroke();
            C.beginPath(); C.moveTo(0,0); C.lineTo(_lw2x, _lw2y); C.stroke();
            C.beginPath(); C.moveTo(0,0); C.lineTo(_lw3x, _lw3y); C.stroke();
            C.restore();

            // Right wing (mirror)
            C.save(); C.translate(_cx, _cy + h*0.05);
            const _rw1x = w*0.3 + _wf*w*0.35, _rw1y = -h*0.15 + _wf*h*0.2;
            const _rw2x = w*0.8 + _wf*w*0.1,  _rw2y =  h*0.1  + _wf*h*0.15;
            const _rw3x = w*0.55,               _rw3y = -h*0.35 - _wf*h*0.1;
            C.fillStyle = _wCol;
            C.beginPath(); C.moveTo(0,0);
            C.lineTo(_rw3x, _rw3y);
            C.lineTo(_rw1x, _rw1y);
            C.lineTo(_rw2x, _rw2y);
            C.quadraticCurveTo(w*0.2, h*0.18, 0, h*0.05);
            C.closePath(); C.fill();
            C.strokeStyle = _wVein; C.lineWidth = 0.7;
            C.beginPath(); C.moveTo(0,0); C.lineTo(_rw1x, _rw1y); C.stroke();
            C.beginPath(); C.moveTo(0,0); C.lineTo(_rw2x, _rw2y); C.stroke();
            C.beginPath(); C.moveTo(0,0); C.lineTo(_rw3x, _rw3y); C.stroke();
            C.restore();

            // Body with fur gradient
            const _bG = C.createRadialGradient(_cx-1, _cy-2, 0, _cx, _cy, w*0.3);
            _bG.addColorStop(0, H ? '#ff7777' : (ent.inCave ? '#2a0a3a' : '#1e0830'));
            _bG.addColorStop(1, H ? '#cc1111' : '#0a0214');
            C.fillStyle = _bG;
            C.beginPath(); C.ellipse(_cx, _cy, w*0.26, h*0.45, 0, 0, Math.PI*2); C.fill();
            // Fur texture strokes
            if (!H) {
                C.strokeStyle = 'rgba(70,30,90,0.6)'; C.lineWidth = 0.8;
                for (let _fi=-2; _fi<=2; _fi++) {
                    C.beginPath(); C.moveTo(_cx+_fi*2.5, _cy-h*0.4); C.lineTo(_cx+_fi*2, _cy+h*0.1); C.stroke();
                }
            }
            // Ears
            const _earCol = H ? '#ff9999' : (ent.inCave ? '#3a1265' : '#2a0e55');
            C.fillStyle = _earCol;
            C.beginPath(); C.moveTo(_cx-3,_cy-h*0.35); C.lineTo(_cx-7,_cy-h*0.78); C.lineTo(_cx,_cy-h*0.4); C.closePath(); C.fill();
            C.beginPath(); C.moveTo(_cx+3,_cy-h*0.35); C.lineTo(_cx+7,_cy-h*0.78); C.lineTo(_cx,_cy-h*0.4); C.closePath(); C.fill();
            // Inner ear
            C.fillStyle = H ? '#ffaaaa' : 'rgba(180,80,180,0.5)';
            C.beginPath(); C.moveTo(_cx-3.2,_cy-h*0.38); C.lineTo(_cx-5.8,_cy-h*0.7); C.lineTo(_cx-0.5,_cy-h*0.42); C.closePath(); C.fill();
            C.beginPath(); C.moveTo(_cx+3.2,_cy-h*0.38); C.lineTo(_cx+5.8,_cy-h*0.7); C.lineTo(_cx+0.5,_cy-h*0.42); C.closePath(); C.fill();
            // Muzzle
            C.fillStyle = H ? '#ff8888' : '#1a0828';
            C.beginPath(); C.ellipse(_cx, _cy+h*0.08, w*0.14, h*0.18, 0, 0, Math.PI*2); C.fill();
            // Teeth (only when swooping)
            if (_swooping || H) {
                C.fillStyle = '#f0f0f0';
                C.beginPath(); C.moveTo(_cx-3,_cy+h*0.18); C.lineTo(_cx-1,_cy+h*0.28); C.lineTo(_cx+1,_cy+h*0.18); C.fill();
                C.beginPath(); C.moveTo(_cx+1,_cy+h*0.18); C.lineTo(_cx+3,_cy+h*0.26); C.lineTo(_cx+5,_cy+h*0.18); C.fill();
            }
            // Eyes — glowing when awake
            const _eyeGlow = _sleeping ? '#220a33' : (H ? '#ff4400' : (ent.inCave ? '#ff0044' : '#dd0000'));
            C.fillStyle = _eyeGlow;
            C.beginPath(); C.arc(_cx-3.5, _cy-h*0.06, _sleeping ? 1.2 : 2, 0, Math.PI*2); C.fill();
            C.beginPath(); C.arc(_cx+3.5, _cy-h*0.06, _sleeping ? 1.2 : 2, 0, Math.PI*2); C.fill();
            if (!_sleeping) {
                // Pupil + specular
                C.fillStyle = '#000';
                C.beginPath(); C.arc(_cx-3.5,_cy-h*0.06, 1, 0, Math.PI*2); C.fill();
                C.beginPath(); C.arc(_cx+3.5,_cy-h*0.06, 1, 0, Math.PI*2); C.fill();
                C.fillStyle = 'rgba(255,255,255,0.8)';
                C.beginPath(); C.arc(_cx-3,_cy-h*0.1, 0.6, 0, Math.PI*2); C.fill();
                C.beginPath(); C.arc(_cx+4,_cy-h*0.1, 0.6, 0, Math.PI*2); C.fill();
            }
            C.restore();
        } else if (ent.type === 'spider') {
            const x=ent.x, y=ent.y, w=ent.width, h=ent.height;
            const isBoss = !!ent.isBoss; const enraged = !!ent.bossEnrage;
            const legAnim = Math.abs(ent.vx)>0.1 ? Math.sin(T*0.45)*0.35 : 0;
            // Colores por tipo
            const bodyCol  = H ? '#ff4422' : (isBoss ? (enraged ? '#cc1100' : '#4a1a6a') : (ent.inCave ? '#1a1a2a' : '#1a1818'));
            const bodyCol2 = H ? '#ff7755' : (isBoss ? (enraged ? '#ff3300' : '#7a2a9a') : '#2a2a3a');
            const eyeCol   = isBoss ? (enraged ? '#ff8800' : '#cc00ff') : '#ff1100';
            const cx2 = x + w/2, cy2 = y + h*0.45;

            // Sombra
            C.globalAlpha = 0.18; C.fillStyle = '#000';
            C.beginPath(); C.ellipse(cx2, y+h+1, w*0.48, 2.5, 0, 0, Math.PI*2); C.fill(); C.globalAlpha=1;

            // ── Patas (8, 4 por lado) ──
            C.lineWidth = isBoss ? 2.5 : 1.5;
            const legCount = 4;
            for (let side = -1; side <= 1; side += 2) {
                for (let i = 0; i < legCount; i++) {
                    const legPhase = legAnim * (i % 2 === 0 ? 1 : -1) * side;
                    const baseX = cx2 + side * w * 0.2;
                    const baseY = cy2 + (i - 1.5) * h * 0.18;
                    const midX  = cx2 + side * (w * 0.7 + i * 2);
                    const midY  = cy2 - h * 0.3 + legPhase * 8;
                    const tipX  = cx2 + side * (w * 1.1 + i * 3);
                    const tipY  = y + h + legPhase * 4;
                    const grad  = C.createLinearGradient(baseX, baseY, tipX, tipY);
                    grad.addColorStop(0, bodyCol2); grad.addColorStop(1, H?'#ff6644':'#111');
                    C.strokeStyle = grad;
                    C.beginPath(); C.moveTo(baseX, baseY); C.quadraticCurveTo(midX, midY, tipX, tipY); C.stroke();
                }
            }

            // ── Abdomen (cuerpo trasero) ──
            const abdGrad = C.createRadialGradient(cx2-2, cy2+2, 1, cx2, cy2+2, w*0.48);
            abdGrad.addColorStop(0, bodyCol2); abdGrad.addColorStop(1, bodyCol);
            C.fillStyle = abdGrad;
            C.beginPath(); C.ellipse(cx2, cy2 + h*0.12, w*0.45, h*0.42, 0, 0, Math.PI*2); C.fill();
            // Patrón de abdomen (raya o puntos)
            if (!H) {
                if (isBoss) {
                    // Calavera en abdomen jefe
                    C.fillStyle = enraged ? 'rgba(255,80,0,0.6)' : 'rgba(200,100,255,0.5)';
                    C.beginPath(); C.ellipse(cx2, cy2+h*0.12, w*0.22, h*0.18, 0, 0, Math.PI*2); C.fill();
                    C.fillStyle = 'rgba(0,0,0,0.7)';
                    C.beginPath(); C.arc(cx2-4, cy2+h*0.08, 2.5, 0, Math.PI*2); C.fill();
                    C.beginPath(); C.arc(cx2+4, cy2+h*0.08, 2.5, 0, Math.PI*2); C.fill();
                } else {
                    C.fillStyle = 'rgba(255,100,0,0.4)';
                    C.beginPath(); C.ellipse(cx2, cy2+h*0.14, w*0.15, h*0.12, 0, 0, Math.PI*2); C.fill();
                }
            }

            // ── Cefalotórax (cuerpo delantero) ──
            const cefGrad = C.createRadialGradient(cx2, cy2-h*0.1, 0, cx2, cy2-h*0.1, w*0.32);
            cefGrad.addColorStop(0, bodyCol2); cefGrad.addColorStop(1, bodyCol);
            C.fillStyle = cefGrad;
            C.beginPath(); C.ellipse(cx2, cy2 - h*0.12, w*0.30, h*0.30, 0, 0, Math.PI*2); C.fill();

            // ── Ojos ──
            const eyeRow = cy2 - h*0.18;
            const eyeCount = isBoss ? 4 : 2;
            for (let e2=0; e2<eyeCount; e2++) {
                const ex = cx2 + (e2 - (eyeCount-1)*0.5) * (isBoss ? 5 : 4);
                C.fillStyle = eyeCol;
                C.beginPath(); C.arc(ex, eyeRow, isBoss ? 3 : 2, 0, Math.PI*2); C.fill();
                C.fillStyle = 'rgba(255,255,255,0.7)';
                C.beginPath(); C.arc(ex+0.5, eyeRow-0.5, 0.8, 0, Math.PI*2); C.fill();
            }

            // ── Jefe: aura y barra de vida prominente ──
            if (isBoss) {
                const auraAlpha = 0.06 + Math.sin(T*0.08) * 0.03;
                C.globalAlpha = auraAlpha;
                const auraGrad = C.createRadialGradient(cx2, cy2, 0, cx2, cy2, w*1.2);
                auraGrad.addColorStop(0, enraged ? 'rgba(255,80,0,1)' : 'rgba(180,0,255,1)');
                auraGrad.addColorStop(1, 'rgba(0,0,0,0)');
                C.fillStyle = auraGrad;
                C.beginPath(); C.arc(cx2, cy2, w*1.2, 0, Math.PI*2); C.fill();
                C.globalAlpha = 1;
                // Barra HP encima del jefe
                const _bw = Math.max(60, w*1.4); const _bx2 = cx2 - _bw/2;
                const _hpFrac = Math.max(0, ent.hp/ent.maxHp);
                C.fillStyle = 'rgba(0,0,0,0.75)'; C.fillRect(_bx2-1, y-22, _bw+2, 9);
                const _hpCol = _hpFrac > 0.5 ? '#cc22cc' : (enraged ? '#ff4400' : '#aa00ff');
                C.fillStyle = _hpCol; C.fillRect(_bx2, y-21, _bw*_hpFrac, 7);
                C.strokeStyle = enraged ? '#ff8800' : '#dd00ff'; C.lineWidth=1.5;
                C.strokeRect(_bx2-0.5, y-21.5, _bw+1, 8);
                // Nombre encima
                C.font = 'bold 12px "VT323"'; C.fillStyle = enraged ? '#ff8800' : '#dd88ff';
                C.textAlign = 'center'; C.fillText(ent.name + ' Nv.' + ent.level, cx2, y-25); C.textAlign='left';
            }
        } else if (ent.type === 'beetle') {
            // ── Escarabajo de cueva ──
            const x=ent.x, y=ent.y, w=ent.width, h=ent.height;
            const cx2=x+w/2, cy2=y+h*0.5;
            const moving = Math.abs(ent.vx)>0.1;
            const legA   = moving ? Math.sin(T*0.55)*0.4 : 0;

            C.globalAlpha=0.15; C.fillStyle='#000'; C.beginPath(); C.ellipse(cx2, y+h+1, w*0.44, 2, 0, 0, Math.PI*2); C.fill(); C.globalAlpha=1;
            // Patas
            C.strokeStyle = H ? '#ff5533' : '#2a1a08'; C.lineWidth = 1.5;
            for (let i=0;i<3;i++) {
                const baseX = cx2 + (i-1)*w*0.22; const baseY = cy2+2;
                C.beginPath(); C.moveTo(baseX, baseY); C.lineTo(baseX - w*0.4 + legA*(i%2?6:-6), y+h+2); C.stroke();
                C.beginPath(); C.moveTo(baseX, baseY); C.lineTo(baseX + w*0.4 + legA*(i%2?-6:6), y+h+2); C.stroke();
            }
            // Caparazón
            const shG = C.createRadialGradient(cx2-2, cy2-2, 0, cx2, cy2, w*0.55);
            shG.addColorStop(0, H?'#ff7755':'#4a3520'); shG.addColorStop(0.5, H?'#cc4422':'#2d2010'); shG.addColorStop(1, H?'#882200':'#1a1008');
            C.fillStyle=shG; C.beginPath(); C.ellipse(cx2, cy2, w*0.50, h*0.46, 0, 0, Math.PI*2); C.fill();
            // Línea central del caparazón
            if (!H) { C.strokeStyle='rgba(0,0,0,0.5)'; C.lineWidth=1.5; C.beginPath(); C.moveTo(cx2, y+2); C.lineTo(cx2, y+h-2); C.stroke(); }
            // Cuernos
            C.fillStyle = H ? '#ff5533' : '#3a2510';
            C.beginPath(); C.moveTo(cx2-4,y+2); C.lineTo(cx2-7,y-5); C.lineTo(cx2-2,y+4); C.fill();
            C.beginPath(); C.moveTo(cx2+4,y+2); C.lineTo(cx2+7,y-5); C.lineTo(cx2+2,y+4); C.fill();
            // Ojos
            C.fillStyle = H ? '#ffdd00' : '#ff8800';
            C.beginPath(); C.arc(cx2-4, cy2-2, 2, 0, Math.PI*2); C.fill();
            C.beginPath(); C.arc(cx2+4, cy2-2, 2, 0, Math.PI*2); C.fill();

        } else if (ent.type === 'slime') {
            // ── Slime de cueva ──
            const x=ent.x, y=ent.y, w=ent.width, h=ent.height;
            const cx2=x+w/2, cy2=y+h*0.5;
            const isAir = !isGrounded || ent.vy < -0.5;
            // Squash/stretch al saltar
            const scaleX = isAir ? 0.75 : (1.0 + Math.abs(Math.sin(T*0.2))*0.05);
            const scaleY = isAir ? 1.3  : (0.85 - Math.abs(Math.sin(T*0.2))*0.05);
            const slimePalette = [
                ['#22aa44','#44ff88','rgba(40,180,80,'],    // verde
                ['#2244cc','#4488ff','rgba(40,80,220,'],    // azul
                ['#8822cc','#cc44ff','rgba(140,40,220,'],   // morado
            ];
            const _spal = slimePalette[(ent.slimeColor||0) % 3];

            C.save(); C.translate(cx2, y+h); C.scale(scaleX, scaleY); C.translate(-cx2, -(y+h));
            C.globalAlpha=0.12; C.fillStyle='#000'; C.beginPath(); C.ellipse(cx2, y+h+2, w*0.42, 2.5/scaleY, 0, 0, Math.PI*2); C.fill(); C.globalAlpha=1;
            // Cuerpo con gradiente
            const slG = C.createRadialGradient(cx2-3, cy2-5, 0, cx2, cy2, w*0.52);
            slG.addColorStop(0, H?'#ffaaaa':(_spal[1])); slG.addColorStop(0.6, H?'#ff4444':(_spal[0])); slG.addColorStop(1, H?'#cc0000':'rgba(0,0,0,0.6)');
            C.fillStyle=slG; C.beginPath(); C.ellipse(cx2, cy2-2, w*0.46, h*0.44, 0, 0, Math.PI*2); C.fill();
            // Brillo especular
            C.globalAlpha=0.45; C.fillStyle='rgba(255,255,255,0.8)';
            C.beginPath(); C.ellipse(cx2-4, cy2-7, w*0.12, h*0.10, -0.5, 0, Math.PI*2); C.fill();
            C.globalAlpha=1;
            // Ojos
            C.fillStyle='rgba(0,0,0,0.8)';
            C.beginPath(); C.arc(cx2-5, cy2-4, 2.5, 0, Math.PI*2); C.fill();
            C.beginPath(); C.arc(cx2+5, cy2-4, 2.5, 0, Math.PI*2); C.fill();
            C.fillStyle='#fff'; C.beginPath(); C.arc(cx2-4.2,cy2-4.8, 1, 0, Math.PI*2); C.fill();
            C.beginPath(); C.arc(cx2+5.8,cy2-4.8, 1, 0, Math.PI*2); C.fill();
            // Halo de luz tenue
            C.globalAlpha = 0.06;
            const _slhG = C.createRadialGradient(cx2, cy2, 0, cx2, cy2, 28);
            _slhG.addColorStop(0, _spal[2]+'0.5)'); _slhG.addColorStop(1, _spal[2]+'0)');
            C.fillStyle=_slhG; C.beginPath(); C.arc(cx2, cy2, 28, 0, Math.PI*2); C.fill();
            C.globalAlpha=1; C.restore();
        } else if (ent.type === 'worm') {
            // ── Gusano de Cueva (segmentado) ──
            const x=ent.x, y=ent.y, w=ent.width, h=ent.height;
            const FR = ent.vx >= 0;
            const segs = ent._wormSegs || [{x,y},{x:x-10,y},{x:x-20,y}];
            const segR = [6.5, 5.6, 4.8, 4.0];
            const bodyMain = H ? '#ff8866' : '#c8684a';
            const bodyDark = H ? '#cc3311' : '#7a3018';
            // Sombra
            C.globalAlpha=0.18; C.fillStyle='#000';
            C.beginPath(); C.ellipse(x+w*0.5, y+h+2, w*0.38, 2, 0, 0, Math.PI*2); C.fill(); C.globalAlpha=1;
            // Dibujar segmentos de atrás hacia adelante
            for (let _si = segs.length - 1; _si >= 0; _si--) {
                const _sx = segs[_si].x + w*0.5, _sy = segs[_si].y + h*0.5;
                const _sr = segR[Math.min(_si, segR.length-1)];
                const _sG = C.createRadialGradient(_sx-1, _sy-1, 0, _sx, _sy, _sr);
                _sG.addColorStop(0, H?'#ffaaaa':(_si===0?bodyDark:'#e07d55')); _sG.addColorStop(1, H?'#cc2200':bodyDark);
                C.fillStyle = _sG; C.beginPath(); C.arc(_sx, _sy, _sr, 0, Math.PI*2); C.fill();
                // Anillo de segmento
                C.strokeStyle='rgba(0,0,0,0.35)'; C.lineWidth=1;
                C.beginPath(); C.arc(_sx, _sy, _sr*0.65, 0, Math.PI*2); C.stroke();
            }
            // Cabeza
            const hx = x + (FR ? w*0.8 : w*0.2), hy = y + h*0.5;
            // Ojos
            const eyeOff = FR ? 2 : -2;
            C.fillStyle = H ? '#ffee00' : '#ff2200';
            C.beginPath(); C.arc(hx+eyeOff, hy-2, 2.8, 0, Math.PI*2); C.fill();
            C.fillStyle='#000'; C.beginPath(); C.arc(hx+eyeOff+0.5, hy-2, 1.3, 0, Math.PI*2); C.fill();
            C.fillStyle='rgba(255,255,255,0.8)'; C.beginPath(); C.arc(hx+eyeOff+1, hy-2.8, 0.7, 0, Math.PI*2); C.fill();
            // Boca
            C.strokeStyle='#442200'; C.lineWidth=1.5;
            const mOff = FR ? 5 : -5;
            C.beginPath(); C.arc(hx+mOff, hy+1.5, 3.5, FR?-0.7:Math.PI+0.7, FR?0.7:Math.PI-0.7); C.stroke();
            // HP bar si dañado
            if (ent.hp < ent.maxHp) {
                const _hf=ent.hp/ent.maxHp; C.fillStyle='rgba(0,0,0,0.6)'; C.fillRect(x,y-10,w,4);
                C.fillStyle=_hf>0.5?'#66cc44':'#ee4422'; C.fillRect(x,y-10,w*_hf,4);
            }

        } else if (ent.type === 'golem') {
            // ── Gólem de Cristal ──
            const x=ent.x, y=ent.y, w=ent.width, h=ent.height;
            const cx2=x+w/2, cy2=y+h*0.5;
            const FR = ent.vx >= 0;
            const moving = Math.abs(ent.vx) > 0.1;
            const walkBob = moving ? Math.sin(T*0.18)*2.5 : 0;
            const stoneCol = H ? '#ff7755' : '#3e3e52';
            const stoneDk  = H ? '#cc2200' : '#28282e';
            const xtalCol  = H ? 'rgba(255,160,140,0.9)' : 'rgba(80,200,255,0.9)';

            // Sombra
            C.globalAlpha=0.22; C.fillStyle='#000';
            C.beginPath(); C.ellipse(cx2, y+h+2, w*0.44, 2.5, 0, 0, Math.PI*2); C.fill(); C.globalAlpha=1;

            // Piernas
            const legSwing = moving ? Math.sin(T*0.22)*4 : 0;
            C.fillStyle = stoneDk;
            C.fillRect(x+2,   y+h*0.72+walkBob+legSwing,  w*0.36, h*0.28-Math.abs(legSwing));
            C.fillRect(x+w*0.55, y+h*0.72+walkBob-legSwing, w*0.36, h*0.28-Math.abs(legSwing));

            // Torso con gradiente
            const bodyG = C.createLinearGradient(x, y+h*0.18+walkBob, x+w, y+h*0.72+walkBob);
            bodyG.addColorStop(0, H?'#ff9977':'#4e4e66'); bodyG.addColorStop(1, H?'#cc3300':'#272730');
            C.fillStyle=bodyG; C.beginPath(); C.roundRect(x+2, y+h*0.18+walkBob, w-4, h*0.55, 5); C.fill();
            // Grietas en el cuerpo
            if (!H) {
                C.strokeStyle='rgba(0,0,0,0.55)'; C.lineWidth=1.5;
                C.beginPath(); C.moveTo(cx2-4,y+h*0.24+walkBob); C.lineTo(cx2-2,y+h*0.48+walkBob); C.lineTo(cx2+4,y+h*0.58+walkBob); C.stroke();
                C.beginPath(); C.moveTo(cx2+6,y+h*0.30+walkBob); C.lineTo(cx2+4,y+h*0.44+walkBob); C.stroke();
            }

            // Cristales incrustados en el cuerpo
            const crystals = [
                {px:cx2-6, py:y+h*0.28+walkBob, ang:-0.38, len:10},
                {px:cx2+6, py:y+h*0.35+walkBob, ang:0.32,  len:8},
                {px:cx2-2, py:y+h*0.52+walkBob, ang:-0.55, len:7},
                {px:cx2+8, py:y+h*0.23+walkBob, ang:0.50,  len:9},
            ];
            crystals.forEach(({px,py,ang,len}) => {
                const _g = 0.82 + Math.sin(T*0.09+px*0.05)*0.18;
                C.save(); C.translate(px,py); C.rotate(ang);
                C.fillStyle = xtalCol; C.globalAlpha = _g;
                C.beginPath(); C.moveTo(-2.5,0); C.lineTo(0,-len); C.lineTo(2.5,0); C.closePath(); C.fill();
                C.globalAlpha = _g * 0.3;
                C.fillStyle = H?'rgba(255,120,100,1)':'rgba(120,220,255,1)';
                C.beginPath(); C.ellipse(0, -len*0.5, 5, len*0.55, 0, 0, Math.PI*2); C.fill();
                C.globalAlpha = 1; C.restore();
            });

            // Brazos
            C.fillStyle=stoneDk;
            if (!FR) { C.save(); C.translate(cx2,cy2+walkBob); C.scale(-1,1); C.translate(-cx2,-(cy2+walkBob)); }
            const armSwing = moving ? Math.sin(T*0.18)*0.22 : 0;
            C.save(); C.translate(x-2,y+h*0.26+walkBob); C.rotate(-0.25+armSwing); C.fillRect(0,0,8,h*0.38); C.restore();
            C.save(); C.translate(x+w-6,y+h*0.26+walkBob); C.rotate(0.25-armSwing); C.fillRect(0,0,8,h*0.38); C.restore();
            if (!FR) C.restore();

            // Cabeza (bloque de piedra)
            const headG = C.createLinearGradient(cx2-w*0.3,y+h*0.02+walkBob, cx2+w*0.3,y+h*0.18+walkBob);
            headG.addColorStop(0,H?'#ff9977':'#505068'); headG.addColorStop(1,H?'#cc3300':'#303040');
            C.fillStyle=headG; C.beginPath(); C.roundRect(cx2-w*0.3,y+h*0.02+walkBob,w*0.6,h*0.18,4); C.fill();

            // Ojos cristalinos
            const eyeGlow = 0.78 + Math.sin(T*0.11)*0.22;
            C.globalAlpha=eyeGlow; C.fillStyle=H?'rgba(255,80,0,1)':'rgba(60,210,255,1)';
            C.beginPath(); C.arc(cx2-6,y+h*0.10+walkBob,3.8,0,Math.PI*2); C.fill();
            C.beginPath(); C.arc(cx2+6,y+h*0.10+walkBob,3.8,0,Math.PI*2); C.fill();
            C.globalAlpha=eyeGlow*0.35; C.fillStyle=H?'rgba(255,40,0,1)':'rgba(40,200,255,1)';
            C.beginPath(); C.arc(cx2-6,y+h*0.10+walkBob,8,0,Math.PI*2); C.fill();
            C.beginPath(); C.arc(cx2+6,y+h*0.10+walkBob,8,0,Math.PI*2); C.fill();
            C.globalAlpha=1;

            // HP bar
            const _ghf=ent.hp/ent.maxHp; C.fillStyle='rgba(0,0,0,0.75)'; C.fillRect(x-1,y-15,w+2,7);
            C.fillStyle=_ghf>0.5?'#44aaff':'#ff4444'; C.fillRect(x,y-14,w*_ghf,5);
            C.strokeStyle=H?'#ff6644':'#88ccff'; C.lineWidth=1.2; C.strokeRect(x-0.5,y-14.5,w+1,6);
            C.font='bold 11px "VT323"'; C.fillStyle='#aaccff'; C.textAlign='center';
            C.fillText(ent.name+' Nv.'+ent.level, cx2, y-17); C.textAlign='left';

        } else if (ent.type === 'brood_mother') {
            // ── MADRE ARAÑA (JEFE ÉPICO) — araña masiva con corona y aura ──
            const x=ent.x, y=ent.y, w=ent.width, h=ent.height;
            const cx2=x+w/2, cy2=y+h*0.55;
            const enraged = (ent.enragedFrames||0) > 0 || ent.bossEnrage;
            const phase3  = ent.bossPhase === 3;
            const legAnim = Math.sin(T * (enraged ? 0.38 : 0.22)) * (enraged ? 1.3 : 0.9);
            const invul   = (ent.bmInvulFrames||0) > 0;

            // Colores por fase
            const bodyCol  = invul ? '#ffffff' : (phase3 ? '#1a0010' : (enraged ? '#1a0005' : '#0d000a'));
            const bodyCol2 = invul ? '#cccccc' : (phase3 ? '#660044' : (enraged ? '#880020' : '#440022'));
            const eyeCol   = invul ? '#ffffff' : (phase3 ? '#ff3300' : (enraged ? '#ff5500' : '#ff0088'));

            // Aura pulsante (fase 2+)
            if (enraged || phase3) {
                const _aAlpha = 0.07 + Math.sin(T*0.10)*0.05;
                C.globalAlpha = _aAlpha * 2.5;
                const _aGrad = C.createRadialGradient(cx2,cy2,0,cx2,cy2,w*1.6);
                _aGrad.addColorStop(0, phase3?'rgba(255,40,0,1)':'rgba(220,0,120,1)');
                _aGrad.addColorStop(1,'rgba(0,0,0,0)');
                C.fillStyle=_aGrad; C.beginPath(); C.arc(cx2,cy2,w*1.6,0,Math.PI*2); C.fill();
                C.globalAlpha=1;
            }

            // Sombra enorme
            C.globalAlpha=0.28; C.fillStyle='#000';
            C.beginPath(); C.ellipse(cx2,y+h+2,w*0.54,3.5,0,0,Math.PI*2); C.fill(); C.globalAlpha=1;

            // Telarañas colgantes decorativas (no interactivas)
            C.strokeStyle=`rgba(200,180,220,0.22)`; C.lineWidth=1;
            for (let _ws=0;_ws<4;_ws++) {
                const _wx=x+(_ws+0.5)*w/4, _wl=12+Math.sin(_ws*2.7+T*0.04)*6;
                C.beginPath(); C.moveTo(_wx,y-4); C.lineTo(_wx,y-4-_wl); C.stroke();
            }

            // 10 patas (5 por lado)
            C.lineWidth = 3;
            for (let side=-1; side<=1; side+=2) {
                for (let i=0; i<5; i++) {
                    const lp   = legAnim*(i%2===0?1:-1)*side;
                    const bX   = cx2+side*w*0.18+(i-2)*side*w*0.04;
                    const bY   = cy2+(i-2)*h*0.12;
                    const mX   = cx2+side*(w*0.75+i*3);
                    const mY   = cy2-h*0.25+lp*10;
                    const tX   = cx2+side*(w*1.25+i*4);
                    const tY   = y+h+lp*5;
                    C.strokeStyle = H?'#ff8866':(invul?'#ffffff':(enraged?'#550011':'#220008'));
                    C.beginPath(); C.moveTo(bX,bY); C.quadraticCurveTo(mX,mY,tX,tY); C.stroke();
                    // Articulaciones visibles
                    C.fillStyle = H?'#ffaa88':(phase3?'#441122':'#330011');
                    C.beginPath(); C.arc(mX,mY,2.5,0,Math.PI*2); C.fill();
                }
            }

            // Abdomen (grande, con patrón de calavera)
            const abdG = C.createRadialGradient(cx2-4,cy2+5,2,cx2,cy2+5,w*0.52);
            abdG.addColorStop(0,bodyCol2); abdG.addColorStop(1,bodyCol);
            C.fillStyle=abdG; C.beginPath(); C.ellipse(cx2,cy2+h*0.14,w*0.50,h*0.46,0,0,Math.PI*2); C.fill();
            // Patrón en abdomen
            if (!H && !invul) {
                // Hourglass / skull pattern
                C.fillStyle = phase3?'rgba(255,60,0,0.65)':(enraged?'rgba(255,80,20,0.55)':'rgba(180,0,100,0.5)');
                C.beginPath(); C.ellipse(cx2,cy2+h*0.14,w*0.24,h*0.20,0,0,Math.PI*2); C.fill();
                C.fillStyle='rgba(0,0,0,0.75)';
                for (let _oe=0;_oe<3;_oe++) {
                    C.beginPath(); C.arc(cx2-5+_oe*5,cy2+h*0.1,2,0,Math.PI*2); C.fill();
                }
                // Colmillos en abdomen
                C.fillStyle=phase3?'rgba(255,80,0,0.5)':'rgba(200,0,80,0.4)';
                C.beginPath(); C.moveTo(cx2-8,cy2+h*0.22); C.lineTo(cx2-4,cy2+h*0.34); C.lineTo(cx2,cy2+h*0.22); C.fill();
                C.beginPath(); C.moveTo(cx2+2,cy2+h*0.22); C.lineTo(cx2+6,cy2+h*0.34); C.lineTo(cx2+10,cy2+h*0.22); C.fill();
            }

            // Cefalotórax
            const cefG = C.createRadialGradient(cx2,cy2-h*0.12,0,cx2,cy2-h*0.12,w*0.36);
            cefG.addColorStop(0,bodyCol2); cefG.addColorStop(1,bodyCol);
            C.fillStyle=cefG; C.beginPath(); C.ellipse(cx2,cy2-h*0.12,w*0.32,h*0.32,0,0,Math.PI*2); C.fill();

            // Corona espinosa (3 púas)
            const crownCol = phase3?'#ff4400':(enraged?'#cc0066':'#880044');
            C.fillStyle = crownCol;
            for (let _p=-1;_p<=1;_p++) {
                const _px=cx2+_p*10, _py=cy2-h*0.38;
                const _plen = 12+Math.abs(_p)*4;
                C.beginPath(); C.moveTo(_px-4,_py); C.lineTo(_px,_py-_plen); C.lineTo(_px+4,_py); C.closePath(); C.fill();
                // Glow en las púas
                C.globalAlpha=0.4; C.fillStyle=phase3?'#ff8800':'#ff0088';
                C.beginPath(); C.arc(_px,_py-_plen+2,3.5,0,Math.PI*2); C.fill(); C.globalAlpha=1;
            }

            // 6 ojos
            const eyeRow = cy2-h*0.18;
            for (let _e=0;_e<6;_e++) {
                const _ex = cx2+(_e-2.5)*5.5;
                const eyePulse = 0.75+Math.sin(T*0.12+_e*1.2)*0.25;
                C.globalAlpha=eyePulse; C.fillStyle=eyeCol;
                C.beginPath(); C.arc(_ex,eyeRow,3.2,0,Math.PI*2); C.fill();
                C.globalAlpha=eyePulse*0.4; C.fillStyle=eyeCol;
                C.beginPath(); C.arc(_ex,eyeRow,7,0,Math.PI*2); C.fill();
                C.globalAlpha=1;
                C.fillStyle='rgba(255,255,255,0.7)';
                C.beginPath(); C.arc(_ex+0.8,eyeRow-1.2,1.0,0,Math.PI*2); C.fill();
            }

            // Colmillos
            C.fillStyle = H?'#ffaaaa':'#ccccdd';
            C.beginPath(); C.moveTo(cx2-8,eyeRow+12); C.lineTo(cx2-5,eyeRow+22); C.lineTo(cx2-2,eyeRow+13); C.closePath(); C.fill();
            C.beginPath(); C.moveTo(cx2+2,eyeRow+12); C.lineTo(cx2+5,eyeRow+22); C.lineTo(cx2+8,eyeRow+13); C.closePath(); C.fill();

            // Barra HP de jefe
            const _bmW2=Math.max(80,w*1.6); const _bmX=cx2-_bmW2/2;
            const _bmHF=Math.max(0,ent.hp/ent.maxHp);
            const _bmHC = invul?'#ffffff':(phase3?'#ff4400':(enraged?'#ff0055':'#cc0088'));
            C.fillStyle='rgba(0,0,0,0.82)'; C.fillRect(_bmX-2,y-30,_bmW2+4,12);
            C.fillStyle=_bmHC; C.fillRect(_bmX,y-29,_bmW2*_bmHF,10);
            // Segmentos en la barra HP
            C.strokeStyle='rgba(0,0,0,0.4)'; C.lineWidth=1;
            for(let _seg=1;_seg<4;_seg++){C.beginPath();C.moveTo(_bmX+_bmW2*(_seg/4),y-29);C.lineTo(_bmX+_bmW2*(_seg/4),y-19);C.stroke();}
            C.strokeStyle=_bmHC; C.lineWidth=1.5; C.strokeRect(_bmX-1,y-29.5,_bmW2+2,11);
            // Nombre y fase
            C.font='bold 13px "VT323"'; C.fillStyle=invul?'#ffffff':_bmHC;
            C.textAlign='center';
            const _phTxt = phase3?'  [☠ FASE 3]':(enraged?'  [FRENÉTICA]':'');
            C.fillText(ent.name+' Nv.'+ent.level+_phTxt, cx2, y-33); C.textAlign='left';

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
        } else if (ent.type === 'wolf') {
            const x=ent.x, y=ent.y, w=ent.width, h=ent.height;
            const isLeaping = ent.wolfState === 'leaping'; const isCharging = ent.wolfState === 'charge' && (ent.wolfStateTimer || 0) === 0;
            const moving = Math.abs(ent.vx) > 0.3 || isLeaping; const walkFreq = isCharging ? 0.52 : isLeaping ? 0 : 0.32;
            const walk = moving && !isLeaping ? Math.sin(T * walkFreq) : 0; const bob = moving && !isLeaping ? Math.abs(Math.sin(T * walkFreq)) * 1.5 : 0;
            const fR = ent.wolfChargeDir !== undefined ? ent.wolfChargeDir > 0 : ent.vx >= 0; const bodyTilt = isLeaping ? -0.45 : (isCharging ? -0.18 : 0);
            C.save(); if (!fR) { C.translate(x + w, 0); C.scale(-1, 1); } const bx = fR ? x : 0;
            const shadowAlpha = isLeaping ? Math.max(0.05, 0.18 - (Math.abs(ent.vy) * 0.01)) : 0.2; C.globalAlpha = shadowAlpha; C.fillStyle = '#000'; C.beginPath(); C.ellipse(bx + w/2, y + h + 2, w * 0.52, 2.8, 0, 0, Math.PI * 2); C.fill(); C.globalAlpha = 1;
            const furMain = H ? '#ff8866' : (ER ? '#cc2200' : '#6b5a4a'); const furDark = H ? '#cc5533' : (ER ? '#881100' : '#3d3028'); const furLight = H ? '#ffbbaa' : '#9c8a78';
            const pivotX = bx + w * 0.5; const pivotY = y + h * 0.6; C.save(); C.translate(pivotX, pivotY); C.rotate(bodyTilt); C.translate(-pivotX, -pivotY);
            const tailAng = isLeaping ? 0.6 : (moving ? Math.sin(T * 0.25) * 0.4 : 0.3); C.save(); C.translate(bx + 3, y + h * 0.35); C.rotate(tailAng - 0.3); C.fillStyle = furMain; C.beginPath(); C.moveTo(0, 0); C.quadraticCurveTo(-9, -7, -14, -3); C.quadraticCurveTo(-9, 3, 0, 2); C.closePath(); C.fill(); C.fillStyle = '#ddd8d0'; C.beginPath(); C.ellipse(-13, -2, 3.5, 2.5, -0.4, 0, Math.PI * 2); C.fill(); C.restore();
            for (let p = 0; p < 4; p++) { const isBack = p < 2; const basePx = isBack ? (bx + 3 + p * 7) : (bx + w * 0.45 + (p-2) * 7); let pang; if (isLeaping) { pang = isBack ? 0.5 : -0.5; } else { const phase = p % 2 === 0 ? walk * 0.65 : -walk * 0.65; pang = phase; } const legLen = h * 0.45; C.save(); C.translate(basePx, y + h * 0.72); C.rotate(pang); C.fillStyle = isBack ? furDark : furMain; C.fillRect(-2.5, 0, 5, legLen * 0.55); C.translate(0, legLen * 0.55); C.rotate(-pang * 0.4); C.fillRect(-2, 0, 4.5, legLen * 0.45); C.fillStyle = furDark; C.fillRect(-3, legLen * 0.43, 6, 2.5); C.restore(); }
            C.fillStyle = furMain; C.beginPath(); C.ellipse(bx + w * 0.48, y + h * 0.56 + bob, w * 0.46, h * 0.37, -0.1, 0, Math.PI * 2); C.fill();
            C.fillStyle = furDark; C.beginPath(); C.ellipse(bx + w * 0.44, y + h * 0.43 + bob, w * 0.36, h * 0.17, -0.2, 0, Math.PI * 2); C.fill();
            C.fillStyle = furLight; C.beginPath(); C.ellipse(bx + w * 0.5, y + h * 0.68 + bob, w * 0.3, h * 0.14, 0, 0, Math.PI * 2); C.fill();
            C.fillStyle = furMain; C.beginPath(); const neckTilt = isLeaping ? -0.25 : 0; C.moveTo(bx + w * 0.58, y + h * 0.36 + bob); C.lineTo(bx + w * 0.78, y + h * 0.18 + neckTilt * h); C.lineTo(bx + w * 0.95, y + h * 0.25 + neckTilt * h); C.lineTo(bx + w * 0.76, y + h * 0.46 + bob); C.closePath(); C.fill();
            C.save(); C.translate(bx + w * 0.83, y + h * 0.2); C.rotate(isLeaping ? 0.25 : 0);
            C.fillStyle = furMain; C.beginPath(); C.ellipse(0, 0, w * 0.26, h * 0.23, 0.1, 0, Math.PI * 2); C.fill();
            C.fillStyle = furLight; C.beginPath(); C.ellipse(w * 0.14, h * 0.06, w * 0.13, h * 0.11, 0.15, 0, Math.PI * 2); C.fill();
            if (isLeaping || isCharging) { C.strokeStyle = furDark; C.lineWidth = 1; C.beginPath(); C.moveTo(w * 0.06, h * 0.1); C.lineTo(w * 0.22, h * 0.16); C.stroke(); C.fillStyle = '#f0ede0'; C.fillRect(w * 0.09, h * 0.1, 3, 4); C.fillRect(w * 0.15, h * 0.12, 3, 3); }
            C.fillStyle = '#1a0f0a'; C.beginPath(); C.ellipse(w * 0.25, h * 0.04, 2.5, 1.8, 0, 0, Math.PI * 2); C.fill();
            const eyeColor = (isLeaping || isCharging) ? '#ff4400' : (ER ? '#ff3300' : '#f0c020'); C.fillStyle = eyeColor; C.beginPath(); C.ellipse(-w * 0.02, -h * 0.05, 2.8, 2.2, 0, 0, Math.PI * 2); C.fill(); C.fillStyle = '#0a0505'; C.beginPath(); C.ellipse(-w * 0.01, -h * 0.05, 1.4, 1.6, 0, 0, Math.PI * 2); C.fill(); C.fillStyle = 'rgba(255,255,255,0.7)'; C.beginPath(); C.ellipse(-w * 0.03, -h * 0.07, 0.8, 0.8, 0, 0, Math.PI * 2); C.fill();
            C.fillStyle = furDark; C.beginPath(); C.moveTo(-w * 0.12, -h * 0.1); C.lineTo(-w * 0.18, -h * 0.28); C.lineTo(-w * 0.03, -h * 0.12); C.closePath(); C.fill(); C.beginPath(); C.moveTo(w * 0.04, -h * 0.12); C.lineTo(w * 0.01, -h * 0.3); C.lineTo(w * 0.14, -h * 0.11); C.closePath(); C.fill();
            C.restore(); C.restore(); C.restore();
        }

        // Barra de HP y nombre sobre cada entidad
        {
            const isHostile = ent.type !== 'chicken'; const timeSinceHit = Date.now() - (ent.lastHitTime || 0); const pct = Math.max(0, ent.hp / ent.maxHp);
            const showBar = isHostile || (ent.hp < ent.maxHp && timeSinceHit < 3000);
            if (showBar) {
                let barAlpha = 1.0; if (pct >= 1 && timeSinceHit > 1500) barAlpha = Math.max(0, 1 - (timeSinceHit - 1500) / 1500); if (barAlpha <= 0) { } else {
                C.save(); C.globalAlpha = barAlpha;
                const barW = Math.min(Math.max(ent.width + 8, 24), 50); const barH = 5; const barX = ent.x + (ent.width - barW) / 2; const barY = ent.y - 13; const r4 = 2;
                C.fillStyle = 'rgba(0,0,0,0.72)'; C.beginPath(); C.roundRect(barX - 1, barY - 1, barW + 2, barH + 2, r4 + 1); C.fill();
                C.fillStyle = 'rgba(255,255,255,0.08)'; C.beginPath(); C.roundRect(barX, barY, barW, barH, r4); C.fill();
                const hc = pct > 0.6 ? '#2ecc71' : pct > 0.3 ? '#f39c12' : '#e74c3c'; const fillW = Math.max(0, barW * pct);
                if (fillW > 0) { C.fillStyle = hc; C.beginPath(); const rightR = fillW >= barW - 1 ? r4 : 1; C.roundRect(barX, barY, fillW, barH, [r4, rightR, rightR, r4]); C.fill(); C.fillStyle = 'rgba(255,255,255,0.2)'; C.fillRect(barX + 1, barY + 1, Math.max(0, fillW - 2), 1); }
                if (timeSinceHit < 120) { C.fillStyle = `rgba(255,255,255,${0.5 * (1 - timeSinceHit / 120)})`; C.beginPath(); C.roundRect(barX, barY, barW, barH, r4); C.fill(); }
                if (isHostile && (pct < 1 || timeSinceHit < 2000)) { C.font = 'bold 13px "VT323"'; C.fillStyle = 'rgba(255,255,255,0.9)'; C.textAlign = 'center'; C.shadowColor = 'rgba(0,0,0,0.9)'; C.shadowBlur = 3; C.fillText(ent.name || ent.type, barX + barW / 2, barY - 2); C.shadowBlur = 0; }
                C.restore();
                }
            }
        }

        // ── Signo de interrogación: mob perdió de vista al jugador ─────────
        if ((ent._lostTimer || 0) > 0 && ent.type !== 'chicken') {
            const _qFade  = Math.min(1, ent._lostTimer / 20);      // fade-in y fade-out en 20 frames
            const _qBob   = Math.sin(window.game.frameCount * 0.18) * 2.5;
            const _qCX    = ent.x + ent.width  / 2;
            const _qCY    = ent.y - 28 + _qBob;
            C.save();
            C.globalAlpha = _qFade * 0.92;
            // Globo amarillo
            C.fillStyle = '#f5d020'; C.strokeStyle = '#b8960a'; C.lineWidth = 1.5;
            C.beginPath(); C.arc(_qCX, _qCY, 11, 0, Math.PI * 2); C.fill(); C.stroke();
            // Colita del globo apuntando al mob
            C.fillStyle = '#f5d020';
            C.beginPath(); C.moveTo(_qCX - 4, _qCY + 8); C.lineTo(_qCX + 4, _qCY + 8); C.lineTo(_qCX, _qCY + 16); C.closePath(); C.fill();
            C.strokeStyle = '#b8960a'; C.lineWidth = 1.2;
            C.beginPath(); C.moveTo(_qCX - 4, _qCY + 8); C.lineTo(_qCX, _qCY + 16); C.lineTo(_qCX + 4, _qCY + 8); C.stroke();
            // Signo ?
            C.globalAlpha = _qFade;
            C.font = 'bold 13px sans-serif'; C.fillStyle = '#5a3e00';
            C.textAlign = 'center'; C.textBaseline = 'middle';
            C.fillText('?', _qCX, _qCY + 1);
            C.restore();
        }
        // ── Hover glow: iluminación sutil cuando el mouse está sobre la entidad ──
        if (window.hoveredEntity === ent) {
            const _hPulse = 0.10 + Math.sin(window.game.frameCount * 0.18) * 0.04;
            C.globalCompositeOperation = 'screen';
            C.globalAlpha = _hPulse;
            C.fillStyle = '#ffffff';
            C.beginPath();
            C.ellipse(ent.x + ent.width/2, ent.y + ent.height/2,
                      ent.width * 0.62, ent.height * 0.55, 0, 0, Math.PI * 2);
            C.fill();
            C.globalCompositeOperation = 'source-over';
            C.globalAlpha = 1;
        }
        C.restore();
        // Restaurar posición real post-render
        ent.x = _eOrigX; ent.y = _eOrigY;
    });

    // === MODO COLOCACIÓN: ghost del objeto a colocar ===
    if (window.player.placementMode && !window.player.isDead) {
        let offsetY = window.game.groundLevel % window.game.blockSize;
        const gridX = Math.floor(window.mouseWorldX / window.game.blockSize) * window.game.blockSize;
        const gridY = Math.floor((window.mouseWorldY - offsetY) / window.game.blockSize) * window.game.blockSize + offsetY;
        const bs2 = window.game.blockSize;
        let valid;
        if (window.player.placementMode === 'ladder_item') {
            const lGY2 = window.getGroundY ? window.getGroundY(gridX + bs2/2) : window.game.groundLevel; const alreadyHere2 = window.blocks.some(b => b.type === 'ladder' && Math.abs(b.x - gridX) < 1 && Math.abs(b.y - gridY) < 1);
            valid = !alreadyHere2 && (Math.abs((gridY + bs2) - lGY2) <= 2 || window.blocks.some(b => b.type === 'ladder' && Math.abs(b.x - gridX) < 1 && Math.abs(b.y - (gridY + bs2)) < 2) || window.blocks.some(b => b.type === 'block' && Math.abs(b.x - gridX) < 1 && Math.abs(b.y - (gridY + bs2)) < 2));
        } else { valid = window.isValidPlacement(gridX, gridY, bs2, bs2, true, false); }
        let validColor = valid ? '#00FF00' : '#FF0000'; let validFill = valid ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.3)';
        window.ctx.globalAlpha = 0.6;
        if (window.player.placementMode === 'boxes') { window.ctx.fillStyle = '#8B4513'; window.ctx.fillRect(gridX + 2, gridY + 10, window.game.blockSize - 4, window.game.blockSize - 10); }
        else if (window.player.placementMode === 'campfire_item') { window.ctx.fillStyle = '#5c4033'; window.ctx.fillRect(gridX + 2, gridY + 20, 26, 10); }
        else if (window.player.placementMode === 'bed_item') { window.ctx.fillStyle = '#8B4513'; window.ctx.fillRect(gridX, gridY + 20, 30, 10); window.ctx.fillStyle = '#e0e0e0'; window.ctx.fillRect(gridX + 2, gridY + 16, 10, 4); window.ctx.fillStyle = '#c0392b'; window.ctx.fillRect(gridX + 12, gridY + 16, 18, 4); }
        else if (window.player.placementMode === 'barricade_item') { window.ctx.fillStyle = '#5D4037'; window.ctx.fillRect(gridX + 2, gridY + 24, 26, 6); window.ctx.fillStyle = '#bdc3c7'; window.ctx.beginPath(); window.ctx.moveTo(gridX + 5, gridY + 24); window.ctx.lineTo(gridX + 2, gridY + 5); window.ctx.lineTo(gridX + 10, gridY + 24); window.ctx.fill(); }
        else if (window.player.placementMode === 'ladder_item') {
            window.ctx.fillStyle = '#8B6230'; window.ctx.fillRect(gridX + 5, gridY, 5, 30); window.ctx.fillRect(gridX + 20, gridY, 5, 30); window.ctx.fillStyle = '#c8a86a';
            for (let r = 0; r < 3; r++) window.ctx.fillRect(gridX + 5, gridY + 4 + r * 9, 20, 3);
        }
        window.ctx.strokeStyle = validColor; window.ctx.lineWidth = 2; window.ctx.strokeRect(gridX, gridY, window.game.blockSize, window.game.blockSize);
        window.ctx.fillStyle = validFill; window.ctx.fillRect(gridX, gridY, window.game.blockSize, window.game.blockSize); window.ctx.globalAlpha = 1.0;
    }

    // === MODO MARTILLO: ghost del bloque/puerta/escalón ===
    if (window.player.activeTool === 'hammer' && !window.player.isDead && !window.player.placementMode) {
        let offsetY = window.game.groundLevel % window.game.blockSize;
        const gridX = Math.floor(window.mouseWorldX / window.game.blockSize) * window.game.blockSize;
        const gridY = Math.floor((window.mouseWorldY - offsetY) / window.game.blockSize) * window.game.blockSize + offsetY;
        const isDoor = window.player.buildMode === 'door'; const isStair = window.player.buildMode === 'stair'; const itemHeight = isDoor ? window.game.blockSize * 2 : window.game.blockSize; const bs = window.game.blockSize;
        let valid = window.isValidPlacement(gridX, gridY, bs, itemHeight, true, true); let validColor = valid ? '#00FF00' : '#FF0000'; let validFill = valid ? 'rgba(0,255,0,0.2)' : 'rgba(255,0,0,0.3)';
        window.ctx.save(); window.ctx.globalAlpha = 0.6; window.ctx.strokeStyle = validColor; window.ctx.lineWidth = 2; window.ctx.setLineDash([4, 2]);
        if (isStair) {
            const fr = !window.player.stairMirror; window.ctx.beginPath();
            if (fr) { window.ctx.moveTo(gridX, gridY + bs); window.ctx.lineTo(gridX + bs, gridY + bs); window.ctx.lineTo(gridX + bs, gridY); }
            else { window.ctx.moveTo(gridX, gridY + bs); window.ctx.lineTo(gridX + bs, gridY + bs); window.ctx.lineTo(gridX, gridY); }
            window.ctx.closePath(); window.ctx.fillStyle = validFill; window.ctx.fill(); window.ctx.stroke();
        } else { window.ctx.strokeRect(gridX, gridY, bs, itemHeight); window.ctx.fillStyle = validFill; window.ctx.fillRect(gridX, gridY, bs, itemHeight); }
        window.ctx.setLineDash([]); window.ctx.globalAlpha = 1.0; window.ctx.restore();
    }

    // === GUÍA DE TRAYECTORIA: arco ===
    if (window.player.activeTool === 'bow' && window.player.isAiming && window.player.isCharging && window.player.inventory.arrows > 0 && !window.player.isDead) {
        const pCX = window.player.x + window.player.width / 2; const pCY = window.player.y + 6;
        const dx = window.mouseWorldX - pCX; const dy = window.mouseWorldY - pCY; const angle = Math.atan2(dy, dx);
        const power = 4 + (window.player.chargeLevel / 100) * 6; const grav = window.game.gravity * 0.25; const bs = window.game.blockSize;
        let simX = pCX, simY = pCY; let simVx = Math.cos(angle) * power; let simVy = Math.sin(angle) * power;
        const pts = []; let hitX = null, hitY = null;
        for (let i = 0; i < 240; i++) {
            simX += simVx; simVy += grav; simY += simVy;
            let blockedByBlock = false;
            for (const b of window.blocks) { if (b.type === 'ladder' || (b.type === 'door' && b.open) || b.type === 'stair') continue; const bh = b.type === 'door' ? bs * 2 : bs; if (simX >= b.x && simX <= b.x + bs && simY >= b.y && simY <= b.y + bh) { blockedByBlock = true; break; } }
            const gY = window.getGroundY ? window.getGroundY(simX) : window.game.groundLevel;
            if (simY >= gY || blockedByBlock) { hitX = simX; hitY = blockedByBlock ? simY : gY; break; }
            if (i % 2 === 0) pts.push({ x: simX, y: simY, t: i / 120 });
        }
        if (!hitX && pts.length) { hitX = pts[pts.length-1].x; hitY = pts[pts.length-1].y; }
        window.ctx.save(); window.ctx.lineWidth = 1.5; window.ctx.setLineDash([5, 6]);
        window.ctx.beginPath(); window.ctx.moveTo(pCX, pCY); for (const p of pts) window.ctx.lineTo(p.x, p.y); if (hitX !== null) window.ctx.lineTo(hitX, hitY);
        const grad = window.ctx.createLinearGradient(pCX, pCY, hitX || simX, hitY || simY); grad.addColorStop(0, 'rgba(255,220,100,0.90)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.50)'); grad.addColorStop(1, 'rgba(255,255,255,0.05)');
        window.ctx.strokeStyle = grad; window.ctx.stroke(); window.ctx.setLineDash([]);
        if (hitX !== null) { window.ctx.beginPath(); window.ctx.arc(hitX, hitY, 4, 0, Math.PI * 2); window.ctx.fillStyle = 'rgba(255,200,80,0.65)'; window.ctx.fill(); window.ctx.strokeStyle = 'rgba(255,255,255,0.55)'; window.ctx.lineWidth = 1; window.ctx.stroke(); }
        window.ctx.restore();
    }

    // === GUÍA DE TRAYECTORIA: molotov (puntos naranja + círculo de área) ===
    if (window.player.activeTool === 'molotov' && window.player.isAiming && window.player.isCharging && (window.player.inventory.molotov || 0) > 0 && !window.player.isDead) {
        const pCX = window.player.x + window.player.width / 2; const pCY = window.player.y + 8;
        const dx = window.mouseWorldX - pCX; const dy = window.mouseWorldY - pCY; const angle = Math.atan2(dy, dx);
        const power = 5.0 + (window.player.chargeLevel / 100) * 9.0; const grav = (window.game.gravity || 0.32) * 0.9;
        let simVx = Math.cos(angle) * power; let simVy = Math.sin(angle) * power; let simX = pCX; let simY = pCY;
        const dotPositions = [];
        for (let i = 0; i < 300; i++) {
            simX += simVx; simVy += grav; simY += simVy;
            if (i % 4 === 0) dotPositions.push({ x: simX, y: simY, t: i / 300 });
            const groundY = window.getGroundY ? window.getGroundY(simX) : window.game.groundLevel; if (simY >= groundY) { simX = simX; simY = groundY; break; }
            let hitB = false; for (const b of window.blocks) { const bh = b.type === 'door' ? window.game.blockSize * 2 : window.game.blockSize; if (!b.open && window.checkRectIntersection(simX - 4, simY - 4, 8, 8, b.x, b.y, window.game.blockSize, bh)) { hitB = true; break; } } if (hitB) break;
        }
        const C = window.ctx; C.save();
        for (let di = 0; di < dotPositions.length; di++) { const dot = dotPositions[di]; const prog = di / dotPositions.length; const r = 3.5 - prog * 2.5; const a = (1 - prog * 0.75) * 0.85; const hue = prog < 0.5 ? `rgba(255,${Math.floor(140 + prog * 80)},0,${a})` : `rgba(255,${Math.floor(220 - (prog-0.5)*160)},0,${a})`; C.fillStyle = hue; C.beginPath(); C.arc(dot.x, dot.y, Math.max(0.8, r), 0, Math.PI * 2); C.fill(); }
        const intBonus = (window.player.stats?.int || 0) * 0.08; const fireR = window.game.blockSize * (2.2 + intBonus) * 0.6;
        C.globalAlpha = 0.18; C.fillStyle = '#ff5500'; C.beginPath(); C.arc(simX, simY, fireR, 0, Math.PI * 2); C.fill();
        C.globalAlpha = 0.60; C.strokeStyle = 'rgba(255,120,0,0.85)'; C.lineWidth = 1.8; C.setLineDash([4, 4]); C.beginPath(); C.arc(simX, simY, fireR, 0, Math.PI * 2); C.stroke(); C.setLineDash([]);
        C.globalAlpha = 0.9; C.fillStyle = '#ff8800'; C.beginPath(); C.arc(simX, simY, 5, 0, Math.PI * 2); C.fill(); C.fillStyle = '#fff8aa'; C.beginPath(); C.arc(simX, simY, 2.5, 0, Math.PI * 2); C.fill();
        C.restore();
    }

    // Proyectiles (flechas, molotov, flechas enemigas)
    window.projectiles.forEach(pr => {
        if (pr.x + 20 > _visLeft && pr.x - 20 < _visRight + 60) {
            window.ctx.save(); window.ctx.translate(pr.x, pr.y); window.ctx.rotate(pr.angle);
            if (pr.isMolotov) {
                const C = window.ctx; C.fillStyle = '#3a7a2a'; C.beginPath(); C.roundRect(-5, -4, 10, 14, 2); C.fill(); C.fillStyle = '#5ab840'; C.fillRect(-3, -4, 4, 3); C.fillStyle = '#8B4513'; C.fillRect(-2, -9, 4, 6);
                C.fillStyle = '#ff8800'; C.beginPath(); C.ellipse(0, -11, 3, 5, 0, 0, Math.PI * 2); C.fill(); C.fillStyle = '#ffee00'; C.beginPath(); C.ellipse(0, -12, 1.5, 3, 0, 0, Math.PI * 2); C.fill();
            } else if (pr.isEnemy) { window.ctx.fillStyle = '#ff4444'; window.ctx.fillRect(-15, -1, 20, 2); window.ctx.fillStyle = '#000'; window.ctx.fillRect(5, -2, 4, 4); }
            else { window.ctx.fillStyle = '#eee'; window.ctx.fillRect(-15, -1, 20, 2); window.ctx.fillStyle = '#666'; window.ctx.fillRect(5, -2, 4, 4); window.ctx.fillStyle = '#fff'; window.ctx.fillRect(-17, -2, 4, 4); }
            window.ctx.restore();
        }
    });

    // Marcas de quemado (scorch marks) con degradé radial y cenizas (Q≠low)
    if (Q !== 'low' && window.scorchMarks && window.scorchMarks.length > 0) {
        const C = window.ctx; const now2 = Date.now();
        for (let si = window.scorchMarks.length - 1; si >= 0; si--) {
            const sm = window.scorchMarks[si]; if (!sm.born) sm.born = Date.now(); if (!sm.lifetime) sm.lifetime = 120000 + Math.random() * 60000;
            const age = now2 - sm.born; const frac = Math.max(0, 1 - age / sm.lifetime); if (frac <= 0) { window.scorchMarks.splice(si, 1); continue; }
            if (sm.x + sm.w < _visLeft || sm.x > _visRight + 80) continue;
            const sr3 = (n) => { let v = ((sm.seed ^ (sm.seed >> 5)) * 0x45d9f3b + n * 0x9e3779b9) >>> 0; return (v >>> 0) / 0xFFFFFFFF; };
            const cx = sm.x + sm.w / 2; const cy = sm.y + sm.h / 2; const rx = sm.w * 0.5; const ry = sm.h * 0.5;
            C.save(); const numPts = 18;
            C.beginPath();
            for (let pi = 0; pi <= numPts; pi++) { const ang = (pi / numPts) * Math.PI * 2; const jag = 0.72 + sr3(pi * 3 + 10) * 0.28; const px = cx + Math.cos(ang) * rx * jag; const py = cy + Math.sin(ang) * ry * jag; pi === 0 ? C.moveTo(px, py) : C.lineTo(px, py); }
            C.closePath();
            const grad = C.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry)); grad.addColorStop(0, `rgba(10,5,0,${0.88 * frac * sm.alpha})`); grad.addColorStop(0.45, `rgba(22,10,2,${0.80 * frac * sm.alpha})`); grad.addColorStop(0.80, `rgba(38,18,6,${0.60 * frac * sm.alpha})`); grad.addColorStop(1.0, `rgba(55,28,10,${0.0})`); C.fillStyle = grad; C.fill();
            C.globalAlpha = frac * sm.alpha * 0.55;
            for (let k = 0; k < 5; k++) { const ax = cx + (sr3(k*5) - 0.5) * rx * 1.1; const ay = cy + (sr3(k*5+1) - 0.5) * ry * 1.1; const arx = rx * (0.04 + sr3(k*5+2) * 0.14); const ary = ry * (0.03 + sr3(k*5+3) * 0.10); const aAlpha = (0.25 + sr3(k*5+4) * 0.35) * frac; C.fillStyle = `rgba(90,80,70,${aAlpha})`; C.beginPath(); C.ellipse(ax, ay, arx, ary, sr3(k) * Math.PI, 0, Math.PI * 2); C.fill(); }
            C.globalAlpha = frac * sm.alpha * 0.45; C.strokeStyle = `rgba(30,12,2,0.9)`; C.lineWidth = 1.5;
            C.beginPath(); for (let pi2 = 0; pi2 <= numPts; pi2++) { const ang2 = (pi2 / numPts) * Math.PI * 2; const jag2 = 0.72 + sr3(pi2 * 3 + 10) * 0.28; const px2 = cx + Math.cos(ang2) * rx * jag2; const py2 = cy + Math.sin(ang2) * ry * jag2; pi2 === 0 ? C.moveTo(px2, py2) : C.lineTo(px2, py2); } C.closePath(); C.stroke();
            C.restore();
        }
    }

    // Llamas de fuego (partículas con capas: outer glow, 3 capas bezier, brasas)
    if (window.fires && window.fires.length > 0) {
        const C = window.ctx; const now3 = window.game.frameCount || 0;
        for (const fire of window.fires) {
            if (fire.x + fire.w + 60 < _visLeft || fire.x - 60 > _visRight) continue;
            const lifeFrac = Math.max(0, fire.life / fire.maxLife); if (lifeFrac <= 0) continue;
            const cx = fire.x + fire.w / 2; const baseY = fire.y + fire.h;
            const flicker = 0.88 + Math.sin(fire.phase + now3 * 0.17) * 0.10 + Math.sin(fire.phase * 2.1 + now3 * 0.13) * 0.06;
            const alpha = Math.min(1, lifeFrac * 3) * fire.intensity * flicker;
            C.save();
            C.globalAlpha = alpha * 0.22; const glowR = fire.w * 1.1 * flicker; const glowG = C.createRadialGradient(cx, baseY - fire.h * 0.25, 0, cx, baseY - fire.h * 0.25, glowR); glowG.addColorStop(0, 'rgba(255,120,20,1)'); glowG.addColorStop(0.5, 'rgba(255,60,0,0.5)'); glowG.addColorStop(1, 'rgba(255,30,0,0)'); C.fillStyle = glowG; C.beginPath(); C.ellipse(cx, baseY - fire.h * 0.25, glowR, fire.h * 0.85, 0, 0, Math.PI * 2); C.fill();
            const layers = [ { color0: '#ff2200', color1: 'rgba(255,80,0,0)', scale: 1.0, alphaM: 0.85 }, { color0: '#ff7700', color1: 'rgba(255,180,0,0)', scale: 0.68, alphaM: 0.75 }, { color0: '#ffee22', color1: 'rgba(255,255,180,0)', scale: 0.38, alphaM: 0.60 } ];
            for (const layer of layers) { const lw = fire.w * layer.scale * flicker; const lh = fire.h * layer.scale * (0.85 + Math.sin(fire.phase * 1.3 + now3 * 0.15) * 0.10); const lg = C.createLinearGradient(cx, baseY, cx, baseY - lh); lg.addColorStop(0, layer.color0); lg.addColorStop(0.6, layer.color0); lg.addColorStop(1, layer.color1); C.globalAlpha = alpha * layer.alphaM; C.fillStyle = lg; const wobble = Math.sin(fire.phase * 0.8 + now3 * 0.09) * lw * 0.18; C.beginPath(); C.moveTo(cx - lw * 0.5, baseY); C.bezierCurveTo(cx - lw * 0.65 + wobble, baseY - lh * 0.35, cx - lw * 0.28 - wobble, baseY - lh * 0.75, cx + wobble * 0.5, baseY - lh); C.bezierCurveTo(cx + lw * 0.28 + wobble, baseY - lh * 0.75, cx + lw * 0.65 - wobble, baseY - lh * 0.35, cx + lw * 0.5, baseY); C.closePath(); C.fill(); }
            if (Math.random() < 0.25 * lifeFrac) { const ex = cx + (Math.random() - 0.5) * fire.w * 0.6; const ey = baseY - fire.h * (0.3 + Math.random() * 0.5); C.globalAlpha = alpha * 0.9; C.fillStyle = Math.random() > 0.4 ? '#fff8aa' : '#ff9900'; C.beginPath(); C.arc(ex, ey, 1.2 + Math.random() * 1.8, 0, Math.PI * 2); C.fill(); }
            C.restore();
        }
    }

    // Flechas clavadas en el terreno
    window.stuckArrows.forEach(sa => {
        if (sa.x + 20 > _visLeft && sa.x - 20 < _visRight + 60) {
            window.ctx.save(); window.ctx.translate(sa.x, sa.y); window.ctx.rotate(sa.angle);
            window.ctx.fillStyle = '#eee'; window.ctx.fillRect(-15, -1, 20, 2); window.ctx.fillStyle = '#666'; window.ctx.fillRect(5, -2, 4, 4); window.ctx.fillStyle = '#fff'; window.ctx.fillRect(-17, -2, 4, 4);
            window.ctx.restore();
        }
    });

    // Partículas genéricas
    window.particles.forEach(p => { window.ctx.globalAlpha = Math.max(0, Math.min(1, p.life)); window.ctx.fillStyle = p.color; window.ctx.fillRect(p.x, p.y, p.size, p.size); });

    // Polvo al correr
    if (window.dustParticles && window.dustParticles.length > 0) {
        const C = window.ctx; C.save();
        if (Q === 'high') {
            // Alta calidad: gradiente radial nebuloso
            window.dustParticles.forEach(d => {
                const alpha = d.life * d.alpha; if (alpha <= 0) return;
                const grad = C.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
                const g = d.gray;
                grad.addColorStop(0,   `rgba(${g},${g},${g},${alpha})`);
                grad.addColorStop(0.5, `rgba(${g},${g},${g},${alpha * 0.5})`);
                grad.addColorStop(1,   `rgba(${g},${g},${g},0)`);
                C.fillStyle = grad; C.beginPath(); C.arc(d.x, d.y, d.r, 0, Math.PI * 2); C.fill();
            });
        } else {
            // Calidad media/baja: elipse sólida semitransparente (5× más rápido)
            window.dustParticles.forEach(d => {
                const alpha = d.life * d.alpha * 0.55; if (alpha <= 0.02) return;
                const g = d.gray;
                C.globalAlpha = alpha;
                C.fillStyle = `rgb(${g},${g},${g})`;
                C.beginPath(); C.ellipse(d.x, d.y, d.r * 0.8, d.r * 0.5, 0, 0, Math.PI * 2); C.fill();
            });
            C.globalAlpha = 1;
        }
        C.restore();
    }

    // Textos de daño flotantes (melee, miss, o color custom)
    window.damageTexts.forEach(dt => {
        window.ctx.globalAlpha = Math.max(0, Math.min(1, dt.life)); window.ctx.textAlign = 'center';
        if (dt.color === 'melee') { window.ctx.font = 'bold 13px "Press Start 2P"'; window.ctx.strokeStyle = 'rgba(140,0,0,0.95)'; window.ctx.lineWidth = 3; window.ctx.strokeText(dt.text, dt.x, dt.y); window.ctx.fillStyle = '#ffffff'; window.ctx.fillText(dt.text, dt.x, dt.y); }
        else if (dt.color === 'miss') { window.ctx.font = 'bold 10px "Press Start 2P"'; window.ctx.strokeStyle = 'rgba(0,0,0,0.7)'; window.ctx.lineWidth = 2.5; window.ctx.strokeText(dt.text, dt.x, dt.y); window.ctx.fillStyle = '#bbbbbb'; window.ctx.fillText(dt.text, dt.x, dt.y); }
        else { window.ctx.font = 'bold 13px "Press Start 2P"'; window.ctx.fillStyle = dt.color; window.ctx.fillText(dt.text, dt.x, dt.y); }
    });
    window.ctx.textAlign = 'left'; window.ctx.globalAlpha = 1.0;
    window.ctx.restore(); // fin zoom/cámara

    // === EFECTOS POST-PROCESS (solo Q=high): neblina horizonte, bloom hogueras, color grading ===
    if (Q === 'high') {
        const _hz = window.game.zoom || 1; const _hW = window._canvasLogicW || 1280; const _hH = window._canvasLogicH || 720;
        const groundScreenY = (window.game.baseGroundLevel - window.camera.y - _hH/2) * _hz + _hH/2;
        const fogGrad = window.ctx.createLinearGradient(0, groundScreenY - 80, 0, groundScreenY + 60); const fogAlpha = 0.06 + darkness * 0.04;
        fogGrad.addColorStop(0, `rgba(180,210,240,0)`); fogGrad.addColorStop(0.4, `rgba(160,195,225,${fogAlpha})`); fogGrad.addColorStop(0.7, `rgba(140,175,210,${fogAlpha * 0.6})`); fogGrad.addColorStop(1, `rgba(100,140,180,0)`);
        window.ctx.fillStyle = fogGrad; window.ctx.fillRect(0, groundScreenY - 80, _hW, 140);
        window.ctx.save(); window.ctx.globalCompositeOperation = 'screen';
        window.blocks.forEach(b => { if (b.type === 'campfire' && b.isBurning) { const bsx = (b.x + 15 - window.camera.x - _hW/2) * _hz + _hW/2; const bsy = (b.y + 10 - window.camera.y - _hH/2) * _hz + _hH/2; const flicker = 0.92 + Math.sin(window.game.frameCount * 0.19 + b.x) * 0.08; const bloomR = 55 * _hz * flicker; const bloomG = window.ctx.createRadialGradient(bsx, bsy, 0, bsx, bsy, bloomR); bloomG.addColorStop(0, 'rgba(255,140,20,0.18)'); bloomG.addColorStop(0.5,'rgba(255,90,0,0.07)'); bloomG.addColorStop(1, 'rgba(255,60,0,0)'); window.ctx.fillStyle = bloomG; window.ctx.beginPath(); window.ctx.arc(bsx, bsy, bloomR, 0, Math.PI*2); window.ctx.fill(); } });
        if (!window.player.isDead && (window.player.activeTool === 'torch' || window.player.activeTool === 'torch_item') && window.player.torchLit) { const tsx = (window.player.x + window.player.width/2 - window.camera.x - _hW/2) * _hz + _hW/2; const tsy = (window.player.y + window.player.height/2 - window.camera.y - _hH/2) * _hz + _hH/2; const tf = 0.9 + Math.sin(window.game.frameCount * 0.23) * 0.1; const tBG = window.ctx.createRadialGradient(tsx, tsy, 0, tsx, tsy, 80 * _hz * tf); tBG.addColorStop(0, 'rgba(255,180,50,0.16)'); tBG.addColorStop(1, 'rgba(255,130,0,0)'); window.ctx.fillStyle = tBG; window.ctx.beginPath(); window.ctx.arc(tsx, tsy, 80 * _hz * tf, 0, Math.PI*2); window.ctx.fill(); }
        window.ctx.restore();
        { let currentUptimeHQ = window.game.serverStartTime ? (Date.now() - window.game.serverStartTime) : (window.game.frameCount * (1000/60)); let totalFramesHQ = Math.floor(currentUptimeHQ / (1000/60)) + 28800; let hourFloatHQ = (totalFramesHQ / 3600) % 24;
          const isDawnDusk = (hourFloatHQ > 5 && hourFloatHQ < 7.5) || (hourFloatHQ > 17.5 && hourFloatHQ < 20);
          if (isDawnDusk) { const dawnT = hourFloatHQ < 12 ? Math.min(1, (hourFloatHQ - 5) / 2.5) * (1 - Math.min(1, (hourFloatHQ - 6.5) / 1)) : Math.min(1, (hourFloatHQ - 17.5) / 2) * (1 - Math.min(1, (hourFloatHQ - 19) / 1)); const dAlpha = dawnT * 0.12; window.ctx.fillStyle = `rgba(255,140,30,${dAlpha})`; window.ctx.globalCompositeOperation = 'multiply'; window.ctx.fillRect(0, 0, _hW, _hH); window.ctx.globalCompositeOperation = 'source-over'; }
          if (darkness > 0.5) { const nightA = (darkness - 0.5) * 0.1; window.ctx.fillStyle = `rgba(20,30,80,${nightA})`; window.ctx.globalCompositeOperation = 'multiply'; window.ctx.fillRect(0, 0, _hW, _hH); window.ctx.globalCompositeOperation = 'source-over'; }
        }
    }

    // === AGUA DE LA COSTA (coordenadas pantalla) ===
    if (window.camera.x < window.game.shoreX + 100) {
        const z2 = window.game.zoom || 1; const gL_w = window.game.baseGroundLevel || window.game.groundLevel; const shore_w = window.game.shoreX - 70;
        function _wx2sx(wx) { return (wx - window.camera.x - W/2) * z2 + W/2; } function _wy2sy(wy) { return (wy - window.camera.y - H/2) * z2 + H/2; }
        const surfaceY = _wy2sy(gL_w); const shoreX_s = _wx2sx(shore_w); const leftEdge = 0; const waterW = shoreX_s - leftEdge;
        if (waterW > 0) {
            const waveT = window.game.frameCount * 0.04; const waveOffset = Math.sin(waveT) * 4;
            const deepGrad = window.ctx.createLinearGradient(0, surfaceY, 0, surfaceY + 80 * z2); deepGrad.addColorStop(0, '#1a8fc0'); deepGrad.addColorStop(0.5, '#0d6e9e'); deepGrad.addColorStop(1, '#083d5a'); window.ctx.fillStyle = deepGrad; window.ctx.fillRect(leftEdge, surfaceY, waterW, H - surfaceY + 50);
            window.ctx.fillStyle = 'rgba(100,200,255,0.35)'; window.ctx.fillRect(leftEdge, surfaceY + 5 + waveOffset, waterW, 8 * z2);
            const waveOffset2 = Math.sin(waveT + 1.3) * 3; window.ctx.fillStyle = 'rgba(180,235,255,0.18)'; window.ctx.fillRect(leftEdge, surfaceY + 16 + waveOffset2, waterW, 5 * z2);
            window.ctx.fillStyle = 'rgba(255,255,255,0.10)'; window.ctx.fillRect(leftEdge, surfaceY, waterW, 4);
            window.ctx.fillStyle = 'rgba(255,255,255,0.55)'; window.ctx.fillRect(shoreX_s - 5, surfaceY + 3, 5, 7 * z2);
        }
    }

    // === LUZ DINÁMICA (lightCanvas, destination-out) ===
    if (window.lightCtx) {
        window.lightCtx.clearRect(0, 0, window._canvasLogicW, window._canvasLogicH);
        const _lz = window.game.zoom || 1; const _lW = window._canvasLogicW, _lH = window._canvasLogicH;
        function _wts(wx, wy) { return [(wx - _iCamX - _lW/2)*_lz + _lW/2, (wy - _iCamY - _lH/2)*_lz + _lH/2]; }

        // ── Oscuridad ambiental ────────────────────────────────────────────────
        // Bajo tierra: más oscuro cuanto más profundo, pero con un mínimo visible.
        // En superficie: oscuridad de día/noche normal.
        let targetDarkness = darkness * 0.65;
        let _depthPxForLight = 0;
        if (window.getGroundY && window.getTerrainCol && window.player) {
            const _bs    = window.game.blockSize;
            const _pCol  = Math.floor((window.player.x + window.player.width/2) / _bs);
            const _pCD   = window.getTerrainCol(_pCol);
            const _pTopY = (_pCD && _pCD.type !== 'hole') ? _pCD.topY : (window.game.baseGroundLevel || 510);
            const _depthPx = (window.player.y + window.player.height) - _pTopY;
            _depthPxForLight = _depthPx;
            if (_depthPx > _bs * 1.5) {
                const depthFactor = Math.min(1, (_depthPx - _bs * 1.5) / (_bs * 8));
                // Underground: empieza en 0.48 (más claro que antes: 0.55) para que se vea más
                targetDarkness = Math.max(targetDarkness, 0.48 + depthFactor * 0.34);
            }
        }
        if (window._ugDarknessSmooth === undefined) window._ugDarknessSmooth = targetDarkness;
        window._ugDarknessSmooth += (targetDarkness - window._ugDarknessSmooth) * 0.06;
        const ambientDarkness = window._ugDarknessSmooth;

        window.lightCtx.fillStyle = `rgba(5, 5, 10, ${ambientDarkness})`;
        window.lightCtx.fillRect(0, 0, _lW, _lH);
        window.lightCtx.globalCompositeOperation = 'destination-out';

        // Flicker determinístico (sin Math.random → no varía frame a frame)
        const _fc = window.game.frameCount || 0;
        const _tf = 0.9 + Math.sin(_fc * 0.21) * 0.06 + Math.sin(_fc * 0.13 + 1.4) * 0.04;

        if (!window.player.isDead && (window.player.activeTool === 'torch' || window.player.activeTool === 'torch_item') && window.player.torchLit) {
            let pGlowSize = 260 * _tf * _lz;
            let [px, py] = _wts(window.player.x + window.player.width/2, window.player.y + window.player.height/2);
            let pGrad = window.lightCtx.createRadialGradient(px, py, 0, px, py, pGlowSize);
            pGrad.addColorStop(0, 'rgba(255, 180, 50, 0.9)'); pGrad.addColorStop(0.4, 'rgba(255, 150, 30, 0.6)'); pGrad.addColorStop(1, 'rgba(255, 120, 0, 0)');
            window.lightCtx.fillStyle = pGrad; window.lightCtx.beginPath(); window.lightCtx.arc(px, py, pGlowSize, 0, Math.PI*2); window.lightCtx.fill();
        }
        if (window.game.isMultiplayer) {
            Object.values(window.otherPlayers).forEach(p => {
                if (p.id !== window.socket?.id && !p.isDead && (p.activeTool === 'torch' || p.activeTool === 'torch_item') && p.torchLit) {
                    const _tf2 = 0.9 + Math.sin(_fc * 0.19 + (p.x||0)*0.001) * 0.1;
                    let pGlowSize2 = 260 * _tf2 * _lz;
                    let [cx, cy] = _wts(p.x + (p.width||20)/2, p.y + (p.height||56)/2);
                    let pGrad = window.lightCtx.createRadialGradient(cx, cy, 0, cx, cy, pGlowSize2);
                    pGrad.addColorStop(0, 'rgba(255, 180, 50, 0.9)'); pGrad.addColorStop(0.4, 'rgba(255, 150, 30, 0.6)'); pGrad.addColorStop(1, 'rgba(255, 120, 0, 0)');
                    window.lightCtx.fillStyle = pGrad; window.lightCtx.beginPath(); window.lightCtx.arc(cx, cy, pGlowSize2, 0, Math.PI*2); window.lightCtx.fill();
                }
            });
        }
        window.blocks.forEach(b => {
            if (b.type === 'campfire' && b.isBurning) {
                const _cf = 0.92 + Math.sin(_fc * 0.19 + b.x * 0.001) * 0.08;
                let glow = 260 * _cf * _lz; let [bx, by] = _wts(b.x+15, b.y+15);
                let cGrad = window.lightCtx.createRadialGradient(bx, by, 0, bx, by, glow);
                cGrad.addColorStop(0, 'rgba(255, 200, 100, 0.9)'); cGrad.addColorStop(0.4, 'rgba(255, 160, 50, 0.6)'); cGrad.addColorStop(1, 'rgba(255, 130, 0, 0)');
                window.lightCtx.fillStyle = cGrad; window.lightCtx.beginPath(); window.lightCtx.arc(bx, by, glow, 0, Math.PI*2); window.lightCtx.fill();
            }
            if (b.type === 'placed_torch') {
                const _ptf = 0.9 + Math.sin(_fc * 0.25 + b.x * 0.01) * 0.1;
                let tGlow = 165 * _ptf * _lz;
                let [tx, ty] = _wts(b.x + window.game.blockSize * 0.5, b.y + window.game.blockSize * 0.3);
                let tGrad = window.lightCtx.createRadialGradient(tx, ty, 0, tx, ty, tGlow);
                tGrad.addColorStop(0, 'rgba(255, 200, 80, 0.85)'); tGrad.addColorStop(0.4, 'rgba(255, 150, 20, 0.55)'); tGrad.addColorStop(1, 'rgba(255, 100, 0, 0)');
                window.lightCtx.fillStyle = tGrad; window.lightCtx.beginPath(); window.lightCtx.arc(tx, ty, tGlow, 0, Math.PI*2); window.lightCtx.fill();
            }
        });
        // Luz de slimes de cueva
        if (window.entities?.length > 0 && ambientDarkness > 0.1) {
            const _slimeCols = [
                [40,180,80], [40,80,220], [140,40,220],
            ];
            for (const _se of window.entities) {
                if (_se.type !== 'slime' || !_se.inCave) continue;
                const [slx, sly] = _wts(_se.x + _se.width/2, _se.y + _se.height/2);
                const _sc = _slimeCols[(_se.slimeColor||0)%3];
                const _sgr = window.lightCtx.createRadialGradient(slx, sly, 0, slx, sly, 35*_lz);
                _sgr.addColorStop(0, `rgba(${_sc[0]},${_sc[1]},${_sc[2]},0.45)`);
                _sgr.addColorStop(1, `rgba(${_sc[0]},${_sc[1]},${_sc[2]},0)`);
                window.lightCtx.fillStyle = _sgr;
                window.lightCtx.beginPath(); window.lightCtx.arc(slx, sly, 35*_lz, 0, Math.PI*2); window.lightCtx.fill();
            }
        }
        if (window.cavePlants?.length > 0) {
            const _plantPulse = 0.7 + Math.sin(_fc * 0.08) * 0.3;
            const _plantColors = [
                [40, 80, 255],   // azul
                [40, 220, 80],   // verde
                [170, 40, 240],  // violeta
            ];
            for (const _cp of window.cavePlants) {
                if (!window._caveExplored?.has(`${_cp.col}_${_cp.row}`)) continue;
                const _pLightX = _cp.x;
                const _pLightY = _cp.y + (window.game.blockSize||30) - 8;
                const [plx, ply] = _wts(_pLightX, _pLightY);
                const _pGlowR = (_cp.type === 'shroom' ? 45 : 30) * _lz * _plantPulse;
                const _pIdx = _cp.variant || 0;
                const [pr, pg, pb] = _plantColors[_pIdx % 3];
                const _pGr = window.lightCtx.createRadialGradient(plx, ply, 0, plx, ply, _pGlowR);
                _pGr.addColorStop(0, `rgba(${pr},${pg},${pb},0.55)`);
                _pGr.addColorStop(1, `rgba(${pr},${pg},${pb},0)`);
                window.lightCtx.fillStyle = _pGr;
                window.lightCtx.beginPath(); window.lightCtx.arc(plx, ply, _pGlowR, 0, Math.PI*2); window.lightCtx.fill();
            }
        }
        // Luz de gólem (cristalina azul) y aura de Madre Araña
        if (window.entities?.length > 0 && ambientDarkness > 0.1) {
            for (const _le of window.entities) {
                if (!_le.inCave) continue;
                if (_le.type === 'golem') {
                    const [gx,gy] = _wts(_le.x+_le.width/2, _le.y+_le.height*0.25);
                    const _gf = 0.75 + Math.sin((_fc)*0.09+_le.x*0.01)*0.25;
                    const gR = 90 * _lz * _gf;
                    const gGr = window.lightCtx.createRadialGradient(gx,gy,0,gx,gy,gR);
                    gGr.addColorStop(0,'rgba(80,200,255,0.55)'); gGr.addColorStop(0.4,'rgba(40,140,255,0.20)'); gGr.addColorStop(1,'rgba(0,100,255,0)');
                    window.lightCtx.fillStyle=gGr; window.lightCtx.beginPath(); window.lightCtx.arc(gx,gy,gR,0,Math.PI*2); window.lightCtx.fill();
                } else if (_le.type === 'brood_mother' && _le.bossPhase === 3) {
                    const [bmx,bmy] = _wts(_le.x+_le.width/2, _le.y+_le.height*0.5);
                    const _bmR = 70 * _lz;
                    const _bmGr = window.lightCtx.createRadialGradient(bmx,bmy,0,bmx,bmy,_bmR);
                    _bmGr.addColorStop(0,'rgba(255,30,0,0.25)'); _bmGr.addColorStop(1,'rgba(255,0,0,0)');
                    window.lightCtx.fillStyle=_bmGr; window.lightCtx.beginPath(); window.lightCtx.arc(bmx,bmy,_bmR,0,Math.PI*2); window.lightCtx.fill();
                }
            }
        }

        // ── Rayos de luz a través de huecos verticales ───────────────────────
        // Cuando el jugador está bajo tierra, buscar columnas del jugador con
        // huecos abiertos hacia arriba (row0 minado o hueco de cueva natural
        // que llega a la superficie). Un rayo vertical bajará por ese hueco.
        if (!_onSurface && window.getUGCellV && window.getTerrainCol && ambientDarkness > 0.1) {
            const _bs2 = window.game.blockSize;
            const _shaftAlpha = Math.min(0.55, ambientDarkness * 0.75) * (1 - darkness); // más débil de noche
            if (_shaftAlpha > 0.02) {
                const _pCenterX = window.player.x + window.player.width / 2;
                // Revisar columnas cerca del jugador (±8 columnas)
                const _shaftStartCol = Math.floor((_pCenterX - _bs2 * 8) / _bs2);
                const _shaftEndCol   = Math.floor((_pCenterX + _bs2 * 8) / _bs2);
                for (let _sc = _shaftStartCol; _sc <= _shaftEndCol; _sc++) {
                    const _scd = window.getTerrainCol(_sc);
                    if (!_scd || _scd.type === 'hole') continue;
                    const _stopY = _scd.topY;
                    // Verificar si el hueco va desde row0 hasta el jugador (columna abierta)
                    let _shaftDepth = 0;
                    let _shaftOpen  = true;
                    for (let _sr = 0; _sr < 30; _sr++) {
                        const _m = window.getUGCellV(_sc, _sr);
                        if (_m !== 'air') { _shaftOpen = false; break; }
                        _shaftDepth = _sr + 1;
                    }
                    if (!_shaftOpen || _shaftDepth < 2) continue;
                    // Hay un hueco abierto — dibujar rayo de luz
                    const _shaftX = _sc * _bs2;
                    const _shaftTopY  = _stopY;
                    const _shaftBotY  = _stopY + _shaftDepth * _bs2;
                    const [_slx, _sly]  = _wts(_shaftX, _shaftTopY);
                    const [_slx2, _sly2] = _wts(_shaftX + _bs2, _shaftBotY);
                    // Distancia horizontal al jugador → atenúa el brillo del rayo
                    const _distFactor = Math.max(0, 1 - Math.abs(_sc * _bs2 + _bs2/2 - _pCenterX) / (_bs2 * 6));
                    if (_distFactor < 0.05) continue;
                    const _sGrad = window.lightCtx.createLinearGradient(_slx, _sly, _slx, _sly2);
                    const _sA = _shaftAlpha * _distFactor;
                    _sGrad.addColorStop(0, `rgba(220,230,255,${_sA})`);
                    _sGrad.addColorStop(0.6, `rgba(180,200,255,${_sA * 0.4})`);
                    _sGrad.addColorStop(1, `rgba(150,180,255,0)`);
                    window.lightCtx.fillStyle = _sGrad;
                    window.lightCtx.fillRect(_slx, _sly, _slx2 - _slx, _sly2 - _sly);
                }
            }
        }

        window.lightCtx.globalCompositeOperation = 'source-over';
        window.ctx.drawImage(window.lightCanvas, 0, 0, _lW, _lH);
    }

    // === NOMBRES/CHAT EN COORDENADAS MUNDO (con zoom aplicado) ===
    const _ncz = window.game.zoom || 1; const _ncW = window._canvasLogicW, _ncH = window._canvasLogicH;
    window.ctx.save(); window.ctx.translate(_ncW/2, _ncH/2); window.ctx.scale(_ncz, _ncz); window.ctx.translate(-_ncW/2, -_ncH/2); window.ctx.translate(-window.camera.x, -window.camera.y);
    const PLAYER_COLORS = ['#4fc3f7','#81c784','#ffb74d','#f06292','#ce93d8','#80cbc4','#fff176','#ff8a65'];
    function playerColor(name) { let h = 0; for (let c of (name||'')) h = (h * 31 + c.charCodeAt(0)) & 0xffff; return PLAYER_COLORS[h % PLAYER_COLORS.length]; }
    const activeChatBoxes = [];
    const drawNameAndChat = (charData, isLocal) => {
        if (charData.isDead) return;
        if (!isLocal) { let dist = Math.hypot(window.player.x - charData.x, window.player.y - charData.y); if (dist > 500) return; }
        const pCX = charData.x + (charData.width || 20) / 2; const pCY = charData.y + (charData.height || 56); const bob = Math.abs(Math.sin((charData.renderAnimTime || 0) * 3)) * 3; const nameY = pCY - 80 - bob;
        if (!isLocal) { const col = playerColor(charData.name); window.ctx.fillStyle = col; window.ctx.font = 'bold 16px "VT323"'; window.ctx.textAlign = 'center'; window.ctx.shadowColor = 'rgba(0,0,0,0.9)'; window.ctx.shadowBlur = 4; window.ctx.fillText(`${charData.name} (Nv. ${charData.level || 1})`, pCX, nameY); window.ctx.shadowBlur = 0; }
        if (charData.chatExpires && Date.now() < charData.chatExpires && charData.chatText) {
            window.ctx.font = 'bold 17px "VT323"'; const tW = window.ctx.measureText(charData.chatText).width; const boxW = tW + 20; const boxH = 26; const col = playerColor(charData.name);
            let baseY = pCY - 115 - bob; let finalY = baseY;
            for (let attempt = 0; attempt < 8; attempt++) { let overlaps = false; for (const other of activeChatBoxes) { const dx = Math.abs(pCX - other.cx); const dy = Math.abs(finalY - other.cy); if (dx < (boxW/2 + other.w/2 + 8) && dy < (boxH/2 + other.h/2 + 4)) { overlaps = true; break; } } if (!overlaps) break; finalY -= boxH + 6; }
            activeChatBoxes.push({ cx: pCX, cy: finalY, w: boxW, h: boxH });
            const bx = pCX - boxW / 2; const by = finalY - boxH / 2;
            window.ctx.fillStyle = 'rgba(8,14,24,0.92)'; window._roundRect(window.ctx, bx, by, boxW, boxH, 7); window.ctx.fill();
            window.ctx.strokeStyle = col; window.ctx.lineWidth = 1.5; window._roundRect(window.ctx, bx, by, boxW, boxH, 7); window.ctx.stroke();
            const tx = pCX; const ty = by + boxH; window.ctx.fillStyle = 'rgba(8,14,24,0.92)'; window.ctx.beginPath(); window.ctx.moveTo(tx - 5, ty); window.ctx.lineTo(tx + 5, ty); window.ctx.lineTo(tx, ty + 7); window.ctx.fill(); window.ctx.strokeStyle = col; window.ctx.lineWidth = 1.5; window.ctx.beginPath(); window.ctx.moveTo(tx - 5, ty - 1); window.ctx.lineTo(tx, ty + 7); window.ctx.lineTo(tx + 5, ty - 1); window.ctx.stroke();
            const nameLabel = (charData.name || '?').split(' ')[0]; window.ctx.textAlign = 'center'; window.ctx.shadowColor = 'rgba(0,0,0,0.8)'; window.ctx.shadowBlur = 3;
            if (!isLocal) { window.ctx.font = 'bold 13px "VT323"'; window.ctx.fillStyle = col; window.ctx.fillText(nameLabel + ':', bx + 6 + window.ctx.measureText(nameLabel + ':').width/2, by + 10); window.ctx.font = 'bold 17px "VT323"'; window.ctx.fillStyle = '#fff'; window.ctx.fillText(charData.chatText, pCX, by + boxH - 6); }
            else { window.ctx.font = 'bold 17px "VT323"'; window.ctx.fillStyle = '#fff'; window.ctx.fillText(charData.chatText, pCX, by + boxH/2 + 5); }
            window.ctx.shadowBlur = 0;
        }
    };
    window._roundRect = window._roundRect || function(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); };
    if (window.game.isMultiplayer) { Object.values(window.otherPlayers).forEach(p => { if (p.id !== window.socket?.id) drawNameAndChat(p, false); }); }
    if (!window.player.inBackground) drawNameAndChat(window.player, true);
    window.ctx.restore(); // fin nombres/chat con zoom

    // Tutorial modo construir (martillo, centrado en pantalla, sin zoom)
    if (window.player.activeTool === 'hammer' && !window.player.isDead && !window.player.placementMode) {
        const C = window.ctx; const dpr = window._dpr || 1; const W = window._canvasLogicW || 1280; const isStairMode = window.player.buildMode === 'stair';
        C.save(); C.setTransform(1, 0, 0, 1, 0, 0); const scale = dpr; const boxH = (isStairMode ? 92 : 72) * scale;
        C.font = `${11 * scale}px "VT323"`; const line1 = 'Modo: Escalón   |   R → cambiar   |   Clic → construir (2 madera)'; const line2 = 'Caminar sobre el escalón para subir automáticamente'; const measuredW = Math.max(C.measureText(line1).width, C.measureText(line2).width); const boxW = Math.max(280 * scale, measuredW + 32 * scale);
        const canvasW = window.canvas ? window.canvas.width : W * scale; const tutX = Math.round((canvasW - boxW) / 2); const tutY = 60 * scale;
        C.globalAlpha = 0.82; C.fillStyle = 'rgba(10,10,10,0.75)'; window.roundRect(C, tutX, tutY, boxW, boxH, 8 * scale); C.fill(); C.globalAlpha = 1; C.textAlign = 'center'; const cx = tutX + boxW / 2;
        C.font = `bold ${12 * scale}px "VT323"`; C.fillStyle = '#f0c040'; C.fillText('🔨 MODO CONSTRUIR', cx, tutY + 18 * scale);
        C.font = `${11 * scale}px "VT323"`; C.fillStyle = '#ddd'; const modeNames = { block: 'Bloque', door: 'Puerta', stair: 'Escalón' }; C.fillText(`Modo: ${modeNames[window.player.buildMode]}   |   R → cambiar   |   Clic → construir (2 madera)`, cx, tutY + 36 * scale);
        if (isStairMode) { C.fillStyle = '#88ccff'; C.fillText(`T → espejo  (${window.player.stairMirror ? '◀ sube a la izquierda' : '▶ sube a la derecha'})`, cx, tutY + 54 * scale); C.fillStyle = '#888'; C.fillText('Caminar sobre el escalón para subir automáticamente', cx, tutY + 70 * scale); }
        else { C.fillStyle = '#888'; C.fillText('Puerta cuesta 4 madera · Bloque/Escalón 2 madera', cx, tutY + 52 * scale); }
        C.restore();
    }

    // Indicador de rival PVP (flecha offscreen o tag sobre rival)
    if (window.pvp && window.pvp.activeOpponent && window.game.isMultiplayer) {
        const rival = window.otherPlayers && window.otherPlayers[window.pvp.activeOpponent];
        if (rival && !rival.isDead) {
            const rWorldX = rival.x + (rival.width||20)/2; const rWorldY = rival.y + (rival.height||56)/2; const pWorldX = window.player.x + window.player.width/2; const pWorldY = window.player.y + window.player.height/2;
            const _z2 = window.game.zoom || 1; const rSX = (rWorldX - window.camera.x - W/2) * _z2 + W/2; const rSY = (rWorldY - window.camera.y - H/2) * _z2 + H/2;
            const dist = Math.round(Math.hypot(rWorldX - pWorldX, rWorldY - pWorldY) / 10); const offScreen = rSX < 20 || rSX > W - 20 || rSY < 20 || rSY > H - 20;
            window.ctx.save();
            if (offScreen) {
                const angle = Math.atan2(rWorldY - pWorldY, rWorldX - pWorldX); const margin = 50; const cx2 = W / 2, cy2 = H / 2; const tx = cx2 + Math.cos(angle) * (cx2 - margin); const ty = cy2 + Math.sin(angle) * (cy2 - margin); const clampedX = Math.max(margin, Math.min(W - margin, tx)); const clampedY = Math.max(margin, Math.min(H - margin, ty));
                window.ctx.translate(clampedX, clampedY); window.ctx.rotate(angle);
                window.ctx.fillStyle = 'rgba(180,20,20,0.85)'; window.ctx.beginPath(); window.ctx.roundRect(-32, -14, 64, 28, 6); window.ctx.fill();
                window.ctx.fillStyle = '#ff6666'; window.ctx.beginPath(); window.ctx.moveTo(22, 0); window.ctx.lineTo(10, -8); window.ctx.lineTo(10, 8); window.ctx.closePath(); window.ctx.fill();
                window.ctx.rotate(-angle); window.ctx.fillStyle = '#fff'; window.ctx.font = 'bold 15px "VT323"'; window.ctx.textAlign = 'center'; window.ctx.textBaseline = 'middle';
                const rivalName = rival.name ? rival.name.substring(0,8) : '?'; window.ctx.fillText(`${rivalName} ${dist}m`, 0, 0);
            } else {
                const pulse = Math.sin(window.game.frameCount * 0.12) * 0.3 + 0.85; const rivalH = (rival.height||56) * _z2;
                window.ctx.globalAlpha = pulse; window.ctx.fillStyle = 'rgba(160,10,10,0.82)'; window.ctx.beginPath(); const tagW = 54, tagH = 16, tagX = rSX - tagW/2, tagY = rSY - rivalH/2 - 48; window.ctx.roundRect(tagX, tagY, tagW, tagH, 4); window.ctx.fill();
                window.ctx.globalAlpha = 1; window.ctx.fillStyle = '#ffaaaa'; window.ctx.font = 'bold 14px "VT323"'; window.ctx.textAlign = 'center'; window.ctx.textBaseline = 'middle'; window.ctx.fillText(`⚔ ${dist}m`, rSX, tagY + tagH/2);
            }
            window.ctx.restore();
            if (window.game.frameCount % 60 === 0 && window.updatePlayerList) window.updatePlayerList();
        } else if (rival && rival.isDead) { window.pvp.activeOpponent = null; if(window.addGlobalMessage) window.addGlobalMessage('🏆 ¡Tu rival cayó! Ganaste el duelo.', '#f1c40f'); if(window.updatePlayerList) window.updatePlayerList(); }
    }

    // === VIÑETA + PELIGRO BAJO HP ===
    const _ppW = window._canvasLogicW || 1280; const _ppH = window._canvasLogicH || 720;
    {
        const hp = (window.player && window.player.hp != null) ? window.player.hp : 100; const maxHp = (window.player && window.player.maxHp) ? window.player.maxHp : 100; const hpRatio = hp / maxHp;
        const dangerLevel = hpRatio < 0.4 ? Math.pow(1 - hpRatio / 0.4, 1.5) : 0; const dangerPulse = dangerLevel > 0.4 ? 0.7 + 0.3 * Math.sin(window.game.frameCount * 0.08) : 1.0;
        const vigBase = darkness * 0.40; const vigOuter = vigBase + dangerLevel * 0.45 * dangerPulse;
        const vigGrad = window.ctx.createRadialGradient(_ppW/2, _ppH/2, _ppH * 0.28, _ppW/2, _ppH/2, _ppH * 0.9); vigGrad.addColorStop(0, 'rgba(0,0,0,0)'); vigGrad.addColorStop(0.55, `rgba(0,0,0,${vigBase * 0.25})`); vigGrad.addColorStop(1, `rgba(0,0,0,${vigOuter})`); window.ctx.fillStyle = vigGrad; window.ctx.fillRect(0, 0, _ppW, _ppH);
        if (dangerLevel > 0.01) { const redAlpha = dangerLevel * 0.38 * dangerPulse; const redGrad = window.ctx.createRadialGradient(_ppW/2, _ppH/2, _ppH * 0.22, _ppW/2, _ppH/2, _ppH * 0.88); redGrad.addColorStop(0, 'rgba(180,0,0,0)'); redGrad.addColorStop(0.5, `rgba(160,0,0,${redAlpha * 0.4})`); redGrad.addColorStop(1, `rgba(140,0,0,${redAlpha})`); window.ctx.fillStyle = redGrad; window.ctx.fillRect(0, 0, _ppW, _ppH); }
    }

    // Aberración cromática (screenShake o pvpHitFlash, Q≠low)
    if (Q !== 'low' && (window.game.screenShake > 0 || (window.player && (window.player.pvpHitFlash||0) > 0))) {
        const aberAmt = window.game.screenShake > 0 ? (Q === 'high' ? Math.min(window.game.screenShake * 0.5, 6) : Math.min(window.game.screenShake * 0.3, 4)) : (Q === 'high' ? 4 : 3);
        window.ctx.globalAlpha = 0.08; window.ctx.globalCompositeOperation = 'screen'; window.ctx.fillStyle = '#ff0000'; window.ctx.fillRect(-aberAmt, 0, _ppW, _ppH); window.ctx.fillStyle = '#0000ff'; window.ctx.fillRect(aberAmt, 0, _ppW, _ppH); window.ctx.globalCompositeOperation = 'source-over'; window.ctx.globalAlpha = 1;
    }

    // Grano de película (noise sobre canvas 256×256 reciclado, Q≠low)
    {
        if (Q !== 'low') {
            const grainAmt = Q === 'high' ? (darkness > 0.5 ? 0.072 : 0.028) : (darkness > 0.5 ? 0.045 : 0.015); const grainSeed = window.game.frameCount * 7919;
            const gCanvas = window._grainCanvas || (window._grainCanvas = document.createElement('canvas')); gCanvas.width = 256; gCanvas.height = 256;
            const gCtx = gCanvas.getContext('2d'); const imgData = gCtx.createImageData(256, 256); const data = imgData.data; let baseGrainAlpha = Math.floor(darkness * 35);
            for (let i = 0; i < data.length; i += 4) { const n = ((Math.sin(i * 0.0137 + grainSeed) * 43758.5453) % 1 + 1) % 1; const v = (n - 0.5) * 255 * grainAmt * 4; data[i] = data[i+1] = data[i+2] = 128 + v; data[i+3] = baseGrainAlpha; }
            gCtx.putImageData(imgData, 0, 0); const grainPattern = window.ctx.createPattern(gCanvas, 'repeat'); window.ctx.globalCompositeOperation = 'overlay'; window.ctx.globalAlpha = 1; window.ctx.fillStyle = grainPattern; window.ctx.fillRect(0, 0, _ppW, _ppH); window.ctx.globalCompositeOperation = 'source-over';
        }
    }

    // === LLUVIA (gotas físicas + splashes, Q≠low) ===
    if (window.game.isRaining && Q !== 'low') {
        const C = window.ctx; const fc = window.game.frameCount; const z = window.game.zoom || 1; const camX = window.camera.x; const camY = window.camera.y;
        const RAIN_COUNT = Q === 'high' ? 350 : 220;
        if (!window._rainDrops || window._rainDrops.length === 0) { window._rainDrops = []; for (let i = 0; i < RAIN_COUNT; i++) { window._rainDrops.push({ x: Math.random() * (_ppW + 200) - 100, y: Math.random() * _ppH, vy: 14 + Math.random() * 8, vx: -2.5 - Math.random() * 1.5, len: 14 + Math.random() * 14, a: 0.25 + Math.random() * 0.25, splashTimer: 0 }); } }
        if (!window._rainSplashes) window._rainSplashes = [];
        for (const d of window._rainDrops) {
            d.x += d.vx; d.y += d.vy;
            const wx = d.x / z + camX - (_ppW / 2) * (1 / z - 1); const wy = d.y / z + camY - (_ppH / 2) * (1 / z - 1);
            const gY_w = window.getGroundY ? window.getGroundY(wx) : window.game.groundLevel; const gY_sc = (gY_w - camY) * z + _ppH / 2 * (1 - z);
            const bs = window.game.blockSize; let hitBlock = false; let blockHitY = 0;
            for (const b of (window.blocks || [])) { if (b.type === 'ladder' || (b.type === 'door' && b.open)) continue; const bsx = (b.x - camX) * z + _ppW / 2 * (1 - z); const bsy = (b.y - camY) * z + _ppH / 2 * (1 - z); const bsw = bs * z; const bsh = (b.type === 'door' ? bs * 2 : bs) * z; if (d.x >= bsx && d.x <= bsx + bsw && d.y >= bsy && d.y <= bsy + bsh) { hitBlock = true; blockHitY = bsy; break; } }
            const hitGround = d.y >= gY_sc;
            if (hitBlock || hitGround) { const splashY = hitBlock ? blockHitY : gY_sc; window._rainSplashes.push({ x: d.x, y: splashY, life: 1.0, r: 2.5 + Math.random() * 2 }); d.x = Math.random() * (_ppW + 200) - 100; d.y = -d.len - Math.random() * 80; d.vy = 14 + Math.random() * 8; d.vx = -2.5 - Math.random() * 1.5; }
            else if (d.x < -100 || d.x > _ppW + 100) { d.x = d.vx < 0 ? _ppW + 80 : -80; d.y = Math.random() * _ppH * 0.6; }
        }
        for (let si = window._rainSplashes.length - 1; si >= 0; si--) { window._rainSplashes[si].life -= 0.08; if (window._rainSplashes[si].life <= 0) window._rainSplashes.splice(si, 1); }
        C.save(); C.lineCap = 'round';
        C.lineWidth = 1; C.beginPath(); for (const d of window._rainDrops) { if (d.a < 0.38) { C.moveTo(d.x, d.y); C.lineTo(d.x - d.vx * d.len / d.vy, d.y - d.len); } } C.strokeStyle = 'rgba(180,215,255,0.30)'; C.stroke();
        C.lineWidth = 1.3; C.beginPath(); for (const d of window._rainDrops) { if (d.a >= 0.38) { C.moveTo(d.x, d.y); C.lineTo(d.x - d.vx * d.len / d.vy, d.y - d.len); } } C.strokeStyle = 'rgba(200,230,255,0.42)'; C.stroke();
        for (const sp of window._rainSplashes) { const a = sp.life * 0.55; C.beginPath(); C.ellipse(sp.x, sp.y, sp.r * (2 - sp.life), sp.r * 0.4, 0, 0, Math.PI * 2); C.strokeStyle = `rgba(200,230,255,${a})`; C.lineWidth = 0.8; C.stroke(); const nSp = Math.floor(sp.r); for (let n = 0; n < nSp; n++) { const sa = (n / nSp) * Math.PI; const sd = sp.r * (1 - sp.life) * 6; C.beginPath(); C.arc(sp.x + Math.cos(sa) * sd, sp.y - Math.sin(sa) * sd * 0.6, 0.7, 0, Math.PI * 2); C.fillStyle = `rgba(210,235,255,${a * 0.7})`; C.fill(); } }
        C.restore(); C.fillStyle = 'rgba(40,60,90,0.04)'; C.fillRect(0, 0, _ppW, _ppH);
    } else if (window._rainDrops) { window._rainDrops = []; window._rainSplashes = []; }

    // Borde de pantalla
    { window.ctx.strokeStyle = 'rgba(0,0,0,0.5)'; window.ctx.lineWidth = 3; window.ctx.strokeRect(1, 1, _ppW - 2, _ppH - 2); }

    window.ctx.restore(); // cierra screenShake (save más externo)

    // ── Contador de UPS/FPS — abajo-derecha, fuera del screenShake ──
    {
        const ups  = window._ups  || 0;   // actualizaciones de lógica/seg (debería ser ~60)
        const fps  = window._fps  || 0;   // frames de render/seg (depende del monitor)
        const C    = window.ctx;
        const uCol = ups >= 58 ? '#44ff88' : ups >= 40 ? '#ffdd00' : '#ff4444';
        const fCol = '#888888';  // FPS de render es solo info, no crítico
        C.save();
        C.font         = '9px "Press Start 2P"';
        C.textAlign    = 'right';
        C.textBaseline = 'bottom';
        const label    = ups + ' UPS  ' + fps + ' FPS';
        const tw       = C.measureText(label).width;
        C.fillStyle    = 'rgba(0,0,0,0.5)';
        C.fillRect(_ppW - tw - 10, _ppH - 16, tw + 8, 13);
        // UPS en color diagnóstico
        const uLabel = ups + ' UPS  ';
        const utw    = C.measureText(uLabel).width;
        C.fillStyle  = uCol;
        C.fillText(uLabel, _ppW - 6 - C.measureText(fps + ' FPS').width, _ppH - 4);
        C.fillStyle  = fCol;
        C.fillText(fps + ' FPS', _ppW - 6, _ppH - 4);
        C.restore();
    }

    // ── Cursor personalizado (crosshair) ────────────────────────────────────────
    // Dibujado en coordenadas de pantalla, siempre encima de todo.
    // Se oculta si el juego no está corriendo o el menú está visible.
    if (window.game.isRunning && window.screenMouseX != null) {
        const C   = window.ctx;
        const _cx = window.screenMouseX;
        const _cy = window.screenMouseY;
        const _hovering = !!window.hoveredEntity;
        const _arm  = _hovering ? 7  : 9;   // longitud de cada brazo
        const _gap  = _hovering ? 3  : 4;   // hueco central
        const _lw   = _hovering ? 2.0 : 1.5;

        C.save();
        // Sombra/borde negro para legibilidad
        C.strokeStyle = 'rgba(0,0,0,0.75)';
        C.lineWidth   = _lw + 1.5;
        C.lineCap     = 'round';
        C.beginPath();
        C.moveTo(_cx - _arm - _gap, _cy); C.lineTo(_cx - _gap, _cy);
        C.moveTo(_cx + _gap, _cy);        C.lineTo(_cx + _arm + _gap, _cy);
        C.moveTo(_cx, _cy - _arm - _gap); C.lineTo(_cx, _cy - _gap);
        C.moveTo(_cx, _cy + _gap);        C.lineTo(_cx, _cy + _arm + _gap);
        C.stroke();
        // Cruz principal — blanca, o amarilla si hay entidad bajo el cursor
        C.strokeStyle = _hovering ? '#ffe566' : '#ffffff';
        C.lineWidth   = _lw;
        C.beginPath();
        C.moveTo(_cx - _arm - _gap, _cy); C.lineTo(_cx - _gap, _cy);
        C.moveTo(_cx + _gap, _cy);        C.lineTo(_cx + _arm + _gap, _cy);
        C.moveTo(_cx, _cy - _arm - _gap); C.lineTo(_cx, _cy - _gap);
        C.moveTo(_cx, _cy + _gap);        C.lineTo(_cx, _cy + _arm + _gap);
        C.stroke();
        // Punto central pequeño
        if (_hovering) {
            C.fillStyle = '#ffe566';
            C.beginPath(); C.arc(_cx, _cy, 2, 0, Math.PI * 2); C.fill();
        }
        C.restore();
    }
};
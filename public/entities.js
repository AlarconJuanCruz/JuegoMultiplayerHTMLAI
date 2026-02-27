// === entities.js - IA DE ENTIDADES, LOOT Y GENERACIÓN DE SECTORES ===
// Extraído de game.js. Depende de: window.game, window.player, window.entities,
// window.blocks, window.projectiles, window.droppedItems, window.killedEntities,
// window.getGroundY, window.checkEntityCollisions, window.applyStairPhysicsEntity,
// window.sendWorldUpdate, window.spawnParticles, window.spawnDamageText,
// window.gainXP, window.damagePlayer, window.destroyBlockLocally

// ─── Loot centralizado ────────────────────────────────────────────────────────
// Antes este bloque if/else estaba duplicado 3 veces en game.js
// (tryHitEntity, procesamiento de proyectiles y el loop de entities).

/**
 * Genera drops en el suelo y otorga XP cuando una entidad muere.
 * NO elimina la entidad del array; eso lo hace el llamador.
 * @param {object} ent  entidad muerta
 */
window.killEntityLoot = function (ent) {
    const drop = (type, amount, vx = 0) => {
        const item = {
            id: Math.random().toString(36).substring(2, 15),
            x: ent.x + ent.width / 2, y: ent.y,
            vx, vy: -1, type, amount, life: 1.0
        };
        window.droppedItems.push(item);
        window.sendWorldUpdate('drop_item', { item });
    };

    switch (ent.type) {
        case 'spider':
            drop('web', 2);
            window.gainXP(20 * ent.level);
            break;
        case 'chicken':
            drop('meat', 1);
            window.gainXP(10);
            break;
        case 'zombie':
            drop('meat', 2);
            window.gainXP(50 * ent.level);
            break;
        case 'wolf':
            drop('meat', 1 + Math.floor(Math.random() * 2));
            window.gainXP(35 * ent.level);
            break;
        case 'archer':
            drop('arrows', 2 + Math.floor(Math.random() * 4), -1);
            drop('wood',   3, 1);
            window.gainXP(40 * ent.level);
            break;
    }
};

// ─── Generación de sectores del mundo ─────────────────────────────────────────

window.generateWorldSector = function (startX, endX) {
    if (startX < window.game.shoreX + 50) startX = window.game.shoreX + 50;

    let seed = (Math.floor(startX) + 12345) ^ ((window.worldSeed || 12345) & 0xFFFF);
    function sRandom() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }

    if (!window.removedTrees)   window.removedTrees   = [];
    if (!window.treeState)      window.treeState      = {};
    if (!window.removedRocks)   window.removedRocks   = [];
    if (!window.killedEntities) window.killedEntities = [];

    const bs = window.game.blockSize;

    function isTerrainTooSteep(cx) {
        if (!window.getGroundY) return false;
        const base = window.getGroundY(cx);
        return Math.abs(window.getGroundY(cx - 30) - base) > 45 ||
               Math.abs(window.getGroundY(cx + 30) - base) > 45;
    }

    // ── Árboles ──
    const TREE_W = 40, TREE_H = 240;
    const numTrees   = Math.floor(sRandom() * 5) + 3;
    const localTreeX = [];

    for (let i = 0; i < numTrees; i++) {
        let tx, valid = false, attempts = 0;
        while (attempts < 15 && !valid) {
            tx    = Math.floor(startX + 50 + sRandom() * (endX - startX - 100));
            valid = localTreeX.every(ex => Math.abs(tx - ex) >= 140) && !isTerrainTooSteep(tx + TREE_W / 2);
            attempts++;
        }
        if (!valid) continue;
        localTreeX.push(tx);

        if (window.removedTrees.some(rx => Math.abs(rx - tx) < 1)) continue;
        if (window.trees.some(t => Math.abs(t.x - tx) < 1))        continue;

        const stateKey  = Object.keys(window.treeState).find(kx => Math.abs(parseFloat(kx) - tx) < 1);
        const tState    = stateKey ? window.treeState[stateKey] : null;
        const isStump   = tState ? tState.isStump       : false;
        const rCount    = tState ? tState.regrowthCount : 0;
        const gDay      = tState ? tState.grownDay      : -1;
        const tGroundY  = window.getGroundY ? window.getGroundY(tx + TREE_W / 2) + 12 : window.game.groundLevel;

        const dStart    = (window.game.desertStart || 2600) + window.game.shoreX;
        const dWidth    = window.game.desertWidth  || 800;
        const txDist    = tx + TREE_W / 2;
        const inDesert  = txDist > dStart + dWidth * 0.6;
        const atEdge    = txDist > dStart && !inDesert;

        let treeType;
        if (inDesert)      treeType = 3;
        else if (atEdge)   treeType = sRandom() < 0.4 ? 3 : Math.floor(sRandom() * 3);
        else               treeType = Math.floor(sRandom() * 3);

        window.trees.push({
            id: 't_' + tx, x: tx, y: tGroundY - TREE_H, width: TREE_W, height: TREE_H,
            hp: isStump ? 50 : 100, maxHp: isStump ? 50 : 100,
            isHit: false, type: treeType, isStump, regrowthCount: rCount, grownDay: gDay, groundY: tGroundY
        });
    }

    // ── Rocas ──
    if (startX > 800 && sRandom() < 0.75) {
        const numRocks = Math.floor(sRandom() * 3) + 2;
        for (let i = 0; i < numRocks; i++) {
            const rx  = Math.floor(startX + sRandom() * (endX - startX));
            const rW  = 50 + Math.floor(sRandom() * 40);
            const rH  = 35 + Math.floor(sRandom() * 25);
            const rcx = rx + rW / 2;
            if (isTerrainTooSteep(rcx)) continue;
            const rGY = window.getGroundY ? window.getGroundY(rcx) + 10 : window.game.groundLevel;
            if (window.removedRocks.some(rrx => Math.abs(rrx - rx) < 1)) continue;
            if (window.rocks.some(r => Math.abs(r.x - rx) < 1)) continue;
            window.rocks.push({ id: 'r_' + rx, x: rx, y: rGY - rH, width: rW, height: rH, hp: 300, maxHp: 300, isHit: false });
        }
    }

    // ── Entidad inicial del sector ──
    const cx       = Math.floor(startX + 100 + sRandom() * (endX - startX - 200));
    const distShore = Math.abs(cx - window.game.shoreX);
    const lvl      = Math.max(1, Math.floor(distShore / 4000)) + Math.max(0, window.game.days - 1);
    const newId    = 'e_' + cx;
    const cGY      = window.getGroundY ? window.getGroundY(cx) : window.game.groundLevel;

    if (window.entities.some(e => e.id === newId) || window.killedEntities.includes(newId)) return;

    // ── Zona de bosque: antes del desierto, entre 1500-desertStart ──
    const dStart     = (window.game.desertStart || 8000) + (window.game.shoreX || 200);
    const inForest   = cx > window.game.shoreX + 1500 && cx < dStart - 500;

    // ── Jauría de lobos en el bosque (hasta 3, solo de día o madrugada) ──
    if (inForest && sRandom() < 0.3) {
        const packSize = 1 + Math.floor(sRandom() * 3); // 1-3 lobos
        for (let w = 0; w < packSize; w++) {
            const wId  = 'w_' + cx + '_' + w;
            if (window.entities.some(e => e.id === wId) || window.killedEntities.includes(wId)) continue;
            const wX   = cx + (w - 1) * 40 + Math.floor(sRandom() * 20 - 10);
            const wGY  = window.getGroundY ? window.getGroundY(wX + 10) : window.game.groundLevel;
            const wHp  = 30 + lvl * 8;
            window.entities.push({
                id: wId, type: 'wolf', name: 'Lobo', level: lvl,
                x: wX, y: wGY - 18, width: 22, height: 18,
                vx: sRandom() > 0.5 ? 0.5 : -0.5, vy: 0,
                hp: wHp, maxHp: wHp,
                damage: 6 + lvl * 2,
                isHit: false, attackCooldown: 0, stuckFrames: 0,
                ignorePlayer: 0, lastX: wX,
                // referencia al pack para comportamiento en manada
                packId: 'pack_' + cx,
            });
        }
        return; // no spawnear otra entidad en este sector
    }

    if (distShore > 5000) {
        if (distShore > 7000 && sRandom() < 0.35) {
            const aHp = 20 + lvl * 12;
            window.entities.push({ id: newId, type: 'archer', name: 'Cazador', level: lvl, x: cx, y: cGY - 40, width: 20, height: 40, vx: sRandom() > 0.5 ? 0.8 : -0.8, vy: 0, hp: aHp, maxHp: aHp, damage: 5 + lvl * 2, isHit: false, attackCooldown: 0, stuckFrames: 0, ignorePlayer: 0, lastX: cx });
        } else if (sRandom() < 0.55) {
            window.entities.push({ id: newId, type: 'chicken', name: 'Pollo', level: 1, x: cx, y: cGY - 20, width: 20, height: 20, vx: sRandom() > 0.5 ? 0.3 : -0.3, vy: 0, hp: 25, maxHp: 25, isHit: false, attackCooldown: 0, stuckFrames: 0, fleeTimer: 0, fleeDir: 1, lastX: cx });
        } else {
            const sHp = 15 + lvl * 10; const sW = 14 + lvl, sH = 8 + lvl;
            window.entities.push({ id: newId, type: 'spider', name: 'Araña', level: lvl, x: cx, y: cGY - sH, width: sW, height: sH, vx: sRandom() > 0.5 ? 0.6 : -0.6, vy: 0, hp: sHp, maxHp: sHp, damage: 5 + lvl * 2, isHit: false, attackCooldown: 0, stuckFrames: 0, ignorePlayer: 0, lastX: cx });
        }
    } else {
        window.entities.push({ id: newId, type: 'chicken', name: 'Pollo', level: 1, x: cx, y: cGY - 20, width: 20, height: 20, vx: sRandom() > 0.5 ? 0.3 : -0.3, vy: 0, hp: 25, maxHp: 25, isHit: false, attackCooldown: 0, stuckFrames: 0, fleeTimer: 0, fleeDir: 1, lastX: cx });
    }
};

// ─── Actualización de IA de entidades ─────────────────────────────────────────

/**
 * Actualiza física + IA de todas las entidades activas.
 * Extrae el loop de entities del update() de game.js.
 * @param {boolean} isDay
 * @param {boolean} isNight
 * @param {boolean} isHoldingTorch
 * @param {number}  pCX   centro X del jugador
 * @param {number}  pCY   centro Y del jugador
 */
window.updateEntities = function (isDay, isNight, isHoldingTorch, pCX, pCY) {
    for (let i = window.entities.length - 1; i >= 0; i--) {
        const ent = window.entities[i];

        // ── Muerte diferida (puede ocurrir si hp cayó a 0 sin pasar por tryHit) ──
        if (ent.hp <= 0) {
            window.killedEntities.push(ent.id);
            window.sendWorldUpdate('kill_entity', { id: ent.id });
            window.spawnParticles(ent.x, ent.y, '#ff4444', 15);
            window.killEntityLoot(ent);
            window.entities.splice(i, 1);
            if (window.updateUI) window.updateUI();
            continue;
        }

        // ── Knockback + enrage ──
        if ((ent.knockbackFrames || 0) > 0) {
            ent.knockbackFrames--;
            if (ent.knockbackFrames === 0) ent.enragedFrames = 160;
        }
        if ((ent.enragedFrames || 0) > 0) ent.enragedFrames--;

        // ── Física ──
        const lastX = ent.x;
        ent.x += ent.vx;
        const hitWall = window.checkEntityCollisions(ent, 'x');
        if (ent.x < window.game.shoreX + 2000) { ent.x = window.game.shoreX + 2000; ent.vx = Math.abs(ent.vx); }

        ent.vy += window.game.gravity;
        ent.y  += ent.vy;
        window.checkEntityCollisions(ent, 'y');

        const entGY = window.getGroundY ? window.getGroundY(ent.x + ent.width / 2) : window.game.groundLevel;
        if (ent.y + ent.height >= entGY) { ent.y = entGY - ent.height; ent.vy = 0; }
        else if (ent.vy >= 0 && ent.y + ent.height >= entGY - 22) { ent.y = entGY - ent.height; ent.vy = 0; }

        window.applyStairPhysicsEntity(ent);

        // ── Target: jugador más cercano ──
        let target = window.player, targetCX = pCX, targetCY = pCY;
        let minDist = Math.hypot(pCX - (ent.x + ent.width / 2), pCY - (ent.y + ent.height / 2));

        if (window.game.isMultiplayer && window.otherPlayers) {
            for (const op of Object.values(window.otherPlayers)) {
                if (op.isDead) continue;
                const opCX = op.x + (op.width || 24) / 2;
                const opCY = op.y + (op.height || 40) / 2;
                const d    = Math.hypot(opCX - (ent.x + ent.width / 2), opCY - (ent.y + ent.height / 2));
                if (d < minDist) { minDist = d; target = op; targetCX = opCX; targetCY = opCY; }
            }
        }

        // ── Daño solar a zombies ──
        if (isDay && ent.type === 'zombie' && window.game.frameCount % 30 === 0) {
            ent.hp -= 5; window.setHit(ent);
            window.spawnParticles(ent.x + ent.width / 2, ent.y + ent.height / 2, '#ffa500', 5);
            window.spawnDamageText(ent.x, ent.y, '-5', '#ffa500');
        }

        // ── Repulsión por hoguera ──
        let repelled = false;
        for (const b of window.blocks) {
            if (b.type === 'campfire' && b.isBurning &&
                Math.hypot((ent.x + ent.width / 2) - (b.x + 15), (ent.y + ent.height / 2) - (b.y + 15)) < 150) {
                ent.vx = ent.x > b.x ? 1.5 : -1.5;
                repelled = true;
                break;
            }
        }

        if (!repelled) {
            _updateEntityAI(ent, i, target, targetCX, targetCY, minDist, isDay, isNight, isHoldingTorch, hitWall, lastX, entGY);
        }
    }
};

/** @private */
function _updateEntityAI(ent, idx, target, targetCX, targetCY, minDist, isDay, isNight, isHoldingTorch, hitWall, lastX, entGY) {
    const isGrounded = ent.y + ent.height >= entGY - 2;

    if (ent.type === 'spider' || ent.type === 'zombie') {
        if (ent.ignorePlayer > 0) { ent.ignorePlayer--; }

        const aggroRange  = ent.type === 'zombie'
            ? (isNight && !target.isStealth ? 800 : 400)
            : (isNight && !target.isStealth ? 600 : 180);
        const repelTorch  = isHoldingTorch && minDist < 250 && ent.level <= 3 && target === window.player;

        if (repelTorch) {
            ent.vx = ent.x > targetCX ? 1.5 : -1.5;
            ent.ignorePlayer = 60;
        } else if ((ent.knockbackFrames || 0) > 0) {
            // Durante knockback no procesar IA
        } else if (minDist < aggroRange && ent.ignorePlayer <= 0) {
            const spd    = (ent.type === 'zombie' ? 0.4 : 0.8) * ((ent.enragedFrames || 0) > 0 ? 1.6 : 1.0);
            const dirX   = target.x > ent.x ? 1 : -1;
            ent.vx = dirX * spd;

            // Salto predictivo al detectar desnivel
            if (isGrounded && window.getGroundY) {
                const gHere  = window.getGroundY(ent.x + ent.width / 2);
                const gAhead = window.getGroundY(ent.x + ent.width / 2 + dirX * window.game.blockSize * 1.5);
                if (gAhead < gHere - window.game.blockSize * 1.2) { ent.vy = ent.type === 'zombie' ? -7 : -9; ent.stuckFrames = 0; }
            }

            if (hitWall || Math.abs(ent.x - lastX) < 0.1) {
                ent.stuckFrames++;
                const barricadeAhead = window.blocks.some(b =>
                    b.type === 'barricade' &&
                    Math.abs((ent.x + ent.width / 2) - (b.x + window.game.blockSize / 2)) < ent.width + 5 &&
                    Math.abs((ent.y + ent.height / 2) - (b.y + window.game.blockSize / 2)) < ent.height + 5
                );
                if (ent.stuckFrames > 20 && isGrounded) {
                    ent.vy = ent.type === 'zombie' ? -7 : -9;
                    if (ent.stuckFrames > 60 && ent.type !== 'zombie' && !barricadeAhead) {
                        ent.ignorePlayer = 180; ent.vx = -dirX * spd * 1.5; ent.stuckFrames = 0;
                    }
                }
            } else { ent.stuckFrames = 0; }

            if (minDist < 40 && ent.attackCooldown <= 0 && !target.inBackground && !target.isDead) {
                if (target === window.player) window.damagePlayer(ent.damage, ent.name);
                ent.attackCooldown = 150;
            }
        } else {
            if (ent.type === 'spider' && Math.random() < 0.02 && ent.ignorePlayer <= 0) {
                ent.vx = Math.random() > 0.5 ? 0.5 : -0.5;
            }
        }

        if (ent.attackCooldown > 0) ent.attackCooldown--;
    }

    else if (ent.type === 'archer') {
        if (ent.ignorePlayer > 0) { ent.ignorePlayer--; }

        const aggroRange = isNight && !target.isStealth ? 1000 : 800;

        if (minDist < aggroRange && ent.ignorePlayer <= 0 && !target.inBackground && !target.isDead) {
            const dirX = target.x > ent.x ? 1 : -1;
            if      (minDist > 500) ent.vx =  dirX * 0.9;
            else if (minDist < 250) ent.vx = -dirX * 1.1;
            else                    ent.vx =  0;

            if (isGrounded && window.getGroundY && ent.vx !== 0) {
                const mvDir  = ent.vx > 0 ? 1 : -1;
                const gHere  = window.getGroundY(ent.x + ent.width / 2);
                const gAhead = window.getGroundY(ent.x + ent.width / 2 + mvDir * window.game.blockSize * 1.5);
                if (gAhead < gHere - window.game.blockSize * 1.2) { ent.vy = -7; ent.stuckFrames = 0; }
            }

            if (hitWall || (Math.abs(ent.x - lastX) < 0.1 && ent.vx !== 0)) {
                ent.stuckFrames++;
                if (ent.stuckFrames > 20 && isGrounded) ent.vy = -7;
                if (ent.stuckFrames > 60) { ent.ignorePlayer = 60; ent.stuckFrames = 0; }
            } else { ent.stuckFrames = 0; }

            if (ent.attackCooldown <= 0 && minDist < 550) {
                const vxB     = targetCX - (ent.x + ent.width / 2);
                const vyB     = targetCY - (ent.y + ent.height / 2);
                const spd     = Math.max(0.1, Math.hypot(vxB, vyB));
                const aSpd    = 11;
                let   angle   = Math.atan2(vyB / spd * aSpd - (minDist / aSpd) * window.game.gravity * 0.2, vxB / spd * aSpd);
                const err     = Math.max(0, 0.2 - ent.level * 0.02);
                angle += (Math.random() - 0.5) * err;

                window.projectiles.push({
                    x: ent.x + ent.width / 2, y: ent.y + ent.height / 2,
                    vx: Math.cos(angle) * aSpd, vy: Math.sin(angle) * aSpd,
                    life: 250, damage: ent.damage, isEnemy: true, owner: ent.id
                });
                ent.attackCooldown = Math.max(120, 250 - ent.level * 10);
            }
        } else {
            if (Math.random() < 0.02 && ent.ignorePlayer <= 0) ent.vx = Math.random() > 0.5 ? 0.6 : -0.6;
        }
        if (ent.attackCooldown > 0) ent.attackCooldown--;
    }

    else if (ent.type === 'chicken') {
        if (ent.fleeTimer > 0) { ent.fleeTimer--; ent.vx = ent.fleeDir * 1.5; }
        else if (Math.random() < 0.02) ent.vx = Math.random() > 0.5 ? 0.3 : -0.3;
    }

    else if (ent.type === 'wolf') {
        if (ent.ignorePlayer > 0) { ent.ignorePlayer--; }

        // Rango de agresión: más amplio de noche, se activa al ver al jugador
        const aggroRange = isNight ? 700 : 350;
        const repelTorch = isHoldingTorch && minDist < 220 && target === window.player;

        if (repelTorch) {
            // Los lobos huyen del fuego
            ent.vx = ent.x > targetCX ? 2.0 : -2.0;
            ent.ignorePlayer = 90;
        } else if ((ent.knockbackFrames || 0) > 0) {
            // knockback, sin IA
        } else if (minDist < aggroRange && ent.ignorePlayer <= 0) {
            // Comportamiento en manada: si hay compañeros cerca, atacan juntos más rápido
            const packMates = window.entities.filter(e =>
                e !== ent && e.type === 'wolf' && e.packId === ent.packId &&
                Math.abs(e.x - ent.x) < 200
            ).length;
            const spd = (0.9 + packMates * 0.15) * ((ent.enragedFrames || 0) > 0 ? 1.7 : 1.0);
            const dirX = target.x > ent.x ? 1 : -1;
            ent.vx = dirX * spd;

            // Salto predictivo
            if (isGrounded && window.getGroundY) {
                const gHere  = window.getGroundY(ent.x + ent.width / 2);
                const gAhead = window.getGroundY(ent.x + ent.width / 2 + dirX * window.game.blockSize * 1.5);
                if (gAhead < gHere - window.game.blockSize * 1.1) { ent.vy = -8; ent.stuckFrames = 0; }
            }

            if (hitWall || Math.abs(ent.x - lastX) < 0.1) {
                ent.stuckFrames++;
                if (ent.stuckFrames > 15 && isGrounded) { ent.vy = -8; }
                if (ent.stuckFrames > 50) { ent.ignorePlayer = 60; ent.stuckFrames = 0; }
            } else { ent.stuckFrames = 0; }

            // Mordida
            if (minDist < 38 && ent.attackCooldown <= 0 && !target.inBackground && !target.isDead) {
                if (target === window.player) window.damagePlayer(ent.damage, 'Lobo');
                ent.attackCooldown = 80; // ataca más rápido que zombie
            }
        } else {
            // Patrulla lenta en manada
            if (Math.random() < 0.015) ent.vx = Math.random() > 0.5 ? 0.4 : -0.4;
        }

        if (ent.attackCooldown > 0) ent.attackCooldown--;
    }
}

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
            const wX   = cx + (w - 1) * 50 + Math.floor(sRandom() * 20 - 10);
            const wGY  = window.getGroundY ? window.getGroundY(wX + 14) : window.game.groundLevel;
            const wHp  = 40 + lvl * 10;
            window.entities.push({
                id: wId, type: 'wolf', name: 'Lobo', level: lvl,
                x: wX, y: wGY - 22, width: 28, height: 22,
                vx: sRandom() > 0.5 ? 0.5 : -0.5, vy: 0,
                hp: wHp, maxHp: wHp,
                damage: 7 + lvl * 2,
                isHit: false, attackCooldown: 0, stuckFrames: 0,
                ignorePlayer: 0, lastX: wX,
                packId: 'pack_' + cx,
                // estado de IA del lobo
                wolfState: 'patrol',   // patrol | stalk | charge | leaping | cooldown
                wolfStateTimer: 0,
                wolfLeader: w === 0,   // el primero es el líder de la manada
            });
        }
        return;
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

        // ── Torretas: prioridad máxima si el enemigo está en su rango ────────
        // Las torretas son las primeras en ser atacadas si están dentro de 350px
        if (ent.type !== 'chicken') {
            const TURRET_AGGRO = 350;
            let nearestTurret = null, turretDist = TURRET_AGGRO + 1;
            for (const bl of window.blocks) {
                if (bl.type !== 'turret' || (bl.arrows || 0) <= 0) continue;
                const d = Math.hypot((bl.x + 15) - (ent.x + ent.width / 2), (bl.y + 15) - (ent.y + ent.height / 2));
                if (d < turretDist) { turretDist = d; nearestTurret = bl; }
            }
            if (nearestTurret) {
                target    = nearestTurret;
                targetCX  = nearestTurret.x + 15;
                targetCY  = nearestTurret.y + 15;
                minDist   = turretDist;
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

        // ── Init stamina/estado ───────────────────────────────────────────────
        if (ent.stamina  === undefined) ent.stamina  = 100;
        if (ent.aiState  === undefined) ent.aiState  = 'idle';
        if (ent.fleeCool === undefined) ent.fleeCool = 0;
        if (ent.roamDir  === undefined) ent.roamDir  = 1;
        if (ent.roamT    === undefined) ent.roamT    = 0;

        const aggroRange = ent.type === 'zombie'
            ? (isNight && !target.isStealth ? 800 : 400)
            : (isNight && !target.isStealth ? 600 : 180);
        const hpPct      = ent.hp / ent.maxHp;
        const enraged    = (ent.enragedFrames || 0) > 0;
        const baseSpd    = ent.type === 'zombie' ? 0.45 : 1.05; // araña más rápida

        // Stamina: se drena en chase, se recarga en reposo
        if (ent.aiState === 'chase' || ent.aiState === 'flank') {
            ent.stamina = Math.max(0, ent.stamina - 0.2);
        } else {
            ent.stamina = Math.min(100, ent.stamina + 0.3);
        }
        if (ent.fleeCool > 0) ent.fleeCool--;

        // ── Huida de antorcha ─────────────────────────────────────────────────
        const repelTorch = isHoldingTorch && minDist < 250 && ent.level <= 3 && target === window.player;
        if (repelTorch) {
            ent.aiState  = 'flee'; ent.fleeCool = 90;
            ent.vx = ent.x > targetCX ? 1.8 : -1.8;
            ent.ignorePlayer = 60;
            if (ent.attackCooldown > 0) ent.attackCooldown--;
            return;
        }
        if ((ent.knockbackFrames || 0) > 0) {
            if (ent.attackCooldown > 0) ent.attackCooldown--;
            return;
        }

        // ── Máquina de estados ────────────────────────────────────────────────
        // Araña huye con HP < 28% o sin stamina. Zombie nunca huye (es implacable).
        if (ent.type === 'spider') {
            if ((hpPct < 0.28 || ent.stamina <= 0) && ent.aiState !== 'flee') {
                ent.aiState = 'flee'; ent.fleeCool = hpPct < 0.28 ? 240 : 140;
                ent.ignorePlayer = ent.fleeCool;
            }
        }
        if (ent.aiState === 'flee') {
            if (ent.fleeCool <= 0) ent.aiState = minDist < aggroRange && ent.stamina > 40 ? 'chase' : 'idle';
        } else if (ent.ignorePlayer <= 0 && minDist < aggroRange) {
            if (ent.type === 'spider') {
                // Araña: tres modos tácticos según distancia
                if (minDist > 200) {
                    // Lejos: perseguir directamente
                    if (ent.aiState !== 'chase') ent.aiState = 'chase';
                } else if (minDist > 55) {
                    // Media distancia: alternar entre chase y flankeo circular
                    if (ent.aiState !== 'flank' && Math.random() < 0.012) {
                        ent.aiState = 'flank';
                        ent.roamDir = Math.random() > 0.5 ? 1 : -1;
                        ent.roamT   = 30 + (Math.random() * 40 | 0);
                    } else if (ent.aiState !== 'flank') {
                        ent.aiState = 'chase';
                    }
                } else {
                    // Muy cerca: salto de ataque si está en suelo
                    if (isGrounded && ent.aiState !== 'lunge') {
                        ent.aiState = 'lunge';
                        ent.roamT   = 12; // pequeña carga antes de saltar
                    }
                }
            } else {
                ent.aiState = 'chase';
            }
        } else if (ent.aiState !== 'roam' && ent.aiState !== 'lunge') {
            ent.aiState = 'idle';
        }

        // Timers de flankeo y lunge
        if (ent.aiState === 'flank') {
            if (ent.roamT > 0) ent.roamT--;
            else ent.aiState = 'chase';
        }
        if (ent.aiState === 'lunge') {
            if (ent.roamT > 0) { ent.roamT--; ent.vx = (target.x > ent.x ? 1 : -1) * 0.3; }
            else {
                // Ejecutar salto de ataque
                const dirX  = target.x > ent.x ? 1 : -1;
                ent.vx = dirX * 4.5;
                ent.vy = -7;
                ent.aiState = 'chase';
            }
        }
        // Timer de roam (después de desengancharse)
        if (ent.aiState === 'roam') {
            if (ent.roamT > 0) ent.roamT--;
            else { ent.aiState = 'idle'; ent.ignorePlayer = 0; }
        }

        // ── Ejecución ─────────────────────────────────────────────────────────
        if (ent.aiState === 'flee') {
            const fd  = ent.x > targetCX ? 1 : -1;
            const fsp = ent.type === 'spider' ? 1.6 : 0.85;
            ent.vx = fd * fsp * (enraged ? 1.2 : 1.0);
            if ((hitWall || Math.abs(ent.x - lastX) < 0.1) && isGrounded) ent.vy = -8;

        } else if (ent.aiState === 'flank') {
            // Araña rodea al jugador lateralmente a buena velocidad
            const flankSpd = ent.type === 'spider' ? 1.4 : 1.0;
            ent.vx = ent.roamDir * flankSpd * (enraged ? 1.4 : 1.0);
            if (minDist > 220) ent.aiState = 'chase';
            // Si durante el flankeo llega muy cerca, lunge
            if (ent.type === 'spider' && minDist < 50 && isGrounded) {
                ent.aiState = 'lunge'; ent.roamT = 8;
            }

        } else if (ent.aiState === 'roam') {
            ent.vx = ent.roamDir * baseSpd * 0.65;

        } else if (ent.aiState === 'chase') {
            const dirX = target.x > ent.x ? 1 : -1;
            const spd  = baseSpd * (enraged ? 1.6 : 1.0);
            ent.vx = dirX * spd;

            // Salto predictivo de terreno
            if (isGrounded && window.getGroundY) {
                const gHere  = window.getGroundY(ent.x + ent.width / 2);
                const gAhead = window.getGroundY(ent.x + ent.width / 2 + dirX * window.game.blockSize * 1.5);
                if (gAhead < gHere - window.game.blockSize * 1.2) { ent.vy = ent.type === 'zombie' ? -7 : -9; ent.stuckFrames = 0; }
            }

            // Desatascar — si está stuck mucho tiempo (ej: contra torreta inaccesible) abandona
            if (hitWall || Math.abs(ent.x - lastX) < 0.1) {
                ent.stuckFrames = (ent.stuckFrames || 0) + 1;
                if (ent.stuckFrames > 18 && isGrounded) ent.vy = ent.type === 'zombie' ? -7 : -9;
                if (ent.stuckFrames > 65) {
                    ent.aiState = 'roam'; ent.roamDir = -dirX;
                    ent.roamT   = 80; ent.ignorePlayer = 80; ent.stuckFrames = 0;
                }
            } else { ent.stuckFrames = 0; }

            // Melee
            if (minDist < 40 && ent.attackCooldown <= 0 && !target.inBackground && !target.isDead) {
                if (target === window.player) {
                    window.damagePlayer(ent.damage, ent.name);
                } else if (target && target.type === 'turret') {
                    target.hp -= ent.damage;
                    window.setHit(target);
                    window.spawnParticles(target.x + 15, target.y + 15, '#f0c020', 5);
                    if (target.hp <= 0) window.destroyBlockLocally(target);
                    else window.sendWorldUpdate('hit_block', { x: target.x, y: target.y, dmg: ent.damage });
                }
                ent.attackCooldown = ent.type === 'zombie' ? 150 : 80; // araña ataca más seguido
            }

        } else { // idle
            ent.vx *= 0.88;
            if (ent.type === 'spider' && Math.random() < 0.012 && ent.ignorePlayer <= 0) {
                ent.vx = (Math.random() > 0.5 ? 0.4 : -0.4);
            }
        }

        if (ent.attackCooldown > 0) ent.attackCooldown--;
    }

    else if (ent.type === 'archer') {
        if (ent.ignorePlayer > 0) { ent.ignorePlayer--; }

        // ── Init ──────────────────────────────────────────────────────────────
        if (ent.stamina   === undefined) ent.stamina   = 100;
        if (ent.aiState   === undefined) ent.aiState   = 'idle';
        if (ent.fleeCool  === undefined) ent.fleeCool  = 0;
        if (ent.strafeDir === undefined) ent.strafeDir = 1;
        if (ent.strafeT   === undefined) ent.strafeT   = 0;

        const aggroRange = isNight && !target.isStealth ? 1000 : 800;
        const hpPct      = ent.hp / ent.maxHp;
        if (ent.fleeCool > 0) ent.fleeCool--;

        // ── Estados ───────────────────────────────────────────────────────────
        if (hpPct < 0.25 && ent.aiState !== 'flee') {
            ent.aiState = 'flee'; ent.fleeCool = 200; ent.ignorePlayer = 200;
        }
        if (ent.aiState === 'flee') {
            if (ent.fleeCool <= 0) ent.aiState = minDist < aggroRange ? 'kite' : 'idle';
        } else if (minDist < aggroRange && ent.ignorePlayer <= 0 && !target.inBackground && !target.isDead) {
            ent.aiState = 'kite';
        } else if (ent.aiState !== 'flee') {
            ent.aiState = 'idle';
        }

        if ((ent.knockbackFrames || 0) > 0) {
            if (ent.attackCooldown > 0) ent.attackCooldown--;
            return;
        }

        // ── Ejecución ─────────────────────────────────────────────────────────
        if (ent.aiState === 'flee') {
            const fd = ent.x > targetCX ? 1 : -1;
            ent.vx = fd * 1.8;
            if ((hitWall || Math.abs(ent.x - lastX) < 0.1) && isGrounded) ent.vy = -8;

        } else if (ent.aiState === 'kite') {
            const dirX = target.x > ent.x ? 1 : -1;

            // Acercarse si muy lejos, retroceder si muy cerca, strafe en rango óptimo
            if (minDist > 480) {
                ent.vx = dirX * 1.0;
            } else if (minDist < 190) {
                ent.vx = -dirX * 1.2;
            } else {
                // Strafe: cambia dirección periódicamente
                ent.strafeT = (ent.strafeT || 0) - 1;
                if (ent.strafeT <= 0) { ent.strafeDir = -ent.strafeDir; ent.strafeT = 60 + (Math.random() * 60 | 0); }
                ent.vx = ent.strafeDir * 0.65;
            }

            // Salto de terreno
            if (isGrounded && window.getGroundY && Math.abs(ent.vx) > 0.05) {
                const mvDir  = ent.vx > 0 ? 1 : -1;
                const gHere  = window.getGroundY(ent.x + ent.width / 2);
                const gAhead = window.getGroundY(ent.x + ent.width / 2 + mvDir * window.game.blockSize * 1.5);
                if (gAhead < gHere - window.game.blockSize * 1.2) { ent.vy = -7; ent.stuckFrames = 0; }
            }

            // Desatascar
            if (hitWall || (Math.abs(ent.x - lastX) < 0.1 && Math.abs(ent.vx) > 0.05)) {
                ent.stuckFrames = (ent.stuckFrames || 0) + 1;
                if (ent.stuckFrames > 20 && isGrounded) ent.vy = -7;
                if (ent.stuckFrames > 55) {
                    ent.ignorePlayer = 60; ent.stuckFrames = 0;
                    ent.strafeDir = -ent.strafeDir; ent.strafeT = 60;
                }
            } else { ent.stuckFrames = 0; }

            // Disparo con predicción de movimiento del target
            if (ent.attackCooldown <= 0 && minDist < 550) {
                const predX  = targetCX + (target.vx || 0) * 10;
                const predY  = targetCY + (target.vy || 0) * 5;
                const vxB    = predX - (ent.x + ent.width / 2);
                const vyB    = predY - (ent.y + ent.height / 2);
                const dist   = Math.max(0.1, Math.hypot(vxB, vyB));
                const aSpd   = 11;
                let angle    = Math.atan2(vyB / dist * aSpd - (dist / aSpd) * window.game.gravity * 0.2, vxB / dist * aSpd);
                const err    = Math.max(0, 0.18 - ent.level * 0.02);
                angle += (Math.random() - 0.5) * err;
                window.projectiles.push({
                    x: ent.x + ent.width / 2, y: ent.y + ent.height / 2,
                    vx: Math.cos(angle) * aSpd, vy: Math.sin(angle) * aSpd,
                    life: 250, damage: ent.damage, isEnemy: true, owner: ent.id
                });
                ent.attackCooldown = Math.max(110, 240 - ent.level * 10);
            }

        } else { // idle
            ent.vx = ent.vx * 0.9 + (Math.random() < 0.015 ? (Math.random() > 0.5 ? 0.5 : -0.5) : 0);
        }

        if (ent.attackCooldown > 0) ent.attackCooldown--;
    }

        else if (ent.type === 'chicken') {
        if (ent.fleeTimer > 0) { ent.fleeTimer--; ent.vx = ent.fleeDir * 1.5; }
        else if (Math.random() < 0.02) ent.vx = Math.random() > 0.5 ? 0.3 : -0.3;
    }

    else if (ent.type === 'wolf') {

        // Inicializar estado si no existe (lobos ya spawneados sin wolfState)
        if (!ent.wolfState) { ent.wolfState = 'patrol'; ent.wolfStateTimer = 0; ent.wolfLeader = false; }
        if (ent.wolfStateTimer > 0) ent.wolfStateTimer--;

        const aggroRange  = isNight ? 750 : 420;
        const repelTorch  = isHoldingTorch && minDist < 240 && target === window.player;

        // ── Huida del fuego (override de cualquier estado) ──────────────────
        if (repelTorch) {
            ent.wolfState      = 'cooldown';
            ent.wolfStateTimer = 120;
            ent.ignorePlayer   = 120;
            ent.vx = ent.x > targetCX ? 2.8 : -2.8;
            if (ent.attackCooldown > 0) ent.attackCooldown--;
            return;
        }

        if ((ent.knockbackFrames || 0) > 0) {
            if (ent.attackCooldown > 0) ent.attackCooldown--;
            return;
        }

        // ── Compañeros de manada ─────────────────────────────────────────────
        const packMates = window.entities.filter(e =>
            e !== ent && e.type === 'wolf' && e.packId === ent.packId
        );
        const nearMates = packMates.filter(e => Math.abs(e.x - ent.x) < 280);
        const packBonus = 1 + nearMates.length * 0.22;

        // ── MÁQUINA DE ESTADOS ───────────────────────────────────────────────

        if (ent.wolfState === 'patrol') {
            // Movimiento de patrulla lento y agrupado
            if (Math.random() < 0.015) ent.vx = (Math.random() > 0.5 ? 1 : -1) * 0.55;

            // Mantenerse pegado al grupo
            if (packMates.length > 0) {
                const gx = packMates.reduce((s, e) => s + e.x, 0) / packMates.length;
                if (Math.abs(ent.x - gx) > 70) ent.vx = (gx > ent.x ? 1 : -1) * 0.7;
            }

            // Detectar jugador → stalk
            if (minDist < aggroRange && !target.isDead) {
                ent.wolfState     = 'stalk';
                ent.wolfStateTimer = 0;
            }

        } else if (ent.wolfState === 'stalk') {
            // Acercarse cautelosamente hasta ~100px, manteniendo manada junta
            const dirX    = target.x > ent.x ? 1 : -1;
            const stalkSpd = 1.1 * packBonus;

            if (minDist > 100) {
                ent.vx = dirX * stalkSpd;
            } else {
                ent.vx *= 0.75;
            }

            // Salto de terreno
            if (isGrounded && window.getGroundY) {
                const gHere  = window.getGroundY(ent.x + ent.width / 2);
                const gAhead = window.getGroundY(ent.x + ent.width / 2 + dirX * window.game.blockSize * 1.5);
                if (gAhead < gHere - window.game.blockSize) { ent.vy = -10; }
            }

            // Desatascar — con abandon si lleva demasiado tiempo bloqueado
            if (hitWall || Math.abs(ent.x - lastX) < 0.1) {
                ent.stuckFrames = (ent.stuckFrames || 0) + 1;
                if (ent.stuckFrames > 10 && isGrounded) { ent.vy = -10; }
                if (ent.stuckFrames > 70) {
                    // Abandonar target, retroceder y revaluar
                    ent.wolfState      = 'cooldown';
                    ent.wolfStateTimer = 60;
                    ent.vx             = -dirX * 1.5;
                    ent.stuckFrames    = 0;
                    ent.ignorePlayer   = 60;
                }
            } else { ent.stuckFrames = 0; }

            // Decisión de carga: el líder lo decide cuando está en rango y en suelo
            const isLeader    = ent.wolfLeader || packMates.length === 0;
            const matesReady  = nearMates.length >= Math.min(packMates.length, 1);

            if (isLeader && isGrounded && minDist < 300 && ent.wolfStateTimer === 0 && matesReady) {
                // Propagar carga a toda la manada con pequeño desfase
                const propagate = [ent, ...packMates];
                propagate.forEach((m, i) => {
                    m.wolfState      = 'charge';
                    m.wolfStateTimer = i * 5; // desfase escalonado
                    m.wolfChargeDir  = target.x > m.x ? 1 : -1;
                });
            }

            if (minDist > aggroRange + 150) { ent.wolfState = 'patrol'; }

        } else if (ent.wolfState === 'charge') {
            // Carrera a fondo hacia el jugador
            if (ent.wolfStateTimer > 0) {
                // Espera escalonada antes de salir corriendo
                ent.vx *= 0.85;
            } else {
                const dirX      = ent.wolfChargeDir || (target.x > ent.x ? 1 : -1);
                const chargeSpd = (2.0 + nearMates.length * 0.2) * packBonus;
                ent.vx = dirX * chargeSpd;

                // Salto de obstáculo durante la carga
                if ((hitWall || Math.abs(ent.x - lastX) < 0.1) && isGrounded) {
                    ent.stuckFrames = (ent.stuckFrames || 0) + 1;
                    if (ent.stuckFrames > 8)  { ent.vy = -9; }
                    if (ent.stuckFrames > 55) {
                        ent.wolfState = 'cooldown'; ent.wolfStateTimer = 45;
                        ent.vx = -dirX * 1.5; ent.stuckFrames = 0;
                    }
                } else { ent.stuckFrames = 0; }

                // ── Salto de ataque: calcular trayectoria para impactar al jugador ──
                if (isGrounded && minDist < 70) {
                    const entCX = ent.x + ent.width / 2;
                    const entFY = ent.y + ent.height;          // pie del lobo (en suelo)

                    // Apuntar al centro del jugador (mitad de su altura)
                    const tgtX  = targetCX;
                    const tgtY  = target.y + (target.height || 40) * 0.5;

                    const dx    = tgtX - entCX;
                    const dy    = tgtY - entFY;                 // negativo = jugador está más arriba

                    // Velocidad horizontal del salto: un poco más rápido que la carga
                    const leapVX = dirX * Math.min(Math.abs(dx) * 0.25 + chargeSpd + 1.5, 9);

                    // Tiempo estimado hasta alcanzar la X del jugador
                    const t     = Math.abs(dx) / Math.max(Math.abs(leapVX), 0.5);

                    // vy necesaria para llegar a la altura del centro del jugador
                    // y = vy*t + 0.5*g*t²  →  vy = (dy - 0.5*g*t²) / t
                    const g     = window.game.gravity;          // 0.32
                    let leapVY  = t > 0 ? (dy - 0.5 * g * t * t) / t : -4;

                    // Clamp: no saltar demasiado alto ni demasiado bajo
                    leapVY = Math.max(-9, Math.min(leapVY, -1));

                    ent.vy             = leapVY;
                    ent.vx             = leapVX;
                    ent.wolfState      = 'leaping';
                    ent.wolfStateTimer = 50;
                    ent.wolfLandedX    = null;
                    ent.wolfHitInLeap  = false;   // reset hit flag
                }
            }

        } else if (ent.wolfState === 'leaping') {
            // Trayectoria balística: física normal maneja vy, no tocar vx

            // ── Detectar golpe durante el vuelo ──────────────────────────────
            if (ent.attackCooldown <= 0 && !ent.wolfHitInLeap) {
                if (minDist < 46 && !target.inBackground && !target.isDead) {
                    if (target === window.player) {
                        window.damagePlayer(ent.damage, 'Lobo');
                        // Knockback horizontal en dirección del salto
                        const kDir = ent.wolfChargeDir || 1;
                        window.player.vx = kDir * 4;
                    }
                    ent.wolfHitInLeap  = true;   // un solo golpe por salto
                    ent.attackCooldown = 40;

                    // Retroceder inmediatamente tras pegar: invertir vx
                    const retreatDir = -(ent.wolfChargeDir || 1);
                    ent.vx = retreatDir * 2.5;
                    ent.wolfState      = 'cooldown';
                    ent.wolfStateTimer = 35;
                }
            }

            // ── Aterrizaje sin haber golpeado ────────────────────────────────
            if (isGrounded && ent.wolfStateTimer < 42) {
                ent.wolfState      = 'cooldown';
                const missed       = !ent.wolfHitInLeap;
                ent.wolfStateTimer = missed ? 20 : 35;   // cooldown corto si falló (reintenta rápido)
                ent.vx *= 0.2;
            }

            // Timeout de seguridad
            if (ent.wolfStateTimer === 0) {
                ent.wolfState     = 'stalk';
                ent.wolfStateTimer = 10;
            }

        } else if (ent.wolfState === 'cooldown') {
            // Retroceder brevemente y reagrupar antes del siguiente ciclo
            const retreatDir = ent.x > targetCX ? 1 : -1;
            if (ent.wolfStateTimer > 12) {
                ent.vx = retreatDir * 2.0;
            } else {
                ent.vx *= 0.8;
            }

            // Agrupamiento con compañeros
            if (nearMates.length > 0) {
                const gx = nearMates.reduce((s, e) => s + e.x, 0) / nearMates.length;
                if (Math.abs(ent.x - gx) > 90) ent.vx += (gx > ent.x ? 0.6 : -0.6);
            }

            if (ent.wolfStateTimer === 0) {
                ent.wolfState = minDist < aggroRange ? 'stalk' : 'patrol';
            }
        }

        // Reset global si pierde al jugador
        if (minDist > aggroRange + 200 && ent.wolfState !== 'patrol') {
            ent.wolfState = 'patrol'; ent.wolfStateTimer = 0;
        }

        if (ent.attackCooldown > 0) ent.attackCooldown--;
    }
}

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
            drop('web', ent.inCave ? 3 + Math.floor(Math.random() * 3) : 2);
            window.gainXP((ent.inCave ? 30 : 20) * ent.level);
            break;
        case 'bat':
            drop('meat', 1);
            window.gainXP(15 * ent.level);
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
        const bs   = window.game.blockSize;
        const base = window.getGroundY(cx);
        // Rechazar solo si la diferencia de altura es mayor a 2 bloques
        // en un radio de 2 bloques — colinas normales de 1-2 bloques de borde
        // son válidas para árboles y rocas.
        return Math.abs(window.getGroundY(cx - bs * 2) - base) > bs * 2 ||
               Math.abs(window.getGroundY(cx + bs * 2) - base) > bs * 2;
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

    // ── Plantas fluorescentes + murciélagos de cueva ─────────────────────────
    // Se pre-generan al crear el sector, determinísticamente (misma semilla = misma cueva).
    // Así ya están en el mundo esperando ser descubiertos, igual que Terraria.
    if (window.getUGCellV && window.getTerrainCol) {
        if (!window.cavePlants)   window.cavePlants   = [];
        if (!window.entities)     window.entities     = [];
        const _ugBs   = bs;
        const _startCol = Math.floor(startX / _ugBs);
        const _endCol   = Math.floor(endX   / _ugBs);
        const _maxDepth = window.UG_MAX_DEPTH || 50;
        const _distFactor = Math.max(1, Math.floor(distShore / 4000)); // profundidad → más vida

        for (let _gc = _startCol; _gc <= _endCol; _gc++) {
            const _gcd = window.getTerrainCol(_gc);
            if (!_gcd || _gcd.type === 'hole') continue;
            const _gtopY = _gcd.topY;

            for (let _gr = 1; _gr < _maxDepth; _gr++) {
                const _gmat = window.getUGCellV(_gc, _gr);
                if (_gmat !== 'air') continue;

                const _gBelow  = window.getUGCellV(_gc, _gr + 1);
                const _gAbove  = window.getUGCellV(_gc, _gr - 1);
                // Hash determinista de la celda (misma semilla siempre)
                const _gh = ((_gc * 374761393) ^ (_gr * 1103515245) ^ ((window.worldSeed||12345) * 6364136)) >>> 0;
                const _ghF = (_gh / 0xFFFFFFFF);
                const _gh2 = ((_gc * 48271) ^ (_gr * 16807) ^ ((window.worldSeed||12345) * 2654435761)) >>> 0;
                const _gh2F = (_gh2 / 0xFFFFFFFF);

                // ── Hongo fluorescente desde el suelo ──
                if (_gBelow !== 'air' && _gBelow !== 'bedrock' && _ghF < 0.025) {
                    const _pKey = `p_${_gc}_${_gr}`;
                    if (!window.cavePlants.some(p => p.key === _pKey)) {
                        window.cavePlants.push({
                            key: _pKey, col: _gc, row: _gr,
                            x: _gc * _ugBs + _ugBs * 0.15 + _ghF * _ugBs * 0.7,
                            y: _gtopY + _gr * _ugBs,
                            type: 'shroom',
                            variant: _gh % 3,
                            seed: _ghF,
                        });
                    }
                }
                // ── Musgo colgante del techo ──
                else if (_gAbove !== 'air' && _gAbove !== 'bedrock' && _ghF > 0.976) {
                    const _pKey = `p_${_gc}_${_gr}`;
                    if (!window.cavePlants.some(p => p.key === _pKey)) {
                        window.cavePlants.push({
                            key: _pKey, col: _gc, row: _gr,
                            x: _gc * _ugBs + _ugBs * 0.1 + _ghF * _ugBs * 0.8,
                            y: _gtopY + _gr * _ugBs,
                            type: 'moss',
                            seed: _ghF,
                        });
                    }
                }

                // ── Murciélago en techo de cueva ── (solo primer row de aire por columna)
                if (_gr >= 1 && _gAbove !== 'air' && _gh2F < (0.018 * _distFactor)) {
                    const _bId = `bat_${_gc}_${_gr}`;
                    if (!window.entities.some(e => e.id === _bId) && !window.killedEntities.includes(_bId)) {
                        const _bCeilY = _gtopY + _gr * _ugBs;
                        const _bLvl   = Math.max(1, _distFactor - 1 + (lvl > 1 ? 1 : 0));
                        const _bHp    = 10 + _bLvl * 5;
                        const _bX     = _gc * _ugBs + _ugBs * 0.4;
                        window.entities.push({
                            id: _bId, type: 'bat', name: 'Murciélago',
                            level: _bLvl, x: _bX, y: _bCeilY + 4,
                            width: 20, height: 12,
                            vx: 0, vy: 0,
                            hp: _bHp, maxHp: _bHp,
                            damage: 2 + _bLvl,
                            isHit: false, attackCooldown: 0,
                            stuckFrames: 0, ignorePlayer: 0, lastX: _bX,
                            batState: 'roost',
                            batAltY: _bCeilY + 4,
                            inCave: true,
                        });
                    }
                }
            }
        }
        // Limitar cavePlants total para no crecer sin fin
        if (window.cavePlants.length > 600) window.cavePlants.splice(0, window.cavePlants.length - 600);
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
    // ── Mapa espacial de bloques para LOS (O(1) lookup por celda de grilla) ──
    // Se reconstruye solo cuando el array de bloques cambia de tamaño
    // o periódicamente cada 60 frames para capturar cambios de estado (door open, etc).
    const bkLen = (window.blocks || []).length;
    const frame = window.game.frameCount || 0;
    if (!window._entBkMap || window._entBkMapLen !== bkLen || (frame & 63) === 0) {
        const bs  = window.game.blockSize;
        const map = new Map();
        for (const b of (window.blocks || [])) {
            if (b.type === 'ladder' || b.type === 'placed_torch' ||
                b.type === 'box'   || b.type === 'campfire'      ||
                b.type === 'bed'   || b.type === 'grave'         ||
                (b.type === 'door' && b.open)) continue;
            map.set(Math.floor(b.x / bs) + '_' + Math.floor(b.y / bs), b);
        }
        window._entBkMap    = map;
        window._entBkMapLen = bkLen;
    }

    const _camW  = window._canvasLogicW || 1280;
    const _cullX = (window.camera ? window.camera.x : pCX - _camW/2) - _camW * 0.6;
    const _cullR = _cullX + _camW * 2.2;

    for (let i = window.entities.length - 1; i >= 0; i--) {
        const ent = window.entities[i];

        // ── Muerte diferida ──
        if (ent.hp <= 0) {
            window.killedEntities.push(ent.id);
            window.sendWorldUpdate('kill_entity', { id: ent.id });
            window.spawnParticles(ent.x, ent.y, '#ff4444', 15);
            window.killEntityLoot(ent);
            window.entities.splice(i, 1);
            if (window.updateUI) window.updateUI();
            continue;
        }

        // ── Culling: skip físico/IA si está lejos de la cámara ──
        if (ent.x + ent.width < _cullX || ent.x > _cullR) {
            const _gYc = window.getGroundY ? window.getGroundY(ent.x + ent.width/2) : 9999;
            const _eColC = Math.floor((ent.x + ent.width*0.5) / window.game.blockSize);
            const _eCDc  = window.getTerrainCol ? window.getTerrainCol(_eColC) : null;
            const _eTopC = (_eCDc && _eCDc.type !== 'hole') ? _eCDc.topY : (window.game.baseGroundLevel||510);
            if ((ent.y + ent.height) < _eTopC + window.game.blockSize * 1.5 && _gYc < (window.game.baseGroundLevel||510) + 500) {
                ent.y = _gYc - ent.height; ent.vy = 0;
            }
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
        const hitWall = window.checkEntityCollisions(ent, 'x') |
                        (window.checkEntityUGCollisions ? window.checkEntityUGCollisions(ent, 'x') : false);
        if (ent.x < window.game.shoreX + 2000) { ent.x = window.game.shoreX + 2000; ent.vx = Math.abs(ent.vx); }

        ent.vy += window.game.gravity;
        ent.y  += ent.vy;
        window.checkEntityCollisions(ent, 'y');
        if (window.checkEntityUGCollisions) window.checkEntityUGCollisions(ent, 'y');

        const entGY = window.getGroundY ? window.getGroundY(ent.x + ent.width / 2) : window.game.groundLevel;
        // Solo snap superficial cuando la entidad está cerca de la superficie.
        // Bajo tierra, la gravedad y checkEntityCollisions la mantienen en el suelo de la cueva.
        const _eCol = Math.floor((ent.x + ent.width * 0.5) / window.game.blockSize);
        const _eCD  = window.getTerrainCol ? window.getTerrainCol(_eCol) : null;
        const _eTopY = (_eCD && _eCD.type !== 'hole') ? _eCD.topY : (window.game.baseGroundLevel || 510);
        const _eFeetNear = (ent.y + ent.height) < _eTopY + window.game.blockSize * 1.5;
        if (_eFeetNear) {
            if (ent.y + ent.height >= entGY)      { ent.y = entGY - ent.height; ent.vy = 0; }
            else if (ent.vy >= 0 && ent.y + ent.height >= entGY - 22) { ent.y = entGY - ent.height; ent.vy = 0; }
        }

        // isGrounded real: combina superficie Y celdas UG directamente bajo los pies
        let _entIsGrounded = (ent.y + ent.height >= entGY - 2);
        if (!_entIsGrounded && window.getUGCellV && window.getTerrainCol) {
            const _feetY = ent.y + ent.height;
            const _cL = Math.floor(ent.x / window.game.blockSize);
            const _cR = Math.floor((ent.x + ent.width - 1) / window.game.blockSize);
            for (let _cc = _cL; _cc <= _cR && !_entIsGrounded; _cc++) {
                const _cd2 = window.getTerrainCol(_cc);
                if (!_cd2 || _cd2.type === 'hole') continue;
                const _row = Math.floor((_feetY - _cd2.topY) / window.game.blockSize);
                if (_row >= 0) {
                    const _mat = window.getUGCellV(_cc, _row);
                    if (_mat && _mat !== 'air') _entIsGrounded = true;
                }
            }
        }
        // Cooldown de salto: evita spam de saltos en stuck detection
        if ((ent._jumpCooldown || 0) > 0) ent._jumpCooldown--;

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
            _updateEntityAI(ent, i, target, targetCX, targetCY, minDist, isDay, isNight, isHoldingTorch, hitWall, lastX, entGY, _entIsGrounded);
        }
    }
};

/** @private
 * Mira adelante en la dirección dirX y clasifica el obstáculo inmediato.
 * @returns {0|1|2}  0 = libre,  1 = escalón ≤ 1 bloque (la física lo sube sola),
 *                   2 = pared de 2+ bloques (el mob debe saltar para cruzarla)
 */
function _entObstacleAhead(ent, dirX) {
    const bs   = window.game.blockSize;
    const fY   = ent.y + ent.height;          // nivel de pies
    const hY   = ent.y;                        // nivel de cabeza
    // Punto de muestreo: 1px más allá del borde frontal del mob
    const chkX = ent.x + (dirX > 0 ? ent.width + 1 : -1);

    let topY = fY; // tope más alto encontrado (en Y decreciente = más arriba en pantalla)

    // ── Bloques construidos ──────────────────────────────────────────────────────
    for (const b of window.blocks) {
        if (b.type === 'ladder' || b.type === 'placed_torch' || b.type === 'stair') continue;
        if ((b.type === 'door' && b.open) || b.type === 'box' ||
            b.type === 'campfire' || b.type === 'bed' || b.type === 'grave') continue;
        const bh = b.type === 'door' ? bs * 2 : bs;
        if (chkX < b.x || chkX > b.x + bs) continue;
        if (b.y + bh <= hY - 2) continue;  // completamente encima de la cabeza
        if (b.y >= fY + 2) continue;        // completamente debajo de los pies
        if (b.y < topY) topY = b.y;
    }

    // ── Celdas UG ────────────────────────────────────────────────────────────────
    if (window.getUGCellV && window.getTerrainCol) {
        const col = Math.floor(chkX / bs);
        const cd  = window.getTerrainCol(col);
        if (cd && cd.type !== 'hole') {
            const r0 = Math.max(0, Math.floor((hY - cd.topY) / bs));
            const r1 = Math.floor((fY  - cd.topY) / bs) + 1;
            for (let r = r0; r <= r1; r++) {
                const mat = window.getUGCellV(col, r);
                if (!mat || mat === 'air') continue;
                const cy = cd.topY + r * bs;
                if (cy + bs <= hY - 2) continue;  // encima de la cabeza
                if (cy >= fY + 2) continue;        // debajo de los pies
                if (cy < topY) topY = cy;
            }
        }
    }

    const stepH = fY - topY;
    if (stepH <= 0)       return 0;  // camino libre
    if (stepH <= bs + 2)  return 1;  // escalón (física auto-step lo maneja)
    return 2;                        // pared: hay que saltar
}

// ─── Campo de visión y línea de visión ────────────────────────────────────────
//
// Cada mob tiene:
//   range      – distancia máxima de detección
//   halfAngle  – semiángulo del cono de visión (radianes desde el frente)
//   noise      – radio de detección por "sonido" (siempre activo, sin LOS)
//
// LOS: rayo desde el centro del mob hasta el centro del objetivo, paso de bs*0.55.
// Cualquier celda UG sólida (incluida la superficie) o bloque construido sólido lo bloquea.
// Efecto: mobs en superficie no ven a jugadores bajo tierra a no ser que haya un hueco minado.

/** @private – parámetros de FOV por tipo de mob */
function _entFOVInfo(ent, isNight) {
    switch (ent.type) {
        case 'zombie':  return { range: isNight ? 500 : 300, halfAngle: 1.14, noise: 55 }; // 130° cono
        case 'spider':  return { range: isNight ? 430 : 280, halfAngle: 1.40, noise: 50 }; // 160° cono
        case 'archer':  return { range: isNight ? 860 : 660, halfAngle: 1.75, noise: 55 }; // 200° cono
        case 'wolf':    return { range: isNight ? 600 : 400, halfAngle: 1.83, noise: 65 }; // 210° cono
        default:        return { range: 200, halfAngle: Math.PI, noise: 40 };
    }
}

/** @private – raycast de línea de visión; devuelve false si hay obstáculo sólido.
 *  PERFORMANCE: usa un lookup espacial de bloques en lugar de iterar todo el array. */
function _entLOS(x0, y0, x1, y1) {
    const bs    = window.game.blockSize;
    const dx    = x1 - x0, dy = y1 - y0;
    const dist  = Math.hypot(dx, dy);
    if (dist < 2) return true;
    const steps = Math.max(2, Math.ceil(dist / (bs * 0.6)));
    const sx    = dx / steps, sy = dy / steps;

    // Lookup espacial de bloques: construido una vez por frame cuando los bloques cambian.
    // _entBkMap: Map de 'gx_gy' → bloque (solo bloques sólidos para LOS)
    const bkMap = window._entBkMap;

    for (let i = 1; i < steps; i++) {
        const px = x0 + sx * i;
        const py = y0 + sy * i;

        // ── Bloques construidos sólidos (lookup O(1)) ────────────────────────
        if (bkMap) {
            const gx = Math.floor(px / bs);
            const gy = Math.floor(py / bs);
            const bk = bkMap.get(gx + '_' + gy);
            if (bk) {
                const bh = bk.type === 'door' ? bs * 2 : bs;
                if (px >= bk.x && px < bk.x + bs && py >= bk.y && py < bk.y + bh) return false;
            }
            // Comprobar también la celda de arriba para puertas (2 bloques alto)
            const bk2 = bkMap.get(gx + '_' + (gy - 1));
            if (bk2 && bk2.type === 'door' && !bk2.open) {
                if (px >= bk2.x && px < bk2.x + bs && py >= bk2.y && py < bk2.y + bs * 2) return false;
            }
        }

        // ── Celdas UG sólidas ────────────────────────────────────────────────
        if (window.getUGCellV && window.getTerrainCol) {
            const col = Math.floor(px / bs);
            const cd  = window.getTerrainCol(col);
            if (cd && cd.type !== 'hole') {
                const row = Math.floor((py - cd.topY) / bs);
                if (row >= 0) {
                    const mat = window.getUGCellV(col, row);
                    if (mat && mat !== 'air') return false;
                }
            }
        }
    }
    return true;
}

/**
 * @private
 * Devuelve true si la entidad puede ver el punto (tx, ty).
 * PERFORMANCE: cachea resultado por mob, re-evalúa cada 10 frames o si la
 * distancia cambió >30px (mob se movió mucho entre checks).
 */
function _entCanSeeTarget(ent, tx, ty, isNight) {
    const fov  = _entFOVInfo(ent, isNight);
    const cx   = ent.x + ent.width  / 2;
    const cy   = ent.y + ent.height / 2;
    const dist = Math.hypot(tx - cx, ty - cy);

    // Detección por ruido (siempre, sin LOS)
    if (dist <= fov.noise) return true;
    if (dist > fov.range)  return false;

    // Cache: si el resultado anterior es reciente y la posición no cambió mucho, reutilizar
    const frame = window.game.frameCount || 0;
    if (ent._losCache !== undefined &&
        frame - (ent._losCacheFrame || 0) < 10 &&
        Math.abs(ent._losCacheX - cx) < 32 &&
        Math.abs(ent._losCacheY - cy) < 32 &&
        Math.abs((ent._losCacheTX||0) - tx) < 32) {
        return ent._losCache;
    }

    // Actualizar dirección mirada
    if (ent.vx !== 0) ent._facing = ent.vx > 0 ? 1 : -1;
    const facing      = ent._facing || 1;
    const facingAngle = facing > 0 ? 0 : Math.PI;
    let angleDiff     = Math.abs(Math.atan2(ty - cy, tx - cx) - facingAngle);
    if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

    let result;
    if (angleDiff > fov.halfAngle) {
        result = false;
    } else {
        result = _entLOS(cx, cy, tx, ty);
    }

    // Guardar en cache
    ent._losCache      = result;
    ent._losCacheFrame = frame;
    ent._losCacheX     = cx;
    ent._losCacheY     = cy;
    ent._losCacheTX    = tx;
    return result;
}

/** @private */
function _updateEntityAI(ent, idx, target, targetCX, targetCY, minDist, isDay, isNight, isHoldingTorch, hitWall, lastX, entGY, isGrounded) {
    // isGrounded viene ya calculado desde el loop principal (incluye UG cells)
    if (isGrounded === undefined) isGrounded = ent.y + ent.height >= entGY - 2;

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
            : (ent.inCave || (isNight && !target.isStealth) ? 520 : 180);
        const hpPct      = ent.hp / ent.maxHp;
        const enraged    = (ent.enragedFrames || 0) > 0;
        const baseSpd    = ent.type === 'zombie' ? 0.45 : 1.05; // araña más rápida

        // ── Campo de visión ──────────────────────────────────────────────────
        const canSeeTarget = _entCanSeeTarget(ent, targetCX, targetCY, isNight);

        // Stamina: se drena en chase, se recarga en reposo
        if (ent.aiState === 'chase' || ent.aiState === 'flank') {
            ent.stamina = Math.max(0, ent.stamina - 0.2);
        } else {
            ent.stamina = Math.min(100, ent.stamina + 0.3);
        }
        if (ent.fleeCool > 0) ent.fleeCool--;

        // ── Huida de antorcha ─────────────────────────────────────────────────
        const repelTorch = isHoldingTorch && minDist < 250 && ent.level <= 3 && target === window.player;
        // Antorchas clavadas: ahuyentan a monstruos cuyo nivel ≤ nivel del jugador + 2
        const _playerLevel = window.player?.level || 1;
        let _placedTorchRepel = false;
        if (!repelTorch && window.blocks) {
            for (const _ptb of window.blocks) {
                if (_ptb.type !== 'placed_torch') continue;
                const _ptDist = Math.hypot((ent.x + ent.width/2) - (_ptb.x + (window.game?.blockSize||64)/2),
                                           (ent.y + ent.height/2) - (_ptb.y + (window.game?.blockSize||64)/2));
                if (_ptDist < 200 && ent.level <= _playerLevel + 2) { _placedTorchRepel = true; break; }
            }
        }
        if (repelTorch || _placedTorchRepel) {
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
        // Araña huye con HP < 28% o sin stamina. Zombie nunca huye.
        if (ent.type === 'spider') {
            if ((hpPct < 0.28 || ent.stamina <= 0) && ent.aiState !== 'flee') {
                ent.aiState = 'flee'; ent.fleeCool = hpPct < 0.28 ? 240 : 140;
                ent.ignorePlayer = ent.fleeCool;
            }
        }

        // ── Pérdida de visión → estado búsqueda ──────────────────────────────
        if (!canSeeTarget && ent.aiState !== 'flee') {
            // Si estaba persiguiendo, guardar última posición conocida
            if (ent.aiState === 'chase' || ent.aiState === 'flank' || ent.aiState === 'lunge') {
                if ((ent._lostTimer || 0) === 0) {
                    // Primera vez que pierde visión: guardar posición y arrancar timer
                    ent._lostX     = targetCX;
                    ent._lostY     = targetCY;
                    ent._lostTimer = 180; // 3 s a 60fps
                }
                ent.aiState = 'idle';
            }
            if ((ent._lostTimer || 0) > 0) {
                ent._lostTimer--;
                // Caminar despacio hacia la última posición conocida
                const lostDir = (ent._lostX || targetCX) > ent.x + ent.width / 2 ? 1 : -1;
                ent.vx = lostDir * baseSpd * 0.45;
                if (ent.attackCooldown > 0) ent.attackCooldown--;
                return;
            }
            // Sin visión y timer agotado: reposo total
            ent.aiState = 'idle'; ent.vx *= 0.85;
            if (ent.attackCooldown > 0) ent.attackCooldown--;
            return;
        }
        // Objetivo recuperado: limpiar timer de búsqueda
        if (canSeeTarget) ent._lostTimer = 0;

        if (ent.aiState === 'flee') {
            if (ent.fleeCool <= 0) ent.aiState = (canSeeTarget && minDist < aggroRange && ent.stamina > 40) ? 'chase' : 'idle';
        } else if (ent.ignorePlayer <= 0 && canSeeTarget && minDist < aggroRange) {
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
            if (isGrounded && (ent._jumpCooldown || 0) === 0 && _entObstacleAhead(ent, fd) === 2) {
                ent.vy = -8; ent._jumpCooldown = 18;
            }

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

            // ── Salto proactivo: detectar pared de 2+ bloques adelante cada frame ──
            // La física auto-escala escalones de 1 bloque; aquí sólo actuamos si la
            // pared es más alta y el mob REALMENTE necesita saltar para cruzarla.
            if (isGrounded && (ent._jumpCooldown || 0) === 0 && Math.abs(ent.vx) > 0.1) {
                if (_entObstacleAhead(ent, dirX) === 2) {
                    ent.vy = ent.type === 'zombie' ? -7 : -9;
                    ent._jumpCooldown = 20;
                    ent.stuckFrames   = 0;
                }
            }

            // ── Fallback de desatascado: por si el look-ahead falla (lags de física) ──
            if (hitWall || Math.abs(ent.x - lastX) < 0.4) {
                ent.stuckFrames = (ent.stuckFrames || 0) + 1;

                // Puerta cerrada: intentar abrir o saltar
                if (ent.stuckFrames > 3 && isGrounded && (ent._jumpCooldown || 0) === 0) {
                    const bs     = window.game.blockSize;
                    const checkX = ent.x + (dirX > 0 ? ent.width + 4 : -4);
                    const doorBlock = window.blocks.find(b => {
                        if (b.type !== 'door' || b.open) return false;
                        return checkX >= b.x && checkX <= b.x + bs &&
                               ent.y + ent.height >= b.y && ent.y <= b.y + bs * 2;
                    });
                    if (doorBlock) {
                        if (ent.attackCooldown <= 0 && (ent.type === 'zombie' || ent.type === 'wolf')) {
                            const dmg = ent.damage * 0.7;
                            doorBlock.hp = (doorBlock.hp || doorBlock.maxHp || 100) - dmg;
                            window.setHit(doorBlock);
                            window.spawnParticles(doorBlock.x + bs/2, doorBlock.y + bs, '#c8a050', 3, 0.4);
                            if (doorBlock.hp <= 0) window.destroyBlockLocally(doorBlock);
                            else window.sendWorldUpdate('hit_block', { x: doorBlock.x, y: doorBlock.y, dmg });
                            ent.attackCooldown = ent.type === 'zombie' ? 80 : 55;
                            ent.stuckFrames = Math.max(0, ent.stuckFrames - 10);
                        } else if (ent.stuckFrames > 12 && (ent._jumpCooldown || 0) === 0) {
                            ent.vy = -11; ent._jumpCooldown = 20;
                            ent.stuckFrames = Math.max(0, ent.stuckFrames - 12);
                        }
                    }
                }

                if (ent.stuckFrames > 8 && isGrounded && (ent._jumpCooldown || 0) === 0) {
                    ent.vy = ent.type === 'zombie' ? -7 : -9;
                    ent._jumpCooldown = 16;
                }

                // Romper bloque obstructor si lleva mucho tiempo bloqueado
                if (ent.stuckFrames > 18 && ent.attackCooldown <= 0) {
                    const bs = window.game.blockSize;
                    const checkX = ent.x + (dirX > 0 ? ent.width + 4 : -4);
                    const checkY = ent.y + ent.height / 2;
                    const obstacle = window.blocks.find(b => {
                        if (b.type === 'ladder' || b.type === 'stair' || b.type === 'placed_torch') return false;
                        const bh = b.type === 'door' ? bs * 2 : bs;
                        return checkX >= b.x && checkX <= b.x + bs &&
                               checkY >= b.y && checkY <= b.y + bh;
                    });
                    if (obstacle) {
                        const dmg = ent.damage * 0.6;
                        obstacle.hp = (obstacle.hp || obstacle.maxHp || 100) - dmg;
                        window.setHit(obstacle);
                        window.spawnParticles(obstacle.x + bs/2, obstacle.y + bs/2, '#c8a050', 3, 0.4);
                        if (obstacle.hp <= 0) window.destroyBlockLocally(obstacle);
                        else window.sendWorldUpdate('hit_block', { x: obstacle.x, y: obstacle.y, dmg });
                        ent.attackCooldown = ent.type === 'zombie' ? 90 : 60;
                        ent.stuckFrames = Math.max(0, ent.stuckFrames - 15);
                    }
                }

                if (ent.stuckFrames > 80) {
                    ent.aiState = 'roam'; ent.roamDir = -dirX;
                    ent.roamT   = 80; ent.ignorePlayer = 80; ent.stuckFrames = 0;
                }
            } else { ent.stuckFrames = 0; }

            // ── Melee al jugador ──────────────────────────────────────────────
            if (minDist < 40 && ent.attackCooldown <= 0 && !target.isDead) {
                if (target === window.player) {
                    window.damagePlayer(ent.damage, ent.name);
                } else if (target && target.type === 'turret') {
                    target.hp -= ent.damage;
                    window.setHit(target);
                    window.spawnParticles(target.x + 15, target.y + 15, '#f0c020', 5);
                    if (target.hp <= 0) window.destroyBlockLocally(target);
                    else window.sendWorldUpdate('hit_block', { x: target.x, y: target.y, dmg: ent.damage });
                }
                ent.attackCooldown = ent.type === 'zombie' ? 150 : 80;
            }

            // ── Si el jugador está elevado: atacar bloques bajo sus pies ──────
            const playerElevated = target.y < ent.y - window.game.blockSize * 1.5;
            if (playerElevated && ent.attackCooldown <= 0 && Math.abs(target.x - ent.x) < 60) {
                const bs = window.game.blockSize;
                // Buscar bloque de suelo/plataforma debajo del jugador
                const support = window.blocks.find(b => {
                    if (b.type === 'ladder' || b.type === 'stair' || b.type === 'placed_torch') return false;
                    return Math.abs((b.x + bs/2) - (target.x + (target.width||20)/2)) < bs &&
                           b.y > ent.y && b.y < target.y + 10;
                });
                if (support) {
                    const dmg = ent.damage * 0.5;
                    support.hp = (support.hp || support.maxHp || 100) - dmg;
                    window.setHit(support);
                    window.spawnParticles(support.x + bs/2, support.y, '#c8a050', 3, 0.4);
                    if (support.hp <= 0) window.destroyBlockLocally(support);
                    else window.sendWorldUpdate('hit_block', { x: support.x, y: support.y, dmg });
                    ent.attackCooldown = ent.type === 'zombie' ? 120 : 70;
                }
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

        // ── Campo de visión ──────────────────────────────────────────────────
        const canSeeTarget = _entCanSeeTarget(ent, targetCX, targetCY, isNight);

        // ── Estados ───────────────────────────────────────────────────────────
        if (hpPct < 0.25 && ent.aiState !== 'flee') {
            ent.aiState = 'flee'; ent.fleeCool = 200; ent.ignorePlayer = 200;
        }
        if (ent.aiState === 'flee') {
            if (ent.fleeCool <= 0) ent.aiState = (canSeeTarget && minDist < aggroRange) ? 'kite' : 'idle';
        } else if (!canSeeTarget && ent.aiState !== 'idle') {
            // Pérdida de visión durante kite
            if ((ent._lostTimer || 0) === 0) { ent._lostX = targetCX; ent._lostTimer = 150; }
            ent._lostTimer--;
            const lostDir = (ent._lostX || targetCX) > ent.x + ent.width / 2 ? 1 : -1;
            ent.vx = lostDir * 0.5;
            ent.aiState = 'idle';
            if (ent.attackCooldown > 0) ent.attackCooldown--;
            return;
        } else if (canSeeTarget && minDist < aggroRange && ent.ignorePlayer <= 0 && !target.inBackground && !target.isDead) {
            ent._lostTimer = 0;
            ent.aiState = 'kite';
        } else if (ent.aiState !== 'flee') {
            if (canSeeTarget) ent._lostTimer = 0;
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
            if (isGrounded && (ent._jumpCooldown || 0) === 0 && _entObstacleAhead(ent, fd) === 2) {
                ent.vy = -8; ent._jumpCooldown = 18;
            }

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

            // Salto proactivo de pared
            if (isGrounded && (ent._jumpCooldown || 0) === 0 && Math.abs(ent.vx) > 0.1) {
                const _mvDir = ent.vx > 0 ? 1 : -1;
                if (_entObstacleAhead(ent, _mvDir) === 2) {
                    ent.vy = -7; ent._jumpCooldown = 20; ent.stuckFrames = 0;
                }
            }

            // Fallback de desatascado
            if (hitWall || (Math.abs(ent.x - lastX) < 0.1 && Math.abs(ent.vx) > 0.05)) {
                ent.stuckFrames = (ent.stuckFrames || 0) + 1;
                if (ent.stuckFrames > 8 && isGrounded && (ent._jumpCooldown || 0) === 0) {
                    ent.vy = -7; ent.stuckFrames = 0; ent._jumpCooldown = 16;
                }
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

    else if (ent.type === 'bat') {
        // ── Murciélago: duerme en el techo, se lanza en picado cuando el jugador se acerca ──
        if (!ent.batState) { ent.batState = 'roost'; ent.batAltY = ent.y; }
        const _batDist = Math.hypot(targetCX - (ent.x + ent.width/2), targetCY - (ent.y + ent.height/2));
        const _batAggroRange = 280;

        if (ent.batState === 'roost') {
            ent.vx *= 0.5;
            ent.vy  = 0;
            ent.y   = ent.batAltY;
            if (_batDist < _batAggroRange && (ent.ignorePlayer||0) <= 0) {
                ent.batState = 'swoop';
                ent.batTimer = 0;
            }
        } else if (ent.batState === 'swoop') {
            ent.batTimer = (ent.batTimer || 0) + 1;
            const _tdx = targetCX - (ent.x + ent.width/2);
            const _tdy = targetCY - (ent.y + ent.height/2);
            const _tdist = Math.hypot(_tdx, _tdy) || 1;
            ent.vx += (_tdx / _tdist) * 0.35;
            ent.vy += (_tdy / _tdist) * 0.25;
            const _spd = Math.hypot(ent.vx, ent.vy);
            if (_spd > 3.5) { ent.vx = ent.vx/_spd*3.5; ent.vy = ent.vy/_spd*3.5; }
            if (_batDist < 22 && (ent.attackCooldown||0) <= 0) {
                window.damagePlayer(ent.damage, 'murciélago');
                ent.attackCooldown = 60;
                ent.batState = 'flee';
                ent.batTimer = 0;
            }
            if (ent.batTimer > 120) { ent.batState = 'flee'; ent.batTimer = 0; }
        } else if (ent.batState === 'flee') {
            ent.batTimer = (ent.batTimer||0) + 1;
            ent.vy -= 0.18;
            ent.vx *= 0.92;
            if (ent.batTimer > 80 || ent.y <= ent.batAltY + 10) {
                ent.batState = 'roost';
                ent.vy = 0;
                ent.y  = ent.batAltY;
                ent.attackCooldown = 90;
            }
        }
        ent.x += ent.vx;
        ent.y += ent.vy;
        ent.x = Math.max(window.game.shoreX || 0, ent.x);
        if (ent.attackCooldown > 0) ent.attackCooldown--;
        if ((ent.ignorePlayer||0) > 0) ent.ignorePlayer--;
        return;
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
        // ── Campo de visión (lobo) ───────────────────────────────────────────
        const canSeeTarget = _entCanSeeTarget(ent, targetCX, targetCY, isNight);

        // Antorchas clavadas también ahuyentan lobos si nivel ≤ player+2
        const _pLvlW = window.player?.level || 1;
        let _ptRepelWolf = false;
        if (!repelTorch && window.blocks) {
            for (const _ptb2 of window.blocks) {
                if (_ptb2.type !== 'placed_torch') continue;
                const _ptd2 = Math.hypot((ent.x+ent.width/2)-(_ptb2.x+(window.game?.blockSize||64)/2),
                                          (ent.y+ent.height/2)-(_ptb2.y+(window.game?.blockSize||64)/2));
                if (_ptd2 < 200 && ent.level <= _pLvlW + 2) { _ptRepelWolf = true; break; }
            }
        }

        // ── Huida del fuego (override de cualquier estado) ──────────────────
        if (repelTorch || _ptRepelWolf) {
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

            // Detectar jugador → stalk (solo si hay visión directa)
            if (canSeeTarget && minDist < aggroRange && !target.isDead) {
                ent.wolfState     = 'stalk';
                ent.wolfStateTimer = 0;
            }

        } else if (ent.wolfState === 'stalk') {
            // ── Pérdida de visión en stalk ───────────────────────────────────
            if (!canSeeTarget) {
                if ((ent._lostTimer || 0) === 0) { ent._lostX = targetCX; ent._lostTimer = 180; }
                ent._lostTimer--;
                const lostDir = (ent._lostX || targetCX) > ent.x + ent.width / 2 ? 1 : -1;
                ent.vx = lostDir * 0.4;
                if (ent._lostTimer <= 0) { ent.wolfState = 'patrol'; ent._lostTimer = 0; }
                if (ent.attackCooldown > 0) ent.attackCooldown--;
                return;
            }
            ent._lostTimer = 0;

            // Acercarse cautelosamente hasta ~100px, manteniendo manada junta
            const dirX    = target.x > ent.x ? 1 : -1;
            const stalkSpd = 0.75 * packBonus;

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

            // Salto proactivo de pared
            if (isGrounded && (ent._jumpCooldown || 0) === 0 && Math.abs(ent.vx) > 0.1) {
                if (_entObstacleAhead(ent, dirX) === 2) {
                    ent.vy = -10; ent._jumpCooldown = 20; ent.stuckFrames = 0;
                }
            }

            // Fallback de desatascado
            if (hitWall || Math.abs(ent.x - lastX) < 0.4) {
                ent.stuckFrames = (ent.stuckFrames || 0) + 1;

                // Puerta → intentar romperla (lobo) o saltar
                if (ent.stuckFrames > 3 && isGrounded && (ent._jumpCooldown || 0) === 0) {
                    const bs     = window.game.blockSize;
                    const checkX = ent.x + (dirX > 0 ? ent.width + 4 : -4);
                    const doorBlock = window.blocks.find(b => {
                        if (b.type !== 'door' || b.open) return false;
                        return checkX >= b.x && checkX <= b.x + bs &&
                               ent.y + ent.height >= b.y && ent.y <= b.y + bs * 2;
                    });
                    if (doorBlock && ent.attackCooldown <= 0) {
                        const dmg = ent.damage * 0.6;
                        doorBlock.hp = (doorBlock.hp || doorBlock.maxHp || 100) - dmg;
                        window.setHit(doorBlock);
                        window.spawnParticles(doorBlock.x + bs/2, doorBlock.y + bs, '#c8a050', 3, 0.4);
                        if (doorBlock.hp <= 0) window.destroyBlockLocally(doorBlock);
                        else window.sendWorldUpdate('hit_block', { x: doorBlock.x, y: doorBlock.y, dmg });
                        ent.attackCooldown = 55;
                        ent.stuckFrames = Math.max(0, ent.stuckFrames - 10);
                    } else if (doorBlock && ent.stuckFrames > 12 && (ent._jumpCooldown || 0) === 0) {
                        ent.vy = -12; ent._jumpCooldown = 20; ent.stuckFrames = Math.max(0, ent.stuckFrames - 12);
                    }
                }

                if (ent.stuckFrames > 8 && isGrounded && (ent._jumpCooldown || 0) === 0) {
                    ent.vy = -10; ent._jumpCooldown = 16;
                }
                if (ent.stuckFrames > 70) {
                    // Abandonar target, retroceder y revaluar
                    ent.wolfState      = 'cooldown';
                    ent.wolfStateTimer = 60;
                    const dX           = target.x > ent.x ? 1 : -1;
                    ent.vx             = -dX * 1.5;
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
                const chargeSpd = (1.4 + nearMates.length * 0.15) * packBonus;
                ent.vx = dirX * chargeSpd;

                // Salto proactivo de pared durante la carga
                if (isGrounded && (ent._jumpCooldown || 0) === 0 && Math.abs(ent.vx) > 0.1) {
                    if (_entObstacleAhead(ent, dirX) === 2) {
                        ent.vy = -10; ent._jumpCooldown = 20; ent.stuckFrames = 0;
                    }
                }

                // Fallback de desatascado en carga
                if ((hitWall || Math.abs(ent.x - lastX) < 0.4) && isGrounded) {
                    ent.stuckFrames = (ent.stuckFrames || 0) + 1;
                    if (ent.stuckFrames > 6 && (ent._jumpCooldown || 0) === 0) {
                        ent.vy = -10; ent._jumpCooldown = 18; ent.stuckFrames = 0;
                    }
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

                    // Velocidad horizontal del salto: moderada
                    const leapVX = dirX * Math.min(Math.abs(dx) * 0.2 + chargeSpd + 0.8, 6);

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

        // Reset global si pierde al jugador (sin LOS y fuera de rango)
        if (!canSeeTarget && minDist > aggroRange + 200 && ent.wolfState !== 'patrol') {
            ent.wolfState = 'patrol'; ent.wolfStateTimer = 0; ent._lostTimer = 0;
        }

        if (ent.attackCooldown > 0) ent.attackCooldown--;
    }
}

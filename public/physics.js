// === physics.js - COLISIONES, ESCALERAS Y VALIDACIÓN DE PLACEMENT ===
// Extraído de game.js. Depende de: window.game, window.player, window.blocks,
// window.trees, window.rocks, window.otherPlayers, window.getGroundY,
// window.checkRectIntersection

// ─── Colisiones jugador ────────────────────────────────────────────────────────

/**
 * Resuelve colisiones del jugador contra bloques sólidos en un eje dado.
 * Llamar primero con 'x', luego mover en Y, luego con 'y'.
 * @param {'x'|'y'} axis
 */
window.checkBlockCollisions = function (axis) {
    if (window.player.inBackground) return;
    const p  = window.player;
    const bs = window.game.blockSize;

    for (const b of window.blocks) {
        if (
            (b.type === 'door' && b.open) ||
            b.type === 'box'      || b.type === 'campfire' ||
            b.type === 'bed'      || b.type === 'grave'    ||
            b.type === 'barricade'|| b.type === 'ladder'
        ) continue;

        const itemHeight = b.type === 'door' ? bs * 2 : bs;

        // ── Escalones: solo colisionar en eje Y cuando el jugador viene cayendo
        //    y su centro X está dentro del ancho del escalón
        if (b.type === 'stair') {
            if (axis !== 'y') continue;
            if (p.vy <= 0) continue; // solo caída
            const pCX = p.x + p.width / 2;
            if (pCX < b.x || pCX > b.x + bs) continue;
            // Calcular altura de rampa en la posición del jugador
            const relX = pCX - b.x;
            const frac = b.facingRight ? (relX / bs) : (1 - relX / bs);
            const rampY = b.y + bs - frac * bs;
            // Solo detener si el jugador iba a cruzar la superficie de la rampa
            if (p.y + p.height >= rampY && p.y + p.height <= rampY + p.vy + 4) {
                p.y = rampY - p.height;
                p.vy = 0;
                p.isGrounded = true;
            }
            continue;
        }

        // En eje Y usamos rectángulo más estrecho para evitar clip en esquinas
        const checkX = axis === 'y' ? p.x + 2   : p.x;
        const checkW = axis === 'y' ? p.width - 4 : p.width;

        if (!window.checkRectIntersection(checkX, p.y, checkW, p.height, b.x, b.y, bs, itemHeight)) continue;

        if (axis === 'x') {
            if (p.y + p.height <= b.y + 14) continue;   // step-over sin clip
            if (p.vx > 0)      p.x = b.x - p.width - 0.1;
            else if (p.vx < 0) p.x = b.x + bs + 0.1;
            p.vx = 0;
        } else {
            if (p.vy > 0) { p.y = b.y - p.height; p.vy = 0; p.isGrounded = true; }
            else if (p.vy < 0) { p.y = b.y + itemHeight + 0.1; p.vy = 0; }
        }
    }
};

/**
 * Comprueba si hay un bloque sólido justo encima del jugador dentro de `margin` px.
 * Se usa antes de aplicar el salto para evitar atravesar techos.
 * @param {number} margin
 * @returns {boolean}
 */
window.hasCeilingAbove = function (margin) {
    if (window.player.inBackground) return false;
    const p  = window.player;
    const bs = window.game.blockSize;
    // Rectángulo de búsqueda: mismo ancho del jugador (ligeramente reducido), margin px encima
    const cx = p.x + 2;
    const cw = p.width - 4;
    const cy = p.y - margin;
    const ch = margin;

    for (const b of window.blocks) {
        if (
            (b.type === 'door' && b.open) ||
            b.type === 'box'       || b.type === 'campfire' ||
            b.type === 'bed'       || b.type === 'grave'    ||
            b.type === 'barricade' || b.type === 'ladder'   ||
            b.type === 'stair'
        ) continue;
        const bh = b.type === 'door' ? bs * 2 : bs;
        if (window.checkRectIntersection(cx, cy, cw, ch, b.x, b.y, bs, bh)) return true;
    }
    return false;
};

/**
 * Resuelve colisiones de una entidad contra bloques sólidos.
 * @param {object} ent
 * @param {'x'|'y'} axis
 * @returns {boolean} hitWall
 */
window.checkEntityCollisions = function (ent, axis) {
    let hitWall = false;
    const bs = window.game.blockSize;

    for (let i = window.blocks.length - 1; i >= 0; i--) {
        const b = window.blocks[i];
        if (
            (b.type === 'door' && b.open) ||
            b.type === 'box'   || b.type === 'campfire' ||
            b.type === 'bed'   || b.type === 'grave'
        ) continue;

        const itemHeight = b.type === 'door' ? bs * 2 : bs;
        if (!window.checkRectIntersection(ent.x, ent.y, ent.width, ent.height, b.x, b.y, bs, itemHeight)) continue;

        if (axis === 'x') {
            if (ent.y + ent.height <= b.y + 12) continue;

            // Escalón: hacer snap directo de la rampa en vez de saltar
            if (b.type === 'stair') {
                const relX  = (ent.x + ent.width / 2) - b.x;
                const frac  = b.facingRight ? (relX / bs) : (1 - relX / bs);
                const clampedFrac = Math.max(0, Math.min(1, frac));
                const rampY = b.y + bs - clampedFrac * bs;
                const footY = ent.y + ent.height;
                // Si el pie está dentro del rango subible de la rampa, snapear directo
                if (footY >= rampY - bs && footY <= rampY + 4) {
                    ent.y  = rampY - ent.height;
                    ent.vy = 0;
                }
                // No rebotar nunca en escalones
                continue;
            }

            if (ent.vx > 0)      { ent.x = b.x - ent.width; ent.vx *= -1; hitWall = true; }
            else if (ent.vx < 0) { ent.x = b.x + bs;        ent.vx *= -1; hitWall = true; }

            // Entidades atacan puertas (zombie, spider, wolf, archer)
            if ((ent.type === 'zombie' || ent.type === 'spider' || ent.type === 'wolf' || ent.type === 'archer') && b.type === 'door') {
                if (window.game.frameCount % 40 === 0) {
                    const dmgD = ent.type === 'wolf' ? 25 : (ent.type === 'archer' ? 10 : 20);
                    b.hp -= dmgD;
                    window.setHit(b);
                    window.spawnParticles(b.x + 10, b.y + 10, '#ff4444', 5);
                    if (b.hp <= 0) window.destroyBlockLocally(b);
                    else window.sendWorldUpdate('hit_block', { x: b.x, y: b.y, dmg: dmgD });
                }
            }

            // Entidades atacan barricadas y reciben daño
            if ((ent.type === 'spider' || ent.type === 'zombie' || ent.type === 'wolf') && b.type === 'barricade') {
                if (window.game.frameCount % 40 === 0) {
                    const dmgB = ent.type === 'wolf' ? 20 : (ent.type === 'spider' ? 8 : 15);
                    const dmgE = ent.type === 'wolf' ? 2  : (ent.type === 'spider' ? 6 : 4);
                    b.hp -= dmgB; window.setHit(b);
                    window.spawnParticles(b.x + 15, b.y + 15, '#ff4444', 4);
                    if (b.hp <= 0) window.destroyBlockLocally(b);
                    else window.sendWorldUpdate('hit_block', { x: b.x, y: b.y, dmg: dmgB });
                    ent.hp -= dmgE; window.setHit(ent);
                    window.spawnParticles(ent.x + ent.width / 2, ent.y + ent.height / 2, '#ffa500', 3);
                    window.spawnDamageText(ent.x + ent.width / 2, ent.y - 4, `-${dmgE}`, 'melee');
                }
                hitWall = true;
            }
        } else {
            if (ent.vy > 0)      { ent.y = b.y - ent.height;    ent.vy = 0; }
            else if (ent.vy < 0) { ent.y = b.y + itemHeight;    ent.vy = 0; }
        }
    }
    return hitWall;
};

// ─── Rampas de escalones ───────────────────────────────────────────────────────

/** Aplica snap de rampa al jugador. Llamar tras checkBlockCollisions('y'). */
window.applyStairPhysicsPlayer = function () {
    if (window.player.isDead || window.player.inBackground) return;
    const p  = window.player;
    const bs = window.game.blockSize;

    for (const b of window.blocks) {
        if (b.type !== 'stair') continue;

        const pCX  = p.x + p.width / 2;
        const relX = pCX - b.x;
        if (relX < 0 || relX > bs) continue;

        // El jugador tiene que estar dentro del rango vertical del bloque
        if (p.y + p.height < b.y - 4)  continue;   // muy arriba
        if (p.y > b.y + bs + 4)        continue;   // muy abajo

        const frac  = b.facingRight ? (relX / bs) : (1 - relX / bs);
        const rampY = b.y + bs - frac * bs;        // Y de la superficie en este punto
        const footY = p.y + p.height;

        // Ventana de snap: el pie tiene que estar cerca de la superficie de la rampa
        // Tolerancia superior ajustada (era bs*0.85, muy permisiva):
        // - arriba: 6px para suavizar la subida
        // - abajo: 12px para no penetrar al caer rápido
        if (footY < rampY - 6 || footY > rampY + 12) continue;

        // No aplicar snap si el jugador está saltando hacia arriba (evita pegar al techo)
        if (p.vy < -1) continue;

        const newY = rampY - p.height;

        // Verificar que no penetra en bloque sólido al hacer snap
        const blocked = window.blocks.some(d => {
            if (d === b) return false;
            if ((d.type === 'door' && d.open) || d.type === 'ladder' || d.type === 'stair') return false;
            const dh = d.type === 'door' ? bs * 2 : bs;
            return window.checkRectIntersection(p.x + 1, newY, p.width - 2, p.height, d.x, d.y, bs, dh);
        });

        if (!blocked) {
            p.y  = newY;
            p.vy = 0;
            p.isGrounded = true;
        }
    }
};

/** Aplica snap de rampa a una entidad. */
window.applyStairPhysicsEntity = function (ent) {
    if (Math.abs(ent.vx) <= 0.05) return;
    const bs = window.game.blockSize;

    for (const b of window.blocks) {
        if (b.type !== 'stair') continue;
        const relX = (ent.x + ent.width / 2) - b.x;
        if (relX < 0 || relX > bs) continue;
        if (ent.y + ent.height < b.y - 2 || ent.y + ent.height > b.y + bs + 4) continue;

        const frac  = b.facingRight ? (relX / bs) : (1 - relX / bs);
        const rampY = b.y + bs - frac * bs;
        const footY = ent.y + ent.height;

        if (footY >= rampY - 2 && footY <= rampY + bs * 0.8) {
            ent.y  = rampY - ent.height;
            ent.vy = 0;
        }
    }
};

// ─── Escalera ─────────────────────────────────────────────────────────────────

/** @returns {boolean} */
window.isOnLadder = function () {
    const pCX = window.player.x + window.player.width / 2;
    const bs  = window.game.blockSize;
    return window.blocks.some(b =>
        b.type === 'ladder' &&
        pCX >= b.x && pCX <= b.x + bs &&
        window.player.y + window.player.height > b.y &&
        window.player.y < b.y + bs
    );
};

// ─── Validación de placement ───────────────────────────────────────────────────

/** @returns {boolean} */
window.isOverlappingSolidBlock = function () {
    const bs = window.game.blockSize;
    for (const b of window.blocks) {
        if (
            (b.type === 'door' && b.open) ||
            b.type === 'box'       || b.type === 'campfire' ||
            b.type === 'bed'       || b.type === 'grave'    ||
            b.type === 'barricade' || b.type === 'ladder'   ||
            b.type === 'stair'
        ) continue;
        const h = b.type === 'door' ? bs * 2 : bs;
        if (window.checkRectIntersection(window.player.x, window.player.y, window.player.width, window.player.height, b.x, b.y, bs, h)) return true;
    }
    return false;
};

/** @returns {boolean} */
window.isAdjacentToBlockOrGround = function (x, y, w, h) {
    const bs          = window.game.blockSize;
    const groundGridY = Math.ceil((window.getGroundY ? window.getGroundY(x + w / 2) : window.game.groundLevel) / bs) * bs;

    if (y + h >= groundGridY) return true;

    for (const b of window.blocks) {
        if (b.type === 'campfire' || b.type === 'bed' || b.type === 'grave') continue;
        const bh = b.type === 'door' ? bs * 2 : bs;
        if (window.checkRectIntersection(x - 2, y - 2, w + 4, h + 4, b.x, b.y, bs, bh)) return true;
    }
    return false;
};

/**
 * Valida si una celda es un lugar válido para colocar un bloque/objeto.
 * @param {number} x @param {number} y @param {number} w @param {number} h
 * @param {boolean} [requireAdjacency=true]
 * @param {boolean} [isStructure=false] — true para block/door/stair
 * @returns {boolean}
 */
window.isValidPlacement = function (x, y, w, h, requireAdjacency = true, isStructure = false) {
    const bs          = window.game.blockSize;
    const groundGridY = Math.ceil((window.getGroundY ? window.getGroundY(x + w / 2) : window.game.groundLevel) / bs) * bs;
    const absMaxY     = window.game.baseGroundLevel + 3 * bs;

    if (y > groundGridY)   return false;
    if (y + h > absMaxY)   return false;

    if (window.checkRectIntersection(x, y, w, h, window.player.x, window.player.y, window.player.width, window.player.height)) return false;

    if (window.game.isMultiplayer && window.otherPlayers) {
        for (const id in window.otherPlayers) {
            const op = window.otherPlayers[id];
            if (window.checkRectIntersection(x, y, w, h, op.x, op.y, op.width || 24, op.height || 40)) return false;
        }
    }

    const isItem = !isStructure;
    const isDoor = isStructure && h > bs;

    if (isDoor) {
        const gyL = Math.ceil((window.getGroundY ? window.getGroundY(x - bs / 2)      : window.game.groundLevel) / bs) * bs;
        const gyR = Math.ceil((window.getGroundY ? window.getGroundY(x + bs + bs / 2) : window.game.groundLevel) / bs) * bs;
        if (gyL < y + h || gyR < y + h) return false;
        const lBlocked = window.blocks.some(b => !['ladder','campfire','bed','grave'].includes(b.type) && Math.abs(b.x - (x - bs)) < 1 && b.y < y + h && b.y + bs > y);
        const rBlocked = window.blocks.some(b => !['ladder','campfire','bed','grave'].includes(b.type) && Math.abs(b.x - (x + bs)) < 1 && b.y < y + h && b.y + bs > y);
        if (lBlocked && rBlocked) return false;
    }

    if (isItem || isDoor) {
        const supported =
            y + h >= groundGridY ||
            window.blocks.some(b =>
                (b.type === 'block' || b.type === 'ladder' || b.type === 'stair') &&
                Math.abs(b.x - x) < 1 &&
                Math.abs(b.y - (y + h)) < bs / 2
            );
        if (!supported) return false;
    }

    for (const b of window.blocks) {
        if (b.type === 'ladder') continue;
        const bh = b.type === 'door' ? bs * 2 : bs;
        if (b.type === 'door' && !isDoor && Math.abs(b.x - x) < 1 && Math.abs(b.y - (y + h)) < 1) continue;
        if (window.checkRectIntersection(x, y, w, h, b.x, b.y, bs, bh)) return false;

        const hAdj = Math.abs(x - (b.x - bs)) < 1 || Math.abs(x - (b.x + bs)) < 1;
        const vOvl = y < b.y + bh && y + h > b.y;
        if (hAdj && vOvl && (isDoor || b.type === 'door')) return false;
        if (isDoor && b.type === 'door' && Math.abs(b.x - x) < 1 && (Math.abs(b.y - (y + h)) < 1 || Math.abs((b.y + bh) - y) < 1)) return false;
        if (isItem && ['box','campfire','bed','grave','barricade'].includes(b.type) && Math.abs(b.x - x) < bs && Math.abs(b.y - (y + h)) < 1) return false;
    }

    for (const t of window.trees) {
        const tFY = window.getGroundY ? window.getGroundY(t.x + t.width / 2) : (t.groundY || t.y + t.height);
        const th  = t.isStump ? 80 : t.height;
        if (window.checkRectIntersection(x, y, w, h, t.x, tFY - th, t.width, th)) return false;
    }

    for (const r of window.rocks) {
        const rFY = window.getGroundY ? window.getGroundY(r.x + r.width / 2) : (r.y + r.height);
        if (window.checkRectIntersection(x, y, w, h, r.x, rFY - r.height, r.width, r.height)) return false;
    }

    if (requireAdjacency && !window.isAdjacentToBlockOrGround(x, y, w, h)) return false;
    return true;
};
// Extraído de game.js. Depende de: window.game, window.player, window.blocks,
// window.trees, window.rocks, window.otherPlayers, window.getGroundY,
// window.checkRectIntersection

// ─── Colisiones jugador ────────────────────────────────────────────────────────

/**
 * Resuelve colisiones del jugador contra bloques sólidos en un eje dado.
 * Llamar primero con 'x', luego mover en Y, luego con 'y'.
 * @param {'x'|'y'} axis
 */
window.checkBlockCollisions = function (axis) {
    if (window.player.inBackground) return;
    const p  = window.player;
    const bs = window.game.blockSize;

    for (const b of window.blocks) {
        if (
            (b.type === 'door' && b.open) ||
            b.type === 'box'      || b.type === 'campfire' ||
            b.type === 'bed'      || b.type === 'grave'    ||
            b.type === 'barricade'|| b.type === 'ladder'   ||
            b.type === 'stair'
        ) continue;

        const itemHeight = b.type === 'door' ? bs * 2 : bs;
        // En eje Y usamos rectángulo más estrecho para evitar clip en esquinas
        const checkX = axis === 'y' ? p.x + 2   : p.x;
        const checkW = axis === 'y' ? p.width - 4 : p.width;

        if (!window.checkRectIntersection(checkX, p.y, checkW, p.height, b.x, b.y, bs, itemHeight)) continue;

        if (axis === 'x') {
            if (p.y + p.height <= b.y + 14) continue;   // step-over sin clip
            if (p.vx > 0)      p.x = b.x - p.width - 0.1;
            else if (p.vx < 0) p.x = b.x + bs + 0.1;
            p.vx = 0;
        } else {
            if (p.vy > 0) { p.y = b.y - p.height; p.vy = 0; p.isGrounded = true; }
            else if (p.vy < 0) { p.y = b.y + itemHeight + 0.1; p.vy = 0; }
        }
    }
};

/**
 * Resuelve colisiones de una entidad contra bloques sólidos.
 * @param {object} ent
 * @param {'x'|'y'} axis
 * @returns {boolean} hitWall
 */
window.checkEntityCollisions = function (ent, axis) {
    let hitWall = false;
    const bs = window.game.blockSize;

    for (let i = window.blocks.length - 1; i >= 0; i--) {
        const b = window.blocks[i];
        if (
            (b.type === 'door' && b.open) ||
            b.type === 'box'   || b.type === 'campfire' ||
            b.type === 'bed'   || b.type === 'grave'    ||
            b.type === 'stair'
        ) continue;

        const itemHeight = b.type === 'door' ? bs * 2 : bs;
        if (!window.checkRectIntersection(ent.x, ent.y, ent.width, ent.height, b.x, b.y, bs, itemHeight)) continue;

        if (axis === 'x') {
            if (ent.y + ent.height <= b.y + 12) continue;
            if (ent.vx > 0)      { ent.x = b.x - ent.width; ent.vx *= -1; hitWall = true; }
            else if (ent.vx < 0) { ent.x = b.x + bs;        ent.vx *= -1; hitWall = true; }

            // Entidades atacan puertas
            if ((ent.type === 'zombie' || ent.type === 'spider') && b.type === 'door') {
                if (window.game.frameCount % 40 === 0) {
                    b.hp -= 20;
                    window.setHit(b);
                    window.spawnParticles(b.x + 10, b.y + 10, '#ff4444', 5);
                    if (b.hp <= 0) window.destroyBlockLocally(b);
                    else window.sendWorldUpdate('hit_block', { x: b.x, y: b.y, dmg: 20 });
                }
            }

            // Entidades atacan barricadas y reciben daño
            if ((ent.type === 'spider' || ent.type === 'zombie') && b.type === 'barricade') {
                if (window.game.frameCount % 40 === 0) {
                    const dmgB = ent.type === 'spider' ? 8 : 15;
                    const dmgE = ent.type === 'spider' ? 6 : 4;
                    b.hp -= dmgB; window.setHit(b);
                    window.spawnParticles(b.x + 15, b.y + 15, '#ff4444', 4);
                    if (b.hp <= 0) window.destroyBlockLocally(b);
                    else window.sendWorldUpdate('hit_block', { x: b.x, y: b.y, dmg: dmgB });
                    ent.hp -= dmgE; window.setHit(ent);
                    window.spawnParticles(ent.x + ent.width / 2, ent.y + ent.height / 2, '#ffa500', 3);
                    window.spawnDamageText(ent.x + ent.width / 2, ent.y - 4, `-${dmgE}`, 'melee');
                }
                hitWall = true;
            }
        } else {
            if (ent.vy > 0)      { ent.y = b.y - ent.height;    ent.vy = 0; }
            else if (ent.vy < 0) { ent.y = b.y + itemHeight;    ent.vy = 0; }
        }
    }
    return hitWall;
};

// ─── Rampas de escalones ───────────────────────────────────────────────────────

/** Aplica snap de rampa al jugador. Llamar tras checkBlockCollisions('y'). */
window.applyStairPhysicsPlayer = function () {
    if (window.player.isDead || window.player.inBackground) return;
    const bs = window.game.blockSize;

    for (const b of window.blocks) {
        if (b.type !== 'stair') continue;
        const relX = (window.player.x + window.player.width / 2) - b.x;
        if (relX < 0 || relX > bs) continue;
        if (window.player.y + window.player.height < b.y - 2) continue;
        if (window.player.y > b.y + bs) continue;

        const frac  = b.facingRight ? (relX / bs) : (1 - relX / bs);
        const rampY = b.y + bs - frac * bs;
        const footY = window.player.y + window.player.height;

        if (footY >= rampY - 4 && footY <= rampY + bs * 0.85) {
            const newY = rampY - window.player.height;
            const blocked = window.blocks.some(d =>
                d.type === 'door' && !d.open &&
                window.checkRectIntersection(window.player.x, newY, window.player.width, window.player.height, d.x, d.y, bs, bs * 2)
            );
            if (!blocked) {
                window.player.y  = newY;
                window.player.vy = 0;
                window.player.isGrounded = true;
            }
        }
    }
};

/** Aplica snap de rampa a una entidad. */
window.applyStairPhysicsEntity = function (ent) {
    if (Math.abs(ent.vx) <= 0.05) return;
    const bs = window.game.blockSize;

    for (const b of window.blocks) {
        if (b.type !== 'stair') continue;
        const relX = (ent.x + ent.width / 2) - b.x;
        if (relX < 0 || relX > bs) continue;
        if (ent.y + ent.height < b.y - 2 || ent.y + ent.height > b.y + bs + 4) continue;

        const frac  = b.facingRight ? (relX / bs) : (1 - relX / bs);
        const rampY = b.y + bs - frac * bs;
        const footY = ent.y + ent.height;

        if (footY >= rampY - 2 && footY <= rampY + bs * 0.8) {
            ent.y  = rampY - ent.height;
            ent.vy = 0;
        }
    }
};

// ─── Escalera ─────────────────────────────────────────────────────────────────

/** @returns {boolean} */
window.isOnLadder = function () {
    const pCX = window.player.x + window.player.width / 2;
    const bs  = window.game.blockSize;
    return window.blocks.some(b =>
        b.type === 'ladder' &&
        pCX >= b.x && pCX <= b.x + bs &&
        window.player.y + window.player.height > b.y &&
        window.player.y < b.y + bs
    );
};

// ─── Validación de placement ───────────────────────────────────────────────────

/** @returns {boolean} */
window.isOverlappingSolidBlock = function () {
    const bs = window.game.blockSize;
    for (const b of window.blocks) {
        if (
            (b.type === 'door' && b.open) ||
            b.type === 'box'       || b.type === 'campfire' ||
            b.type === 'bed'       || b.type === 'grave'    ||
            b.type === 'barricade' || b.type === 'ladder'   ||
            b.type === 'stair'
        ) continue;
        const h = b.type === 'door' ? bs * 2 : bs;
        if (window.checkRectIntersection(window.player.x, window.player.y, window.player.width, window.player.height, b.x, b.y, bs, h)) return true;
    }
    return false;
};

/** @returns {boolean} */
window.isAdjacentToBlockOrGround = function (x, y, w, h) {
    const bs          = window.game.blockSize;
    const groundGridY = Math.ceil((window.getGroundY ? window.getGroundY(x + w / 2) : window.game.groundLevel) / bs) * bs;

    if (y + h >= groundGridY) return true;

    for (const b of window.blocks) {
        if (b.type === 'campfire' || b.type === 'bed' || b.type === 'grave') continue;
        const bh = b.type === 'door' ? bs * 2 : bs;
        if (window.checkRectIntersection(x - 2, y - 2, w + 4, h + 4, b.x, b.y, bs, bh)) return true;
    }
    return false;
};

/**
 * Valida si una celda es un lugar válido para colocar un bloque/objeto.
 * @param {number} x @param {number} y @param {number} w @param {number} h
 * @param {boolean} [requireAdjacency=true]
 * @param {boolean} [isStructure=false] — true para block/door/stair
 * @returns {boolean}
 */
window.isValidPlacement = function (x, y, w, h, requireAdjacency = true, isStructure = false) {
    const bs          = window.game.blockSize;
    const groundGridY = Math.ceil((window.getGroundY ? window.getGroundY(x + w / 2) : window.game.groundLevel) / bs) * bs;
    const absMaxY     = window.game.baseGroundLevel + 3 * bs;

    if (y > groundGridY)   return false;
    if (y + h > absMaxY)   return false;

    if (window.checkRectIntersection(x, y, w, h, window.player.x, window.player.y, window.player.width, window.player.height)) return false;

    if (window.game.isMultiplayer && window.otherPlayers) {
        for (const id in window.otherPlayers) {
            const op = window.otherPlayers[id];
            if (window.checkRectIntersection(x, y, w, h, op.x, op.y, op.width || 24, op.height || 40)) return false;
        }
    }

    const isItem = !isStructure;
    const isDoor = isStructure && h > bs;

    if (isDoor) {
        const gyL = Math.ceil((window.getGroundY ? window.getGroundY(x - bs / 2)      : window.game.groundLevel) / bs) * bs;
        const gyR = Math.ceil((window.getGroundY ? window.getGroundY(x + bs + bs / 2) : window.game.groundLevel) / bs) * bs;
        if (gyL < y + h || gyR < y + h) return false;
        const lBlocked = window.blocks.some(b => !['ladder','campfire','bed','grave'].includes(b.type) && Math.abs(b.x - (x - bs)) < 1 && b.y < y + h && b.y + bs > y);
        const rBlocked = window.blocks.some(b => !['ladder','campfire','bed','grave'].includes(b.type) && Math.abs(b.x - (x + bs)) < 1 && b.y < y + h && b.y + bs > y);
        if (lBlocked && rBlocked) return false;
    }

    if (isItem || isDoor) {
        const supported =
            y + h >= groundGridY ||
            window.blocks.some(b =>
                (b.type === 'block' || b.type === 'ladder' || b.type === 'stair') &&
                Math.abs(b.x - x) < 1 &&
                Math.abs(b.y - (y + h)) < bs / 2
            );
        if (!supported) return false;
    }

    for (const b of window.blocks) {
        if (b.type === 'ladder') continue;
        const bh = b.type === 'door' ? bs * 2 : bs;
        if (b.type === 'door' && !isDoor && Math.abs(b.x - x) < 1 && Math.abs(b.y - (y + h)) < 1) continue;
        if (window.checkRectIntersection(x, y, w, h, b.x, b.y, bs, bh)) return false;

        const hAdj = Math.abs(x - (b.x - bs)) < 1 || Math.abs(x - (b.x + bs)) < 1;
        const vOvl = y < b.y + bh && y + h > b.y;
        if (hAdj && vOvl && (isDoor || b.type === 'door')) return false;
        if (isDoor && b.type === 'door' && Math.abs(b.x - x) < 1 && (Math.abs(b.y - (y + h)) < 1 || Math.abs((b.y + bh) - y) < 1)) return false;
        if (isItem && ['box','campfire','bed','grave','barricade'].includes(b.type) && Math.abs(b.x - x) < bs && Math.abs(b.y - (y + h)) < 1) return false;
    }

    for (const t of window.trees) {
        const tFY = window.getGroundY ? window.getGroundY(t.x + t.width / 2) : (t.groundY || t.y + t.height);
        const th  = t.isStump ? 80 : t.height;
        if (window.checkRectIntersection(x, y, w, h, t.x, tFY - th, t.width, th)) return false;
    }

    for (const r of window.rocks) {
        const rFY = window.getGroundY ? window.getGroundY(r.x + r.width / 2) : (r.y + r.height);
        if (window.checkRectIntersection(x, y, w, h, r.x, rFY - r.height, r.width, r.height)) return false;
    }

    if (requireAdjacency && !window.isAdjacentToBlockOrGround(x, y, w, h)) return false;
    return true;
};

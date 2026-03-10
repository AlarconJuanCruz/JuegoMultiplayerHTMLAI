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
    if (window.player.inBackground) return false;
    const p  = window.player;
    const bs = window.game.blockSize;
    let hitWallX = false;

    // Spatial pre-filter: solo iterar bloques que solapan el AABB del jugador ± 1 bloque
    const _pMinX = p.x - bs, _pMaxX = p.x + p.width  + bs;
    const _pMinY = p.y - bs, _pMaxY = p.y + p.height + bs * 2;

    // ── 1. Bloques construidos ──────────────────────────────────────────────────
    for (const b of window.blocks) {
        if (b.x + bs < _pMinX || b.x > _pMaxX || b.y + bs*2 < _pMinY || b.y > _pMaxY) continue;
        if (
            (b.type === 'door' && b.open) ||
            b.type === 'box'      || b.type === 'campfire' ||
            b.type === 'bed'      || b.type === 'grave'    ||
            b.type === 'barricade'|| b.type === 'ladder'   ||
            b.type === 'placed_torch'
        ) continue;

        const itemHeight = b.type === 'door' ? bs * 2 : bs;

        if (b.type === 'stair') {
            if (axis === 'x') {
                // La cara trasera (vertical sólida) del escalón bloquea el paso.
                // facingRight=true  → cara sólida = DERECHA  (jugador viene de derecha, vx<0)
                // facingRight=false → cara sólida = IZQUIERDA (jugador viene de izquierda, vx>0)
                const pFoot = p.y + p.height;
                if (pFoot <= b.y || p.y >= b.y + bs) continue; // sin solapamiento vertical
                if (!window.checkRectIntersection(p.x, p.y, p.width, p.height, b.x, b.y, bs, bs)) continue;

                // Calcular la Y de la rampa en el centro del jugador para saber si está SOBRE la rampa
                const pCX   = p.x + p.width / 2;
                const relX  = Math.max(0, Math.min(bs, pCX - b.x));
                const frac  = b.facingRight ? (relX / bs) : (1 - relX / bs);
                const rampY = b.y + bs - frac * bs;

                // Si el pie está cerca de la superficie de la rampa → el jugador está montado en ella → no bloquear
                if (Math.abs(pFoot - rampY) <= bs * 0.65) { continue; }

                // Bloquear sólo desde la cara sólida (trasera)
                if (b.facingRight && p.vx < 0) {
                    p.x = b.x + bs + 0.1; p.vx = 0; hitWallX = true;
                } else if (!b.facingRight && p.vx > 0) {
                    p.x = b.x - p.width - 0.1; p.vx = 0; hitWallX = true;
                }
                continue;
            }
            // eje Y: lógica de rampa existente
            if (p.vy <= 0) continue;
            const pCX = p.x + p.width / 2;
            if (pCX < b.x || pCX > b.x + bs) continue;
            const relX  = pCX - b.x;
            const frac  = b.facingRight ? (relX / bs) : (1 - relX / bs);
            const rampY = b.y + bs - frac * bs;
            const footY = p.y + p.height;
            if (footY >= rampY - 2 && footY <= rampY + p.vy + 6) {
                p.y = rampY - p.height; p.vy = 0; p.isGrounded = true;
            }
            continue;
        }

        const checkX = axis === 'y' ? p.x + 2   : p.x;
        const checkW = axis === 'y' ? p.width - 4 : p.width;
        if (!window.checkRectIntersection(checkX, p.y, checkW, p.height, b.x, b.y, bs, itemHeight)) continue;

        if (axis === 'x') {
            // Sin step-over: el jugador debe saltar explícitamente para subir cualquier bloque.
            if (p.vx > 0)      { p.x = b.x - p.width - 0.1; hitWallX = true; }
            else if (p.vx < 0) { p.x = b.x + bs + 0.1;      hitWallX = true; }
            p.vx = 0;
        } else {
            if (p.vy > 0) { p.y = b.y - p.height; p.vy = 0; p.isGrounded = true; }
            else if (p.vy < 0) {
                // Techo de bloque construido: empujar hacia abajo justo debajo del bloque
                // p.y se clampea al borde inferior del bloque para que el jugador empiece a caer.
                p.y  = b.y + itemHeight;
                p.vy = 0;
            }
        }
    }

    // ── 1.5. Colisión lateral con terreno de SUPERFICIE (paredes de colina/cliff) ──
    // El terreno superficial no existe en window.blocks, por lo que las caras verticales
    // de las colinas no tenían colisión X. Esto hacía que vx nunca se pusiera a 0 y
    // la animación de caminar se reproducía aunque el jugador estuviese bloqueado.
    if (axis === 'x' && window.getTerrainCol) {
        const footY = p.y + p.height;
        // Columna hacia donde se mueve el jugador
        const edgeX  = p.vx >= 0 ? p.x + p.width + 0.5 : p.x - 0.5;
        const adjCol = Math.floor(edgeX / bs);
        const cdAdj  = window.getTerrainCol(adjCol);
        if (cdAdj && cdAdj.type !== 'hole') {
            const cliffTopY = cdAdj.topY;
            // Es una pared si el terreno adyacente es más de 1 bloque alto respecto a los pies
            // (lo que el snap no puede resolver solo)
            if (cliffTopY < footY - bs * 0.85 && p.y < cliffTopY + (footY - p.y)) {
                if (p.vx > 0) { p.x = adjCol * bs - p.width - 0.1; p.vx = 0; hitWallX = true; }
                else if (p.vx < 0) { p.x = (adjCol + 1) * bs + 0.1; p.vx = 0; hitWallX = true; }
            }
        }
    }

    // ── 2. Colisión con celdas UG (terreno subterráneo generado/minado) ─────────
    //
    // DISEÑO:
    //   • Gate: columna CENTRAL del jugador.  Si los pies están en superficie, omitir.
    //   • Eje Y cayendo: aterrizar cuando los pies cruzan el techo de la celda.
    //     Solo si los pies están ≤ bs+vy debajo del techo (evita snap de celdas lejanas).
    //   • Eje Y subiendo: rebotar cuando la CABEZA (p.y) toca la base de una celda.
    //     Condición: p.y < cellY + bs (cabeza está por encima de la base de la celda).
    //   • Eje X: bloquear si la celda cubre el torso (cellY < pFeetY - 2).
    //     Ignora celdas de suelo para no bloquear el movimiento horizontal.
    //
    // NOTA: los `return` tempranos ahora devuelven hitWallX (puede ser true desde sección 1/1.5)
    if (!window.getUGCellV || !window.getTerrainCol) return hitWallX;

    const _midCol = Math.floor((p.x + p.width * 0.5) / bs);
    const _cdMid  = window.getTerrainCol(_midCol);
    if (!_cdMid || _cdMid.type === 'hole') return hitWallX;
    const _surfY  = _cdMid.topY;

    const pFeetY = p.y + p.height;
    if (pFeetY <= _surfY + bs * 0.25) return hitWallX;  // en superficie, snap se encarga

    const UG_DEPTH = window.UG_MAX_DEPTH || 90;
    const colL = Math.floor(p.x / bs);
    const colR = Math.floor((p.x + p.width - 1) / bs);

    for (let vc = colL; vc <= colR; vc++) {
        const cd = window.getTerrainCol(vc);
        if (!cd || cd.type === 'hole') continue;
        const topY  = cd.topY;
        const cellX = vc * bs;

        const rowStart = Math.max(0, Math.floor((p.y - topY) / bs) - 1);
        const rowEnd   = Math.min(UG_DEPTH - 1, Math.floor((pFeetY - topY) / bs) + 1);
        if (rowEnd < 0) continue;

        for (let vr = rowStart; vr <= rowEnd; vr++) {
            const mat = window.getUGCellV(vc, vr);
            if (!mat || mat === 'air') continue;

            const cellY = topY + vr * bs;
            // Ignorar celdas por encima de la superficie de la columna central
            if (cellY < _surfY) continue;

            if (axis === 'x') {
                // Solo bloquear si la celda cubre el torso (no el suelo)
                if (cellY >= pFeetY - 2) continue;
                if (!window.checkRectIntersection(p.x, p.y, p.width, p.height, cellX, cellY, bs, bs)) continue;
                // Sin step-over: el jugador debe saltar explícitamente.
                if (p.vx > 0) { p.x = cellX - p.width - 0.1; p.vx = 0; hitWallX = true; }
                else if (p.vx < 0) { p.x = cellX + bs + 0.1; p.vx = 0; hitWallX = true; }

            } else { // axis === 'y'
                if (!window.checkRectIntersection(p.x + 2, p.y, p.width - 4, p.height, cellX, cellY, bs, bs)) continue;

                if (p.vy >= 0) {
                    // Cayendo / en suelo: aterrizar encima de la celda.
                    // Solo si los pies ya pasaron el techo de la celda.
                    if (pFeetY < cellY - 1) continue;
                    p.y = cellY - p.height;
                    p.vy = 0;
                    p.isGrounded = true;
                } else {
                    // Subiendo: rebotar contra la BASE de la celda (techo).
                    // Condición: la cabeza del jugador penetró la celda desde abajo.
                    // p.y es la parte SUPERIOR del jugador. Si p.y >= cellY+bs, la celda
                    // está completamente por debajo → no es techo, ignorar.
                    if (p.y >= cellY + bs) continue;
                    // Clamp exacto: colocar la cabeza justo en el borde inferior de la celda.
                    // No usar +0.1 porque acumula error frame a frame cuando hay fricción de techo.
                    p.y  = cellY + bs;
                    p.vy = 0;
                }
            }
        }
    }
    return hitWallX;
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
            b.type === 'stair'     || b.type === 'placed_torch'
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
    // Pre-filter: solo bloques que puedan solapar con el AABB del mob (± 1 bloque de margen)
    const eMinX = ent.x - bs, eMaxX = ent.x + ent.width  + bs;
    const eMinY = ent.y - bs, eMaxY = ent.y + ent.height + bs * 2; // +2bs para puertas altas

    for (let i = window.blocks.length - 1; i >= 0; i--) {
        const b = window.blocks[i];
        // Spatial pre-filter (evita el checkRectIntersection y el type-check en bloques lejanos)
        if (b.x + bs < eMinX || b.x > eMaxX || b.y + bs * 2 < eMinY || b.y > eMaxY) continue;
        if (
            (b.type === 'door' && b.open) ||
            b.type === 'box'   || b.type === 'campfire' ||
            b.type === 'bed'   || b.type === 'grave'    ||
            b.type === 'placed_torch'
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

            // Step-over: escalar bloques de hasta 1 unidad de altura automáticamente.
            // Condición: techo del bloque (b.y) está dentro de 1 bs de los pies del mob
            // Y no hay bloque sólido encima (si hubiera, sería una pared de 2+).
            const _entFY = ent.y + ent.height;
            if (b.y >= _entFY - bs) {
                const _entRoof = window.blocks.some(ob =>
                    ob !== b &&
                    ob.type !== 'ladder' && ob.type !== 'placed_torch' &&
                    !(ob.type === 'door' && ob.open) &&
                    Math.abs(ob.x - b.x) < 2 && Math.abs(ob.y - (b.y - bs)) < 2
                );
                if (!_entRoof) { ent.y = b.y - ent.height; ent.vy = 0; continue; }
            }

            // Pared real: detener sin rebotar. vx=0 → animación se detiene.
            // La IA lee hitWall=true y decide saltar en el mismo frame.
            if (ent.vx > 0)      { ent.x = b.x - ent.width; ent.vx = 0; hitWall = true; }
            else if (ent.vx < 0) { ent.x = b.x + bs;         ent.vx = 0; hitWall = true; }

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

// ─── Colisión entidades con celdas UG (piedra, tierra, carbón, etc.) ──────────
//
// Todos los materiales sólidos (stone, dirt, coal, sulfur, diamond, bedrock)
// detienen a las entidades igual — sin importar el tipo.
// Se llama inmediatamente después de checkEntityCollisions en el loop de entidades.
//
window.checkEntityUGCollisions = function (ent, axis) {
    if (!window.getUGCellV || !window.getTerrainCol) return false;
    const bs = window.game.blockSize;

    // Gate: columna central de la entidad
    const _midCol = Math.floor((ent.x + ent.width * 0.5) / bs);
    const _cd     = window.getTerrainCol(_midCol);
    if (!_cd || _cd.type === 'hole') return false;
    const _surfY  = _cd.topY;

    const eFeetY = ent.y + ent.height;
    // Solo actuar cuando los pies están bajo la superficie
    if (eFeetY <= _surfY + bs * 0.25) return false;

    const UG_DEPTH = window.UG_MAX_DEPTH || 90;
    const colL = Math.floor(ent.x / bs);
    const colR = Math.floor((ent.x + ent.width - 1) / bs);
    let hitWall = false;

    for (let vc = colL; vc <= colR; vc++) {
        const cd = window.getTerrainCol(vc);
        if (!cd || cd.type === 'hole') continue;
        const topY  = cd.topY;
        const cellX = vc * bs;

        const rowStart = Math.max(0, Math.floor((ent.y - topY) / bs) - 1);
        const rowEnd   = Math.min(UG_DEPTH - 1, Math.floor((eFeetY - topY) / bs) + 1);
        if (rowEnd < 0) continue;

        for (let vr = rowStart; vr <= rowEnd; vr++) {
            const mat = window.getUGCellV(vc, vr);
            if (!mat || mat === 'air') continue;

            const cellY = topY + vr * bs;
            if (cellY < _surfY) continue;

            if (axis === 'x') {
                if (cellY >= eFeetY - 2) continue;  // celda de suelo, no pared
                if (!window.checkRectIntersection(ent.x, ent.y, ent.width, ent.height, cellX, cellY, bs, bs)) continue;

                // Step-over UG: celda dentro de 1 bloque de los pies + celda encima es aire
                if (cellY >= eFeetY - bs) {
                    const _mAboveE = (vr > 0) ? window.getUGCellV(vc, vr - 1) : 'air';
                    if (!_mAboveE || _mAboveE === 'air') {
                        ent.y = cellY - ent.height;
                        ent.vy = 0;
                        continue;
                    }
                }
                // Pared real: parar sin rebotar
                if (ent.vx > 0) { ent.x = cellX - ent.width - 0.1; ent.vx = 0; }
                else if (ent.vx < 0) { ent.x = cellX + bs + 0.1; ent.vx = 0; }
                hitWall = true;
            } else {
                if (!window.checkRectIntersection(ent.x + 1, ent.y, ent.width - 2, ent.height, cellX, cellY, bs, bs)) continue;
                if (ent.vy >= 0) {
                    if (eFeetY < cellY - 1) continue;
                    ent.y  = cellY - ent.height;
                    ent.vy = 0;
                } else {
                    if (ent.y >= cellY + bs) continue;
                    ent.y  = cellY + bs + 0.1;
                    ent.vy = 0;
                }
            }
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

        // Rango vertical: el pie del jugador debe estar cerca del bloque
        if (p.y + p.height < b.y - 4)  continue;  // muy arriba del bloque
        if (p.y > b.y + bs + 4)        continue;  // muy abajo del bloque

        const frac  = b.facingRight ? (relX / bs) : (1 - relX / bs);
        const rampY = b.y + bs - frac * bs;  // Y de la superficie de rampa
        const footY = p.y + p.height;

        // No snapear si el jugador salta hacia arriba (atravesaría el escalón)
        if (p.vy < -1.5) continue;

        // Ventana de snap: 
        //   hacia arriba: 8px (jugador viene caminando plano y se sube a rampa)
        //   hacia abajo: 28px (jugador desciende la rampa, puede acumular algo de vy)
        const snapUp   = 8;
        const snapDown = 28;
        if (footY < rampY - snapUp)   continue;  // pie muy arriba
        if (footY > rampY + snapDown) continue;  // pie muy abajo, pasó

        const newY = rampY - p.height;

        // Verificar que no penetra en bloque sólido al snapear
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
    const p   = window.player;
    const pCX = p.x + p.width / 2;
    const bs  = window.game.blockSize;
    // Use center X with generous tolerance (±10px) so side-wall block pushes
    // don't instantly drop the player off the ladder mid-climb.
    return window.blocks.some(b =>
        b.type === 'ladder' &&
        pCX >= b.x - 10 && pCX <= b.x + bs + 10 &&
        p.y + p.height > b.y - 6 &&
        p.y < b.y + bs + 6
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
            b.type === 'stair'     || b.type === 'placed_torch'
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

    // Superficie: tocar el piso cuenta como adyacente
    if (y + h >= groundGridY) return true;

    for (const b of window.blocks) {
        if (b.type === 'campfire' || b.type === 'bed' || b.type === 'grave') continue;
        const bh = b.type === 'door' ? bs * 2 : bs;
        if (window.checkRectIntersection(x - 2, y - 2, w + 4, h + 4, b.x, b.y, bs, bh)) return true;
    }

    // Columnas de terreno superficial adyacentes lateralmente también cuentan como soporte.
    // Permite colocar bloques pegados a la pared de una colina/escalón de terreno.
    if (window.getTerrainCol) {
        const colL = Math.floor((x - 1)     / bs);
        const colR = Math.floor((x + w + 1) / bs);
        const cdL  = window.getTerrainCol(colL);
        const cdR  = window.getTerrainCol(colR);
        // La columna lateral es sólida desde topY hacia abajo → soporta si su topY <= fondo del bloque
        if (cdL && cdL.type !== 'hole' && cdL.topY <= y + h) return true;
        if (cdR && cdR.type !== 'hole' && cdR.topY <= y + h) return true;
    }

    // Underground: también contar celdas UG sólidas adyacentes
    if (window.getUGCellV && window.getTerrainCol) {
        // Comprobar las 4 celdas vecinas (arriba, abajo, izq, der)
        const checkUGSolid = (wx, wy) => {
            const col = Math.floor(wx / bs);
            const cd2 = window.getTerrainCol(col);
            if (!cd2 || cd2.type === 'hole') return false;
            const row = Math.floor((wy - cd2.topY) / bs);
            if (row < 0) return false;
            const mat = window.getUGCellV(col, row);
            return mat && mat !== 'air';
        };
        const cx = x + w / 2, cy = y + h / 2;
        if (checkUGSolid(cx,       y - 1))     return true; // arriba
        if (checkUGSolid(cx,       y + h + 1)) return true; // abajo
        if (checkUGSolid(x - 1,    cy))         return true; // izquierda
        if (checkUGSolid(x + w + 1, cy))        return true; // derecha
    }

    return false;
};

// Devuelve true si la posición (x,y,w,h) está underground (bajo la topY del terreno).
function _isUnderground(x, y, w, h) {
    if (!window.getTerrainCol) return false;
    const bs = window.game.blockSize;
    const col = Math.floor((x + w / 2) / bs);
    const cd  = window.getTerrainCol(col);
    if (!cd || cd.type === 'hole') return false;
    return y >= cd.topY;
}

/**
 * Valida si una celda es un lugar válido para colocar un bloque/objeto.
 * Funciona tanto en superficie como underground (cuevas).
 */
window.isValidPlacement = function (x, y, w, h, requireAdjacency = true, isStructure = false) {
    const bs = window.game.blockSize;

    // ── Detección de contexto: ¿surface o underground? ──────────────────────
    const underground = _isUnderground(x, y, w, h);

    if (!underground) {
        // ── Reglas de SUPERFICIE (sin cambios) ──────────────────────────────
        const groundGridY = Math.ceil((window.getGroundY ? window.getGroundY(x + w / 2) : window.game.groundLevel) / bs) * bs;
        const absMaxY     = window.game.baseGroundLevel + 3 * bs;

        if (y > groundGridY)   return false;
        if (y + h > absMaxY)   return false;

        const isOnGround = Math.abs(y + h - groundGridY) < bs * 0.6;
        if (isOnGround && window.getTerrainIsFlat) {
            const isFlat = window.getTerrainIsFlat(x + w / 2);
            const hasBlockBelow = window.blocks.some(b =>
                (b.type === 'block' || b.type === 'stair') &&
                Math.abs(b.x - x) < bs - 1 &&
                Math.abs(b.y - (y + h)) < 4
            );
            // También permitir si hay terreno adyacente a la misma altura (esquina de colina)
            const hasAdjacentTerrain = (() => {
                if (!window.getTerrainCol) return false;
                const colL = Math.floor((x - 1)     / bs);
                const colR = Math.floor((x + w + 1) / bs);
                const cdL  = window.getTerrainCol(colL);
                const cdR  = window.getTerrainCol(colR);
                return (cdL && cdL.type !== 'hole' && cdL.topY <= y + h) ||
                       (cdR && cdR.type !== 'hole' && cdR.topY <= y + h);
            })();
            if (!isFlat && !hasBlockBelow && !hasAdjacentTerrain) return false;
        }

        if (window.checkRectIntersection(x, y, w, h, window.player.x, window.player.y, window.player.width, window.player.height)) return false;
        if (window.game.isMultiplayer && window.otherPlayers) {
            for (const id in window.otherPlayers) {
                const op = window.otherPlayers[id];
                if (window.checkRectIntersection(x, y, w, h, op.x, op.y, op.width || 24, op.height || 40)) return false;
            }
        }

        const isDoor = isStructure && h > bs;
        const isItem = !isStructure;

        if (isDoor) {
            const gyL = Math.ceil((window.getGroundY ? window.getGroundY(x - bs / 2)      : window.game.groundLevel) / bs) * bs;
            const gyR = Math.ceil((window.getGroundY ? window.getGroundY(x + bs + bs / 2) : window.game.groundLevel) / bs) * bs;
            if (gyL < y + h || gyR < y + h) return false;
            const lBlocked = window.blocks.some(b => !['ladder','campfire','bed','grave'].includes(b.type) && Math.abs(b.x - (x - bs)) < 1 && b.y < y + h && b.y + bs > y);
            const rBlocked = window.blocks.some(b => !['ladder','campfire','bed','grave'].includes(b.type) && Math.abs(b.x - (x + bs)) < 1 && b.y < y + h && b.y + bs > y);
            if (lBlocked && rBlocked) return false;
        }

        if (isItem || isDoor) {
            // Terreno lateral adyacente también provee soporte (colocar contra pared de colina)
            const adjacentTerrainSupport = (() => {
                if (!window.getTerrainCol) return false;
                const colL = Math.floor((x - 1)     / bs);
                const colR = Math.floor((x + w + 1) / bs);
                const cdL  = window.getTerrainCol(colL);
                const cdR  = window.getTerrainCol(colR);
                return (cdL && cdL.type !== 'hole' && cdL.topY <= y + h) ||
                       (cdR && cdR.type !== 'hole' && cdR.topY <= y + h);
            })();
            const supported =
                y + h >= groundGridY ||
                adjacentTerrainSupport ||
                window.blocks.some(b =>
                    (b.type === 'block' || b.type === 'ladder' || b.type === 'stair') &&
                    Math.abs(b.x - x) < 1 &&
                    Math.abs(b.y - (y + h)) < bs / 2
                );
            if (!supported) return false;
        }

        for (const b of window.blocks) {
            if (b.type === 'ladder' || b.type === 'placed_torch') continue;
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

    } else {
        // ── Reglas UNDERGROUND (dentro de cuevas) ───────────────────────────
        // No puede solapar al jugador ni a otros jugadores
        if (window.checkRectIntersection(x, y, w, h, window.player.x, window.player.y, window.player.width, window.player.height)) return false;
        if (window.game.isMultiplayer && window.otherPlayers) {
            for (const id in window.otherPlayers) {
                const op = window.otherPlayers[id];
                if (window.checkRectIntersection(x, y, w, h, op.x, op.y, op.width || 24, op.height || 40)) return false;
            }
        }

        // No puede estar dentro de una celda UG sólida
        if (window.getUGCellV && window.getTerrainCol) {
            const col = Math.floor((x + w / 2) / bs);
            const cd  = window.getTerrainCol(col);
            if (cd && cd.type !== 'hole') {
                const row = Math.floor((y - cd.topY) / bs);
                if (row >= 0) {
                    const mat = window.getUGCellV(col, row);
                    if (mat && mat !== 'air') return false;
                }
            }
        }

        // No puede solapar bloques ya existentes (placed_torch no cuenta: sin colisión)
        for (const b of window.blocks) {
            if (b.type === 'ladder' || b.type === 'placed_torch') continue;
            const bh = b.type === 'door' ? bs * 2 : bs;
            if (window.checkRectIntersection(x, y, w, h, b.x, b.y, bs, bh)) return false;
        }

        // Debe ser adyacente a celda UG sólida o bloque ya construido
        if (requireAdjacency && !window.isAdjacentToBlockOrGround(x, y, w, h)) return false;

        return true;
    }
};

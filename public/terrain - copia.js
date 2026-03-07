// === terrain.js - GENERACIÓN DE TERRENO POR COLUMNAS DE BLOQUES ===
// Dos pasadas: 1) calcular topY, 2) asignar tipos con reglas estrictas.
// Tipos: 'flat', 'ramp_r', 'ramp_l', 'hole'
// Regla de rampas: mínimo 1 bloque flat entre dos rampas.
//                  Nunca ramp_r seguido de ramp_l (pico) ni al revés (valle).

window.generateSeed = function () {
    window.worldSeed = Math.floor(Math.random() * 0xFFFFFF) + 1;
    window.seedCode  = window.worldSeed.toString(36).toUpperCase().padStart(5, '0');
    window.applySeed();
};

window.setSeedFromCode = function (code) {
    const n = parseInt(code.toUpperCase(), 36);
    if (!isNaN(n) && n > 0) {
        window.worldSeed = n;
        window.seedCode  = code.toUpperCase().padStart(5, '0');
        window.applySeed();
        return true;
    }
    return false;
};

window.applySeed = function () {
    const s = window.worldSeed;
    function sh(offset) {
        let v = ((s ^ (s >> 7)) * 0x45d9f3b + offset * 0x9e3779b9) >>> 0;
        v = ((v ^ (v >> 15)) * 0x01234567) >>> 0;
        return (v >>> 0) / 0xFFFFFFFF;
    }
    window._tp = {
        p0: sh(1) * Math.PI * 2,  p1: sh(2) * Math.PI * 2,
        p2: sh(3) * Math.PI * 2,  p3: sh(4) * Math.PI * 2,
        p4: sh(5) * Math.PI * 2,
        a0: 38 + sh(6) * 24,  a1: 22 + sh(7) * 16,  a2: 10 + sh(8) * 10,
        desertStart:    6000 + Math.floor(sh(9)  * 4000),
        desertWidth:    1000 + Math.floor(sh(10) * 800),
        mountainOffset: 8000 + Math.floor(sh(11) * 4000),
        mp0: sh(12) * Math.PI * 2,
        mp1: sh(13) * Math.PI * 2,
        mp2: sh(14) * Math.PI * 2,
    };
    window.game.desertStart = window._tp.desertStart;
    window.game.desertWidth = window._tp.desertWidth;
    window._terrainColCache = {};
};

window._defaultTp = {
    p0:1.5, p1:0.8, p2:2.3, p3:0.4, p4:3.7,
    a0:45, a1:28, a2:14,
    desertStart:8000, desertWidth:1000, mountainOffset:10000,
    mp0:4.2, mp1:1.1, mp2:2.8
};

// ─── Altura continua suavizada ────────────────────────────────────────────────
function _rawHeight(x) {
    const base = window.game.baseGroundLevel;
    const tp   = window._tp || window._defaultTp;
    if (x <= window.game.shoreX + 60) return base;
    const blend = Math.min(1.0, (x - window.game.shoreX - 60) / 340);
    let h = 0;
    h += Math.sin(x * 0.0022 + tp.p0) * tp.a0;
    h += Math.cos(x * 0.0041 + tp.p1) * tp.a1;
    h += Math.sin(x * 0.0093 + tp.p2) * tp.a2;
    h += Math.cos(x * 0.0190 + tp.p3) * 7;
    h += Math.sin(x * 0.0380 + tp.p4) * 3;
    const mountainStart = window.game.shoreX + (tp.mountainOffset || 10000);
    if (x > mountainStart) {
        const mt = Math.min(1.0, (x - mountainStart) / 3000);
        let mh = 0;
        mh += Math.sin(x * 0.0008 + tp.mp0) * 130;
        mh += Math.cos(x * 0.0014 + tp.mp1) * 90;
        mh += Math.sin(x * 0.0028 + tp.mp2) * 45;
        mh += Math.cos(x * 0.0060 + 0.5)    * 18;
        h = h * (1 - mt) + mh * mt;
    }
    return Math.max(-800, Math.min(1800, base + h * blend));
}

// ─── Hash para pozos ──────────────────────────────────────────────────────────
function _holeHash(col) {
    const s = window.worldSeed || 12345;
    let v = ((col * 127 + s * 17) & 0x7FFFFFFF);
    v = ((v ^ (v >>> 16)) * 0x45d9f3b) >>> 0;
    v = ((v ^ (v >>> 16)) * 0x45d9f3b) >>> 0;
    return (v >>> 0) / 0xFFFFFFFF;
}

// ─── Utilidad interna: sólo topY y hole, SIN tipo de rampa ───────────────────
// No llama a getTerrainCol → sin riesgo de recursión.
function _colTopY(col) {
    const bs       = window.game.blockSize;
    const base     = window.game.baseGroundLevel;
    const shoreCol = Math.ceil((window.game.shoreX + 60) / bs);
    const safeCol  = Math.ceil((window.game.shoreX + 280) / bs);

    if (col <= shoreCol) return { topY: base, isHole: false };

    // Pozos
    if (col >= safeCol) {
        for (let c = col - 5; c <= col; c++) {
            if (c < safeCol) continue;
            if (_holeHash(c) > 0.958) {
                const w = 2 + Math.floor(_holeHash(c + 7777) * 3);
                if (col >= c && col < c + w) return { topY: base + 9999, isHole: true };
            }
        }
    }

    const rawY = _rawHeight(col * bs + bs / 2);
    const topY = Math.round((rawY - base) / bs) * bs + base;
    return { topY, isHole: false };
}

// ─── API pública: obtener datos de columna ────────────────────────────────────
// Hace dos pasadas:
//   Pasada 1: topY e isHole para la columna y sus vecinos inmediatos
//   Pasada 2: tipo (flat / ramp_r / ramp_l) con las restricciones:
//     - Solo ramp si diff exactamente 1 bloque con el vecino
//     - Vecino opuesto (izquierda de ramp_r, derecha de ramp_l) debe ser flat
//       y al mismo nivel que el borde alto de la rampa
//     - Nunca dos rampas seguidas (ni mismo sentido ni pico/valle)
window.getTerrainCol = function (col) {
    const cache = window._terrainColCache || (window._terrainColCache = {});
    if (cache[col] !== undefined) return cache[col];

    // Pasada 1: calcular topY para col-2..col+2 sin asignar tipos
    const data = {};
    for (let c = col - 2; c <= col + 2; c++) {
        if (cache[c] !== undefined) {
            data[c] = cache[c];
        } else {
            const d = _colTopY(c);
            data[c] = { topY: d.topY, type: d.isHole ? 'hole' : 'flat' };
        }
    }

    // Pasada 2: asignar tipo para la columna solicitada
    const cur  = data[col];
    if (cur.type === 'hole') {
        return (cache[col] = cur);
    }

    const prev2 = data[col - 2] || { type: 'flat', topY: cur.topY };
    const prev  = data[col - 1] || { type: 'flat', topY: cur.topY };
    const next  = data[col + 1] || { type: 'flat', topY: cur.topY };
    const next2 = data[col + 2] || { type: 'flat', topY: cur.topY };

    const bs = window.game.blockSize;

    let type = 'flat';

    // ── ¿Rampa bajando a la derecha (ramp_r)? ────────────────────────────────
    // Requisitos:
    //   1. next es sólido y está exactamente 1 bloque más abajo
    //   2. El vecino ANTES de mí (prev) es plano al mismo nivel (no viene de rampa)
    //   3. El vecino DESPUÉS de next (next2) es plano al mismo nivel que next
    //      (para evitar pico: ramp_r → ramp_l)
    if (
        next.type !== 'hole' &&
        next.topY - cur.topY === bs &&           // next está 1 bs más abajo
        prev.type !== 'hole' &&
        prev.topY === cur.topY &&                // prev al mismo nivel (no subí de rampa)
        prev.type === 'flat' &&                  // prev no es rampa
        next2.type !== 'hole' &&
        next2.topY === next.topY &&              // next2 al mismo nivel que next (sin valle)
        next2.type === 'flat'                    // next2 no es rampa
    ) {
        type = 'ramp_r';
    }

    // ── ¿Rampa bajando a la izquierda (ramp_l)? ──────────────────────────────
    // Requisitos simétricos:
    //   1. prev es sólido y está exactamente 1 bloque más abajo
    //   2. next es plano al mismo nivel (no continúa la bajada)
    //   3. prev2 es plano al mismo nivel que prev
    if (
        type === 'flat' &&                       // no asignar si ya es ramp_r
        prev.type !== 'hole' &&
        prev.topY - cur.topY === bs &&           // prev está 1 bs más abajo
        next.type !== 'hole' &&
        next.topY === cur.topY &&                // next al mismo nivel
        next.type === 'flat' &&
        prev2.type !== 'hole' &&
        prev2.topY === prev.topY &&              // prev2 al nivel de prev
        prev2.type === 'flat'
    ) {
        type = 'ramp_l';
    }

    cur.type = type;
    cache[col] = cur;
    return cur;
};

// Alias retrocompatibilidad
window._getTerrainCol = window.getTerrainCol;

// ─── Y del suelo en X continua ────────────────────────────────────────────────
window.getGroundY = function (x) {
    const bs   = window.game.blockSize;
    const base = window.game.baseGroundLevel;

    if (x <= window.game.shoreX + 60) return base;

    const col  = Math.floor(x / bs);
    const frac = (x - col * bs) / bs;   // 0…1 dentro del bloque

    const curr = window.getTerrainCol(col);
    const next = window.getTerrainCol(col + 1);

    if (curr.type === 'hole') return base + 9999;

    if (curr.type === 'ramp_r' && next && next.type !== 'hole') {
        // diagonal: baja de curr.topY a next.topY
        return curr.topY + (next.topY - curr.topY) * frac;
    }
    if (curr.type === 'ramp_l') {
        const prev = window.getTerrainCol(col - 1);
        if (prev && prev.type !== 'hole') {
            // diagonal: sube de prev.topY a curr.topY
            return prev.topY + (curr.topY - prev.topY) * frac;
        }
    }
    return curr.topY;
};

// ─── ¿Terreno plano apto para construir? ─────────────────────────────────────
window.getTerrainIsFlat = function (x) {
    const bs  = window.game.blockSize;
    const col = Math.floor(x / bs);
    const cur  = window.getTerrainCol(col);
    if (!cur || cur.type !== 'flat') return false;
    const prev = window.getTerrainCol(col - 1);
    const next = window.getTerrainCol(col + 1);
    if (!prev || prev.type !== 'flat' || prev.topY !== cur.topY) return false;
    if (!next || next.type !== 'flat' || next.topY !== cur.topY) return false;
    return true;
};

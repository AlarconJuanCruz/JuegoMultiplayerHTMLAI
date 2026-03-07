// === terrain.js - GENERACIÓN DE TERRENO POR COLUMNAS DE BLOQUES ===
// Sistema nuevo: solo bloques rectangulares, sin rampas en 45°.
// Tipos de columna:
//   'flat'       → mismo nivel que ambos vecinos
//   'step_up_l'  → esta col más alta que izquierda (borde izq expuesto)
//   'step_up_r'  → esta col más alta que derecha (borde der expuesto)
//   'step_up_lr' → más alta que ambos vecinos
//   'hole'       → pozo

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
        p0: sh(1)*Math.PI*2, p1: sh(2)*Math.PI*2,
        p2: sh(3)*Math.PI*2, p3: sh(4)*Math.PI*2, p4: sh(5)*Math.PI*2,
        a0: 38+sh(6)*24, a1: 22+sh(7)*16, a2: 10+sh(8)*10,
        desertStart:    6000+Math.floor(sh(9)*4000),
        desertWidth:    1000+Math.floor(sh(10)*800),
        mountainOffset: 8000+Math.floor(sh(11)*4000),
        mp0: sh(12)*Math.PI*2, mp1: sh(13)*Math.PI*2, mp2: sh(14)*Math.PI*2,
    };
    window.game.desertStart = window._tp.desertStart;
    window.game.desertWidth = window._tp.desertWidth;
    window._terrainColCache = {};
};

window._defaultTp = {
    p0:1.5,p1:0.8,p2:2.3,p3:0.4,p4:3.7,
    a0:45,a1:28,a2:14,
    desertStart:8000,desertWidth:1000,mountainOffset:10000,
    mp0:4.2,mp1:1.1,mp2:2.8
};

function _rawHeight(x) {
    const base=window.game.baseGroundLevel, tp=window._tp||window._defaultTp;
    if (x<=window.game.shoreX+60) return base;
    const blend=Math.min(1.0,(x-window.game.shoreX-60)/340);
    let h=0;
    h+=Math.sin(x*0.0022+tp.p0)*tp.a0;
    h+=Math.cos(x*0.0041+tp.p1)*tp.a1;
    h+=Math.sin(x*0.0093+tp.p2)*tp.a2;
    h+=Math.cos(x*0.0190+tp.p3)*7;
    h+=Math.sin(x*0.0380+tp.p4)*3;
    const mountainStart=window.game.shoreX+(tp.mountainOffset||10000);
    if (x>mountainStart) {
        const mt=Math.min(1.0,(x-mountainStart)/3000);
        let mh=0;
        mh+=Math.sin(x*0.0008+tp.mp0)*130;
        mh+=Math.cos(x*0.0014+tp.mp1)*90;
        mh+=Math.sin(x*0.0028+tp.mp2)*45;
        mh+=Math.cos(x*0.0060+0.5)*18;
        h=h*(1-mt)+mh*mt;
    }
    return Math.max(-800,Math.min(1800,base+h*blend));
}

function _holeHash(col) {
    const s=window.worldSeed||12345;
    let v=((col*127+s*17)&0x7FFFFFFF);
    v=((v^(v>>>16))*0x45d9f3b)>>>0;
    v=((v^(v>>>16))*0x45d9f3b)>>>0;
    return (v>>>0)/0xFFFFFFFF;
}

// Devuelve topY snapeado a blockSize, sin tipo
function _colTopYRaw(col) {
    const bs=window.game.blockSize, base=window.game.baseGroundLevel;
    const shoreCol=Math.ceil((window.game.shoreX+60)/bs);
    // Zona segura amplia: 1500px desde shoreX antes de que aparezcan pozos
    const safeCol =Math.ceil((window.game.shoreX+1500)/bs);
    if (col<=shoreCol) return {topY:base,isHole:false};
    if (col>=safeCol) {
        for (let c=col-10;c<=col;c++) {
            if (c<safeCol) continue;
            if (_holeHash(c)>0.994) {
                const w=2+Math.floor(_holeHash(c+7777)*9);
                if (col>=c&&col<c+w) return {topY:base+9999,isHole:true};
            }
        }
    }
    const rawY=_rawHeight(col*bs+bs/2);
    // Clampar topY a rango razonable — nunca valores absurdos que rompan la cámara
    const rawSnapped=Math.round((rawY-base)/bs)*bs+base;
    const topY=Math.max(base-8*bs, Math.min(base+5*bs, rawSnapped));
    return {topY,isHole:false};
}

// API pública
window.getTerrainCol = function(col) {
    const cache=window._terrainColCache||(window._terrainColCache={});
    if (cache[col]!==undefined) return cache[col];

    const raw=_colTopYRaw(col);
    if (raw.isHole) { cache[col]={topY:raw.topY,type:'hole',holeEdgeLeft:false,holeEdgeRight:false}; return cache[col]; }

    const rawL=_colTopYRaw(col-1);
    const rawR=_colTopYRaw(col+1);
    const topY=raw.topY;

    const holeEdgeLeft  = rawL.isHole;
    const holeEdgeRight = rawR.isHole;
    const leftTopY  = holeEdgeLeft  ? topY : rawL.topY;
    const rightTopY = holeEdgeRight ? topY : rawR.topY;

    // Esta col es más alta (topY menor = más arriba) que vecinos
    const higherThanLeft  = !holeEdgeLeft  && topY < leftTopY;
    const higherThanRight = !holeEdgeRight && topY < rightTopY;

    let type='flat';
    if      (higherThanLeft && higherThanRight) type='step_up_lr';
    else if (higherThanLeft)                    type='step_up_l';
    else if (higherThanRight)                   type='step_up_r';

    cache[col]={topY,type,holeEdgeLeft,holeEdgeRight};
    return cache[col];
};

window._getTerrainCol=window.getTerrainCol;

// Y del suelo: siempre el topY directo (sin interpolación diagonal)
// Para pozos retorna base+9999 — la colisión de suelo lo ignora, y la muerte se detecta aparte.
window.getGroundY = function(x) {
    const bs=window.game.blockSize, base=window.game.baseGroundLevel;
    if (x<=window.game.shoreX+60) return base;
    const col=Math.floor(x/bs);
    const curr=window.getTerrainCol(col);
    if (curr.type==='hole') return base+9999;
    if (curr.topY < base - 10*bs || curr.topY > base + 6*bs) return base;
    // Bajar por las filas mientras sean 'air' (minadas O cueva generada)
    // Así getGroundY devuelve la primera superficie SÓLIDA real
    let row = 0;
    const maxRows = window.UG_MAX_DEPTH || 90;
    while (row < maxRows) {
        const mat = window.getUGCellV ? window.getUGCellV(col, row) : 'stone';
        if (mat !== 'air') break;   // primera fila sólida
        row++;
    }
    return curr.topY + row * bs;
};

window.getTerrainIsFlat = function(x) {
    const bs=window.game.blockSize, col=Math.floor(x/bs);
    const cur=window.getTerrainCol(col);
    if (!cur||cur.type==='hole') return false;
    const prev=window.getTerrainCol(col-1);
    const next=window.getTerrainCol(col+1);
    if (!prev||prev.type==='hole'||prev.topY!==cur.topY) return false;
    if (!next||next.type==='hole'||next.topY!==cur.topY) return false;
    return true;
};

// ════════════════════════════════════════════════════════════════════
// SISTEMA SUBTERRÁNEO  –  cuevas + minerales  (estilo Terraria)
//
// Coordenadas: row=0 es la superficie (baseGroundLevel), crece hacia abajo.
//   row 0-2   → tierra/raíces  (transición superficial)
//   row 3-14  → piedra
//   row 15-30 → carbón (coal)  — vetas densas
//   row 31-55 → azufre (sulfur) — vetas medianas + algo de coal
//   row 56-90 → diamante (diamond) — raras vetas + azufre
//   row > 90  → bedrock (indestructible)
//
// MAX_DEPTH = 90 bloques  (~2700 px con blockSize=30)
// ════════════════════════════════════════════════════════════════════

window.UG_MAX_DEPTH = 90;   // bloques desde surface hacia abajo

// ── Hash determinista 2D seeded ──────────────────────────────────────
function _ugH(cx, cy) {
    const s = window.worldSeed || 12345;
    let v = (cx * 374761393 ^ cy * 1103515245 ^ s * 2654435761) >>> 0;
    v = ((v ^ (v >>> 13)) * 0xc2b2ae35) >>> 0;
    v = (v ^ (v >>> 16)) >>> 0;
    return v / 0xFFFFFFFF;
}
// Noise 2D suave (interpolación bicúbica entre 4 hashes)
function _ugN(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx*fx*(3-2*fx), uy = fy*fy*(3-2*fy);
    return _ugH(ix,iy)*(1-ux)*(1-uy) + _ugH(ix+1,iy)*ux*(1-uy)
         + _ugH(ix,iy+1)*(1-ux)*uy   + _ugH(ix+1,iy+1)*ux*uy;
}
// Fractal (3 octavas) — formas orgánicas para cuevas
function _ugF(x, y) {
    return (_ugN(x,y)*0.50 + _ugN(x*2.1+31.7,y*2.1+17.3)*0.30
          + _ugN(x*4.3+70.1,y*4.3+52.9)*0.20);
}

// ── Celda: devuelve material de la celda (col, row) ──────────────────
// 'air'     → cueva o fuera del mapa
// 'dirt'    → tierra superficial (primeras filas)
// 'stone'   → piedra base
// 'coal'    → carbón
// 'sulfur'  → azufre
// 'diamond' → diamante
// 'bedrock' → roca madre (no rompible)
window.getUGCell = function(col, row) {
    if (row < 0)                     return 'air';
    if (row >= window.UG_MAX_DEPTH)  return 'bedrock';

    const s = window.worldSeed || 12345;

    // ── Cuevas ── (noise worm-style: tres octavas para formas más orgánicas)
    const cScale = 0.075;
    const n1 = _ugF(col * cScale,              row * cScale);
    const n2 = _ugF(col * cScale * 1.8 + 55,  row * cScale * 1.8 + 33);
    const n3 = _ugF(col * cScale * 0.5 + 99,  row * cScale * 0.5 + 77);
    // Profundidad normalizada: cuevas arrancan en row 4 (tierra superficial intacta)
    const depthRatio = row / window.UG_MAX_DEPTH;
    // Threshold variable: menos cuevas cerca de superficie, más en capas medias
    // El término (row-4) hace que por debajo de row=4 sea imposible generar cueva
    const surfaceFade = Math.max(0, Math.min(1, (row - 4) / 6.0)); // 0→1 entre row 4-10
    const caveThresh  = 0.60 - depthRatio * 0.06 + Math.pow(depthRatio - 0.45, 2) * 0.07;
    const caveVal     = (n1 * 0.55 + n2 * 0.30 + n3 * 0.15) * surfaceFade;
    // Cuevas solo bajo row=4; el valor escalado impide aparición superficial
    if (row >= 4 && caveVal > caveThresh * surfaceFade) return 'air';

    // ── Material por profundidad + vetas de noise ────────────────────
    if (row < 3) return 'dirt';

    // noise de veta separado del de cueva
    const oScale = 0.18;
    const oreN   = _ugF(col * oScale + 200, row * oScale + 100);
    const oreH   = _ugH(col + 9001, row + 4003); // hash puntual para minerales raros

    if (row < 15) {
        // Zona piedra: pequeñas vetas de carbón (~8%)
        if (oreN > 0.78) return 'coal';
        return 'stone';
    }
    if (row < 31) {
        // Zona carbón: vetas densas (~30% coal)
        const coalN = _ugF(col * 0.22 + 300, row * 0.22 + 150);
        if (coalN > 0.60) return 'coal';
        if (oreH > 0.965) return 'sulfur'; // trazas de azufre
        return 'stone';
    }
    if (row < 56) {
        // Zona azufre: vetas medianas, algo de carbón residual
        const sN = _ugF(col * 0.19 + 400, row * 0.19 + 200);
        if (sN > 0.62) return 'sulfur';
        if (oreH > 0.88) return 'coal';   // vetas de carbón residual
        if (oreH > 0.975) return 'diamond';
        return 'stone';
    }
    // Zona profunda (56-90): diamante más frecuente
    const dN = _ugF(col * 0.16 + 500, row * 0.16 + 250);
    if (dN > 0.72) return 'diamond';
    if (oreH > 0.75) return 'sulfur';  // azufre residual
    return 'stone';
};

// ── Celdas minadas en esta sesión (persistidas en worldState) ────────
window._minedCells = window._minedCells || {};

window.mineCell   = function(col, row) { window._minedCells[col+'_'+row] = true; };
window.isMined    = function(col, row) { return !!window._minedCells[col+'_'+row]; };

// Cache persistente para getUGCell (el noise es determinista — resultado siempre igual)
// Evita recalcular 3 octavas de fractal noise para cada celda en cada frame.
window._ugCellCache = window._ugCellCache || {};

const _origGetUGCell = window.getUGCell;
window.getUGCell = function(col, row) {
    const k = col + '_' + row;
    if (window._ugCellCache[k] !== undefined) return window._ugCellCache[k];
    const v = _origGetUGCell(col, row);
    // Limitar tamaño del cache (~100k entradas ≈ ~6MB strings) — LRU simple
    window._ugCellCache[k] = v;
    return v;
};

// Al resetear semilla, limpiar el cache de celdas
const _origApplySeed = window.applySeed;
window.applySeed = function() {
    window._ugCellCache = {};
    window._minedCells  = {};
    window._cellDamage  = {};
    _origApplySeed();
};

// API visible: considera celdas minadas
window.getUGCellV = function(col, row) {
    if (window.isMined(col, row)) return 'air';
    return window.getUGCell(col, row);
};

// HP de cada material (pickaxe damage = 3 por swing a nivel base)
// HP de celdas: número de golpes × daño base para romper
// (pickaxe dmg ~4-5 por swing → dirt rompe en 2-3 golpes, stone en 6-8)
window.UG_HP = { dirt:8, stone:30, coal:20, sulfur:25, diamond:60, bedrock:9999 };

// Velocidad de minado (cooldown en frames entre golpes de terreno)
// Permite mantener click sostenido sin esperar el cooldown de melee completo
window.UG_MINE_CD = { dirt:6, stone:10, coal:8, sulfur:9, diamond:14 };

// ── Estado de daño a celdas en progreso ─────────────────────────────
window._cellDamage = window._cellDamage || {};   // 'col_row' → hp restante

window.damageCellUG = function(col, row, dmg) {
    const mat = window.getUGCellV(col, row);
    if (!mat || mat === 'air' || mat === 'bedrock') return false;
    const key  = col + '_' + row;
    const maxHp = window.UG_HP[mat] || 30;
    if (window._cellDamage[key] === undefined) window._cellDamage[key] = maxHp;
    window._cellDamage[key] -= dmg;
    if (window._cellDamage[key] <= 0) {
        delete window._cellDamage[key];
        window.mineCell(col, row);
        return mat; // material destruido
    }
    return false; // todavía no se rompe
};

// Fracción de daño (0→1) para barra de progreso
window.getCellDmgFrac = function(col, row) {
    const mat = window.getUGCellV(col, row);
    if (!mat || mat==='air') return 0;
    const key  = col+'_'+row;
    if (window._cellDamage[key] === undefined) return 0;
    const maxHp = window.UG_HP[mat]||30;
    return 1 - window._cellDamage[key] / maxHp;
};

// ── Helper: convierte worldY a row UG para una columna dada ─────────
// row=0 = superficie real de ESA columna (topY), no baseGroundLevel fijo
window.worldYToUGRow = function(col, worldY) {
    const bs   = window.game.blockSize;
    const cd   = window.getTerrainCol ? window.getTerrainCol(col) : null;
    const topY = (cd && cd.type !== 'hole') ? cd.topY : (window.game.baseGroundLevel || 510);
    return Math.floor((worldY - topY) / bs);
};

// Convierte row UG → worldY para una columna dada
window.ugRowToWorldY = function(col, row) {
    const bs   = window.game.blockSize;
    const cd   = window.getTerrainCol ? window.getTerrainCol(col) : null;
    const topY = (cd && cd.type !== 'hole') ? cd.topY : (window.game.baseGroundLevel || 510);
    return topY + row * bs;
};

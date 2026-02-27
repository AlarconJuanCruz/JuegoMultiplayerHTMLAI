// === terrain.js - GENERACIÓN DE TERRENO Y SEMILLA ===
// Extraído de data.js para separar inicialización de lógica.
// Depende de: window.game (baseGroundLevel, shoreX)

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
};

// Fallback antes de que applySeed() se ejecute
window._defaultTp = {
    p0:1.5, p1:0.8, p2:2.3, p3:0.4, p4:3.7,
    a0:45, a1:28, a2:14,
    desertStart:8000, desertWidth:1000, mountainOffset:10000,
    mp0:4.2, mp1:1.1, mp2:2.8
};

/**
 * Devuelve la Y del suelo en la coordenada X dada.
 * Curva continua basada en la semilla del mundo.
 */
window.getGroundY = function (x) {
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
};

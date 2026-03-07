// ═══════════════════════════════════════════════════════════════════
// MAPA DE EXPLORACIÓN — estilo Terraria
// Tecla M: abrir/cerrar  |  Rueda: zoom  |  Arrastrar: mover
// ═══════════════════════════════════════════════════════════════════

window._explored  = window._explored || new Set();
window._mapOpen   = false;
window._mapDirty  = true;
window._mapZoom   = 3;
window._mapOffX   = 0;
window._mapOffY   = 0;

var MAP_COLOR = {
    surface:'#3aaa1a', dirt:'#6b3a2a', stone:'#6a6a7a',
    coal:'#3a3a40', sulfur:'#b09000', diamond:'#00a8c8',
    bedrock:'#222230', air:'#1a2535',
};

// ── Marcar zona como explorada ────────────────────────────────────
window.exploreArea = function(worldX, worldY, bonusRadius) {
    if (!window.game || !window.game.blockSize) return;
    var bs  = window.game.blockSize;
    var col = Math.floor(worldX / bs);
    var cd  = window.getTerrainCol ? window.getTerrainCol(col) : null;
    var topY = (cd && cd.type !== 'hole') ? cd.topY : (window.game.baseGroundLevel || 510);
    var row  = Math.floor((worldY - topY) / bs);
    var underground = worldY > topY + bs;
    var radH = underground ? 8 : 20;
    var radV = underground ? 6 : 3;
    if (bonusRadius) radH += Math.floor(bonusRadius / bs);
    var added = false;
    for (var dc = -radH; dc <= radH; dc++) {
        var sk = (col+dc) + '_s';
        if (!window._explored.has(sk)) { window._explored.add(sk); added = true; }
        for (var dr = -radV; dr <= radV; dr++) {
            if ((dc*dc)/(radH*radH) + (dr*dr)/(radV*radV) > 1.0) continue;
            var k = (col+dc) + '_' + (row+dr);
            if (!window._explored.has(k)) { window._explored.add(k); added = true; }
        }
    }
    if (added) window._mapDirty = true;
};

window.updateExploration = function() {
    if (!window.player || window.player.isDead) return;
    var p = window.player;
    window.exploreArea(p.x + p.width*0.5, p.y + p.height*0.5, 0);
};

// ── Overlay del mapa ──────────────────────────────────────────────
var _mapEl = null, _mapCv = null, _mapCtx2d = null;

function buildMapOverlay() {
    if (_mapEl) return;

    var overlay = document.createElement('div');
    overlay.id = 'map-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9500;display:none;';
    document.body.appendChild(overlay);

    var cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
    overlay.appendChild(cv);

    var title = document.createElement('div');
    title.style.cssText = 'position:absolute;top:14px;left:50%;transform:translateX(-50%);color:#aef;font-size:22px;font-weight:bold;font-family:monospace;text-shadow:0 0 10px #0af;letter-spacing:2px;pointer-events:none;';
    title.textContent = '— MAPA DE EXPLORACIÓN —';
    overlay.appendChild(title);

    var hint = document.createElement('div');
    hint.style.cssText = 'position:absolute;bottom:14px;left:50%;transform:translateX(-50%);color:#667;font-size:13px;font-family:monospace;pointer-events:none;white-space:nowrap;';
    hint.textContent = '[M] Cerrar   •   Rueda: zoom   •   Arrastrar: mover';
    overlay.appendChild(hint);

    var hud = document.createElement('div');
    hud.id = 'map-hud';
    hud.style.cssText = 'position:absolute;top:14px;left:14px;color:#aaa;font-size:13px;line-height:1.8;font-family:monospace;background:rgba(0,0,0,0.6);padding:8px 12px;border-radius:4px;pointer-events:none;';
    overlay.appendChild(hud);

    _mapEl = overlay; _mapCv = cv;
    _mapCtx2d = cv.getContext('2d');

    // drag
    var dragging = false, dx = 0, dy = 0;
    overlay.addEventListener('mousedown', function(e) { dragging=true; dx=e.clientX; dy=e.clientY; });
    window.addEventListener('mouseup',   function()   { dragging=false; });
    overlay.addEventListener('mousemove', function(e) {
        if (!dragging) return;
        window._mapOffX += e.clientX-dx; window._mapOffY += e.clientY-dy;
        dx=e.clientX; dy=e.clientY;
        window._mapDirty=true; drawMap();
    });
    overlay.addEventListener('wheel', function(e) {
        e.preventDefault();
        window._mapZoom = Math.max(1, Math.min(10, window._mapZoom - Math.sign(e.deltaY)));
        window._mapDirty=true; drawMap();
    }, {passive:false});
}

function drawMap() {
    if (!_mapEl || !_mapCtx2d || !window.player) return;
    var W = window.innerWidth, H = window.innerHeight;
    if (_mapCv.width!==W || _mapCv.height!==H) { _mapCv.width=W; _mapCv.height=H; }
    var ctx  = _mapCtx2d;
    var zoom = window._mapZoom||3;
    var offX = window._mapOffX||0;
    var offY = window._mapOffY||0;
    var bs   = (window.game&&window.game.blockSize)||30;
    var pCol = Math.floor((window.player.x + window.player.width*0.5)/bs);

    // Fondo completo
    ctx.fillStyle='#080c18'; ctx.fillRect(0,0,W,H);

    var colsV = Math.ceil(W/zoom)+6;
    var c0    = Math.floor(pCol - W*0.5/zoom - offX/zoom) - 2;

    for (var dci=0; dci<colsV+8; dci++) {
        var col = c0+dci;
        var sx  = Math.floor(W*0.5 + (col-pCol)*zoom + offX);
        if (sx+zoom<0 || sx>W) continue;

        // Superficie
        if (window._explored.has(col+'_s')) {
            ctx.fillStyle=MAP_COLOR.surface;
            ctx.fillRect(sx, Math.floor(H*0.5+offY), zoom+1, zoom+1);
        }

        // Subterráneo
        var maxRow = (window.UG_MAX_DEPTH||90)+1;
        for (var row=1; row<=maxRow; row++) {
            if (!window._explored.has(col+'_'+row)) continue;
            var mat   = window.getUGCellV ? window.getUGCellV(col,row) : 'stone';
            var cy    = Math.floor(H*0.5 + row*zoom + offY);
            if (cy+zoom<0 || cy>H) continue;
            ctx.fillStyle = MAP_COLOR[mat]||MAP_COLOR.stone;
            ctx.fillRect(sx, cy, zoom+1, zoom+1);
        }
    }

    // Zonas de profundidad
    var zones=[
        {row:3,  c:'#445566', label:'Piedra'},
        {row:15, c:'#554433', label:'Carbón'},
        {row:31, c:'#665522', label:'Azufre'},
        {row:41, c:'#224455', label:'Diamante'},
        {row:50, c:'#222230', label:'Bedrock'},
    ];
    ctx.save();
    ctx.font='bold '+Math.max(10,zoom*2)+'px monospace';
    ctx.textAlign='right';
    zones.forEach(function(z){
        var zy=Math.floor(H*0.5+z.row*zoom+offY);
        if(zy<0||zy>H) return;
        ctx.globalAlpha=0.4; ctx.strokeStyle=z.c; ctx.lineWidth=1;
        ctx.setLineDash([6,4]);
        ctx.beginPath(); ctx.moveTo(0,zy); ctx.lineTo(W,zy); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha=0.9;
        ctx.fillStyle=z.c; ctx.fillText(z.label, W-12, zy-3);
    });
    ctx.restore();

    // Jugador
    var mx=Math.floor(W*0.5+offX), my=Math.floor(H*0.5+offY);
    ctx.fillStyle='#fff'; ctx.strokeStyle='#ff0'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(mx,my,Math.max(4,zoom*0.8),0,Math.PI*2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle='#fff'; ctx.font='bold 13px monospace'; ctx.textAlign='left';
    ctx.fillText(window.player.name||'Tú', mx+8, my-4);

    // HUD
    var hud=document.getElementById('map-hud');
    if(hud){
        var cd2=window.getTerrainCol?window.getTerrainCol(pCol):null;
        var topY2=(cd2&&cd2.type!=='hole')?cd2.topY:(window.game.baseGroundLevel||510);
        var depth=Math.max(0,Math.floor((window.player.y-topY2)/bs));
        hud.innerHTML=
            '<span style="color:#7df9ff"><b>Semilla:</b></span> '+(window.seedCode||'?')+'<br>'+
            '<span style="color:#aaa"><b>Explorado:</b></span> '+window._explored.size+' celdas<br>'+
            '<span style="color:#aaa"><b>Columna:</b></span> '+pCol+'  <b>Prof:</b> '+depth+' bloques<br>'+
            '<span style="color:#aaa"><b>Zoom:</b></span> '+zoom+'×';
    }
    window._mapDirty=false;
}

// ── API pública ───────────────────────────────────────────────────
window.toggleMap = function() {
    buildMapOverlay();
    window._mapOpen = !window._mapOpen;
    _mapEl.style.display = window._mapOpen ? 'block' : 'none';
    if (window._mapOpen) {
        window._mapOffX=0; window._mapOffY=0; window._mapZoom=3;
        window._mapDirty=true; drawMap();
    }
};

window.renderMap = function() { if(window._mapOpen) drawMap(); };

// ── Listener independiente para tecla M ──────────────────────────
// Se registra aquí (map.js) para que no dependa de ninguna guarda
// de game.js (isDead, placementMode, foco de input, etc.).
// Única condición: el juego debe estar corriendo y el chat no enfocado.
document.addEventListener('keydown', function _mapKeyHandler(e) {
    if (e.key !== 'm' && e.key !== 'M') return;
    if (!window.game?.isRunning) return;
    const ae = document.activeElement;
    if (ae && (ae.id === 'chat-input' || ['INPUT','TEXTAREA','SELECT'].includes(ae.tagName))) return;
    e.preventDefault();
    if (window.toggleMap) window.toggleMap();
});

// Loop liviano
(function loop(){
    if(window._mapOpen && window._mapDirty) drawMap();
    requestAnimationFrame(loop);
})();

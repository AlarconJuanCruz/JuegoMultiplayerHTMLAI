const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static('public'));

// ─── CONFIGURACIÓN ───────────────────────────────────────────────────────────
const MAX_PLAYERS     = 10;
const MOVEMENT_RATE   = 50;   // ms mínimo entre playerMovement (20 pps máx)
const WORLDUPDATE_RATE= 80;   // ms mínimo entre worldUpdates normales
const PVP_RATE        = 120;  // ms mínimo entre pvp_hit
const MAX_NAME_LEN    = 15;
const MAX_CHAT_LEN    = 120;
const MAX_BLOCKS      = 2000;
const MAX_DROPPED     = 200;
const MAX_ARROWS      = 100;
const MAX_KILLED      = 500;

// ─── ESTADO GLOBAL ───────────────────────────────────────────────────────────
const players     = {};
const serverStart = Date.now();

// Semilla del mundo — se puede resetear via API cuando no hay jugadores
let worldSeed = Math.floor(Math.random() * 0xFFFFFF) + 1;
function seedToCode(n) { return n.toString(36).toUpperCase().padStart(5, '0'); }
let seedCode = seedToCode(worldSeed);

// Estado persistente del mundo
const worldState = {
    blocks:        [],
    droppedItems:  [],
    removedTrees:  [],
    removedRocks:  [],
    treeState:     {},
    killedEntities:[],
    stuckArrows:   [],
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function playerCount() { return Object.keys(players).length; }

function sanitizeName(raw) {
    if (typeof raw !== 'string') return 'Jugador';
    return raw.replace(/[<>\"'&]/g, '').trim().substring(0, MAX_NAME_LEN) || 'Jugador';
}

function isValidNumber(v) { return typeof v === 'number' && isFinite(v); }

function isValidBlock(b) {
    return b && isValidNumber(b.x) && isValidNumber(b.y) &&
           typeof b.type === 'string' && b.type.length < 30;
}

// Rate-limiter simple por socket + clave
function makeRateLimiter(ms) {
    const last = {};
    return function allow(key) {
        const now = Date.now();
        if ((now - (last[key] || 0)) < ms) return false;
        last[key] = now;
        return true;
    };
}

// ─── LIMPIEZA PERIÓDICA ───────────────────────────────────────────────────────
// Evita memory leaks: elimina items caídos viejos y entidades muertas acumuladas
setInterval(() => {
    // Items caídos: máximo MAX_DROPPED, eliminar los más viejos (FIFO)
    if (worldState.droppedItems.length > MAX_DROPPED)
        worldState.droppedItems.splice(0, worldState.droppedItems.length - MAX_DROPPED);

    // Flechas: máximo MAX_ARROWS
    if (worldState.stuckArrows.length > MAX_ARROWS)
        worldState.stuckArrows.splice(0, worldState.stuckArrows.length - MAX_ARROWS);

    // killedEntities: máximo MAX_KILLED (IDs son cortos, no es crítico pero por si acaso)
    if (worldState.killedEntities.length > MAX_KILLED)
        worldState.killedEntities.splice(0, worldState.killedEntities.length - MAX_KILLED);

}, 60_000); // cada 1 minuto

// ─── REST API ─────────────────────────────────────────────────────────────────
// GET  /api/status  → estado del servidor (jugadores, semilla, uptime)
app.get('/api/status', (req, res) => {
    res.json({
        players:    playerCount(),
        maxPlayers: MAX_PLAYERS,
        seed:       seedCode,
        uptime:     Math.floor((Date.now() - serverStart) / 1000),
        blocks:     worldState.blocks.length,
        dropped:    worldState.droppedItems.length,
    });
});

// POST /api/reset-seed  → resetea semilla y mundo (solo si no hay jugadores)
app.post('/api/reset-seed', (req, res) => {
    if (playerCount() > 0)
        return res.status(409).json({ error: 'Hay jugadores conectados', players: playerCount() });

    const body = req.body || {};

    if (body.seed) {
        // Aplicar semilla específica
        const n = parseInt(String(body.seed).toUpperCase(), 36);
        if (!isNaN(n) && n > 0) {
            worldSeed = n;
            seedCode  = seedToCode(n);
        } else {
            return res.status(400).json({ error: 'Código de semilla inválido' });
        }
    } else {
        // Generar nueva semilla aleatoria
        worldSeed = Math.floor(Math.random() * 0xFFFFFF) + 1;
        seedCode  = seedToCode(worldSeed);
    }

    // Limpiar estado del mundo
    worldState.blocks         = [];
    worldState.droppedItems   = [];
    worldState.removedTrees   = [];
    worldState.removedRocks   = [];
    worldState.treeState      = {};
    worldState.killedEntities = [];
    worldState.stuckArrows    = [];

    console.log(`[RESET] Mundo reseteado. Nueva semilla: ${seedCode}`);
    // Notificar a todos los clientes conectados para que recarguen el mundo
    io.emit('worldReset', { seed: seedCode, seedNumber: worldSeed });
    res.json({ ok: true, seed: seedCode, seedNumber: worldSeed });
});

// ─── SOCKET.IO ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {

    // Límite de jugadores
    if (playerCount() >= MAX_PLAYERS) {
        socket.emit('serverFull');
        socket.disconnect(true);
        return;
    }

    // Rate limiters propios de este socket
    const rlMove = makeRateLimiter(MOVEMENT_RATE);
    const rlWorld = makeRateLimiter(WORLDUPDATE_RATE);
    const rlPvp   = makeRateLimiter(PVP_RATE);

    // Enviar estado inicial + semilla
    socket.emit('timeSync', Date.now() - serverStart);
    socket.emit('worldSeed', { seed: seedCode, seedNumber: worldSeed });
    socket.emit('initWorldState', worldState);

    // ── joinGame ────────────────────────────────────────────────
    socket.on('joinGame', (data) => {
        if (!data || typeof data !== 'object') return;
        if (playerCount() >= MAX_PLAYERS) { socket.emit('serverFull'); socket.disconnect(true); return; }

        players[socket.id] = {
            id:    socket.id,
            name:  sanitizeName(data.name),
            x:     isValidNumber(data.x) ? data.x : 300,
            y:     isValidNumber(data.y) ? data.y : 400,
            level: (typeof data.level === 'number' && data.level > 0 && data.level < 200) ? data.level : 1,
            chatText:    '',
            chatExpires: 0,
        };
        io.emit('currentPlayers', players);
        console.log(`[+] ${players[socket.id].name} (${socket.id}) — ${playerCount()}/${MAX_PLAYERS} jugadores`);
    });

    // ── playerMovement ──────────────────────────────────────────
    socket.on('playerMovement', (data) => {
        if (!data || !players[socket.id]) return;
        if (!rlMove(socket.id)) return; // rate limit

        // Validar coordenadas mínimas
        if (!isValidNumber(data.x) || !isValidNumber(data.y)) return;

        // Clamp anti-teleport: máximo 600px por tick a 50ms = 12000px/s → razonable
        const p = players[socket.id];
        const dx = Math.abs(data.x - p.x), dy = Math.abs(data.y - p.y);
        if (dx > 600 || dy > 600) {
            // Teleport sospechoso: ignorar pero actualizar silenciosamente
            p.x = data.x; p.y = data.y;
            return;
        }

        Object.assign(p, {
            x:           data.x,
            y:           data.y,
            vx:          isValidNumber(data.vx)  ? data.vx  : 0,
            vy:          isValidNumber(data.vy)  ? data.vy  : 0,
            facingRight: !!data.facingRight,
            activeTool:  typeof data.activeTool === 'string' ? data.activeTool.substring(0,20) : 'hand',
            animTime:    isValidNumber(data.animTime)    ? data.animTime    : 0,
            attackFrame: isValidNumber(data.attackFrame) ? data.attackFrame : 0,
            isAiming:    !!data.isAiming,
            isCharging:  !!data.isCharging,
            chargeLevel: isValidNumber(data.chargeLevel) ? data.chargeLevel : 0,
            isDead:      !!data.isDead,
            level:       (typeof data.level === 'number' && data.level > 0 && data.level < 200) ? data.level : p.level,
            mouseX:      isValidNumber(data.mouseX) ? data.mouseX : 0,
            mouseY:      isValidNumber(data.mouseY) ? data.mouseY : 0,
            deathAnimFrame: isValidNumber(data.deathAnimFrame) ? data.deathAnimFrame : 0,
        });

        socket.broadcast.emit('playerMoved', p);
    });

    // ── worldUpdate ─────────────────────────────────────────────
    socket.on('worldUpdate', (data) => {
        if (!data || typeof data.action !== 'string') return;

        const action  = data.action;
        const payload = data.payload || {};

        // ── PVP: relay con rate-limit propio ──────────────────
        if (action.startsWith('pvp_')) {
            if (action === 'pvp_hit' && !rlPvp(socket.id)) return;
            // No persistir PVP en worldState, solo reenviar
            socket.broadcast.emit('worldUpdate', data);
            return;
        }

        // ── player_death: relay + log ─────────────────────────
        if (action === 'player_death') {
            socket.broadcast.emit('worldUpdate', data);
            const name = sanitizeName(players[socket.id]?.name || '?');
            console.log(`[☠] ${name} murió: ${payload.source || '?'}`);
            return;
        }

        // ── Rate limit para el resto ───────────────────────────
        if (!rlWorld(socket.id)) return;

        // ── Persistencia del mundo ─────────────────────────────
        switch (action) {

            case 'place_block':
                if (!isValidBlock(payload.block)) return;
                if (worldState.blocks.length >= MAX_BLOCKS) {
                    // Eliminar el bloque más antiguo que no sea cama/caja/tumba
                    const idx = worldState.blocks.findIndex(b => !['bed','box','grave'].includes(b.type));
                    if (idx !== -1) worldState.blocks.splice(idx, 1);
                }
                worldState.blocks.push(payload.block);
                break;

            case 'remove_old_bed':
                if (typeof payload.owner === 'string')
                    worldState.blocks = worldState.blocks.filter(b => b.type !== 'bed' || b.owner !== payload.owner);
                break;

            case 'hit_block':
                if (payload.destroyed && isValidNumber(payload.x) && isValidNumber(payload.y))
                    worldState.blocks = worldState.blocks.filter(b => !(b.x === payload.x && b.y === payload.y));
                break;

            case 'interact_door': {
                const d = worldState.blocks.find(b => b.x === payload.x && b.y === payload.y);
                if (d) d.open = !d.open;
                break;
            }

            case 'update_box':
            case 'update_campfire': {
                const b = worldState.blocks.find(bl => bl.x === payload.x && bl.y === payload.y);
                if (b) Object.assign(b, payload);
                break;
            }

            case 'destroy_grave':
                if (typeof payload.id === 'string')
                    worldState.blocks = worldState.blocks.filter(b => b.id !== payload.id);
                break;

            case 'stump_tree':
                if (isValidNumber(payload.x))
                    worldState.treeState[payload.x] = { isStump: true, regrowthCount: payload.regrowthCount || 0, grownDay: payload.grownDay || -1 };
                break;

            case 'grow_tree':
                if (isValidNumber(payload.x))
                    worldState.treeState[payload.x] = { isStump: false, regrowthCount: payload.regrowthCount || 0, grownDay: payload.grownDay || -1 };
                break;

            case 'destroy_tree':
                if (isValidNumber(payload.x)) {
                    worldState.removedTrees.push(payload.x);
                    delete worldState.treeState[payload.x];
                }
                break;

            case 'destroy_rock':
                if (isValidNumber(payload.x))
                    worldState.removedRocks.push(payload.x);
                break;

            case 'drop_item':
                if (payload.item && typeof payload.item.id === 'string' && typeof payload.item.type === 'string') {
                    if (worldState.droppedItems.length < MAX_DROPPED)
                        worldState.droppedItems.push(payload.item);
                }
                break;

            case 'pickup_item':
                if (typeof payload.id === 'string')
                    worldState.droppedItems = worldState.droppedItems.filter(i => i.id !== payload.id);
                break;

            case 'kill_entity':
                if (typeof payload.id === 'string' && !worldState.killedEntities.includes(payload.id))
                    worldState.killedEntities.push(payload.id);
                break;

            case 'spawn_stuck_arrow':
                if (payload.id && worldState.stuckArrows.length < MAX_ARROWS)
                    worldState.stuckArrows.push(payload);
                break;

            case 'remove_stuck_arrow':
                if (typeof payload.id === 'string')
                    worldState.stuckArrows = worldState.stuckArrows.filter(sa => sa.id !== payload.id);
                break;
        }

        // Reenviar a todos los demás
        socket.broadcast.emit('worldUpdate', data);
    });

    // ── chatMessage ─────────────────────────────────────────────
    socket.on('chatMessage', (text) => {
        if (typeof text !== 'string') return;
        const clean = text.replace(/[<>]/g, '').trim().substring(0, MAX_CHAT_LEN);
        if (!clean) return;
        if (players[socket.id]) {
            players[socket.id].chatText    = clean;
            players[socket.id].chatExpires = Date.now() + 6500;
        }
        io.emit('chatMessage', { id: socket.id, text: clean });
    });

    // ── disconnect ──────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
        if (players[socket.id]) {
            console.log(`[-] ${players[socket.id].name} desconectado (${reason}) — ${playerCount() - 1}/${MAX_PLAYERS}`);
            delete players[socket.id];
            io.emit('currentPlayers', players);
        }
    });
});

// ─── ARRANQUE ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`╔══════════════════════════════════════════╗`);
    console.log(`║   SERVIDOR SURVIVAL RPG — puerto ${PORT}    ║`);
    console.log(`║   Semilla inicial: ${seedCode.padEnd(20)}║`);
    console.log(`║   Jugadores máx:   ${String(MAX_PLAYERS).padEnd(20)}║`);
    console.log(`╚══════════════════════════════════════════╝`);
});

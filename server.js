const express = require('express');
const cors    = require('cors');
const http    = require('http');
const fs      = require('fs');
const path    = require('path');
const { Server } = require('socket.io');

// ── Versión del servidor ───────────────────────────────────────────────────────
// Incrementar este número cada vez que se despliega una actualización importante
// de client-side (game.js, render_world.js, physics.js, etc.) para que los clientes
// con caché vieja detecten el mismatch y hagan reload automático.
const SERVER_VERSION = 36;  // ← bump this on every deploy

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.static('public'));

// ── Persistencia en disco ─────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Clave de persistencia: sala global → '__global__', otras → id aleatorio.
function _persistKey(room) {
    return room.name === '__global__' ? '__global__' : room.id;
}

// Escritura async con debounce por sala.
// Colapsa múltiples saves rápidos en uno solo (200ms), nunca bloquea el event loop.
const _pendingWrites = new Map();
function saveRoomState(room) {
    const key  = _persistKey(room);
    const file = path.join(DATA_DIR, `${key}.json`);
    if (_pendingWrites.has(key)) clearTimeout(_pendingWrites.get(key));
    const payload = JSON.stringify(room.worldState); // capturar estado ahora
    const tid = setTimeout(() => {
        _pendingWrites.delete(key);
        fs.writeFile(file, payload, 'utf8', err => {
            if (err) console.error(`[persist] Error guardando ${key}:`, err.message);
        });
    }, 200);
    _pendingWrites.set(key, tid);
}

// Guardado inmediato (síncrono) — solo para eventos críticos donde el proceso
// puede terminar poco después (disconnect, vaciado de sala, mine_cell roto).
function saveRoomStateNow(room) {
    const key  = _persistKey(room);
    const file = path.join(DATA_DIR, `${key}.json`);
    // Cancelar cualquier write pendiente para esta sala (ya lo incluimos aquí)
    if (_pendingWrites.has(key)) { clearTimeout(_pendingWrites.get(key)); _pendingWrites.delete(key); }
    try {
        fs.writeFileSync(file, JSON.stringify(room.worldState), 'utf8');
    } catch (e) {
        console.error(`[persist] Error guardando (sync) ${key}:`, e.message);
    }
}

function loadRoomState(persistKey) {
    try {
        const file = path.join(DATA_DIR, `${persistKey}.json`);
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        console.error(`[persist] Error cargando ${persistKey}:`, e.message);
    }
    return null;
}

// ── Límites globales ──────────────────────────────────────────────────────────
const MAX_ROOMS     = 10;
const MAX_PLAYERS   = 10;
const ROOM_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// ── Registro de salas ─────────────────────────────────────────────────────────
const rooms = {};

// ── Respaldo periódico (salas activas, cada 60s) ──────────────────────────────
setInterval(() => {
    for (const room of Object.values(rooms)) {
        if (Object.keys(room.players).length > 0) saveRoomState(room);
    }
}, 60_000);

// ── Limpieza de salas vacías (cada 60s) ───────────────────────────────────────
setInterval(() => {
    for (const [id, room] of Object.entries(rooms)) {
        // La sala global NUNCA se elimina de memoria.
        // Si se borrara, al reconectar se llamaría loadRoomState que lee el
        // archivo — pero saveRoomState es async/debounced y puede no haber
        // flusheado aún los últimos minedCells, perdiendo celdas recientes.
        // Mantenerla en memoria garantiza que el estado en RAM siempre es el más reciente.
        if (room.name === '__global__') { saveRoomStateNow(room); continue; }
        if (Object.keys(room.players).length === 0) {
            saveRoomStateNow(room);
            delete rooms[id];
            console.log(`[rooms] Sala ${id} guardada y eliminada por inactividad`);
        }
    }
}, 60_000);

// ── Utilidades ────────────────────────────────────────────────────────────────
function makeRoomId() {
    let id = '';
    for (let i = 0; i < 6; i++) id += ROOM_ID_CHARS[Math.floor(Math.random() * ROOM_ID_CHARS.length)];
    return id;
}

function freshWorldState(seedCode) {
    return {
        blocks: [], droppedItems: [], removedTrees: [], removedRocks: [],
        treeState: {}, killedEntities: [], stuckArrows: [],
        minedCells: {},
        seedCode: seedCode || null
    };
}

function publicRoomList() {
    return Object.values(rooms).map(r => ({
        id:         r.id,
        name:       r.name,
        hostName:   r.hostName,
        players:    Object.keys(r.players).length,
        maxPlayers: MAX_PLAYERS,
        seedCode:   r.worldState.seedCode || '?????',
        createdAt:  r.createdAt
    }));
}

function sanitize(str, maxLen = 30) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>"'`]/g, '').substring(0, maxLen).trim();
}

// ── REST API ──────────────────────────────────────────────────────────────────
app.get('/api/rooms', (_req, res) => res.json(publicRoomList()));

app.post('/api/rooms', express.json(), (req, res) => {
    if (Object.keys(rooms).length >= MAX_ROOMS)
        return res.status(429).json({ error: `Límite de ${MAX_ROOMS} salas alcanzado.` });
    const name     = sanitize(req.body?.name || 'Sala sin nombre');
    const hostName = sanitize(req.body?.hostName || 'Anónimo', 15);
    const seedCode = sanitize(req.body?.seedCode || '', 10) || null;
    const id       = makeRoomId();
    rooms[id] = { id, name, hostName, players: {}, worldState: freshWorldState(seedCode), createdAt: Date.now() };
    console.log(`[rooms] Sala creada: ${id} "${name}" por ${hostName}`);
    res.json({ id, name, seedCode: rooms[id].worldState.seedCode });
});

app.get('/api/status', (_req, res) => {
    const globalRoom = Object.values(rooms).find(r => r.name === '__global__');
    res.json({
        players:      globalRoom ? Object.keys(globalRoom.players).length : 0,
        maxPlayers:   MAX_PLAYERS,
        seedCode:     globalRoom?.worldState.seedCode ?? 'Aleatoria',
        rooms:        Object.keys(rooms).length,
        maxRooms:     MAX_ROOMS,
        totalPlayers: Object.values(rooms).reduce((s, r) => s + Object.keys(r.players).length, 0),
        uptime:       Math.floor(process.uptime())
    });
});

// ── Rate limiting por socket ──────────────────────────────────────────────────
const RATE_LIMIT_MS  = 1000;
const RATE_LIMIT_MAX = 60;
const socketRates    = new Map();

function isRateLimited(socketId) {
    const now  = Date.now();
    const data = socketRates.get(socketId) ?? { count: 0, windowStart: now };
    if (now - data.windowStart > RATE_LIMIT_MS) { data.count = 0; data.windowStart = now; }
    data.count++;
    socketRates.set(socketId, data);
    return data.count > RATE_LIMIT_MAX;
}

// ── Socket.IO ─────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {

    // ── joinRoom ──────────────────────────────────────────────────────────────
    socket.on('joinRoom', ({ roomId, playerData }) => {
        const room = rooms[roomId];
        if (!room)
            return socket.emit('roomError', { code: 'NOT_FOUND', message: 'La sala no existe o ya fue cerrada.' });
        if (Object.keys(room.players).length >= MAX_PLAYERS)
            return socket.emit('roomError', { code: 'FULL', message: 'La sala está llena.' });

        const safeData = {
            name:     sanitize(playerData?.name ?? 'Jugador', 15),
            x:        Number(playerData?.x)  || 250,
            y:        Number(playerData?.y)  || 100,
            level:    Math.max(1, Math.min(9999, parseInt(playerData?.level) || 1)),
            seedCode: sanitize(playerData?.seedCode ?? '', 10) || null
        };

        socket.roomId = roomId;
        socket.join(roomId);
        socket.emit('serverVersion', SERVER_VERSION);  // cliente verifica compatibilidad
        socket.emit('timeSync', Date.now() - room.createdAt);
        socket.emit('initWorldState', room.worldState);

        if (Object.keys(room.players).length === 0 && !room.worldState.seedCode && safeData.seedCode) {
            // Primera persona en entrar: registrar la semilla del cliente como semilla del mundo
            room.worldState.seedCode = safeData.seedCode;
        }
        // Enviar worldSeed UNA SOLA VEZ (evitar doble applySeed en el cliente)
        if (room.worldState.seedCode) socket.emit('worldSeed', { seed: room.worldState.seedCode });

        io.to(roomId).emit('currentPlayers', room.players);
        io.emit('roomListUpdate', publicRoomList());
        console.log(`[rooms] ${safeData.name} unido a sala ${roomId} (${Object.keys(room.players).length}/${MAX_PLAYERS})`);
    });

    // ── joinGame (sala global) ────────────────────────────────────────────────
    socket.on('joinGame', (playerData) => {
        if (socket.roomId) return;

        let globalRoom = Object.values(rooms).find(r => r.name === '__global__');
        if (!globalRoom) {
            const id         = makeRoomId();
            const savedGlobal = loadRoomState('__global__');
            const ws          = savedGlobal || freshWorldState(playerData?.seedCode ?? null);
            rooms[id]    = { id, name: '__global__', hostName: 'Sistema', players: {}, worldState: ws, createdAt: Date.now() };
            globalRoom   = rooms[id];
            if (savedGlobal)
                console.log(`[persist] Sala global restaurada (${Object.keys(savedGlobal.minedCells || {}).length} celdas minadas, ${(savedGlobal.blocks||[]).length} bloques)`);
        }
        if (Object.keys(globalRoom.players).length >= MAX_PLAYERS) return socket.emit('serverFull');

        const safeData = {
            name:     sanitize(playerData?.name ?? 'Jugador', 15),
            x:        Number(playerData?.x)  || 250,
            y:        Number(playerData?.y)  || 100,
            level:    Math.max(1, Math.min(9999, parseInt(playerData?.level) || 1)),
            seedCode: sanitize(playerData?.seedCode ?? '', 10) || null
        };

        socket.roomId = globalRoom.id;
        socket.join(globalRoom.id);
        socket.emit('serverVersion', SERVER_VERSION);  // cliente verifica compatibilidad
        socket.emit('timeSync', Date.now() - globalRoom.createdAt);
        socket.emit('initWorldState', globalRoom.worldState);
        if (globalRoom.worldState.seedCode) socket.emit('worldSeed', { seed: globalRoom.worldState.seedCode });

        globalRoom.players[socket.id] = { id: socket.id, ...safeData };
        if (Object.keys(globalRoom.players).length === 1 && !globalRoom.worldState.seedCode && safeData.seedCode)
            globalRoom.worldState.seedCode = safeData.seedCode;

        io.to(globalRoom.id).emit('currentPlayers', globalRoom.players);
        io.emit('roomListUpdate', publicRoomList());
    });

    // ── playerMovement ────────────────────────────────────────────────────────
    socket.on('playerMovement', (data) => {
        const room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        const p = room.players[socket.id];
        // Campos siempre presentes en el paquete frecuente
        Object.assign(p, {
            x:           Number(data.x)  || p.x,
            y:           Number(data.y)  || p.y,
            vx:          Number(data.vx) || 0,
            vy:          Number(data.vy) || 0,
            isGrounded:  !!data.isGrounded,
            facingRight: !!data.facingRight,
            animTime:    Number(data.animTime)    || 0,
            isDead:      !!data.isDead,
            deathAnimFrame: Number(data.deathAnimFrame) || 0,
            isClimbing:  !!data.isClimbing,
            isSprinting: !!data.isSprinting,
            isTyping:    !!data.isTyping,
        });
        // Campos opcionales: solo se actualizan cuando el cliente los envía
        // (evita resetear activeTool a 'hand' en paquetes que no lo incluyen)
        if (data.activeTool !== undefined) p.activeTool = sanitize(data.activeTool, 20) || 'hand';
        if (data.attackFrame !== undefined) p.attackFrame = Number(data.attackFrame) || 0;
        if (data.isAiming    !== undefined) p.isAiming    = !!data.isAiming;
        if (data.isCharging  !== undefined) p.isCharging  = !!data.isCharging;
        if (data.chargeLevel !== undefined) p.chargeLevel = Math.max(0, Math.min(100, Number(data.chargeLevel) || 0));
        if (data.mouseX      !== undefined) p.mouseX      = Number(data.mouseX)  || 0;
        if (data.mouseY      !== undefined) p.mouseY      = Number(data.mouseY)  || 0;
        if (data.level       !== undefined) p.level       = Math.max(1, Math.min(9999, parseInt(data.level) || p.level));
        if (data.isDancing   !== undefined) p.isDancing   = !!data.isDancing;
        if (data.danceStart  !== undefined) p.danceStart  = Number(data.danceStart) || 0;
        socket.to(socket.roomId).emit('playerMoved', { ...p, id: socket.id });
    });

    // ── worldUpdate ───────────────────────────────────────────────────────────
    socket.on('worldUpdate', (data) => {
        const room = rooms[socket.roomId];
        if (!room) return;
        if (isRateLimited(socket.id)) return;

        const ws = room.worldState;

        switch (data.action) {
            case 'place_block':
                if (data.payload?.block) ws.blocks.push(data.payload.block);
                break;

            case 'hit_block': {
                const b = ws.blocks.find(bl => bl.x === data.payload?.x && bl.y === data.payload?.y);
                if (b) {
                    b.hp -= (Number(data.payload.dmg) || 0);
                    if (data.payload.destroyed || b.hp <= 0) ws.blocks = ws.blocks.filter(bl => bl !== b);
                }
                break;
            }

            case 'interact_door': {
                const d = ws.blocks.find(bl => bl.x === data.payload?.x && bl.y === data.payload?.y);
                if (d) d.open = !d.open;
                break;
            }

            case 'update_box': {
                const b = ws.blocks.find(bl => bl.x === data.payload?.x && bl.y === data.payload?.y);
                if (b) b.inventory = data.payload.inventory;
                break;
            }

            case 'update_campfire': {
                const b = ws.blocks.find(bl => bl.x === data.payload?.x && bl.y === data.payload?.y);
                if (b) { b.wood = data.payload.wood; b.meat = data.payload.meat; b.cooked = data.payload.cooked; b.isBurning = data.payload.isBurning; }
                break;
            }

            case 'update_turret': {
                const b = ws.blocks.find(bl => bl.x === data.payload?.x && bl.y === data.payload?.y);
                if (b) { b.arrows = data.payload.arrows; }
                break;
            }

            case 'drop_item':
                if (data.payload?.item) ws.droppedItems.push(data.payload.item);
                break;

            case 'pickup_item':
                ws.droppedItems = ws.droppedItems.filter(i => i.id !== data.payload?.id);
                break;

            case 'stump_tree':
                ws.treeState[data.payload.x] = { isStump: true,  regrowthCount: data.payload.regrowthCount, grownDay: data.payload.grownDay };
                break;

            case 'grow_tree':
                ws.treeState[data.payload.x] = { isStump: false, regrowthCount: data.payload.regrowthCount, grownDay: data.payload.grownDay };
                break;

            case 'destroy_tree':
                ws.removedTrees.push(data.payload.x);
                delete ws.treeState[data.payload.x];
                break;

            case 'destroy_rock':
                ws.removedRocks.push(data.payload.x);
                break;

            case 'destroy_grave':
                ws.blocks = ws.blocks.filter(b => b.id !== data.payload?.id);
                break;

            case 'kill_entity':
                if (data.payload?.id) ws.killedEntities.push(data.payload.id);
                break;

            case 'spawn_stuck_arrow':
                if (data.payload) ws.stuckArrows.push(data.payload);
                break;

            case 'mine_cell': {
                const mc = data.payload;
                if (mc && typeof mc.col === 'number' && typeof mc.row === 'number') {
                    if (!ws.minedCells) ws.minedCells = {};
                    if (mc.broken === true) {
                        ws.minedCells[mc.col + '_' + mc.row] = true;
                        // Guardar de forma inmediata/síncrona para que ningún disconnect
                        // o cierre de proceso pierda la celda recién rota.
                        saveRoomStateNow(room);
                    }
                }
                break;
            }

            case 'remove_stuck_arrow':
                ws.stuckArrows = ws.stuckArrows.filter(sa => sa.id !== data.payload?.id);
                break;

            case 'remove_old_bed':
                ws.blocks = ws.blocks.filter(b => !(b.type === 'bed' && b.ownerSocketId === socket.id));
                break;
        }

        // Parchar ownerSocketId en camas recién colocadas
        if (data.action === 'place_block' && data.payload?.block?.type === 'bed') {
            const newBed = ws.blocks[ws.blocks.length - 1];
            if (newBed && newBed.type === 'bed') newBed.ownerSocketId = socket.id;
        }

        // Guardar en disco cuando cambian bloques construidos (colapsa en 200ms)
        if (data.action === 'place_block' || data.action === 'hit_block' || data.action === 'destroy_grave')
            saveRoomState(room);

        // Broadcast
        socket.to(socket.roomId).emit('worldUpdate', data);
    });

    // ── chatMessage ───────────────────────────────────────────────────────────
    socket.on('chatMessage', (text) => {
        const room = rooms[socket.roomId];
        if (!room) return;
        const safeText = sanitize(String(text ?? ''), 200);
        if (!safeText) return;
        io.to(socket.roomId).emit('chatMessage', { id: socket.id, text: safeText });
    });

    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
        const room = rooms[socket.roomId];
        if (!room) return;

        // Limpiar camas del jugador desconectado
        const hasBeds = room.worldState.blocks.some(b => b.type === 'bed' && b.ownerSocketId === socket.id);
        if (hasBeds) {
            room.worldState.blocks = room.worldState.blocks.filter(b => !(b.type === 'bed' && b.ownerSocketId === socket.id));
            socket.to(socket.roomId).emit('worldUpdate', {
                action: 'cleanup_player_beds',
                payload: { socketId: socket.id }
            });
        }

        delete room.players[socket.id];
        socketRates.delete(socket.id);

        // Guardar de forma inmediata al desconectar: si el servidor termina justo
        // después del disconnect, saveRoomState (debounced) podría no ejecutarse.
        saveRoomStateNow(room);
        if (Object.keys(room.players).length === 0)
            console.log(`[persist] Sala ${room.id} (${_persistKey(room)}) guardada al quedar vacía`);

        io.to(socket.roomId).emit('playerDisconnected', socket.id);
        io.to(socket.roomId).emit('currentPlayers', room.players);
        io.emit('roomListUpdate', publicRoomList());
        console.log(`[rooms] ${socket.id} salió de sala ${socket.roomId} (quedan ${Object.keys(room.players).length})`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor multijugador corriendo en puerto ${PORT}`);
});

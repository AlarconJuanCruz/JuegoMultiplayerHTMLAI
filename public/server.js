const express = require('express');
const cors    = require('cors');
const http    = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.static('public'));

// ── Límites globales ──────────────────────────────────────────────────────────
const MAX_ROOMS     = 10;
const MAX_PLAYERS   = 10;
const ROOM_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// ── Registro de salas ─────────────────────────────────────────────────────────
// rooms[roomId] = { id, name, hostName, players:{}, worldState:{}, createdAt, seedCode }
const rooms = {};

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

// ── Sanitización de strings de entrada ───────────────────────────────────────
function sanitize(str, maxLen = 30) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>"'`]/g, '').substring(0, maxLen).trim();
}

// ── Limpieza periódica de salas vacías ────────────────────────────────────────
setInterval(() => {
    for (const [id, room] of Object.entries(rooms)) {
        if (Object.keys(room.players).length === 0) {
            delete rooms[id];
            console.log(`[rooms] Sala ${id} eliminada por inactividad`);
        }
    }
}, 60_000);

// ── REST API ──────────────────────────────────────────────────────────────────

app.get('/api/rooms', (_req, res) => res.json(publicRoomList()));

app.post('/api/rooms', express.json(), (req, res) => {
    if (Object.keys(rooms).length >= MAX_ROOMS) {
        return res.status(429).json({ error: `Límite de ${MAX_ROOMS} salas alcanzado.` });
    }
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

// ── Rate limiting por socket (worldUpdate) ────────────────────────────────────
// Permite hasta 60 updates/seg para prevenir spam; ajustar según necesidad.
const RATE_LIMIT_MS   = 1000;
const RATE_LIMIT_MAX  = 60;
const socketRates     = new Map(); // socketId → { count, windowStart }

function isRateLimited(socketId) {
    const now  = Date.now();
    const data = socketRates.get(socketId) ?? { count: 0, windowStart: now };
    if (now - data.windowStart > RATE_LIMIT_MS) {
        data.count = 0;
        data.windowStart = now;
    }
    data.count++;
    socketRates.set(socketId, data);
    return data.count > RATE_LIMIT_MAX;
}

// ── Socket.IO ─────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {

    // ── joinRoom ──────────────────────────────────────────────────────────────
    socket.on('joinRoom', ({ roomId, playerData }) => {
        const room = rooms[roomId];
        if (!room)                                          return socket.emit('roomError', { code: 'NOT_FOUND',  message: 'La sala no existe o ya fue cerrada.' });
        if (Object.keys(room.players).length >= MAX_PLAYERS) return socket.emit('roomError', { code: 'FULL',      message: 'La sala está llena.' });

        const safeData = {
            name:     sanitize(playerData?.name ?? 'Jugador', 15),
            x:        Number(playerData?.x)  || 250,
            y:        Number(playerData?.y)  || 100,
            level:    Math.max(1, Math.min(9999, parseInt(playerData?.level) || 1)),
            seedCode: sanitize(playerData?.seedCode ?? '', 10) || null
        };

        socket.roomId = roomId;
        socket.join(roomId);

        socket.emit('timeSync', Date.now() - room.createdAt);
        socket.emit('initWorldState', room.worldState);
        if (room.worldState.seedCode) socket.emit('worldSeed', { seed: room.worldState.seedCode });

        room.players[socket.id] = { id: socket.id, ...safeData };

        if (Object.keys(room.players).length === 1 && !room.worldState.seedCode && safeData.seedCode) {
            room.worldState.seedCode = safeData.seedCode;
            socket.emit('worldSeed', { seed: room.worldState.seedCode });
        } else if (room.worldState.seedCode) {
            socket.emit('worldSeed', { seed: room.worldState.seedCode });
        }

        io.to(roomId).emit('currentPlayers', room.players);
        io.emit('roomListUpdate', publicRoomList());
        console.log(`[rooms] ${safeData.name} unido a sala ${roomId} (${Object.keys(room.players).length}/${MAX_PLAYERS})`);
    });

    // ── joinGame (retrocompatibilidad → sala global) ───────────────────────────
    socket.on('joinGame', (playerData) => {
        if (socket.roomId) return;

        let globalRoom = Object.values(rooms).find(r => r.name === '__global__');
        if (!globalRoom) {
            const id = makeRoomId();
            rooms[id] = { id, name: '__global__', hostName: 'Sistema', players: {}, worldState: freshWorldState(playerData?.seedCode ?? null), createdAt: Date.now() };
            globalRoom = rooms[id];
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
        socket.emit('timeSync', Date.now() - globalRoom.createdAt);
        socket.emit('initWorldState', globalRoom.worldState);
        if (globalRoom.worldState.seedCode) socket.emit('worldSeed', { seed: globalRoom.worldState.seedCode });

        globalRoom.players[socket.id] = { id: socket.id, ...safeData };
        if (Object.keys(globalRoom.players).length === 1 && !globalRoom.worldState.seedCode && safeData.seedCode) {
            globalRoom.worldState.seedCode = safeData.seedCode;
        }
        io.to(globalRoom.id).emit('currentPlayers', globalRoom.players);
        io.emit('roomListUpdate', publicRoomList());
    });

    // ── playerMovement ────────────────────────────────────────────────────────
    socket.on('playerMovement', (data) => {
        const room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        // Solo actualizar campos seguros (no dejar que el cliente sobreescriba id)
        const p = room.players[socket.id];
        Object.assign(p, {
            x: Number(data.x) || p.x, y: Number(data.y) || p.y,
            vx: Number(data.vx) || 0,  vy: Number(data.vy) || 0,
            isGrounded:  !!data.isGrounded,
            facingRight: !!data.facingRight,
            activeTool:  sanitize(data.activeTool ?? 'hand', 20),
            animTime:    Number(data.animTime) || 0,
            attackFrame: Number(data.attackFrame) || 0,
            isAiming:    !!data.isAiming,
            isCharging:  !!data.isCharging,
            chargeLevel: Math.max(0, Math.min(100, Number(data.chargeLevel) || 0)),
            mouseX:      Number(data.mouseX) || 0,
            mouseY:      Number(data.mouseY) || 0,
            isDead:      !!data.isDead,
            level:       Math.max(1, Math.min(9999, parseInt(data.level) || p.level)),
            isTyping:    !!data.isTyping,
            isDancing:   !!data.isDancing,
            danceStart:  Number(data.danceStart) || 0,
            deathAnimFrame: Number(data.deathAnimFrame) || 0,
            isClimbing:  !!data.isClimbing
        });
        socket.to(socket.roomId).emit('playerMoved', { ...p, id: socket.id });
    });

    // ── worldUpdate ───────────────────────────────────────────────────────────
    socket.on('worldUpdate', (data) => {
        const room = rooms[socket.roomId];
        if (!room) return;

        // Rate limiting: silenciosamente ignorar si supera el límite
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
                    if (b.maxHp) b.hp = Math.min(b.maxHp, b.hp); // clamp al reparar
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

            case 'remove_stuck_arrow':
                ws.stuckArrows = ws.stuckArrows.filter(sa => sa.id !== data.payload?.id);
                break;

            // FIX: remove_old_bed ahora usa socket.id en lugar de owner (string),
            // evitando bugs cuando un jugador se desconecta inesperadamente y otro
            // jugador comparte el mismo nombre.
            // El cliente sigue enviando { owner } para retrocompatibilidad, pero el
            // servidor ignora ese campo y usa el socket.id del emisor.
            case 'remove_old_bed':
                ws.blocks = ws.blocks.filter(b => !(b.type === 'bed' && b.ownerSocketId === socket.id));
                break;

            // FIX: place_block para camas: registrar ownerSocketId además de owner
            // Se parchea aquí al recibir el bloque del cliente.
            // El cliente envía { block } con block.owner = playerName.
            // Añadimos ownerSocketId para el lookup seguro en remove_old_bed.
        }

        // Parchar ownerSocketId en camas recién colocadas
        if (data.action === 'place_block' && data.payload?.block?.type === 'bed') {
            const newBed = ws.blocks[ws.blocks.length - 1];
            if (newBed && newBed.type === 'bed') newBed.ownerSocketId = socket.id;
        }

        // Broadcast a todos los demás en la sala
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

        // FIX: Al desconectarse, eliminar las camas del jugador usando socket.id
        // Esto previene el bug donde un jugador que se desconecta inesperadamente
        // deja una cama "huérfana" que nunca se limpia (el remove_old_bed del cliente
        // nunca llegaría si la conexión se cortó).
        ws_cleanup: {
            const ws = room.worldState;
            const removed = ws.blocks.filter(b => b.type === 'bed' && b.ownerSocketId === socket.id);
            if (removed.length > 0) {
                ws.blocks = ws.blocks.filter(b => !(b.type === 'bed' && b.ownerSocketId === socket.id));
                // Notificar a los demás para que limpien su estado local
                socket.to(socket.roomId).emit('worldUpdate', {
                    action: 'cleanup_player_beds',
                    payload: { socketId: socket.id }
                });
            }
        }

        delete room.players[socket.id];
        socketRates.delete(socket.id);

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

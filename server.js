const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

// ── Límites globales ──────────────────────────────────────
const MAX_ROOMS      = 10;   // salas simultáneas máx
const MAX_PLAYERS    = 10;   // jugadores por sala
const ROOM_ID_CHARS  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// ── Registro de salas ────────────────────────────────────
// rooms[roomId] = { id, name, hostName, players:{}, worldState:{}, createdAt, seedCode }
const rooms = {};

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

// ── Limpieza periódica de salas vacías ────────────────────
setInterval(() => {
    for (const [id, room] of Object.entries(rooms)) {
        if (Object.keys(room.players).length === 0) {
            delete rooms[id];
            console.log(`[rooms] Sala ${id} eliminada por inactividad`);
        }
    }
}, 60_000);

// ── REST API ─────────────────────────────────────────────

// Lista de salas activas
app.get('/api/rooms', (req, res) => {
    res.json(publicRoomList());
});

// Crear sala
app.post('/api/rooms', express.json(), (req, res) => {
    if (Object.keys(rooms).length >= MAX_ROOMS) {
        return res.status(429).json({ error: `Límite de ${MAX_ROOMS} salas alcanzado. Intentá más tarde.` });
    }
    const name     = (req.body.name || 'Sala sin nombre').substring(0, 30);
    const hostName = (req.body.hostName || 'Anónimo').substring(0, 15);
    const seedCode = req.body.seedCode || null;
    const id       = makeRoomId();

    rooms[id] = {
        id, name, hostName,
        players: {},
        worldState: freshWorldState(seedCode),
        createdAt: Date.now()
    };
    console.log(`[rooms] Sala creada: ${id} "${name}" por ${hostName}`);
    res.json({ id, name, seedCode: rooms[id].worldState.seedCode });
});

// Estado general (para ping / health check)
app.get('/api/status', (req, res) => { 
    let globalRoom = Object.values(rooms).find(r => r.name === '__global__');
    
    res.json({
        players:      globalRoom ? Object.keys(globalRoom.players).length : 0,
        maxPlayers:   MAX_PLAYERS,
        seedCode:     globalRoom ? globalRoom.worldState.seedCode : 'Aleatoria',
        rooms:        Object.keys(rooms).length,
        maxRooms:     MAX_ROOMS,
        totalPlayers: Object.values(rooms).reduce((s, r) => s + Object.keys(r.players).length, 0),
        uptime:       Math.floor(process.uptime())
    });
});

// Reset de semilla (retrocompatibilidad, afecta solo sala global si existe)
app.post('/api/reset-seed', express.json(), (req, res) => {
    res.status(400).json({ error: 'Usá el sistema de salas.' });
});

// ── Socket.IO ────────────────────────────────────────────
io.on('connection', (socket) => {

    // El cliente indica a qué sala quiere unirse
    socket.on('joinRoom', ({ roomId, playerData }) => {
        const room = rooms[roomId];
        if (!room) {
            socket.emit('roomError', { code: 'NOT_FOUND', message: 'La sala no existe o ya fue cerrada.' });
            return;
        }
        if (Object.keys(room.players).length >= MAX_PLAYERS) {
            socket.emit('roomError', { code: 'FULL', message: 'La sala está llena.' });
            return;
        }

        socket.roomId = roomId;
        socket.join(roomId);

        // Sincronizar tiempo y estado del mundo
        socket.emit('timeSync', Date.now() - room.createdAt);
        socket.emit('initWorldState', room.worldState);
        if (room.worldState.seedCode) {
            socket.emit('worldSeed', { seed: room.worldState.seedCode });
        }

        // Registrar jugador
        room.players[socket.id] = { id: socket.id, ...playerData };

        // Si es el primer jugador y no hay semilla, adopta la del cliente
        if (Object.keys(room.players).length === 1 && !room.worldState.seedCode && playerData.seedCode) {
            room.worldState.seedCode = playerData.seedCode;
            socket.emit('worldSeed', { seed: room.worldState.seedCode });
        } else if (room.worldState.seedCode) {
            socket.emit('worldSeed', { seed: room.worldState.seedCode });
        }

        io.to(roomId).emit('currentPlayers', room.players);
        // Notificar a todos la lista de salas actualizada
        io.emit('roomListUpdate', publicRoomList());
        console.log(`[rooms] ${playerData.name || socket.id} unido a sala ${roomId} (${Object.keys(room.players).length}/${MAX_PLAYERS})`);
    });

    // Retrocompatibilidad: joinGame sin sala → unirse a sala "global" o la primera disponible
    socket.on('joinGame', (playerData) => {
        // Si ya está en una sala (vía joinRoom) no hacer nada
        if (socket.roomId) return;

        // Buscar o crear sala "global"
        let globalRoom = Object.values(rooms).find(r => r.name === '__global__');
        if (!globalRoom) {
            const id = makeRoomId();
            rooms[id] = { id, name: '__global__', hostName: 'Sistema',
                players: {}, worldState: freshWorldState(playerData.seedCode), createdAt: Date.now() };
            globalRoom = rooms[id];
        }
        if (Object.keys(globalRoom.players).length >= MAX_PLAYERS) {
            socket.emit('serverFull'); return;
        }
        socket.roomId = globalRoom.id;
        socket.join(globalRoom.id);
        socket.emit('timeSync', Date.now() - globalRoom.createdAt);
        socket.emit('initWorldState', globalRoom.worldState);
        if (globalRoom.worldState.seedCode) socket.emit('worldSeed', { seed: globalRoom.worldState.seedCode });

        globalRoom.players[socket.id] = { id: socket.id, ...playerData };
        if (Object.keys(globalRoom.players).length === 1 && !globalRoom.worldState.seedCode && playerData.seedCode) {
            globalRoom.worldState.seedCode = playerData.seedCode;
        }
        io.to(globalRoom.id).emit('currentPlayers', globalRoom.players);
        io.emit('roomListUpdate', publicRoomList());
    });

    socket.on('playerMovement', (movementData) => {
        const room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        room.players[socket.id] = { ...room.players[socket.id], ...movementData };
        socket.to(socket.roomId).emit('playerMoved', room.players[socket.id]);
    });

    socket.on('worldUpdate', (data) => {
        const room = rooms[socket.roomId];
        if (!room) return;
        const ws = room.worldState;

        if (data.action === 'place_block')    { ws.blocks.push(data.payload.block); }
        if (data.action === 'hit_block')      { let b = ws.blocks.find(bl => bl.x === data.payload.x && bl.y === data.payload.y); if (b) { b.hp -= data.payload.dmg; if (data.payload.destroyed || b.hp <= 0) ws.blocks = ws.blocks.filter(bl => bl !== b); } }
        if (data.action === 'interact_door')  { let d = ws.blocks.find(bl => bl.x === data.payload.x && bl.y === data.payload.y); if (d) d.open = !d.open; }
        if (data.action === 'update_box')     { let b = ws.blocks.find(bl => bl.x === data.payload.x && bl.y === data.payload.y); if (b) b.inventory = data.payload.inventory; }
        if (data.action === 'update_campfire'){ let b = ws.blocks.find(bl => bl.x === data.payload.x && bl.y === data.payload.y); if (b) { b.wood = data.payload.wood; b.meat = data.payload.meat; b.cooked = data.payload.cooked; b.isBurning = data.payload.isBurning; } }
        if (data.action === 'drop_item')      { ws.droppedItems.push(data.payload.item); }
        if (data.action === 'pickup_item')    { ws.droppedItems = ws.droppedItems.filter(i => i.id !== data.payload.id); }
        if (data.action === 'stump_tree')     { ws.treeState[data.payload.x] = { isStump: true, regrowthCount: data.payload.regrowthCount, grownDay: data.payload.grownDay }; }
        if (data.action === 'grow_tree')      { ws.treeState[data.payload.x] = { isStump: false, regrowthCount: data.payload.regrowthCount, grownDay: data.payload.grownDay }; }
        if (data.action === 'destroy_tree')   { ws.removedTrees.push(data.payload.x); delete ws.treeState[data.payload.x]; }
        if (data.action === 'destroy_rock')   { ws.removedRocks.push(data.payload.x); }
        if (data.action === 'destroy_grave')  { ws.blocks = ws.blocks.filter(b => b.id !== data.payload.id); }
        if (data.action === 'kill_entity')    { ws.killedEntities.push(data.payload.id); }
        if (data.action === 'spawn_stuck_arrow') { ws.stuckArrows.push(data.payload); }
        if (data.action === 'remove_stuck_arrow'){ ws.stuckArrows = ws.stuckArrows.filter(sa => sa.id !== data.payload.id); }

        socket.to(socket.roomId).emit('worldUpdate', data);
    });

    socket.on('chatMessage', (text) => {
        const room = rooms[socket.roomId];
        if (!room) return;
        io.to(socket.roomId).emit('chatMessage', { id: socket.id, text });
    });

    socket.on('disconnect', () => {
        const room = rooms[socket.roomId];
        if (!room) return;
        delete room.players[socket.id];
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

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const players = {}; 
const serverStartTime = Date.now(); 

const worldState = { 
    blocks: [], 
    droppedItems: [], 
    removedTrees: [], 
    removedRocks: [],
    treeState: {},
    killedEntities: [] // NUEVO: Memoria de enemigos derrotados
};

io.on('connection', (socket) => {
    socket.emit('timeSync', Date.now() - serverStartTime);
    socket.emit('initWorldState', worldState);

    socket.on('joinGame', (playerData) => {
        players[socket.id] = { id: socket.id, ...playerData, chatText: '', chatExpires: 0 };
        io.emit('currentPlayers', players);
    });

    socket.on('playerMovement', (data) => {
        if (players[socket.id]) {
            Object.assign(players[socket.id], data); 
            socket.broadcast.emit('playerMoved', players[socket.id]); 
        }
    });

    socket.on('worldUpdate', (data) => {
        if (data.action === 'place_block') { worldState.blocks.push(data.payload.block); }
        if (data.action === 'remove_old_bed') { worldState.blocks = worldState.blocks.filter(b => b.type !== 'bed' || b.owner !== data.payload.owner); }
        if (data.action === 'hit_block' && data.payload.destroyed) { worldState.blocks = worldState.blocks.filter(b => !(b.x === data.payload.x && b.y === data.payload.y)); }
        if (data.action === 'interact_door') { let d = worldState.blocks.find(b => b.x === data.payload.x && b.y === data.payload.y); if(d) d.open = !d.open; }
        if (data.action === 'update_box' || data.action === 'update_campfire') { let b = worldState.blocks.find(bl => bl.x === data.payload.x && bl.y === data.payload.y); if (b) Object.assign(b, data.payload); }
        
        if (data.action === 'stump_tree') { worldState.treeState[data.payload.x] = { isStump: true, regrowthCount: data.payload.regrowthCount, grownDay: data.payload.grownDay }; }
        if (data.action === 'grow_tree') { worldState.treeState[data.payload.x] = { isStump: false, regrowthCount: data.payload.regrowthCount, grownDay: data.payload.grownDay }; }
        if (data.action === 'destroy_tree') { worldState.removedTrees.push(data.payload.x); delete worldState.treeState[data.payload.x]; }
        if (data.action === 'destroy_rock') { worldState.removedRocks.push(data.payload.x); }
        if (data.action === 'destroy_grave') { worldState.blocks = worldState.blocks.filter(b => b.id !== data.payload.id); }

        // SINCRONIZACIÓN DE ENEMIGOS
        if (data.action === 'kill_entity') { worldState.killedEntities.push(data.payload.id); }

        socket.broadcast.emit('worldUpdate', data); 
    });

    socket.on('chatMessage', (text) => { io.emit('chatMessage', { id: socket.id, text: text }); });
    
    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('currentPlayers', players); 
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => { console.log(`=== SERVIDOR INICIADO EN PUERTO ${PORT} ===`); });
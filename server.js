// === server.js - SERVIDOR MULTIJUGADOR ===
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const players = {}; 
const serverStartTime = Date.now(); // TIEMPO MAESTRO DEL MUNDO

io.on('connection', (socket) => {
    console.log('Un jugador se ha conectado:', socket.id);

    // Sincronizar el reloj del mundo inmediatamente al entrar
    socket.emit('timeSync', Date.now() - serverStartTime);

    // Cuando un jugador entra al mundo
    socket.on('joinGame', (playerData) => {
        players[socket.id] = {
            id: socket.id,
            name: playerData.name,
            x: playerData.x,
            y: playerData.y,
            facingRight: true,
            isHit: false,
            // Estado de animaciones iniciales
            activeTool: 'hand',
            animTime: 0,
            attackFrame: 0,
            isAiming: false,
            isCharging: false,
            chargeLevel: 0,
            chatText: '',
            chatTimer: 0
        };
        // Enviarle a TODOS la lista actualizada
        io.emit('currentPlayers', players);
    });

    // Cuando un jugador se mueve o cambia de animación
    socket.on('playerMovement', (data) => {
        if (players[socket.id]) {
            Object.assign(players[socket.id], data); // Guarda todos los datos de animación y posición
            socket.broadcast.emit('playerMoved', players[socket.id]); // Retransmite a los demás
        }
    });

    // Cuando un jugador altera el mundo (rompe bloques, tira items)
    socket.on('worldUpdate', (data) => {
        socket.broadcast.emit('worldUpdate', data); 
    });

    // === NUEVO: SISTEMA DE CHAT ===
    socket.on('chatMessage', (text) => {
        // Retransmite el mensaje junto con el ID del que habló a todos
        io.emit('chatMessage', { id: socket.id, text: text });
    });
    
    // Desconexión
    socket.on('disconnect', () => {
        console.log('Jugador desconectado:', socket.id);
        delete players[socket.id];
        io.emit('currentPlayers', players); 
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`=== SERVIDOR LOCAL INICIADO ===`);
    console.log(`Juega en esta PC abriendo: http://localhost:${PORT}`);
    console.log(`Para que tus amigos entren, dales tu IP de red local por el puerto 3000.`);
});
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');

// Habilita CORS para o Socket.IO (útil quando cliente usa CDN ou ports diferentes)
const io = new Server(http, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.use(express.static(__dirname));

const connectedPlayers = new Map();
const matches = [];
const globalHistory = [];

io.on('connection', (socket) => {
    console.log('Usuário conectado:', socket.id);

    socket.on('register', (playerName) => {
        connectedPlayers.set(socket.id, {
            name: playerName,
            socketId: socket.id,
            inGame: false
        });

        // Envia lista atualizada de jogadores para todos
        io.emit('playersList', Array.from(connectedPlayers.values()));
    });

    socket.on('gameInvite', ({ to, from }) => {
        const toPlayer = Array.from(connectedPlayers.values()).find(p => p.socketId === to);
        const fromPlayer = connectedPlayers.get(socket.id);

        if (toPlayer && !toPlayer.inGame) {
            io.to(to).emit('gameInvitation', {
                from: fromPlayer.name,
                fromId: socket.id
            });
        }
    });

    socket.on('acceptInvite', ({ fromId }) => {
        const player1 = connectedPlayers.get(fromId);
        const player2 = connectedPlayers.get(socket.id);

        if (player1 && player2) {
            player1.inGame = true;
            player2.inGame = true;

            const match = {
                player1: player1,
                player2: player2,
                board: ["", "", "", "", "", "", "", "", ""],
                currentTurn: fromId
            };

            matches.push(match);

            io.to(fromId).emit('gameStart', {
                opponent: player2.name,
                symbol: 'X',
                match: match
            });

            io.to(socket.id).emit('gameStart', {
                opponent: player1.name,
                symbol: 'O',
                match: match
            });
        }
    });

    socket.on('move', ({ index }) => {
        const match = matches.find(m =>
            m.player1.socketId === socket.id ||
            m.player2.socketId === socket.id
        );

        if (match && match.currentTurn === socket.id) {
            const symbol = match.player1.socketId === socket.id ? 'X' : 'O';
            match.board[index] = symbol;

            // Alterna o turno
            match.currentTurn = match.currentTurn === match.player1.socketId ?
                match.player2.socketId : match.player1.socketId;

            io.to(match.player1.socketId).emit('moveMade', {
                index,
                symbol,
                currentTurn: match.currentTurn
            });

            io.to(match.player2.socketId).emit('moveMade', {
                index,
                symbol,
                currentTurn: match.currentTurn
            });
        }
    });

    socket.on('gameEnded', ({ winner, players }) => {
        const match = {
            players: players,
            winner: winner,
            date: new Date().toLocaleString()
        };

        globalHistory.unshift(match); // adiciona no início
        if (globalHistory.length > 8) {
            globalHistory.pop(); // remove o último se passar de 8
        }
        io.emit('historyUpdated', globalHistory);

        // Libera os jogadores (procura por nome)
        for (let [id, p] of connectedPlayers.entries()) {
            if (p.name === players.player1 || p.name === players.player2) {
                p.inGame = false;
            }
        }
    });

    // Jogador abandona a partida
    socket.on('abandonGame', () => {
        // encontra a partida deste socket
        const matchIndex = matches.findIndex(m => m.player1.socketId === socket.id || m.player2.socketId === socket.id);
        if (matchIndex === -1) return;

        const match = matches[matchIndex];
        const quitter = connectedPlayers.get(socket.id);
        const other = match.player1.socketId === socket.id ? match.player2 : match.player1;

        const record = {
            players: {
                player1: match.player1.name,
                player2: match.player2.name
            },
            winner: other.name,
            date: new Date().toLocaleString(),
            reason: 'abandon'
        };

        globalHistory.unshift(record); // adiciona no início
        if (globalHistory.length > 8) {
            globalHistory.pop(); // remove o último se passar de 8
        }

        // Notifica ambos
        io.to(other.socketId).emit('opponentAbandoned', { quitter: quitter ? quitter.name : 'Desconhecido' });
        io.to(socket.id).emit('youAbandoned', { other: other.name });

        // libera jogadores
        if (connectedPlayers.has(socket.id)) connectedPlayers.get(socket.id).inGame = false;
        if (connectedPlayers.has(other.socketId)) connectedPlayers.get(other.socketId).inGame = false;

        // remove a partida
        matches.splice(matchIndex, 1);

        io.emit('historyUpdated', globalHistory);
        io.emit('playersList', Array.from(connectedPlayers.values()));
    });

    socket.on('getHistory', () => {
        socket.emit('historyReceived', globalHistory);
    });

    // Pedido de rematch
    socket.on('requestRematch', () => {
        // encontra a partida deste socket
        const match = matches.find(m => m.player1.socketId === socket.id || m.player2.socketId === socket.id);
        if (!match) return;
        const other = match.player1.socketId === socket.id ? match.player2 : match.player1;
        io.to(other.socketId).emit('rematchRequested', { from: connectedPlayers.get(socket.id).name });
    });

    socket.on('acceptRematch', () => {
        // reinicia a partida (reseta o board) entre os dois
        const match = matches.find(m => m.player1.socketId === socket.id || m.player2.socketId === socket.id);
        if (!match) return;
        match.board = ["", "", "", "", "", "", "", "", ""];
        match.currentTurn = match.player1.socketId; // mantém player1 como X
        io.to(match.player1.socketId).emit('rematchAccepted', { match });
        io.to(match.player2.socketId).emit('rematchAccepted', { match });
    });

    socket.on('disconnect', () => {
        if (connectedPlayers.has(socket.id)) {
            connectedPlayers.delete(socket.id);
            io.emit('playersList', Array.from(connectedPlayers.values()));
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

// Logs mais detalhados de erros de transporte (engine.io)
io.engine.on('connection_error', (err) => {
    console.error('Engine.IO connection error:', err);
});

// Middleware para logar tentativas de handshake e origem
io.use((socket, next) => {
    try {
        console.log('Handshake from', socket.handshake.address, 'origin:', socket.handshake.headers.origin);
    } catch (e) {
        console.warn('Handshake log failed', e);
    }
    next();
});

const socket = io('http://192.168.0.137:3000');
const loginModal = document.getElementById('loginModal');
const inviteModal = document.getElementById('inviteModal');
const gameArea = document.getElementById('gameArea');
const gameContainer = document.getElementById('game');
const statusText = document.getElementById('status');
const playerNameInput = document.getElementById('playerName');
const enterButton = document.getElementById('enterButton');
const onlinePlayersList = document.getElementById('onlinePlayersList');
const matchHistoryList = document.getElementById('matchHistory');
const playerNameDisplay = document.getElementById('playerNameDisplay');
const historyButton = document.getElementById('historyButton');

let board = ["", "", "", "", "", "", "", "", ""];
let currentPlayer = "X";
let isGameActive = false;
let playerSymbol = "";
let currentOpponent = null;

const winningCombinations = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

function createBoard() {
    gameContainer.innerHTML = "";
    board.forEach((cell, index) => {
        const cellDiv = document.createElement("div");
        cellDiv.classList.add("cell");
        cellDiv.setAttribute("data-index", index);
        cellDiv.innerText = cell;
        cellDiv.addEventListener("click", handleCellClick);
        gameContainer.appendChild(cellDiv);
    });

    // Mostra/oculta botão de abandonar
    const abandonBtn = document.getElementById('abandonButton');
    if (abandonBtn) {
        abandonBtn.style.display = isGameActive ? 'inline-block' : 'none';
    }
}

function handleCellClick(e) {
    const index = e.target.getAttribute("data-index");

    if (!isGameActive || board[index] !== "" || currentPlayer !== playerSymbol) return;

    socket.emit('move', { index });

    board[index] = playerSymbol;
    e.target.innerText = playerSymbol;

    if (checkWin()) {
        statusText.innerText = "Você venceu!";
        socket.emit('gameEnded', {
            winner: playerNameInput.value,
            players: {
                player1: playerNameInput.value,
                player2: currentOpponent
            }
        });
        isGameActive = false;
        // Mostra botão reiniciar
        const rematchBtn = document.getElementById('rematchButton');
        if (rematchBtn) rematchBtn.style.display = 'inline-block';
        return;
    }

    if (board.every(cell => cell !== "")) {
        statusText.innerText = "Empate!";
        socket.emit('gameEnded', {
            winner: 'Empate',
            players: {
                player1: playerNameInput.value,
                player2: currentOpponent
            }
        });
        isGameActive = false;
        // Mostra botão reiniciar
        const rematchBtn = document.getElementById('rematchButton');
        if (rematchBtn) rematchBtn.style.display = 'inline-block';
        return;
    }

    statusText.innerText = "Aguardando jogada do oponente...";
    currentPlayer = currentPlayer === "X" ? "O" : "X";
}

function checkWin() {
    return winningCombinations.some(combo => {
        return combo.every(index => board[index] === currentPlayer);
    });
}

function saveMatchHistory(result) {
    const date = new Date().toLocaleString();
    history.unshift({ result, date });

    if (history.length > 5) history.pop();

    updateHistoryDisplay();

    // Determina o maior vencedor nas últimas 5 partidas
    const counts = { X: 0, O: 0, Empate: 0 };
    history.forEach(match => {
        counts[match.result]++;
    });

    let maxPlayer = '';
    let maxValue = 0;

    for (let player in counts) {
        if (player !== 'Empate' && counts[player] > maxValue) {
            maxValue = counts[player];
            maxPlayer = player;
        }
    }

    if (maxPlayer) {
        // alert(`🏆 Vencedor da partida: Jogador ${maxPlayer}`);

    } else if (counts['Empate'] === 5) {
        alert("⚖️ Todas as últimas partidas terminaram em empate!");
    } else {
        alert("🤝 Nenhum vencedor claro nas últimas partidas.");
    }
}

function updateHistoryDisplay(matches) {
    matchHistoryList.innerHTML = '';
    matches.forEach(match => {
        const item = document.createElement('li');
        item.textContent = `${match.date} - ${match.players.player1} vs ${match.players.player2} - Vencedor: ${match.winner}`;
        matchHistoryList.appendChild(item);
    });
}

function resetGame() {
    board = ["", "", "", "", "", "", "", "", ""];
    currentPlayer = "X";
    isGameActive = false;
    statusText.innerText = "Aguardando outro jogador...";
    createBoard();
}

// Login e registro de jogador
const savedName = localStorage.getItem('playerName');
if (savedName) {
    playerNameInput.value = savedName;
    socket.emit('register', savedName);
    loginModal.style.display = 'none';
    gameArea.style.display = 'block';
    playerNameDisplay.textContent = savedName;
} else {
    loginModal.style.display = 'block';
}

enterButton.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (name) {
        localStorage.setItem('playerName', name);
        socket.emit('register', name);
        loginModal.style.display = 'none';
        gameArea.style.display = 'block';
        playerNameDisplay.textContent = name;
    }
});

// Socket.IO event listeners
// Conexão / desconexão / erros
socket.on('connect', () => {
    console.log('Socket conectado:', socket.id);
    statusText.innerText = `Conectado (id: ${socket.id})`;
    // reenviar registro caso já tenha nome salvo
    const saved = localStorage.getItem('playerName');
    if (saved) {
        socket.emit('register', saved);
    }
});

socket.on('disconnect', (reason) => {
    console.log('Socket desconectado. Motivo:', reason);
    statusText.innerText = 'Desconectado do servidor';
});

socket.on('connect_error', (err) => {
    console.error('Erro ao conectar:', err);
    statusText.innerText = 'Erro na conexão';
});

socket.on('reconnect_attempt', (attempt) => {
    console.log('Tentativa de reconexão:', attempt);
    statusText.innerText = `Tentando reconectar... (tentativa ${attempt})`;
});

socket.on('playersList', (players) => {
    onlinePlayersList.innerHTML = '';
    players.forEach(player => {
        if (player.name !== playerNameInput.value) {
            const li = document.createElement('li');
            li.innerHTML = `
                ${player.name}
                ${!player.inGame ?
                    `<button onclick="invitePlayer('${player.socketId}')">Convidar para jogar</button>` :
                    '<span>(Em jogo)</span>'}
            `;
            onlinePlayersList.appendChild(li);
        }
    });
});

socket.on('gameInvitation', ({ from, fromId }) => {
    inviteModal.style.display = 'block';
    document.getElementById('inviteMessage').textContent = `${from} convidou você para jogar!`;

    document.getElementById('acceptInvite').onclick = () => {
        socket.emit('acceptInvite', { fromId });
        inviteModal.style.display = 'none';
    };

    document.getElementById('rejectInvite').onclick = () => {
        inviteModal.style.display = 'none';
    };
});

socket.on('gameStart', ({ opponent, symbol, match }) => {
    playerSymbol = symbol;
    currentOpponent = opponent;
    isGameActive = true;
    currentPlayer = "X";
    board = match.board;
    statusText.innerText = symbol === "X" ? "Sua vez!" : "Aguardando jogada do oponente...";
    createBoard();
    // habilita botão abandonar
    const abandonBtn = document.getElementById('abandonButton');
    if (abandonBtn) abandonBtn.style.display = 'inline-block';
});

socket.on('moveMade', ({ index, symbol, currentTurn }) => {
    board[index] = symbol;
    document.querySelector(`[data-index="${index}"]`).innerText = symbol;
    currentPlayer = symbol === "X" ? "O" : "X";

    if (socket.id === currentTurn) {
        statusText.innerText = "Sua vez!";
    } else {
        statusText.innerText = "Aguardando jogada do oponente...";
    }
});

socket.on('historyUpdated', (globalHistory) => {
    updateHistoryDisplay(globalHistory);
});

function showToast(msg, ms = 2000) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, ms);
}

function invitePlayer(socketId) {
    socket.emit('gameInvite', {
        to: socketId,
        from: socket.id
    });
    // mostra confirmação local
    showToast('Convite enviado');
}

historyButton.addEventListener('click', () => {
    socket.emit('getHistory');
});

socket.on('historyReceived', (globalHistory) => {
    updateHistoryDisplay(globalHistory);
});

// Lidar com pedido de rematch recebido
socket.on('rematchRequested', ({ from }) => {
    const accept = confirm(`${from} pediu rematch. Aceita?`);
    if (accept) {
        socket.emit('acceptRematch');
    }
});

socket.on('rematchAccepted', ({ match }) => {
    // reset local do tabuleiro com o novo match
    board = match.board;
    isGameActive = true;
    currentPlayer = 'X';
    statusText.innerText = (playerSymbol === 'X') ? 'Sua vez!' : 'Aguardando jogada do oponente...';
    createBoard();
});

// Abandonar jogo
const abandonBtn = document.getElementById('abandonButton');
if (abandonBtn) {
    abandonBtn.addEventListener('click', () => {
        if (!isGameActive) return;
        const confirmQuit = confirm('Tem a certeza que deseja abandonar? Você perderá a partida.');
        if (!confirmQuit) return;
        socket.emit('abandonGame');
        isGameActive = false;
        statusText.innerText = 'Você abandonou a partida';
        // esconde botão
        abandonBtn.style.display = 'none';
        createBoard();
    });
}

socket.on('opponentAbandoned', ({ quitter }) => {
    alert(`${quitter} abandonou a partida. Você venceu por desistência.`);
    statusText.innerText = 'Vencedor por abandono!';
    isGameActive = false;
    const abandonBtn = document.getElementById('abandonButton');
    if (abandonBtn) abandonBtn.style.display = 'none';
});

socket.on('youAbandoned', ({ other }) => {
    alert(`Você abandonou. ${other} vence por desistência.`);
});

// Reiniciar Partida
const rematchBtn = document.getElementById('rematchButton');
if (rematchBtn) {
    rematchBtn.addEventListener('click', () => {
        if (isGameActive) return; // só permite quando jogo terminou
        socket.emit('requestRematch');
        showToast('Pedido de rematch enviado');
    });
}

// Inicializa o jogo
createBoard();
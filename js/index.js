
const gameContainer = document.getElementById('game');
const statusText = document.getElementById('status');
const matchHistoryList = document.getElementById('matchHistory');

let board = ["", "", "", "", "", "", "", "", ""];
let currentPlayer = "X";
let isGameActive = true;

let history = [];

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
}

function handleCellClick(e) {
    const index = e.target.getAttribute("data-index");

    if (!isGameActive || board[index] !== "") return;

    board[index] = currentPlayer;
    e.target.innerText = currentPlayer;

    if (checkWin()) {
        statusText.innerText = `Jogador ${currentPlayer} venceu!`;
        saveMatchHistory(currentPlayer);
        isGameActive = false;
        return;
    }

    if (board.every(cell => cell !== "")) {
        statusText.innerText = "Empate!";
        saveMatchHistory("Empate");
        isGameActive = false;
        return;
    }

    currentPlayer = currentPlayer === "X" ? "O" : "X";
    statusText.innerText = `Vez do jogador ${currentPlayer}`;
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

function updateHistoryDisplay() {
    matchHistoryList.innerHTML = '';
    history.forEach(match => {
        const item = document.createElement('li');
        item.textContent = `${match.date} - Resultado: ${match.result}`;
        matchHistoryList.appendChild(item);
    });
}

function resetGame() {
    board = ["", "", "", "", "", "", "", "", ""];
    currentPlayer = "X";
    isGameActive = true;
    statusText.innerText = `Vez do jogador ${currentPlayer}`;
    createBoard();
}

// Inicializa o jogo
createBoard();
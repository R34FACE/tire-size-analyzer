"use strict";

const SIZE = 9;
const BOX_SIZE = 3;
const CELL_COUNT = SIZE * SIZE;

const DIFFICULTIES = {
  beginner: { label: "初級", min: 35, max: 40 },
  intermediate: { label: "中級", min: 41, max: 48 },
  advanced: { label: "上級", min: 49, max: 54 },
  expert: { label: "激ムズ", min: 55, max: 58 }
};

const boardElement = document.getElementById("board");
const difficultyElement = document.getElementById("difficulty");
const newGameButton = document.getElementById("newGameButton");
const checkButton = document.getElementById("checkButton");
const answerButton = document.getElementById("answerButton");
const statusElement = document.getElementById("status");
const loadingElement = document.getElementById("loading");
const dateLineElement = document.getElementById("dateLine");

let puzzle = [];
let solution = [];
let isShowingAnswer = false;
let generationId = 0;

function createEmptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function shuffle(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function isValid(board, row, column, number) {
  for (let index = 0; index < SIZE; index += 1) {
    if (board[row][index] === number || board[index][column] === number) {
      return false;
    }
  }

  const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE;
  const boxColumn = Math.floor(column / BOX_SIZE) * BOX_SIZE;

  for (let rowOffset = 0; rowOffset < BOX_SIZE; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < BOX_SIZE; columnOffset += 1) {
      if (board[boxRow + rowOffset][boxColumn + columnOffset] === number) {
        return false;
      }
    }
  }

  return true;
}

function getCandidates(board, row, column) {
  const candidates = [];
  for (let number = 1; number <= SIZE; number += 1) {
    if (isValid(board, row, column, number)) {
      candidates.push(number);
    }
  }
  return candidates;
}

function findBestEmptyCell(board) {
  let bestCell = null;
  let bestCandidates = null;

  for (let row = 0; row < SIZE; row += 1) {
    for (let column = 0; column < SIZE; column += 1) {
      if (board[row][column] !== 0) {
        continue;
      }

      const candidates = getCandidates(board, row, column);
      if (candidates.length === 0) {
        return { row, column, candidates };
      }

      if (!bestCandidates || candidates.length < bestCandidates.length) {
        bestCell = { row, column };
        bestCandidates = candidates;
        if (candidates.length === 1) {
          return { ...bestCell, candidates: bestCandidates };
        }
      }
    }
  }

  return bestCell ? { ...bestCell, candidates: bestCandidates } : null;
}

function fillBoard(board) {
  const emptyCell = findBestEmptyCell(board);
  if (!emptyCell) {
    return true;
  }

  const { row, column, candidates } = emptyCell;
  for (const number of shuffle(candidates)) {
    board[row][column] = number;
    if (fillBoard(board)) {
      return true;
    }
    board[row][column] = 0;
  }

  return false;
}

function countSolutions(board, limit = 2) {
  let count = 0;

  function search() {
    if (count >= limit) {
      return;
    }

    const emptyCell = findBestEmptyCell(board);
    if (!emptyCell) {
      count += 1;
      return;
    }

    const { row, column, candidates } = emptyCell;
    for (const number of candidates) {
      board[row][column] = number;
      search();
      board[row][column] = 0;

      if (count >= limit) {
        return;
      }
    }
  }

  search();
  return count;
}

function generatePuzzle(blankCount) {
  const solvedBoard = createEmptyBoard();
  fillBoard(solvedBoard);

  const puzzleBoard = solvedBoard.map((row) => [...row]);
  const positions = shuffle(Array.from({ length: CELL_COUNT }, (_, index) => index));
  let removed = 0;

  for (const position of positions) {
    if (removed >= blankCount) {
      break;
    }

    const row = Math.floor(position / SIZE);
    const column = position % SIZE;
    const savedValue = puzzleBoard[row][column];
    puzzleBoard[row][column] = 0;

    const testBoard = puzzleBoard.map((boardRow) => [...boardRow]);
    if (countSolutions(testBoard, 2) === 1) {
      removed += 1;
    } else {
      puzzleBoard[row][column] = savedValue;
    }
  }

  return {
    puzzle: puzzleBoard,
    solution: solvedBoard,
    removed
  };
}

function setBusy(isBusy) {
  newGameButton.disabled = isBusy;
  difficultyElement.disabled = isBusy;
  checkButton.disabled = isBusy;
  answerButton.disabled = isBusy;
  loadingElement.classList.toggle("visible", isBusy);
  loadingElement.setAttribute("aria-hidden", String(!isBusy));
}

function setStatus(message, type = "") {
  statusElement.textContent = message;
  statusElement.className = `status${type ? ` ${type}` : ""}`;
}

function renderBoard() {
  boardElement.replaceChildren();

  puzzle.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      const cell = document.createElement("div");
      const input = document.createElement("input");
      const isGiven = value !== 0;

      cell.className = `cell${isGiven ? " given" : ""}`;
      input.type = "text";
      input.inputMode = "numeric";
      input.pattern = "[1-9]";
      input.maxLength = 1;
      input.value = isGiven ? String(value) : "";
      input.readOnly = isGiven;
      input.tabIndex = isGiven ? -1 : 0;
      input.dataset.row = String(rowIndex);
      input.dataset.column = String(columnIndex);
      input.setAttribute(
        "aria-label",
        `${rowIndex + 1}行${columnIndex + 1}列${isGiven ? `、${value}、変更不可` : "、空欄"}`
      );

      input.addEventListener("input", handleCellInput);
      input.addEventListener("keydown", handleCellKeydown);
      cell.appendChild(input);
      boardElement.appendChild(cell);
    });
  });
}

function handleCellInput(event) {
  const input = event.target;
  input.value = input.value.replace(/[^1-9]/g, "").slice(-1);
  input.parentElement.classList.remove("incorrect", "correct");
  setStatus("数字を入力してください。");
}

function handleCellKeydown(event) {
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
    return;
  }

  event.preventDefault();
  const row = Number(event.target.dataset.row);
  const column = Number(event.target.dataset.column);
  const offsets = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1]
  };
  const [rowOffset, columnOffset] = offsets[event.key];
  let nextRow = row;
  let nextColumn = column;

  for (let step = 0; step < CELL_COUNT; step += 1) {
    nextRow = (nextRow + rowOffset + SIZE) % SIZE;
    nextColumn = (nextColumn + columnOffset + SIZE) % SIZE;
    const nextInput = boardElement.querySelector(
      `input[data-row="${nextRow}"][data-column="${nextColumn}"]`
    );
    if (nextInput && !nextInput.readOnly) {
      nextInput.focus();
      return;
    }
  }
}

function getInputs() {
  return [...boardElement.querySelectorAll("input")];
}

function checkAnswer() {
  if (isShowingAnswer) {
    setStatus("完成盤面を表示しています。", "success");
    return;
  }

  let hasEmptyCell = false;
  let hasIncorrectCell = false;

  getInputs().forEach((input) => {
    const cell = input.parentElement;
    cell.classList.remove("incorrect", "correct");
    if (input.readOnly) {
      return;
    }

    const row = Number(input.dataset.row);
    const column = Number(input.dataset.column);
    const value = Number(input.value);

    if (!input.value) {
      hasEmptyCell = true;
    } else if (value !== solution[row][column]) {
      hasIncorrectCell = true;
      cell.classList.add("incorrect");
    } else {
      cell.classList.add("correct");
    }
  });

  if (hasIncorrectCell) {
    setStatus("間違っているマスがあります。赤いマスを見直してください。", "error");
  } else if (hasEmptyCell) {
    setStatus("ここまでは正解です。まだ空いているマスがあります。");
  } else {
    setStatus("正解です！ すべてのマスが完成しました。", "success");
  }
}

function showAnswer() {
  if (isShowingAnswer) {
    renderBoard();
    isShowingAnswer = false;
    answerButton.textContent = "答えを見る";
    setStatus("問題に戻りました。");
    return;
  }

  getInputs().forEach((input) => {
    const row = Number(input.dataset.row);
    const column = Number(input.dataset.column);
    input.value = String(solution[row][column]);
    input.readOnly = true;
    input.parentElement.classList.remove("incorrect", "correct");
  });

  isShowingAnswer = true;
  answerButton.textContent = "問題に戻る";
  setStatus("完成盤面を表示しています。", "success");
}

function startNewGame() {
  const currentGenerationId = ++generationId;
  const difficulty = DIFFICULTIES[difficultyElement.value];
  const targetBlanks =
    difficulty.min + Math.floor(Math.random() * (difficulty.max - difficulty.min + 1));

  setBusy(true);
  setStatus(`${difficulty.label}の問題を作成しています…`);

  window.setTimeout(() => {
    let result = generatePuzzle(targetBlanks);
    let attempts = 1;

    while (result.removed < targetBlanks && attempts < 8) {
      result = generatePuzzle(targetBlanks);
      attempts += 1;
    }

    if (currentGenerationId !== generationId) {
      return;
    }

    if (result.removed < difficulty.min) {
      window.setTimeout(startNewGame, 30);
      return;
    }

    puzzle = result.puzzle;
    solution = result.solution;
    isShowingAnswer = false;
    answerButton.textContent = "答えを見る";
    renderBoard();
    setBusy(false);

    const uniquenessCheck = countSolutions(
      puzzle.map((row) => [...row]),
      2
    );

    if (uniquenessCheck === 1) {
      setStatus(`${difficulty.label}・空白${result.removed}マス（一意解）`);
    } else {
      setStatus("生成に失敗しました。もう一度お試しください。", "error");
    }
  }, 30);
}

function setDateLine() {
  dateLineElement.textContent = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(new Date());
}

newGameButton.addEventListener("click", startNewGame);
checkButton.addEventListener("click", checkAnswer);
answerButton.addEventListener("click", showAnswer);

setDateLine();
startNewGame();

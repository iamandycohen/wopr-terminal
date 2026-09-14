const cities = {
  USA: [['SEATTLE', -122, 48], ['LAS VEGAS', -115, 36], ['NEW YORK', -74, 41], ['WASHINGTON', -77, 39], ['LOS ANGELES', -118, 34], ['CHICAGO', -88, 42]],
  USSR: [['MOSCOW', 38, 56], ['LENINGRAD', 30, 60], ['KIEV', 31, 50], ['MINSK', 28, 54], ['NOVOSIBIRSK', 83, 55], ['VLADIVOSTOK', 132, 43]]
};

const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function result(board) {
  for (const [a,b,c] of lines) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  return board.every(Boolean) ? 'DRAW' : null;
}
function minimax(board, player) {
  const outcome = result(board);
  if (outcome) return outcome === 'O' ? 1 : outcome === 'X' ? -1 : 0;
  const scores = [];
  board.forEach((v,i) => { if (!v) { board[i] = player; scores.push(minimax(board, player === 'O' ? 'X' : 'O')); board[i] = ''; } });
  return player === 'O' ? Math.max(...scores) : Math.min(...scores);
}
function bestMove(board) {
  let best = -2, move = -1;
  for (const i of [4,0,2,6,8,1,3,5,7]) if (!board[i]) {
    board[i] = 'O'; const score = minimax(board, 'X'); board[i] = '';
    if (score > best) { best = score; move = i; }
  }
  return move;
}

export { cities, result, bestMove };

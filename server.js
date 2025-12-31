const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const { getScenario } = require('./scenarios');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Servir frontend (Render-friendly)
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Healthcheck para UptimeRobot
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Salas de juego (cada sala tiene su propio filesystem y flag)
const rooms = {};

// Resolver rutas
function resolvePath(currentPath, targetPath) {
  if (!targetPath) return currentPath;
  if (targetPath.startsWith('/')) return targetPath;
  if (targetPath === '..') {
    const parts = currentPath.split('/').filter(p => p);
    parts.pop();
    return '/' + parts.join('/');
  }
  if (targetPath === '.') return currentPath;
  return currentPath === '/' ? '/' + targetPath : currentPath + '/' + targetPath;
}

// Comandos (usan filesystem por sala)
function executeCommand(cmd, args, currentPath, roomFilesystem) {
  switch (cmd.toLowerCase()) {
    case 'ls': {
      // ls, ls -a, ls /ruta, ls -a /ruta
      const target = args.find(a => !a.startsWith('-'));
      const lsPath = target ? resolvePath(currentPath, target) : currentPath;

      const lsDir = roomFilesystem[lsPath];
      if (!lsDir) return { error: `ls: cannot access '${lsPath}': No such file or directory` };
      if (lsDir.type !== 'dir') return { error: `ls: cannot access '${lsPath}': Not a directory` };

      const showHidden = args.includes('-a') || args.includes('-la') || args.includes('-al') || (args.includes('-l') && args.includes('-a'));
      const contents = lsDir.contents || [];
      const visible = showHidden ? contents : contents.filter(item => !item.startsWith('.'));

      return { output: visible.join('\n') };
    }

    case 'cd': {
      const cdPath = args[0] ? resolvePath(currentPath, args[0]) : '/';
      const cdDir = roomFilesystem[cdPath];
      if (!cdDir) return { error: `cd: ${cdPath}: No such file or directory` };
      if (cdDir.type !== 'dir') return { error: `cd: ${cdPath}: Not a directory` };
      return { output: '', newPath: cdPath };
    }

    case 'cat': {
      if (!args[0]) return { error: 'cat: missing file operand' };
      const catPath = resolvePath(currentPath, args[0]);
      const catFile = roomFilesystem[catPath];
      if (!catFile) return { error: `cat: ${catPath}: No such file or directory` };
      if (catFile.type !== 'file') return { error: `cat: ${catPath}: Is a directory` };

      // Trampas
      if (catFile.isTrap) {
        return {
          output: catFile.content,
          color: 'red',
          isTrap: true,
          penaltyTime: catFile.penaltyTime || 3000
        };
      }

      return { output: catFile.content };
    }

    case 'grep': {
      if (args.length < 2) return { error: 'usage: grep <pattern> <file>' };
      const searchTerm = args[0];
      const targetFile = args[1];

      const grepPath = resolvePath(currentPath, targetFile);
      const grepObj = roomFilesystem[grepPath];

      if (!grepObj) return { error: `grep: ${targetFile}: No such file or directory` };
      if (grepObj.type !== 'file') return { error: `grep: ${targetFile}: Is a directory` };

      const matchingLines = (grepObj.content || '')
        .split('\n')
        .filter(line => line.toLowerCase().includes(searchTerm.toLowerCase()));

      if (matchingLines.length === 0) return { output: '(no matches found)' };
      return { output: matchingLines.join('\n') };
    }

    case 'find': {
      const searchPattern = args[0] || '';
      const foundPaths = [];

      Object.keys(roomFilesystem).forEach(p => {
        const name = p.split('/').pop();
        if (name && name.toLowerCase().includes(searchPattern.toLowerCase())) {
          const item = roomFilesystem[p];
          const typeIcon = item.type === 'dir' ? '📁' : '📄';
          foundPaths.push(`${typeIcon} ${p}`);
        }
      });

      if (foundPaths.length === 0) return { output: `find: no files matching '${searchPattern}'` };
      return { output: foundPaths.join('\n') };
    }

    case 'pwd':
      return { output: currentPath };

    case 'help':
      return {
        output:
`Available commands:
  ls [-a] [path]     - List directory contents (-a shows hidden files)
  cd <path>          - Change directory
  cat <file>         - Read file contents (beware traps!)
  pwd                - Print working directory
  grep <text> <file> - Search for text in file
  find <name>        - Find files by name
  submit <flag>      - Submit the flag to win
  clear              - Clear terminal`
      };

    case 'clear':
      return { clear: true };

    default:
      return { error: `${cmd}: command not found. Type 'help' for available commands.` };
  }
}

io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  socket.on('join-room', (data) => {
    const { roomId, playerName, scenarioId } = data;

    if (!roomId || !playerName) {
      socket.emit('joined', { success: false, error: 'Missing roomId or playerName' });
      return;
    }

    // Crear sala si no existe (escenario fijado por el primer jugador)
    if (!rooms[roomId]) {
      const scenario = getScenario(scenarioId || 'hidden_files', roomId);

      rooms[roomId] = {
        players: {},
        started: false,
        winner: null,
        startTime: null,

        filesystem: scenario.filesystem,
        flag: scenario.flag,
        templateId: scenario.templateId
      };
    }

    rooms[roomId].players[socket.id] = {
      name: playerName,
      path: '/',
      ready: false,
      frozenUntil: 0
    };

    socket.join(roomId);
    socket.roomId = roomId;

    // ✅ Enviamos también templateId para que el frontend bloquee el selector al escenario real
    io.to(roomId).emit('room-update', {
      players: Object.values(rooms[roomId].players).map(p => p.name),
      started: rooms[roomId].started,
      templateId: rooms[roomId].templateId
    });

    socket.emit('joined', { success: true });
  });

  socket.on('ready', () => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;

    rooms[roomId].players[socket.id].ready = true;

    const allReady = Object.values(rooms[roomId].players).every(p => p.ready);
    const playerCount = Object.keys(rooms[roomId].players).length;

    if (allReady && playerCount >= 2 && !rooms[roomId].started) {
      rooms[roomId].started = true;
      rooms[roomId].startTime = Date.now();
      io.to(roomId).emit('game-start', { message: 'GO! Find the flag!' });
    }
  });

  socket.on('command', (data) => {
    const roomId = socket.roomId;

    if (!roomId || !rooms[roomId] || !rooms[roomId].started) {
      socket.emit('command-result', { error: 'Game not started' });
      return;
    }

    // Si ya hay ganador, bloquea
    if (rooms[roomId].winner) {
      socket.emit('command-result', { error: 'Game ended. Refresh to play again.' });
      return;
    }

    const player = rooms[roomId].players[socket.id];
    if (!player) return;

    // Congelación por trampa
    if (Date.now() < player.frozenUntil) {
      const remaining = Math.ceil((player.frozenUntil - Date.now()) / 1000);
      socket.emit('command-result', {
        error: `⚠️ TERMINAL LOCKED! Rebooting in ${remaining}s...`,
        color: 'red'
      });
      return;
    }

    const parts = (data.command || '').trim().split(/\s+/);
    const cmd = (parts[0] || '').toLowerCase();
    const args = parts.slice(1);

    // ✅ submit dinámico por sala
    if (cmd === 'submit') {
      const submitted = args[0] || '';
      if (submitted === rooms[roomId].flag) {
        const timeElapsed = ((Date.now() - rooms[roomId].startTime) / 1000).toFixed(2);
        rooms[roomId].winner = player.name;

        io.to(roomId).emit('game-end', {
          winner: player.name,
          time: timeElapsed
        });

        socket.emit('command-result', {
          output: `🎉 CORRECT! You won in ${timeElapsed} seconds!`,
          color: 'yellow'
        });
      } else {
        socket.emit('command-result', {
          error: '❌ Incorrect flag. Keep searching!',
          color: 'red'
        });
      }
      return;
    }

    // Ejecutar comando con filesystem de ESA sala
    const result = executeCommand(cmd, args, player.path, rooms[roomId].filesystem);

    // Trampa → congelación
    if (result.isTrap) {
      player.frozenUntil = Date.now() + (result.penaltyTime || 3000);
      socket.to(roomId).emit('player-action', {
        player: player.name,
        command: `activated a TRAP! (-${(result.penaltyTime || 3000) / 1000}s)`
      });
    }

    if (result.newPath !== undefined) {
      player.path = result.newPath;
    }

    socket.emit('command-result', result);

    // Notificar progreso (solo algunos)
    if (['cd', 'cat'].includes(cmd)) {
      socket.to(roomId).emit('player-action', {
        player: player.name,
        command: cmd
      });
    }
  });

  socket.on('disconnect', () => {
    const roomId = socket.roomId;

    if (roomId && rooms[roomId]) {
      delete rooms[roomId].players[socket.id];

      if (Object.keys(rooms[roomId].players).length === 0) {
        delete rooms[roomId];
      } else {
        // ✅ También mandamos templateId aquí
        io.to(roomId).emit('room-update', {
          players: Object.values(rooms[roomId].players).map(p => p.name),
          started: rooms[roomId].started,
          templateId: rooms[roomId].templateId
        });
      }
    }

    console.log('Usuario desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 CTF Race server running on port ${PORT}`);
});

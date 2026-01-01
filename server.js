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

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

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

// ========== COMANDOS DE RED (NUEVOS) ==========

function executeNetworkCommand(cmd, args, player, room) {
  const { currentHost, knownHosts, path: currentPath } = player;
  const { networkData } = room;

  switch (cmd.toLowerCase()) {
    case 'mission': {
      if (!room.briefing) {
        return { error: 'No mission briefing available for this scenario' };
      }
      return { output: room.briefing, color: 'cyan' };
    }

    case 'status': {
      const statusInfo = [
        `Current Host: ${currentHost}`,
        `Path: ${currentPath}`,
        `Known Hosts: ${knownHosts.length > 0 ? knownHosts.join(', ') : 'none discovered'}`
      ];
      
      if (currentHost !== 'external') {
        statusInfo.push(`Access Level: user`);
      }
      
      return { output: statusInfo.join('\n'), color: 'cyan' };
    }

    case 'nmap': {
      const target = args[0];

      if (!target) {
        return { error: 'usage: nmap <target>' };
      }

      // Desde external → escanear bastion
      if (currentHost === 'external') {
        if (target === networkData.bastionIP) {
          return {
            output: `Starting Nmap scan on ${target}...

HOST: ${target}
PORT     STATE    SERVICE
22/tcp   open     ssh
80/tcp   closed   http

Nmap done: 1 IP address scanned`
          };
        } else {
          return { error: `Host ${target} unreachable from external network` };
        }
      }

      // Desde bastion → escanear red interna
      if (currentHost === 'bastion') {
        if (target.includes('10.10.0')) {
          // Escaneo de subred
          if (target.includes('/24')) {
            const discovered = [
              `10.10.0.5 (bastion - this machine)`,
              `${networkData.targetIP} (${networkData.targetHostname})`
            ];
            
            // Añadir a hosts conocidos
            if (!player.knownHosts.includes(networkData.targetIP)) {
              player.knownHosts.push(networkData.targetIP);
            }

            return {
              output: `Scanning network ${target}...

DISCOVERED HOSTS:
${discovered.join('\n')}

Scan complete: 2 hosts found`,
              color: 'green'
            };
          }

          // Escaneo de IP específica
          if (target === networkData.targetIP) {
            if (!player.knownHosts.includes(networkData.targetIP)) {
              player.knownHosts.push(networkData.targetIP);
            }

            return {
              output: `Nmap scan report for ${target}

HOST: ${target} (${networkData.targetHostname})
PORT     STATE    SERVICE
22/tcp   open     ssh

Host is up`
            };
          }
        }

        return { error: `No route to host ${target}` };
      }

      return { error: 'nmap: Command not available on this host' };
    }

    case 'ssh': {
      // Formato: ssh user@host
      const match = args[0]?.match(/(.+)@(.+)/);

      if (!match) {
        return { error: 'usage: ssh user@host' };
      }

      const [, user, host] = match;

      // Desde external → conectar a bastion
      if (currentHost === 'external') {
        if (host === networkData.bastionIP && user === networkData.bastionUsername) {
          return {
            output: `Connecting to ${host}...\nPassword for ${user}@${host}:`,
            waitingForSSH: true,
            sshTarget: {
              host: 'bastion',
              user,
              expectedPassword: networkData.bastionPassword
            }
          };
        }
        return { error: `ssh: connect to host ${host} port 22: Connection refused` };
      }

      // Desde bastion → conectar a target
      if (currentHost === 'bastion') {
        if (host === networkData.targetIP && user === networkData.targetUsername) {
          // Verificar si descubrió el host
          if (!player.knownHosts.includes(networkData.targetIP)) {
            return { error: `ssh: Could not resolve hostname ${host}: Name or service not known` };
          }

          return {
            output: `Connecting to ${host}...\nPassword for ${user}@${host}:`,
            waitingForSSH: true,
            sshTarget: {
              host: 'target',
              user,
              expectedPassword: networkData.targetPassword
            }
          };
        }
        return { error: `ssh: connect to host ${host}: Connection refused` };
      }

      return { error: 'ssh: Already connected to target host' };
    }

    case 'ifconfig':
    case 'ip': {
      if (args[0] === 'a' || args[0] === 'addr' || cmd === 'ifconfig') {
        if (currentHost === 'bastion') {
          return {
            output: `eth0: ${networkData.bastionIP}  (external interface)
      inet ${networkData.bastionIP}  netmask 255.255.255.0

eth1: 10.10.0.5  (internal interface)
      inet 10.10.0.5  netmask 255.255.255.0
      network: ${networkData.internalNetwork}`
          };
        }

        if (currentHost === 'target') {
          return {
            output: `eth0: ${networkData.targetIP}  (internal interface)
      inet ${networkData.targetIP}  netmask 255.255.255.0
      network: ${networkData.internalNetwork}`
          };
        }

        return { error: 'Network interface not available' };
      }

      if (cmd === 'ip') {
        return { error: 'usage: ip a' };
      }

      return { error: 'Unknown command' };
    }

    default:
      return null; // No es comando de red, continuar con comandos arcade
  }
}

// ========== COMANDOS ARCADE (EXISTENTES) ==========

function executeCommand(cmd, args, currentPath, roomFilesystem) {
  switch (cmd.toLowerCase()) {
    case 'ls': {
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

// Versión extendida de help para escenarios de red
function getNetworkHelp() {
  return `Available commands:

NETWORK COMMANDS:
  mission            - Show mission briefing
  status             - Show current status
  nmap <target>      - Scan network/host
  ssh user@host      - Connect to remote host
  ifconfig           - Show network interfaces (alias: ip a)

SYSTEM COMMANDS:
  ls [-a] [path]     - List directory contents
  cd <path>          - Change directory
  cat <file>         - Read file contents
  pwd                - Print working directory
  grep <text> <file> - Search for text in file
  find <name>        - Find files by name
  submit <flag>      - Submit the flag to win
  clear              - Clear terminal`;
}

// ========== SOCKET.IO ==========

io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  socket.on('join-room', (data) => {
    const { roomId, playerName, scenarioId } = data;

    if (!roomId || !playerName) {
      socket.emit('joined', { success: false, error: 'Missing roomId or playerName' });
      return;
    }

    if (!rooms[roomId]) {
      const scenario = getScenario(scenarioId || 'hidden_files', roomId);

      rooms[roomId] = {
        players: {},
        started: false,
        winner: null,
        startTime: null,

        // Datos del escenario
        filesystem: scenario.filesystem,
        flag: scenario.flag,
        templateId: scenario.templateId,
        category: scenario.category || 'arcade',
        networkData: scenario.networkData || null,
        briefing: scenario.briefing || null
      };
    }

    // Estado del jugador según categoría
    const isNetworkScenario = rooms[roomId].category === 'network';

    rooms[roomId].players[socket.id] = {
      name: playerName,
      path: '/',
      ready: false,
      frozenUntil: 0,

      // Estados para escenarios de red
      currentHost: isNetworkScenario ? 'external' : null,
      knownHosts: [],
      sshPending: null // Para manejar autenticación SSH
    };

    socket.join(roomId);
    socket.roomId = roomId;

    io.to(roomId).emit('room-update', {
      players: Object.values(rooms[roomId].players).map(p => p.name),
      started: rooms[roomId].started,
      templateId: rooms[roomId].templateId,
      category: rooms[roomId].category
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
      io.to(roomId).emit('game-start', { 
        message: 'GO! Find the flag!',
        category: rooms[roomId].category
      });
    }
  });

  socket.on('command', (data) => {
    const roomId = socket.roomId;

    if (!roomId || !rooms[roomId] || !rooms[roomId].started) {
      socket.emit('command-result', { error: 'Game not started' });
      return;
    }

    if (rooms[roomId].winner) {
      socket.emit('command-result', { error: 'Game ended. Refresh to play again.' });
      return;
    }

    const player = rooms[roomId].players[socket.id];
    const room = rooms[roomId];
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

    // ========== MANEJO DE SSH PENDING ==========
    if (player.sshPending) {
      const enteredPassword = parts.join(' '); // Todo el input es la password
      
      if (enteredPassword === player.sshPending.expectedPassword) {
        // Autenticación exitosa
        const targetHost = player.sshPending.host;
        player.currentHost = targetHost;
        player.path = '/';
        player.sshPending = null;

        socket.emit('command-result', {
          output: `Authentication successful.\nWelcome to ${targetHost}!\n`,
          color: 'green',
          newPath: '/',
          hostChanged: targetHost
        });

        socket.to(roomId).emit('player-action', {
          player: player.name,
          command: `connected to ${targetHost}`
        });
      } else {
        // Password incorrecta
        player.sshPending = null;
        socket.emit('command-result', {
          error: 'Permission denied (incorrect password)',
          color: 'red'
        });
      }
      return;
    }

    // ========== SUBMIT (dinámico por sala) ==========
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

    // ========== HELP DINÁMICO ==========
    if (cmd === 'help') {
      const helpText = room.category === 'network' ? getNetworkHelp() : executeCommand(cmd, args, player.path, {}).output;
      socket.emit('command-result', { output: helpText });
      return;
    }

    // ========== COMANDOS DE RED (si aplica) ==========
    if (room.category === 'network') {
      const networkResult = executeNetworkCommand(cmd, args, player, room);
      
      if (networkResult) {
        // Manejo especial de SSH
        if (networkResult.waitingForSSH) {
          player.sshPending = networkResult.sshTarget;
          socket.emit('command-result', {
            output: networkResult.output,
            color: 'cyan'
          });
          return;
        }

        socket.emit('command-result', networkResult);
        return;
      }
      // Si no es comando de red, continuar con comandos arcade
    }

    // ========== COMANDOS ARCADE ==========
    // Determinar qué filesystem usar según el host actual
    let currentFilesystem;
    if (room.category === 'network') {
      currentFilesystem = room.filesystem[player.currentHost] || {};
    } else {
      currentFilesystem = room.filesystem;
    }

    const result = executeCommand(cmd, args, player.path, currentFilesystem);

    // Trampa
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

    // Notificar progreso
    if (['cd', 'cat', 'nmap', 'ssh'].includes(cmd)) {
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
        io.to(roomId).emit('room-update', {
          players: Object.values(rooms[roomId].players).map(p => p.name),
          started: rooms[roomId].started,
          templateId: rooms[roomId].templateId,
          category: rooms[roomId].category
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

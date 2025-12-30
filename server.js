const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static('public'));

// Sistema de archivos mejorado con archivos ocultos y trampas
const filesystem = {
    '/': { type: 'dir', contents: ['home', 'var', 'etc'] },
    '/home': { type: 'dir', contents: ['user', 'admin'] },
    '/home/user': { type: 'dir', contents: ['documents', 'notes.txt', '.bash_history'] },
    '/home/user/notes.txt': { 
        type: 'file', 
        content: 'Remember to check logs regularly.\nThe admin keeps secrets in /var...' 
    },
    '/home/user/.bash_history': { 
        type: 'file', 
        content: 'cd /var/logs\nls -a\ncat secret.txt\nfind flag\nexit' 
    },
    '/home/user/documents': { type: 'dir', contents: ['report.txt', 'virus.exe'] },
    '/home/user/documents/report.txt': { 
        type: 'file', 
        content: 'Monthly Report:\nNothing suspicious found.\nAll systems operational.' 
    },
    '/home/user/documents/virus.exe': { 
        type: 'file', 
        content: '🦠 MALWARE DETECTED!\n💥 SYSTEM COMPROMISED!\n⚠️ Rebooting security protocols...', 
        isTrap: true,
        penaltyTime: 5000
    },
    
    '/var': { type: 'dir', contents: ['logs', 'tmp', '.hidden'] },
    '/var/.hidden': { type: 'dir', contents: ['backup.txt', 'old_flag.txt'] },
    '/var/.hidden/backup.txt': { 
        type: 'file', 
        content: 'System backup from last week.\nNothing interesting here.' 
    },
    '/var/.hidden/old_flag.txt': { 
        type: 'file', 
        content: 'FLAG{this_is_old_dont_submit}' 
    },
    '/var/tmp': { type: 'dir', contents: ['cache', '.temp'] },
    '/var/tmp/.temp': { 
        type: 'file', 
        content: 'Temporary data... nothing useful.' 
    },
    
    '/var/logs': { type: 'dir', contents: ['access.log', 'error.log', 'secret.txt', '.git'] },
    '/var/logs/.git': { type: 'dir', contents: ['config', 'HEAD'] },
    '/var/logs/.git/config': { 
        type: 'file', 
        content: '[core]\nrepositoryformatversion = 0\n[remote "origin"]\nurl = git@secret-server.com:flags.git' 
    },
    '/var/logs/.git/HEAD': { 
        type: 'file', 
        content: 'ref: refs/heads/master' 
    },
    '/var/logs/access.log': { 
        type: 'file', 
        content: '192.168.1.1 - [30/Dec/2025] "GET /admin HTTP/1.1" 200\n192.168.1.5 - [30/Dec/2025] "POST /login HTTP/1.1" 403\n10.0.0.50 - [30/Dec/2025] "GET /flag HTTP/1.1" 200\n192.168.1.1 - [30/Dec/2025] "GET /index HTTP/1.1" 200' 
    },
    '/var/logs/error.log': { 
        type: 'file', 
        content: '[ERROR] Failed to authenticate user\n[ERROR] Permission denied for /root\n[WARN] Suspicious activity detected\n[ERROR] File not found: secret.txt' 
    },
    '/var/logs/secret.txt': { 
        type: 'file', 
        content: '🚨 DECOY ALERT! 🚨\n\nNice try, but this is not the real flag.\nHint: Real secrets are hidden from plain sight.\nTry using ls -a to see what you\'re missing...' 
    },
    '/var/logs/.real_secret.txt': { 
        type: 'file', 
        content: 'Congratulations! You found the hidden file.\n\nFLAG{master_of_hidden_files_2025}' 
    },
    
    '/etc': { type: 'dir', contents: ['config', 'passwd', '.shadow'] },
    '/etc/passwd': { 
        type: 'file', 
        content: 'root:x:0:0:root:/root:/bin/bash\nuser:x:1000:1000:user:/home/user:/bin/bash\nadmin:x:1001:1001:admin:/home/admin:/bin/bash' 
    },
    '/etc/.shadow': { 
        type: 'file', 
        content: '🔒 ACCESS DENIED 🔒\nYou need root privileges!', 
        isTrap: true,
        penaltyTime: 3000
    },
    '/etc/config': { 
        type: 'file', 
        content: 'system_version=1.0\nflag_location=hidden\nsecurity_level=high' 
    }
};

// Salas de juego
const rooms = {};

// Función para resolver rutas
function resolvePath(currentPath, targetPath) {
    if (targetPath.startsWith('/')) return targetPath;
    if (targetPath === '..') {
        const parts = currentPath.split('/').filter(p => p);
        parts.pop();
        return '/' + parts.join('/');
    }
    if (targetPath === '.') return currentPath;
    return currentPath === '/' ? '/' + targetPath : currentPath + '/' + targetPath;
}

// Comandos mejorados
function executeCommand(cmd, args, currentPath) {
    switch(cmd.toLowerCase()) {
        case 'ls':
            const lsPath = args[0] && !args[0].startsWith('-') ? resolvePath(currentPath, args[0]) : currentPath;
            const lsDir = filesystem[lsPath];
            
            if (!lsDir) return { error: `ls: cannot access '${lsPath}': No such file or directory` };
            if (lsDir.type !== 'dir') return { error: `ls: cannot access '${lsPath}': Not a directory` };
            
            const showHidden = args.includes('-a') || args.includes('-la') || args.includes('-al');
            const visibleContents = showHidden 
                ? lsDir.contents 
                : lsDir.contents.filter(item => !item.startsWith('.'));
            
            if (visibleContents.length === 0) return { output: '' };
            return { output: visibleContents.join('\n') };
            
        case 'cd':
            const cdPath = args[0] ? resolvePath(currentPath, args[0]) : '/';
            const cdDir = filesystem[cdPath];
            if (!cdDir) return { error: `cd: ${cdPath}: No such file or directory` };
            if (cdDir.type !== 'dir') return { error: `cd: ${cdPath}: Not a directory` };
            return { output: '', newPath: cdPath };
            
        case 'cat':
            if (!args[0]) return { error: 'cat: missing file operand' };
            const catPath = resolvePath(currentPath, args[0]);
            const catFile = filesystem[catPath];
            if (!catFile) return { error: `cat: ${catPath}: No such file or directory` };
            if (catFile.type !== 'file') return { error: `cat: ${catPath}: Is a directory` };
            
            // TRAMPA: Si el archivo es una trampa, devolver con color rojo
            if (catFile.isTrap) {
                return { 
                    output: catFile.content, 
                    color: 'red',
                    isTrap: true,
                    penaltyTime: catFile.penaltyTime
                };
            }
            
            return { output: catFile.content };
            
        case 'grep':
            if (args.length < 2) return { error: 'usage: grep <pattern> <file>' };
            const searchTerm = args[0];
            const targetFile = args[1];
            
            const grepPath = resolvePath(currentPath, targetFile);
            const grepObj = filesystem[grepPath];
            
            if (!grepObj) return { error: `grep: ${targetFile}: No such file or directory` };
            if (grepObj.type !== 'file') return { error: `grep: ${targetFile}: Is a directory` };
            
            const matchingLines = grepObj.content
                .split('\n')
                .filter(line => line.toLowerCase().includes(searchTerm.toLowerCase()));
                
            if (matchingLines.length === 0) return { output: '(no matches found)' };
            return { output: matchingLines.join('\n') };
            
        case 'find':
            const searchPattern = args[0] || '';
            let foundPaths = [];
            
            Object.keys(filesystem).forEach(path => {
                const name = path.split('/').pop();
                if (name && name.toLowerCase().includes(searchPattern.toLowerCase())) {
                    const item = filesystem[path];
                    // Mostrar tipo y path
                    const typeIcon = item.type === 'dir' ? '📁' : '📄';
                    foundPaths.push(`${typeIcon} ${path}`);
                }
            });
            
            if (foundPaths.length === 0) return { output: `find: no files matching '${searchPattern}'` };
            return { output: foundPaths.join('\n') };
            
        case 'pwd':
            return { output: currentPath };
            
        case 'help':
            return { output: 'Available commands:\n  ls [-a] [path]  - List directory contents (-a shows hidden files)\n  cd <path>       - Change directory\n  cat <file>      - Read file contents\n  pwd             - Print working directory\n  grep <text> <file> - Search for text in file\n  find <name>     - Find files by name\n  submit <flag>   - Submit the flag to win\n  clear           - Clear terminal' };
            
        case 'clear':
            return { clear: true };
            
        default:
            return { error: `${cmd}: command not found. Type 'help' for available commands.` };
    }
}

io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);
    
    socket.on('join-room', (data) => {
        const { roomId, playerName } = data;
        
        if (!rooms[roomId]) {
            rooms[roomId] = {
                players: {},
                started: false,
                winner: null,
                startTime: null
            };
        }
        
        rooms[roomId].players[socket.id] = {
            name: playerName,
            path: '/',
            ready: false,
            frozenUntil: 0  // Sistema de trampas
        };
        
        socket.join(roomId);
        socket.roomId = roomId;
        
        io.to(roomId).emit('room-update', {
            players: Object.values(rooms[roomId].players).map(p => p.name),
            started: rooms[roomId].started
        });
        
        socket.emit('joined', { success: true });
    });
    
    socket.on('ready', () => {
        const roomId = socket.roomId;
        if (!roomId || !rooms[roomId]) return;
        
        rooms[roomId].players[socket.id].ready = true;
        
        const allReady = Object.values(rooms[roomId].players).every(p => p.ready);
        const playerCount = Object.keys(rooms[roomId].players).length;
        
        if (allReady && playerCount >= 2) {
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
        
        const player = rooms[roomId].players[socket.id];
        
        // CHEQUEO DE TRAMPA - Si el jugador está congelado
        if (Date.now() < player.frozenUntil) {
            const remaining = Math.ceil((player.frozenUntil - Date.now()) / 1000);
            socket.emit('command-result', { 
                error: `⚠️ TERMINAL LOCKED! Rebooting in ${remaining}s...`,
                color: 'red'
            });
            return;
        }
        
        const parts = data.command.trim().split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);
        
        // Comando especial: submit
        if (cmd === 'submit') {
            if (args[0] === 'FLAG{master_of_hidden_files_2025}') {
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
        
        // Ejecutar comando
        const result = executeCommand(cmd, args, player.path);
        
        // Si el resultado es una trampa, congelar al jugador
        if (result.isTrap) {
            player.frozenUntil = Date.now() + result.penaltyTime;
            // Notificar a otros jugadores
            socket.to(roomId).emit('player-action', {
                player: player.name,
                command: `activated a TRAP! (-${result.penaltyTime/1000}s penalty)`
            });
        }
        
        if (result.newPath !== undefined) {
            player.path = result.newPath;
        }
        
        socket.emit('command-result', result);
        
        // Notificar progreso a otros jugadores (solo comandos importantes)
        if (['cd', 'cat', 'submit'].includes(cmd)) {
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
                    players: Object.values(rooms[roomId].players).map(p => p.name)
                });
            }
        }
        console.log('Usuario desconectado:', socket.id);
    });
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🎮 CTF Race server running on port ${PORT}`);
});

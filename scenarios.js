// scenarios.js - Sistema de plantillas procedurales

// Plantillas de escenarios
const scenarioTemplates = {
    log_hunter: {
        id: 'log_hunter',
        name: 'Log Hunter',
        difficulty: 'easy',
        timeLimit: 180, // 3 minutos
        description: 'Find the password hidden in system logs',
        
        // Variables que cambian por seed
        variables: {
            logDirs: ['logs', 'audit', 'backups', 'history'],
            hintFiles: ['notes.txt', 'readme.txt', 'todo.txt', '.hints'],
            logFiles: ['sys.log', 'access.log', 'security.log', 'auth.log'],
            usernames: ['admin', 'root', 'sysadmin', 'operator']
        }
    },
    
    hidden_treasure: {
        id: 'hidden_treasure',
        name: 'Hidden Treasure',
        difficulty: 'medium',
        timeLimit: 240, // 4 minutos
        description: 'Find the flag hidden in secret files',
        
        variables: {
            secretDirs: ['.config', '.cache', '.local', '.hidden'],
            secretFiles: ['.secret', '.treasure', '.flag', '.data'],
            decoyDirs: ['backup', 'old', 'archive', 'temp']
        }
    }
};

// Generador de filesystem basado en seed
function generateFilesystem(templateId, seed) {
    const template = scenarioTemplates[templateId];
    if (!template) throw new Error('Template not found');
    
    // Usar seed para randomización consistente
    const random = seededRandom(seed);
    const vars = template.variables;
    
    let filesystem = {};
    let flag = `FLAG{${templateId}_${seed}_${random.string(8)}}`;
    
    switch(templateId) {
        case 'log_hunter':
            // Seleccionar ubicaciones aleatorias
            const logDir = vars.logDirs[random.int(vars.logDirs.length)];
            const hintFile = vars.hintFiles[random.int(vars.hintFiles.length)];
            const logFile = vars.logFiles[random.int(vars.logFiles.length)];
            const username = vars.usernames[random.int(vars.usernames.length)];
            const password = random.string(6).toUpperCase();
            
            filesystem = {
                '/': { type: 'dir', contents: ['home', 'var', 'etc'] },
                '/home': { type: 'dir', contents: ['user'] },
                '/home/user': { type: 'dir', contents: [hintFile] },
                [`/home/user/${hintFile}`]: { 
                    type: 'file', 
                    content: `System maintenance notes:\n- Check /${logDir} for recent activity\n- Contact ${username} for access` 
                },
                '/var': { type: 'dir', contents: [logDir, 'tmp'] },
                [`/var/${logDir}`]: { type: 'dir', contents: [logFile, 'old.log'] },
                [`/var/${logDir}/${logFile}`]: { 
                    type: 'file', 
                    content: `[INFO] System startup\n[ERROR] Login failed for ${username}\n[INFO] Password hint: ${password}\n[INFO] Access granted\n[INFO] ${flag}` 
                },
                [`/var/${logDir}/old.log`]: { 
                    type: 'file', 
                    content: 'Nothing interesting here...' 
                },
                '/etc': { type: 'dir', contents: ['config'] }
            };
            break;
            
        case 'hidden_treasure':
            const secretDir = vars.secretDirs[random.int(vars.secretDirs.length)];
            const secretFile = vars.secretFiles[random.int(vars.secretFiles.length)];
            const decoyDir = vars.decoyDirs[random.int(vars.decoyDirs.length)];
            
            filesystem = {
                '/': { type: 'dir', contents: ['home', 'var'] },
                '/home': { type: 'dir', contents: ['user'] },
                '/home/user': { type: 'dir', contents: ['documents', secretDir] },
                '/home/user/documents': { type: 'dir', contents: ['report.txt'] },
                '/home/user/documents/report.txt': { 
                    type: 'file', 
                    content: 'Nothing here. Try looking in hidden directories...' 
                },
                [`/home/user/${secretDir}`]: { type: 'dir', contents: [secretFile] },
                [`/home/user/${secretDir}/${secretFile}`]: { 
                    type: 'file', 
                    content: `Congratulations!\n\n${flag}` 
                },
                '/var': { type: 'dir', contents: [decoyDir] },
                [`/var/${decoyDir}`]: { type: 'dir', contents: ['fake.txt'] },
                [`/var/${decoyDir}/fake.txt`]: { 
                    type: 'file', 
                    content: 'This is not the flag you are looking for...',
                    isTrap: true,
                    penaltyTime: 3000
                }
            };
            break;
    }
    
    return { filesystem, flag, templateId };
}

// Generador de números aleatorios con seed
function seededRandom(seed) {
    let state = seed;
    
    return {
        // Genera número entre 0 y max
        int: (max) => {
            state = (state * 9301 + 49297) % 233280;
            return Math.floor((state / 233280) * max);
        },
        
        // Genera string aleatorio
        string: (length) => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let result = '';
            for (let i = 0; i < length; i++) {
                state = (state * 9301 + 49297) % 233280;
                result += chars[Math.floor((state / 233280) * chars.length)];
            }
            return result;
        }
    };
}

// Función para obtener un escenario generado
function getScenario(templateId, roomId) {
    // Usar roomId como seed para que cada sala tenga su propia variación
    const seed = hashString(roomId);
    return generateFilesystem(templateId, seed);
}

// Hash simple de string a número
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

// Exportar para usar en server.js
module.exports = {
    scenarioTemplates,
    getScenario,
    generateFilesystem
};
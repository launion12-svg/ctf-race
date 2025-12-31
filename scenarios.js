// scenarios.js - Sistema de plantillas procedurales

// Plantillas de escenarios
const scenarioTemplates = {
  // ✅ ID que usa tu frontend: hidden_files
  hidden_files: {
    id: 'hidden_files',
    name: 'Hidden Files',
    difficulty: 'easy',
    timeLimit: 180,
    description: 'Find the flag hidden in hidden files (use ls -a).',

    variables: {
      secretDirs: ['.config', '.cache', '.local', '.hidden'],
      secretFiles: ['.real_secret.txt', '.flag', '.secret', '.data'],
      decoyDirs: ['backup', 'old', 'archive', 'temp']
    }
  },

  log_hunter: {
    id: 'log_hunter',
    name: 'Log Hunter',
    difficulty: 'easy',
    timeLimit: 180, // 3 minutos
    description: 'Find the password hidden in system logs',

    variables: {
      logDirs: ['logs', 'audit', 'backups', 'history'],
      hintFiles: ['notes.txt', 'readme.txt', 'todo.txt', '.hints'],
      logFiles: ['sys.log', 'access.log', 'security.log', 'auth.log'],
      usernames: ['admin', 'root', 'sysadmin', 'operator']
    }
  },

  // (Opcional) lo dejamos por si lo quieres más adelante
  hidden_treasure: {
    id: 'hidden_treasure',
    name: 'Hidden Treasure',
    difficulty: 'medium',
    timeLimit: 240,
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
  // ✅ Fallback: nunca crashear el servidor
  const template =
    scenarioTemplates[templateId] ||
    scenarioTemplates.hidden_files ||
    scenarioTemplates.log_hunter;

  const random = seededRandom(seed);
  const vars = template.variables;

  let filesystem = {};
  let flag = `FLAG{${template.id}_${seed}_${random.string(8)}}`;

  switch (template.id) {
    case 'log_hunter': {
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
          content: `System maintenance notes:\n- Check /var/${logDir} for recent activity\n- Contact ${username} for access`
        },
        '/var': { type: 'dir', contents: [logDir, 'tmp'] },
        [`/var/${logDir}`]: { type: 'dir', contents: [logFile, 'old.log'] },
        [`/var/${logDir}/${logFile}`]: {
          type: 'file',
          content:
            `[INFO] System startup\n` +
            `[ERROR] Login failed for ${username}\n` +
            `[INFO] Password hint: ${password}\n` +
            `[INFO] Access granted\n` +
            `[INFO] ${flag}`
        },
        [`/var/${logDir}/old.log`]: {
          type: 'file',
          content: 'Nothing interesting here...'
        },
        '/etc': { type: 'dir', contents: ['config'] },
        '/etc/config': { type: 'file', content: 'system_version=1.0\nsecurity_level=high' }
      };
      break;
    }

    // ✅ hidden_files (tu selector)
    case 'hidden_files': {
      const secretDir = vars.secretDirs[random.int(vars.secretDirs.length)];
      const secretFile = vars.secretFiles[random.int(vars.secretFiles.length)];
      const decoyDir = vars.decoyDirs[random.int(vars.decoyDirs.length)];

      filesystem = {
        '/': { type: 'dir', contents: ['home', 'var', 'etc'] },
        '/home': { type: 'dir', contents: ['user'] },
        '/home/user': { type: 'dir', contents: ['documents', 'notes.txt'] },
        '/home/user/notes.txt': {
          type: 'file',
          content: `Hint: Hidden things are not shown by default.\nTry: ls -a\nAlso check hidden dirs in /home/user or /var.`
        },

        '/home/user/documents': { type: 'dir', contents: ['report.txt', 'virus.exe'] },
        '/home/user/documents/report.txt': {
          type: 'file',
          content: 'Nothing here. Try looking in hidden directories...'
        },

        // Trampa
        '/home/user/documents/virus.exe': {
          type: 'file',
          content: '🦠 MALWARE DETECTED!\n💥 SYSTEM COMPROMISED!\n⚠️ Rebooting security protocols...',
          isTrap: true,
          penaltyTime: 5000
        },

        '/var': { type: 'dir', contents: [decoyDir, 'tmp'] },
        [`/var/${decoyDir}`]: { type: 'dir', contents: ['fake.txt'] },
        [`/var/${decoyDir}/fake.txt`]: {
          type: 'file',
          content: 'This is not the flag you are looking for...',
          isTrap: true,
          penaltyTime: 3000
        },

        '/etc': { type: 'dir', contents: ['config'] },
        '/etc/config': { type: 'file', content: 'flag_location=hidden\nsecurity_level=high' },

        // Carpeta oculta donde está el flag
        [`/home/user/${secretDir}`]: { type: 'dir', contents: [secretFile] },
        [`/home/user/${secretDir}/${secretFile}`]: {
          type: 'file',
          content: `Congratulations!\n\n${flag}`
        }
      };
      break;
    }

    // mantenemos hidden_treasure por si quieres usarlo luego
    case 'hidden_treasure': {
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

    default: {
      // Nunca debería llegar aquí por el fallback
      filesystem = {
        '/': { type: 'dir', contents: ['home'] },
        '/home': { type: 'dir', contents: ['user'] },
        '/home/user': { type: 'dir', contents: ['flag.txt'] },
        '/home/user/flag.txt': { type: 'file', content: `FLAG{fallback}` }
      };
      flag = 'FLAG{fallback}';
    }
  }

  return { filesystem, flag, templateId: template.id };
}

// Generador de números aleatorios con seed
function seededRandom(seed) {
  let state = seed || 1;

  return {
    int: (max) => {
      state = (state * 9301 + 49297) % 233280;
      return Math.floor((state / 233280) * max);
    },
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

function getScenario(templateId, roomId) {
  const seed = hashString(roomId);
  return generateFilesystem(templateId, seed);
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) || 1;
}

module.exports = {
  scenarioTemplates,
  getScenario,
  generateFilesystem
};

// scenarios.js - Sistema de plantillas procedurales (ACTUALIZADO con Network Scenarios)

// Plantillas de escenarios
const scenarioTemplates = {
  // ========== ARCADE SCENARIOS (ya existentes) ==========
  
  hidden_files: {
    id: 'hidden_files',
    name: 'Hidden Files',
    category: 'arcade',
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
    category: 'arcade',
    difficulty: 'easy',
    timeLimit: 180,
    description: 'Find the password hidden in system logs',

    variables: {
      logDirs: ['logs', 'audit', 'backups', 'history'],
      hintFiles: ['notes.txt', 'readme.txt', 'todo.txt', '.hints'],
      logFiles: ['sys.log', 'access.log', 'security.log', 'auth.log'],
      usernames: ['admin', 'root', 'sysadmin', 'operator']
    }
  },

  // ========== NETWORK SCENARIOS (nuevo tipo) ==========

  antonios_laptop: {
    id: 'antonios_laptop',
    name: "Antonio's Laptop",
    category: 'network',
    difficulty: 'medium',
    timeLimit: 300, // 5 minutos
    description: 'Hack into Antonio\'s laptop through the network. Use nmap, ssh, and explore the internal network.',
    
    briefing: `MISSION BRIEFING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Target: Antonio's laptop (internal network)
Entry Point: 203.0.113.10 (Bastion server)

Initial Credentials:
  Username: student
  Password: student123

Objective: Extract the flag from Antonio's Documents folder

Hint: Start by scanning the entry point with 'nmap'
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,

    variables: {
      targetNames: ['antonio', 'maria', 'carlos', 'laura'],
      internalIPs: ['10.10.0.20', '10.10.0.25', '10.10.0.30'],
      bastionIPs: ['203.0.113.10', '198.51.100.25', '192.0.2.50'],
      passwords: ['qwerty123', 'letmein', 'secret123', 'pass1234']
    },

    // Filesystem multi-host
    hosts: {
      external: {
        // Solo briefing disponible
        showBriefing: true
      },
      
      bastion: {
        hostname: '203.0.113.10',
        internalIP: '10.10.0.5',
        filesystem: {
          '/': { type: 'dir', contents: ['home', 'var'] },
          '/home': { type: 'dir', contents: ['student'] },
          '/home/student': { type: 'dir', contents: ['notes.txt', '.ssh'] },
          '/home/student/notes.txt': {
            type: 'file',
            content: `Network Topology Notes
━━━━━━━━━━━━━━━━━━━━━━━━
Internal network: 10.10.0.0/24
Known hosts:
  - This machine: 10.10.0.5
  - Target laptop: 10.10.0.XX (scan to discover)

Tip: Use 'nmap 10.10.0.0/24' to find active hosts`
          },
          '/home/student/.ssh': { type: 'dir', contents: ['id_rsa'] },
          '/home/student/.ssh/id_rsa': {
            type: 'file',
            content: `-----BEGIN PRIVATE KEY-----
(SSH key for internal access)
Note: This key works for user 'antonio'
-----END PRIVATE KEY-----`
          },
          '/var': { type: 'dir', contents: ['log'] },
          '/var/log': { type: 'dir', contents: ['auth.log'] },
          '/var/log/auth.log': {
            type: 'file',
            content: `[INFO] SSH login: user 'student' from external
[INFO] Internal network access granted
[INFO] Recent connections from 10.10.0.20 (antonio-laptop)
[WARN] Weak password detected on internal host`
          }
        }
      },
      
      target: {
        // Se genera dinámicamente con variables
        filesystem: {
          '/': { type: 'dir', contents: ['home'] },
          '/home': { type: 'dir', contents: ['antonio'] },
          '/home/antonio': { type: 'dir', contents: ['Documents', 'Desktop'] },
          '/home/antonio/Documents': { type: 'dir', contents: ['grades.xlsx', 'notes.txt'] },
          '/home/antonio/Documents/grades.xlsx': {
            type: 'file',
            content: `Student Grades - CONFIDENTIAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[... grades data ...]

🎯 FLAG{PLACEHOLDER}`
          },
          '/home/antonio/Documents/notes.txt': {
            type: 'file',
            content: 'Remember to backup grades file to secure server...'
          },
          '/home/antonio/Desktop': { type: 'dir', contents: ['readme.txt'] },
          '/home/antonio/Desktop/readme.txt': {
            type: 'file',
            content: 'Personal files. Check Documents folder for work files.'
          }
        }
      }
    }
  }
};

// Generador de filesystem basado en seed
function generateFilesystem(templateId, seed) {
  const template =
    scenarioTemplates[templateId] ||
    scenarioTemplates.hidden_files;

  const random = seededRandom(seed);
  const vars = template.variables;

  let filesystem = {};
  let flag = `FLAG{${template.id}_${seed}_${random.string(8)}}`;
  let networkData = null; // Para escenarios de red

  // ========== NETWORK SCENARIOS ==========
  if (template.category === 'network') {
    // Variables aleatorias
    const targetName = vars.targetNames[random.int(vars.targetNames.length)];
    const targetIP = vars.internalIPs[random.int(vars.internalIPs.length)];
    const bastionIP = vars.bastionIPs[random.int(vars.bastionIPs.length)];
    const targetPassword = vars.passwords[random.int(vars.passwords.length)];

    networkData = {
      bastionIP: bastionIP,
      bastionUsername: 'student',
      bastionPassword: 'student123',
      internalNetwork: '10.10.0.0/24',
      targetIP: targetIP,
      targetUsername: targetName,
      targetPassword: targetPassword,
      targetHostname: `${targetName}-laptop`
    };

    // Copiar filesystems base de los hosts
    const bastionFS = JSON.parse(JSON.stringify(template.hosts.bastion.filesystem));
    
    // Construir filesystem del target con el nombre de usuario correcto
    const targetFS = {
      '/': { type: 'dir', contents: ['home'] },
      '/home': { type: 'dir', contents: [targetName] },
      [`/home/${targetName}`]: { type: 'dir', contents: ['Documents', 'Desktop'] },
      [`/home/${targetName}/Documents`]: { type: 'dir', contents: ['grades.xlsx', 'notes.txt'] },
      [`/home/${targetName}/Documents/grades.xlsx`]: {
        type: 'file',
        content: `Student Grades - CONFIDENTIAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[... grades data ...]

🎯 ${flag}`
      },
      [`/home/${targetName}/Documents/notes.txt`]: {
        type: 'file',
        content: 'Remember to backup grades file to secure server...'
      },
      [`/home/${targetName}/Desktop`]: { type: 'dir', contents: ['readme.txt'] },
      [`/home/${targetName}/Desktop/readme.txt`]: {
        type: 'file',
        content: 'Personal files. Check Documents folder for work files.'
      }
    };

    return {
      filesystem: {
        bastion: bastionFS,
        target: targetFS
      },
      flag,
      templateId: template.id,
      category: template.category,
      networkData,
      briefing: template.briefing
    };
  }

  // ========== ARCADE SCENARIOS (código existente) ==========
  
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

        [`/home/user/${secretDir}`]: { type: 'dir', contents: [secretFile] },
        [`/home/user/${secretDir}/${secretFile}`]: {
          type: 'file',
          content: `Congratulations!\n\n${flag}`
        }
      };
      break;
    }

    default: {
      filesystem = {
        '/': { type: 'dir', contents: ['home'] },
        '/home': { type: 'dir', contents: ['user'] },
        '/home/user': { type: 'dir', contents: ['flag.txt'] },
        '/home/user/flag.txt': { type: 'file', content: `FLAG{fallback}` }
      };
      flag = 'FLAG{fallback}';
    }
  }

  return { 
    filesystem, 
    flag, 
    templateId: template.id,
    category: template.category || 'arcade'
  };
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

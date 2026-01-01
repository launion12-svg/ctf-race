# 🚀 IMPLEMENTACIÓN - Antonio's Laptop (Network Scenario)

## 📋 Resumen de cambios

Has recibido 3 archivos actualizados que añaden el escenario de red sin romper los arcade:

1. **scenarios-updated.js** - Nuevo escenario "Antonio's Laptop"
2. **server-updated.js** - Comandos de red (nmap, ssh, ifconfig)
3. **index-updated.html** - Selector con categorías

## ✅ Pasos de implementación

### 1️⃣ Backup de tus archivos actuales

```bash
# Desde tu proyecto local
cp scenarios.js scenarios-backup.js
cp server.js server-backup.js
cp public/index.html public/index-backup.html
```

### 2️⃣ Reemplazar archivos

```bash
# Reemplaza con las versiones actualizadas
mv scenarios-updated.js scenarios.js
mv server-updated.js server.js
mv index-updated.html public/index.html
```

### 3️⃣ Commit y push a tu repo

```bash
git add .
git commit -m "feat: Add Network Scenarios - Antonio's Laptop"
git push origin main
```

### 4️⃣ Render desplegará automáticamente

Render detectará el cambio y redesplegará en ~2-3 minutos.

---

## 🎮 Cómo testear el nuevo escenario

### Test 1: Crear sala

1. Abre https://ctf-race.onrender.com/
2. Nombre: "Tester1"
3. Room ID: "test123"
4. Escenario: Selecciona **"Antonio's Laptop (Medium)"**
5. JOIN ROOM

### Test 2: Segunda pestaña (mismo escenario)

1. Nueva pestaña (Ctrl+Shift+N)
2. Nombre: "Tester2"
3. Room ID: "test123"
4. El selector debería estar **bloqueado** en "Antonio's Laptop"
5. JOIN ROOM

### Test 3: Ambos I'M READY

Cuando ambos pulsen READY, el juego comienza.

---

## 🎯 Guía de juego (Solución completa)

### Paso 1: Ver el briefing
```
mission
```

Esto te muestra:
- IP inicial: 203.0.113.10
- Usuario: student
- Password: student123

### Paso 2: Escanear el bastion
```
nmap 203.0.113.10
```

Descubres que el puerto 22 (SSH) está abierto.

### Paso 3: Conectar al bastion
```
ssh student@203.0.113.10
```

Te pedirá password, escribe:
```
student123
```

✅ Ahora estás en el **bastion** (primer salto)

### Paso 4: Ver interfaces de red
```
ifconfig
```

Descubres:
- eth0: 203.0.113.10 (externa)
- eth1: 10.10.0.5 (interna)
- Red interna: 10.10.0.0/24

### Paso 5: Leer pistas
```
cat /home/student/notes.txt
```

Te sugiere escanear la red interna.

### Paso 6: Escanear red interna
```
nmap 10.10.0.0/24
```

Descubres:
- 10.10.0.5 (bastion - tú)
- 10.10.0.XX (antonio-laptop) <- **OBJETIVO**

### Paso 7: Conectar al laptop de Antonio
```
ssh antonio@10.10.0.XX
```

(Reemplaza XX con la IP que te salió en el nmap)

Te pedirá password. Intenta:
```
qwerty123
```

(O busca en `/home/student/.ssh/id_rsa` para una pista)

✅ Ahora estás en el **laptop de Antonio**

### Paso 8: Encontrar el flag
```
ls /home/antonio
cd Documents
cat grades.xlsx
```

🎯 Verás el **FLAG{...}**

### Paso 9: Enviar el flag
```
submit FLAG{...}
```

🏆 **¡VICTORIA!**

---

## 🧪 Tests de validación

### ✅ Checklist básico

- [ ] Escenarios arcade siguen funcionando (hidden_files, log_hunter)
- [ ] Selector muestra categorías (ARCADE / NETWORK)
- [ ] Al crear sala con Network, se bloquea para los demás
- [ ] Comando `mission` muestra el briefing
- [ ] Comando `status` muestra estado actual
- [ ] `nmap` desde external solo escanea bastion
- [ ] `ssh` pide password
- [ ] Password correcta cambia de host
- [ ] `ifconfig` muestra interfaces correctas
- [ ] `nmap` desde bastion descubre red interna
- [ ] Al conectar a target, filesystem cambia
- [ ] `submit` con flag correcto gana la partida
- [ ] Indicador de host (arriba izquierda) cambia correctamente

---

## 🐛 Posibles problemas y soluciones

### Problema: "Cannot find module './scenarios'"

**Solución:**
```bash
# Asegúrate de que scenarios.js está en la raíz del proyecto
ls -la | grep scenarios
```

### Problema: El selector no muestra el nuevo escenario

**Solución:** Hard refresh del navegador (Ctrl+Shift+R)

### Problema: SSH no cambia de host

**Solución:** Revisa los logs del servidor:
```bash
# En Render Dashboard → Logs
# Busca errores relacionados con "ssh" o "networkData"
```

### Problema: Los comandos de red no responden

**Solución:** Verifica que `room.category === 'network'` en server.js

---

## 📊 Arquitectura del sistema

```
EXTERNAL
   ↓
[nmap 203.0.113.10] → Descubre SSH abierto
   ↓
[ssh student@203.0.113.10] → Conecta
   ↓
BASTION (10.10.0.5)
   ↓
[ifconfig] → Ve red interna 10.10.0.0/24
   ↓
[nmap 10.10.0.0/24] → Descubre antonio-laptop
   ↓
[ssh antonio@10.10.0.XX] → Conecta
   ↓
TARGET (antonio-laptop)
   ↓
[cat /home/antonio/Documents/grades.xlsx] → FLAG
   ↓
[submit FLAG{...}] → VICTORIA
```

---

## 🎓 Uso en clase

### Sesión 1: Arcade (calentamiento)
- hidden_files (3 min)
- log_hunter (3 min)
- **Objetivo:** Familiarización con comandos

### Sesión 2: Network (desafío)
- Antonio's Laptop (5-8 min)
- **Objetivo:** Pensamiento estratégico

### Debrief (después de cada partida)
- ¿Qué ruta seguiste?
- ¿Qué comandos fueron clave?
- ¿Cómo podrías haber sido más rápido?

---

## 🚀 Próximos pasos sugeridos

### Nivel 1 (fácil)
- [ ] Añadir comando `history` para ver comandos previos
- [ ] Añadir `man <comando>` para ayuda específica
- [ ] Mostrar tiempo del ganador en lobby después de juego

### Nivel 2 (medio)
- [ ] Crear segundo escenario de red: "Database Breach"
- [ ] Añadir más trampas en archivos
- [ ] Sistema de hints progresivos (cada 60s)

### Nivel 3 (avanzado)
- [ ] Modo espectador para el profesor
- [ ] Grabación de sesiones (replay)
- [ ] Leaderboard persistente (MongoDB/PostgreSQL)

---

## ❓ ¿Necesitas ayuda?

Si algo falla:
1. Revisa los logs de Render
2. Testea en local primero (`node server.js`)
3. Compara con los archivos -backup

---

**✅ READY TO DEPLOY!**

Una vez reemplaces los archivos y hagas push, el nuevo escenario estará disponible en:
https://ctf-race.onrender.com/

¡Disfruta el nuevo modo Network! 🎮🌐

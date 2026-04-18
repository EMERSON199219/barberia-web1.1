const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const multer = require('multer');
const app = express();
// Configuración de almacenamiento para logos
const LOGOS_DIR = path.join(__dirname, 'public', 'logos');
const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        await ensureDir(LOGOS_DIR);
        cb(null, LOGOS_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});
const upload = multer({ storage });

// Servir logos como archivos estáticos
app.use('/logos', express.static(LOGOS_DIR));

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const BARBERIAS_FILE = path.join(DATA_DIR, 'barberias.json');

// Credenciales del superadmin
const SUPERADMIN_USER = 'superadmin';
const SUPERADMIN_PASSWORD = 'superadmin123';

// Tokens activos (token -> { barberiaId, role })
const tokens = new Map();

app.use(express.json());
app.use(express.static('public'));

// ==================== UTILIDADES ====================

async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

async function ensureFile(filePath, defaultData = '[]') {
    await ensureDir(path.dirname(filePath));
    try {
        await fs.access(filePath);
    } catch {
        await fs.writeFile(filePath, defaultData, 'utf8');
    }
}

async function readJson(filePath, defaultData = '[]') {
    await ensureFile(filePath, defaultData);
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data || defaultData);
}

async function writeJson(filePath, data) {
    await ensureFile(filePath);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ==================== MIDDLEWARE ====================

function authMiddleware(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    const token = auth.slice(7);
    const tokenData = tokens.get(token);
    
    if (!tokenData) {
        return res.status(401).json({ error: 'Token inválido' });
    }

    req.tokenData = tokenData;
    next();
}

function superadminMiddleware(req, res, next) {
    if (req.tokenData.role !== 'superadmin') {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    next();
}

// ==================== AUTH ====================

// Login superadmin
app.post('/api/superadmin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === SUPERADMIN_USER && password === SUPERADMIN_PASSWORD) {
        const token = crypto.randomBytes(24).toString('hex');
        tokens.set(token, { barberiaId: null, role: 'superadmin' });
        return res.json({ token, role: 'superadmin' });
    }
    res.status(401).json({ error: 'Credenciales incorrectas' });
});

// Login barbería
app.post('/api/barberia/login', async (req, res) => {
    const { username, password, barberiaId } = req.body;
    
    const barberias = await readJson(BARBERIAS_FILE, '[]');
    const barberia = barberias.find(b => b.id === barberiaId && b.activa);
    
    if (!barberia) {
        return res.status(404).json({ error: 'Barbería no encontrada o inactiva' });
    }
    
    if (barberia.username === username && barberia.password === password) {
        const token = crypto.randomBytes(24).toString('hex');
        tokens.set(token, { barberiaId, role: 'admin' });
        return res.json({ 
            token, 
            role: 'admin', 
            barberia: { 
                id: barberia.id, 
                nombre: barberia.nombre 
            }
        });
    }
    
    res.status(401).json({ error: 'Credenciales incorrectas' });
});

// Logout
app.post('/api/logout', authMiddleware, (req, res) => {
    const auth = req.headers.authorization;
    const token = auth.slice(7);
    tokens.delete(token);
    res.json({ message: 'Sesión cerrada' });
});

// ==================== SUPERADMIN ====================

// Obtener todas las barberías
app.get('/api/superadmin/barberias', authMiddleware, superadminMiddleware, async (req, res) => {
    const barberias = await readJson(BARBERIAS_FILE, '[]');
    // No devolver contraseñas
    const safeBarberias = barberias.map(b => ({
        id: b.id,
        nombre: b.nombre,
        username: b.username,
        color: b.color,
        activa: b.activa,
        fechaCreacion: b.fechaCreacion,
        logoUrl: b.logoUrl || null,
        barberos: b.barberos || []
    }));
    res.json({ barberias: safeBarberias });
});

// Crear barbería
app.post('/api/superadmin/barberias', authMiddleware, superadminMiddleware, upload.single('logo'), async (req, res) => {
    const { nombre, username, password, color } = req.body;
    let barberos = [];
    if (req.body.barberos) {
        try {
            barberos = JSON.parse(req.body.barberos);
        } catch (e) {
            barberos = [];
        }
    }
    let logoUrl = null;
    if (req.file) {
        logoUrl = `/logos/${req.file.filename}`;
    }
    if (!nombre || !username || !password) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    const barberias = await readJson(BARBERIAS_FILE, '[]');
    // Verificar que no exista el username
    if (barberias.some(b => b.username === username)) {
        return res.status(409).json({ error: 'El usuario ya existe' });
    }
    const nuevaBarberia = {
        id: crypto.randomBytes(8).toString('hex'),
        nombre,
        username,
        password, // En producción, hashear esto
        color: color || 'rosado',
        activa: true,
        fechaCreacion: new Date().toISOString(),
        logoUrl,
        barberos
    };
    barberias.push(nuevaBarberia);
    await writeJson(BARBERIAS_FILE, barberias);
    // Crear directorio para citas de esta barbería
    const barberiaDir = path.join(DATA_DIR, nuevaBarberia.id);
    await ensureDir(barberiaDir);
    await writeJson(path.join(barberiaDir, 'citas.json'), []);
    res.status(201).json({ 
        message: 'Barbería creada', 
        barberia: { id: nuevaBarberia.id, nombre: nuevaBarberia.nombre, activa: nuevaBarberia.activa, color: nuevaBarberia.color, logoUrl: nuevaBarberia.logoUrl, barberos: nuevaBarberia.barberos }
    });
});

// Editar barbería
app.put('/api/superadmin/barberias/:id', authMiddleware, superadminMiddleware, upload.single('logo'), async (req, res) => {
    const { id } = req.params;
    const { nombre, username, password, activa, color } = req.body;
    let barberos = [];
    if (req.body.barberos) {
        try {
            barberos = JSON.parse(req.body.barberos);
        } catch (e) {
            barberos = [];
        }
    }
    let logoUrl = null;
    if (req.file) {
        logoUrl = `/logos/${req.file.filename}`;
    }
    const barberias = await readJson(BARBERIAS_FILE, '[]');
    const index = barberias.findIndex(b => b.id === id);
    if (index === -1) {
        return res.status(404).json({ error: 'Barbería no encontrada' });
    }
    // Verificar username único si se cambia
    if (username && barberias.some(b => b.username === username && b.id !== id)) {
        return res.status(409).json({ error: 'El usuario ya existe' });
    }
    if (nombre) barberias[index].nombre = nombre;
    if (username) barberias[index].username = username;
    if (password) barberias[index].password = password;
    if (typeof activa === 'boolean') barberias[index].activa = activa;
    if (color) barberias[index].color = color;
    if (logoUrl) barberias[index].logoUrl = logoUrl;
    barberias[index].barberos = barberos;
    await writeJson(BARBERIAS_FILE, barberias);
    res.json({ message: 'Barbería actualizada', barberia: barberias[index] });
});

// Eliminar barbería
app.delete('/api/superadmin/barberias/:id', authMiddleware, superadminMiddleware, async (req, res) => {
    const { id } = req.params;
    
    const barberias = await readJson(BARBERIAS_FILE, '[]');
    const index = barberias.findIndex(b => b.id === id);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Barbería no encontrada' });
    }
    
    barberias.splice(index, 1);
    await writeJson(BARBERIAS_FILE, barberias);
    
    res.json({ message: 'Barbería eliminada' });
});

// ==================== BARBERÍAS (PÚBLICO) ====================

// Listar barberías activas (para selector)
app.get('/api/barberias', async (req, res) => {
    const barberias = await readJson(BARBERIAS_FILE, '[]');
    const activas = barberias
        .filter(b => b.activa)
        .map(b => ({ id: b.id, nombre: b.nombre }));
    res.json({ barberias: activas });
});

// Obtener info de una barbería
app.get('/api/barberias/:id', async (req, res) => {
    const { id } = req.params;
    const barberias = await readJson(BARBERIAS_FILE, '[]');
    const barberia = barberias.find(b => b.id === id && b.activa);
    
    if (!barberia) {
        return res.status(404).json({ error: 'Barbería no encontrada' });
    }
    
    res.json({ barberia: { id: barberia.id, nombre: barberia.nombre, color: barberia.color } });
});

// ==================== CITAS ====================

function getCitasPath(barberiaId) {
    return path.join(DATA_DIR, barberiaId, 'citas.json');
}

// Crear cita (público - requiere barberiaId)
app.post('/api/citas', async (req, res) => {
    const { barberiaId, nombre, telefono, fecha, hora, servicio, notas } = req.body;
    
    if (!barberiaId || !nombre || !telefono || !fecha || !hora || !servicio) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    
    // Verificar que la barbería existe y está activa
    const barberias = await readJson(BARBERIAS_FILE, '[]');
    const barberia = barberias.find(b => b.id === barberiaId && b.activa);
    
    if (!barberia) {
        return res.status(404).json({ error: 'Barbería no encontrada o inactiva' });
    }
    
    const citasPath = getCitasPath(barberiaId);
    const citas = await readJson(citasPath, '[]');
    
    const turnoOcupado = citas.some(cita => cita.fecha === fecha && cita.hora === hora);
    if (turnoOcupado) {
        return res.status(409).json({ error: 'El turno ya está reservado para esta fecha' });
    }
    
    const cita = { 
        id: crypto.randomBytes(8).toString('hex'),
        nombre, 
        telefono, 
        fecha, 
        hora, 
        servicio, 
        notas,
        fechaCreacion: new Date().toISOString()
    };
    
    citas.push(cita);
    await writeJson(citasPath, citas);
    
    res.status(201).json({ message: 'Cita reservada', cita });
});

// Obtener turnos ocupados (público)
app.get('/api/turnos', async (req, res) => {
    const { barberiaId, date } = req.query;
    
    if (!barberiaId || !date) {
        return res.status(400).json({ error: 'Faltan parámetros' });
    }
    
    const citasPath = getCitasPath(barberiaId);
    const citas = await readJson(citasPath, '[]');
    
    const horas = citas
        .filter(cita => cita.fecha === date)
        .map(cita => cita.hora);
    
    res.json({ horas });
});

// Obtener citas (admin de barbería)
app.get('/api/citas', authMiddleware, async (req, res) => {
    if (req.tokenData.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const barberiaId = req.tokenData.barberiaId;
    const citasPath = getCitasPath(barberiaId);
    const citas = await readJson(citasPath, '[]');
    
    res.json({ citas });
});

// Actualizar cita
app.put('/api/citas/:id', authMiddleware, async (req, res) => {
    if (req.tokenData.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const { id } = req.params;
    const { nombre, telefono, fecha, hora, servicio, notas } = req.body;
    const barberiaId = req.tokenData.barberiaId;
    
    const citasPath = getCitasPath(barberiaId);
    const citas = await readJson(citasPath, '[]');
    const index = citas.findIndex(c => c.id === id);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Cita no encontrada' });
    }
    
    // Verificar turno ocupado (excluyendo esta cita)
    const turnoOcupado = citas.some((cita, idx) => 
        idx !== index && cita.fecha === fecha && cita.hora === hora
    );
    if (turnoOcupado) {
        return res.status(409).json({ error: 'El turno ya está reservado para esta fecha' });
    }
    
    citas[index] = {
        ...citas[index],
        nombre,
        telefono,
        fecha,
        hora,
        servicio,
        notas
    };
    
    await writeJson(citasPath, citas);
    res.json({ message: 'Cita actualizada', cita: citas[index] });
});

// Eliminar cita
app.delete('/api/citas/:id', authMiddleware, async (req, res) => {
    if (req.tokenData.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const { id } = req.params;
    const barberiaId = req.tokenData.barberiaId;
    
    const citasPath = getCitasPath(barberiaId);
    const citas = await readJson(citasPath, '[]');
    const index = citas.findIndex(c => c.id === id);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Cita no encontrada' });
    }
    
    const deleted = citas.splice(index, 1);
    await writeJson(citasPath, citas);
    
    res.json({ message: 'Cita cancelada', cita: deleted[0] });
});

// ==================== RUTAS ====================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/superadmin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'superadmin.html'));
});

// Iniciar servidor
app.listen(PORT, async () => {
    await ensureDir(DATA_DIR);
    await ensureFile(BARBERIAS_FILE, '[]');
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log(`Panel superadmin: http://localhost:${PORT}/superadmin`);
});

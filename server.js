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

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

// Conexión a MongoDB Atlas
const client = new MongoClient(process.env.MONGODB_URI);
let db;
let barberiasCollection;

async function connectMongo() {
    if (!db) {
        await client.connect();
        db = client.db('barberia'); // nombre de tu base de datos
        barberiasCollection = db.collection('barberias');
    }
}

// Middleware para asegurar conexión
async function mongoMiddleware(req, res, next) {
    try {
        await connectMongo();
        next();
    } catch (err) {
        res.status(500).json({ error: 'Error de conexión a la base de datos' });
    }
}

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

// Login barbería (MongoDB)
app.post('/api/barberia/login', mongoMiddleware, async (req, res) => {
    const { username, password, barberiaId } = req.body;
    let barberia;
    if (barberiaId) {
        barberia = await barberiasCollection.findOne({ _id: new ObjectId(barberiaId), activa: true });
    } else {
        barberia = await barberiasCollection.findOne({ username, activa: true });
    }
    if (!barberia) {
        return res.status(404).json({ error: 'Barbería no encontrada o inactiva' });
    }
    if (barberia.username === username && barberia.password === password) {
        const token = crypto.randomBytes(24).toString('hex');
        tokens.set(token, { barberiaId: barberia._id.toString(), role: 'admin' });
        return res.json({ 
            token, 
            role: 'admin', 
            barberia: { 
                id: barberia._id.toString(), 
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

// Obtener todas las barberías (MongoDB)
app.get('/api/superadmin/barberias', authMiddleware, superadminMiddleware, mongoMiddleware, async (req, res) => {
    const barberias = await barberiasCollection.find({}).toArray();
    // No devolver contraseñas
    const safeBarberias = barberias.map(b => ({
        id: b._id.toString(),
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

// Crear barbería (MongoDB)
app.post('/api/superadmin/barberias', authMiddleware, superadminMiddleware, mongoMiddleware, upload.single('logo'), async (req, res) => {
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
    // Verificar que no exista el username
    const existe = await barberiasCollection.findOne({ username });
    if (existe) {
        return res.status(409).json({ error: 'El usuario ya existe' });
    }
    const nuevaBarberia = {
        nombre,
        username,
        password, // En producción, hashear esto
        color: color || 'rosado',
        activa: true,
        fechaCreacion: new Date().toISOString(),
        logoUrl,
        barberos
    };
    const result = await barberiasCollection.insertOne(nuevaBarberia);
    res.status(201).json({ 
        message: 'Barbería creada', 
        barberia: { id: result.insertedId.toString(), ...nuevaBarberia }
    });
});

// Editar barbería (MongoDB)
app.put('/api/superadmin/barberias/:id', authMiddleware, superadminMiddleware, mongoMiddleware, upload.single('logo'), async (req, res) => {
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
    // Verificar username único si se cambia
    if (username) {
        const existe = await barberiasCollection.findOne({ username, _id: { $ne: new ObjectId(id) } });
        if (existe) {
            return res.status(409).json({ error: 'El usuario ya existe' });
        }
    }
    const update = {};
    if (nombre) update.nombre = nombre;
    if (username) update.username = username;
    if (password) update.password = password;
    if (typeof activa !== 'undefined') update.activa = activa === 'true' || activa === true;
    if (color) update.color = color;
    if (logoUrl) update.logoUrl = logoUrl;
    update.barberos = barberos;
    const result = await barberiasCollection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: update },
        { returnDocument: 'after' }
    );
    if (!result.value) {
        return res.status(404).json({ error: 'Barbería no encontrada' });
    }
    res.json({ message: 'Barbería actualizada', barberia: { id: result.value._id.toString(), ...result.value } });
});

// Eliminar barbería (MongoDB)
app.delete('/api/superadmin/barberias/:id', authMiddleware, superadminMiddleware, mongoMiddleware, async (req, res) => {
    const { id } = req.params;
    const result = await barberiasCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Barbería no encontrada' });
    }
    res.json({ message: 'Barbería eliminada' });
});

// ==================== BARBERÍAS (PÚBLICO) ====================

// Listar barberías activas (para selector, MongoDB)
app.get('/api/barberias', mongoMiddleware, async (req, res) => {
    const barberias = await barberiasCollection.find({ activa: true }).toArray();
    const activas = barberias.map(b => ({ id: b._id.toString(), nombre: b.nombre }));
    res.json({ barberias: activas });
});

// Obtener info de una barbería (MongoDB)
app.get('/api/barberias/:id', mongoMiddleware, async (req, res) => {
    const { id } = req.params;
    const barberia = await barberiasCollection.findOne({ _id: new ObjectId(id), activa: true });
    if (!barberia) {
        return res.status(404).json({ error: 'Barbería no encontrada' });
    }
    res.json({ barberia: { id: barberia._id.toString(), nombre: barberia.nombre, color: barberia.color } });
});

// ==================== CITAS (MongoDB) ====================

function getCitasCollection(barberiaId) {
    return db.collection(`citas_${barberiaId}`);
}

// Crear cita (público - requiere barberiaId)
app.post('/api/citas', mongoMiddleware, async (req, res) => {
    const { barberiaId, nombre, telefono, fecha, hora, servicio, notas } = req.body;
    if (!barberiaId || !nombre || !telefono || !fecha || !hora || !servicio) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    // Verificar que la barbería existe y está activa
    const barberia = await barberiasCollection.findOne({ _id: new ObjectId(barberiaId), activa: true });
    if (!barberia) {
        return res.status(404).json({ error: 'Barbería no encontrada o inactiva' });
    }
    const citasCol = getCitasCollection(barberiaId);
    const turnoOcupado = await citasCol.findOne({ fecha, hora });
    if (turnoOcupado) {
        return res.status(409).json({ error: 'El turno ya está reservado para esta fecha' });
    }
    const cita = {
        nombre,
        telefono,
        fecha,
        hora,
        servicio,
        notas,
        fechaCreacion: new Date().toISOString()
    };
    const result = await citasCol.insertOne(cita);
    res.status(201).json({ message: 'Cita reservada', cita: { id: result.insertedId.toString(), ...cita } });
});

// Obtener turnos ocupados (público, MongoDB)
app.get('/api/turnos', mongoMiddleware, async (req, res) => {
    const { barberiaId, date } = req.query;
    if (!barberiaId || !date) {
        return res.status(400).json({ error: 'Faltan parámetros' });
    }
    const citasCol = getCitasCollection(barberiaId);
    const turnos = await citasCol.find({ fecha: date }).toArray();
    res.json({ turnos });
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

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const app = express();

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const CITAS_FILE = path.join(DATA_DIR, 'citas.json');
const ADMIN_USER = 'admin';
const ADMIN_PASSWORD = 'barber123';
const tokens = new Set();

app.use(express.json());
app.use(express.static('public'));

async function ensureDataFile() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
        await fs.access(CITAS_FILE);
    } catch (error) {
        await fs.writeFile(CITAS_FILE, '[]', 'utf8');
    }
}

async function readCitas() {
    await ensureDataFile();
    const data = await fs.readFile(CITAS_FILE, 'utf8');
    return JSON.parse(data || '[]');
}

async function writeCitas(citas) {
    await ensureDataFile();
    await fs.writeFile(CITAS_FILE, JSON.stringify(citas, null, 2), 'utf8');
}

function authMiddleware(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    const token = auth.slice(7);
    if (!tokens.has(token)) {
        return res.status(401).json({ error: 'Token inválido' });
    }

    next();
}

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
        const token = crypto.randomBytes(24).toString('hex');
        tokens.add(token);
        return res.json({ token });
    }

    res.status(401).json({ error: 'Credenciales incorrectas' });
});

app.post('/api/citas', async (req, res) => {
    const { nombre, email, telefono, fecha, hora, servicio, notas } = req.body;
    if (!nombre || !email || !telefono || !fecha || !hora || !servicio) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const cita = { nombre, email, telefono, fecha, hora, servicio, notas };
    const citas = await readCitas();
    citas.push(cita);
    await writeCitas(citas);

    res.status(201).json({ message: 'Cita reservada', cita });
});

app.get('/api/citas', authMiddleware, async (req, res) => {
    const citas = await readCitas();
    res.json({ citas });
});

app.put('/api/citas/:index', authMiddleware, async (req, res) => {
    const index = Number(req.params.index);
    const { nombre, email, telefono, fecha, hora, servicio, notas } = req.body;
    const citas = await readCitas();

    if (isNaN(index) || index < 0 || index >= citas.length) {
        return res.status(404).json({ error: 'Cita no encontrada' });
    }

    citas[index] = {
        ...citas[index],
        nombre,
        email,
        telefono,
        fecha,
        hora,
        servicio,
        notas,
    };

    await writeCitas(citas);
    res.json({ message: 'Cita actualizada', cita: citas[index] });
});

app.delete('/api/citas/:index', authMiddleware, async (req, res) => {
    const index = Number(req.params.index);
    const citas = await readCitas();

    if (isNaN(index) || index < 0 || index >= citas.length) {
        return res.status(404).json({ error: 'Cita no encontrada' });
    }

    const deleted = citas.splice(index, 1);
    await writeCitas(citas);
    res.json({ message: 'Cita cancelada', cita: deleted[0] });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

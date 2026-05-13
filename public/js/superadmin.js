const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const userInput = document.getElementById('superadmin-user');
const passwordInput = document.getElementById('superadmin-password');
const logoutBtn = document.getElementById('logout-btn');
const barberiasList = document.getElementById('barberias-list');
const nuevaBarberiaBtn = document.getElementById('nueva-barberia-btn');
const barberiaModal = document.getElementById('barberia-modal');
const barberiaForm = document.getElementById('barberia-form');
const modalTitulo = document.getElementById('modal-titulo');

const API_BASE = '/api';

function getToken() {
    return sessionStorage.getItem('superadminToken');
}

function setToken(token) {
    sessionStorage.setItem('superadminToken', token);
}

function clearToken() {
    sessionStorage.removeItem('superadminToken');
}

async function request(path, options = {}) {
    const headers = options.headers || {};
    headers['Content-Type'] = 'application/json';
    const token = getToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Error en la petición');
    }

    return response.json();
}

async function renderBarberias() {
    try {
        const data = await request('/superadmin/barberias');
        const barberias = data.barberias || [];
        barberiasList.innerHTML = '';

        if (barberias.length === 0) {
            barberiasList.innerHTML = '<p style="color: #aaa; text-align: center;">No hay barberías creadas</p>';
            return;
        }

        barberias.forEach(barberia => {
            const colorEmoji = { rosado: '💈', dorado: '✨', azul: '🔵', verde: '🟢',
                morado: '🟣', rojo: '🔴', naranja: '🟠', blanco: '⚪'
            };
            const card = document.createElement('div');
            card.className = 'barberia-card';
            let logoHtml = '';
            if (barberia.logoUrl) {
                logoHtml = `<img src="${barberia.logoUrl}" alt="Logo de ${barberia.nombre}">`;
            }
            const barberosHtml = (barberia.barberos || []).map(barbero => {
                const nombre = typeof barbero === 'string' ? barbero : barbero.nombre || '';
                const horario = typeof barbero === 'string' ? '' : barbero.horario || '';
                return `<div class="barbero-item"><strong>${nombre}</strong><span>${horario || 'Horario no definido'}</span></div>`;
            }).join('');
            card.innerHTML = `
                <div class="barberia-card-top">
                    ${logoHtml}
                    <h3>${colorEmoji[barberia.color] || '💈'} ${barberia.nombre}</h3>
                </div>
                <div class="barberia-info">
                    <p>Usuario: ${barberia.username}</p>
                    <p>Color: ${barberia.color || 'rosado'}</p>
                    <p>Estado: ${barberia.activa ? '✅ Activa' : '❌ Inactiva'}</p>
                    <p>Creada: ${new Date(barberia.fechaCreacion).toLocaleDateString()}</p>
                    <div class="barbero-list">
                        <h4>Barberos</h4>
                        ${barberosHtml || '<p style="color:#aaa;margin:0.25rem 0;">Sin barberos asignados</p>'}
                    </div>
                </div>
                <div class="barberia-actions">
                    <button class="btn btn-editar" data-id="${barberia.id}">Editar</button>
                    <button class="${barberia.activa ? 'btn btn-desactivar' : 'btn btn-activar'}" data-id="${barberia.id}" data-activa="${barberia.activa}">
                        ${barberia.activa ? 'Desactivar' : 'Activar'}
                    </button>
                    <button class="btn btn-eliminar" data-id="${barberia.id}">Eliminar</button>
                </div>
            `;
            barberiasList.appendChild(card);
        });
    } catch (error) {
        alert(error.message);
        logout();
    }
}

function showDashboard() {
    loginSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    renderBarberias();
}

function logout() {
    clearToken();
    loginSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
    loginForm.reset();
}

// --- Gestión de barberos en el formulario ---
let barberosTemp = [];

function renderBarberosList() {
    const barberosList = document.getElementById('barberos-list');
    barberosList.innerHTML = '';
    if (barberosTemp.length === 0) {
        barberosList.innerHTML = '<p style="color:#aaa;font-size:0.9rem;">Sin barberos agregados</p>';
        return;
    }
    barberosTemp.forEach((barbero, idx) => {
        const nombre = typeof barbero === 'string' ? barbero : barbero.nombre || '';
        const horario = typeof barbero === 'string' ? '' : barbero.horario || '';
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.gap = '0.5rem';
        div.style.marginBottom = '0.25rem';
        div.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:0.15rem;">
                <strong>${nombre}</strong>
                <small style="color:#aaa;">${horario || 'Horario no definido'}</small>
            </div>
            <button type="button" class="btn btn-eliminar-barbero" data-idx="${idx}" style="background:#e74c3c;padding:0 8px;">X</button>
        `;
        barberosList.appendChild(div);
    });
}

document.getElementById('agregar-barbero-btn').addEventListener('click', () => {
    const nombreInput = document.getElementById('nuevo-barbero');
    const horarioInput = document.getElementById('barbero-horario');
    const nombre = nombreInput.value.trim();
    const horario = horarioInput.value.trim();
    if (!nombre) {
        alert('Ingresa el nombre del barbero');
        return;
    }
    if (barberosTemp.some(b => (typeof b === 'string' ? b : b.nombre) === nombre)) {
        alert('Este barbero ya está agregado');
        return;
    }
    barberosTemp.push({ nombre, horario });
    nombreInput.value = '';
    horarioInput.value = '';
    renderBarberosList();
});

document.getElementById('barberos-list').addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-eliminar-barbero')) {
        const idx = parseInt(e.target.dataset.idx);
        barberosTemp.splice(idx, 1);
        renderBarberosList();
    }
});

function abrirModal(barberia = null) {
    if (barberia) {
        modalTitulo.textContent = 'Editar Barbería';
        document.getElementById('barberia-id').value = barberia.id;
        document.getElementById('barberia-nombre').value = barberia.nombre;
        document.getElementById('barberia-user').value = barberia.username;
        document.getElementById('barberia-password').value = '';
        document.getElementById('barberia-color').value = barberia.color || 'rosado';
        const rawBarberos = Array.isArray(barberia.barberos) ? barberia.barberos : [];
        barberosTemp = rawBarberos.map(b => typeof b === 'string' ? { nombre: b, horario: '' } : b);
    } else {
        modalTitulo.textContent = 'Nueva Barbería';
        barberiaForm.reset();
        document.getElementById('barberia-id').value = '';
        document.getElementById('barberia-color').value = 'rosado';
        barberosTemp = [];
    }
    renderBarberosList();
    barberiaModal.classList.add('active');
}

function cerrarModal() {
    barberiaModal.classList.remove('active');
    barberiaForm.reset();
    barberosTemp = [];
    renderBarberosList();
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = userInput.value.trim();
    const password = passwordInput.value.trim();

    try {
        const data = await request('/superadmin/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });

        setToken(data.token);
        showDashboard();
    } catch (error) {
        alert(error.message);
    }
});

logoutBtn.addEventListener('click', () => {
    logout();
});

nuevaBarberiaBtn.addEventListener('click', () => {
    abrirModal();
});

barberiaForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('barberia-id').value;
    const nombre = document.getElementById('barberia-nombre').value.trim();
    const username = document.getElementById('barberia-user').value.trim();
    const password = document.getElementById('barberia-password').value;
    const color = document.getElementById('barberia-color').value;
    const logoInput = document.getElementById('barberia-logo');
    const logoFile = logoInput.files[0];

    if (!nombre || !username) {
        alert('Por favor, completa los campos requeridos');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('nombre', nombre);
        formData.append('username', username);
        formData.append('color', color);
        if (logoFile) formData.append('logo', logoFile);
        formData.append('barberos', JSON.stringify(barberosTemp));
        if (id) {
            // Editar
            if (password) formData.append('password', password);
            await fetch(`${API_BASE}/superadmin/barberias/${id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                },
                body: formData
            });
        } else {
            // Crear
            if (!password) {
                alert('La contraseña es requerida para nuevas barberías');
                return;
            }
            formData.append('password', password);
            await fetch(`${API_BASE}/superadmin/barberias`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                },
                body: formData
            });
        }
        cerrarModal();
        renderBarberias();
    } catch (error) {
        alert(error.message);
    }
});

barberiasList.addEventListener('click', async (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    const id = button.dataset.id;

    if (button.classList.contains('btn-eliminar')) {
        if (!confirm('¿Estás seguro de eliminar esta barbería? Se perderán todas sus citas.')) return;
        try {
            await request(`/superadmin/barberias/${id}`, { method: 'DELETE' });
            renderBarberias();
        } catch (error) {
            alert(error.message);
        }
        return;
    }

    if (button.classList.contains('btn-activar') || button.classList.contains('btn-desactivar')) {
        const activa = button.classList.contains('btn-activar');
        try {
            await request(`/superadmin/barberias/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ activa }),
            });
            renderBarberias();
        } catch (error) {
            alert(error.message);
        }
        return;
    }

    if (button.classList.contains('btn-editar')) {
        try {
            const data = await request('/superadmin/barberias');
            const barberia = data.barberias.find(b => b.id === id);
            if (barberia) abrirModal(barberia);
        } catch (error) {
            alert(error.message);
        }
    }
});

// Cerrar modal al hacer click fuera
barberiaModal.addEventListener('click', (e) => {
    if (e.target === barberiaModal) {
        cerrarModal();
    }
});
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const barberiaSelect = document.getElementById('barberia-select');
const userInput = document.getElementById('admin-user');
const passwordInput = document.getElementById('admin-password');
const logoutBtn = document.getElementById('logout-btn');
const citasTableBody = document.querySelector('#citas-table tbody');
const noCitasMessage = document.getElementById('no-citas');
const adminTitulo = document.getElementById('admin-titulo');
const dashboardTitulo = document.getElementById('dashboard-titulo');

const API_BASE = '/api';

let currentBarberia = null;

function getToken() {
    return sessionStorage.getItem('adminToken');
}

function setToken(token) {
    sessionStorage.setItem('adminToken', token);
}

function clearToken() {
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('barberiaData');
}

async function loadBarberias() {
    try {
        const response = await fetch(`${API_BASE}/barberias`);
        const data = await response.json();
        
        barberiaSelect.innerHTML = '<option value="">Selecciona tu barbería</option>';
        
        data.barberias.forEach(b => {
            const option = document.createElement('option');
            option.value = b.id;
            option.textContent = b.nombre;
            barberiaSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar barberías:', error);
    }
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

async function renderCitas() {
    try {
        const data = await request('/citas');
        const citas = data.citas || [];
        citasTableBody.innerHTML = '';

        if (citas.length === 0) {
            noCitasMessage.classList.remove('hidden');
            return;
        }

        noCitasMessage.classList.add('hidden');

        citas.forEach((cita) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${cita.nombre}</td>
                <td>${cita.telefono}</td>
                <td>${cita.barbero ? cita.barbero.nombre || cita.barbero : '-'}</td>
                <td>${cita.servicio}</td>
                <td>${cita.fecha}</td>
                <td>${cita.hora}</td>
                <td>${cita.notas || '-'}</td>
                <td>
                    <div class="admin-actions">
                        <button class="edit-btn" data-id="${cita.id}">Editar</button>
                        <button class="reprogram-btn" data-id="${cita.id}">Reprogramar</button>
                        <button class="delete-btn" data-id="${cita.id}">Cancelar</button>
                    </div>
                </td>
            `;
            citasTableBody.appendChild(row);
        });
    } catch (error) {
        alert(error.message);
        logout();
    }
}

function showDashboard() {
    loginSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    
    if (currentBarberia) {
        adminTitulo.textContent = `Admin - ${currentBarberia.nombre}`;
        dashboardTitulo.textContent = `Reservas - ${currentBarberia.nombre}`;
    }
    
    renderCitas();
}

function logout() {
    clearToken();
    loginSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
    adminTitulo.textContent = 'Panel Admin';
    dashboardTitulo.textContent = 'Reservas actuales';
    loginForm.reset();
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const barberiaId = barberiaSelect.value;
    const username = userInput.value.trim();
    const password = passwordInput.value.trim();

    if (!barberiaId) {
        alert('Por favor, selecciona una barbería');
        return;
    }

    try {
        const data = await request('/barberia/login', {
            method: 'POST',
            body: JSON.stringify({ barberiaId, username, password }),
        });

        setToken(data.token);
        currentBarberia = data.barberia;
        sessionStorage.setItem('barberiaData', JSON.stringify(currentBarberia));
        showDashboard();
    } catch (error) {
        alert(error.message);
    }
});

logoutBtn.addEventListener('click', () => {
    logout();
});

citasTableBody.addEventListener('click', async (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    const citaId = button.dataset.id;
    
    if (button.classList.contains('delete-btn')) {
        if (!confirm('¿Estás seguro de cancelar esta cita?')) return;
        await request(`/citas/${citaId}`, { method: 'DELETE' });
        renderCitas();
        return;
    }

    if (button.classList.contains('reprogram-btn')) {
        const nuevaFecha = prompt('Nueva fecha (YYYY-MM-DD):');
        if (!nuevaFecha) return;
        const nuevaHora = prompt('Nueva hora (HH:MM):', '08:00');
        if (!nuevaHora) return;
        
        const data = await request('/citas');
        const cita = data.citas.find(c => c.id === citaId);
        if (!cita) {
            alert('Cita no encontrada');
            return;
        }
        
        await request(`/citas/${citaId}`, {
            method: 'PUT',
            body: JSON.stringify({ 
                nombre: cita.nombre,
                telefono: cita.telefono,
                fecha: nuevaFecha, 
                hora: nuevaHora,
                servicio: cita.servicio,
                notas: cita.notas,
                barbero: cita.barbero
            }),
        });
        renderCitas();
        return;
    }

    if (button.classList.contains('edit-btn')) {
        const data = await request('/citas');
        const cita = data.citas.find(c => c.id === citaId);
        if (!cita) {
            alert('Cita no encontrada');
            return;
        }
        
        const nombre = prompt('Nombre:', cita.nombre);
        if (!nombre) return;
        const telefono = prompt('Teléfono:', cita.telefono);
        if (!telefono) return;
        const servicio = prompt('Servicio:', cita.servicio);
        if (!servicio) return;
        const notas = prompt('Notas:', cita.notas || '');

        await request(`/citas/${citaId}`, {
            method: 'PUT',
            body: JSON.stringify({
                nombre,
                telefono,
                fecha: cita.fecha,
                hora: cita.hora,
                servicio,
                notas,
                barbero: cita.barbero
            }),
        });
        renderCitas();
    }
});

// Inicializar
loadBarberias();

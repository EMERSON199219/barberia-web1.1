const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const userInput = document.getElementById('admin-user');
const passwordInput = document.getElementById('admin-password');
const logoutBtn = document.getElementById('logout-btn');
const citasTableBody = document.querySelector('#citas-table tbody');
const noCitasMessage = document.getElementById('no-citas');

const API_BASE = '/api';

function getToken() {
    return sessionStorage.getItem('adminToken');
}

function setToken(token) {
    sessionStorage.setItem('adminToken', token);
}

function clearToken() {
    sessionStorage.removeItem('adminToken');
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

        citas.forEach((cita, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${cita.nombre}</td>
                <td>${cita.email}</td>
                <td>${cita.telefono}</td>
                <td>${cita.servicio}</td>
                <td>${cita.fecha}</td>
                <td>${cita.hora}</td>
                <td>${cita.notas || '-'}</td>
                <td>
                    <div class="admin-actions">
                        <button class="edit-btn" data-index="${index}">Editar</button>
                        <button class="reprogram-btn" data-index="${index}">Reprogramar</button>
                        <button class="delete-btn" data-index="${index}">Cancelar</button>
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
    renderCitas();
}

function logout() {
    clearToken();
    loginSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
    loginForm.reset();
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = userInput.value.trim();
    const password = passwordInput.value.trim();

    try {
        const data = await request('/login', {
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

citasTableBody.addEventListener('click', async (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    const index = Number(button.dataset.index);
    if (button.classList.contains('delete-btn')) {
        if (!confirm('¿Estás seguro de cancelar esta cita?')) return;
        await request(`/citas/${index}`, { method: 'DELETE' });
        renderCitas();
        return;
    }

    if (button.classList.contains('reprogram-btn')) {
        const nuevaFecha = prompt('Nueva fecha (YYYY-MM-DD):');
        if (!nuevaFecha) return;
        const nuevaHora = prompt('Nueva hora (HH:MM):', '08:00');
        if (!nuevaHora) return;
        await request(`/citas/${index}`, {
            method: 'PUT',
            body: JSON.stringify({ fecha: nuevaFecha, hora: nuevaHora }),
        });
        renderCitas();
        return;
    }

    if (button.classList.contains('edit-btn')) {
        const nombre = prompt('Nombre:');
        if (!nombre) return;
        const email = prompt('Email:');
        if (!email) return;
        const telefono = prompt('Teléfono:');
        if (!telefono) return;
        const servicio = prompt('Servicio:');
        if (!servicio) return;
        const notas = prompt('Notas:');

        await request(`/citas/${index}`, {
            method: 'PUT',
            body: JSON.stringify({ nombre, email, telefono, servicio, notas }),
        });
        renderCitas();
    }
});

window.addEventListener('DOMContentLoaded', () => {
    const token = getToken();
    if (token) {
        showDashboard();
    }
});

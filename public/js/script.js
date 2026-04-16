const formCita = document.querySelector('.form-cita');
const horaSelect = document.getElementById('hora-select');
const servicioSelect = document.getElementById('servicio-select');
const dateInput = document.querySelector('input[type="date"]');
const availabilityText = document.getElementById('availability-text');
const API_BASE = '/api';

function setAvailableTimes(bookedHours) {
    for (const option of horaSelect.options) {
        if (!option.value) continue;
        option.disabled = bookedHours.includes(option.value);
    }

    const totalSlots = 13;
    const availableSlots = totalSlots - bookedHours.length;
    let text = `Turnos disponibles: ${availableSlots} de ${totalSlots}`;

    if (availableSlots > 0 && availableSlots < totalSlots) {
        const allTimes = [
            '08:00', '09:00', '10:00', '11:00', '12:00',
            '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
        ];
        const availableTimes = allTimes.filter(time => !bookedHours.includes(time)).map(hora => {
            const [hour, minute] = hora.split(':');
            const hourNum = parseInt(hour);
            const ampm = hourNum >= 12 ? 'PM' : 'AM';
            const displayHour = hourNum > 12 ? hourNum - 12 : hourNum === 0 ? 12 : hourNum;
            return `${displayHour}:${minute} ${ampm}`;
        });
        text += `\nDisponibles: ${availableTimes.join(', ')}`;
    }

    availabilityText.textContent = text;
}

async function loadBookedHours(date) {
    if (!date) {
        setAvailableTimes([]);
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/turnos?date=${encodeURIComponent(date)}`);
        if (!response.ok) {
            throw new Error('No se pudieron cargar los turnos ocupados');
        }

        const data = await response.json();
        setAvailableTimes(data.horas || []);
    } catch (error) {
        console.warn(error.message);
        setAvailableTimes([]);
    }
}

dateInput.addEventListener('change', () => {
    loadBookedHours(dateInput.value);
});

formCita.addEventListener('submit', async function(e) {
    e.preventDefault();

    const nombre = this.querySelector('input[type="text"]').value.trim();
    const telefono = this.querySelector('input[type="tel"]').value.trim();
    const fecha = this.querySelector('input[type="date"]').value;
    const hora = this.querySelector('#hora-select').value;
    const servicio = servicioSelect.value;
    const notas = this.querySelector('textarea').value.trim();

    if (!nombre || !telefono || !fecha || !hora || !servicio) {
        alert('Por favor, completa todos los campos requeridos');
        return;
    }

    const cita = { nombre, telefono, fecha, hora, servicio, notas };

    try {
        const response = await fetch(`${API_BASE}/citas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(cita)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al reservar la cita');
        }

        const result = await response.json();
        alert(`¡Reserva con éxito!\n\nNombre: ${result.cita.nombre}\nFecha: ${result.cita.fecha}\nHora: ${result.cita.hora}`);
        this.reset();
        loadBookedHours(dateInput.value);
    } catch (error) {
        alert(error.message);
    }
});

async function migrateLocalStorageCitas() {
    const stored = localStorage.getItem('citas');
    if (!stored) return;

    const citas = JSON.parse(stored);
    if (!Array.isArray(citas) || citas.length === 0) return;

    for (const cita of citas) {
        await fetch(`${API_BASE}/citas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(cita)
        });
    }

    localStorage.removeItem('citas');
}

window.addEventListener('DOMContentLoaded', () => {
    loadBookedHours('');
    migrateLocalStorageCitas();
    availabilityText.textContent = 'Selecciona una fecha para ver turnos disponibles';
});

// Scroll suave para los enlaces de navegación
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

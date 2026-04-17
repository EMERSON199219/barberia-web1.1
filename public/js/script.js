const formCita = document.getElementById('formcita');
const horaSelect = document.getElementById('hora-select');
const servicioSelect = document.getElementById('servicio-select');
const dateInput = document.getElementById('fecha');
const availabilityText = document.getElementById('availability-text');
const barberiasList = document.getElementById('barberias-list');
const barberiaTitulo = document.getElementById('barberia-titulo');
const API_BASE = '/api';

let currentBarberiaId = null;
let barberiasData = [];

// Cargar barberías como íconos/botones
async function loadBarberias() {
    try {
        const response = await fetch(`${API_BASE}/barberias`);
        const data = await response.json();
        barberiasData = data.barberias;
        barberiasList.innerHTML = '';
        if (barberiasData.length === 0) {
            barberiasList.innerHTML = '<span style="color:#aaa">No hay barberías disponibles</span>';
            return;
        }
        // Íconos por color o nombre
        const icons = {
            dorado: '💛', azul: '💙', rosado: '💖', verde: '💚', morado: '💜', rojo: '❤️', naranja: '🧡', blanco: '🤍',
            default: '💈'
        };
        barberiasData.forEach(b => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'barberia-btn';
            btn.dataset.id = b.id;
            btn.innerHTML = `<span class="icon">${icons[b.color] || icons.default}</span><span>${b.nombre}</span>`;
            btn.addEventListener('click', () => selectBarberiaBtn(b.id));
            barberiasList.appendChild(btn);
        });
    } catch (error) {
        console.error('Error al cargar barberías:', error);
    }
}


// Selección de barbería por botón
async function selectBarberiaBtn(barberiaId) {
    currentBarberiaId = barberiaId;
    // Quitar selección previa
    document.querySelectorAll('.barberia-btn').forEach(btn => btn.classList.remove('selected'));
    // Marcar seleccionada
    const btn = document.querySelector(`.barberia-btn[data-id="${barberiaId}"]`);
    if (btn) btn.classList.add('selected');
    // Remover temas anteriores
    document.body.classList.remove('barberia-rosado', 'barberia-dorado', 'barberia-azul', 'barberia-verde', 'barberia-morado', 'barberia-rojo', 'barberia-naranja', 'barberia-blanco');
    // Obtener datos de la barbería para el color
    try {
        const response = await fetch(`${API_BASE}/barberias/${currentBarberiaId}`);
        const data = await response.json();
        if (data.barberia && data.barberia.color) {
            document.body.classList.add(`barberia-${data.barberia.color}`);
        }
        barberiaTitulo.textContent = `💈 ${data.barberia ? data.barberia.nombre : 'Barbería'}`;
    } catch (error) {
        barberiaTitulo.textContent = '💈 Barbería';
        console.warn('Error al obtener color de barbería:', error);
    }
    // Recargar turnos si hay fecha seleccionada
    if (dateInput.value) {
        loadBookedHours(dateInput.value);
    }
}

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
    if (!date || !currentBarberiaId) {
        setAvailableTimes([]);
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/turnos?barberiaId=${encodeURIComponent(currentBarberiaId)}&date=${encodeURIComponent(date)}`);
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

    if (!currentBarberiaId) {
        alert('Por favor, selecciona una barbería');
        return;
    }

    const nombre = document.getElementById('nombre').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const fecha = dateInput.value;
    const hora = horaSelect.value;
    const servicio = servicioSelect.value;
    const notas = document.getElementById('notas').value.trim();

    if (!nombre || !telefono || !fecha || !hora || !servicio) {
        alert('Por favor, completa todos los campos requeridos');
        return;
    }

    const cita = { barberiaId: currentBarberiaId, nombre, telefono, fecha, hora, servicio, notas };

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

// Inicializar
loadBarberias();
availabilityText.textContent = 'Selecciona una barbería y fecha para ver turnos disponibles';

const formCita = document.getElementById('formcita');
const horaSelect = document.getElementById('hora-select');
const servicioSelect = document.getElementById('servicio-select');
const dateInput = document.getElementById('fecha');
const barberoSelect = document.getElementById('barbero-select');
const availabilityText = document.getElementById('availability-text');
const barberiasList = document.getElementById('barberias-list');
const barberiaTitulo = document.getElementById('barberia-titulo');
const selectedBarberia = document.getElementById('selected-barberia');

const STATIC_BARBERIA = {
    id: 'full-barber',
    nombre: 'FULL BARBER',
    color: 'rosado',
    logoUrl: '/logos/logo-1777050721470-291941272.jpg',
    barberos: [
        { nombre: 'juan', horario: 'Horario no definido' },
        { nombre: 'pedro', horario: 'Horario no definido' }
    ]
};

let currentBarberiaId = STATIC_BARBERIA.id;
let barberiasData = [STATIC_BARBERIA];
let currentBarberos = STATIC_BARBERIA.barberos;

// Cargar una sola barbería estática
async function loadBarberias() {
    barberiasList.innerHTML = '';
    const icons = {
        dorado: '💛', azul: '💙', rosado: '💖', verde: '💚', morado: '💜', rojo: '❤️', naranja: '🧡', blanco: '🤍',
        default: '💈'
    };
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'barberia-btn selected';
    btn.dataset.id = STATIC_BARBERIA.id;
    btn.innerHTML = `<span class="icon">${icons[STATIC_BARBERIA.color] || icons.default}</span><span>${STATIC_BARBERIA.nombre}</span>`;
    btn.addEventListener('click', () => selectBarberiaBtn(STATIC_BARBERIA.id));
    barberiasList.appendChild(btn);
    selectBarberiaBtn(STATIC_BARBERIA.id);
}


// Selección de barbería por botón
async function selectBarberiaBtn(barberiaId) {
    currentBarberiaId = barberiaId;
    document.querySelectorAll('.barberia-btn').forEach(btn => btn.classList.remove('selected'));
    const btn = document.querySelector(`.barberia-btn[data-id="${barberiaId}"]`);
    if (btn) btn.classList.add('selected');
    document.body.classList.remove('barberia-rosado', 'barberia-dorado', 'barberia-azul', 'barberia-verde', 'barberia-morado', 'barberia-rojo', 'barberia-naranja', 'barberia-blanco');
    const barberia = barberiasData.find(b => b.id === barberiaId) || STATIC_BARBERIA;
    if (barberia.color) {
        document.body.classList.add(`barberia-${barberia.color}`);
    }
    renderSelectedBarberia(barberia);
    renderBarberoOptions(barberia.barberos || []);
    if (dateInput.value) {
        loadBookedHours(dateInput.value);
    }
}

function renderSelectedBarberia(barberia) {
    if (!barberia) {
        selectedBarberia.classList.add('hidden');
        selectedBarberia.innerHTML = '';
        return;
    }

    const logoHtml = barberia.logoUrl ? `<img src="${barberia.logoUrl}" alt="Logo de ${barberia.nombre}" class="selected-barberia-logo">` : '';
    const barberos = barberia.barberos || [];
    const barberoHtml = barberos.length > 0
        ? `${barberos.map(barbero => {
            const nombre = typeof barbero === 'string' ? barbero : barbero.nombre || '';
            const horario = typeof barbero === 'string' ? '' : barbero.horario || '';
            return `<div class="barbero-schedule-item"><span class="barbero-name">${nombre}</span><span class="barbero-horario">${horario || 'Horario no definido'}</span></div>`;
        }).join('')}`
        : '<p>No hay barberos registrados para esta barbería.</p>';

    selectedBarberia.classList.remove('hidden');
    selectedBarberia.innerHTML = `
        <div class="selected-barberia-card">
            ${logoHtml}
            <div>
                <strong>${barberia.nombre}</strong>
                <div class="barbero-schedule">${barberoHtml}</div>
            </div>
        </div>
    `;
}

function renderBarberoOptions(barberos) {
    barberoSelect.innerHTML = '<option value="">Selecciona un barbero</option>';
    if (!Array.isArray(barberos) || barberos.length === 0) {
        barberoSelect.disabled = true;
        return;
    }

    currentBarberos = barberos;
    barberoSelect.disabled = false;
    barberos.forEach((barbero, index) => {
        const nombre = typeof barbero === 'string' ? barbero : barbero.nombre || '';
        const horario = typeof barbero === 'string' ? '' : barbero.horario || '';
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${nombre}${horario ? ' — ' + horario : ''}`;
        barberoSelect.appendChild(option);
    });
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

function getStoredBookings() {
    try {
        return JSON.parse(localStorage.getItem('staticCitas') || '[]');
    } catch (error) {
        return [];
    }
}

function saveBooking(cita) {
    const bookings = getStoredBookings();
    bookings.push(cita);
    localStorage.setItem('staticCitas', JSON.stringify(bookings));
}

function loadBookedHours(date) {
    if (!date || !currentBarberiaId) {
        setAvailableTimes([]);
        return;
    }

    const selectedBarbero = barberoSelect.value ? currentBarberos[parseInt(barberoSelect.value, 10)] : null;
    if (!selectedBarbero) {
        setAvailableTimes([]);
        return;
    }

    const bookedHours = getStoredBookings()
        .filter(b => b.barberiaId === currentBarberiaId && b.fecha === date && (typeof b.barbero === 'string' ? b.barbero === selectedBarbero.nombre : b.barbero.nombre === selectedBarbero.nombre))
        .map(b => b.hora);

    setAvailableTimes(bookedHours);
}

dateInput.addEventListener('change', () => {
    loadBookedHours(dateInput.value);
});

barberoSelect.addEventListener('change', () => {
    if (dateInput.value) {
        loadBookedHours(dateInput.value);
    }
});

formCita.addEventListener('submit', function(e) {
    e.preventDefault();

    if (!currentBarberiaId) {
        alert('Por favor, selecciona una barbería');
        return;
    }

    const nombre = document.getElementById('nombre').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const fecha = dateInput.value;
    const barberoIndex = barberoSelect.value;
    const hora = horaSelect.value;
    const servicio = servicioSelect.value;
    const notas = document.getElementById('notas').value.trim();

    if (!nombre || !telefono || !fecha || !barberoIndex || !hora || !servicio) {
        alert('Por favor, completa todos los campos requeridos');
        return;
    }

    const selectedBarbero = currentBarberos[parseInt(barberoIndex, 10)];
    if (!selectedBarbero) {
        alert('Selecciona un barbero válido');
        return;
    }

    const cita = {
        barberiaId: currentBarberiaId,
        nombre,
        telefono,
        fecha,
        barbero: selectedBarbero,
        hora,
        servicio,
        notas
    };

    saveBooking(cita);
    alert(`¡Reserva guardada!\n\nNombre: ${cita.nombre}\nFecha: ${cita.fecha}\nHora: ${cita.hora}`);
    this.reset();
    loadBookedHours(fecha);
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
renderBarberoOptions([]);
loadBarberias();
availabilityText.textContent = 'Selecciona una barbería y fecha para ver turnos disponibles';

const formCita = document.querySelector('.form-cita');

formCita.addEventListener('submit', async function(e) {
    e.preventDefault();

    const nombre = this.querySelector('input[type="text"]').value.trim();
    const email = this.querySelector('input[type="email"]').value.trim();
    const telefono = this.querySelector('input[type="tel"]').value.trim();
    const fecha = this.querySelector('input[type="date"]').value;
    const hora = this.querySelector('#hora-select').value;
    const servicio = this.querySelectorAll('select')[1].value;
    const notas = this.querySelector('textarea').value.trim();

    if (!nombre || !email || !telefono || !fecha || !hora || !servicio) {
        alert('Por favor, completa todos los campos requeridos');
        return;
    }

    const cita = { nombre, email, telefono, fecha, hora, servicio, notas };

    try {
        const response = await fetch('/api/citas', {
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
        alert(`¡Cita reservada para ${result.cita.nombre}!\n\nFecha: ${result.cita.fecha}\nHora: ${result.cita.hora}\n\nTe esperamos en la barbería.`);
        this.reset();
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
        await fetch('/api/citas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(cita)
        });
    }

    localStorage.removeItem('citas');
}

window.addEventListener('DOMContentLoaded', migrateLocalStorageCitas);

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

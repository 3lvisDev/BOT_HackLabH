document.getElementById('year').textContent = new Intl.DateTimeFormat('es-CL', { year: 'numeric' }).format(new Date());

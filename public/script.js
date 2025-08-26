document.addEventListener('DOMContentLoaded', function() {
    // Initialize page
    initializePage();
    loadSchedule();
    updateCurrentTime();
    
    // Update time every minute
    setInterval(updateCurrentTime, 60000);
    
    // Form handlers
    document.getElementById('content-form').addEventListener('submit', handleAddContent);
    document.getElementById('edit-form').addEventListener('submit', handleEditContent);
    document.getElementById('refresh-btn').addEventListener('click', loadSchedule);
    document.getElementById('test-trigger').addEventListener('click', handleTestTrigger);
    document.getElementById('filter-day').addEventListener('change', loadSchedule);
    
    // Modal handlers
    document.querySelector('.close').addEventListener('click', closeModal);
    document.getElementById('cancel-edit').addEventListener('click', closeModal);
    
    // Type change handlers
    document.getElementById('tipo_midia').addEventListener('change', toggleFields);
    document.getElementById('edit-tipo_midia').addEventListener('change', toggleEditFields);
});

function initializePage() {
    // Populate day selectors
    const daySelects = ['#dia', '#edit-dia', '#filter-day', '#test-dia'];
    daySelects.forEach(selector => {
        const select = document.querySelector(selector);
        if (selector === '#filter-day') {
            select.innerHTML = '<option value="">Todos os dias</option>';
        } else {
            select.innerHTML = '<option value="">Selecione o dia</option>';
        }
        
        for (let i = 1; i <= 15; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `Dia ${i}`;
            select.appendChild(option);
        }
    });
}

async function updateCurrentTime() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        document.getElementById('current-day').textContent = `Dia: ${data.dia_atual}`;
        document.getElementById('current-time').textContent = `Hora: ${data.horario_atual}`;
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
    }
}

async function loadSchedule() {
    const container = document.getElementById('schedule-container');
    const filterDay = document.getElementById('filter-day').value;
    
    try {
        container.innerHTML = '<div class="loading">Carregando cronograma...</div>';
        
        const response = await fetch('/api/cronograma');
        const schedules = await response.json();
        
        let filteredSchedules = schedules;
        if (filterDay) {
            filteredSchedules = schedules.filter(s => s.dia == filterDay);
        }
        
        if (filteredSchedules.length === 0) {
            container.innerHTML = '<div class="loading">Nenhum conteúdo agendado encontrado.</div>';
            return;
        }
        
        const html = filteredSchedules.map(schedule => {
            const typeLabels = {
                'img': 'Imagem',
                'vid': 'Vídeo', 
                'texto': 'Texto',
                'img_text': 'Imagem + Texto',
                'vid_text': 'Vídeo + Texto'
            };
            
            return `
                <div class="schedule-item">
                    <div class="schedule-header">
                        <div class="schedule-info">
                            <span class="day-badge">Dia ${schedule.dia}</span>
                            <span class="time-badge">${schedule.horario}</span>
                            <span class="type-badge">${typeLabels[schedule.tipo_midia] || schedule.tipo_midia}</span>
                        </div>
                        <div class="schedule-actions">
                            <button class="btn-edit" onclick="editSchedule(${schedule.id})">Editar</button>
                            <button class="btn-danger" onclick="deleteSchedule(${schedule.id})">Excluir</button>
                        </div>
                    </div>
                    <div class="schedule-content">
                        ${schedule.url_midia ? `<div class="url-content"><strong>URL:</strong> ${schedule.url_midia}</div>` : ''}
                        ${schedule.texto ? `<div class="text-content"><strong>Texto:</strong> ${schedule.texto}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Erro ao carregar cronograma:', error);
        container.innerHTML = '<div class="loading">Erro ao carregar cronograma.</div>';
    }
}

async function handleAddContent(e) {
    e.preventDefault();
    
    const formData = {
        dia: document.getElementById('dia').value,
        horario: document.getElementById('horario').value,
        tipo_midia: document.getElementById('tipo_midia').value,
        url_midia: document.getElementById('url_midia').value,
        texto: document.getElementById('texto').value
    };
    
    try {
        const response = await fetch('/api/cronograma', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert('Conteúdo adicionado com sucesso!', 'success');
            document.getElementById('content-form').reset();
            toggleFields(); // Reset field visibility
            loadSchedule();
        } else {
            showAlert(result.error || 'Erro ao adicionar conteúdo', 'error');
        }
    } catch (error) {
        console.error('Erro ao adicionar conteúdo:', error);
        showAlert('Erro ao adicionar conteúdo', 'error');
    }
}

async function editSchedule(id) {
    try {
        const response = await fetch('/api/cronograma');
        const schedules = await response.json();
        const schedule = schedules.find(s => s.id === id);
        
        if (!schedule) {
            showAlert('Conteúdo não encontrado', 'error');
            return;
        }
        
        // Populate edit form
        document.getElementById('edit-id').value = schedule.id;
        document.getElementById('edit-dia').value = schedule.dia;
        document.getElementById('edit-horario').value = schedule.horario;
        document.getElementById('edit-tipo_midia').value = schedule.tipo_midia;
        document.getElementById('edit-url_midia').value = schedule.url_midia || '';
        document.getElementById('edit-texto').value = schedule.texto || '';
        
        // Show/hide appropriate fields
        toggleEditFields();
        
        // Show modal
        document.getElementById('modal').style.display = 'block';
        
    } catch (error) {
        console.error('Erro ao carregar dados para edição:', error);
        showAlert('Erro ao carregar dados para edição', 'error');
    }
}

async function handleEditContent(e) {
    e.preventDefault();
    
    const id = document.getElementById('edit-id').value;
    const formData = {
        dia: document.getElementById('edit-dia').value,
        horario: document.getElementById('edit-horario').value,
        tipo_midia: document.getElementById('edit-tipo_midia').value,
        url_midia: document.getElementById('edit-url_midia').value,
        texto: document.getElementById('edit-texto').value
    };
    
    try {
        const response = await fetch(`/api/cronograma/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert('Conteúdo atualizado com sucesso!', 'success');
            closeModal();
            loadSchedule();
        } else {
            showAlert(result.error || 'Erro ao atualizar conteúdo', 'error');
        }
    } catch (error) {
        console.error('Erro ao atualizar conteúdo:', error);
        showAlert('Erro ao atualizar conteúdo', 'error');
    }
}

async function deleteSchedule(id) {
    if (!confirm('Tem certeza que deseja excluir este conteúdo?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/cronograma/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert('Conteúdo removido com sucesso!', 'success');
            loadSchedule();
        } else {
            showAlert(result.error || 'Erro ao remover conteúdo', 'error');
        }
    } catch (error) {
        console.error('Erro ao remover conteúdo:', error);
        showAlert('Erro ao remover conteúdo', 'error');
    }
}

async function handleTestTrigger() {
    const dia = document.getElementById('test-dia').value;
    const horario = document.getElementById('test-horario').value;
    
    if (!dia || !horario) {
        showAlert('Selecione o dia e horário para o teste', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/trigger-test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ dia, horario })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message, 'success');
        } else {
            showAlert(result.error || 'Erro ao executar teste', 'error');
        }
    } catch (error) {
        console.error('Erro ao executar teste:', error);
        showAlert('Erro ao executar teste', 'error');
    }
}

function toggleFields() {
    const tipoMidia = document.getElementById('tipo_midia').value;
    const urlGroup = document.getElementById('url-group');
    const textGroup = document.getElementById('text-group');
    
    // Reset visibility
    urlGroup.style.display = 'block';
    textGroup.style.display = 'block';
    
    if (tipoMidia === 'texto') {
        urlGroup.style.display = 'none';
    } else if (tipoMidia === 'img' || tipoMidia === 'vid') {
        textGroup.style.display = 'none';
    }
    
    // Update required attributes
    const urlInput = document.getElementById('url_midia');
    const textInput = document.getElementById('texto');
    
    urlInput.required = (tipoMidia !== 'texto');
    textInput.required = (tipoMidia === 'texto' || tipoMidia === 'img_text' || tipoMidia === 'vid_text');
}

function toggleEditFields() {
    const tipoMidia = document.getElementById('edit-tipo_midia').value;
    const urlGroup = document.getElementById('edit-url-group');
    const textGroup = document.getElementById('edit-text-group');
    
    // Reset visibility
    urlGroup.style.display = 'block';
    textGroup.style.display = 'block';
    
    if (tipoMidia === 'texto') {
        urlGroup.style.display = 'none';
    } else if (tipoMidia === 'img' || tipoMidia === 'vid') {
        textGroup.style.display = 'none';
    }
    
    // Update required attributes
    const urlInput = document.getElementById('edit-url_midia');
    const textInput = document.getElementById('edit-texto');
    
    urlInput.required = (tipoMidia !== 'texto');
    textInput.required = (tipoMidia === 'texto' || tipoMidia === 'img_text' || tipoMidia === 'vid_text');
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

function showAlert(message, type) {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());
    
    // Create new alert
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    // Insert at the top of main content
    const main = document.querySelector('main');
    main.insertBefore(alert, main.firstChild);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('modal');
    if (event.target === modal) {
        closeModal();
    }
}

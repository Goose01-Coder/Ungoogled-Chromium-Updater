// Загрузка сохраненных настроек
document.addEventListener('DOMContentLoaded', loadSettings);

// Обработка выбора своего периода
document.querySelectorAll('input[name="updatePeriod"]').forEach(radio => {
    radio.addEventListener('change', function() {
        const customContainer = document.getElementById('customPeriodContainer');
        if (this.value === 'custom') {
            customContainer.classList.add('show');
        } else {
            customContainer.classList.remove('show');
        }
    });
});

// Сохранение настроек
document.getElementById('saveSettings').addEventListener('click', saveSettings);

function loadSettings() {
    chrome.storage.local.get([
        'currentVersion',
        'architecture', 
        'updatePeriod'
    ], (data) => {
        // Заполняем поля
        if (data.currentVersion) {
            document.getElementById('currentVersion').value = data.currentVersion;
        }
        if (data.architecture) {
            document.getElementById('architecture').value = data.architecture;
        }
        
        // Устанавливаем период обновлений
        if (data.updatePeriod) {
            if (data.updatePeriod === 'never') {
                document.getElementById('periodNever').checked = true;
            } else if (['1', '7', '30'].includes(data.updatePeriod)) {
                document.getElementById(`period${data.updatePeriod}d`).checked = true;
            } else {
                document.getElementById('periodCustom').checked = true;
                document.getElementById('customPeriod').value = data.updatePeriod;
                document.getElementById('customPeriodContainer').classList.add('show');
            }
        } else {
            // Значение по умолчанию
            document.getElementById('period7d').checked = true;
        }
    });
}

function saveSettings() {
    const currentVersion = document.getElementById('currentVersion').value.trim();
    const architecture = document.getElementById('architecture').value;
    const periodRadio = document.querySelector('input[name="updatePeriod"]:checked');
    
    let updatePeriod;
    if (periodRadio.value === 'custom') {
        const customDays = parseInt(document.getElementById('customPeriod').value);
        if (customDays >= 1 && customDays <= 365) {
            updatePeriod = customDays.toString();
        } else {
            showStatus('Укажите период от 1 до 365 дней', 'error');
            return;
        }
    } else {
        updatePeriod = periodRadio.value;
    }
    
    if (!currentVersion) {
        showStatus('Введите текущую версию', 'error');
        return;
    }
    
    // Сохраняем настройки
    chrome.storage.local.set({
        currentVersion: currentVersion,
        architecture: architecture,
        updatePeriod: updatePeriod
    }, () => {
        showStatus('Настройки сохранены успешно!', 'success');
        
        // Перезапускаем алерт с новыми настройками
        updateAlarm(updatePeriod);
        
        // Закрываем окно через 2 секунды
        setTimeout(() => {
            window.close();
        }, 2000);
    });
}

function updateAlarm(period) {
    // Удаляем старый алерт
    chrome.alarms.clear('checkUpdate');
    
    // Создаем новый, если не "never"
    if (period !== 'never') {
        const periodInMinutes = parseInt(period) * 1440; // дни в минуты
        chrome.alarms.create('checkUpdate', { periodInMinutes: periodInMinutes });
        console.log(`Автопроверка настроена на ${period} дней`);
    }
}

function showStatus(message, type) {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
    statusElement.className = 'status ' + type;
    
    // Автоочистка статуса через 5 секунд
    setTimeout(() => {
        statusElement.textContent = '';
        statusElement.className = 'status';
    }, 5000);
}
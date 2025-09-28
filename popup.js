// Загрузка данных при открытии
document.addEventListener('DOMContentLoaded', loadPopupData);

// Проверка обновлений
document.getElementById('checkUpdate').addEventListener('click', () => {
    document.getElementById('status').textContent = 'Проверка...';
    document.getElementById('status').style.color = 'blue';
    
    chrome.runtime.sendMessage({ action: 'checkUpdate' }, (response) => {
        if (chrome.runtime.lastError) {
            console.error("Ошибка:", chrome.runtime.lastError);
            document.getElementById('status').textContent = 'Ошибка отправки';
            document.getElementById('status').style.color = 'red';
            return;
        }
        
        setTimeout(() => {
            loadPopupData();
            document.getElementById('status').textContent = 'Проверка завершена';
            document.getElementById('status').style.color = 'green';
        }, 3000);
    });
});

// Открытие настроек
document.getElementById('openSettings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});

function loadPopupData() {
    chrome.storage.local.get([
        'currentVersion',
        'latestVersion', 
        'architecture',
        'lastChecked',
        'error'
    ], (data) => {
        document.getElementById('currentVersion').textContent = data.currentVersion || 'Не указана';
        document.getElementById('latestVersion').textContent = data.latestVersion || '—';
        document.getElementById('architecture').textContent = data.architecture || '—';
        document.getElementById('lastChecked').textContent = data.lastChecked || '—';
        
        updateVersionStatus(data.currentVersion, data.latestVersion);
        
        if (data.error) {
            document.getElementById('errorInfo').textContent = data.error;
            document.getElementById('errorInfo').style.display = 'block';
        } else {
            document.getElementById('errorInfo').style.display = 'none';
        }
    });
}

function updateVersionStatus(current, latest) {
    const statusElement = document.getElementById('versionStatus');
    
    if (!current || !latest || latest === '—') {
        statusElement.textContent = '';
        statusElement.className = 'status-badge';
        return;
    }
    
    // Используем ту же функцию сравнения, что и в background.js
    const cmp = compareVersions(current, latest);
    
    if (cmp < 0) {
        statusElement.textContent = 'NEW';
        statusElement.className = 'status-badge status-new';
    } else {
        statusElement.textContent = 'OK';
        statusElement.className = 'status-badge status-updated';
    }
}

// Функция сравнения версий (такая же как в background.js)
function normalizeVersion(v) {
    if (!v) return [0, 0, 0, 0, 0];
    
    const cleanVersion = v.replace(/[^\d.-]/g, '');
    const parts = cleanVersion.split(/[.-]/).map(Number);
    
    while (parts.length < 5) parts.push(0);
    return parts.slice(0, 5);
}

function compareVersions(a, b) {
    const A = normalizeVersion(a), B = normalizeVersion(b);
    for (let i = 0; i < 5; i++) {
        if (A[i] < B[i]) return -1;
        if (A[i] > B[i]) return 1;
    }
    return 0;
}

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        if (changes.latestVersion || changes.currentVersion) {
            loadPopupData();
        }
    }
});
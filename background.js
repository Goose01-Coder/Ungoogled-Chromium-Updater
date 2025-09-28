// URL для каждой архитектуры
const ARCH_URLS = {
    'x64': 'https://ungoogled-software.github.io/ungoogled-chromium-binaries/releases/windows/64bit/',
    'x86': 'https://ungoogled-software.github.io/ungoogled-chromium-binaries/releases/windows/32bit/', 
    'arm': 'https://ungoogled-software.github.io/ungoogled-chromium-binaries/releases/windows/arm64/'
};

// Основная функция получения последней версии
async function getLatestVersion(architecture = 'x64') {
    try {
        console.log("Начало проверки для архитектуры:", architecture);
        
        const archUrl = ARCH_URLS[architecture];
        console.log("Проверяем URL:", archUrl);
        
        const response = await fetch(archUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const html = await response.text();
        
        // Ищем все упоминания версий в тексте
        const versions = extractAllVersionsFromText(html);
        console.log("Найдено версий на странице:", versions.length);
        
        if (versions.length === 0) {
            return null;
        }
        
        // Фильтруем только валидные современные версии
        const validVersions = versions.filter(v => isValidVersion(v));
        console.log("Валидные современные версии:", validVersions);
        
        if (validVersions.length === 0) {
            console.log("Современные версии не найдены, используем самую новую из доступных");
            validVersions.push(...versions.sort((a, b) => compareVersions(b, a)).slice(0, 1));
        }
        
        // Сортируем от новой к старой и берем самую новую
        validVersions.sort((a, b) => compareVersions(b, a));
        const latestVersion = validVersions[0];
        
        console.log("Самая новая версия:", latestVersion);
        
        return {
            version: latestVersion,
            pageUrl: archUrl, // Ссылка на страницу загрузок
            architecture: architecture
        };
        
    } catch (error) {
        console.error("Ошибка в getLatestVersion:", error);
        return null;
    }
}

// Извлекаем ВСЕ версии из текста
function extractAllVersionsFromText(text) {
    if (!text) return [];
    
    const versionPattern = /\b\d{2,4}\.\d+\.\d+\.\d+(?:-\d+(?:\.\d+)?)?\b/g;
    const matches = text.match(versionPattern) || [];
    
    const uniqueVersions = [...new Set(matches)];
    console.log("Все найденные версии:", uniqueVersions);
    return uniqueVersions;
}

// Проверяем, что версия современная (не старая)
function isValidVersion(version) {
    if (!version) return false;
    
    const parts = version.split('.');
    if (parts.length < 1) return false;
    
    const majorVersion = parseInt(parts[0]);
    return majorVersion >= 100;
}

// Сравнение версий
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

// Проверка обновлений
async function checkUpdate() {
    try {
        const data = await new Promise((resolve) => {
            chrome.storage.local.get(["currentVersion", "architecture"], resolve);
        });
        
        const currentVersion = data.currentVersion || "0.0.0.0";
        const architecture = data.architecture || "x64";
        
        console.log("Проверка обновлений");
        console.log("Текущая версия:", currentVersion);
        console.log("Архитектура:", architecture);
        
        const latestInfo = await getLatestVersion(architecture);
        
        if (!latestInfo) {
            console.error("Не удалось получить информацию о версии");
            chrome.action.setBadgeText({ text: "!" });
            chrome.action.setBadgeBackgroundColor({ color: "#FFA500" });
            
            await new Promise((resolve) => {
                chrome.storage.local.set({ 
                    latestVersion: "Ошибка получения",
                    lastChecked: new Date().toLocaleString(),
                    error: "Не удалось получить данные с сервера"
                }, resolve);
            });
            return;
        }
        
        const latestVersion = latestInfo.version;
        
        console.log("Последняя версия найдена:", latestVersion);
        console.log("Страница загрузок:", latestInfo.pageUrl);
        
        await new Promise((resolve) => {
            chrome.storage.local.set({
                latestVersion: latestVersion,
                pageUrl: latestInfo.pageUrl,
                lastChecked: new Date().toLocaleString(),
                error: null
            }, resolve);
        });
        
        const cmp = compareVersions(currentVersion, latestVersion);
        console.log("Сравнение версий:", cmp);
        
        if (cmp < 0) {
            console.log("Доступно обновление!");
            chrome.action.setBadgeText({ text: "NEW" });
            chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
            
            // Создаем уведомление
            const notificationId = 'ungoogled-chromium-update';
            
            chrome.notifications.create(notificationId, {
                type: 'basic',
                iconUrl: 'icon.png',
                title: 'Доступна новая версия Ungoogled Chromium',
                message: `Ваша версия: ${currentVersion}\nПоследняя: ${latestVersion}\nНажмите для открытия страницы загрузок`,
                requireInteraction: true
            });
            
            // Обработчик клика по уведомлению
            chrome.notifications.onClicked.addListener(function(clickedNotificationId) {
                if (clickedNotificationId === notificationId) {
                    chrome.tabs.create({ url: latestInfo.pageUrl });
                    chrome.notifications.clear(clickedNotificationId);
                }
            });
            
        } else {
            console.log("Обновлений нет");
            chrome.action.setBadgeText({ text: "✓" });
            chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
        }
        
        console.log("Проверка завершена");
        
    } catch (error) {
        console.error("Критическая ошибка в checkUpdate:", error);
        chrome.action.setBadgeText({ text: "!" });
        chrome.action.setBadgeBackgroundColor({ color: "#FFA500" });
    }
}

// Функция настройки алерта
function setupAlarm() {
    chrome.storage.local.get(['updatePeriod'], (data) => {
        const period = data.updatePeriod || '7';
        
        chrome.alarms.clear('checkUpdate');
        
        if (period !== 'never') {
            const periodInMinutes = parseInt(period) * 1440;
            chrome.alarms.create('checkUpdate', { periodInMinutes: periodInMinutes });
            console.log(`Автопроверка настроена на ${period} дней`);
        }
    });
}

// Обработчики событий
chrome.runtime.onInstalled.addListener(() => {
    console.log("Расширение установлено/обновлено");
    setupAlarm();
    setTimeout(checkUpdate, 1000);
});

chrome.runtime.onStartup.addListener(() => {
    console.log("Браузер запущен");
    setupAlarm();
    setTimeout(checkUpdate, 2000);
});

chrome.alarms.onAlarm.addListener(() => {
    console.log("Сработал алерт проверки");
    checkUpdate();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.action === "checkUpdate") {
        console.log("Ручная проверка запрошена из popup");
        checkUpdate().then(() => sendResponse({ ok: true }));
        return true;
    }
});
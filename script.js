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

// Логирование IP
function logIP() {
    fetch('https://api.ipify.org?format=json')
        .then(response => response.json())
        .then(data => {
            const ip = data.ip;
            const timestamp = new Date().toISOString();
            database.ref('ip_logs').push({ 
                ip, 
                timestamp,
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                screen: `${window.screen.width}x${window.screen.height}`,
                language: navigator.language
            });
        })
        .catch(error => console.error('Ошибка получения IP:', error));
}

// Логируем IP при загрузке страницы
logIP();

class PeopleList {
    constructor() {
        this.people = [];
        this.shoppingList = [];
        this.initFirebaseListeners();
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

const trapHata = new PeopleList();
let currentTab = 'members';
let editingPersonId = null;
let currentStatusFilter = null;

// DOM элементы
const peopleListEl = document.getElementById('people-list');
const searchResultsEl = document.getElementById('search-results');
const shoppingListEl = document.getElementById('shopping-list');
const statsGridEl = document.getElementById('stats-grid');
const filteredPeopleListEl = document.getElementById('filtered-people-list');
const statusFilterTitleEl = document.getElementById('status-filter-title');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

function getStatusText(status) {
    const statusTexts = {
        active: 'Активен',
        banned: 'Забанен',
        legend: 'Легенда',
        unknown: 'ХЗ'
    };
    return statusTexts[status] || status;
}

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

// Обработчики событий
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

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('new-item').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('add-item-btn').click();
        }
    });
    
    // Первоначальная загрузка
    renderStats();
});

// Глобальные функции
window.trapHata = trapHata;
window.filterByStatus = filterByStatus;

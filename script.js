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

class PeopleList {
    constructor() {
        this.people = [];
        this.shoppingList = [];
        this.initFirebaseListeners();
    }

    // Инициализация слушателей Firebase
    initFirebaseListeners() {
        // Слушатель для участников
        database.ref('people').on('value', (snapshot) => {
            this.people = snapshot.val() || [];
            renderPeopleList(this.people);
        });

        // Слушатель для списка покупок
        database.ref('shopping').on('value', (snapshot) => {
            this.shoppingList = snapshot.val() || [];
            renderShoppingList();
        });
    }

    // 🔄 Методы для работы с участниками
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

    // 🛒 Методы для списка покупок
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

    // 📊 Вспомогательные методы
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

    getDuplicates() {
        const nameCounts = {};
        this.people.forEach(person => {
            nameCounts[person.name] = (nameCounts[person.name] || 0) + 1;
        });
        return Object.entries(nameCounts).filter(([_, count]) => count > 1).map(([name]) => name);
    }

    search(query) {
        return this.people.filter(person => 
            person.name.toLowerCase().includes(query.toLowerCase()) ||
            (person.note && person.note.toLowerCase().includes(query.toLowerCase()))
        );
    }
}

// Инициализация приложения
const trapHata = new PeopleList();
let currentTab = 'members';

// DOM элементы
const peopleListEl = document.getElementById('people-list');
const searchResultsEl = document.getElementById('search-results');
const shoppingListEl = document.getElementById('shopping-list');
const statsGridEl = document.getElementById('stats-grid');
const duplicatesListEl = document.getElementById('duplicates-list');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// Функции рендеринга
function renderPeopleList(people) {
    if (people.length === 0) {
        peopleListEl.innerHTML = `
            <div class="empty-state">Нет участников</div>
            <div class="add-card" onclick="focusNewPersonInput()"></div>
        `;
        return;
    }

    let html = '';
    people.forEach(person => {
        const statusClass = `status-${person.status}`;
        const cardClass = `${person.status}`;
        html += `
        <div class="person-card ${cardClass}">
            <div class="person-name">
                ${person.name}
                <span class="person-status ${statusClass}">${getStatusText(person.status)}</span>
            </div>
            <div class="person-id">ID: ${person.id}</div>
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
    
    // Добавляем кнопку добавления нового участника
    html += `<div class="add-card" onclick="focusNewPersonInput()"></div>`;
    peopleListEl.innerHTML = html;
}

function focusNewPersonInput() {
    document.getElementById('new-name').focus();
}

function getStatusText(status) {
    const statusTexts = {
        active: 'Активен',
        banned: 'Забанен',
        legend: 'Легенда',
        unknown: 'ХЗ'
    };
    return statusTexts[status] || status;
}

function renderSearchResults(results) {
    if (results.length === 0) {
        searchResultsEl.innerHTML = '<div class="empty-state">Ничего не найдено</div>';
        return;
    }

    let html = '<h3>Результаты поиска:</h3><div class="people-list">';
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

function renderShoppingList() {
    const items = trapHata.shoppingList;
    if (items.length === 0) {
        shoppingListEl.innerHTML = '<div class="empty-state">Список покупок пуст</div>';
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

function renderStats() {
    const stats = trapHata.getStats();
    statsGridEl.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${stats.total}</div>
            <div class="stat-label">Всего</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.active}</div>
            <div class="stat-label">Активные</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.banned}</div>
            <div class="stat-label">Забанены</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.legends}</div>
            <div class="stat-label">Легенды</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.unknown}</div>
            <div class="stat-label">ХЗ</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.recent}</div>
            <div class="stat-label">Новые</div>
        </div>
    `;
}

function renderDuplicates() {
    const duplicates = trapHata.getDuplicates();
    if (duplicates.length === 0) {
        duplicatesListEl.innerHTML = '<div class="empty-state">Нет повторяющихся имен</div>';
        return;
    }

    let html = '';
    duplicates.forEach(name => {
        html += `<div class="duplicate-item">${name}</div>`;
    });
    duplicatesListEl.innerHTML = html;
}

// 🎯 Обработчики событий
document.getElementById('add-person-btn').addEventListener('click', async function() {
    const name = document.getElementById('new-name').value.trim();
    const note = document.getElementById('new-note').value.trim();
    const status = document.getElementById('new-status').value;

    if (name) {
        await trapHata.addPerson(name, note, status);
        document.getElementById('new-name').value = '';
        document.getElementById('new-note').value = '';
    } else {
        alert('Введите имя участника!');
    }
});

document.getElementById('update-person-btn').addEventListener('click', async function() {
    const id = parseInt(document.getElementById('edit-id').value);
    const note = document.getElementById('edit-note').value.trim();
    const status = document.getElementById('edit-status').value;

    if (id) {
        const updates = {};
        if (note) updates.note = note;
        if (status) updates.status = status;
        
        await trapHata.updatePerson(id, updates);
        document.getElementById('edit-id').value = '';
        document.getElementById('edit-note').value = '';
    } else {
        alert('Введите ID участника!');
    }
});

document.getElementById('remove-person-btn').addEventListener('click', async function() {
    const id = parseInt(document.getElementById('edit-id').value);
    if (id) {
        if (confirm('Вы уверены, что хотите удалить этого участника?')) {
            await trapHata.removeById(id);
            document.getElementById('edit-id').value = '';
        }
    } else {
        alert('Введите ID участника!');
    }
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
    // Добавляем возможность добавлять покупку по нажатию Enter
    document.getElementById('new-item').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('add-item-btn').click();
        }
    });
    
    // Добавляем возможность добавлять участника по нажатию Enter
    document.getElementById('new-name').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('add-person-btn').click();
        }
    });
});

// Глобальные функции для использования в HTML
window.trapHata = trapHata;
window.focusNewPersonInput = focusNewPersonInput;
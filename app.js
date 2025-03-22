import { ADMIN_PASSWORD } from './config.js';

let users = JSON.parse(localStorage.getItem('runtracker_users')) || [];
let currentUser = null;
let isRunning = false;
let startTime, timerInterval, distanceInterval;
let selectedGoal = 0;
let selectedIntensity = '--';

function navigateTo(page) {
    window.location.href = page;
}

// Registro de usuário
if (document.getElementById('registrationForm')) {
    document.getElementById('registrationForm').addEventListener('submit', (e) => {
        e.preventDefault();

        const user = {
            id: Date.now(),
            name: document.getElementById('name').value,
            height: parseInt(document.getElementById('height').value),
            weight: parseInt(document.getElementById('weight').value),
            activities: []
        };

        if (users.some(u => u.name === user.name)) {
            alert('Usuário já cadastrado!');
            return;
        }

        users.push(user);
        localStorage.setItem('runtracker_users', JSON.stringify(users));
        currentUser = user;
        navigateTo('tela_corrida.html');
    });
}

// Corrida
if (document.getElementById('startStopBtn')) {
    const btn = document.getElementById('startStopBtn');
    const timer = document.getElementById('timer');
    const distance = document.getElementById('distance');
    const pace = document.getElementById('pace');

    const goalSelect = document.getElementById('goalDistance');
    const intensityButtons = document.querySelectorAll('.intensity-btn');

    currentUser = users[users.length - 1];
    document.getElementById('currentUser').textContent = currentUser.name;

    intensityButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedIntensity = btn.dataset.value;
        });
    });

    btn.addEventListener('click', () => {
        if (!isRunning) {
            selectedGoal = parseFloat(goalSelect.value);
            startTracking();
        } else {
            stopTracking();
        }
    });

    function startTracking() {
        isRunning = true;
        btn.textContent = '⏹ Parar Corrida';
        startTime = Date.now();

        let km = 0;
        timerInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            timer.textContent = new Date(elapsed).toISOString().substr(11, 8);
        }, 1000);

        distanceInterval = setInterval(() => {
            km += 0.01;
            distance.textContent = km.toFixed(2);
            const minutes = (Date.now() - startTime) / 1000 / 60;
            const paceValue = minutes / km;
            pace.textContent = isFinite(paceValue) ? paceValue.toFixed(2) + ' min/km' : '--';

            if (selectedGoal > 0 && km >= selectedGoal) {
                clearInterval(timerInterval);
                clearInterval(distanceInterval);
                speak('Parabéns! Você alcançou sua meta. Deseja continuar mais um pouco?');
                setTimeout(() => {
                    if (confirm('Deseja continuar a corrida por mais 500 metros?')) {
                        selectedGoal += 0.5;
                        startTime = Date.now();
                        startTracking();
                    } else {
                        stopTracking();
                        speak('Excelente esforço! Agora descanse e hidrate-se.');
                    }
                }, 1000);
            }
        }, 3000);
    }

    function stopTracking() {
        isRunning = false;
        btn.textContent = '▶ Iniciar Corrida';
        clearInterval(timerInterval);
        clearInterval(distanceInterval);

        const activity = {
            date: new Date().toLocaleString(),
            duration: document.getElementById('timer').textContent,
            distance: document.getElementById('distance').textContent,
            pace: document.getElementById('pace').textContent,
            intensity: selectedIntensity
        };

        currentUser.activities.push(activity);
        localStorage.setItem('runtracker_users', JSON.stringify(users));
    }

    function speak(text) {
        const synth = window.speechSynthesis;
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'pt-BR';
        synth.speak(utter);
    }
}

// Admin
if (document.getElementById('loginAdmin')) {
    document.getElementById('loginAdmin').addEventListener('click', () => {
        const password = document.getElementById('adminPassword').value;
        if (password === ADMIN_PASSWORD) {
            document.getElementById('adminLogin').classList.add('hidden');
            document.getElementById('userList').classList.remove('hidden');
            loadUsers();
        } else {
            alert('Senha incorreta!');
        }
    });

    document.getElementById('logoutAdmin').addEventListener('click', () => {
        navigateTo('index.html');
    });
}

function loadUsers() {
    const container = document.getElementById('usersContainer');
    container.innerHTML = '';

    users.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'user-card';
        userDiv.innerHTML = `
            <h3>${user.name}</h3>
            <p>Altura: ${user.height}cm | Peso: ${user.weight}kg</p>
            <p>Corridas realizadas: ${user.activities.length}</p>
            ${user.activities.map(a => `
                <div class="activity">
                    <p>📅 ${a.date} - ${a.duration} - ${a.distance}km - ${a.pace} (${a.intensity})</p>
                </div>
            `).join('')}
        `;
        container.appendChild(userDiv);
    });
}

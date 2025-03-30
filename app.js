import { ADMIN_PASSWORD } from './config.js';

let users = JSON.parse(localStorage.getItem('runtracker_users')) || [];
let currentUser = JSON.parse(localStorage.getItem('runtracker_current')) || null;
let isRunning = false;
let startTime, timerInterval, distanceInterval;
let gpsWatchId = null;
let gpsTrack = [];
let selectedGoal = 0;
let selectedIntensity = '--';

const modoCorrida = JSON.parse(localStorage.getItem('modoCorrida')) || { tipo: 'livre' };

function navigateTo(page) {
    window.location.href = page;
}

// LOGIN por email
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const user = users.find(u => u.email === email);

        if (user) {
            currentUser = user;
            localStorage.setItem('runtracker_current', JSON.stringify(currentUser));
            navigateTo('tela_corrida_opcoes.html');
        } else {
            alert('E-mail não encontrado. Cadastre-se.');
        }
    });
}

// Cadastro
if (document.getElementById('registrationForm')) {
    document.getElementById('registrationForm').addEventListener('submit', (e) => {
        e.preventDefault();

        const user = {
            id: Date.now(),
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            height: parseInt(document.getElementById('height').value),
            weight: parseInt(document.getElementById('weight').value),
            activities: []
        };

        if (users.some(u => u.email === user.email)) {
            alert('E-mail já cadastrado! Use a opção de login.');
            return;
        }

        users.push(user);
        localStorage.setItem('runtracker_users', JSON.stringify(users));
        currentUser = user;
        localStorage.setItem('runtracker_current', JSON.stringify(currentUser));
        navigateTo('tela_corrida_opcoes.html');
    });
}

// Corrida
if (document.getElementById('startStopBtn')) {
    const btn = document.getElementById('startStopBtn');
    const timer = document.getElementById('timer');
    const distance = document.getElementById('distance');
    const pace = document.getElementById('pace');
    const distBar = document.getElementById('distProgress');
    const timeBar = document.getElementById('timeProgress');
    const statusCorrida = document.getElementById('statusCorrida');

    document.getElementById('currentUser').textContent = currentUser?.name || '';

    btn.addEventListener('click', () => {
        if (!isRunning) {
            startTracking();
        } else {
            stopTracking();
        }
    });

    function startTracking() {
        isRunning = true;
        btn.textContent = '⏹ Parar Corrida';
        startTime = Date.now();
        gpsTrack = [];
        let km = 0;
        let ultimaPosicao = null;
        let paradoDesde = Date.now();

        if (navigator.geolocation) {
            gpsWatchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const atual = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    gpsTrack.push({ ...atual, timestamp: pos.timestamp });

                    if (ultimaPosicao) {
                        const dist = calcularDistancia(ultimaPosicao, atual);
                        if (dist < 5) {
                            if (Date.now() - paradoDesde > 10000) {
                                statusCorrida.textContent = '🚶 Você está parado';
                                speak('Vamos começar, comece a correr!');
                                paradoDesde = Date.now();
                            }
                        } else {
                            statusCorrida.textContent = '🏃 Em movimento';
                            paradoDesde = Date.now();
                        }
                    }

                    ultimaPosicao = atual;
                },
                (err) => console.error('Erro GPS:', err),
                { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
            );
        }

        timerInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const minutes = elapsed / 1000 / 60;
            timer.textContent = new Date(elapsed).toISOString().substr(11, 8);

            if (modoCorrida.tipo !== 'livre' && modoCorrida.tempo) {
                const progress = Math.min((minutes / modoCorrida.tempo) * 100, 100);
                if (timeBar) timeBar.style.width = progress + '%';
            }
        }, 1000);

        distanceInterval = setInterval(() => {
            km += 0.01;
            distance.textContent = km.toFixed(2);

            const minutes = (Date.now() - startTime) / 1000 / 60;
            const paceValue = minutes / km;
            pace.textContent = isFinite(paceValue) ? paceValue.toFixed(2) + ' min/km' : '--';

            if (paceValue < 4.5) speak("Diminua o ritmo");
            else if (paceValue > 7) speak("Acelere o ritmo");

            if (modoCorrida.tipo !== 'livre' && modoCorrida.km) {
                const progress = Math.min((km / modoCorrida.km) * 100, 100);
                if (distBar) distBar.style.width = progress + '%';
            }

            if (modoCorrida.tipo === 'tempo' && km >= modoCorrida.km) {
                const minutos = (Date.now() - startTime) / 1000 / 60;
                if (minutos <= modoCorrida.tempo) speak('Desafio concluído com sucesso!');
                else speak('Você concluiu, mas ultrapassou o tempo.');
                stopTracking();
            }

            if (modoCorrida.tipo === 'personalizado' && km >= modoCorrida.km) {
                const minutos = (Date.now() - startTime) / 1000 / 60;
                if (minutos <= modoCorrida.tempo) speak(`Você completou o desafio \"${modoCorrida.nome}\"! Parabéns!`);
                else speak(`Desafio \"${modoCorrida.nome}\" concluído, mas fora do tempo.`);
                stopTracking();
            }
        }, 3000);
    }

    function stopTracking() {
        isRunning = false;
        btn.textContent = '▶ Iniciar Corrida';
        clearInterval(timerInterval);
        clearInterval(distanceInterval);

        if (gpsWatchId !== null) {
            navigator.geolocation.clearWatch(gpsWatchId);
            gpsWatchId = null;
        }

        const activity = {
            date: new Date().toLocaleString(),
            duration: document.getElementById('timer').textContent,
            distance: document.getElementById('distance').textContent,
            pace: document.getElementById('pace').textContent,
            intensity: selectedIntensity,
            route: gpsTrack,
            tipo: modoCorrida.tipo,
            desafio: modoCorrida.nome || null
        };

        const idx = users.findIndex(u => u.email === currentUser.email);
        if (idx !== -1) {
            users[idx].activities.push(activity);
            localStorage.setItem('runtracker_users', JSON.stringify(users));
        }

        localStorage.removeItem('modoCorrida');
        window.location.href = 'tela_fim_corrida.html';
    }

    function speak(text) {
        const synth = window.speechSynthesis;
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'pt-BR';
        synth.speak(utter);
    }

    function calcularDistancia(p1, p2) {
        const R = 6371e3; // metros
        const toRad = deg => deg * Math.PI / 180;
        const dLat = toRad(p2.lat - p1.lat);
        const dLon = toRad(p2.lng - p1.lng);
        const a = Math.sin(dLat/2) ** 2 +
                  Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) *
                  Math.sin(dLon/2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
}

// Admin login
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
                    <p>📅 ${a.date} - ${a.duration} - ${a.distance}km - ${a.pace} (${a.intensity || '--'})</p>
                    <p>Rota salva: ${a.route?.length > 0 ? 'Sim' : 'Não'}</p>
                </div>
            `).join('')}
        `;
        container.appendChild(userDiv);
    });
}




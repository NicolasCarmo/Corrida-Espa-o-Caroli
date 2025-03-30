import { ADMIN_PASSWORD } from './config.js';

let users = JSON.parse(localStorage.getItem('runtracker_users')) || [];
let currentUser = JSON.parse(localStorage.getItem('runtracker_current')) || null;
let isRunning = false;
let startTime, timerInterval;
let gpsWatchId = null;
let gpsTrack = [];
let selectedIntensity = '--';
const modoCorrida = JSON.parse(localStorage.getItem('modoCorrida')) || { tipo: 'livre' };

let lastSpokenKm = 0;
let lastTotalDistance = 0;

function navigateTo(page) {
  window.location.href = page;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // retorna km
}

if (document.getElementById('startStopBtn')) {
  const btn = document.getElementById('startStopBtn');
  const timer = document.getElementById('timer');
  const distance = document.getElementById('distance');
  const pace = document.getElementById('pace');
  const distBar = document.getElementById('distProgress');
  const timeBar = document.getElementById('timeProgress');
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
    lastSpokenKm = 0;
    lastTotalDistance = 0;
    distance.textContent = '0.00';
    pace.textContent = '--';
    speak("Prepare-se: 5, 4, 3, 2, 1, vai!");

    if (navigator.geolocation) {
      gpsWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          gpsTrack.push({ lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: pos.timestamp });
          atualizarDistanciaEInfos();
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
  }

  function atualizarDistanciaEInfos() {
    if (gpsTrack.length < 2) return;
    let total = 0;
    for (let i = 1; i < gpsTrack.length; i++) {
      total += haversineDistance(
        gpsTrack[i - 1].lat,
        gpsTrack[i - 1].lng,
        gpsTrack[i].lat,
        gpsTrack[i].lng
      );
    }

    total = Math.round(total * 100) / 100; // em km
    distance.textContent = total.toFixed(2);

    const minutes = (Date.now() - startTime) / 1000 / 60;
    const paceValue = minutes / total;
    pace.textContent = isFinite(paceValue) ? paceValue.toFixed(2) + ' min/km' : '--';

    if (total === lastTotalDistance) speak("Você está parado. Comece a se mover!");
    lastTotalDistance = total;

    if (Math.floor(total * 1000) % 500 === 0 && Math.floor(total * 1000) !== lastSpokenKm) {
      speak(`Você já correu ${total.toFixed(2)} quilômetros.`);
      lastSpokenKm = Math.floor(total * 1000);
    }

    if (modoCorrida.tipo === 'tempo' || modoCorrida.tipo === 'personalizado') {
      const tempoMeta = modoCorrida.tempo;
      const distanciaMeta = modoCorrida.km;

      if (total >= distanciaMeta) {
        const minutos = minutes;
        if (minutos <= tempoMeta) speak('Desafio concluído com sucesso!');
        else speak('Você concluiu, mas ultrapassou o tempo.');
        stopTracking();
        return;
      }

      const ritmoAtual = total / minutes; // km por minuto
      const ritmoEsperado = distanciaMeta / tempoMeta;

      if (ritmoAtual < ritmoEsperado * 0.9) speak('Você está abaixo da média. Acelere para bater a meta.');
      else if (ritmoAtual >= ritmoEsperado * 0.9 && ritmoAtual <= ritmoEsperado * 1.1) speak('Você está indo bem. Mantenha esse ritmo!');
      else speak('Você está acima da média. Excelente!');
    }

    if (modoCorrida.tipo !== 'livre' && modoCorrida.km) {
      const progress = Math.min((total / modoCorrida.km) * 100, 100);
      if (distBar) distBar.style.width = progress + '%';
    }
  }

  function stopTracking() {
    isRunning = false;
    btn.textContent = '▶ Iniciar Corrida';
    clearInterval(timerInterval);
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
} // fim do startStopBtn





import { ADMIN_PASSWORD } from './config.js';
import { db } from './firebase.js';
import { doc, updateDoc, arrayUnion } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

let currentUser = JSON.parse(localStorage.getItem('runtracker_current')) || null;
let isRunning = false;
let startTime, timerInterval;
let gpsWatchId = null;
let gpsTrack = [];
let selectedIntensity = '--';
const modoCorrida = JSON.parse(localStorage.getItem('modoCorrida')) || { tipo: 'livre' };
let totalDistance = 0;
let lastSpokenKm = 0;
let lastMovementTime = Date.now();

function navigateTo(page) {
  window.location.href = page;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // retorna em km
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
    totalDistance = 0;
    lastSpokenKm = 0;
    speak("Prepare-se. 5, 4, 3, 2, 1, vai!");

    if (navigator.geolocation) {
      gpsWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const timestamp = pos.timestamp;

          const last = gpsTrack[gpsTrack.length - 1];
          if (last) {
            const dist = haversineDistance(last.lat, last.lng, lat, lng);
            if (dist >= 0.005) { // só considera movimento real acima de 5m
              gpsTrack.push({ lat, lng, timestamp });
              totalDistance += dist;
              lastMovementTime = Date.now();
            }
          } else {
            gpsTrack.push({ lat, lng, timestamp });
          }

          atualizarDados();
        },
        (err) => console.error('Erro GPS:', err),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    }

    timerInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const minutes = elapsed / 1000 / 60;
      timer.textContent = new Date(elapsed).toISOString().substr(11, 8);

      if (modoCorrida.tempo && timeBar) {
        const progress = Math.min((minutes / modoCorrida.tempo) * 100, 100);
        timeBar.style.width = progress + '%';
      }

      if (Date.now() - lastMovementTime > 20000) {
        speak("Você está parado. Comece a se mover!");
        lastMovementTime = Date.now();
      }
    }, 1000);
  }

  function atualizarDados() {
    const dist = totalDistance;
    const elapsedMin = (Date.now() - startTime) / 1000 / 60;
    const paceVal = elapsedMin / dist;

    document.getElementById('distance').textContent = dist.toFixed(2);
    document.getElementById('pace').textContent = isFinite(paceVal) ? paceVal.toFixed(2) + ' min/km' : '--';

    if (Math.floor(dist * 2) > lastSpokenKm) {
      speak(`Você já correu ${dist.toFixed(2)} quilômetros.`);
      lastSpokenKm = Math.floor(dist * 2);
    }

    if (modoCorrida.tipo !== 'livre' && modoCorrida.km) {
      const progresso = Math.min((dist / modoCorrida.km) * 100, 100);
      if (distBar) distBar.style.width = progresso + '%';
    }

    if (modoCorrida.tipo === 'tempo' || modoCorrida.tipo === 'personalizado') {
      if (dist >= modoCorrida.km) {
        const minutos = elapsedMin;
        if (minutos <= modoCorrida.tempo) speak('Desafio concluído com sucesso!');
        else speak('Você concluiu, mas ultrapassou o tempo.');
        stopTracking();
        return;
      }

      const ritmoAtual = dist / elapsedMin;
      const ritmoMeta = modoCorrida.km / modoCorrida.tempo;

      if (Math.abs(dist - Math.round(dist)) < 0.02) {
        if (ritmoAtual < ritmoMeta * 0.9) speak('Você está abaixo da média. Acelere para bater a meta.');
        else if (ritmoAtual <= ritmoMeta * 1.1) speak('Você está indo bem. Mantenha esse ritmo!');
        else speak('Você está acima da média. Excelente!');
      }
    }
  }

  async function stopTracking() {
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
      distance: totalDistance.toFixed(2),
      pace: document.getElementById('pace').textContent,
      intensity: selectedIntensity,
      route: gpsTrack,
      tipo: modoCorrida.tipo,
      desafio: modoCorrida.nome || null
    };

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        activities: arrayUnion(activity)
      });
      currentUser.activities = [...(currentUser.activities || []), activity];
      localStorage.setItem('runtracker_current', JSON.stringify(currentUser));
    } catch (err) {
      console.error('Erro ao salvar atividade:', err);
    }

    localStorage.removeItem('modoCorrida');
    navigateTo('tela_fim_corrida.html');
  }

  function speak(text) {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'pt-BR';
    synth.cancel();
    synth.speak(utter);
  }
}







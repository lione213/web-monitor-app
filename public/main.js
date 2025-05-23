// public/main.js

const socket = io();
let localStream, peerConnection, remotePeerId;
let mediaRecorder, recordedChunks = [];

// WebRTC config
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// DOM elements – Broadcast
const btnBroadcast       = document.getElementById('btn-broadcast');
const btnViewMode        = document.getElementById('btn-view');
const startBroadcast     = document.getElementById('btn-start-broadcast');
const stopBroadcast      = document.getElementById('btn-stop-broadcast');
const switchCam          = document.getElementById('btn-switch-cam');
const pairCodeInput      = document.getElementById('pairCode');
const connStatus         = document.getElementById('conn-status');
const logEl              = document.getElementById('log');

// DOM elements – View
const startView          = document.getElementById('btn-start-view');
const joinCodeInput      = document.getElementById('joinCode');
const remoteVideo        = document.getElementById('remoteVideo');
const viewStatus         = document.getElementById('view-status');
const viewLogEl          = document.getElementById('view-log');

// DOM elements – Controls (View side)
const zoomIn             = document.getElementById('btn-zoom-in');
const zoomOut            = document.getElementById('btn-zoom-out');
const muteBtn            = document.getElementById('btn-mute');

// Language selector
const langSelect         = document.getElementById('lang');

// i18n dictionary
const i18n = {
  ar: { broadcast_title: 'عرض البث', start_broadcast: 'بدء البث', stop_broadcast: 'قطع البث', switch_cam: 'تبديل الكاميرا', event_log: 'سجل الأحداث', view_title: 'مشاهدة البث', start_view: 'بدء المشاهدة', zoom_in: 'تكبير', zoom_out: 'تصغير', mute_toggle: 'كتم/تشغيل الصوت', view_log: 'سجل المشاهدة' },
  fr: { broadcast_title: 'Diffusion en direct', start_broadcast: 'Démarrer la diffusion', stop_broadcast: 'Arrêter la diffusion', switch_cam: 'Changer de caméra', event_log: 'Journal des événements', view_title: 'Regarder le flux', start_view: 'Démarrer le visionnage', zoom_in: 'Zoom +', zoom_out: 'Zoom −', mute_toggle: 'Muet/Activer le son', view_log: 'Journal de visionnage' },
  en: { broadcast_title: 'Broadcast', start_broadcast: 'Start Broadcast', stop_broadcast: 'Stop Broadcast', switch_cam: 'Switch Camera', event_log: 'Event Log', view_title: 'View Stream', start_view: 'Start Viewing', zoom_in: 'Zoom In', zoom_out: 'Zoom Out', mute_toggle: 'Mute/Unmute', view_log: 'View Log' }
};

// Helper: append to log
function log(msg, view = false) {
  const time = new Date().toLocaleTimeString();
  const target = view ? viewLogEl : logEl;
  target.textContent += `[${time}] ${msg}\n`;
  target.scrollTop = target.scrollHeight;
}

// Language switcher
langSelect.onchange = function() {
  const lang = this.value;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (i18n[lang][key]) el.textContent = i18n[lang][key];
  });
};

// UI toggles
btnBroadcast.onclick = () => {
  document.getElementById('role-selection').classList.add('hidden');
  document.getElementById('broadcast-section').classList.remove('hidden');
};
btnViewMode.onclick = () => {
  document.getElementById('role-selection').classList.add('hidden');
  document.getElementById('view-section').classList.remove('hidden');
};

// BROADCAST logic
startBroadcast.onclick = () => {
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true })
    .then(stream => {
      localStream = stream;
      document.getElementById('localVideo').srcObject = stream;
      startBroadcast.classList.add('hidden');
      stopBroadcast.classList.remove('hidden');
      log('Camera stream started');
      socket.emit('create-pair');
      socket.on('pair-created', code => {
        pairCodeInput.value = code;
        log('Pair code: ' + code);
      });
      socket.on('viewer-joined', viewerId => {
        remotePeerId = viewerId;
        connStatus.textContent = 'حالة الاتصال: متصل';
        peerConnection = new RTCPeerConnection(config);
        localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));
        peerConnection.onicecandidate = e => {
          if (e.candidate) {
            socket.emit('signal', { to: remotePeerId, data: { candidate: e.candidate } });
            log('Sent ICE candidate');
          }
        };
        peerConnection.createOffer().then(offer => {
          peerConnection.setLocalDescription(offer);
          socket.emit('signal', { to: remotePeerId, data: { sdp: offer } });
          log('Offer sent');
        });
      });
      socket.on('signal', ({ from, data }) => {
        log('Signal from ' + from);
        if (data.candidate) peerConnection.addIceCandidate(data.candidate);
        else if (data.sdp) peerConnection.setRemoteDescription(data.sdp);
      });
    })
    .catch(err => log('Error: ' + err.message));
};

stopBroadcast.onclick = () => {
  if (localStream) localStream.getTracks().forEach(t => t.stop());
  stopBroadcast.classList.add('hidden');
  startBroadcast.classList.remove('hidden');
  connStatus.textContent = 'حالة الاتصال: —';
  log('Broadcast stopped');
};

switchCam.onclick = () => {
  if (!localStream) return;
  const track = localStream.getVideoTracks()[0];
  const current = track.getSettings().facingMode || 'environment';
  const newMode = current === 'environment' ? 'user' : 'environment';
  navigator.mediaDevices.getUserMedia({ video: { facingMode: newMode }, audio: true })
    .then(stream => {
      localStream = stream;
      document.getElementById('localVideo').srcObject = stream;
      log('Switched to ' + newMode + ' camera');
    });
};

// VIEWER logic
startView.onclick = () => {
  const code = joinCodeInput.value.trim();
  if (!code) return alert('أدخل رمز البث');
  socket.emit('join-pair', code);
  log('Join request sent', true);
  socket.once('pair-accepted', broadcasterId => {
    remotePeerId = broadcasterId;
    viewStatus.textContent = 'حالة الاتصال: متصل';
    log('Pair accepted: ' + broadcasterId, true);
    peerConnection = new RTCPeerConnection(config);
    peerConnection.ontrack = e => {
      remoteVideo.srcObject = e.streams[0];
      log('Stream received', true);
    };
    peerConnection.onicecandidate = e => {
      if (e.candidate) {
        socket.emit('signal', { to: remotePeerId, data: { candidate: e.candidate } });
        log('Sent ICE candidate', true);
      }
    };
    socket.on('signal', async ({ from, data }) => {
      log('Signal from ' + from, true);
      if (data.sdp) {
        await peerConnection.setRemoteDescription(data.sdp);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { to: remotePeerId, data: { sdp: answer } });
        log('Answer sent', true);
      } else if (data.candidate) {
        await peerConnection.addIceCandidate(data.candidate);
        log('ICE candidate added', true);
      }
    });
  });
};

stopViewBtn.onclick = () => {
  if (remoteVideo.srcObject) remoteVideo.srcObject.getTracks().forEach(t => t.stop());
  viewStatus.textContent = 'حالة الاتصال: —';
  log('View stopped', true);
};

// ZOOM & MUTE functionalities
zoomIn.onclick = async () => {
  const track = remoteVideo.srcObject?.getVideoTracks()[0];
  if (track && track.getCapabilities().zoom) {
    const cap = track.getCapabilities().zoom;
    const cur = track.getSettings().zoom || cap.min;
    const nz = Math.min(cap.max, cur + 1);
    await track.applyConstraints({ advanced: [{ zoom: nz }] });
    log(`Zoom: ${nz}`, true);
  }
};

zoomOut.onclick = async () => {
  const track = remoteVideo.srcObject?.getVideoTracks()[0];
  if (track && track.getCapabilities().zoom) {
    const cap = track.getCapabilities().zoom;
    const cur = track.getSettings().zoom || cap.min;
    const nz = Math.max(cap.min, cur - 1);
    await track.applyConstraints({ advanced: [{ zoom: nz }] });
    log(`Zoom: ${nz}`, true);
  }
};

muteBtn.onclick = () => {
  if (!remoteVideo.srcObject) return;
  const enabled = remoteVideo.srcObject.getAudioTracks()[0].enabled;
  remoteVideo.srcObject.getAudioTracks()[0].enabled = !enabled;
  muteBtn.textContent = enabled ? '🔇' : '🔊';
  log(`Audio ${enabled ? 'muted' : 'unmuted'}`, true);
};

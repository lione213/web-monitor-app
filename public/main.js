const socket = io();
let localStream, peerConnection, remotePeerId;
let mediaRecorder, recordedChunks = [];
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// DOM elements
const btnBroadcast    = document.getElementById('btn-broadcast');
const btnViewMode     = document.getElementById('btn-view');
const startBroadcast  = document.getElementById('btn-start-broadcast');
const stopBroadcast   = document.getElementById('btn-stop-broadcast');
const switchCam       = document.getElementById('btn-switch-cam');
const pairCodeInput   = document.getElementById('pairCode');
const connStatus      = document.getElementById('conn-status');
const logEl           = document.getElementById('log');

const startView       = document.getElementById('btn-start-view');
const joinCodeInput   = document.getElementById('joinCode');
const remoteVideo     = document.getElementById('remoteVideo');
const viewControls    = document.querySelector('.view-controls');
const zoomIn          = document.getElementById('btn-zoom-in');
const zoomOut         = document.getElementById('btn-zoom-out');
const muteBtn         = document.getElementById('btn-mute');
const recordStreamBtn = document.getElementById('btn-record-stream');
const stopViewBtn     = document.getElementById('btn-stop-view');
const viewStatus      = document.getElementById('view-status');
const viewLogEl       = document.getElementById('view-log');

// Helper to append logs
function log(msg, view=false) {
  const time = new Date().toLocaleTimeString();
  const target = view ? viewLogEl : logEl;
  target.textContent += `[${time}] ${msg}\n`;
  target.scrollTop = target.scrollHeight;
}

// Switch UI
btnBroadcast.onclick = () => {
  document.getElementById('role-selection').classList.add('hidden');
  document.getElementById('broadcast-section').classList.remove('hidden');
};
btnViewMode.onclick = () => {
  document.getElementById('role-selection').classList.add('hidden');
  document.getElementById('view-section').classList.remove('hidden');
};

// Broadcast
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

      socket.on('signal', async ({ from, data }) => {
        log('Signal from ' + from);
        if (data.candidate) await peerConnection.addIceCandidate(data.candidate);
        else if (data.sdp) await peerConnection.setRemoteDescription(data.sdp);
      });
    })
    .catch(err => log('Error: ' + err.message));
};
stopBroadcast.onclick = () => {
  if (localStream) localStream.getTracks().forEach(t => t.stop());
  stopBroadcast.classList.add('hidden');
  startBroadcast.classList.remove('hidden');
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

// View
startView.onclick = () => {
  const code = joinCodeInput.value.trim();
  if (!code) return alert('أدخل رمز البث');
  peerConnection = new RTCPeerConnection(config);
  peerConnection.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
    log('Stream received', true);
  };
  peerConnection.onicecandidate = e => {
    if (e.candidate && remotePeerId) {
      socket.emit('signal', { to: remotePeerId, data: { candidate: e.candidate } });
      log('Sent ICE candidate', true);
    }
  };
  socket.emit('join-pair', code);
  socket.on('signal', async ({ from, data }) => {
    viewStatus.innerText = 'Connected';
    remotePeerId = from;
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
  log('Join request sent', true);
};
stopViewBtn.onclick = () => {
  if (remoteVideo.srcObject) remoteVideo.srcObject.getTracks().forEach(t => t.stop());
  viewStatus.innerText = 'Disconnected';
  log('View stopped', true);
};

// View controls (stubs)
zoomIn.onclick  = () => log('Zoom in (not implemented)', true);
zoomOut.onclick = () => log('Zoom out (not implemented)', true);
muteBtn.onclick = () => log('Toggle mute (not implemented)', true);
recordStreamBtn.onclick = () => log('Record stream (not implemented)', true);

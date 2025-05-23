// public/main.js
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
function log(msg, view = false) {
  const time = new Date().toLocaleTimeString();
  const target = view ? viewLogEl : logEl;
  target.textContent += '[' + time + '] ' + msg + '\\n';
  target.scrollTop = target.scrollHeight;
}

// Switch UI
btnBroadcast.onclick = function() {
  document.getElementById('role-selection').classList.add('hidden');
  document.getElementById('broadcast-section').classList.remove('hidden');
};
btnViewMode.onclick = function() {
  document.getElementById('role-selection').classList.add('hidden');
  document.getElementById('view-section').classList.remove('hidden');
};

// Broadcast logic
startBroadcast.onclick = function() {
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true })
    .then(function(stream) {
      localStream = stream;
      document.getElementById('localVideo').srcObject = stream;
      startBroadcast.classList.add('hidden');
      stopBroadcast.classList.remove('hidden');
      log('Camera stream started');
      socket.emit('create-pair');
      socket.on('pair-created', function(code) {
        pairCodeInput.value = code;
        log('Pair code: ' + code);
      });

      socket.on('viewer-joined', function(viewerId) {
        remotePeerId = viewerId;
        peerConnection = new RTCPeerConnection(config);
        localStream.getTracks().forEach(function(t) {
          peerConnection.addTrack(t, localStream);
        });
        peerConnection.onicecandidate = function(e) {
          if (e.candidate) {
            socket.emit('signal', { to: remotePeerId, data: { candidate: e.candidate } });
            log('Sent ICE candidate');
          }
        };
        peerConnection.createOffer().then(function(offer) {
          peerConnection.setLocalDescription(offer);
          socket.emit('signal', { to: remotePeerId, data: { sdp: offer } });
          log('Offer sent');
        });
      });

      socket.on('signal', function(obj) {
        const from = obj.from;
        const data = obj.data;
        log('Signal from ' + from);
        if (data.candidate) {
          peerConnection.addIceCandidate(data.candidate);
        } else if (data.sdp) {
          peerConnection.setRemoteDescription(data.sdp);
        }
      });
    })
    .catch(function(err) {
      log('Error: ' + err.message);
    });
};
stopBroadcast.onclick = function() {
  if (localStream) {
    localStream.getTracks().forEach(function(t) { t.stop(); });
  }
  stopBroadcast.classList.add('hidden');
  startBroadcast.classList.remove('hidden');
  log('Broadcast stopped');
};
switchCam.onclick = function() {
  if (!localStream) return;
  const track = localStream.getVideoTracks()[0];
  const current = track.getSettings().facingMode || 'environment';
  const newMode = current === 'environment' ? 'user' : 'environment';
  navigator.mediaDevices.getUserMedia({ video: { facingMode: newMode }, audio: true })
    .then(function(stream) {
      localStream = stream;
      document.getElementById('localVideo').srcObject = stream;
      log('Switched to ' + newMode + ' camera');
    });
};

// Viewer logic
startView.onclick = function() {
  const code = joinCodeInput.value.trim();
  if (!code) return alert('أدخل رمز البث');
  socket.emit('join-pair', code);
  log('Join request sent', true);

  socket.once('pair-accepted', function(broadcasterId) {
    remotePeerId = broadcasterId;
    log('Pair accepted: ' + broadcasterId, true);

    peerConnection = new RTCPeerConnection(config);
    peerConnection.ontrack = function(e) {
      remoteVideo.srcObject = e.streams[0];
      log('Stream received', true);
    };
    peerConnection.onicecandidate = function(e) {
      if (e.candidate && remotePeerId) {
        socket.emit('signal', { to: remotePeerId, data: { candidate: e.candidate } });
        log('Sent ICE candidate to broadcaster', true);
      }
    };

    socket.on('signal', function(obj) {
      const from = obj.from;
      const data = obj.data;
      log('Signal received from ' + from, true);
      if (data.sdp) {
        peerConnection.setRemoteDescription(data.sdp).then(function() {
          return peerConnection.createAnswer();
        }).then(function(answer) {
          peerConnection.setLocalDescription(answer);
          socket.emit('signal', { to: remotePeerId, data: { sdp: answer } });
          log('Answer sent', true);
        });
      } else if (data.candidate) {
        peerConnection.addIceCandidate(data.candidate);
        log('ICE candidate added', true);
      }
    });
  });
};
stopViewBtn.onclick = function() {
  if (remoteVideo.srcObject) {
    remoteVideo.srcObject.getTracks().forEach(function(t) { t.stop(); });
  }
  viewStatus.innerText = 'Disconnected';
  log('View stopped', true);
};

// View controls stubs
zoomIn.onclick  = function() { log('Zoom in (not implemented)', true); };
zoomOut.onclick = function() { log('Zoom out (not implemented)', true); };
muteBtn.onclick = function() { log('Toggle mute (not implemented)', true); };
recordStreamBtn.onclick = function() { log('Record stream (not implemented)', true); };

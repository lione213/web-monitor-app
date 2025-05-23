const socket = io();
let localStream;
let peerConnection;
let remotePeerId = null;
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// العناصر
const btnCam    = document.getElementById('btn-camera');
const btnView   = document.getElementById('btn-viewer');
const btnCon    = document.getElementById('btn-connect');
const selRole   = document.getElementById('role-selection');
const camSec    = document.getElementById('camera-section');
const viewSec   = document.getElementById('viewer-section');
const pairCode  = document.getElementById('pairCode');
const joinCode  = document.getElementById('joinCode');
const localVid  = document.getElementById('localVideo');
const remoteVid = document.getElementById('remoteVideo');

// اختيار الدور
btnCam.onclick = () => {
  selRole.classList.add('hidden');
  camSec.classList.remove('hidden');
  startCamera();
};
btnView.onclick = () => {
  selRole.classList.add('hidden');
  viewSec.classList.remove('hidden');
};

// بدء كاميرا البث
function startCamera() {
  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      localStream = stream;
      localVid.srcObject = stream;

      socket.emit('create-pair');
      socket.on('pair-created', code => pairCode.textContent = code);

      socket.on('viewer-joined', viewerId => {
        remotePeerId = viewerId;
        peerConnection = new RTCPeerConnection(config);
        localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));

        peerConnection.onicecandidate = e => {
          if (e.candidate && remotePeerId) {
            socket.emit('signal', { to: remotePeerId, data: { candidate: e.candidate } });
          }
        };

        peerConnection.createOffer()
          .then(offer => {
            peerConnection.setLocalDescription(offer);
            socket.emit('signal', { to: remotePeerId, data: { sdp: offer } });
          });
      });

      socket.on('signal', async ({ from, data }) => {
        if (data.candidate) {
          await peerConnection.addIceCandidate(data.candidate);
        } else if (data.sdp) {
          await peerConnection.setRemoteDescription(data.sdp);
        }
      });
    })
    .catch(console.error);
}

// بدء جهاز المشاهدة
btnCon.onclick = () => {
  const code = joinCode.value.trim();
  if (!code) return alert('ادخل رمز الاقتران');
  socket.emit('join-pair', code);

  socket.on('viewer-joined', camId => {
    // (هذا حدث اختياري إذا أردت إعلام المرسل)
  });

  peerConnection = new RTCPeerConnection(config);
  peerConnection.ontrack = e => remoteVid.srcObject = e.streams[0];

  peerConnection.onicecandidate = e => {
    if (e.candidate && remotePeerId) {
      socket.emit('signal', { to: remotePeerId, data: { candidate: e.candidate } });
    }
  };

  socket.on('signal', async ({ from, data }) => {
    if (data.sdp) {
      remotePeerId = from;
      await peerConnection.setRemoteDescription(data.sdp);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('signal', { to: remotePeerId, data: { sdp: answer } });
    } else if (data.candidate) {
      await peerConnection.addIceCandidate(data.candidate);
    }
  });
};

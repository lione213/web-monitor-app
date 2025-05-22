const socket = io();
let localStream;
let peerConnection;
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

function selectRole(role) {
  document.getElementById('role-selection').classList.add('hidden');
  if (role === 'camera') {
    document.getElementById('camera-section').classList.remove('hidden');
    startCamera();
  } else {
    document.getElementById('viewer-section').classList.remove('hidden');
  }
}

function startCamera() {
  navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
    localStream = stream;
    document.getElementById('localVideo').srcObject = stream;

    socket.emit('create-pair');
    socket.on('pair-created', code => {
      document.getElementById('pairCode').textContent = code;
    });

    socket.on('viewer-joined', viewerId => {
      peerConnection = new RTCPeerConnection(config);
      localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

      peerConnection.onicecandidate = event => {
        if (event.candidate) {
          socket.emit('signal', { to: viewerId, data: { candidate: event.candidate } });
        }
      };

      peerConnection.createOffer().then(offer => {
        peerConnection.setLocalDescription(offer);
        socket.emit('signal', { to: viewerId, data: { sdp: offer } });
      });
    });

    socket.on('signal', async ({ from, data }) => {
      if (data.candidate) {
        peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      } else if (data.sdp) {
        peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
      }
    });
  });
}

function connectToCamera() {
  const code = document.getElementById('joinCode').value;
  socket.emit('join-pair', code);

  peerConnection = new RTCPeerConnection(config);
  peerConnection.ontrack = event => {
    document.getElementById('remoteVideo').srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('signal', { to: null, data: { candidate: event.candidate } });
    }
  };

  socket.on('signal', async ({ from, data }) => {
    if (data.sdp) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('signal', { to: from, data: { sdp: answer } });
    } else if (data.candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  });
}
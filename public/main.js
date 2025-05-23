const socket = io();
let localStream, peerConnection, remotePeerId;
let mediaRecorder, recordedChunks = [];
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// عناصر DOM (كما كانت)
…

// دالة سجل محسّنة
function log(msg, view=false) {
  const time = new Date().toLocaleTimeString();
  const target = view ? viewLogEl : logEl;
  target.textContent += `[${time}] ${msg}\n`;
  target.scrollTop = target.scrollHeight;
}

// === Broadcast code unchanged ===

// === Viewer side ===

startView.onclick = () => {
  const code = joinCodeInput.value.trim();
  if (!code) return alert('أدخل رمز البث');

  // أولًا، اطلب الانضمام
  socket.emit('join-pair', code);
  log('Join request sent', true);

  // استقبل معرف البث
  socket.once('pair-accepted', broadcasterId => {
    remotePeerId = broadcasterId;
    log('Pair accepted, broadcaster ID: ' + broadcasterId, true);

    // جهز PeerConnection
    peerConnection = new RTCPeerConnection(config);
    peerConnection.ontrack = e => {
      remoteVideo.srcObject = e.streams[0];
      log('Stream received', true);
    };
    peerConnection.onicecandidate = e => {
      if (e.candidate) {
        socket.emit('signal', { to: remotePeerId, data: { candidate: e.candidate } });
        log('Sent ICE candidate to broadcaster', true);
      }
    };

    // ابدأ الاستماع للإشارات
    socket.on('signal', async ({ from, data }) => {
      log('Signal received from ' + from, true);
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

// ضبط قطع المشاهدة
stopViewBtn.onclick = () => {
  if (remoteVideo.srcObject) remoteVideo.srcObject.getTracks().forEach(t => t.stop());
  viewStatus.innerText = 'Disconnected';
  log('View stopped', true);
};

// باقي view-controls (zoom, mute, record) كما كان…

const socket = io();
let localStream, peerConnection, remotePeerId;
let mediaRecorder, recordedChunks = [];
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// العناصر
const logEl      = document.getElementById('log');
const controls   = document.getElementById('controls-section');
const btnZoomIn  = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnRecord  = document.getElementById('btn-record');
const btnStopRec = document.getElementById('btn-stop-record');
const dlLink     = document.getElementById('downloadLink');

// دالة لإضافة سجل
function log(msg) {
  const time = new Date().toLocaleTimeString('ar-EG');
  logEl.textContent += `[${time}] ${msg}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

// startCamera مع الكاميرا الخلفية
function startCamera() {
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: { exact: "environment" } },
    audio: true
  })
  .then(stream => {
    localStream = stream;
    document.getElementById('localVideo').srcObject = stream;
    controls.classList.remove('hidden');  // إظهار أدوات التحكم

    log('تم تشغيل الكاميرا الخلفية');
    socket.emit('create-pair');
    socket.on('pair-created', code => log('Pair code: ' + code));

    // إعداد WebRTC كما قبلاً...
  })
  .catch(err => {
    log('خطأ في تشغيل الكاميرا: ' + err.message);
    // جرب الكاميرا الأمامية كبديل:
    return navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  });
}

// وظائف الزوم
async function changeZoom(delta) {
  const [track] = localStream.getVideoTracks();
  const capabilities = track.getCapabilities();
  if (!capabilities.zoom) {
    return log('الزوم غير مدعوم على هذه الكاميرا');
  }
  const settings = track.getSettings();
  let newZoom = (settings.zoom || capabilities.zoom.min) + delta;
  newZoom = Math.max(capabilities.zoom.min, Math.min(capabilities.zoom.max, newZoom));
  await track.applyConstraints({ advanced: [{ zoom: newZoom }] });
  log('الزوم تم إلى ' + newZoom.toFixed(1));
}
btnZoomIn.onclick  = () => changeZoom(1);
btnZoomOut.onclick = () => changeZoom(-1);

// تسجيل الفيديو
btnRecord.onclick = () => {
  mediaRecorder = new MediaRecorder(localStream);
  recordedChunks = [];
  mediaRecorder.ondataavailable = e => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    dlLink.href = URL.createObjectURL(blob);
    dlLink.classList.remove('hidden');
    log('انتهى التسجيل، اضغط لتحميله');
  };
  mediaRecorder.start();
  btnRecord.classList.add('hidden');
  btnStopRec.classList.remove('hidden');
  log('بدء التسجيل');
};
btnStopRec.onclick = () => {
  mediaRecorder.stop();
  btnStopRec.classList.add('hidden');
  btnRecord.classList.remove('hidden');
};

// … أبقِ كود الاتصال عبر Socket.IO و WebRTC كما هو مع إضافة استدعاءات log()  
// مثال:
socket.on('viewer-joined', viewerId => {
  log('المشاهد انضم: ' + viewerId);
  // … بقية إعداد offer/answer
});
socket.on('signal', ({ from, data }) => {
  log('وصلت إشارة من ' + from);
  // … التعامل مع candidate أو sdp
});

// لا نغير بقية الكود، نضيف فقط:

// 1) Responsive: لا حاجة لعمل شيء، الـ video-wrapper يتولى الأمر.

// 2) تفعيل تغيير اللغة:
const i18n = {
  ar: {
    broadcast_title: 'عرض البث',
    start_broadcast: 'بدء البث',
    stop_broadcast: 'قطع البث',
    switch_cam: 'تبديل الكاميرا',
    event_log: 'سجل الأحداث',
    view_title: 'مشاهدة البث',
    start_view: 'بدء المشاهدة',
    zoom_in: 'تكبير',
    zoom_out: 'تصغير',
    mute_toggle: 'كتم/تشغيل الصوت',
    view_log: 'سجل المشاهدة'
  },
  fr: {
    broadcast_title: 'Diffusion en direct',
    start_broadcast: 'Démarrer la diffusion',
    stop_broadcast: 'Arrêter la diffusion',
    switch_cam: 'Changer de caméra',
    event_log: 'Journal des événements',
    view_title: 'Regarder le flux',
    start_view: 'Démarrer le visionnage',
    zoom_in: 'Zoom +',
    zoom_out: 'Zoom −',
    mute_toggle: 'Muet/Activer le son',
    view_log: 'Journal de visionnage'
  },
  en: {
    broadcast_title: 'Broadcast',
    start_broadcast: 'Start Broadcast',
    stop_broadcast: 'Stop Broadcast',
    switch_cam: 'Switch Camera',
    event_log: 'Event Log',
    view_title: 'View Stream',
    start_view: 'Start Viewing',
    zoom_in: 'Zoom In',
    zoom_out: 'Zoom Out',
    mute_toggle: 'Mute/Unmute',
    view_log: 'View Log'
  }
};

document.getElementById('lang').onchange = function() {
  const lang = this.value;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = i18n[lang][key] || el.textContent;
  });
};

// 3) تفعيل Zoom و Mute:

const videoView = document.getElementById('remoteVideo');
const muteBtn   = document.getElementById('btn-mute');
let isMuted = false;

zoomIn.onclick = async () => {
  const track = videoView.srcObject?.getVideoTracks()[0];
  if (track && track.getCapabilities().zoom) {
    const cap = track.getCapabilities().zoom;
    const cur = track.getSettings().zoom || cap.min;
    const nz = Math.min(cap.max, cur + 1);
    await track.applyConstraints({ advanced: [{ zoom: nz }] });
    log(`Zoom: ${nz}`, true);
  }
};

zoomOut.onclick = async () => {
  const track = videoView.srcObject?.getVideoTracks()[0];
  if (track && track.getCapabilities().zoom) {
    const cap = track.getCapabilities().zoom;
    const cur = track.getSettings().zoom || cap.min;
    const nz = Math.max(cap.min, cur - 1);
    await track.applyConstraints({ advanced: [{ zoom: nz }] });
    log(`Zoom: ${nz}`, true);
  }
};

muteBtn.onclick = () => {
  if (!videoView.srcObject) return;
  isMuted = !isMuted;
  videoView.srcObject.getAudioTracks().forEach(t => t.enabled = !isMuted);
  muteBtn.textContent = isMuted ? '🔇' : '🔊';
  log(`Audio ${isMuted ? 'muted' : 'unmuted'}`, true);
};

// اسلام باقي الكود بدون تغيير

import * as faceapi from 'face-api.js';

const vid = document.getElementById('vid');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const status = document.getElementById('status');
const btn = document.getElementById('btn-measure');
let modelsReady = false;
let measuring = false;
const points = { p1: 0, p2: 0 };

const n1 = () => document.getElementById('n1').value || 'Pessoa 1';
const n2 = () => document.getElementById('n2').value || 'Pessoa 2';

function updateNameLabels() {
  document.getElementById('lbl1').textContent = n1();
  document.getElementById('lbl2').textContent = n2();
  document.getElementById('sc-name1').textContent = n1() + ' — ' + points.p1 + ' pts';
  document.getElementById('sc-name2').textContent = n2() + ' — ' + points.p2 + ' pts';
}

document.getElementById('n1').addEventListener('input', updateNameLabels);
document.getElementById('n2').addEventListener('input', updateNameLabels);

async function init() {
  try {
    status.textContent = 'A pedir acesso à câmara...';
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    vid.srcObject = stream;
    await new Promise(r => vid.onloadedmetadata = r);
    vid.play();
    status.textContent = 'A carregar modelos de IA...';
    await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
    await faceapi.nets.faceExpressionNet.loadFromUri('/models');
    await faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models');
    modelsReady = true;
    status.textContent = 'Prontos! Posicionem-se nos dois lados e cliquem em medir.';
    btn.disabled = false;
    liveDetect();
  } catch(e) {
    status.textContent = 'Erro: ' + (e.message || 'câmara não disponível');
  }
}

function calcScore(expr, landmarks) {
  const happy = expr.happy || 0;
  const sad = expr.sad || 0;
  const angry = expr.angry || 0;
  const disgusted = expr.disgusted || 0;
  const fearful = expr.fearful || 0;
  const surprised = expr.surprised || 0;
  let score = happy * 100;
  score -= (sad + angry + disgusted + fearful) * 30;
  if (happy > 0.5 && surprised > 0.2) score += surprised * 10;
  if (landmarks) {
    try {
      const pts = landmarks.positions;
      const leftEye = pts.slice(36, 42);
      const rightEye = pts.slice(42, 48);
      const eyeHeight = (eyeOpenness(leftEye) + eyeOpenness(rightEye)) / 2;
      if (happy > 0.5 && eyeHeight < 0.28) score += 12;
    } catch(_) {}
  }
  return Math.min(100, Math.max(0, Math.round(score)));
}

function eyeOpenness(pts) {
  const width = dist(pts[0], pts[3]);
  const h1 = dist(pts[1], pts[5]);
  const h2 = dist(pts[2], pts[4]);
  return (h1 + h2) / (2 * width);
}

function dist(a, b) {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

async function liveDetect() {
  if (!modelsReady || measuring) { requestAnimationFrame(liveDetect); return; }
  overlay.width = vid.videoWidth;
  overlay.height = vid.videoHeight;
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  try {
    const dets = await faceapi
      .detectAllFaces(vid, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.45 }))
      .withFaceLandmarks(true)
      .withFaceExpressions();
    dets.forEach(d => {
      const b = d.detection.box;
      const score = calcScore(d.expressions, d.landmarks);
      const color = score > 60 ? '#f9d423' : score > 30 ? '#888' : '#ff4e50';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(b.x, b.y, b.width, b.height);
      ctx.fillStyle = color;
      ctx.fillRect(b.x, b.y - 26, b.width, 24);
      ctx.fillStyle = '#000';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('Felicidade: ' + score + '%', b.x + 6, b.y - 8);
    });
  } catch(_) {}
  requestAnimationFrame(liveDetect);
}

function drawResult(winnerSide) {
  const w = overlay.width;
  const h = overlay.height;
  const mid = w / 2;
  const leftIsWinner = winnerSide === 'left';

  ctx.fillStyle = leftIsWinner ? 'rgba(0,200,80,0.35)' : 'rgba(220,50,50,0.35)';
  ctx.fillRect(0, 0, mid, h);
  ctx.fillStyle = leftIsWinner ? 'rgba(220,50,50,0.35)' : 'rgba(0,200,80,0.35)';
  ctx.fillRect(mid, 0, mid, h);

  const leftText = leftIsWinner ? 'WIN!' : 'LOSE!';
  const rightText = leftIsWinner ? 'LOSE!' : 'WIN!';
  const leftColor = leftIsWinner ? '#00e676' : '#ff1744';
  const rightColor = leftIsWinner ? '#ff1744' : '#00e676';

  const fontSize = Math.round(w * 0.1);
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 10;

  ctx.fillStyle = leftColor;
  ctx.fillText(leftText, mid / 2, h / 2);
  ctx.fillStyle = rightColor;
  ctx.fillText(rightText, mid + mid / 2, h / 2);

  ctx.shadowBlur = 0;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

window.startMeasure = async function() {
  if (!modelsReady || measuring) return;
  measuring = true;
  btn.disabled = true;
  document.getElementById('result-banner').style.display = 'none';
  document.getElementById('sc-val1').textContent = '—';
  document.getElementById('sc-val2').textContent = '—';
  document.getElementById('sc-bar1').style.width = '0%';
  document.getElementById('sc-bar2').style.width = '0%';

  const cdOverlay = document.getElementById('cdown-overlay');
  const cnum = document.getElementById('cdown-num');
  cdOverlay.style.display = 'flex';
  for (let i = 3; i >= 1; i--) { cnum.textContent = i; await sleep(1000); }
  cnum.textContent = '';
  status.textContent = 'A analisar...';

  const scores = { left: [], right: [] };
  const details = { left: { happy: [] }, right: { happy: [] } };

  for (let s = 0; s < 15; s++) {
    await sleep(140);
    try {
      const dets = await faceapi
        .detectAllFaces(vid, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.4 }))
        .withFaceLandmarks(true)
        .withFaceExpressions();
      const midX = vid.videoWidth / 2;
      dets.forEach(d => {
        const cx = d.detection.box.x + d.detection.box.width / 2;
        const mirrored = vid.videoWidth - cx;
        const bucket = mirrored < midX ? 'left' : 'right';
        scores[bucket].push(calcScore(d.expressions, d.landmarks));
        details[bucket].happy.push(Math.round((d.expressions.happy || 0) * 100));
      });
    } catch(_) {}
  }

  cdOverlay.style.display = 'none';

  const avg = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : null;
  const s1 = avg(scores.left), s2 = avg(scores.right);
  const v1 = s1 ?? 0, v2 = s2 ?? 0;

  document.getElementById('sc-val1').textContent = s1 !== null ? v1 + '%' : 'N/D';
  document.getElementById('sc-val2').textContent = s2 !== null ? v2 + '%' : 'N/D';
  document.getElementById('sc-bar1').style.width = v1 + '%';
  document.getElementById('sc-bar2').style.width = v2 + '%';

  // atualizar pontuação
  if (s1 !== null || s2 !== null) {
    if (Math.abs(v1 - v2) >= 5) {
      if (v1 > v2) points.p1++;
      else points.p2++;
    }
  }

  overlay.width = vid.videoWidth;
  overlay.height = vid.videoHeight;
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  if (s1 !== null || s2 !== null) {
    if (Math.abs(v1 - v2) >= 5) {
      const winnerSide = v1 >= v2 ? 'left' : 'right';
      drawResult(winnerSide);
      await sleep(3000);
    }
  }

  measuring = false;
  btn.disabled = false;
  updateNameLabels();

  const h1 = avg(details.left.happy) ?? 0;
  const h2 = avg(details.right.happy) ?? 0;
  const dr = document.getElementById('detail-row');
  dr.innerHTML = `
    <div class="detail-item"><div class="dlabel">Sorriso ${n1()}</div><div class="dval">${s1!==null?h1+'%':'N/D'}</div></div>
    <div class="detail-item"><div class="dlabel">Sorriso ${n2()}</div><div class="dval">${s2!==null?h2+'%':'N/D'}</div></div>
    <div class="detail-item"><div class="dlabel">Pontos ${n1()}</div><div class="dval">${points.p1}</div></div>
    <div class="detail-item"><div class="dlabel">Pontos ${n2()}</div><div class="dval">${points.p2}</div></div>
  `;

  const banner = document.getElementById('result-banner');
  banner.style.display = 'flex';
  if (s1 === null && s2 === null) {
    document.getElementById('res-winner').textContent = 'Nenhum rosto detetado';
    document.getElementById('res-sub').textContent = 'Aproximem-se mais da câmara.';
  } else if (Math.abs(v1 - v2) < 5) {
    document.getElementById('res-winner').textContent = 'Empate!';
    document.getElementById('res-sub').textContent = 'Os dois são igualmente felizes.';
  } else {
    const winner = v1 > v2 ? n1() : n2();
    const loser = v1 > v2 ? n2() : n1();
    const diff = Math.abs(v1 - v2);
    const msg = diff > 30 ? 'Não há competição — a diferença é enorme.' : diff > 15 ? loser + ' vai ter de treinar o sorriso.' : 'Foi por pouco!';
    document.getElementById('res-winner').textContent = winner + ' é mais feliz!';
    document.getElementById('res-sub').textContent = msg;
  }

  status.textContent = 'Medição concluída! Clica para repetir.';
  liveDetect();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
init();

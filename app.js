// 점심 메뉴 룰렛 애플리케이션 (Lunch Menu Roulette)

const STORAGE_KEY = 'lunch_roulette_menus';

// 색상 팔레트 (다양하고 화사한 파스텔/비비드 색상)
const COLOR_PALETTE = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#82E0AA', 
  '#F1948A', '#85C1E9', '#F8C471', '#73C6B6'
];

// 상태 관리
let menus = [];
let isSpinning = false;
let currentRotation = 0; // 라디안 단위 회전각

// DOM 요소 참조
const canvas = document.getElementById('rouletteCanvas');
const ctx = canvas.getContext('2d');
const spinBtn = document.getElementById('spinBtn');
const menuForm = document.getElementById('menuForm');
const menuInput = document.getElementById('menuInput');
const addBtn = document.getElementById('addBtn');
const menuList = document.getElementById('menuList');
const emptyGuide = document.getElementById('emptyGuide');
const menuCountBadge = document.getElementById('menuCountBadge');
const resultCard = document.getElementById('resultCard');
const resultMenu = document.getElementById('resultMenu');
const inputError = document.getElementById('inputError');
const clearAllBtn = document.getElementById('clearAllBtn');
const roulettePointer = document.querySelector('.roulette-pointer');

// 초기화
function init() {
  loadMenus();
  renderList();
  drawRoulette();
  attachEvents();
}

// 이벤트 등록
function attachEvents() {
  menuForm.addEventListener('submit', handleAddMenu);
  spinBtn.addEventListener('click', startSpin);
  clearAllBtn.addEventListener('click', handleClearAll);

  menuInput.addEventListener('input', () => {
    hideError();
  });
}

// 로컬 스토리지에서 메뉴 불러오기
function loadMenus() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        menus = parsed;
      }
    }
  } catch (e) {
    console.error('localStorage 로드 실패:', e);
    menus = [];
  }
}

// 로컬 스토리지에 메뉴 저장
function saveMenus() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(menus));
  } catch (e) {
    console.error('localStorage 저장 실패:', e);
  }
}

// 에러 표시 및 숨기기
function showError(msg) {
  inputError.textContent = msg;
  inputError.classList.remove('hidden');
}

function hideError() {
  inputError.classList.add('hidden');
  inputError.textContent = '';
}

// 메뉴 추가 핸들러
function handleAddMenu(e) {
  if (e) e.preventDefault();
  if (isSpinning) return;

  const value = menuInput.value.trim();

  if (!value) {
    showError('메뉴 이름을 입력해 주세요.');
    menuInput.focus();
    return;
  }

  if (menus.includes(value)) {
    showError('이미 등록된 메뉴입니다.');
    menuInput.focus();
    return;
  }

  menus.push(value);
  saveMenus();
  menuInput.value = '';
  hideError();

  renderList();
  drawRoulette();
}

// 메뉴 삭제 핸들러
function handleDeleteMenu(index) {
  if (isSpinning) return;
  menus.splice(index, 1);
  saveMenus();
  renderList();
  drawRoulette();
  resultCard.classList.add('hidden');
}

// 전체 삭제 핸들러
function handleClearAll() {
  if (isSpinning) return;
  if (menus.length === 0) return;
  if (!confirm('등록된 모든 메뉴를 삭제하시겠습니까?')) return;

  menus = [];
  saveMenus();
  renderList();
  drawRoulette();
  resultCard.classList.add('hidden');
}

// 메뉴 목록 렌더링
function renderList() {
  menuList.innerHTML = '';
  menuCountBadge.textContent = `${menus.length}개`;

  if (menus.length === 0) {
    emptyGuide.classList.remove('hidden');
    spinBtn.disabled = true;
    spinBtn.textContent = '🎲 메뉴를 1개 이상 추가해 주세요';
    return;
  }

  emptyGuide.classList.add('hidden');
  spinBtn.disabled = isSpinning;
  if (!isSpinning) {
    spinBtn.textContent = '🎲 룰렛 돌리기 (2초)!';
  }

  menus.forEach((menu, index) => {
    const li = document.createElement('li');
    li.className = 'menu-item';

    const color = COLOR_PALETTE[index % COLOR_PALETTE.length];

    li.innerHTML = `
      <div class="menu-item-left">
        <span class="menu-color-dot" style="background-color: ${color}"></span>
        <span class="menu-name" title="${escapeHtml(menu)}">${escapeHtml(menu)}</span>
      </div>
      <button class="btn-delete" title="삭제" type="button" aria-label="${escapeHtml(menu)} 삭제">✕</button>
    `;

    const deleteBtn = li.querySelector('.btn-delete');
    deleteBtn.addEventListener('click', () => handleDeleteMenu(index));

    menuList.appendChild(li);
  });
}

// HTML 이스케이프 유틸리티
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 룰렛 캔버스 그리기
function drawRoulette() {
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = width / 2 - 16;

  ctx.clearRect(0, 0, width, height);

  // 메뉴가 없을 때 안내 룰렛 판
  if (menus.length === 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = '#f1f5f9';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#cbd5e0';
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 18px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('메뉴를 추가해 주세요 🍴', centerX, centerY);
    ctx.restore();
    return;
  }

  const arc = (2 * Math.PI) / menus.length;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(currentRotation);

  // 각 메뉴 슬라이스 그리기
  for (let i = 0; i < menus.length; i++) {
    const angle = i * arc;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, angle, angle + arc);
    ctx.fillStyle = COLOR_PALETTE[i % COLOR_PALETTE.length];
    ctx.fill();

    // 구분선
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // 텍스트 그리기
    ctx.save();
    ctx.rotate(angle + arc / 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 4;

    // 텍스트 자르기 처리 (너무 길 경우)
    let text = menus[i];
    if (text.length > 9) {
      text = text.substring(0, 8) + '…';
    }
    ctx.fillText(text, radius - 24, 0);
    ctx.restore();
  }

  // 외곽 테두리
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, 2 * Math.PI);
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  ctx.restore();

  // 중앙 원형 핀 장식
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, 28, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#e2e8f0';
  ctx.stroke();

  // 중앙 작은 점
  ctx.beginPath();
  ctx.arc(centerX, centerY, 12, 0, 2 * Math.PI);
  ctx.fillStyle = '#ee5253';
  ctx.fill();
  ctx.restore();
}

// 룰렛 돌리기 시작 (정확히 2초간 회전)
function startSpin() {
  if (isSpinning || menus.length === 0) return;

  isSpinning = true;
  spinBtn.disabled = true;
  spinBtn.textContent = '⏳ 회전 중...';
  resultCard.classList.add('hidden');

  // 무작위 당첨 인덱스 결정
  const winnerIndex = Math.floor(Math.random() * menus.length);
  const arc = (2 * Math.PI) / menus.length;

  // 상단 바늘 위치는 12시 방향 (-Math.PI / 2 또는 1.5 * Math.PI)
  // 슬라이스 i의 중앙 각도 = (winnerIndex + 0.5) * arc
  // 캔버스가 currentRotation만큼 회전했을 때 바늘 위치(1.5 * Math.PI)와 일치해야 함:
  // (sliceCenterAngle + finalRotation) % (2 * Math.PI) == 1.5 * Math.PI
  // finalRotation = 1.5 * Math.PI - sliceCenterAngle + (추가 회전수 * 2 * Math.PI)
  const sliceCenter = (winnerIndex + 0.5) * arc;
  const pointerAngle = 1.5 * Math.PI; // 12시 방향

  // 기본 5바퀴 회전(10 * Math.PI) + 각도 보정
  const fullRotations = 6;
  const startRotation = currentRotation % (2 * Math.PI);
  
  // 목표 각도 계산
  let targetRotation = pointerAngle - sliceCenter;
  while (targetRotation < startRotation) {
    targetRotation += 2 * Math.PI;
  }
  targetRotation += fullRotations * 2 * Math.PI;

  const totalDelta = targetRotation - startRotation;
  const duration = 2000; // 정확히 2초 (2000ms)
  const startTime = performance.now();

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // ease-out cubic 곡선 적용 (빠르게 시작해서 부드럽게 감속)
    const easeOut = 1 - Math.pow(1 - progress, 3);

    currentRotation = startRotation + totalDelta * easeOut;
    drawRoulette();

    // 포인터 흔들림 틱 애니메이션
    if (progress < 0.95 && Math.random() < 0.3) {
      roulettePointer.classList.add('tick');
      setTimeout(() => roulettePointer.classList.remove('tick'), 60);
    }

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // 2초 회전 완료
      isSpinning = false;
      spinBtn.disabled = false;
      spinBtn.textContent = '🎲 룰렛 돌리기 (2초)!';

      // 당첨 결과 크게 표시
      const chosenMenu = menus[winnerIndex];
      resultMenu.textContent = chosenMenu;
      resultCard.classList.remove('hidden');

      // 바늘 복귀
      roulettePointer.classList.remove('tick');
    }
  }

  requestAnimationFrame(animate);
}

// 애플리케이션 시작
window.addEventListener('DOMContentLoaded', init);


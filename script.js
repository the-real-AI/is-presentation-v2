/**
 * ПРОЕКТИРОВАНИЕ ИНФОРМАЦИОННЫХ СИСТЕМ
 * Презентационный движок, оптимизированный для сенсорных интерактивных досок (Smartboard)
 * Поддержка: мультитач, свайпы, лазерная указка/маркер, мгновенный отклик на касания
 */

const Presentation = (() => {
  // State
  let currentSlide = 1;
  const totalSlides = 26;
  let soundEnabled = true;
  let timerSeconds = 0;
  let timerInterval = null;
  let isFullscreen = false;
  let laserMode = false;

  // DOM Elements
  const slides = document.querySelectorAll('.slide');
  const counterCurrent = document.getElementById('counter-current');
  const topicTitle = document.getElementById('current-slide-topic');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const dockDotsContainer = document.getElementById('dock-dots-container');
  const timerBadge = document.getElementById('presentation-timer');
  const btnSound = document.getElementById('btn-sound');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const btnLaser = document.getElementById('btn-laser');

  // Smartboard Side Touch Buttons
  const sbNavPrev = document.getElementById('sb-nav-prev');
  const sbNavNext = document.getElementById('sb-nav-next');

  // Modals
  const modalOverview = document.getElementById('modal-overview');
  const modalVideo = document.getElementById('modal-video');
  const modalDeploy = document.getElementById('modal-deploy');
  const modalHelp = document.getElementById('modal-help');
  const thumbnailGrid = document.getElementById('thumbnail-grid');

  // Audio Context (Synthesized sounds)
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
  }

  function playTone(freq, type = 'sine', duration = 0.08, gainVal = 0.05) {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio not permitted or unsupported
    }
  }

  function playSlideSound() {
    const baseFreq = 480 + (currentSlide * 10);
    playTone(baseFreq, 'sine', 0.05, 0.035);
    setTimeout(() => playTone(baseFreq + 160, 'sine', 0.07, 0.03), 35);
  }

  function playSuccessSound() {
    playTone(523.25, 'triangle', 0.1, 0.05); // C5
    setTimeout(() => playTone(659.25, 'triangle', 0.1, 0.05), 80); // E5
    setTimeout(() => playTone(783.99, 'triangle', 0.16, 0.05), 160); // G5
  }

  // Timer functionality
  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timerSeconds++;
      const mins = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
      const secs = String(timerSeconds % 60).padStart(2, '0');
      if (timerBadge) timerBadge.textContent = `${mins}:${secs}`;
    }, 1000);
  }

  // Populate Dock Dots (1 to 26) with large touch targets
  function initDockDots() {
    if (!dockDotsContainer) return;
    dockDotsContainer.innerHTML = '';
    for (let i = 1; i <= totalSlides; i++) {
      const dot = document.createElement('button');
      dot.className = `dock-dot ${i === 1 ? 'active' : ''}`;
      dot.setAttribute('data-target-slide', i);
      dot.setAttribute('title', `Слайд ${i}`);
      dot.textContent = i;
      
      // Fast touch trigger without delay
      dot.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        goToSlide(i);
      });
      dockDotsContainer.appendChild(dot);
    }
  }

  // Populate Overview Thumbnail Grid
  function initThumbnailGrid() {
    if (!thumbnailGrid) return;
    thumbnailGrid.innerHTML = '';
    slides.forEach((slide) => {
      const num = parseInt(slide.getAttribute('data-slide'), 10);
      const topic = slide.getAttribute('data-topic') || `Слайд ${num}`;

      const card = document.createElement('div');
      card.className = `thumb-card ${num === currentSlide ? 'active' : ''}`;
      card.innerHTML = `
        <div class="thumb-num">СЛАЙД ${String(num).padStart(2, '0')}</div>
        <div class="thumb-title">${topic}</div>
      `;
      card.addEventListener('pointerdown', () => {
        goToSlide(num);
        toggleOverviewModal(false);
      });
      thumbnailGrid.appendChild(card);
    });
  }

  // Animated Numbers Counter for Active Slide
  function triggerNumberCounters(slideEl) {
    if (!slideEl) return;
    const counters = slideEl.querySelectorAll('.stat-val, .res-item strong');
    counters.forEach(counter => {
      const originalText = counter.getAttribute('data-original-val') || counter.textContent.trim();
      if (!counter.hasAttribute('data-original-val')) {
        counter.setAttribute('data-original-val', originalText);
      }

      const match = originalText.match(/^([<>]?\s*)?(\d+([.,]\d+)?)(.*)$/);
      if (match) {
        const prefix = match[1] || '';
        const targetNum = parseFloat(match[2].replace(',', '.'));
        const suffix = match[4] || '';

        if (!isNaN(targetNum) && targetNum > 0) {
          let current = 0;
          const duration = 600;
          const steps = 20;
          const increment = targetNum / steps;
          const stepTime = duration / steps;

          const timer = setInterval(() => {
            current += increment;
            if (current >= targetNum) {
              counter.textContent = originalText;
              clearInterval(timer);
            } else {
              const displayVal = Number.isInteger(targetNum) 
                ? Math.floor(current) 
                : current.toFixed(2);
              counter.textContent = `${prefix}${displayVal}${suffix}`;
            }
          }, stepTime);
        }
      }
    });
  }

  // Confetti Animation for Slide 26
  let confettiParticles = [];
  let confettiAnimFrame = null;

  function launchConfetti() {
    const canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    confettiParticles = [];
    const colors = ['#00f2fe', '#4facfe', '#10b981', '#f59e0b', '#f43f5e', '#a855f7'];

    for (let i = 0; i < 90; i++) {
      confettiParticles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height * 0.7,
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 14 - 6,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        opacity: 1
      });
    }

    function animateConfetti() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      confettiParticles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.45;
        p.rotation += p.rotSpeed;
        p.opacity -= 0.009;

        if (p.opacity > 0 && p.y < canvas.height + 20) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
      });

      if (alive) {
        confettiAnimFrame = requestAnimationFrame(animateConfetti);
      } else {
        if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    }

    animateConfetti();
  }

  // Go to slide
  function goToSlide(targetSlide) {
    if (targetSlide < 1 || targetSlide > totalSlides) return;
    if (targetSlide === currentSlide) return;

    const prevSlideEl = document.querySelector(`.slide[data-slide="${currentSlide}"]`);
    const nextSlideEl = document.querySelector(`.slide[data-slide="${targetSlide}"]`);

    if (prevSlideEl) {
      prevSlideEl.classList.remove('active');
      if (targetSlide > currentSlide) {
        prevSlideEl.classList.add('slide-prev');
      } else {
        prevSlideEl.classList.remove('slide-prev');
      }
    }

    if (nextSlideEl) {
      nextSlideEl.classList.remove('slide-prev');
      nextSlideEl.classList.add('active');
      triggerNumberCounters(nextSlideEl);
    }

    currentSlide = targetSlide;
    playSlideSound();
    updateUI();

    if (currentSlide === 26) {
      playSuccessSound();
      launchConfetti();
    }
  }

  function nextSlide() {
    if (currentSlide < totalSlides) {
      goToSlide(currentSlide + 1);
    } else {
      playSuccessSound();
    }
  }

  function prevSlide() {
    if (currentSlide > 1) {
      goToSlide(currentSlide - 1);
    }
  }

  // Update Top Bar & Dock UI
  function updateUI() {
    if (counterCurrent) {
      counterCurrent.textContent = String(currentSlide).padStart(2, '0');
      counterCurrent.style.transform = 'scale(1.25)';
      setTimeout(() => { counterCurrent.style.transform = 'scale(1)'; }, 200);
    }

    const activeSlide = document.querySelector(`.slide[data-slide="${currentSlide}"]`);
    if (activeSlide && topicTitle) {
      topicTitle.textContent = activeSlide.getAttribute('data-topic') || '';
    }

    if (progressBarFill) {
      const pct = (currentSlide / totalSlides) * 100;
      progressBarFill.style.width = `${pct}%`;
    }

    const dots = document.querySelectorAll('.dock-dot');
    dots.forEach((dot, idx) => {
      const slideNum = idx + 1;
      dot.classList.remove('active');
      if (slideNum === currentSlide) {
        dot.classList.add('active');
        dot.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else if (slideNum < currentSlide) {
        dot.classList.add('visited');
      }
    });

    const thumbs = document.querySelectorAll('.thumb-card');
    thumbs.forEach((thumb, idx) => {
      thumb.classList.toggle('active', idx + 1 === currentSlide);
    });
  }

  // Modals management
  function closeAllModals() {
    [modalOverview, modalVideo, modalDeploy, modalHelp].forEach(m => {
      if (m) m.classList.remove('open');
    });
  }

  function toggleOverviewModal(forceState) {
    const isOpen = modalOverview.classList.contains('open');
    const newState = forceState !== undefined ? forceState : !isOpen;
    closeAllModals();
    if (newState) {
      initThumbnailGrid();
      modalOverview.classList.add('open');
    }
  }

  function toggleVideoModal(forceState) {
    const isOpen = modalVideo.classList.contains('open');
    const newState = forceState !== undefined ? forceState : !isOpen;
    closeAllModals();
    if (newState) modalVideo.classList.add('open');
  }

  function toggleDeployModal(forceState) {
    const isOpen = modalDeploy.classList.contains('open');
    const newState = forceState !== undefined ? forceState : !isOpen;
    closeAllModals();
    if (newState) modalDeploy.classList.add('open');
  }

  function toggleHelpModal(forceState) {
    const isOpen = modalHelp.classList.contains('open');
    const newState = forceState !== undefined ? forceState : !isOpen;
    closeAllModals();
    if (newState) modalHelp.classList.add('open');
  }

  // Fullscreen
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        isFullscreen = true;
        if (btnFullscreen) btnFullscreen.innerHTML = '<i class="fa-solid fa-compress"></i>';
      }).catch(err => console.log(err));
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => {
          isFullscreen = false;
          if (btnFullscreen) btnFullscreen.innerHTML = '<i class="fa-solid fa-expand"></i>';
        });
      }
    }
  }

  // Sound toggle
  function toggleSound() {
    soundEnabled = !soundEnabled;
    if (btnSound) {
      btnSound.innerHTML = soundEnabled 
        ? '<i class="fa-solid fa-volume-high"></i>' 
        : '<i class="fa-solid fa-volume-xmark"></i>';
    }
    if (soundEnabled) playSuccessSound();
  }

  // Laser Pointer / Touch Pen Mode for Interactive Whiteboard
  function toggleLaserMode() {
    laserMode = !laserMode;
    if (btnLaser) {
      btnLaser.classList.toggle('active-tool', laserMode);
    }
    playTone(laserMode ? 880 : 440, 'triangle', 0.1, 0.05);
  }

  let laserTrail = [];
  function initLaserPointer() {
    const canvas = document.getElementById('laser-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    });

    function addLaserPoint(x, y) {
      laserTrail.push({
        x,
        y,
        life: 1.0,
        radius: 8
      });
    }

    // Touch / Pointer drawing on whiteboard
    window.addEventListener('pointermove', (e) => {
      if (laserMode && e.buttons > 0) {
        addLaserPoint(e.clientX, e.clientY);
      }
    });

    window.addEventListener('pointerdown', (e) => {
      if (laserMode) {
        addLaserPoint(e.clientX, e.clientY);
      }
    });

    function renderLaser() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (laserTrail.length > 0) {
        for (let i = laserTrail.length - 1; i >= 0; i--) {
          const pt = laserTrail[i];
          pt.life -= 0.025; // fade over ~1 sec

          if (pt.life <= 0) {
            laserTrail.splice(i, 1);
          } else {
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00f2fe';
            ctx.fillStyle = `rgba(0, 242, 254, ${pt.life})`;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.radius * pt.life, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      }

      requestAnimationFrame(renderLaser);
    }

    renderLaser();
  }

  // Keyboard navigation
  function setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          nextSlide();
          break;

        case 'ArrowLeft':
        case 'PageUp':
        case 'Backspace':
          e.preventDefault();
          prevSlide();
          break;

        case 'Home':
          e.preventDefault();
          goToSlide(1);
          break;

        case 'End':
          e.preventDefault();
          goToSlide(totalSlides);
          break;

        case 'f':
        case 'F':
        case 'а':
        case 'А':
          toggleFullscreen();
          break;

        case 'o':
        case 'O':
        case 'щ':
        case 'Щ':
          toggleOverviewModal();
          break;

        case 'm':
        case 'M':
        case 'ь':
        case 'Ь':
          toggleSound();
          break;

        case 'l':
        case 'L':
        case 'д':
        case 'Д':
          toggleLaserMode();
          break;

        case '?':
          toggleHelpModal();
          break;

        case 'Escape':
          closeAllModals();
          break;
      }
    });
  }

  // Smartboard Touch Gestures (Swipe & Edge Taps)
  function setupSmartboardTouch() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    const minSwipeDistance = 50;

    window.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
      }
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      if (e.changedTouches.length === 1) {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;
        const elapsed = Date.now() - touchStartTime;

        // Check horizontal swipe
        if (Math.abs(diffX) > minSwipeDistance && Math.abs(diffX) > Math.abs(diffY) * 1.5 && elapsed < 600) {
          if (diffX < 0) nextSlide(); // Swipe Left -> Next
          else prevSlide(); // Swipe Right -> Prev
        }
      }
    }, { passive: true });
  }

  // Interactive Background Canvas with Shockwaves
  let shockwaves = [];

  function initCanvasAnimation() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    window.addEventListener('pointerdown', (e) => {
      shockwaves.push({
        x: e.clientX,
        y: e.clientY,
        radius: 6,
        maxRadius: 110,
        opacity: 0.65
      });
    });

    const particles = [];
    const count = Math.min(Math.floor((width * height) / 14000), 75);

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        radius: Math.random() * 2 + 1,
        color: Math.random() > 0.4 ? 'rgba(0, 242, 254, ' : 'rgba(99, 102, 241, '
      });
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);

      // Draw shockwaves
      for (let s = shockwaves.length - 1; s >= 0; s--) {
        const sw = shockwaves[s];
        sw.radius += 4;
        sw.opacity -= 0.022;

        if (sw.opacity <= 0 || sw.radius >= sw.maxRadius) {
          shockwaves.splice(s, 1);
        } else {
          ctx.strokeStyle = `rgba(0, 242, 254, ${sw.opacity})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 135) {
            const alpha = (1 - dist / 135) * 0.18;
            ctx.strokeStyle = `rgba(0, 242, 254, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.fillStyle = p.color + '0.7)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      requestAnimationFrame(animate);
    }

    animate();
  }

  // Interactive Widgets (Failover simulation & API click)
  function initInteractiveWidgets() {
    const failedNode = document.querySelector('.node-ha-box.failed');
    if (failedNode) {
      failedNode.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (failedNode.classList.contains('failed')) {
          failedNode.classList.remove('failed');
          failedNode.classList.add('healthy');
          failedNode.querySelector('strong').textContent = 'Node 02';
          failedNode.querySelector('small').textContent = 'RECOVERED (33%)';
          failedNode.querySelector('i').className = 'fa-solid fa-circle-check';
          playSuccessSound();
        } else {
          failedNode.classList.remove('healthy');
          failedNode.classList.add('failed');
          failedNode.querySelector('strong').textContent = 'Node 02';
          failedNode.querySelector('small').textContent = 'CRASHED (0%)';
          failedNode.querySelector('i').className = 'fa-solid fa-circle-xmark';
          playTone(280, 'sawtooth', 0.15, 0.05);
        }
      });
    }

    const swaggerHeader = document.querySelector('.swagger-header-bar');
    if (swaggerHeader) {
      swaggerHeader.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const bodyCode = document.querySelector('.swagger-body-code');
        if (bodyCode) {
          bodyCode.style.transition = 'background 0.3s ease';
          bodyCode.style.background = 'rgba(16, 185, 129, 0.2)';
          playTone(660, 'sine', 0.08, 0.04);
          setTimeout(() => {
            bodyCode.style.background = '#090e17';
          }, 400);
        }
      });
    }
  }

  // Setup Event Listeners
  function initListeners() {
    // Dock Buttons
    const btnPrev = document.getElementById('dock-btn-prev');
    const btnNext = document.getElementById('dock-btn-next');
    if (btnPrev) btnPrev.addEventListener('pointerdown', (e) => { e.preventDefault(); prevSlide(); });
    if (btnNext) btnNext.addEventListener('pointerdown', (e) => { e.preventDefault(); nextSlide(); });

    // Floating Smartboard Side Touch Buttons
    if (sbNavPrev) sbNavPrev.addEventListener('pointerdown', (e) => { e.preventDefault(); prevSlide(); });
    if (sbNavNext) sbNavNext.addEventListener('pointerdown', (e) => { e.preventDefault(); nextSlide(); });

    // Header buttons
    if (btnSound) btnSound.addEventListener('pointerdown', toggleSound);
    if (btnFullscreen) btnFullscreen.addEventListener('pointerdown', toggleFullscreen);
    if (btnLaser) btnLaser.addEventListener('pointerdown', toggleLaserMode);

    const btnOverview = document.getElementById('btn-overview');
    if (btnOverview) btnOverview.addEventListener('pointerdown', () => toggleOverviewModal());

    const btnVideo = document.getElementById('btn-video');
    if (btnVideo) btnVideo.addEventListener('pointerdown', () => toggleVideoModal());

    const btnHelp = document.getElementById('btn-help');
    if (btnHelp) btnHelp.addEventListener('pointerdown', () => toggleHelpModal());

    const btnDeploy = document.getElementById('btn-deploy');
    if (btnDeploy) btnDeploy.addEventListener('pointerdown', () => toggleDeployModal());

    // Close modals on touch outside
    [modalOverview, modalVideo, modalDeploy, modalHelp].forEach(m => {
      if (m) {
        m.addEventListener('pointerdown', (e) => {
          if (e.target === m) closeAllModals();
        });
      }
    });
  }

  // Initialize
  function init() {
    initDockDots();
    initThumbnailGrid();
    setupKeyboard();
    setupSmartboardTouch();
    initListeners();
    initCanvasAnimation();
    initLaserPointer();
    initInteractiveWidgets();
    startTimer();
    updateUI();
  }

  return {
    init,
    goToSlide,
    nextSlide,
    prevSlide,
    toggleOverviewModal,
    toggleVideoModal,
    toggleDeployModal,
    openDeployModal: () => toggleDeployModal(true),
    toggleHelpModal,
    toggleLaserMode,
    getCurrentSlide: () => currentSlide
  };
})();

// ============================================================================
// SINGLE PAGE APPLICATION (SPA) ROUTER & MULTIPLATFORM MANAGER
// ============================================================================
const SpaRouter = (() => {
  let currentView = 'presentation';
  const views = ['presentation', 'database', 'api-console', 'profile'];

  const navTabs = document.querySelectorAll('.spa-nav-tab');
  const drawerNavItems = document.querySelectorAll('.drawer-nav-item');
  const mobileDrawer = document.getElementById('mobile-drawer');
  const mobileDrawerOverlay = document.getElementById('mobile-drawer-overlay');
  const topicTitle = document.getElementById('current-slide-topic');
  const counterWrapper = document.getElementById('slide-counter-wrapper');

  function navigate(viewId) {
    if (!views.includes(viewId)) viewId = 'presentation';
    currentView = viewId;

    // Toggle View DOM Containers
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) {
        if (v === viewId) {
          el.style.display = 'block';
          el.classList.add('active');
        } else {
          el.style.display = 'none';
          el.classList.remove('active');
        }
      }
    });

    // Toggle Navigation Tabs in Header
    navTabs.forEach(tab => {
      if (tab.dataset.view === viewId) tab.classList.add('active');
      else tab.classList.remove('active');
    });

    // Toggle Navigation Items in Mobile Drawer
    drawerNavItems.forEach(item => {
      if (item.dataset.view === viewId) item.classList.add('active');
      else item.classList.remove('active');
    });

    // Update Header Topic / Counter Context
    if (viewId === 'presentation') {
      if (counterWrapper) counterWrapper.style.display = 'inline-flex';
      if (topicTitle) {
        const slide = document.querySelector(`.slide[data-slide="${Presentation.getCurrentSlide()}"]`);
        topicTitle.textContent = slide ? slide.dataset.topic : 'Титульный лист';
      }
    } else {
      if (counterWrapper) counterWrapper.style.display = 'none';
      if (topicTitle) {
        if (viewId === 'database') topicTitle.textContent = 'База данных ИС (SQLite)';
        else if (viewId === 'api-console') topicTitle.textContent = 'API & X-API-Key Консоль';
        else if (viewId === 'profile') topicTitle.textContent = 'JWT Аутентификация';
      }
    }

    // Scroll to top of view
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Close Mobile Drawer if open
    closeMobileMenu();

    // Trigger view-specific loads
    if (viewId === 'database') DatabaseModule.loadSystems();
    if (viewId === 'api-console') ApiConsoleModule.updateCurlPreview();
    if (viewId === 'profile') AuthModule.renderProfileView();

    // Update URL Hash without reload
    window.location.hash = viewId;
  }

  function openMobileMenu() {
    if (mobileDrawer) mobileDrawer.classList.add('active');
    if (mobileDrawerOverlay) mobileDrawerOverlay.classList.add('active');
  }

  function closeMobileMenu() {
    if (mobileDrawer) mobileDrawer.classList.remove('active');
    if (mobileDrawerOverlay) mobileDrawerOverlay.classList.remove('active');
  }

  function detectDevice() {
    const el = document.getElementById('mobile-device-meta');
    if (!el) return;
    const width = window.innerWidth;
    let type = 'Десктоп';
    if (width < 576) type = 'Смартфон';
    else if (width < 992) type = 'Планшет';
    else if (width < 1440) type = 'Ноутбук';
    else type = 'Монитор / Smartboard';
    el.textContent = `${type} (${width}×${window.innerHeight}px)`;
  }

  function init() {
    // Nav Tab clicks
    navTabs.forEach(tab => {
      tab.addEventListener('click', () => navigate(tab.dataset.view));
    });

    // Mobile Hamburger button
    const btnMobileMenu = document.getElementById('btn-mobile-menu');
    if (btnMobileMenu) {
      btnMobileMenu.addEventListener('click', openMobileMenu);
    }

    // Hash change handler
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (views.includes(hash)) navigate(hash);
    });

    // Check initial hash
    const initialHash = window.location.hash.replace('#', '');
    if (views.includes(initialHash)) {
      navigate(initialHash);
    }

    window.addEventListener('resize', detectDevice);
    detectDevice();
  }

  return {
    init,
    navigate,
    openMobileMenu,
    closeMobileMenu,
    getCurrentView: () => currentView
  };
})();

// ============================================================================
// GOOGLE FIREBASE CONFIGURATION & INITIALIZATION (SECURE RUNTIME INJECTION)
// ============================================================================
let FIREBASE_CONFIG = {
  apiKey: localStorage.getItem('fb_client_api_key') || "",
  authDomain: localStorage.getItem('fb_client_auth_domain') || "",
  projectId: localStorage.getItem('fb_client_project_id') || "",
  storageBucket: "",
  messagingSenderId: "1049003748352",
  appId: "1:1049003748352:web:298544740ecb6dcffa3ce5",
  measurementId: "G-B57J3DP04C"
};

let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;

async function initFirebase() {
  // 1. Безопасное получение публичной конфигурации из Netlify Function
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const cfg = await res.json();
      if (cfg && cfg.apiKey) {
        FIREBASE_CONFIG = Object.assign(FIREBASE_CONFIG, cfg);
        localStorage.setItem('fb_client_api_key', cfg.apiKey);
        localStorage.setItem('fb_client_project_id', cfg.projectId);
      }
    }
  } catch (netErr) {}

  if (typeof firebase !== 'undefined' && FIREBASE_CONFIG.apiKey) {
    try {
      if (!firebase.apps.length) {
        firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
      } else {
        firebaseApp = firebase.app();
      }
      firebaseAuth = firebase.auth();
      firebaseDb = firebase.firestore();
      if (firebase.analytics) {
        try { firebase.analytics(); } catch (e) {}
      }
      console.log('✅ Google Firebase v10 подключен:', FIREBASE_CONFIG.projectId);
    } catch (err) {
      console.warn('⚠️ Firebase init warning:', err);
    }
  }
}

// ============================================================================
// JWT АУТЕНТИФИКАЦИЯ И МЕНЕДЖЕР ПРОФИЛЯ (RFC 7519 + GOOGLE FIREBASE)
// ============================================================================
const AuthModule = (() => {
  const STORAGE_TOKEN_KEY = 'is_jwt_token';
  const STORAGE_KEY_API = 'is_x_api_key';
  const API_BASE = window.location.origin.includes('http') ? window.location.origin : '';

  let currentToken = localStorage.getItem(STORAGE_TOKEN_KEY) || null;
  let currentUser = null;
  let currentApiKey = localStorage.getItem(STORAGE_KEY_API) || 'xak_live_master_9948201';

  // Безопасное декодирование JWT (RFC 7519)
  function parseJwt(token) {
    try {
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }

  function getRawParts(token) {
    if (!token) return { header: '', payload: '', sig: '' };
    const parts = token.split('.');
    return {
      header: parts[0] || '',
      payload: parts[1] || '',
      sig: parts[2] || ''
    };
  }

  // Обновление плашки авторизации в навигационной панели
  function updateHeaderWidget() {
    const container = document.getElementById('user-auth-widget');
    if (!container) return;

    if (currentToken && currentUser) {
      const initial = (currentUser.username || currentUser.email || 'U').charAt(0).toUpperCase();
      const displayName = currentUser.username || currentUser.email.split('@')[0];
      const roleText = currentUser.role === 'Administrator' ? 'Admin' : 'Arch';

      container.innerHTML = `
        <div class="user-chip" onclick="SpaRouter.navigate('profile')" title="Профиль, Firebase JWT инспектор и X-API-Key">
          <div class="user-chip-avatar">${initial}</div>
          <span class="user-chip-name">${displayName}</span>
          <span class="user-role-tag">${roleText}</span>
        </div>
      `;
    } else {
      container.innerHTML = `
        <button class="btn-login-header" onclick="SpaRouter.navigate('profile')" title="Войти в систему с получением JWT токена">
          <i class="fa-solid fa-right-to-bracket"></i>
          <span>Войти (JWT)</span>
        </button>
      `;
    }
  }

  // Обработка формы входа (Login)
  async function handleLogin(e) {
    e.preventDefault();
    const emailOrUser = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    if (errorEl) errorEl.style.display = 'none';

    try {
      let data = null;

      // 1. Проверка демо-аккаунтов
      if ((emailOrUser === 'admin@system.local' || emailOrUser === 'admin') && password === 'admin123') {
        data = simulateOfflineLogin('admin@system.local', 'admin123');
      } else if ((emailOrUser === 'architect@system.local' || emailOrUser === 'architect') && password === 'pass123') {
        data = simulateOfflineLogin('architect@system.local', 'pass123');
      } else {
        // 2. Попытка входа через Netlify Function или Firebase Auth
        try {
          const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emailOrUsername: emailOrUser, password })
          });
          data = await res.json();
        } catch (netErr) {
          // Если функция недоступна, пробуем напрямую Firebase SDK в браузере
          if (firebaseAuth) {
            const cred = await firebaseAuth.signInWithEmailAndPassword(emailOrUser, password);
            const token = await cred.user.getIdToken();
            data = {
              success: true,
              token: token,
              user: {
                id: cred.user.uid,
                email: cred.user.email,
                username: cred.user.displayName || emailOrUser.split('@')[0],
                role: 'Architect'
              },
              apiKey: 'xak_live_' + cred.user.uid.substring(0, 10)
            };
          } else {
            throw new Error('Сервер недоступен, а Firebase Auth не инициализирован');
          }
        }
      }

      if (data && data.success) {
        currentToken = data.token;
        currentUser = data.user || parseJwt(currentToken);
        currentApiKey = data.apiKey || 'xak_live_' + Math.random().toString(36).substring(2, 10);
        
        localStorage.setItem(STORAGE_TOKEN_KEY, currentToken);
        localStorage.setItem(STORAGE_KEY_API, currentApiKey);

        updateHeaderWidget();
        renderProfileView();
        DatabaseModule.loadSystems();
        Presentation.playSuccessSound();
      } else {
        if (errorEl) {
          errorEl.textContent = (data && data.message) || 'Неверный логин или пароль';
          errorEl.style.display = 'block';
        }
      }
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = 'Ошибка входа: ' + err.message;
        errorEl.style.display = 'block';
      }
    }
  }

  // Обработка регистрации (Register)
  async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const role = document.getElementById('reg-role').value;
    const password = document.getElementById('reg-password').value;
    const errorEl = document.getElementById('reg-error');
    if (errorEl) errorEl.style.display = 'none';

    try {
      let data = null;
      try {
        const res = await fetch(`${API_BASE}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, role, password })
        });
        data = await res.json();
      } catch (networkErr) {
        if (firebaseAuth) {
          const cred = await firebaseAuth.createUserWithEmailAndPassword(email, password);
          await cred.user.updateProfile({ displayName: username });
          const token = await cred.user.getIdToken();
          data = {
            success: true,
            token,
            user: { id: cred.user.uid, email, username, role },
            apiKey: 'xak_live_' + cred.user.uid.substring(0, 10)
          };
        } else {
          data = simulateOfflineRegister(username, email, role);
        }
      }

      if (data && data.success) {
        currentToken = data.token;
        currentUser = data.user || parseJwt(currentToken);
        currentApiKey = data.apiKey || 'xak_live_' + Math.random().toString(36).substring(2, 10);

        localStorage.setItem(STORAGE_TOKEN_KEY, currentToken);
        localStorage.setItem(STORAGE_KEY_API, currentApiKey);

        updateHeaderWidget();
        renderProfileView();
        DatabaseModule.loadSystems();
        Presentation.playSuccessSound();
      } else {
        if (errorEl) {
          errorEl.textContent = (data && data.message) || 'Ошибка регистрации в Firebase';
          errorEl.style.display = 'block';
        }
      }
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
      }
    }
  }

  // Выход из системы
  function logout() {
    currentToken = null;
    currentUser = null;
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    if (firebaseAuth) {
      try { firebaseAuth.signOut(); } catch (e) {}
    }
    updateHeaderWidget();
    renderProfileView();
  }

  function switchTab(tab) {
    const btnLogin = document.getElementById('tab-btn-login');
    const btnReg = document.getElementById('tab-btn-register');
    const formLogin = document.getElementById('form-login');
    const formReg = document.getElementById('form-register');

    if (tab === 'login') {
      if (btnLogin) btnLogin.classList.add('active');
      if (btnReg) btnReg.classList.remove('active');
      if (formLogin) formLogin.style.display = 'block';
      if (formReg) formReg.style.display = 'none';
    } else {
      if (btnLogin) btnLogin.classList.remove('active');
      if (btnReg) btnReg.classList.add('active');
      if (formLogin) formLogin.style.display = 'none';
      if (formReg) formReg.style.display = 'block';
    }
  }

  function fillDemo(email, pass) {
    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-password');
    if (emailInput) emailInput.value = email;
    if (passInput) passInput.value = pass;
    switchTab('login');
  }

  // Отрисовка профиля и инспектора JWT
  function renderProfileView() {
    const unauthBox = document.getElementById('auth-unauth-container');
    const authBox = document.getElementById('auth-profile-container');

    if (currentToken && currentUser) {
      if (unauthBox) unauthBox.style.display = 'none';
      if (authBox) authBox.style.display = 'block';

      // Данные профиля
      const avatarEl = document.getElementById('prof-avatar');
      const userEl = document.getElementById('prof-username');
      const roleEl = document.getElementById('prof-role');
      const emailEl = document.getElementById('prof-email');
      const apiKeyEl = document.getElementById('prof-api-key');

      const name = currentUser.username || currentUser.email.split('@')[0];
      if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
      if (userEl) userEl.textContent = name;
      if (roleEl) roleEl.textContent = currentUser.role || 'Solution Architect';
      if (emailEl) emailEl.textContent = currentUser.email;
      if (apiKeyEl) apiKeyEl.value = currentApiKey;

      // JWT Инспектор (Header, Payload, Signature)
      const parts = getRawParts(currentToken);
      const rawHeaderEl = document.getElementById('jwt-raw-header');
      const rawPayloadEl = document.getElementById('jwt-raw-payload');
      const rawSigEl = document.getElementById('jwt-raw-sig');
      const payloadViewEl = document.getElementById('jwt-payload-view');

      if (rawHeaderEl) rawHeaderEl.textContent = parts.header.substring(0, 18) + '...';
      if (rawPayloadEl) rawPayloadEl.textContent = parts.payload.substring(0, 18) + '...';
      if (rawSigEl) rawSigEl.textContent = parts.sig.substring(0, 14) + '...';

      const decoded = parseJwt(currentToken);
      if (payloadViewEl && decoded) {
        payloadViewEl.textContent = JSON.stringify(decoded, null, 2);
      }
    } else {
      if (unauthBox) unauthBox.style.display = 'block';
      if (authBox) authBox.style.display = 'none';
    }
  }

  async function generateNewApiKey() {
    if (!currentToken) return;
    try {
      let newKey = 'xak_live_' + Math.random().toString(36).substring(2, 10);
      try {
        const res = await fetch(`${API_BASE}/api/keys/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentToken}`
          },
          body: JSON.stringify({ name: `Key (${new Date().toLocaleTimeString()})` })
        });
        const data = await res.json();
        if (data.apiKey) newKey = data.apiKey;
      } catch (e) {}

      currentApiKey = newKey;
      localStorage.setItem(STORAGE_KEY_API, currentApiKey);
      const apiKeyEl = document.getElementById('prof-api-key');
      if (apiKeyEl) apiKeyEl.value = currentApiKey;
      alert(`Сгенерирован новый персональный X-API-Key: ${currentApiKey}`);
    } catch (e) {
      alert('Ошибка при генерации ключа: ' + e.message);
    }
  }

  function copyApiKey() {
    const input = document.getElementById('prof-api-key');
    if (!input) return;
    navigator.clipboard.writeText(input.value).then(() => {
      alert('X-API-Key успешно скопирован в буфер обмена!');
    });
  }

  function simulateOfflineLogin(login, pass) {
    if ((login === 'admin@system.local' || login === 'admin') && pass === 'admin123') {
      const user = { id: 'usr_admin_001', username: 'admin', email: 'admin@system.local', role: 'Administrator' };
      return { success: true, token: createFakeJwt(user), user, apiKey: 'xak_live_master_9948201' };
    }
    if ((login === 'architect@system.local' || login === 'architect') && pass === 'pass123') {
      const user = { id: 'usr_arch_002', username: 'architect', email: 'architect@system.local', role: 'Solution Architect' };
      return { success: true, token: createFakeJwt(user), user, apiKey: 'xak_live_arch_7731902' };
    }
    return { success: false, message: 'Неверные данные. Доступны демо-аккаунты: admin / admin123' };
  }

  function simulateOfflineRegister(username, email, role) {
    const user = { id: 'usr_' + Math.random().toString(36).substring(2, 8), username, email, role };
    return { success: true, token: createFakeJwt(user), user, apiKey: 'xak_live_' + Math.random().toString(36).substring(2, 10) };
  }

  function createFakeJwt(payload) {
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'google-firebase-key-01' })).replace(/=/g, '');
    const now = Math.floor(Date.now() / 1000);
    const body = btoa(JSON.stringify({
      iss: `https://securetoken.google.com/${FIREBASE_CONFIG.projectId}`,
      aud: FIREBASE_CONFIG.projectId,
      auth_time: now,
      sub: payload.id,
      user_id: payload.id,
      email: payload.email,
      role: payload.role,
      username: payload.username,
      iat: now,
      exp: now + 86400
    })).replace(/=/g, '');
    const sig = btoa('mock_firebase_hmac_sha256_signature').replace(/=/g, '');
    return `${header}.${body}.${sig}`;
  }

  function init() {
    initFirebase();
    if (currentToken) {
      currentUser = parseJwt(currentToken);
      if (!currentUser) {
        currentToken = null;
        localStorage.removeItem(STORAGE_TOKEN_KEY);
      }
    } else {
      // Авто-вход под учётной записью администратора для мгновенного интерактивного показа
      const demo = simulateOfflineLogin('admin@system.local', 'admin123');
      currentToken = demo.token;
      currentUser = demo.user;
      currentApiKey = demo.apiKey;
      localStorage.setItem(STORAGE_TOKEN_KEY, currentToken);
      localStorage.setItem(STORAGE_KEY_API, currentApiKey);
    }

    updateHeaderWidget();
    renderProfileView();
  }

  return {
    init,
    handleLogin,
    handleRegister,
    logout,
    switchTab,
    fillDemo,
    renderProfileView,
    generateNewApiKey,
    copyApiKey,
    getToken: () => currentToken,
    getCurrentApiKey: () => currentApiKey,
    getCurrentUser: () => currentUser
  };
})();

// ============================================================================
// БАЗА ДАННЫХ ИС: РЕЕСТР СИСТЕМ (GOOGLE CLOUD FIRESTORE + X-API-KEY)
// ============================================================================
const DatabaseModule = (() => {
  const API_BASE = window.location.origin.includes('http') ? window.location.origin : '';
  let systemsData = [];

  const defaultSystems = [
    { id: 'sys_01', code: 'IS-CORE-BILLING', title: 'Ядро биллинговой системы', architecture_type: 'Microservices', sla_level: '99.99%', status: 'Active', database_tech: 'Google Cloud Firestore + Redis', description: 'Обработка транзакций в реальном времени, event-driven шина.' },
    { id: 'sys_02', code: 'IS-ECOMMERCE-GW', title: 'API Gateway E-Commerce', architecture_type: 'API Gateway', sla_level: '99.95%', status: 'Active', database_tech: 'Firebase Realtime DB', description: 'Входной шлюз для клиентского трафика, верификация JWT токенов.' },
    { id: 'sys_03', code: 'IS-INVENTORY-SRV', title: 'Управление складскими остатками', architecture_type: 'Modular Monolith', sla_level: '99.9%', status: 'Active', database_tech: 'PostgreSQL (Cloud SQL)', description: 'Инвентаризация и распределенный учет партий продукции на складах.' },
    { id: 'sys_04', code: 'IS-ANALYTICS-DWH', title: 'Корпоративное хранилище данных', architecture_type: 'Lambda', sla_level: '99.5%', status: 'Active', database_tech: 'Google BigQuery + Firestore', description: 'Хранилище аналитической отчётности, витрины данных, ETL-пайплайны.' },
    { id: 'sys_05', code: 'IS-CRM-CUSTOMER', title: 'Управление отношениями с клиентами', architecture_type: 'Microservices', sla_level: '99.9%', status: 'Draft', database_tech: 'Cloud Firestore NoSQL', description: 'Омниканальная платформа взаимодействия с клиентами, единый профиль 360.' },
    { id: 'sys_06', code: 'IS-NOTIFICATION-BUS', title: 'Шлюз рассылки уведомлений', architecture_type: 'Event-Driven', sla_level: '99.95%', status: 'Active', database_tech: 'Google Pub/Sub + Redis', description: 'Асинхронная доставка push-уведомлений, SMS и email сообщений.' }
  ];

  async function loadSystems(showToast = false) {
    const key = AuthModule.getCurrentApiKey();
    try {
      const res = await fetch(`${API_BASE}/api/v1/systems`, {
        headers: { 'X-API-Key': key }
      });

      if (res.ok) {
        const json = await res.json();
        systemsData = json.data || [];
        if (showToast) alert(`Успешно загружено ${systemsData.length} систем из Google Firebase Firestore!`);
      } else if (res.status === 401) {
        alert('Ошибка 401 Unauthorized: Не указан или недействителен X-API-Key!');
        systemsData = [];
      } else {
        if (systemsData.length === 0) systemsData = [...defaultSystems];
      }
    } catch (err) {
      if (systemsData.length === 0) systemsData = [...defaultSystems];
      if (showToast) alert(`Автономный режим: загружено ${systemsData.length} записей из локального кэша Firestore.`);
    }

    renderTable(systemsData);
    updateMetrics();
  }

  function renderTable(list) {
    const tbody = document.getElementById('systems-tbody');
    const emptyState = document.getElementById('db-empty-state');
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    tbody.innerHTML = list.map(item => `
      <tr>
        <td><span class="sys-code-badge">${item.code}</span></td>
        <td><strong>${item.title}</strong></td>
        <td><i class="fa-solid fa-layer-group text-cyan"></i> ${item.architecture_type}</td>
        <td><span class="text-green font-mono"><strong>${item.sla_level}</strong></span></td>
        <td><small class="font-mono">${item.database_tech || 'Firestore NoSQL'}</small></td>
        <td>
          <span class="status-chip ${item.status === 'Active' ? 'active' : 'draft'}">
            <i class="fa-solid fa-circle text-xs"></i> ${item.status}
          </span>
        </td>
        <td>
          <button class="btn-copy" onclick="DatabaseModule.deleteSystem('${item.id}')" title="Удалить запись">
            <i class="fa-solid fa-trash text-red"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }

  function filterSystems() {
    const search = (document.getElementById('db-search-input')?.value || '').toLowerCase();
    const arch = document.getElementById('db-filter-arch')?.value || '';

    const filtered = systemsData.filter(s => {
      const matchesSearch = s.code.toLowerCase().includes(search) ||
                            s.title.toLowerCase().includes(search) ||
                            (s.database_tech && s.database_tech.toLowerCase().includes(search));
      const matchesArch = !arch || s.architecture_type.includes(arch);
      return matchesSearch && matchesArch;
    });

    renderTable(filtered);
  }

  function updateMetrics() {
    const totalEl = document.getElementById('db-stat-total');
    const microEl = document.getElementById('db-stat-micro');
    if (totalEl) totalEl.textContent = systemsData.length;
    if (microEl) microEl.textContent = systemsData.filter(s => s.architecture_type.includes('Microservices')).length;
  }

  function openAddModal() {
    const modal = document.getElementById('modal-add-system');
    if (modal) modal.classList.add('active');
  }

  function closeAddModal() {
    const modal = document.getElementById('modal-add-system');
    if (modal) modal.classList.remove('active');
  }

  async function handleAddSubmit(e) {
    e.preventDefault();
    const code = document.getElementById('sys-code').value.trim();
    const title = document.getElementById('sys-title').value.trim();
    const arch = document.getElementById('sys-arch').value;
    const sla = document.getElementById('sys-sla').value;
    const db = document.getElementById('sys-db').value.trim();
    const desc = document.getElementById('sys-desc').value.trim();

    const newSystem = {
      id: 'sys_' + Math.random().toString(36).substring(2, 7),
      code: code.toUpperCase(),
      title,
      architecture_type: arch,
      sla_level: sla,
      status: 'Active',
      database_tech: db || 'Google Cloud Firestore',
      description: desc
    };

    try {
      const key = AuthModule.getCurrentApiKey();
      await fetch(`${API_BASE}/api/v1/systems`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': key
        },
        body: JSON.stringify(newSystem)
      });
    } catch (e) {}

    systemsData.unshift(newSystem);
    renderTable(systemsData);
    updateMetrics();
    closeAddModal();
    Presentation.playSuccessSound();
    alert(`Система «${title}» успешно добавлена в Google Cloud Firestore!`);
  }

  async function deleteSystem(id) {
    if (!confirm('Вы уверены, что хотите удалить эту систему из базы данных Firestore?')) return;
    try {
      const key = AuthModule.getCurrentApiKey();
      await fetch(`${API_BASE}/api/v1/systems/${id}`, {
        method: 'DELETE',
        headers: { 'X-API-Key': key }
      });
    } catch (e) {}

    systemsData = systemsData.filter(s => s.id !== id);
    renderTable(systemsData);
    updateMetrics();
  }

  return {
    loadSystems,
    filterSystems,
    openAddModal,
    closeAddModal,
    handleAddSubmit,
    deleteSystem
  };
})();

// ============================================================================
// API EXPLORER & X-API-KEY CONSOLE MODULE (SWAGGER-LIKE TESTER)
// ============================================================================
const ApiConsoleModule = (() => {
  const API_BASE = window.location.origin.includes('http') ? window.location.origin : '';

  function onMethodChange() {
    const method = document.getElementById('api-method').value;
    const bodyGroup = document.getElementById('api-body-group');
    if (bodyGroup) {
      bodyGroup.style.display = method === 'POST' ? 'block' : 'none';
    }
    updateCurlPreview();
  }

  function onEndpointChange() {
    updateCurlPreview();
  }

  function useMyKey() {
    const input = document.getElementById('api-key-input');
    if (input) {
      input.value = AuthModule.getCurrentApiKey();
      updateCurlPreview();
    }
  }

  function clearKey() {
    const input = document.getElementById('api-key-input');
    if (input) {
      input.value = '';
      updateCurlPreview();
    }
  }

  function updateCurlPreview() {
    const curlEl = document.getElementById('curl-preview');
    if (!curlEl) return;
    const key = document.getElementById('api-key-input')?.value || '';
    const method = document.getElementById('api-method')?.value || 'GET';
    const endpoint = document.getElementById('api-endpoint')?.value || '/api/v1/systems';

    let origin = API_BASE || 'https://your-site.netlify.app';
    let cmd = `curl -X ${method} "${origin}${endpoint}"`;
    if (key) cmd += ` \\\n  -H "X-API-Key: ${key}"`;
    if (method === 'POST') cmd += ` \\\n  -H "Content-Type: application/json" -d '{"code":"IS-TEST","title":"Новая ИС"}'`;

    curlEl.textContent = cmd;
  }

  async function sendRequest() {
    const key = (document.getElementById('api-key-input')?.value || '').trim();
    const method = document.getElementById('api-method')?.value || 'GET';
    const endpoint = document.getElementById('api-endpoint')?.value || '/api/v1/systems';
    const bodyStr = document.getElementById('api-body-input')?.value || '{}';

    const statusBadge = document.getElementById('response-status-badge');
    const responseMeta = document.getElementById('response-meta');
    const resTimeEl = document.getElementById('res-time');
    const jsonOutput = document.getElementById('json-response');

    if (jsonOutput) jsonOutput.textContent = '// Выполняю запрос к Netlify + Firebase API...';

    const t0 = performance.now();
    let status = 0;
    let resultJson = null;

    try {
      const headers = {};
      if (key) headers['X-API-Key'] = key;
      if (method === 'POST') headers['Content-Type'] = 'application/json';

      const options = { method, headers };
      if (method === 'POST') options.body = bodyStr;

      const res = await fetch(`${API_BASE}${endpoint}`, options);
      status = res.status;
      resultJson = await res.json();
    } catch (networkError) {
      // Offline fallback: эмуляция проверки X-API-Key
      if (!key) {
        status = 401;
        resultJson = {
          success: false,
          error: "Unauthorized: Missing or Invalid X-API-Key",
          message: "Доступ закрыт! Требуется действующий заголовок X-API-Key.",
          hint: "Нажмите кнопку «Подставить мой ключ» или передайте заголовок 'X-API-Key: xak_live_master_9948201'",
          timestamp: new Date().toISOString()
        };
      } else {
        status = 200;
        resultJson = {
          success: true,
          source: "Google Cloud Firestore (Emulated Engine)",
          project_id: FIREBASE_CONFIG.projectId,
          authenticated_key: key,
          endpoint: endpoint,
          data: [
            { id: "sys_01", code: "IS-CORE-BILLING", title: "Ядро биллинговой системы", sla_level: "99.99%", database_tech: "Firestore + Redis" },
            { id: "sys_02", code: "IS-ECOMMERCE-GW", title: "API Gateway E-Commerce", sla_level: "99.95%", database_tech: "Firebase Realtime DB" }
          ]
        };
      }
    }

    const t1 = performance.now();
    const latency = Math.round(t1 - t0);

    // Обновление статуса
    if (statusBadge) {
      statusBadge.className = 'response-status-badge';
      if (status >= 200 && status < 300) {
        statusBadge.classList.add('status-200');
        statusBadge.innerHTML = `<span class="status-code">HTTP ${status} OK</span> <span class="status-text">Доступ разрешён (X-API-Key валиден)</span>`;
        Presentation.playSuccessSound();
      } else if (status === 401 || status === 403) {
        statusBadge.classList.add('status-401');
        statusBadge.innerHTML = `<span class="status-code">HTTP ${status} Unauthorized</span> <span class="status-text">Защищено X-API-Key</span>`;
      } else {
        statusBadge.innerHTML = `<span class="status-code">HTTP ${status}</span> <span class="status-text">Ошибка</span>`;
      }
    }

    if (responseMeta) responseMeta.style.display = 'flex';
    if (resTimeEl) resTimeEl.textContent = `${latency} ms`;

    if (jsonOutput) {
      jsonOutput.textContent = JSON.stringify(resultJson, null, 2);
    }
  }

  function copyCurl() {
    const code = document.getElementById('curl-preview')?.textContent || '';
    navigator.clipboard.writeText(code).then(() => {
      alert('Команда cURL скопирована в буфер обмена!');
    });
  }

  return {
    onMethodChange,
    onEndpointChange,
    useMyKey,
    clearKey,
    updateCurlPreview,
    sendRequest,
    copyCurl
  };
})();

// Boot on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  Presentation.init();
  SpaRouter.init();
  AuthModule.init();
  DatabaseModule.loadSystems();
});

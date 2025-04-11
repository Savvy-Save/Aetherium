(function() {
  let canvas = null;
  let ctx = null;
  let dots = [];
  const colors = [
    '#a259ff', '#c77dff', '#9d4edd', '#7b2ff7', '#8e44ad',
    '#6c5ce7', '#b388eb', '#be8abf', '#d291bc', '#a29bfe'
  ];
  const numDots = 175; // number of dots
  const maxDistance = 175; // max connection distance
  const maxAlpha = 2; // max line opacity

  function initDots() {
    dots = [];
    const cols = Math.ceil(Math.sqrt(numDots));
    const rows = Math.ceil(numDots / cols);
    const cellWidth = canvas.width / cols;
    const cellHeight = canvas.height / rows;
    const jitterFactor = 0.9; // increase randomness

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (dots.length >= numDots) break;
        const x = col * cellWidth + cellWidth / 2 + (Math.random() - 0.5) * cellWidth * jitterFactor;
        const y = row * cellHeight + cellHeight / 2 + (Math.random() - 0.5) * cellHeight * jitterFactor;
        dots.push({
          x: Math.max(0, Math.min(canvas.width, x)),
          y: Math.max(0, Math.min(canvas.height, y)),
          size: Math.random() * 2 + 2, // smaller dots (2-4px)
          color: colors[Math.floor(Math.random() * colors.length)],
          vx: (Math.random() - 0.5) * 0.3, // gentle horizontal velocity
          vy: (Math.random() - 0.5) * 0.3  // gentle vertical velocity
        });
      }
    }
  }

  function drawDots() {
    dots.forEach(dot => {
      ctx.fillStyle = dot.color;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  let mouse = null; // store last mouse position

  function animate() {
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // update dot positions
    dots.forEach(dot => {
      dot.x += dot.vx;
      dot.y += dot.vy;

      // bounce off edges
      if (dot.x <= 0 || dot.x >= canvas.width) dot.vx *= -1;
      if (dot.y <= 0 || dot.y >= canvas.height) dot.vy *= -1;
    });

    drawDots();

    if (mouse) {
      dots.forEach(dot => {
        const dx = mouse.x - dot.x;
        const dy = mouse.y - dot.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < maxDistance) {
          const alpha = maxAlpha * (1 - distance / maxDistance);
          if (alpha <= 0) return;
          const hex = dot.color.replace('#', '');
          const bigint = parseInt(hex, 16);
          const r = (bigint >> 16) & 255;
          const g = (bigint >> 8) & 255;
          const b = bigint & 255;
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.moveTo(dot.x, dot.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      });
    }

    requestAnimationFrame(animate);
  }

  function clearAndRedraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawDots();
  }

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initDots();
    drawDots();
  }

  function enableSpiderCursor() {
    if (canvas) return; // already enabled
    canvas = document.createElement('canvas');
    canvas.id = 'spider-canvas';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');

    resizeCanvas();

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseout', clearAndRedraw);

    requestAnimationFrame(animate);
  }

  function disableSpiderCursor() {
    if (!canvas) return;
    window.removeEventListener('resize', resizeCanvas);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseout', clearAndRedraw);
    canvas.remove();
    canvas = null;
    ctx = null;
    dots = [];
  }

  function onMouseMove(event) {
    if (!canvas || !ctx) return;
    mouse = { x: event.clientX, y: event.clientY };
  }

  function isWelcomePageVisible() {
    const welcomeSections = document.querySelectorAll('[data-page="welcome"]');
    return Array.from(welcomeSections).some(
      el => el.offsetParent !== null && getComputedStyle(el).display !== 'none' && !el.classList.contains('hidden')
    );
  }

  // Observe DOM changes to toggle spider cursor
  const observer = new MutationObserver(() => {
    if (isWelcomePageVisible()) {
      enableSpiderCursor();
    } else {
      disableSpiderCursor();
    }
  });

  observer.observe(document.body, { attributes: true, childList: true, subtree: true });

  // Initial check
  if (isWelcomePageVisible()) {
    enableSpiderCursor();
  }
})();

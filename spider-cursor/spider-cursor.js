(function() {
  let canvas = null;
  let ctx = null;
  let dots = [];
  let currentThemeColor = 'purple'; // Track current theme
  let animationFrameId = null; // To cancel animation frame

  // Define color palettes for each theme
  const themePalettes = {
    purple: ['#a259ff', '#c77dff', '#9d4edd', '#7b2ff7', '#8e44ad', '#6c5ce7', '#b388eb', '#be8abf', '#d291bc', '#a29bfe'],
    blue:   ['#1E90FF', '#4682B4', '#87CEEB', '#ADD8E6', '#6495ED', '#4169E1', '#7B68EE', '#00BFFF', '#5F9EA0', '#B0E0E6'],
    green:  ['#32CD32', '#2E8B57', '#90EE90', '#98FB98', '#8FBC8F', '#3CB371', '#20B2AA', '#66CDAA', '#00FA9A', '#7FFFD4'],
    yellow: ['#FFD700', '#DAA520', '#FAFAD2', '#FFFFE0', '#F0E68C', '#FFEC8B', '#EEE8AA', '#BDB76B', '#FFDEAD', '#FFE4B5'] // Use lighter yellows too
  };

  const numDots = 175; // number of dots
  const maxDistance = 150; // max connection distance
  const maxAlpha = 2.5; // max line opacity

  // Function to get the current color palette based on body attribute
  function getCurrentPalette() {
    const themeColor = document.body.dataset.themeColor || 'purple';
    return themePalettes[themeColor] || themePalettes.purple; // Fallback to purple
  }

  function initDots() {
    dots = [];
    if (!canvas) return; // Ensure canvas exists
    const currentPalette = getCurrentPalette();
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
          color: currentPalette[Math.floor(Math.random() * currentPalette.length)], // Use current palette
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

  // Function to update colors of existing dots
  function updateDotColors() {
      const newTheme = document.body.dataset.themeColor || 'purple';
      if (newTheme === currentThemeColor) return; // No change needed

      console.log(`Spider cursor theme changed to: ${newTheme}`);
      currentThemeColor = newTheme;
      const currentPalette = getCurrentPalette();
      dots.forEach(dot => {
          dot.color = currentPalette[Math.floor(Math.random() * currentPalette.length)];
      });
      // Optional: redraw immediately after color change if needed
      // if (ctx && canvas) {
      //     ctx.clearRect(0, 0, canvas.width, canvas.height);
      //     drawDots();
      // }
  }


  let mouse = null; // store last mouse position

  function animate() {
    if (!canvas || !ctx) {
        animationFrameId = null; // Ensure we stop if canvas disappears
        return;
    }
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

    animationFrameId = requestAnimationFrame(animate); // Store the frame ID
  }

  function clearAndRedraw() {
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawDots();
  }

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initDots(); // Reinitialize dots with potentially new palette
    drawDots();
  }

  function enableSpiderCursor() {
    if (canvas) return; // already enabled
    canvas = document.createElement('canvas');
    canvas.id = 'spider-canvas';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    currentThemeColor = document.body.dataset.themeColor || 'purple'; // Get initial theme

    resizeCanvas(); // This calls initDots which uses the current palette

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseout', clearAndRedraw); // Redraw dots without lines on mouseout

    if (animationFrameId === null) { // Start animation only if not already running
        animate();
    }
  }

  function disableSpiderCursor() {
    if (!canvas) return;
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId); // Stop animation loop
        animationFrameId = null;
    }
    window.removeEventListener('resize', resizeCanvas);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseout', clearAndRedraw);
    canvas.remove();
    canvas = null;
    ctx = null;
    dots = [];
    mouse = null; // Clear mouse position
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

  // Observe DOM changes to toggle spider cursor AND update theme
  const observer = new MutationObserver((mutationsList) => {
      let themeChanged = false;
      for(const mutation of mutationsList) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme-color') {
              themeChanged = true;
              break;
          }
          // Also check if visibility-related classes/attributes changed on relevant elements if needed
      }

      const shouldBeVisible = isWelcomePageVisible();

      if (shouldBeVisible) {
          if (!canvas) { // If not currently enabled, enable it
              enableSpiderCursor();
          } else if (themeChanged) { // If already enabled and theme changed, update colors
              updateDotColors();
          }
      } else {
          if (canvas) { // If currently enabled but shouldn't be, disable it
              disableSpiderCursor();
          }
      }
  });

  // Observe attributes on body (for theme changes) and subtree changes (for page visibility)
  observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme-color', 'class'], childList: true, subtree: true });

  // Initial check
  if (isWelcomePageVisible()) {
    enableSpiderCursor();
  }
})();

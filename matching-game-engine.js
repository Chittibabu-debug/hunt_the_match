/* ==========================================================================
   REUSABLE MATCHING GAME FRAMEWORK
   File: matching-game-engine.js
   ========================================================================== */

window.initMatchingGame = function(configArray) {
  console.log("Matching Game Engine: Initializing with " + configArray.length + " items...");

  const oldPanel = document.getElementById('storyline-blue-debug-panel');
  if (oldPanel) oldPanel.remove();

  const player = GetPlayer();
  
  // Look for elements dynamically using the Accessibility Text set by the developer
  const pieces = configArray.map(p => {
    let targetObj = null;
    
    // Look for Articulate Storyline's accessibility text wrapper in the HTML DOM
    targetObj = document.querySelector(`[data-acc-text="${p.id}"]`) || 
                document.querySelector(`[acc-text="${p.id}"]`) || 
                document.getElementById(p.id);

    if (!targetObj) {
      console.warn(`Matching Game Engine: Could not find any shape on screen with Accessibility Text matching: "${p.id}"`);
    }

    return {
      ...p,
      obj: targetObj,
      matched: false
    };
  }).filter(p => p.obj !== null);

  // Set interactivity
  pieces.forEach(p => {
    try { p.obj.style.cursor = 'pointer'; } catch (e) {}
  });

  let first = null;
  let lock = false;

  const grows = new Map();  
  const flips = new Map();  
  let lastTime = null;

  function resetSelection() {
    first = null;
    lock = false;
  }

  function finalizeStateChange(p) {
    p.matched = true;
    // Set a data attribute or trigger visibility for Storyline matching states if needed
    try { p.obj.style.pointerEvents = 'none'; } catch (e) {}
    updateDebugPanelUI();
  }

  function startFlipEffect(p, targetState) {
    if (grows.has(p.id)) grows.delete(p.id);
    
    // Fallback if scale attributes aren't parsed out natively
    flips.set(p.id, {
      p,
      t: 0,
      duration: 0.45,
      baseX: 1,
      targetState,
      swapped: false
    });
  }

  function startGrowThenStateChange(p) {
    if (flips.has(p.id)) flips.delete(p.id);

    grows.set(p.id, {
      p,
      t: 0,
      duration: 0.22,
      amp: 0.14,
      baseX: 1
    });

    try { p.obj.style.pointerEvents = 'none'; } catch (e) {}
  }

  // FIXED: Native browser animation frame loop instead of the missing 'update' call
  function animationLoop(time) {
    if (lastTime == null) lastTime = time;
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    // Handle Flips
    if (flips.size > 0) {
      flips.forEach((anim, key) => {
        anim.t += dt;
        const prog = Math.min(1, anim.t / anim.duration);
        const scaleFactor = Math.abs(Math.cos(prog * Math.PI));
        
        anim.p.obj.style.transform = `scaleX(${anim.baseX * scaleFactor})`;
        updateDebugPanelUI();

        if (prog >= 1) {
          anim.p.obj.style.transform = `scaleX(${anim.baseX})`;
          flips.delete(key);
          if (flips.size === 0 && grows.size === 0) lock = false;
        }
      });
    }

    // Handle Correct Match Grows
    if (grows.size > 0) {
      grows.forEach((anim, key) => {
        if (anim.p.matched) { grows.delete(key); return; }

        anim.t += dt;
        const prog = Math.min(1, anim.t / anim.duration);
        const easeOut = 1 - Math.pow(1 - prog, 3);
        const currentScale = anim.baseX + anim.amp * easeOut;

        anim.p.obj.style.transform = `scale(${currentScale})`;

        if (prog >= 1) {
          anim.p.obj.style.transform = `scale(${anim.baseX})`;
          finalizeStateChange(anim.p);
          grows.delete(key);
        }
      });
    }

    requestAnimationFrame(animationLoop);
  }
  
  // Kick off the native loop
  requestAnimationFrame(animationLoop);

  // Click handler attachments via native DOM listening
  pieces.forEach(p => {
    p.obj.addEventListener('click', () => {
      if (lock || p.matched || grows.has(p.id) || flips.has(p.id)) return;

      if (!first) {
        first = p;
        lock = true; 
        startFlipEffect(p, 'Highlight');
        return;
      }

      if (first.id === p.id) {
        lock = true;
        startFlipEffect(p, 'Normal');
        resetSelection();
        return;
      }

      lock = true;
      startFlipEffect(p, 'Highlight');

      setTimeout(() => {
        if (first.type === p.type) {
          startGrowThenStateChange(first);
          startGrowThenStateChange(p);
        } else {
          startFlipEffect(first, 'Normal');
          startFlipEffect(p, 'Normal');
        }
        resetSelection();
      }, 230); 
    });
  });

  // Debugger Layout
  let debugPanelEl = null;
  function createDebugPanel() {
    debugPanelEl = document.createElement('div');
    debugPanelEl.id = 'storyline-blue-debug-panel';
    Object.assign(debugPanelEl.style, {
      position: 'absolute', top: '20px', right: '20px', width: '380px', maxHeight: '85vh',
      backgroundColor: '#002244', color: '#66ccff', border: '2px solid #0055aa', borderRadius: '8px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.5)', fontFamily: 'Consolas, monospace', fontSize: '12px',
      padding: '15px', zIndex: '999999', overflowY: 'auto', opacity: '0.95', display: 'none'
    });
    document.body.appendChild(debugPanelEl);
  }

  function updateDebugPanelUI() {
    if (!debugPanelEl || debugPanelEl.style.display === 'none') return;
    let piecesHtml = '';
    let timersHtml = '';

    pieces.forEach(p => {
      const matchText = p.matched ? '<span style="color:#00ffcc">TRUE</span>' : '<span style="color:#ff5555">FALSE</span>';
      piecesHtml += `<div style="margin-bottom:6px; padding-bottom:4px; border-bottom:1px dashed #004488">
        <strong>Acc-Text Name:</strong> "${p.id}" [${p.type}]<br/>Matched: ${matchText}
      </div>`;
    });

    if (flips.size > 0) {
      flips.forEach((v, k) => { timersHtml += `<div>"${k}": ${v.t.toFixed(2)}s</div>`; });
    } else { timersHtml = '<span style="color:#888;">No active flips</span>'; }

    debugPanelEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:12px; border-bottom:2px solid #0055aa; padding-bottom:5px;">
        <span style="color:#fff; font-weight:bold;">DYNAMIC GAME PANEL</span><span style="color:#888;">[Ctrl+Shift+E]</span>
      </div>
      <div style="margin-bottom:12px; background:#001122; padding:6px; border-radius:4px;">
        <strong>Shapes Found:</strong> ${pieces.length} / ${configArray.length}<br/>
        <strong>Status:</strong> ${lock ? '<span style="color:#ff5555">ANIMATING</span>' : '<span style="color:#00ffcc">READY</span>'}
      </div>
      <div style="margin-bottom:12px; background:#001122; padding:6px; border-radius:4px; border-left:3px solid #ffff55;">
        <h5 style="margin:0 0 4px 0; color:#ffff55; font-size:11px;">LIVE FLIP TIMERS:</h5>${timersHtml}
      </div>
      <div>${piecesHtml}</div>`;
  }

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      if (!debugPanelEl) createDebugPanel();
      debugPanelEl.style.display = debugPanelEl.style.display === 'none' ? 'block' : 'none';
      updateDebugPanelUI();
    }
  });
};

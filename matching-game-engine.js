/* Reusable Matching Game Framework
   - Pulse effect removed entirely (replaced by smooth reverse flip)
   - Dynamic item configuration
*/
window.initMatchingGame = function(configArray) {
  // Clear any existing debug panel to avoid overlap on slide re-entry
  const oldPanel = document.getElementById('storyline-blue-debug-panel');
  if (oldPanel) oldPanel.remove();

  const player = GetPlayer();
  const pieces = configArray.map(p => ({
    ...p,
    obj: object(p.id),
    matched: false
  }));

  // Make elements look clickable
  pieces.forEach(p => {
    try { p.obj.style.cursor = 'pointer'; } catch (e) {}
  });

  let first = null;
  let lock = false;

  // Active animation loops
  const grows = new Map();  
  const flips = new Map();  
  let lastTime = null;

  function resetSelection() {
    first = null;
    lock = false;
  }

  function finalizeStateChange(p) {
    p.matched = true;
    try { p.obj.state = 'Flipped'; } catch (e) {}
    try { p.obj.style.pointerEvents = 'none'; } catch (e) {}
    updateDebugPanelUI();
  }

  function startFlipEffect(p, targetState) {
    if (grows.has(p.id)) grows.delete(p.id);
    
    const baseX = 100;
    const baseY = (p.obj.scaleY == null ? 100 : p.obj.scaleY);

    flips.set(p.id, {
      p,
      t: 0,
      duration: 0.45,
      baseX,
      baseY,
      targetState,
      swapped: false
    });
  }

  function startGrowThenStateChange(p) {
    if (flips.has(p.id)) flips.delete(p.id);

    const baseX = 100;
    const baseY = (p.obj.scaleY == null ? 100 : p.obj.scaleY);

    grows.set(p.id, {
      p,
      t: 0,
      duration: 0.22,
      amp: 14,
      baseX,
      baseY
    });

    try { p.obj.style.pointerEvents = 'none'; } catch (e) {}
  }

  // Unified requestAnimationFrame canvas loop
  update(time => {
    if (lastTime == null) lastTime = time;
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    // Flip transition engine
    if (flips.size > 0) {
      flips.forEach((anim, key) => {
        anim.t += dt;
        const prog = Math.min(1, anim.t / anim.duration);
        const scaleFactor = Math.abs(Math.cos(prog * Math.PI));
        
        if (prog >= 0.5 && !anim.swapped) {
          try { anim.p.obj.state = anim.targetState; } catch(e) {}
          anim.swapped = true;
        }

        anim.p.obj.scaleX = anim.baseX * scaleFactor;
        updateDebugPanelUI();

        if (prog >= 1) {
          anim.p.obj.scaleX = anim.baseX;
          flips.delete(key);
          if (flips.size === 0 && grows.size === 0) lock = false;
        }
      });
    }

    // Correct match grow feedback
    if (grows.size > 0) {
      grows.forEach((anim, key) => {
        if (anim.p.matched) { grows.delete(key); return; }

        anim.t += dt;
        const prog = Math.min(1, anim.t / anim.duration);
        const easeOut = 1 - Math.pow(1 - prog, 3);

        anim.p.obj.scaleX = anim.baseX + anim.amp * easeOut;
        anim.p.obj.scaleY = anim.baseY + anim.amp * easeOut;

        if (prog >= 1) {
          anim.p.obj.scaleX = anim.baseX;
          anim.p.obj.scaleY = anim.baseY;
          finalizeStateChange(anim.p);
          grows.delete(key);
        }
      });
    }
  });

  // Tap/Click Controller Setup
  pieces.forEach(p => {
    p.obj.click(() => {
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
          // REMOVED PULSE: If wrong, we drop them directly into a flip reversal
          startFlipEffect(first, 'Normal');
          startFlipEffect(p, 'Normal');
        }
        resetSelection();
      }, 230); 
    });
  });

  // --- Diagnostics Overlay ---
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
      let slState = 'Normal'; try { slState = p.obj.state; } catch(e){}
      const matchText = p.matched ? '<span style="color:#00ffcc">TRUE</span>' : '<span style="color:#ff5555">FALSE</span>';
      let stateColor = slState === 'Flipped' ? '#00ffcc' : (slState === 'Highlight' ? '#ffff55' : '#fff');
      piecesHtml += `<div style="margin-bottom:6px; padding-bottom:4px; border-bottom:1px dashed #004488">
        <strong>ID:</strong> ${p.id} [${p.type}]<br/>Matched: ${matchText} | SL State: <span style="color:${stateColor}">${slState}</span>
      </div>`;
    });

    if (flips.size > 0) {
      flips.forEach((v, k) => { timersHtml += `<div>Item [${k}]: ${v.t.toFixed(2)}s / ${v.duration}s</div>`; });
    } else { timersHtml = '<span style="color:#888;">No active flips</span>'; }

    debugPanelEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:12px; border-bottom:2px solid #0055aa; padding-bottom:5px;">
        <span style="color:#fff; font-weight:bold;">DYNAMIC GAME PANEL</span><span style="color:#888;">[Ctrl+Shift+E]</span>
      </div>
      <div style="margin-bottom:12px; background:#001122; padding:6px; border-radius:4px;">
        <strong>Active Shapes Configured:</strong> ${pieces.length}<br/>
        <strong>Status:</strong> ${lock ? '<span style="color:#ff5555">WAITING</span>' : '<span style="color:#00ffcc">READY</span>'}
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

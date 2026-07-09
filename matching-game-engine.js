/* ==========================================================================
   REUSABLE MATCHING GAME FRAMEWORK (Native Loop Edition)
   File: matching-game-engine.js
   ========================================================================== */

window.initMatchingGame = function(configArray) {
  console.log("Matching Game Engine: Initializing with " + configArray.length + " items...");

  // Multi-tier safe object retriever to prevent "object is not defined" crashes
  function getStorylineObject(id) {
    if (typeof object === 'function') return object(id);
    if (typeof DS !== 'undefined' && typeof DS.object === 'function') return DS.object(id);
    return null;
  }

  // Map the dynamically provided configuration array to game pieces
  const pieces = configArray.map(p => ({
    ...p,
    obj: getStorylineObject(p.id),
    matched: false
  })).filter(p => p.obj !== null);

  // Make elements look clickable safely
  pieces.forEach(p => {
    try { p.obj.style.cursor = 'pointer'; } catch (e) {}
  });

  let first = null;
  let lock = false;
  const flips = new Map();  
  let lastTime;

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

  // Continuous animation frame loop hook
  if (typeof update === 'function') {
    update(time => {
      if (lastTime == null) lastTime = time;
      const dt = (time - lastTime) / 1000;
      lastTime = time;

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
            if (flips.size === 0) lock = false;
          }
        });
      }
    });
  }

  // Bind clicks dynamically
  pieces.forEach(p => {
    p.obj.click(() => {
      if (lock || p.matched || flips.has(p.id)) return;

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

      if (first.type === p.type) {
        setTimeout(() => {
          finalizeStateChange(first);
          finalizeStateChange(p);
          resetSelection();
        }, 450); 
      } else {
        setTimeout(() => {
          startFlipEffect(first, 'Normal');
          startFlipEffect(p, 'Normal');
          resetSelection();
        }, 800); // 800ms clean display retention pause
      }
    });
  });

  // --- Debug Panel Rendering Engine ---
  let debugPanelEl = document.getElementById('storyline-blue-debug-panel');
  
  function createDebugPanel() {
    if (document.getElementById('storyline-blue-debug-panel')) return;
    debugPanelEl = document.createElement('div');
    debugPanelEl.id = 'storyline-blue-debug-panel';
    Object.assign(debugPanelEl.style, {
      position: 'absolute', top: '20px', right: '20px', width: '380px', maxHeight: '85vh',
      backgroundColor: '#002244', color: '#66ccff', border: '2px solid #0055aa', borderRadius: '8px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.5)', fontFamily: 'Consolas, Monaco, monospace', fontSize: '12px',
      padding: '15px', zIndex: '999999', overflowY: 'auto', opacity: '0.95', display: 'none'
    });
    document.body.appendChild(debugPanelEl);
  }

  function updateDebugPanelUI() {
    if (!debugPanelEl || debugPanelEl.style.display === 'none') return;
    let piecesHtml = '';
    let timersHtml = '';

    pieces.forEach(p => {
      let currentStorylineState = 'Normal';
      try { currentStorylineState = p.obj.state; } catch(e) {}
      const isMatched = p.matched ? '<span style="color:#00ffcc">TRUE</span>' : '<span style="color:#ff5555">FALSE</span>';
      let stateColor = currentStorylineState === 'Flipped' ? '#00ffcc' : (currentStorylineState === 'Highlight' ? '#ffff55' : '#ffffff');

      piecesHtml += `<div style="margin-bottom:6px; padding-bottom:4px; border-bottom:1px dashed #004488">
        <strong>ID:</strong> ${p.id} | <strong>Type:</strong> ${p.type}<br/>
        Matched: ${isMatched} | SL State: <span style="color:${stateColor}">${currentStorylineState}</span>
      </div>`;
    });

    if (flips.size > 0) {
      flips.forEach((value, key) => { timersHtml += `<div>Card [${key}]: ${(value.t).toFixed(2)}s</div>`; });
    } else {
      timersHtml = '<span style="color:#888;">No active flips</span>';
    }

    debugPanelEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; border-bottom:2px solid #0055aa; padding-bottom:5px; margin-bottom:12px;">
        <span style="color:#fff; font-weight:bold;">DYNAMIC GAME PANEL</span>
        <span style="color:#888;">[Ctrl+Shift+E]</span>
      </div>
      <div style="background:#001122; padding:6px; margin-bottom:12px; border-radius:4px;">
        <strong>Active Lock:</strong> ${lock ? '<span style="color:#ff5555">TRUE</span>' : '<span style="color:#00ffcc">FALSE</span>'}<br/>
        <strong>Selection 1:</strong> ${first ? first.id : 'none'}
      </div>
      <div style="background:#001122; padding:6px; margin-bottom:12px; border-left:3px solid #ffff55; border-radius:4px;">
        <h5 style="margin:0; color:#ffff55; font-size:11px;">TIMERS:</h5>${timersHtml}
      </div>
      <div>${piecesHtml}</div>`;
  }

  // Setup Keyboard shortcut listener safely once
  if (!window.hasMatchingDebugListener) {
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        createDebugPanel();
        debugPanelEl.style.display = debugPanelEl.style.display === 'none' ? 'block' : 'none';
        updateDebugPanelUI();
      }
    });
    window.hasMatchingDebugListener = true;
  }
};

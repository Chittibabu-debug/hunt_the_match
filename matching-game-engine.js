/* ==========================================================================
   REUSABLE MATCHING GAME FRAMEWORK
   File: matching-game-engine.js
   --------------------------------------------------------------------------
   - Pulse effect removed entirely (replaced by smooth reverse flip)
   - Dynamic shape configuration (supports 4 to 24+ shapes)
   - Storyline HTML5 runtime compatible (Safe DS.object / DOM fallback)
   ========================================================================== */

window.initMatchingGame = function(configArray) {
  console.log("Matching Game Engine: Initializing with " + configArray.length + " items...");

  // Clear any existing debug panel to avoid duplicate overlays on slide re-entry
  const oldPanel = document.getElementById('storyline-blue-debug-panel');
  if (oldPanel) oldPanel.remove();

  const player = GetPlayer();
  
  // Resolve Storyline objects safely using a multi-tier fallback approach
  const pieces = configArray.map(p => {
    let targetObj = null;
    
    // Tier 1: Try Storyline's native internal DS object selector
    if (typeof DS !== 'undefined' && typeof DS.object === 'function') {
      targetObj = DS.object(p.id);
    }
    
    // Tier 2: Try DOM querying via standard accessibility text or element ID
    if (!targetObj) {
      targetObj = document.querySelector(`[data-acc-text="${p.id}"]`) || document.getElementById(p.id);
    }

    if (!targetObj) {
      console.warn(`Matching Game Engine: Object ID "${p.id}" could not be found on the current slide timeline.`);
    }

    return {
      ...p,
      obj: targetObj,
      matched: false
    };
  }).filter(p => p.obj !== null); // Filters out missing objects to keep the script engine alive

  // Make found interactive elements display a pointer cursor
  pieces.forEach(p => {
    try { p.obj.style.cursor = 'pointer'; } catch (e) {}
  });

  let first = null;
  let lock = false;

  // Active animation registries
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
      duration: 0.45, // 0.45s gives clean canvas transition breathing room
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

  // Unified RequestAnimationFrame canvas update loop
  update(time => {
    if (lastTime == null) lastTime = time;
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    // --- Flip Transition Matrix Engine ---
    if (flips.size > 0) {
      flips.forEach((anim, key) => {
        anim.t += dt;
        const prog = Math.min(1, anim.t / anim.duration);
        const scaleFactor = Math.abs(Math.cos(prog * Math.PI));
        
        // At the absolute midpoint (card edge-on), swap the actual asset state asset
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

    // --- Correct Match Grow Feedback ---
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

  // --- Interaction Click Controllers ---
  pieces.forEach(p => {
    p.obj.click(() => {
      if (lock || p.matched || grows.has(p.id) || flips.has(p.id)) return;

      // Card Selection 1
      if (!first) {
        first = p;
        lock = true; 
        startFlipEffect(p, 'Highlight');
        return;
      }

      // Deselect if user taps the same shape again
      if (first.id === p.id) {
        lock = true;
        startFlipEffect(p, 'Normal');
        resetSelection();
        return;
      }

      // Card Selection 2
      lock = true;
      startFlipEffect(p, 'Highlight');

      // Evaluates match precisely at the 230ms flip midpoint
      setTimeout(() => {
        if (first.type === p.type) {
          startGrowThenStateChange(first);
          startGrowThenStateChange(p);
        } else {
          // If mismatch, immediately reverse flip both cards back to normal
          startFlipEffect(first, 'Normal');
          startFlipEffect(p, 'Normal');
        }
        resetSelection();
      }, 230); 
    });
  });

  // --- HTML5 Diagnostics Overlay Panel ---
  let debugPanelEl = null;
  function createDebugPanel() {
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
        <strong>Active Shapes Configured:</strong> ${pieces.length} / ${configArray.length}<br/>
        <strong>Status:</strong> ${lock ? '<span style="color:#ff5555">WAITING</span>' : '<span style="color:#00ffcc">READY</span>'}
      </div>
      <div style="margin-bottom:12px; background:#001122; padding:6px; border-radius:4px; border-left:3px solid #ffff55;">
        <h5 style="margin:0 0 4px 0; color:#ffff55; font-size:11px;">LIVE FLIP TIMERS:</h5>${timersHtml}
      </div>
      <div>${piecesHtml}</div>`;
  }

  // Global key listener to toggle the diagnostic display module
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      if (!debugPanelEl) createDebugPanel();
      debugPanelEl.style.display = debugPanelEl.style.display === 'none' ? 'block' : 'none';
      updateDebugPanelUI();
    }
  });
};

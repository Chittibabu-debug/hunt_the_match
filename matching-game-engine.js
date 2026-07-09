/* ==========================================================================
   REUSABLE MATCHING GAME FRAMEWORK
   File: matching-game-engine.js
   ========================================================================== */

window.initMatchingGame = function(configArray) {
  console.log("Matching Game Engine: Initializing Engine with " + configArray.length + " variables...");

  // Destroy redundant diagnostic panels if resetting
  const oldPanel = document.getElementById('storyline-blue-debug-panel');
  if (oldPanel) oldPanel.remove();

  const player = GetPlayer();
  
  // Map items using native Articulate Object Hooks
  const pieces = configArray.map(p => {
    let targetObj = null;
    
    if (typeof object === 'function') {
      targetObj = object(p.id); // Official Articulate 360 Object Lookups
    } else if (typeof DS !== 'undefined' && typeof DS.object === 'function') {
      targetObj = DS.object(p.id);
    }

    if (!targetObj) {
      console.warn(`Matching Game Engine: Shape Object ID "${p.id}" could not be found on your slide stage.`);
    }

    return {
      ...p,
      obj: targetObj,
      matched: false
    };
  }).filter(p => p.obj !== null);

  let first = null;
  let lock = false;
  const flips = new Map();

  function resetSelection() {
    first = null;
    lock = false;
  }

  // Native Storyline 60FPS tick engine integration
  if (typeof update === 'function') {
    update(() => {
      if (flips.size > 0) {
        flips.forEach((anim, key) => {
          anim.t += 0.016; // Increment roughly 16ms per frame tick
          let prog = Math.min(1, anim.t / anim.duration);
          
          // Midpoint mathematical cosine wave curve mapping mirror states
          let factor = Math.abs(Math.cos(prog * Math.PI)) * 100;
          anim.p.obj.scaleX = factor; 

          if (prog >= 0.5 && !anim.swapped) {
            anim.p.obj.state = anim.targetState;
            anim.swapped = true;
          }

          updateDebugPanelUI();

          if (prog >= 1) {
            anim.p.obj.scaleX = 100;
            flips.delete(key);
            if (flips.size === 0) lock = false;
          }
        });
      }
    });
  }

  // Controller interaction
  pieces.forEach(p => {
    // Official advanced click handler hook
    p.obj.pointerup(() => {
      if (lock || p.matched || flips.has(p.id)) return;

      if (!first) {
        first = p;
        lock = true; 
        // Spin to show card back or selection highlight state
        flips.set(p.id, { p, t: 0, duration: 0.45, targetState: 'Highlight', swapped: false });
        return;
      }

      if (first.id === p.id) {
        lock = true;
        flips.set(p.id, { p, t: 0, duration: 0.45, targetState: 'Normal', swapped: false });
        resetSelection();
        return;
      }

      lock = true;
      flips.set(p.id, { p, t: 0, duration: 0.45, targetState: 'Highlight', swapped: false });

      setTimeout(() => {
        if (first.type === p.type) {
          // CORRECT MATCH
          first.matched = true;
          p.matched = true;
          first.obj.state = 'Flipped';
          p.obj.state = 'Flipped';
          updateDebugPanelUI();
          resetSelection();
        } else {
          // MISMATCH - Flip back natively
          flips.set(first.id, { p: first, t: 0, duration: 0.45, targetState: 'Normal', swapped: false });
          flips.set(p.id, { p: p, t: 0, duration: 0.45, targetState: 'Normal', swapped: false });
          resetSelection();
        }
      }, 240); 
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
      padding: '15px', zIndex: '999999', overflowY: 'auto', opacity: '0.95', display: 'block' // FORCED OPEN
    });
    document.body.appendChild(debugPanelEl);
  }

  function updateDebugPanelUI() {
    if (!debugPanelEl) createDebugPanel();
    let piecesHtml = '';
    let timersHtml = '';

    pieces.forEach(p => {
      let stateTracker = "Normal";
      try { stateTracker = p.obj.state; } catch(e){}
      const matchText = p.matched ? '<span style="color:#00ffcc">TRUE</span>' : '<span style="color:#ff5555">FALSE</span>';
      piecesHtml += `<div style="margin-bottom:6px; padding-bottom:4px; border-bottom:1px dashed #004488">
        <strong>ID:</strong> "${p.id}"<br/>Matched: ${matchText} | State: ${stateTracker}
      </div>`;
    });

    if (flips.size > 0) {
      flips.forEach((v, k) => { timersHtml += `<div>"${k}": ${v.t.toFixed(2)}s</div>`; });
    } else { timersHtml = '<span style="color:#888;">No active flips</span>'; }

    debugPanelEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:12px; border-bottom:2px solid #0055aa; padding-bottom:5px;">
        <span style="color:#fff; font-weight:bold;">DYNAMIC ENGINE DIAGNOSTICS</span>
      </div>
      <div style="margin-bottom:12px; background:#001122; padding:6px; border-radius:4px;">
        <strong>Shapes Found:</strong> ${pieces.length} / ${configArray.length}
      </div>
      <div style="margin-bottom:12px; background:#001122; padding:6px; border-radius:4px; border-left:3px solid #ffff55;">
        <h5 style="margin:0 0 4px 0; color:#ffff55; font-size:11px;">LIVE FLIP TIMERS:</h5>${timersHtml}
      </div>
      <div>${piecesHtml}</div>`;
  }

  // Fire display configuration immediately
  updateDebugPanelUI();
};

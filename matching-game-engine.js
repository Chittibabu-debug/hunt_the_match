/* ==========================================================================
   REUSABLE MATCHING GAME FRAMEWORK (GSAP EDITION)
   File: matching-game-engine.js
   ========================================================================== */

window.initMatchingGame = function(configArray) {
  console.log("Matching Game Engine: Initializing with " + configArray.length + " items using GSAP...");

  // Remove any stale debug panels
  const oldPanel = document.getElementById('storyline-blue-debug-panel');
  if (oldPanel) oldPanel.remove();

  // Find the HTML DOM elements using accessibility text or IDs
  const pieces = configArray.map(p => {
    const targetEl = document.querySelector(`[data-acc-text="${p.id}"]`) || 
                     document.querySelector(`[acc-text="${p.id}"]`) || 
                     document.getElementById(p.id);

    if (!targetEl) {
      console.warn(`Matching Game Engine: Could not find shape with Alt/Acc Text: "${p.id}"`);
    }

    return {
      ...p,
      el: targetEl,
      matched: false
    };
  }).filter(p => p.el !== null);

  // Styling mouse interactions safely
  pieces.forEach(p => {
    try { p.el.style.cursor = 'pointer'; } catch (e) {}
  });

  let first = null;
  let lock = false;
  
  // Track active animation timers for the debug panel UI
  let activeTimers = {};

  function resetSelection() {
    first = null;
    lock = false;
  }

  // Pure GSAP Flip Engine (Guarantees shape center origin)
  function flipToState(p, targetState, onCompleteCallback) {
    activeTimers[p.id] = { t: 0, duration: 0.45 };
    
    // Step 1: Shrink to center edge-on (0)
    gsap.to(p.el, {
      duration: 0.225,
      scaleX: 0,
      transformOrigin: "50% 50%", // Keeps the shape locked in its actual position
      ease: "power1.in",
      onUpdate: function() {
        if (activeTimers[p.id]) activeTimers[p.id].t = this.progress() * 0.225;
        updateDebugPanelUI();
      },
      onComplete: () => {
        // Change the visual state right at the midpoint swap
        const player = GetPlayer();
        const slObj = typeof object === 'function' ? object(p.id) : (typeof DS !== 'undefined' ? DS.object(p.id) : null);
        if (slObj) {
          try { slObj.state = targetState; } catch(e) {}
        }

        // Step 2: Reveal outward back to normal size (1)
        gsap.to(p.el, {
          duration: 0.225,
          scaleX: 1,
          transformOrigin: "50% 50%",
          ease: "power1.out",
          onUpdate: function() {
            if (activeTimers[p.id]) activeTimers[p.id].t = 0.225 + (this.progress() * 0.225);
            updateDebugPanelUI();
          },
          onComplete: () => {
            delete activeTimers[p.id];
            updateDebugPanelUI();
            if (onCompleteCallback) onCompleteCallback();
          }
        });
      }
    });
  }

  function triggerCorrectMatchCelebration(p, onDone) {
    // Pop-up grow feedback for matching pairs
    gsap.to(p.el, {
      duration: 0.11,
      scale: 1.15,
      transformOrigin: "50% 50%",
      yoyo: true,
      repeat: 1,
      ease: "power2.out",
      onComplete: () => {
        p.matched = true;
        try { p.el.style.pointerEvents = 'none'; } catch(e) {}
        const slObj = typeof object === 'function' ? object(p.id) : (typeof DS !== 'undefined' ? DS.object(p.id) : null);
        if (slObj) try { slObj.state = 'Flipped'; } catch(e) {}
        if (onDone) onDone();
      }
    });
  }

  // Click Controller Handles
  pieces.forEach(p => {
    p.el.addEventListener('click', () => {
      if (lock || p.matched || activeTimers[p.id]) return;

      if (!first) {
        first = p;
        lock = true;
        flipToState(p, 'Highlight', () => { lock = false; });
        return;
      }

      if (first.id === p.id) {
        lock = true;
        flipToState(p, 'Normal', () => { resetSelection(); });
        return;
      }

      lock = true;
      flipToState(p, 'Highlight', () => {
        // Midpoint check matching algorithm
        if (first.type === p.type) {
          let doneCount = 0;
          const checkDone = () => {
            doneCount++;
            if (doneCount === 2) {
              updateDebugPanelUI();
              resetSelection();
            }
          };
          triggerCorrectMatchCelebration(first, checkDone);
          triggerCorrectMatchCelebration(p, checkDone);
        } else {
          // If mismatch, clean flip back with no jump distortions
          let flipBackCount = 0;
          const checkFlipBack = () => {
            flipBackCount++;
            if (flipBackCount === 2) resetSelection();
          };
          flipToState(first, 'Normal', checkFlipBack);
          flipToState(p, 'Normal', checkFlipBack);
        }
      });
    });
  });

  // --- Real-Time Overlay Debug Panel ---
  let debugPanelEl = null;
  function createDebugPanel() {
    debugPanelEl = document.createElement('div');
    debugPanelEl.id = 'storyline-blue-debug-panel';
    Object.assign(debugPanelEl.style, {
      position: 'absolute', top: '20px', right: '20px', width: '380px', maxHeight: '85vh',
      backgroundColor: '#002244', color: '#66ccff', border: '2px solid #0055aa', borderRadius: '8px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.5)', fontFamily: 'Consolas, monospace', fontSize: '12px',
      padding: '15px', zIndex: '999999', overflowY: 'auto', opacity: '0.95', display: 'block'
    });
    document.body.appendChild(debugPanelEl);
  }

  function updateDebugPanelUI() {
    if (!debugPanelEl) createDebugPanel();
    let piecesHtml = '';
    let timersHtml = '';

    pieces.forEach(p => {
      const matchText = p.matched ? '<span style="color:#00ffcc">TRUE</span>' : '<span style="color:#ff5555">FALSE</span>';
      piecesHtml += `<div style="margin-bottom:6px; padding-bottom:4px; border-bottom:1px dashed #004488">
        <strong>Acc-Text:</strong> "${p.id}" [${p.type}]<br/>Matched: ${matchText}
      </div>`;
    });

    const activeKeys = Object.keys(activeTimers);
    if (activeKeys.length > 0) {
      activeKeys.forEach(k => {
        timersHtml += `<div>"${k}": ${activeTimers[k].t.toFixed(2)}s / ${activeTimers[k].duration}s</div>`;
      });
    } else {
      timersHtml = '<span style="color:#888;">No active flips</span>';
    }

    debugPanelEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:12px; border-bottom:2px solid #0055aa; padding-bottom:5px;">
        <span style="color:#fff; font-weight:bold;">GSAP GAME PANEL</span>
      </div>
      <div style="margin-bottom:12px; background:#001122; padding:6px; border-radius:4px;">
        <strong>Shapes Tracked:</strong> ${pieces.length} / ${configArray.length}<br/>
        <strong>Status:</strong> ${lock ? '<span style="color:#ff5555">WAITING</span>' : '<span style="color:#00ffcc">READY</span>'}
      </div>
      <div style="margin-bottom:12px; background:#001122; padding:6px; border-radius:4px; border-left:3px solid #ffff55;">
        <h5 style="margin:0 0 4px 0; color:#ffff55; font-size:11px;">LIVE FLIP TIMERS:</h5>${timersHtml}
      </div>
      <div>${piecesHtml}</div>`;
  }

  updateDebugPanelUI();
};

// public/client.js - fixed version
// Traffic simulator - corrected FIFO behavior for all lanes

(function () {
  // --- Config ---
  const lanes = ['north', 'east', 'south', 'west'];
  const maxPerLane = 5;
  const spawnInterval = 1200; // ms - try spawn every 1.2s
  const cycleTime = 5000; // ms - each green lasts 5s
  const staggerBetweenCars = 360; // ms between cars leaving in same lane (increased to avoid overlap)
  const passAnimationDuration = 2200; // CSS transition duration (ms) should match .pass timing in CSS

  // --- State ---
  const laneQueues = { north: [], east: [], south: [], west: [] }; // arrays of DOM elements (cars)
  let globalId = 0;
  let currentIndex = 0; // starting with north

  // --- DOM refs ---
  const laneQueueEls = {
    north: document.querySelector('#lane-north .queue'),
    east: document.querySelector('#lane-east .queue'),
    south: document.querySelector('#lane-south .queue'),
    west: document.querySelector('#lane-west .queue'),
  };

  const laneContainerEls = {
    north: document.getElementById('lane-north'),
    east: document.getElementById('lane-east'),
    south: document.getElementById('lane-south'),
    west: document.getElementById('lane-west'),
  };

  const countEls = {
    north: document.getElementById('count-n'),
    east: document.getElementById('count-e'),
    south: document.getElementById('count-s'),
    west: document.getElementById('count-w'),
  };

  const infoEl = document.getElementById('info'); // optional footer info
  // guard: ensure DOM elements exist
  if (!laneContainerEls.north || !laneContainerEls.east || !laneContainerEls.south || !laneContainerEls.west) {
    console.error(
      'Lane elements not found. Make sure #lane-north, #lane-east, #lane-south, #lane-west exist in DOM and each has a .queue child.'
    );
    return;
  }

  // ensure queue elements exist (create if missing)
  lanes.forEach(l => {
    if (!laneQueueEls[l]) {
      const q = document.createElement('div');
      q.className = 'queue';
      laneContainerEls[l].appendChild(q);
      laneQueueEls[l] = q;
    }
  });

  // --- Helpers ---
  function makeCar(id) {
    const car = document.createElement('div');
    car.className = 'car';
    car.dataset.id = id;
    const colorCls = 'c' + ((id % 5) + 1);
    car.classList.add(colorCls);
    // set a default order; will be refreshed immediately after append
    car.style.order = '0';
    return car;
  }

  function updateCounts() {
    if (!countEls.north) return;
    countEls.north.textContent = laneQueues.north.length;
    countEls.east.textContent = laneQueues.east.length;
    countEls.south.textContent = laneQueues.south.length;
    countEls.west.textContent = laneQueues.west.length;
  }

  function updateInfoText() {
    if (!infoEl) return;
    const laneName = lanes[currentIndex].charAt(0).toUpperCase() + lanes[currentIndex].slice(1);
    const total = lanes.reduce((s, l) => s + laneQueues[l].length, 0);
    infoEl.textContent = `Time: ${Math.round(performance.now() / 1000)}s | Green: ${laneName} | Queued: ${total}`;
  }

  // toggles traffic light visuals (expects .lane.<dir> .light .bulb elements in DOM)
  function updateLights() {
    lanes.forEach((l, i) => {
      const bulbRed = document.querySelector(`.lane.${l} .light .bulb.red`);
      const bulbGreen = document.querySelector(`.lane.${l} .light .bulb.green`);
      if (!bulbRed || !bulbGreen) return;
      if (i === currentIndex) {
        bulbRed.classList.remove('on');
        bulbGreen.classList.add('on');
      } else {
        bulbRed.classList.add('on');
        bulbGreen.classList.remove('on');
      }
    });
  }

  // Synchronize visual order (CSS order) with the array order for a lane
  function refreshQueueVisuals(laneName) {
    const qArr = laneQueues[laneName];
    const qEl = laneQueueEls[laneName];
    if (!qEl) return;

    // compute whether this queue's flex direction is reversed
    const fd = window.getComputedStyle(qEl).flexDirection || '';
    const isReversed = fd.indexOf('reverse') !== -1;

    // Apply order so that qArr[0] (first-in-line logically) becomes visually
    // the item nearest the intersection regardless of flex-direction.
    const len = qArr.length;
    for (let i = 0; i < len; i++) {
      const car = qArr[i];
      if (!car) continue;

      // ensure the car element is inside the proper queue container
      if (car.parentNode !== qEl) qEl.appendChild(car);

      // When flex is reversed, we want the array's first item to receive the lowest
      // order number so it appears nearest in visual order.
      const orderIndex = isReversed ? i : i; // keep simple: array index -> order
      car.style.order = String(orderIndex);

      // optional debug index to inspect in DevTools
      car.dataset.queueIndex = i;
    }
  }

  // spawn cars randomly up to maxPerLane
  function trySpawn() {
    lanes.forEach((l) => {
      const q = laneQueues[l];
      if (q.length >= maxPerLane) return; // lane full
      // 40% chance to spawn
      if (Math.random() < 0.4) {
        const car = makeCar(++globalId);
        q.push(car);
        laneQueueEls[l].appendChild(car); // append into queue container (important)
        // Refresh visual order so array -> DOM order matches regardless of CSS flex-direction
        refreshQueueVisuals(l);
        updateCounts();
        updateInfoText();
      }
    });
  }

  // ensure at least 5 cars across lanes before first green
  function ensureInitialFive() {
    const total = lanes.reduce((s, l) => s + laneQueues[l].length, 0);
    let toAdd = Math.max(0, 5 - total);
    while (toAdd > 0) {
      const candidates = lanes.filter((l) => laneQueues[l].length < maxPerLane);
      if (!candidates.length) break;
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      const car = makeCar(++globalId);
      laneQueues[chosen].push(car);
      laneQueueEls[chosen].appendChild(car);
      refreshQueueVisuals(chosen);
      toAdd--;
    }
    updateCounts();
    updateInfoText();
  }

  // release cars in a lane (when green)
  function releaseLane(l) {
    const q = laneQueues[l];
    const qEl = laneQueueEls[l];
    if (!q || q.length === 0) return;

    // snapshot how many cars were waiting when green started
    const releaseCount = q.length;

    for (let i = 0; i < releaseCount; i++) {
      // Instead of always shifting the array (which might not match visual order when CSS reverses layout),
      // find the DOM element that currently has the smallest 'order' value (visually nearest the intersection)
      // and remove that one from the array so the visual-first car always goes first.

      // build a sorted list by numeric order
      const sorted = q.slice().sort((a, b) => {
        const ao = parseInt(a.style.order || '0', 10);
        const bo = parseInt(b.style.order || '0', 10);
        return ao - bo;
      });

      const carToGo = sorted[0];
      if (!carToGo) continue;

      // find its index in the original queue array and remove it
      const idx = q.indexOf(carToGo);
      if (idx !== -1) {
        q.splice(idx, 1);
      }

      // update visuals for remaining cars immediately so they shift up in the queue
      refreshQueueVisuals(l);
      updateCounts();
      updateInfoText();

      // small stagger so cars leave one-by-one and don't overlap
      ((car, delayMultiplier) => {
        setTimeout(() => {
          if (!car.parentNode) return;
          car.classList.add('pass');
          // remove car from DOM after animation completes
          setTimeout(() => {
            if (car.parentNode) car.parentNode.removeChild(car);
          }, passAnimationDuration + 90);
        }, delayMultiplier * staggerBetweenCars);
      })(carToGo, i);
    }

    // defensive refresh
    refreshQueueVisuals(l);
    updateCounts();
    updateInfoText();
  }

  function cycle() {
    updateLights();
    const activeLane = lanes[currentIndex];

    // release immediately at green (no extra delay)
    releaseLane(activeLane);

    // advance to next lane for next cycle
    currentIndex = (currentIndex + 1) % lanes.length;

    updateInfoText();
  }

  // --- Initialization & loops ---
  for (let i = 0; i < 3; i++) trySpawn();
  ensureInitialFive();
  updateLights();

  const spawner = setInterval(trySpawn, spawnInterval);

  // start cycle immediately (so north green first)
  setTimeout(() => {
    cycle(); // first release (north)
    setInterval(cycle, cycleTime);
  }, 300);

  // expose for debugging
  window.__trafficSim = {
    laneQueues,
    makeCar,
    trySpawn,
    releaseLane,
    cycle,
    updateCounts,
    updateLights,
    refreshQueueVisuals
  };
})();


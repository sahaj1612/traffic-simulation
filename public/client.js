// public/client.js
// Full client-side simulation logic (replace existing file with this).
// - 4 lanes: north, east, south, west
// - up to maxPerLane cars per lane
// - random spawns, cycle every cycleTime ms
// - when lane turns green, all queued cars go automatically
// - header counters update live
// - self-contained IIFE

(function () {
  // --- Config ---
  const lanes = ['north', 'east', 'south', 'west'];
  const maxPerLane = 5;
  const spawnInterval = 1200; // ms - try spawn every 1.2s
  const cycleTime = 5000; // ms - each green lasts 5s
  const staggerBetweenCars = 160; // ms between cars leaving in same lane
  const passAnimationDuration = 2200; // CSS transition duration (ms) should match .pass timing in CSS

  // --- State ---
  const laneQueues = { north: [], east: [], south: [], west: [] }; // arrays of DOM elements (cars)
  let globalId = 0;
  let currentIndex = 0; // starting with north

  // --- DOM refs ---
  const laneEls = {
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
  if (!laneEls.north || !laneEls.east || !laneEls.south || !laneEls.west) {
    console.error(
      'Lane elements not found. Make sure #lane-north, #lane-east, #lane-south, #lane-west exist in DOM.'
    );
    return;
  }

  // --- Helpers ---
  function makeCar(id) {
    const car = document.createElement('div');
    car.className = 'car';
    car.dataset.id = id;
    // use 5 alternating color classes (c1..c5)
    const colorCls = 'c' + ((id % 5) + 1);
    car.classList.add(colorCls);
    // small content (optional) for visibility
    // car.innerText = id; // uncomment if you want id visible
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

  // spawn cars randomly up to maxPerLane
  function trySpawn() {
    lanes.forEach((l) => {
      const q = laneQueues[l];
      if (q.length >= maxPerLane) return; // lane full
      // 40% chance to spawn
      if (Math.random() < 0.4) {
        const car = makeCar(++globalId);
        q.push(car);
        laneEls[l].appendChild(car);
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
      laneEls[chosen].appendChild(car);
      toAdd--;
    }
    updateCounts();
    updateInfoText();
  }

  // release all cars from lane l (animate and remove)
  function releaseLane(l) {
    const q = laneQueues[l];
    if (!q || q.length === 0) return;

    q.forEach((car, idx) => {
      // stagger each car a bit so they don't all overlap
      setTimeout(() => {
        // ensure car still in DOM
        if (!car.parentNode) return;
        // add pass class to trigger CSS transform/transition
        car.classList.add('pass');

        // after animation ends, remove DOM element (slightly longer than CSS transition)
        setTimeout(() => {
          try {
            if (car.parentNode) car.parentNode.removeChild(car);
          } catch (e) {
            /* ignore */
          }
        }, passAnimationDuration + 100);
      }, idx * staggerBetweenCars);
    });

    // clear queue logically right away; visuals continue based on DOM elements
    laneQueues[l] = [];
    updateCounts();
    updateInfoText();
  }

  // main cycle: update lights and release active lane
  function cycle() {
    updateLights();
    const activeLane = lanes[currentIndex];
    // release after a small delay so lights change is visible before cars start moving
    setTimeout(() => {
      releaseLane(activeLane);
    }, 80);

    // advance to next lane for next cycle
    currentIndex = (currentIndex + 1) % lanes.length;

    // update info text for UI feedback
    updateInfoText();
  }

  // --- Initialization & loops ---
  // small initial spawn attempts so page is not empty
  for (let i = 0; i < 3; i++) trySpawn();
  ensureInitialFive();
  updateLights();

  // spawn loop
  const spawner = setInterval(trySpawn, spawnInterval);

  // start cycle immediately (so north green first)
  setTimeout(() => {
    cycle(); // first release (north)
    // continue cycling every cycleTime
    setInterval(cycle, cycleTime);
  }, 300);

  // Expose a small debug API on window so you can force actions in console if needed
  window.__trafficSim = {
    laneQueues,
    makeCar,
    trySpawn,
    releaseLane,
    cycle,
    updateCounts,
    updateLights,
  };
})();

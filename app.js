(function () {
  'use strict';
  var config = window.LOADING_CONFIG, scenes = config.scenes;
  var byId = function (id) { return document.getElementById(id); };
  var demo = /(?:\?|&)demo=1(?:&|$)/.test(location.search);
  var duration = config.sceneDuration, transition = config.transitionDuration;
  var index = -1, active = null, timer, deadline = 0, remaining = duration, paused = false;
  var order = [], orderPosition = -1, transitionCount = 0;
  var panels = [], sliding = false, slideAnimations = [];
  var state = { total: 0, needed: 0, server: config.serverName, map: '' };
  var motions = [
    ['1.2%','-1.5%','3deg','-12deg','-2.5deg','1deg','-7deg','-1deg','1%','-2%'],
    ['-1%','1.4%','-2deg','9deg','1.5deg','1deg','5deg','.5deg','-1.5%','1.5%'],
    ['1%','-1%','2deg','-6deg','-1deg','-1deg','-10deg','-2deg','2%','-1%']
  ];
  var keys = ['--bg-from-x','--bg-to-x','--tilt-x','--tilt-y','--roll','--tilt-x-end','--tilt-y-end','--roll-end','--fg-from-x','--fg-to-x'];
  scenes.forEach(function (scene) {
    var panel = document.createElement('div'); panel.className = 'scene';
    panel.style.transitionDuration = transition + 'ms';
    panel.style.setProperty('--duration', (duration + transition) + 'ms');
    panel.style.setProperty('--person-height', scene.personHeight);
    panel.style.setProperty('--person-bottom', scene.personBottom);
    panel.style.setProperty('--person-left', (parseFloat(scene.personLeft) + (100 - parseFloat(scene.personHeight)) / 2) + '%');
    panel.style.setProperty('--person-width', scene.personHeight);
    keys.forEach(function (key, n) { panel.style.setProperty(key, motions[scene.motion || 0][n]); });
    var painting = document.createElement('div'); painting.className = 'painting';
    var background = document.createElement('div'); background.className = 'background';
    background.style.backgroundImage = 'url("' + scene.background + '")';
    painting.appendChild(background); panel.appendChild(painting);
    if (scene.foreground) {
      var person = new Image(); person.className = 'foreground'; person.alt = ''; person.src = scene.foreground;
      person.onerror = function () { person.hidden = true; }; panel.appendChild(person);
    }
    panels.push(panel); byId('scenes').appendChild(panel);
    var preload = new Image(); preload.src = scene.background;
  });
  function shuffledOrder(avoidFirst) {
    var result = scenes.map(function (_, sceneIndex) { return sceneIndex; });
    for (var n = result.length - 1; n > 0; n--) {
      var swap = Math.floor(Math.random() * (n + 1));
      var value = result[n]; result[n] = result[swap]; result[swap] = value;
    }
    if (result.length > 1 && result[0] === avoidFirst) {
      var replacement = 1 + Math.floor(Math.random() * (result.length - 1));
      var first = result[0]; result[0] = result[replacement]; result[replacement] = first;
    }
    return result;
  }
  function show(next) {
    if (sliding) return;
    index = (next + scenes.length) % scenes.length;
    var panel = panels[index];
    if (panel === active) return;
    panel.querySelectorAll('.background,.foreground').forEach(function (layer) { layer.style.animation = 'none'; });
    void panel.offsetWidth;
    panel.querySelectorAll('.background,.foreground').forEach(function (layer) { layer.style.animation = ''; });
    var previous = active;
    if (previous) { previous.classList.remove('active'); previous.classList.add('leaving'); }
    panel.classList.add('active'); active = panel;
    // Alternate travel direction like the reference. The first scene enters too.
    var direction = transitionCount % 2 ? -1 : 1;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var options = { duration: reduced ? 1 : transition, easing: 'cubic-bezier(.65,0,.25,1)', fill: 'both' };
    // Garry's Mod can report its loading page as hidden and freeze Web Animations.
    // In that mode, show the scene immediately instead of leaving it off-screen.
    if (document.hidden || typeof panel.animate !== 'function') {
      if (previous) previous.classList.remove('leaving');
      slideAnimations = []; sliding = false;
    } else {
      sliding = true;
      var outgoing = previous ? previous.animate([
        { transform: 'translate3d(0,0,0)' },
        { transform: 'translate3d(' + (direction * 110) + '%,0,0)' }
      ], options) : null;
      var incoming = panel.animate([
        { transform: 'translate3d(' + (-direction * 110) + '%,0,0)' },
        { transform: 'translate3d(0,0,0)' }
      ], options);
      slideAnimations = outgoing ? [outgoing, incoming] : [incoming];
      var finished = false;
      var finishTransition = function () {
        if (finished) return;
        finished = true;
        if (previous) previous.classList.remove('leaving');
        if (outgoing) outgoing.cancel();
        incoming.cancel(); slideAnimations = []; sliding = false;
      };
      incoming.onfinish = finishTransition;
      // Some embedded CEF builds never fire onfinish; never leave a panel off-screen.
      setTimeout(finishTransition, options.duration + 250);
      if (paused) slideAnimations.forEach(function (animation) { animation.pause(); });
    }
    transitionCount++;
    document.body.setAttribute('data-scene', index + 1);
    var hint = byId('hint'), hintText = byId('hintText');
    if (hint && hintText) {
      hintText.textContent = scenes[index].hint || '';
      hint.hidden = !scenes[index].hint;
      hint.classList.remove('hint-enter');
      void hint.offsetWidth;
      hint.classList.add('hint-enter');
    }
    remaining = duration; schedule();
  }
  function advance() {
    if (sliding) return;
    if (orderPosition >= order.length - 1) {
      order = shuffledOrder(index); orderPosition = 0;
    } else {
      orderPosition++;
    }
    show(order[orderPosition]);
  }
  function retreat() {
    if (sliding) return;
    orderPosition = (orderPosition - 1 + order.length) % order.length;
    show(order[orderPosition]);
  }
  function schedule() {
    clearTimeout(timer);
    if (paused) return;
    deadline = Date.now() + remaining;
    timer = setTimeout(advance, remaining);
  }
  function togglePause() {
    if (!paused) remaining = Math.max(0, deadline - Date.now());
    paused = !paused; document.body.classList.toggle('paused', paused);
    slideAnimations.forEach(function (animation) { if (paused) animation.pause(); else animation.play(); });
    schedule();
  }
  if (demo) {
    document.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowRight') advance();
      if (event.key === 'ArrowLeft') retreat();
      if (event.code === 'Space' && event.target.tagName !== 'BUTTON') { event.preventDefault(); togglePause(); }
    });
  }
  function renderLoading() {
    var mapInfo = byId('mapInfo');
    if (mapInfo) mapInfo.textContent = state.map ? 'Map: ' + state.map : 'Detecting map';
  }
  function shortFile(file) {
    var parts = String(file || '').split(/[\\/]/);
    var name = parts[parts.length - 1];
    return name.length > 42 ? name.slice(0, 39) + '…' : name;
  }
  window.GameDetails = function (name, url, map, maxPlayers, steamId, gamemode, volume) {
    state.server = name || config.serverName; state.map = map || '';
    document.title = state.server + ' — Loading';
    if (music && Number.isFinite(Number(volume))) {
      music.volume = Math.max(0, Math.min(1, Number(config.musicVolume) * Number(volume)));
    }
    renderLoading();
  };
  window.SetFilesTotal = function (count) { state.total = Math.max(0, Number(count) || 0); renderLoading(); };
  window.SetFilesNeeded = function (count) { state.needed = Math.max(0, Number(count) || 0); renderLoading(); };
  window.DownloadingFile = function (file) { state.file = shortFile(file); state.status = ''; renderLoading(); };
  window.SetStatusChanged = function (status) { state.status = String(status || ''); renderLoading(); };
  var music = byId('music');
  if (music) {
    music.volume = Math.max(0, Math.min(1, Number(config.musicVolume) || 0));
    var startMusic = function () {
      var promise = music.play();
      if (promise && promise.catch) promise.catch(function () {});
    };
    startMusic();
    document.addEventListener('pointerdown', startMusic, { once: true });
    document.addEventListener('keydown', startMusic, { once: true });
  }
  order = shuffledOrder(-1); orderPosition = 0;
  renderLoading();
  show(order[orderPosition]);
})();

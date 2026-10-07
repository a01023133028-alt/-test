/* 앱 시작점: 데이터 로드, 화면 전환, 각 화면 그리기 */
(() => {
  const { esc } = UI;

  const DEFAULT_OPTS = {
    mode: 'write',
    wrongType: 'write',
    count: '10',
    morphs: Data.MORPHS.slice(),
    lifes: Data.LIFES.slice(),
    cycle: false,
  };

  const state = {
    weeds: [],
    byId: new Map(),
    source: null,
    warnings: [],
    route: 'loading',
    opts: loadOpts(),
    session: null,
    lastSession: null,
    dexGroup: 'morph',
    dexQuery: '',
    pairs: [],
  };

  function loadOpts() {
    const saved = Storage.get('opts', {});
    const o = { ...DEFAULT_OPTS, ...saved };
    o.morphs = (o.morphs || []).filter((m) => Data.MORPHS.includes(m));
    o.lifes = (o.lifes || []).filter((l) => Data.LIFES.includes(l));
    if (!Quiz.MODES[o.mode]) o.mode = 'write';
    if (!Quiz.TYPES.includes(o.wrongType)) o.wrongType = 'write';
    if (!['10', '20', 'all'].includes(o.count)) o.count = '10';
    return o;
  }

  function saveOpts() {
    Storage.set('opts', state.opts);
  }

  const $ = (sel, root = document) => root.querySelector(sel);
  const screen = (name) => document.getElementById('screen-' + name);

  /* ================= 라우팅 ================= */
  const SCREENS = ['loading', 'loadfile', 'home', 'quiz', 'result', 'stats', 'dex', 'pairs'];

  function go(route) {
    if (location.hash === '#' + route) onRoute();
    else location.hash = route;
  }

  function show(name) {
    state.route = name;
    SCREENS.forEach((s) => screen(s).classList.toggle('active', s === name));
    const tabbar = document.getElementById('tabbar');
    tabbar.hidden = ['quiz', 'loading', 'loadfile'].includes(name);
    tabbar.querySelectorAll('a').forEach((a) => {
      const on = a.dataset.tab === name || (a.dataset.tab === 'home' && name === 'result');
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.body.dataset.route = name;
  }

  function onRoute() {
    UI.closeLightbox();
    UI.closeModal();
    if (!state.weeds.length) return; // 데이터 준비 전
    let r = location.hash.replace(/^#\/?/, '') || 'home';
    if (r === 'quiz' && !state.session) r = 'home';
    if (r === 'result' && !state.lastSession) r = 'home';
    if (!['home', 'quiz', 'result', 'stats', 'dex', 'pairs'].includes(r)) r = 'home';
    if (('#' + r) !== location.hash) history.replaceState(null, '', '#' + r);

    ({ home: renderHome, quiz: renderQuiz, result: renderResult, stats: renderStats, dex: renderDex, pairs: renderPairs })[r]();
    show(r);
    if (r !== 'quiz') window.scrollTo(0, 0);
  }

  /* ================= 데이터 ================= */
  async function init() {
    applyTheme(Storage.get('theme', null));
    UI.initOverlays();
    bindGlobal();
    Data.loadCredits().then(UI.setCredits);
    Data.loadPairs().then((p) => {
      state.pairs = p;
      if (state.route === 'pairs') renderPairs();
    });
    try {
      setData(await Data.load());
    } catch (err) {
      console.error(err);
      renderLoadFile(err.message);
    }
  }

  function setData(result) {
    state.weeds = result.weeds;
    state.byId = new Map(result.weeds.map((w) => [w.id, w]));
    state.source = result.source;
    state.warnings = result.warnings;
    if (result.warnings.length) console.warn('weeds.json 경고:', result.warnings);
    if (!result.weeds.length) {
      renderLoadFile('weeds.json에 잡초가 하나도 없습니다.');
      return;
    }
    onRoute();
  }

  function renderLoadFile(message) {
    const isFile = location.protocol === 'file:';
    screen('loadfile').innerHTML = `
      <div class="card">
        <h1>데이터 불러오기</h1>
        <p class="warn-text">${esc(message || '')}</p>
        ${isFile
          ? `<p>index.html을 파일로 직접 열면 브라우저 보안 때문에 <b>data/weeds.json</b>을 자동으로 읽을 수 없어요.</p>
             <p>아래 버튼으로 <b>data/weeds.json</b> 파일을 한 번만 골라 주세요. 브라우저에 저장되어 다음부터는 바로 시작돼요.</p>`
          : `<p>data/weeds.json 파일이 있는지, JSON 형식이 올바른지 확인해 주세요.</p>`}
        <label class="btn btn-primary btn-block file-btn">
          📂 weeds.json 파일 선택
          <input type="file" accept=".json,application/json" id="dataFile" hidden>
        </label>
        <p class="muted small">사진은 index.html 옆의 images 폴더에서 불러와요.<br>
        로컬 서버로 열면 이 과정이 필요 없어요 (README 참고).</p>
      </div>`;
    show('loadfile');
  }

  async function pickDataFile(file) {
    try {
      const r = await Data.loadFromFile(file);
      if (!location.hash) history.replaceState(null, '', '#home');
      setData(r);
    } catch (err) {
      alert(err.message);
    }
  }

  /* ================= 홈(출제 옵션) ================= */
  function wrongCount() {
    const ids = new Set(Storage.getWrongIds());
    return state.weeds.filter((w) => ids.has(w.id)).length;
  }

  function renderHome() {
    const o = state.opts;
    const pool = Quiz.pool(state.weeds, o);
    const wc = wrongCount();
    const photoCount = state.weeds.filter((w) => w.images.length).length;
    const imageTotal = state.weeds.reduce((n, w) => n + w.images.length, 0);
    const isWrong = o.mode === 'wrong';
    const limit = o.count === 'all' ? pool.length : Math.min(Number(o.count), pool.length);

    let cycleInfo = '';
    if (o.cycle && !isWrong && pool.length) {
      const rem = Quiz.cycleRemaining(state.weeds, o);
      cycleInfo = rem
        ? `<div class="cycle-info">이번 바퀴 남은 잡초 <b>${rem}</b> / ${pool.length}종
             <button type="button" class="link-btn" data-action="reset-cycle">처음부터</button></div>`
        : `<div class="cycle-info">새 바퀴 시작 · ${pool.length}종을 중복 없이 출제</div>`;
    }

    const resume = state.session
      ? `<div class="card resume">
           <div>진행 중인 퀴즈 <b>${state.session.index + 1} / ${state.session.questions.length}</b></div>
           <a href="#quiz" class="btn btn-primary">이어서 풀기</a>
         </div>`
      : '';

    const notices = [];
    if (state.source !== 'server') {
      notices.push(`브라우저에 저장된 데이터로 실행 중이에요.
        <label class="link-btn">파일 다시 선택<input type="file" accept=".json,application/json" id="dataFile" hidden></label>`);
    }
    if (state.warnings.length) {
      notices.push(`<details><summary>데이터 경고 ${state.warnings.length}건</summary>
        <ul>${state.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></details>`);
    }

    screen('home').innerHTML = `
      ${resume}
      <div class="hero">
        <h1>잡초 사진 퀴즈</h1>
        <p class="muted">${state.weeds.length}종 · 사진 ${imageTotal}장${photoCount < state.weeds.length ? ` · 사진 없는 잡초 ${state.weeds.length - photoCount}종` : ''}</p>
      </div>

      <section class="opt-section">
        <h2>문제 유형</h2>
        <div class="mode-list" role="radiogroup">
          ${Object.entries(Quiz.MODES).map(([key, m], i) => {
            const disabled = key === 'wrong' && wc === 0;
            return `<button type="button" role="radio" class="mode-card ${o.mode === key ? 'selected' : ''}"
              data-mode="${key}" aria-checked="${o.mode === key}" ${disabled ? 'disabled' : ''}>
              <span class="mode-num">${i + 1}</span>
              <span class="mode-text"><b>${m.label}</b><small>${m.desc}${key === 'wrong' ? ` · ${wc}종` : ''}</small></span>
            </button>`;
          }).join('')}
        </div>
        ${isWrong ? `
          <h3>오답 문제를 어떤 유형으로 풀까요?</h3>
          <div class="seg">
            ${Quiz.TYPES.map((t) => `<button type="button" class="seg-btn ${o.wrongType === t ? 'selected' : ''}" data-wrongtype="${t}">${Quiz.MODES[t].label}</button>`).join('')}
          </div>` : ''}
      </section>

      <section class="opt-section">
        <h2>문제 수</h2>
        <div class="seg">
          ${[['10', '10문제'], ['20', '20문제'], ['all', '전체']].map(([v, l]) =>
            `<button type="button" class="seg-btn ${o.count === v ? 'selected' : ''}" data-count="${v}">${l}</button>`).join('')}
        </div>
      </section>

      <section class="opt-section">
        <h2>범위</h2>
        <h3>형태적 분류</h3>
        <div class="chips">
          ${Data.MORPHS.map((m) => chip('morph', m, o.morphs.includes(m), Data.MORPH_CLASS[m])).join('')}
        </div>
        <h3>생활형</h3>
        <div class="chips">
          ${Data.LIFES.map((l) => chip('life', l, o.lifes.includes(l), Data.LIFE_CLASS[l])).join('')}
        </div>
      </section>

      ${isWrong ? '' : `
      <section class="opt-section">
        <label class="switch-row">
          <span><b>한 바퀴 모드</b><small>범위 안의 잡초가 한 번씩 다 나올 때까지 중복 없이 출제 (나눠 풀어도 이어짐)</small></span>
          <input type="checkbox" id="cycleToggle" ${o.cycle ? 'checked' : ''}>
          <span class="switch" aria-hidden="true"></span>
        </label>
        ${cycleInfo}
      </section>`}

      ${notices.length ? `<section class="notice">${notices.map((n) => `<div>${n}</div>`).join('')}</section>` : ''}

      <div class="action-bar">
        <div class="pool-info">${pool.length
          ? `출제 가능 ${pool.length}종 · 이번에 <b>${o.cycle && !isWrong ? Math.min(limit, Quiz.cycleRemaining(state.weeds, o) || pool.length) : limit}문제</b>`
          : '<span class="warn-text">조건에 맞는 잡초가 없어요</span>'}</div>
        <button type="button" class="btn btn-primary btn-block btn-lg" data-action="start" ${pool.length ? '' : 'disabled'}>퀴즈 시작</button>
      </div>`;
  }

  function chip(kind, value, on, cls) {
    return `<label class="chip ${cls} ${on ? 'on' : ''}">
      <input type="checkbox" data-${kind}="${esc(value)}" ${on ? 'checked' : ''}>${esc(value)}</label>`;
  }

  function onHomeClick(e) {
    const o = state.opts;
    const t = e.target.closest('button, a');
    if (!t) return;
    if (t.dataset.mode) {
      o.mode = t.dataset.mode;
    } else if (t.dataset.wrongtype) {
      o.wrongType = t.dataset.wrongtype;
    } else if (t.dataset.count) {
      o.count = t.dataset.count;
    } else if (t.dataset.action === 'reset-cycle') {
      if (!confirm('이번 바퀴 진행을 지우고 처음부터 다시 시작할까요?')) return;
      Storage.setCycle(Quiz.cycleKey(o), null);
    } else if (t.dataset.action === 'start') {
      startQuiz();
      return;
    } else return;
    saveOpts();
    renderHome();
  }

  function onHomeChange(e) {
    const t = e.target;
    const o = state.opts;
    if (t.id === 'dataFile' && t.files[0]) return pickDataFile(t.files[0]);
    if (t.id === 'cycleToggle') o.cycle = t.checked;
    else if (t.dataset.morph) toggleIn(o.morphs, t.dataset.morph, t.checked, Data.MORPHS);
    else if (t.dataset.life) toggleIn(o.lifes, t.dataset.life, t.checked, Data.LIFES);
    else return;
    saveOpts();
    renderHome();
  }

  function toggleIn(arr, v, on, order) {
    const set = new Set(arr);
    if (on) set.add(v);
    else set.delete(v);
    arr.splice(0, arr.length, ...order.filter((x) => set.has(x)));
  }

  function startQuiz(onlyIds) {
    const opts = { ...state.opts };
    const session = Quiz.createSession(state.weeds, opts, onlyIds);
    if (!session) {
      alert('조건에 맞는 잡초가 없어요.');
      return;
    }
    state.session = session;
    go('quiz');
  }

  /* ================= 퀴즈 ================= */
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  function current() {
    const s = state.session;
    return s ? s.questions[s.index] : null;
  }

  function renderQuiz() {
    const s = state.session;
    const q = current();
    const w = q.weed;
    const total = s.questions.length;
    const done = s.index + (q.answered ? 1 : 0);
    const photo = Quiz.MODES[q.type].photo;
    const typeLabel = s.pair ? `헷갈리는 쌍 · ${pairTitle(s.pair)}` : Quiz.MODES[q.type].label + (s.opts.mode === 'wrong' ? ' · 오답' : '');

    screen('quiz').innerHTML = `
      <div class="quiz-head">
        <button type="button" class="icon-btn" data-action="quit" aria-label="그만하기">✕</button>
        <div class="quiz-progress"><b>${s.index + 1}</b> / ${total}</div>
        <div class="quiz-score">점수 <b>${s.score}</b></div>
      </div>
      <div class="progress-bar"><div style="width:${(done / total) * 100}%"></div></div>
      <div class="quiz-type">${typeLabel}</div>

      ${photo ? `
        <div class="photo-box">
          <button type="button" class="photo-btn" data-action="zoom" aria-label="사진 크게 보기">
            ${UI.img(w.images[q.imageIndex], 'quiz-photo', '문제 사진', 'loading="eager"')}
            <span class="zoom-hint">🔍 탭하면 확대</span>
          </button>
          <div class="photo-tools">
            ${w.images.length > 1 && !q.answered
              ? `<button type="button" class="btn btn-ghost btn-sm" data-action="hint">🔄 다른 사진 보기 <small>(힌트 · ${q.imageIndex + 1}/${w.images.length})</small></button>`
              : '<span></span>'}
            ${q.hintUsed ? '<span class="badge-hint">💡 힌트 사용</span>' : ''}
          </div>
        </div>` : `
        <div class="name-card">
          <div class="name-card-label">이 잡초의 분류와 생활형은?</div>
          <div class="name-card-name">${esc(w.name)}</div>
        </div>`}

      <div class="answer-area">${answerArea(q)}</div>
      ${q.answered ? feedback(q) : ''}

      <div class="action-bar">
        ${q.answered
          ? `<button type="button" class="btn btn-primary btn-block btn-lg" data-action="next">${s.index + 1 < total ? '다음 문제 →' : '결과 보기'}</button>`
          : q.type === 'choice'
            ? `<div class="muted small center">보기를 누르세요${finePointer ? ' (숫자키 1~4)' : ''}</div>`
            : `<button type="button" class="btn btn-primary btn-block btn-lg" data-action="submit" ${canSubmit(q) ? '' : 'disabled'}>확인</button>`}
      </div>`;

    const input = $('#nameInput');
    if (input && !q.answered && finePointer) input.focus();
  }

  function answerArea(q) {
    const w = q.weed;
    const ua = q.userAnswer || {};
    const parts = [];

    if (q.type === 'write' || q.type === 'real') {
      const cls = q.answered ? (q.parts.name ? 'is-correct' : 'is-wrong') : '';
      parts.push(`
        <label class="field-label" for="nameInput">이름</label>
        <input id="nameInput" class="name-input ${cls}" type="text" value="${esc(q.draft.text)}"
          placeholder="잡초 이름 입력" autocomplete="off" autocorrect="off" autocapitalize="off"
          spellcheck="false" enterkeyhint="done" ${q.answered ? 'disabled' : ''}>`);
    }

    if (q.type === 'choice') {
      parts.push(`<div class="choices">${q.choices.map((c, i) => {
        let cls = '';
        if (q.answered) {
          if (c.id === w.id) cls = 'is-correct';
          else if (c.id === ua.choiceId) cls = 'is-wrong';
          else cls = 'is-dim';
        }
        return `<button type="button" class="choice ${cls}" data-choice="${c.id}" ${q.answered ? 'disabled' : ''}>
          <span class="choice-num">${i + 1}</span>${esc(c.name)}</button>`;
      }).join('')}</div>`);
    }

    if (q.type === 'class' || q.type === 'real') {
      parts.push(optionGroup('형태적 분류', 'morph', Data.MORPHS, Data.MORPH_CLASS, q, w.morph));
      parts.push(optionGroup('생활형', 'life', Data.LIFES, Data.LIFE_CLASS, q, w.life));
    }
    return parts.join('');
  }

  function optionGroup(title, kind, values, classMap, q, correctValue) {
    const picked = q.answered ? q.userAnswer[kind] : q.draft[kind];
    return `
      <div class="field-label">${title}</div>
      <div class="opt-grid opt-${kind}">${values.map((v) => {
        let st = '';
        if (q.answered) {
          if (v === correctValue) st = 'is-correct';
          else if (v === picked) st = 'is-wrong';
          else st = 'is-dim';
        } else if (v === picked) st = 'selected';
        return `<button type="button" class="opt-btn ${classMap[v]} ${st}" data-${kind}="${esc(v)}" ${q.answered ? 'disabled' : ''}>${esc(v)}</button>`;
      }).join('')}</div>`;
  }

  function feedback(q) {
    const w = q.weed;
    const ua = q.userAnswer;
    const rows = [];
    if (q.type === 'write' || q.type === 'real') {
      rows.push(partRow('이름', q.parts.name, ua.text.trim() || '(모름)'));
    }
    if (q.type === 'class' || q.type === 'real') {
      rows.push(partRow('분류', q.parts.morph, ua.morph));
      rows.push(partRow('생활형', q.parts.life, ua.life));
    }
    return `
      <section class="feedback ${q.correct ? 'ok' : 'ng'}" id="feedback">
        <div class="verdict">${q.correct ? '⭕ 정답!' : '❌ 오답'}</div>
        ${rows.length > 1 || (rows.length && !q.correct) ? `<ul class="part-rows">${rows.join('')}</ul>` : ''}
        ${answerCard(w)}
      </section>`;
  }

  function partRow(label, ok, mine) {
    return `<li class="${ok ? 'ok' : 'ng'}"><span class="part-mark">${ok ? '⭕' : '❌'}</span>
      <span class="part-label">${label}</span><span class="part-mine">내 답: ${esc(mine)}</span></li>`;
  }

  function answerCard(w) {
    return `
      <div class="answer-card">
        <div class="answer-name">${esc(w.name)} <small class="muted">No.${w.id}</small></div>
        ${UI.tags(w)}
        ${w.features ? `<p class="features">${esc(w.features)}</p>` : ''}
        ${UI.thumbs(w)}
      </div>`;
  }

  function canSubmit(q) {
    if (q.type === 'write') return true; // 빈칸 제출 = 모름(오답)
    if (q.type === 'class' || q.type === 'real') return !!(q.draft.morph && q.draft.life);
    return false;
  }

  function updateSubmitButton() {
    const q = current();
    const btn = $('[data-action="submit"]', screen('quiz'));
    if (btn && q) btn.disabled = !canSubmit(q);
  }

  function submitAnswer(extra = {}) {
    const s = state.session;
    const q = current();
    if (!q || q.answered) return;
    const input = $('#nameInput');
    if (input) q.draft.text = input.value;
    if (q.type !== 'choice' && !canSubmit(q)) return;
    Quiz.grade(s, { text: q.draft.text, morph: q.draft.morph, life: q.draft.life, ...extra });
    if (document.activeElement) document.activeElement.blur();
    renderQuiz();
    const fb = $('#feedback');
    if (fb) {
      const top = fb.getBoundingClientRect().top;
      if (top > window.innerHeight * 0.6) {
        window.scrollBy({ top: top - window.innerHeight * 0.35, behavior: 'smooth' });
      }
    }
  }

  function nextQuestion() {
    const s = state.session;
    if (!s || !current().answered) return;
    if (s.index + 1 < s.questions.length) {
      s.index += 1;
      renderQuiz();
      window.scrollTo(0, 0);
    } else {
      finishSession(s);
    }
  }

  function finishSession(s) {
    state.lastSession = s;
    state.session = null;
    go('result');
  }

  function quitQuiz() {
    const s = state.session;
    const answered = s.questions.filter((q) => q.answered).length;
    if (!answered) {
      if (!confirm('퀴즈를 그만둘까요?')) return;
      state.session = null;
      go('home');
      return;
    }
    if (!confirm(`퀴즈를 그만두고 지금까지 푼 ${answered}문제의 결과를 볼까요?`)) return;
    s.questions = s.questions.filter((q) => q.answered);
    s.index = s.questions.length - 1;
    s.quit = true;
    finishSession(s);
  }

  function onQuizClick(e) {
    const q = current();
    if (!q) return;
    const t = e.target.closest('button');
    if (!t) return;
    const a = t.dataset.action;
    if (a === 'quit') return quitQuiz();
    if (a === 'zoom') return UI.openLightbox(q.weed.images, q.imageIndex);
    if (a === 'hint') {
      const input = $('#nameInput');
      if (input) q.draft.text = input.value;
      q.imageIndex = (q.imageIndex + 1) % q.weed.images.length;
      q.hintUsed = true;
      renderQuiz();
      return;
    }
    if (a === 'submit') return submitAnswer();
    if (a === 'next') return nextQuestion();
    if (q.answered) return;
    if (t.dataset.choice) return submitAnswer({ choiceId: Number(t.dataset.choice) });
    if (t.dataset.morph || t.dataset.life) {
      const kind = t.dataset.morph ? 'morph' : 'life';
      q.draft[kind] = t.dataset[kind];
      t.parentElement.querySelectorAll('.opt-btn').forEach((b) => b.classList.toggle('selected', b === t));
      updateSubmitButton();
    }
  }

  /* 엔터 키: 확인 → 다음. 한글 입력 조합 중 엔터도 처리 */
  let pendingEnter = false;
  let lastEnter = 0;

  function handleEnter() {
    const now = Date.now();
    if (now - lastEnter < 350) return;
    lastEnter = now;
    const q = current();
    if (!q) return;
    if (q.answered) nextQuestion();
    else if (q.type !== 'choice') submitAnswer();
  }

  function onKeydown(e) {
    if (state.route !== 'quiz' || !state.session) return;
    if (UI.isModalOpen() || UI.isLightboxOpen()) return;
    if (e.key === 'Enter' || e.keyCode === 13) {
      if (e.isComposing) {
        pendingEnter = true;
        return;
      }
      e.preventDefault();
      handleEnter();
      return;
    }
    if (e.keyCode === 229) return;
    const q = current();
    if (q && !q.answered && q.type === 'choice' && /^[1-4]$/.test(e.key) && q.choices[e.key - 1]) {
      submitAnswer({ choiceId: q.choices[e.key - 1].id });
    }
  }

  /* ================= 결과 ================= */
  function renderResult() {
    const s = state.lastSession;
    const total = s.questions.length;
    const p = UI.pct(s.score, total);
    const wrongs = s.questions.filter((q) => !q.correct);
    const hints = s.questions.filter((q) => q.hintUsed).length;
    const msg = p === 100 ? '완벽해요! 🎉' : p >= 80 ? '아주 잘했어요! 👏' : p >= 50 ? '조금만 더! 💪' : '도감으로 복습해 봐요 📖';

    screen('result').innerHTML = `
      <div class="card result-card">
        <div class="muted">${s.pair ? `헷갈리는 쌍 · ${pairTitle(s.pair)}` : esc(Quiz.MODES[s.type].label)}${s.opts.mode === 'wrong' && !s.pair ? ' · 오답 풀기' : ''}${s.quit ? ' · 중간 종료' : ''}</div>
        <div class="result-score"><b>${s.score}</b> / ${total}</div>
        <div class="result-pct">${p}점 · ${msg}</div>
        ${hints ? `<div class="muted small">💡 힌트 사용 ${hints}문제</div>` : ''}
        ${s.roundComplete ? '<div class="round-done">🎉 한 바퀴 완주! 범위 안의 잡초를 모두 풀었어요.</div>' : ''}
        ${s.cycleKey && !s.roundComplete ? `<div class="muted small">한 바퀴 남은 잡초 ${(Storage.getCycle(s.cycleKey) || []).length}종</div>` : ''}
      </div>

      <h2>틀린 잡초 ${wrongs.length}종</h2>
      ${wrongs.length ? `<ul class="weed-list">${wrongs.map((q) => weedRow(q.weed, wrongNote(q), q.imageIndex)).join('')}</ul>`
        : '<p class="muted center">틀린 문제가 없어요!</p>'}

      <div class="btn-stack">
        ${s.pair
          ? `<button type="button" class="btn btn-primary btn-block btn-lg" data-action="again">이 쌍 다시 연습</button>
             <a href="#pairs" class="btn btn-block">다른 쌍 보기</a>`
          : `${wrongs.length ? '<button type="button" class="btn btn-primary btn-block btn-lg" data-action="retry-wrong">틀린 문제 다시 풀기</button>' : ''}
             <button type="button" class="btn btn-block" data-action="again">같은 설정으로 새로 풀기</button>`}
        <a href="#home" class="btn btn-ghost btn-block">처음으로</a>
      </div>`;
  }

  function wrongNote(q) {
    const ua = q.userAnswer;
    const bits = [];
    if (q.type === 'write' || q.type === 'real') bits.push(`이름: ${ua.text.trim() || '(모름)'}`);
    if (q.type === 'choice') bits.push(`고른 답: ${state.byId.get(ua.choiceId)?.name || ''}`);
    if ((q.type === 'class' || q.type === 'real') && !q.parts.morph) bits.push(`분류: ${ua.morph}`);
    if ((q.type === 'class' || q.type === 'real') && !q.parts.life) bits.push(`생활형: ${ua.life}`);
    return '내 답 — ' + bits.join(' · ');
  }

  function weedRow(w, note, imageIndex = 0) {
    const src = w.images[imageIndex] || w.images[0];
    return `<li><button type="button" class="weed-row" data-weed-detail="${w.id}">
      <span class="weed-row-img">${UI.img(src, '', w.name)}</span>
      <span class="weed-row-text">
        <b>${esc(w.name)}</b> ${UI.tags(w)}
        ${note ? `<small class="muted">${esc(note)}</small>` : ''}
      </span></button></li>`;
  }

  function onResultClick(e) {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const s = state.lastSession;
    if (s.pair && t.dataset.action === 'again') {
      startPairQuiz(state.pairs.indexOf(s.pair));
    } else if (t.dataset.action === 'retry-wrong') {
      const ids = s.questions.filter((q) => !q.correct).map((q) => q.weed.id);
      const session = Quiz.createSession(state.weeds, { ...s.opts, count: 'all', cycle: false }, ids);
      if (session) {
        state.session = session;
        go('quiz');
      }
    } else if (t.dataset.action === 'again') {
      state.opts = { ...s.opts };
      saveOpts();
      startQuiz();
    }
  }

  /* ================= 기록 ================= */
  function renderStats() {
    const stats = Storage.getStats();
    let tries = 0;
    let correct = 0;
    const rows = [];
    state.weeds.forEach((w) => {
      const r = stats[w.id];
      if (!r) return;
      tries += r.tries;
      correct += r.correct;
      rows.push({ w, r, rate: r.correct / r.tries, miss: r.tries - r.correct });
    });
    const top = rows
      .filter((x) => x.miss > 0)
      .sort((a, b) => a.rate - b.rate || b.miss - a.miss || b.r.tries - a.r.tries)
      .slice(0, 10);
    const wc = wrongCount();

    screen('stats').innerHTML = `
      <h1>나의 기록</h1>
      <div class="stat-grid">
        <div class="stat"><b>${tries}</b><span>푼 문제</span></div>
        <div class="stat"><b>${UI.pct(correct, tries)}%</b><span>전체 정답률</span></div>
        <div class="stat"><b>${rows.length}<small>/${state.weeds.length}</small></b><span>공부한 잡초</span></div>
        <div class="stat"><b>${wc}</b><span>오답 목록</span></div>
      </div>
      ${wc ? '<button type="button" class="btn btn-primary btn-block" data-action="go-wrong">오답만 다시 풀기</button>' : ''}

      <h2>자주 틀리는 잡초 TOP 10</h2>
      ${top.length ? `<ol class="weed-list ranked">${top.map((x, i) =>
        weedRow(x.w, `${i + 1}위 · 정답률 ${UI.pct(x.r.correct, x.r.tries)}% (${x.r.correct}/${x.r.tries}) · 틀린 횟수 ${x.miss}`)).join('')}</ol>`
        : '<p class="muted center">아직 틀린 기록이 없어요.</p>'}

      ${rows.length ? `
      <details class="all-stats">
        <summary>잡초별 정답률 전체 보기 (${rows.length}종)</summary>
        <table>
          <thead><tr><th>No.</th><th>이름</th><th>정답률</th><th>맞힘/시도</th></tr></thead>
          <tbody>${rows.map((x) => `<tr data-weed-detail="${x.w.id}">
            <td>${x.w.id}</td><td>${esc(x.w.name)}</td>
            <td><span class="rate-bar"><span style="width:${UI.pct(x.r.correct, x.r.tries)}%"></span></span>${UI.pct(x.r.correct, x.r.tries)}%</td>
            <td>${x.r.correct}/${x.r.tries}</td></tr>`).join('')}</tbody>
        </table>
      </details>` : ''}

      <div class="btn-stack">
        <button type="button" class="btn btn-danger btn-block" data-action="reset">기록 초기화</button>
        ${state.source !== 'server' ? `<button type="button" class="btn btn-ghost btn-block" data-action="clear-data">저장된 weeds.json 지우기</button>` : ''}
      </div>`;
  }

  function onStatsClick(e) {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    if (t.dataset.action === 'reset') {
      if (!confirm('정답률·오답 목록·한 바퀴 진행 기록을 모두 지울까요? 되돌릴 수 없어요.')) return;
      Storage.resetRecords();
      renderStats();
    } else if (t.dataset.action === 'go-wrong') {
      state.opts.mode = 'wrong';
      saveOpts();
      go('home');
    } else if (t.dataset.action === 'clear-data') {
      if (!confirm('브라우저에 저장된 weeds.json을 지울까요? 다음에 열 때 파일을 다시 골라야 해요.')) return;
      Data.clearCache();
      location.reload();
    }
  }

  /* ================= 도감 ================= */
  function renderDex() {
    screen('dex').innerHTML = `
      <h1>잡초 도감</h1>
      <div class="dex-tools">
        <input type="search" id="dexSearch" class="search" placeholder="이름 검색" value="${esc(state.dexQuery)}" autocomplete="off">
        <div class="seg">
          <button type="button" class="seg-btn ${state.dexGroup === 'morph' ? 'selected' : ''}" data-group="morph">분류별</button>
          <button type="button" class="seg-btn ${state.dexGroup === 'life' ? 'selected' : ''}" data-group="life">생활형별</button>
        </div>
      </div>
      <div id="dexBody"></div>`;
    renderDexBody();
  }

  function renderDexBody() {
    const q = Grading.normalize(state.dexQuery);
    const list = state.weeds.filter((w) => !q || Grading.normalize(w.name).includes(q) || String(w.id) === q);
    const byMorph = state.dexGroup === 'morph';
    const outer = byMorph ? Data.MORPHS : Data.LIFES;
    const inner = byMorph ? Data.LIFES : Data.MORPHS;
    const outerKey = byMorph ? 'morph' : 'life';
    const innerKey = byMorph ? 'life' : 'morph';
    const outerCls = byMorph ? Data.MORPH_CLASS : Data.LIFE_CLASS;
    const innerCls = byMorph ? Data.LIFE_CLASS : Data.MORPH_CLASS;
    const stats = Storage.getStats();

    const known = new Set(outer);
    const others = list.filter((w) => !known.has(w[outerKey]));

    let html = outer.map((o) => {
      const g = list.filter((w) => w[outerKey] === o);
      if (!g.length) return '';
      const subs = inner.map((i) => {
        const sg = g.filter((w) => w[innerKey] === i);
        if (!sg.length) return '';
        return `<h3 class="dex-sub"><span class="dot ${innerCls[i]}"></span>${esc(i)} <small>${sg.length}종</small></h3>
          <div class="dex-grid">${sg.map((w) => dexCard(w, stats[w.id])).join('')}</div>`;
      }).join('');
      const rest = g.filter((w) => !inner.includes(w[innerKey]));
      return `<section class="dex-group">
        <h2 class="dex-head ${outerCls[o]}">${esc(o)} <small>${g.length}종</small></h2>
        ${subs}
        ${rest.length ? `<div class="dex-grid">${rest.map((w) => dexCard(w, stats[w.id])).join('')}</div>` : ''}
      </section>`;
    }).join('');
    if (others.length) {
      html += `<section class="dex-group"><h2 class="dex-head">기타</h2>
        <div class="dex-grid">${others.map((w) => dexCard(w, stats[w.id])).join('')}</div></section>`;
    }
    $('#dexBody').innerHTML = html || '<p class="muted center">검색 결과가 없어요.</p>';
  }

  function dexCard(w, r) {
    return `<button type="button" class="dex-card" data-weed-detail="${w.id}">
      <span class="dex-img">${UI.img(w.images[0], '', w.name)}
        ${w.images.length > 1 ? `<span class="img-count">📷 ${w.images.length}</span>` : ''}</span>
      <span class="dex-info">
        <b>${esc(w.name)}</b>
        <small class="muted">No.${w.id}${r ? ` · 정답률 ${UI.pct(r.correct, r.tries)}%` : ''}</small>
        ${UI.tags(w)}
      </span></button>`;
  }

  /* ================= 헷갈리는 쌍 ================= */
  function pairWeeds(p) {
    return p.ids.map((id) => state.byId.get(id));
  }

  function pairTitle(p) {
    return pairWeeds(p).map((w) => (w ? esc(w.name) : '?')).join(' vs ');
  }

  function renderPairs() {
    const cards = state.pairs
      .map((p, i) => {
        const ws = pairWeeds(p);
        if (ws.some((w) => !w)) return '';
        const side = (w, note) => `
          <div class="pair-side">
            <button type="button" class="pair-img" data-weed-detail="${w.id}" aria-label="${esc(w.name)} 자세히 보기">
              ${UI.img(w.images[0], '', w.name)}
              ${w.images.length > 1 ? `<span class="img-count">📷 ${w.images.length}</span>` : ''}
            </button>
            <b class="pair-name">${esc(w.name)}</b>
            ${UI.tags(w)}
            ${note ? `<p class="pair-note">${esc(note)}</p>` : ''}
          </div>`;
        const canPractice = ws.every((w) => w.images.length);
        return `
          <section class="pair-card card">
            <h2 class="pair-title"><span class="pair-num">${i + 1}</span>${pairTitle(p)}</h2>
            <div class="pair-row">${side(ws[0], p.a)}<span class="pair-vs">vs</span>${side(ws[1], p.b)}</div>
            ${p.common ? `<p class="pair-common">💡 ${esc(p.common)}</p>` : ''}
            ${canPractice ? `<button type="button" class="btn btn-block btn-sm pair-practice" data-pair="${i}">📝 사진 보고 둘 중 맞히기 (8문제)</button>` : ''}
          </section>`;
      })
      .join('');
    screen('pairs').innerHTML = `
      <h1>헷갈리는 쌍</h1>
      <p class="muted small">사진을 누르면 그 잡초의 사진 전부와 특징을 볼 수 있어요.</p>
      ${cards || '<p class="muted center">불러오는 중…</p>'}`;
  }

  function startPairQuiz(i) {
    const p = state.pairs[i];
    if (!p) return;
    const session = Quiz.createPairSession(p, pairWeeds(p), { ...state.opts, mode: 'choice', cycle: false });
    if (!session) return;
    state.session = session;
    go('quiz');
  }

  function onPairsClick(e) {
    const t = e.target.closest('[data-pair]');
    if (t) startPairQuiz(Number(t.dataset.pair));
  }

  function onDexClick(e) {
    const t = e.target.closest('[data-group]');
    if (!t) return;
    state.dexGroup = t.dataset.group;
    renderDex();
  }

  /* ================= 잡초 상세 모달 ================= */
  function openWeedDetail(id) {
    const w = state.byId.get(id);
    if (!w) return;
    const r = Storage.getStats()[w.id];
    UI.openModal(`
      <h2 class="detail-name">${esc(w.name)} <small class="muted">No.${w.id}</small></h2>
      ${UI.tags(w)}
      ${w.features ? `<p class="features">${esc(w.features)}</p>` : ''}
      <p class="muted small">${r ? `내 기록: 정답률 ${UI.pct(r.correct, r.tries)}% (${r.correct}/${r.tries})` : '아직 푼 기록이 없어요.'}</p>
      <div class="detail-photos">${w.images.length
        ? w.images.map((src, i) => `<button type="button" class="detail-photo" data-zoom-weed="${w.id}" data-zoom-index="${i}">${UI.img(src, '', `${w.name} 사진 ${i + 1}`)}</button>`).join('')
        : '<p class="muted">등록된 사진이 없습니다.</p>'}</div>`);
  }

  /* ================= 테마 ================= */
  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'dark' || theme === 'light') root.dataset.theme = theme;
    else delete root.dataset.theme;
    const dark = effectiveTheme() === 'dark';
    const btn = document.getElementById('themeToggle');
    btn.textContent = dark ? '☀️' : '🌙';
    btn.setAttribute('aria-label', dark ? '라이트 모드로 전환' : '다크 모드로 전환');
  }

  function effectiveTheme() {
    const t = document.documentElement.dataset.theme;
    if (t) return t;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  /* ================= 이벤트 연결 ================= */
  function bindGlobal() {
    window.addEventListener('hashchange', onRoute);

    document.getElementById('themeToggle').addEventListener('click', () => {
      const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      Storage.set('theme', next);
      applyTheme(next);
    });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
      applyTheme(Storage.get('theme', null));
    });

    screen('home').addEventListener('click', onHomeClick);
    screen('home').addEventListener('change', onHomeChange);
    screen('loadfile').addEventListener('change', (e) => {
      if (e.target.id === 'dataFile' && e.target.files[0]) pickDataFile(e.target.files[0]);
    });
    screen('quiz').addEventListener('click', onQuizClick);
    screen('quiz').addEventListener('input', (e) => {
      if (e.target.id === 'nameInput') {
        const q = current();
        if (q) q.draft.text = e.target.value;
      }
    });
    screen('result').addEventListener('click', onResultClick);
    screen('stats').addEventListener('click', onStatsClick);
    screen('dex').addEventListener('click', onDexClick);
    screen('pairs').addEventListener('click', onPairsClick);
    screen('dex').addEventListener('input', (e) => {
      if (e.target.id === 'dexSearch') {
        state.dexQuery = e.target.value;
        renderDexBody();
      }
    });

    // 썸네일 확대, 잡초 상세 (모든 화면·모달 공통)
    document.addEventListener('click', (e) => {
      const z = e.target.closest('[data-zoom-weed]');
      if (z) {
        const w = state.byId.get(Number(z.dataset.zoomWeed));
        if (w) UI.openLightbox(w.images, Number(z.dataset.zoomIndex) || 0);
        return;
      }
      const d = e.target.closest('[data-weed-detail]');
      if (d) openWeedDetail(Number(d.dataset.weedDetail));
    });

    document.addEventListener('keydown', onKeydown);
    document.addEventListener('compositionend', () => {
      if (!pendingEnter) return;
      pendingEnter = false;
      setTimeout(handleEnter, 0);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();

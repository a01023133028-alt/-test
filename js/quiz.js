/* 출제·채점 엔진 (화면과 무관한 로직) */
const Quiz = (() => {
  const ALL_MODES = Subject.id === 'disease'
    ? {
        write: { label: '사진 → 병명 쓰기', desc: '사진과 기주를 보고 병명을 직접 입력', photo: true },
        choice: { label: '사진 → 4지선다', desc: '같은 기주·작물의 헷갈리는 병명 중 고르기', photo: true },
      }
    : {
        write: { label: '사진 → 이름 쓰기', desc: '사진을 보고 이름을 직접 입력', photo: true },
        choice: { label: '사진 → 4지선다', desc: '같은 분류의 헷갈리는 보기 중 고르기', photo: true },
        class: { label: '이름 → 분류·생활형', desc: '이름을 보고 형태적 분류와 생활형 고르기', photo: false },
        real: { label: '실전 모드', desc: '사진 → 이름 + 분류 + 생활형 한꺼번에', photo: true },
      };
  const TYPES = Subject.types;
  const MODES = { ...ALL_MODES };
  MODES.wrong = { label: '오답만 다시 풀기', desc: `틀린 뒤 아직 다시 맞히지 못한 ${Subject.noun}만`, photo: false };

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function randInt(n) {
    return Math.floor(Math.random() * n);
  }

  /* 실제 문제 유형 (오답 모드는 따로 고른 유형) */
  function typeOf(opts) {
    return opts.mode === 'wrong' ? opts.wrongType : opts.mode;
  }

  /* 옵션에 맞는 출제 후보 */
  function pool(weeds, opts) {
    const type = typeOf(opts);
    let list = weeds.filter((w) => Subject.facets.every((f) => (opts.filters[f.key] || []).includes(w[f.key])));
    if (MODES[type].photo) list = list.filter((w) => w.images.length > 0);
    if (opts.skipMastered !== false) {
      const done = Storage.getMastered();
      list = list.filter((w) => !done.has(w.id));
    }
    if (opts.mode === 'wrong') {
      const wrong = new Set(Storage.getWrongIds());
      list = list.filter((w) => wrong.has(w.id));
    }
    return list;
  }

  function cycleKey(opts) {
    return [typeOf(opts), ...Subject.facets.map((f) => (opts.filters[f.key] || []).join(','))].join('|');
  }

  /* 한 바퀴 모드에서 이번 바퀴에 남은 수 (새 바퀴면 null) */
  function cycleRemaining(weeds, opts) {
    const ids = Storage.getCycle(cycleKey(opts));
    if (!ids) return null;
    const ok = new Set(pool(weeds, opts).map((w) => w.id));
    const n = ids.filter((id) => ok.has(id)).length;
    return n || null;
  }

  /* 4지선다 보기: 비슷한 것(잡초는 같은 형태적 분류, 병해는 같은 기주 → 같은 작물 구분) 우선 */
  function makeChoices(weed, all) {
    const names = new Set([weed.name]);
    const pick = [];
    const keys = Subject.similarKeys;
    const rank = (w) => {
      const i = keys.findIndex((k) => w[k] && w[k] === weed[k]);
      return i < 0 ? keys.length : i;
    };
    const ordered = shuffle(all.filter((w) => w.id !== weed.id)).sort((a, b) => rank(a) - rank(b));
    for (const w of ordered) {
      if (pick.length >= 3) break;
      if (names.has(w.name)) continue;
      names.add(w.name);
      pick.push(w);
    }
    return shuffle([weed, ...pick]);
  }

  function makeQuestion(weed, type, all) {
    return {
      weed,
      type,
      imageIndex: weed.images.length ? randInt(weed.images.length) : -1,
      choices: type === 'choice' ? makeChoices(weed, all) : null,
      draft: { text: '', morph: null, life: null },
      hintUsed: false,
      answered: false,
      correct: null,
      parts: null,
      userAnswer: null,
    };
  }

  /*
   * 세션 생성
   * opts: { mode, wrongType, count: '10'|'20'|'all', filters: { [facet]: [...] }, cycle }
   * onlyIds: 지정 시 해당 잡초만 (결과 화면의 "틀린 문제 다시 풀기")
   */
  function createSession(weeds, opts, onlyIds) {
    const type = typeOf(opts);
    let candidates;
    if (onlyIds) {
      const ids = new Set(onlyIds);
      candidates = weeds.filter((w) => ids.has(w.id) && (!MODES[type].photo || w.images.length));
    } else {
      candidates = pool(weeds, opts);
    }
    if (!candidates.length) return null;

    const limit = opts.count === 'all' ? Infinity : Number(opts.count);
    let selected;
    let key = null;
    let newRound = false;

    if (opts.cycle && !onlyIds && opts.mode !== 'wrong') {
      key = cycleKey(opts);
      const byId = new Map(candidates.map((w) => [w.id, w]));
      let remaining = (Storage.getCycle(key) || []).filter((id) => byId.has(id));
      if (!remaining.length) {
        remaining = candidates.map((w) => w.id);
        newRound = true;
      }
      Storage.setCycle(key, remaining);
      selected = shuffle(remaining).slice(0, limit).map((id) => byId.get(id));
    } else {
      selected = shuffle(candidates).slice(0, limit);
    }

    return {
      opts: { ...opts },
      type,
      questions: selected.map((w) => makeQuestion(w, type, weeds)),
      index: 0,
      score: 0,
      cycleKey: key,
      newRound,
      roundComplete: false,
    };
  }

  /* 헷갈리는 쌍(2~3개) 연습: 사진을 섞어 출제, 보기는 그 묶음의 이름만 */
  function createPairSession(pair, weeds, opts, count = 8) {
    const both = weeds.filter((w) => w.images.length > 0);
    if (both.length < 2 || both.length !== weeds.length) return null;
    const order = shuffle(Array.from({ length: count }, (_, i) => both[i % both.length]));
    const questions = order.map((w) => {
      const q = makeQuestion(w, 'choice', weeds);
      q.choices = shuffle(both);
      return q;
    });
    return {
      opts: { ...opts },
      type: 'choice',
      questions,
      index: 0,
      score: 0,
      cycleKey: null,
      newRound: false,
      roundComplete: false,
      pair,
    };
  }

  /* 이름 채점: 병해는 "배추 탄저병"처럼 기주를 붙여 써도 정답 */
  function nameMatches(text, w) {
    if (Grading.isNameCorrect(text, w.name)) return true;
    if (!w.host) return false;
    const t = Grading.normalize(text);
    return w.host.split('/').some((h) => {
      const hn = Grading.normalize(h);
      return hn && t.startsWith(hn) && Grading.isNameCorrect(t.slice(hn.length), w.name);
    });
  }

  /* 헷갈리는 쌍 전체 랜덤 연습: 문제마다 쌍 하나를 고르고, 보기는 그 쌍의 두 이름 */
  function createMixedPairSession(pairs, byId, opts, count = 20) {
    const usable = pairs
      .map((p) => p.ids.map((id) => byId.get(id)))
      .filter((ws) => ws.length >= 2 && ws.every((w) => w && w.images.length));
    if (!usable.length) return null;
    const questions = Array.from({ length: count }, () => {
      const both = usable[randInt(usable.length)];
      const q = makeQuestion(both[randInt(both.length)], 'choice', both);
      q.choices = shuffle(both);
      return q;
    });
    return {
      opts: { ...opts },
      type: 'choice',
      questions,
      index: 0,
      score: 0,
      cycleKey: null,
      newRound: false,
      roundComplete: false,
      pair: { mixed: true, ids: [] },
    };
  }

  /* 채점. answer: { text, choiceId, morph, life } */
  function grade(session, answer) {
    const q = session.questions[session.index];
    if (q.answered) return q;
    const w = q.weed;
    let parts;
    switch (q.type) {
      case 'write':
        parts = { name: nameMatches(answer.text, w) };
        break;
      case 'choice':
        parts = { name: answer.choiceId === w.id };
        break;
      case 'class':
        parts = { morph: answer.morph === w.morph, life: answer.life === w.life };
        break;
      case 'real':
        parts = {
          name: nameMatches(answer.text, w),
          morph: answer.morph === w.morph,
          life: answer.life === w.life,
        };
        break;
    }
    q.parts = parts;
    q.correct = Object.values(parts).every(Boolean);
    q.userAnswer = answer;
    q.answered = true;
    if (q.correct) session.score += 1;

    Storage.recordAnswer(w.id, q.correct);
    if (session.cycleKey) {
      const left = Storage.removeFromCycle(session.cycleKey, w.id);
      if (left === 0) session.roundComplete = true;
    }
    return q;
  }

  return { MODES, TYPES, shuffle, typeOf, pool, cycleKey, cycleRemaining, createSession, createPairSession, createMixedPairSession, grade };
})();

/* 출제·채점 엔진 (화면과 무관한 로직) */
const Quiz = (() => {
  const MODES = {
    write: { label: '사진 → 이름 쓰기', desc: '사진을 보고 이름을 직접 입력', photo: true },
    choice: { label: '사진 → 4지선다', desc: '같은 분류의 헷갈리는 보기 중 고르기', photo: true },
    class: { label: '이름 → 분류·생활형', desc: '이름을 보고 형태적 분류와 생활형 고르기', photo: false },
    real: { label: '실전 모드', desc: '사진 → 이름 + 분류 + 생활형 한꺼번에', photo: true },
    wrong: { label: '오답만 다시 풀기', desc: '틀린 뒤 아직 다시 맞히지 못한 잡초만', photo: false },
  };
  const TYPES = ['write', 'choice', 'class', 'real'];

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
    let list = weeds.filter((w) => opts.morphs.includes(w.morph) && opts.lifes.includes(w.life));
    if (MODES[type].photo) list = list.filter((w) => w.images.length > 0);
    if (opts.mode === 'wrong') {
      const wrong = new Set(Storage.getWrongIds());
      list = list.filter((w) => wrong.has(w.id));
    }
    return list;
  }

  function cycleKey(opts) {
    return [typeOf(opts), opts.morphs.join(','), opts.lifes.join(',')].join('|');
  }

  /* 한 바퀴 모드에서 이번 바퀴에 남은 수 (새 바퀴면 null) */
  function cycleRemaining(weeds, opts) {
    const ids = Storage.getCycle(cycleKey(opts));
    if (!ids) return null;
    const ok = new Set(pool(weeds, opts).map((w) => w.id));
    const n = ids.filter((id) => ok.has(id)).length;
    return n || null;
  }

  /* 4지선다 보기: 같은 형태적 분류 우선 */
  function makeChoices(weed, all) {
    const names = new Set([weed.name]);
    const pick = [];
    const same = shuffle(all.filter((w) => w.id !== weed.id && w.morph === weed.morph));
    const other = shuffle(all.filter((w) => w.id !== weed.id && w.morph !== weed.morph));
    for (const w of [...same, ...other]) {
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
   * opts: { mode, wrongType, count: '10'|'20'|'all', morphs, lifes, cycle }
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

  /* 채점. answer: { text, choiceId, morph, life } */
  function grade(session, answer) {
    const q = session.questions[session.index];
    if (q.answered) return q;
    const w = q.weed;
    let parts;
    switch (q.type) {
      case 'write':
        parts = { name: Grading.isNameCorrect(answer.text, w.name) };
        break;
      case 'choice':
        parts = { name: answer.choiceId === w.id };
        break;
      case 'class':
        parts = { morph: answer.morph === w.morph, life: answer.life === w.life };
        break;
      case 'real':
        parts = {
          name: Grading.isNameCorrect(answer.text, w.name),
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

  return { MODES, TYPES, shuffle, typeOf, pool, cycleKey, cycleRemaining, createSession, grade };
})();

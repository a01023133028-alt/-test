/* localStorage 래퍼: 누적 기록, 오답 목록, 한 바퀴 진행, 설정 */
const Storage = (() => {
  const PREFIX = 'weedquiz:';

  /* 잡초 기록은 예전 키 그대로, 병해 등 다른 과목은 'disease:' 같은 접두어를 붙인다 */
  function fullKey(key) {
    const ns = key === 'theme' || typeof Subject === 'undefined' ? '' : Subject.storageNs;
    return PREFIX + ns + key;
  }

  function get(key, fallback) {
    try {
      const raw = localStorage.getItem(fullKey(key));
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(fullKey(key), JSON.stringify(value));
    } catch (e) {
      /* 저장 공간 부족·사생활 보호 모드 등은 무시 */
    }
  }

  function remove(key) {
    try {
      localStorage.removeItem(fullKey(key));
    } catch (e) {}
  }

  /* 잡초별 누적 기록: { [id]: { tries, correct, last } } */
  function getStats() {
    return get('stats', {});
  }

  function recordAnswer(id, isCorrect) {
    const stats = getStats();
    const r = stats[id] || { tries: 0, correct: 0 };
    r.tries += 1;
    if (isCorrect) r.correct += 1;
    r.last = isCorrect;
    stats[id] = r;
    set('stats', stats);

    // 오답 목록: 틀리면 추가, 맞히면 제거
    const wrong = new Set(getWrongIds());
    if (isCorrect) wrong.delete(id);
    else wrong.add(id);
    set('wrong', [...wrong]);
  }

  function getWrongIds() {
    return get('wrong', []);
  }

  /* 암기 체크: 확실히 외운 id 목록 (기록 초기화와 별개로 유지) */
  function getMastered() {
    return new Set(get('mastered', []));
  }

  function setMastered(id, on) {
    const s = getMastered();
    if (on) s.add(id);
    else s.delete(id);
    set('mastered', [...s]);
    return s;
  }

  function clearMastered() {
    remove('mastered');
  }

  /* 한 바퀴 모드: 출제 조건별로 아직 안 나온 id 목록 */
  function getCycle(key) {
    return get('cycles', {})[key] || null;
  }

  function setCycle(key, ids) {
    const cycles = get('cycles', {});
    if (ids && ids.length) cycles[key] = ids;
    else delete cycles[key];
    set('cycles', cycles);
  }

  function removeFromCycle(key, id) {
    const ids = getCycle(key);
    if (!ids) return 0;
    const rest = ids.filter((x) => x !== id);
    setCycle(key, rest);
    return rest.length;
  }

  function resetRecords() {
    remove('stats');
    remove('wrong');
    remove('cycles');
  }

  return {
    get,
    set,
    remove,
    getStats,
    recordAnswer,
    getWrongIds,
    getCycle,
    setCycle,
    removeFromCycle,
    resetRecords,
    getMastered,
    setMastered,
    clearMastered,
  };
})();

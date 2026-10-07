/* 데이터 로드·검증과 분류 상수 */
const Data = (() => {
  const MORPHS = ['화본과', '방동사니과', '광엽잡초'];
  const LIFES = ['하계일년생', '동계일년생', '월년생', '다년생'];

  const MORPH_CLASS = { 화본과: 'm-grass', 방동사니과: 'm-sedge', 광엽잡초: 'm-broad' };
  const LIFE_CLASS = {
    하계일년생: 'l-summer',
    동계일년생: 'l-winter',
    월년생: 'l-winter',
    다년생: 'l-perennial',
  };

  const CREDITS_URL = 'data/credits.json';
  const PAIRS_URL = 'data/pairs.json';
  const CACHE_KEY = 'cachedData';

  /* JSON 배열을 검사해 정리된 목록과 경고 메시지를 돌려줌 */
  function validate(raw) {
    if (!Array.isArray(raw)) throw new Error('데이터 파일의 최상위는 배열([ ])이어야 합니다.');
    const warnings = [];
    const seen = new Set();
    const weeds = [];
    raw.forEach((w, i) => {
      const where = `${i + 1}번째 항목`;
      if (!w || typeof w !== 'object') {
        warnings.push(`${where}: 객체가 아니라서 건너뜀`);
        return;
      }
      const id = Number(w.id);
      if (!Number.isFinite(id)) {
        warnings.push(`${where}: id가 숫자가 아니라서 건너뜀`);
        return;
      }
      if (seen.has(id)) {
        warnings.push(`${where}: id ${id} 중복이라서 건너뜀`);
        return;
      }
      if (!w.name || typeof w.name !== 'string') {
        warnings.push(`${where}: name이 없어서 건너뜀`);
        return;
      }
      const item = {
        id,
        name: w.name.trim(),
        features: typeof w.features === 'string' ? w.features.trim() : '',
        images: Array.isArray(w.images) ? w.images.filter((p) => typeof p === 'string' && p.trim()) : [],
      };
      Subject.facets.forEach((f) => {
        if (!f.values.includes(w[f.key])) warnings.push(`${w.name}: ${f.key} "${w[f.key]}"는 알 수 없는 값`);
        item[f.key] = w[f.key];
      });
      // 병해 전용: 기주·병원
      if (typeof w.host === 'string' && w.host.trim()) item.host = w.host.trim();
      if (typeof w.pathogen === 'string' && w.pathogen.trim()) item.pathogen = w.pathogen.trim();
      seen.add(id);
      weeds.push(item);
    });
    weeds.sort((a, b) => a.id - b.id);
    return { weeds, warnings };
  }

  /* 서버에서 불러오기. 실패하면(file:// 등) 이전에 파일 선택으로 저장한 데이터 사용 */
  async function load() {
    try {
      const res = await fetch(Subject.dataUrl, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return { ...validate(json), source: 'server' };
    } catch (err) {
      const cached = Storage.get(CACHE_KEY, null);
      if (cached) return { ...validate(cached), source: 'cache' };
      const e = new Error(`${Subject.dataUrl}을 불러오지 못했습니다.`);
      e.cause = err;
      throw e;
    }
  }

  /* 사용자가 고른 weeds.json 파일 읽기 → 브라우저에 저장 */
  function loadFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const json = JSON.parse(reader.result);
          const result = validate(json);
          Storage.set(CACHE_KEY, json);
          resolve({ ...result, source: 'file' });
        } catch (err) {
          reject(new Error('JSON 형식이 올바르지 않습니다: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
      reader.readAsText(file, 'utf-8');
    });
  }

  /* 사진 출처 (없어도 동작) */
  async function loadCredits() {
    try {
      const res = await fetch(CREDITS_URL, { cache: 'no-cache' });
      return res.ok ? await res.json() : {};
    } catch (e) {
      return {};
    }
  }

  /* 헷갈리는 쌍 [{ ids: [a, b], a, b, common }] (없어도 동작) */
  async function loadPairs() {
    if (!Subject.hasPairs) return [];
    try {
      const res = await fetch(PAIRS_URL, { cache: 'no-cache' });
      const json = res.ok ? await res.json() : [];
      return Array.isArray(json) ? json.filter((p) => Array.isArray(p.ids) && p.ids.length === 2) : [];
    } catch (e) {
      return [];
    }
  }

  function clearCache() {
    Storage.remove(CACHE_KEY);
  }

  return { MORPHS, LIFES, MORPH_CLASS, LIFE_CLASS, validate, load, loadFromFile, loadCredits, loadPairs, clearCache };
})();

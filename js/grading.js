/* 주관식 이름 채점: 띄어쓰기 무시, 괄호 별칭 허용 */
const Grading = (() => {
  function normalize(text) {
    return String(text || '')
      .normalize('NFC')
      .replace(/（/g, '(')
      .replace(/）/g, ')')
      .replace(/\s+/g, '')
      .toLowerCase();
  }

  /* "토끼풀(클로버)" → ["토끼풀(클로버)", "토끼풀", "클로버"] */
  function aliases(name) {
    const set = new Set([name]);
    const base = name.replace(/[(（][^)）]*[)）]/g, '');
    if (base.trim()) set.add(base);
    const re = /[(（]([^)）]*)[)）]/g;
    let m;
    while ((m = re.exec(name))) {
      m[1].split(/[,，/·]/).forEach((a) => {
        if (a.trim()) set.add(a);
      });
    }
    return [...set].map(normalize).filter(Boolean);
  }

  function isNameCorrect(input, name) {
    const answer = normalize(input);
    if (!answer) return false;
    return aliases(name).includes(answer);
  }

  return { normalize, aliases, isNameCorrect };
})();

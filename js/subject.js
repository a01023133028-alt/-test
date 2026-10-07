/* 과목 설정: 잡초(기본) / 병해(?s=disease). 화면 문구·데이터 파일·분류 기준이 여기서 갈린다 */
const Subject = (() => {
  const isDisease = new URLSearchParams(location.search).get('s') === 'disease';
  const base = location.pathname;

  const WEED = {
    id: 'weed',
    title: '잡초 사진 퀴즈',
    brand: '🌱 잡초 퀴즈',
    noun: '잡초',
    unit: '종',
    nameLabel: '이름',
    placeholder: '잡초 이름 입력',
    dataUrl: 'data/weeds.json',
    storageNs: '',
    types: ['write', 'choice', 'class', 'real'],
    // 분류 기준(출제 범위 필터·태그·도감 묶음)
    facets: [
      { key: 'morph', label: '형태적 분류', values: Data.MORPHS, cls: Data.MORPH_CLASS },
      { key: 'life', label: '생활형', values: Data.LIFES, cls: Data.LIFE_CLASS },
    ],
    // 4지선다 오답 보기를 먼저 뽑을 기준 (앞에 있을수록 우선)
    similarKeys: ['morph'],
    dexGroups: [
      { key: 'morph', label: '분류별', inner: 'life' },
      { key: 'life', label: '생활형별', inner: 'morph' },
    ],
    hasPairs: true,
  };

  const DISEASE = {
    id: 'disease',
    title: '병해 사진 퀴즈',
    brand: '🦠 병해 퀴즈',
    noun: '병해',
    unit: '개',
    nameLabel: '병명',
    placeholder: '병명 입력 (예: 탄저병)',
    dataUrl: 'data/diseases.json',
    storageNs: 'disease:',
    types: ['write', 'choice'],
    facets: [
      {
        key: 'crop',
        label: '작물 구분',
        values: ['식량작물', '채소', '과수', '수목'],
        cls: { 식량작물: 'c-food', 채소: 'c-veg', 과수: 'c-fruit', 수목: 'c-tree' },
      },
    ],
    similarKeys: ['host', 'crop'],
    dexGroups: [
      { key: 'crop', label: '작물별', inner: 'host' },
      { key: 'name', label: '병명별', inner: null },
    ],
    showHost: true,
    hasPairs: false,
  };

  // 다른 과목으로 가는 링크는 서로 반대쪽을 가리킨다
  WEED.other = { href: base + '?s=disease#home', label: '🦠 병해' };
  DISEASE.other = { href: base + '#home', label: '🌱 잡초' };

  return isDisease ? DISEASE : WEED;
})();

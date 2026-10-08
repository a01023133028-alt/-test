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
    eyebrow: '잡초 식별 시험 대비',
    heroIcon: '🌿',
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
    pairsUrl: 'data/pairs.json',
    // 비교 탭: 헷갈리는 이유별 묶음 (kind가 없는 쌍은 첫 번째)
    pairKinds: [
      { key: '생김새', desc: '모양이 비슷해서 사진으로 헷갈리는 쌍' },
      { key: '이름', desc: '이름이 비슷하거나 세트로 외우는 쌍' },
      { key: '생활형·분류', desc: '비슷한데 생활형·분류가 달라 함정이 되는 쌍' },
      { key: '키워드', desc: '같은 키워드로 묶여서 헷갈리는 쌍' },
    ],
  };

  const DISEASE = {
    id: 'disease',
    title: '병해 사진 퀴즈',
    brand: '🦠 병해 퀴즈',
    noun: '병해',
    unit: '개',
    nameLabel: '병명',
    placeholder: '병명 입력 (예: 탄저병)',
    eyebrow: '식물 병해 시험 대비',
    heroIcon: '🍃',
    dataUrl: 'data/diseases.json',
    storageNs: 'disease:',
    types: ['write', 'choice', 'pathogen'],
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
      { key: 'pathogen', label: '병원별', inner: 'crop' },
      { key: 'name', label: '병명별', inner: null },
    ],
    // 도감 묶음 순서 (여기 없는 값은 뒤에 가나다순)
    groupOrder: {
      pathogen: [
        '곰팡이(병꼴균)', '곰팡이(접합균)', '곰팡이(자낭균)', '곰팡이(담자균)', '곰팡이(불완전균)',
        '난균류', '세균', '파이토플라스마', '바이러스', '바이로이드',
      ],
    },
    showHost: true,
    pairsUrl: 'data/disease-pairs.json',
    pairKinds: [
      { key: '같은 병명', desc: '병명은 같은데 기주마다 모습이 다른 묶음' },
      { key: '병징', desc: '병든 모습이 비슷해서 사진으로 헷갈리는 쌍' },
      { key: '같은 기주', desc: '한 작물에 생기는 병끼리 헷갈리는 쌍' },
      { key: '병원', desc: '이름은 비슷한데 병원이 달라 함정이 되는 쌍' },
    ],
  };

  // 다른 과목으로 가는 링크는 서로 반대쪽을 가리킨다
  WEED.other = { href: base + '?s=disease#home', label: '🦠 병해' };
  DISEASE.other = { href: base + '#home', label: '🌱 잡초' };

  return isDisease ? DISEASE : WEED;
})();

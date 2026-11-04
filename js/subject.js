/* 과목 설정: 잡초(기본) / 병해(?s=disease) / 해충(?s=pest). 화면 문구·데이터 파일·분류 기준이 여기서 갈린다 */
const Subject = (() => {
  const sid = new URLSearchParams(location.search).get('s');
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
    source: '잡초 사진과 이름·특징은 작물병충해 수업 자료를 바탕으로 만들었고, 추가 사진은 iNaturalist 등 공개 자료입니다.',
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
    source: '병해 사진·병명·기주는 작물병충해 수업 자료를 바탕으로 만들었고, 병원 분류는 수업에서 알려주신 병원 표 기준입니다. 추가 사진은 iNaturalist·PlantVillage 등 공개 자료입니다.',
    storageNs: 'disease:',
    types: ['write', 'choice', 'classify'],
    modes: {
      write: { label: '사진 → 병명 쓰기', desc: '사진과 기주를 보고 병명을 직접 입력' },
      choice: { label: '사진 → 4지선다', desc: '같은 기주·작물의 헷갈리는 병명 중 고르기' },
    },
    // 분류 고르기 문제(병명 → 병원). key는 데이터 필드, keyAlt 필드는 함께 인정하는 답
    classify: {
      key: 'pathogen',
      label: '병원',
      icon: '🦠',
      mode: '병명 → 병원 고르기',
      desc: '병명·기주·사진을 보고 곰팡이(5종)·난균류·세균·바이러스 등 고르기',
      ask: '이 병해의 병원은?',
      cls: (p) => (p.startsWith('곰팡이') ? 'p-fungus' : p.startsWith('난균') ? 'p-oomycete' : p.startsWith('세균') ? 'p-bacteria'
        : p.startsWith('바이러스') ? 'p-virus' : p.startsWith('점균') ? 'p-slime' : 'p-other'),
    },
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
      // 병원별: 같은 병명(탄저병 4개 등)은 카드 한 장으로 겹쳐 두고 옆으로 넘겨 봄. 병명 하나 → 병원 하나로 외우기 좋게
      { key: 'pathogen', label: '병원별', inner: null, stack: 'name' },
      { key: 'name', label: '병명별', inner: null },
    ],
    // 도감 묶음 순서 (여기 없는 값은 뒤에 가나다순)
    groupOrder: {
      pathogen: [
        '곰팡이(병꼴균)', '곰팡이(접합균)', '곰팡이(자낭균)', '곰팡이(담자균)', '곰팡이(불완전균)',
        '점균류(원생생물계)', '난균류', '세균', '파이토플라즈마', '바이러스', '바이로이드',
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

  const PEST_ORDERS = ['나비목', '딱정벌레목', '노린재목', '파리목', '총채벌레목', '메뚜기목', '톡토기목',
    '응애류(거미강)', '달팽이류(연체동물)', '쥐며느리류(갑각류)'];
  const PEST_ORDER_CLS = {
    나비목: 'p-fungus', 딱정벌레목: 'p-oomycete', 노린재목: 'p-bacteria', 파리목: 'p-virus', 총채벌레목: 'p-slime',
  };

  const PEST = {
    id: 'pest',
    title: '해충 사진 퀴즈',
    brand: '🐛 해충 퀴즈',
    noun: '해충',
    unit: '종',
    nameLabel: '이름',
    placeholder: '해충 이름 입력 (예: 배추흰나비)',
    eyebrow: '작물 해충 시험 대비',
    heroIcon: '🐞',
    dataUrl: 'data/pests.json',
    source: '해충 사진·이름은 작물병충해 수업 자료를 바탕으로 만들었고, 분류(목)·특징은 수업 메모와 일반 교재를 참고해 정리했습니다.',
    storageNs: 'pest:',
    types: ['write', 'choice', 'classify'],
    modes: {
      write: { label: '사진 → 이름 쓰기', desc: '사진을 보고 해충 이름을 직접 입력' },
      choice: { label: '사진 → 4지선다', desc: '같은 목·가해 방식의 헷갈리는 해충 중 고르기' },
    },
    classify: {
      key: 'order',
      label: '분류(목)',
      icon: '🏷️',
      mode: '이름 → 분류(목) 고르기',
      desc: '이름·사진을 보고 나비목·딱정벌레목·노린재목·응애류 등 고르기',
      ask: '이 해충은 어느 무리?',
      cls: (v) => PEST_ORDER_CLS[v] || 'p-other',
    },
    facets: [
      {
        key: 'feed',
        label: '가해 방식',
        values: ['흡즙형', '저작형'],
        cls: { 흡즙형: 'c-fruit', 저작형: 'c-food' },
      },
    ],
    similarKeys: ['order', 'feed'],
    dexGroups: [
      { key: 'order', label: '분류(목)별', inner: null },
      { key: 'feed', label: '가해 방식별', inner: 'order' },
      { key: 'name', label: '이름별', inner: null },
    ],
    groupOrder: { order: PEST_ORDERS },
    showHost: true,
    pairsUrl: 'data/pest-pairs.json',
    pairKinds: [
      { key: '생김새', desc: '모양이 비슷해서 사진으로 헷갈리는 쌍' },
      { key: '같은 무리', desc: '같은 무리(진딧물·총채벌레·응애 등)끼리 구분하는 묶음' },
      { key: '가해 방식', desc: '가해하는 부위·방식이 비슷해서 헷갈리는 묶음' },
    ],
  };

  // 상단 바: 지금 과목을 뺀 나머지 과목으로 가는 링크
  const ALL = [
    [WEED, base + '#home', '🌱 잡초'],
    [DISEASE, base + '?s=disease#home', '🦠 병해'],
    [PEST, base + '?s=pest#home', '🐛 해충'],
  ];
  const cur = sid === 'disease' ? DISEASE : sid === 'pest' ? PEST : WEED;
  cur.others = ALL.filter(([s]) => s !== cur).map(([, href, label]) => ({ href, label }));
  return cur;
})();

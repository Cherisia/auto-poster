/**
 * serenkit 계산기 정의 및 내부 링크 그룹
 */

export const CALCULATOR_GROUPS = {
  finance: {
    name: '💰 금융·세금',
    naver_category: '지식·동향 > 비즈니스·경제',
    calculators: ['salary', 'hourly', 'severance', 'unemployment', 'loan', 'income-tax', 'vat'],
  },
  date: {
    name: '📅 날짜·생활',
    naver_category: '지식·동향 > 생활정보',
    calculators: ['age', 'dday', 'anniversary', 'business-days', 'date-diff', 'date-add', 'period'],
  },
  health: {
    name: '🌿 건강·일상',
    naver_category: '지식·동향 > 생활정보',
    calculators: ['calorie', 'weight', 'pyeong', 'unit', 'char-count'],
  },
  fun: {
    name: '🎯 재미·기타',
    naver_category: '지식·동향 > 생활정보',
    calculators: ['lotto', 'mbti', 'zodiac', 'lunar'],
  },
};

export const CALCULATORS = {
  'salary': {
    id: 'salary', name: '월급 실수령액 계산기', url: '/cal/salary/',
    group: 'finance',
    example_params: '?gross=3000000&dependents=1',
    description: '세전 월급을 입력하면 4대보험·소득세 공제 후 실수령액, 세율, 각 공제 항목을 즉시 계산',
  },
  'hourly': {
    id: 'hourly', name: '시급 계산기', url: '/cal/hourly/',
    group: 'finance',
    example_params: '?hourlyWage=10030&hoursPerDay=8&daysPerWeek=5',
    description: '시급·근무시간을 입력하면 일급·주급·월급·연봉을 즉시 계산',
  },
  'severance': {
    id: 'severance', name: '퇴직금 계산기', url: '/cal/severance/',
    group: 'finance',
    example_params: '?startDate=2020-01-01&endDate=2026-04-13&monthlyWage=3000000',
    description: '입사일·퇴직일·월급여를 입력하면 퇴직금을 즉시 계산',
  },
  'unemployment': {
    id: 'unemployment', name: '실업급여 계산기', url: '/cal/unemployment/',
    group: 'finance',
    example_params: '?exitDate=2026-04-13&age=35&insuredPeriod=24&monthlyWage=3000000&hoursPerDay=8&isDisabled=0',
    description: '퇴직일·나이·가입기간·월급여를 입력하면 실업급여 수급액과 기간을 즉시 계산',
  },
  'loan': {
    id: 'loan', name: '대출 이자 계산기', url: '/cal/loan/',
    group: 'finance',
    example_params: '?principal=100000000&rate=4.5&years=360&method=equal-payment',
    description: '대출금액·금리·기간·상환방식을 입력하면 월 상환액과 총 이자를 즉시 계산',
  },
  'income-tax': {
    id: 'income-tax', name: '종합소득세 계산기', url: '/cal/income-tax/',
    group: 'finance',
    example_params: '?incomeType=0&grossIncome=50000000&basicCount=1',
    description: '소득 유형·총소득·공제 항목을 입력하면 종합소득세 산출세액과 공제 내역을 즉시 계산',
  },
  'vat': {
    id: 'vat', name: '부가세 계산기', url: '/cal/vat/',
    group: 'finance',
    example_params: '?mode=add&amount=1000000',
    description: '공급가액 또는 합계금액을 입력하면 부가세(10%)를 즉시 계산, 역산도 가능',
  },
  'age': {
    id: 'age', name: '만 나이 계산기', url: '/cal/age/',
    group: 'date',
    example_params: '?birth=1990-05-15&base=2026-04-13',
    description: '생년월일을 입력하면 만 나이, 세는 나이, 연 나이를 즉시 계산 (2023년 법 개정 기준)',
  },
  'dday': {
    id: 'dday', name: 'D-day 계산기', url: '/cal/dday/',
    group: 'date',
    example_params: '?targetDate=2026-12-25&baseDate=2026-04-13&label=크리스마스',
    description: '목표 날짜를 입력하면 D-day를 즉시 계산, 수능·전역일·기념일 등에 활용',
  },
  'anniversary': {
    id: 'anniversary', name: '기념일 계산기', url: '/cal/anniversary/',
    group: 'date',
    example_params: '?start=2025-01-01',
    description: '시작일을 입력하면 100일·200일·1주년·2주년 등 기념일 날짜를 모두 자동 계산',
  },
  'business-days': {
    id: 'business-days', name: '평일(영업일) 계산기', url: '/cal/business-days/',
    group: 'date',
    example_params: '?start=2026-04-01&end=2026-04-30&exHol=1',
    description: '기간을 입력하면 주말·공휴일을 제외한 영업일 수를 즉시 계산',
  },
  'date-diff': {
    id: 'date-diff', name: '날짜 차이 계산기', url: '/cal/date-diff/',
    group: 'date',
    example_params: '?start=2026-01-01&end=2026-12-31&includeEnd=1',
    description: '두 날짜를 입력하면 일수·주·년월일로 차이를 즉시 계산, 종료일 포함 여부 선택 가능',
  },
  'date-add': {
    id: 'date-add', name: '날짜 더하기·빼기 계산기', url: '/cal/date-add/',
    group: 'date',
    example_params: '?base=2026-01-01&mode=%2B&months=6',
    description: '기준 날짜에 년·월·일을 더하거나 빼서 결과 날짜를 즉시 계산',
  },
  'period': {
    id: 'period', name: '생리주기 계산기', url: '/cal/period/',
    group: 'health',
    example_params: '?lastDate=2026-03-20&cycleLen=28&periodLen=5',
    description: '마지막 생리일과 주기를 입력하면 다음 생리 예정일과 가임기를 즉시 계산',
  },
  'calorie': {
    id: 'calorie', name: '기초대사량(칼로리) 계산기', url: '/cal/calorie/',
    group: 'health',
    example_params: '?gender=M&age=30&height=175&weight=70&activity=moderately',
    description: '성별·나이·키·체중·활동량을 입력하면 기초대사량(BMR)과 일일 권장 칼로리를 즉시 계산',
  },
  'weight': {
    id: 'weight', name: '적정 체중 계산기', url: '/cal/weight/',
    group: 'health',
    example_params: '?height=170&weight=65&gender=M',
    description: '키와 체중을 입력하면 BMI·적정체중·비만도를 즉시 계산',
  },
  'pyeong': {
    id: 'pyeong', name: '평수 계산기', url: '/cal/pyeong/',
    group: 'health',
    example_params: '?active=pyeong&pyeong=25',
    description: '평수와 제곱미터(㎡)를 양방향으로 즉시 변환',
  },
  'unit': {
    id: 'unit', name: '단위 변환기', url: '/cal/unit/',
    group: 'health',
    example_params: '?catKey=length&fromUnit=km&inputVal=10',
    description: '길이·무게·온도·면적·부피·속도·데이터 등 다양한 단위를 즉시 변환',
  },
  'char-count': {
    id: 'char-count', name: '글자수 세기', url: '/cal/char-count/',
    group: 'health',
    example_params: '?text=안녕하세요+serenkit+글자수+세기+테스트',
    description: '텍스트를 입력하면 공백 포함/제외 글자수, 단어수, 줄수를 즉시 계산',
  },
  'lotto': {
    id: 'lotto', name: '로또 번호 추첨기', url: '/cal/lotto/',
    group: 'fun',
    example_params: '',
    description: '로또 번호를 랜덤으로 즉시 생성, 여러 게임 동시 생성 가능',
  },
  'mbti': {
    id: 'mbti', name: 'MBTI 궁합 계산기', url: '/cal/mbti/',
    group: 'fun',
    example_params: '?typeA=INFJ&typeB=ENFP',
    description: '두 MBTI 유형을 입력하면 궁합 점수와 관계 유형 분석을 즉시 확인',
  },
  'zodiac': {
    id: 'zodiac', name: '띠·별자리 계산기', url: '/cal/zodiac/',
    group: 'fun',
    example_params: '?birth=1990-05-15',
    description: '생년월일을 입력하면 띠(12간지)와 별자리를 즉시 확인',
  },
  'lunar': {
    id: 'lunar', name: '양력 음력 변환기', url: '/cal/lunar/',
    group: 'fun',
    example_params: '?tab=solar&solarYear=2026&solarMonth=4&solarDay=13',
    description: '양력↔음력을 즉시 변환, 윤달 여부도 자동 확인',
  },
};

/**
 * 완료된 포스팅 목록 (티스토리 포스트 번호 포함)
 * tistory_no: 실제 발행 후 업데이트 필요
 */
export const COMPLETED_POSTS = [
  { id: 'salary',        tistory_no: null, date: '2026-03-30' },
  { id: 'unemployment',  tistory_no: null, date: '2026-04-01' },
  { id: 'severance',     tistory_no: null, date: '2026-04-02' },
  { id: 'loan',          tistory_no: null, date: '2026-04-03' },
  { id: 'hourly',        tistory_no: null, date: '2026-04-04' },
  { id: 'income-tax',    tistory_no: null, date: '2026-04-05' },
  { id: 'vat',           tistory_no: null, date: '2026-04-06' },
  { id: 'age',           tistory_no: 18,   date: '2026-04-07' },
  { id: 'dday',          tistory_no: 19,   date: '2026-04-07' },
  { id: 'anniversary',   tistory_no: 20,   date: '2026-04-09' },
  { id: 'business-days', tistory_no: 21,   date: '2026-04-10' },
  { id: 'date-diff',     tistory_no: 22,   date: '2026-04-12' },
];

/**
 * 대기 중인 포스팅 순서
 */
export const POST_QUEUE = [
  'date-add',
  'period',
  'calorie',
  'weight',
  'pyeong',
  'unit',
  'char-count',
  'lotto',
  'lunar',
  'zodiac',
  'mbti',
];

/**
 * serenkit 이미지 캡처 모듈
 * image-capture 프로젝트의 핵심 로직을 ESM으로 이식.
 * captureImages(toolId, outDir) 를 호출하면
 * outDir/serenkit-input.png + serenkit-result.png 를 생성한다.
 */

import puppeteer from 'puppeteer';
import { join }  from 'path';
import { readConfig } from '../core/config.js';

// ─── serenkit 도구 목록 ──────────────────────────────────────────────────────
const TOOLS = [
  // 날짜·시간
  { id: 'dday',           name: 'D-day 계산기',           category: '날짜·시간',  url: '/cal/dday/',           hasUrlParams: true,
    params: [{ key: 'targetDate' }, { key: 'baseDate' }, { key: 'label' }],
    example: '2026-12-25 2026-04-13 크리스마스' },
  { id: 'date-diff',      name: '날짜 차이 계산기',        category: '날짜·시간',  url: '/cal/date-diff/',      hasUrlParams: true,
    params: [{ key: 'start' }, { key: 'end' }, { key: 'includeEnd' }],
    example: '2026-01-01 2026-12-31 1' },
  { id: 'date-add',       name: '날짜 더하기/빼기',         category: '날짜·시간',  url: '/cal/date-add/',       hasUrlParams: true,
    params: [{ key: 'base' }, { key: 'mode' }, { key: 'years' }, { key: 'months' }, { key: 'days' }, { key: 'includeToday' }],
    example: '2026-01-01 + 0 6 0 0' },
  { id: 'business-days',  name: '영업일 계산기',            category: '날짜·시간',  url: '/cal/business-days/',  hasUrlParams: true,
    params: [{ key: 'start' }, { key: 'end' }, { key: 'exHol' }],
    example: '2026-04-01 2026-04-30 1' },
  { id: 'age',            name: '만 나이 계산기',           category: '날짜·시간',  url: '/cal/age/',            hasUrlParams: true,
    params: [{ key: 'birth' }, { key: 'base' }],
    example: '1990-05-15 2026-04-13' },
  { id: 'anniversary',    name: '기념일 계산기',            category: '날짜·시간',  url: '/cal/anniversary/',    hasUrlParams: true,
    params: [{ key: 'start' }],
    example: '2025-12-25' },
  { id: 'lunar',          name: '양력 음력 변환기',         category: '날짜·시간',  url: '/cal/lunar/',          hasUrlParams: true,
    params: [{ key: 'tab' }, { key: 'solarYear' }, { key: 'solarMonth' }, { key: 'solarDay' }, { key: 'lunarYear' }, { key: 'lunarMonth' }, { key: 'lunarDay' }, { key: 'isIntercalation' }],
    example: 'solar 2026 4 13' },

  // 건강·신체
  { id: 'weight',   name: '적정 체중 계산기',  category: '건강·신체', url: '/cal/weight/',  hasUrlParams: true,
    params: [{ key: 'height' }, { key: 'weight' }, { key: 'gender' }], example: '170 65 M' },
  { id: 'calorie',  name: '기초대사량 계산기', category: '건강·신체', url: '/cal/calorie/', hasUrlParams: true,
    params: [{ key: 'gender' }, { key: 'age' }, { key: 'height' }, { key: 'weight' }, { key: 'activity' }], example: 'M 30 175 70 moderately' },
  { id: 'period',   name: '생리주기 계산기',   category: '건강·신체', url: '/cal/period/',  hasUrlParams: true,
    params: [{ key: 'lastDate' }, { key: 'cycleLen' }, { key: 'periodLen' }], example: '2026-03-20 28 5' },

  // 금융·급여
  { id: 'salary',       name: '월급 실수령액 계산기', category: '금융·급여', url: '/cal/salary/',       hasUrlParams: true,
    params: [{ key: 'gross' }, { key: 'dependents' }], example: '3000000 1' },
  { id: 'severance',    name: '퇴직금 계산기',        category: '금융·급여', url: '/cal/severance/',    hasUrlParams: true,
    params: [{ key: 'startDate' }, { key: 'endDate' }, { key: 'monthlyWage' }, { key: 'annualBonus' }, { key: 'annualLeave' }], example: '2020-01-01 2026-04-13 3000000' },
  { id: 'unemployment', name: '실업급여 계산기',       category: '금융·급여', url: '/cal/unemployment/', hasUrlParams: true,
    params: [{ key: 'exitDate' }, { key: 'age' }, { key: 'insuredPeriod' }, { key: 'monthlyWage' }, { key: 'hoursPerDay' }, { key: 'isDisabled' }], example: '2026-04-13 35 24 3000000 8 0' },
  { id: 'hourly',       name: '시급 계산기',           category: '금융·급여', url: '/cal/hourly/',       hasUrlParams: true,
    params: [{ key: 'hourlyWage' }, { key: 'hoursPerDay' }, { key: 'daysPerWeek' }], example: '10030 8 5' },
  { id: 'loan',         name: '대출 이자 계산기',      category: '금융·급여', url: '/cal/loan/',         hasUrlParams: true,
    params: [{ key: 'principal' }, { key: 'rate' }, { key: 'years' }, { key: 'method' }], example: '100000000 4.5 360 equal-payment' },
  { id: 'vat',          name: '부가세 계산기',          category: '금융·급여', url: '/cal/vat/',          hasUrlParams: true,
    params: [{ key: 'mode' }, { key: 'amount' }], example: 'add 1000000' },
  { id: 'income-tax',   name: '종합소득세 계산기',     category: '금융·급여', url: '/cal/income-tax/',   hasUrlParams: true,
    params: [{ key: 'incomeType' }, { key: 'grossIncome' }, { key: 'basicCount' }, { key: 'elderCount' }, { key: 'disabledCount' }, { key: 'pension' }, { key: 'annuity' }, { key: 'childCount' }, { key: 'otherDeduction' }], example: '0 50000000 1' },

  // 운세·라이프
  { id: 'zodiac', name: '띠/별자리 계산기',  category: '운세·라이프', url: '/cal/zodiac/', hasUrlParams: true,
    params: [{ key: 'birth' }], example: '1990-05-15' },
  { id: 'mbti',   name: 'MBTI 궁합 계산기', category: '운세·라이프', url: '/cal/mbti/',   hasUrlParams: true,
    params: [{ key: 'typeA' }, { key: 'typeB' }], example: 'INFJ ENFP' },
  { id: 'lotto',  name: '로또 추첨기',       category: '운세·라이프', url: '/cal/lotto/',  hasUrlParams: false },

  // 유틸리티
  { id: 'char-count', name: '글자수 세기',  category: '유틸리티', url: '/cal/char-count/', hasUrlParams: true,
    params: [{ key: 'text' }], example: '안녕하세요 세렌킷 글자수 세기 테스트입니다' },
  { id: 'pyeong',     name: '평수 계산기',  category: '유틸리티', url: '/cal/pyeong/',     hasUrlParams: true,
    params: [{ key: 'active' }, { key: 'pyeong' }, { key: 'sqm' }], example: 'pyeong 25' },
  { id: 'unit',       name: '단위 변환기',  category: '유틸리티', url: '/cal/unit/',       hasUrlParams: true,
    params: [{ key: 'catKey' }, { key: 'fromUnit' }, { key: 'inputVal' }], example: 'length km 10' },

  // 색상 도구 (URL 파라미터 없음)
  { id: 'color-picker',        name: '색상 피커',           category: '색상 도구',  url: '/color/color-picker/',        hasUrlParams: false },
  { id: 'color-converter',     name: '색상 포맷 변환기',    category: '색상 도구',  url: '/color/color-converter/',     hasUrlParams: false },
  { id: 'color-extractor',     name: '이미지 색상 추출',    category: '색상 도구',  url: '/color/color-extractor/',     hasUrlParams: false },
  { id: 'color-names',         name: '색상 이름 찾기',      category: '색상 도구',  url: '/color/color-names/',         hasUrlParams: false },
  { id: 'contrast-checker',    name: '명도 대비 검사기',    category: '색상 도구',  url: '/color/contrast-checker/',    hasUrlParams: false },
  { id: 'gradient-generator',  name: '그라디언트 생성기',   category: '색상 도구',  url: '/color/gradient-generator/',  hasUrlParams: false },
  { id: 'palette-generator',   name: '색상 팔레트 생성기',  category: '색상 도구',  url: '/color/palette-generator/',   hasUrlParams: false },
  { id: 'tailwind-palette',    name: 'Tailwind 색상표',     category: '색상 도구',  url: '/color/tailwind-palette/',    hasUrlParams: false },

  // 개발자 도구 (URL 파라미터 없음)
  { id: 'timestamp',    name: '타임스탬프 변환기',       category: '개발자 도구', url: '/dev/timestamp/',    hasUrlParams: false },
  { id: 'base64',       name: 'Base64 인코더/디코더',    category: '개발자 도구', url: '/dev/base64/',       hasUrlParams: false },
  { id: 'url-encoder',  name: 'URL 인코더/디코더',       category: '개발자 도구', url: '/dev/url-encoder/',  hasUrlParams: false },
  { id: 'uuid',         name: 'UUID 생성기',             category: '개발자 도구', url: '/dev/uuid/',         hasUrlParams: false },
  { id: 'regex-tester', name: '정규식 테스터',           category: '개발자 도구', url: '/dev/regex-tester/', hasUrlParams: false },
];

const BASE_URL = 'https://serenkit.com';

// ─── 광고 숨김 스크립트 ──────────────────────────────────────────────────────
const HIDE_ADS_SCRIPT = `
  document.querySelectorAll('ins.adsbygoogle').forEach(el => {
    let p = el.parentElement;
    while (p) {
      const style = p.getAttribute('style') || '';
      if (style.includes('min-height')) { p.style.display = 'none'; break; }
      p = p.parentElement;
    }
    el.style.display = 'none';
  });
  document.querySelectorAll('[data-share-ignore]').forEach(el => { el.style.display = 'none'; });
  document.querySelectorAll('.xl\\\\:flex').forEach(el => {
    if (el.querySelector('ins.adsbygoogle')) el.style.display = 'none';
  });
`;

// ─── 파라미터 파싱 ───────────────────────────────────────────────────────────
function parseParamInput(tool, inputStr) {
  if (!tool.params || tool.params.length === 0) return {};
  const rawValues = inputStr.includes('/')
    ? inputStr.split('/').map(s => s.trim()).filter(Boolean)
    : inputStr.trim().split(/\s+/);
  const result = {};
  tool.params.forEach((param, i) => {
    if (i < rawValues.length && rawValues[i] !== '' && rawValues[i] !== '-') {
      result[param.key] = rawValues[i];
    }
  });
  return result;
}

// ─── URL 빌더 ────────────────────────────────────────────────────────────────
function buildUrl(toolUrl, params) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) sp.set(k, String(v));
  });
  const qs = sp.toString();
  return `${BASE_URL}${toolUrl}${qs ? '?' + qs : ''}`;
}

// ─── Puppeteer 페이지 캡처 ───────────────────────────────────────────────────
async function capturePage(page, url, outputPath, label, viewportCfg) {
  console.log(`    → ${label} 로딩...`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));
  await page.evaluate(HIDE_ADS_SCRIPT);

  // 계산기 카드 요소 탐색 (이미지 저장 버튼 기준)
  const cardEl = await page.evaluateHandle(() => {
    const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('이미지'));
    let el = saveBtn?.parentElement;
    while (el && !el.hasAttribute('data-share-ignore')) el = el?.parentElement;
    return el?.previousElementSibling || null;
  });
  const el = cardEl.asElement ? cardEl.asElement() : null;

  if (!el) {
    console.warn(`    [경고] 카드 요소 없음 → main 요소로 대체`);
    const mainEl = await page.$('main');
    if (!mainEl) {
      await page.screenshot({ path: outputPath, fullPage: false });
    } else {
      const box = await mainEl.boundingBox();
      await page.setViewport({ ...viewportCfg, height: Math.ceil(box.height) + 100 });
      await mainEl.screenshot({ path: outputPath });
    }
  } else {
    const box = await el.boundingBox();
    await page.setViewport({ ...viewportCfg, height: Math.ceil(box.height) + 100 });
    await el.screenshot({ path: outputPath });
  }
  console.log(`    ✓ ${outputPath}`);
}

// ─── 메인 export ─────────────────────────────────────────────────────────────
/**
 * serenkit 도구 이미지 캡처
 * @param {string} toolId  - TOOLS의 id 값 (예: 'date-add', 'salary')
 * @param {string} outDir  - 이미지를 저장할 절대 경로 (이미 존재해야 함)
 * @returns {Promise<{form: string, result: string|null}|null>}
 */
export async function captureImages(toolId, outDir) {
  const tool = TOOLS.find(t => t.id === toolId);
  if (!tool) {
    console.log(`  [캡처 스킵] 알 수 없는 도구 ID: ${toolId}`);
    return null;
  }

  const cfg = readConfig();
  const capCfg = cfg.capture || {};
  const viewportCfg = {
    width:             capCfg.viewportWidth     || 600,
    height:            capCfg.viewportHeight    || 1200,
    deviceScaleFactor: capCfg.deviceScaleFactor || 1,
  };

  // 예시값(ex)으로 파라미터 자동 설정
  let paramValues = {};
  if (tool.hasUrlParams && tool.example) {
    paramValues = parseParamInput(tool, tool.example);
    console.log(`  → 예시값: ${tool.example}`);
  }

  const formPath   = join(outDir, 'serenkit-input.png');
  const resultPath = join(outDir, 'serenkit-result.png');
  const formUrl    = `${BASE_URL}${tool.url}`;
  const resultUrl  = buildUrl(tool.url, paramValues);
  const hasResult  = tool.hasUrlParams && Object.keys(paramValues).length > 0;

  console.log(`\n  📸 [${tool.name}] 캡처 시작`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport(viewportCfg);
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('cookie_consent', 'accepted');
    });

    await capturePage(page, formUrl,   formPath,   '기본 양식', viewportCfg);
    if (hasResult) {
      await capturePage(page, resultUrl, resultPath, '결과 페이지', viewportCfg);
    }

    console.log(`  ✅ 이미지 캡처 완료 (${hasResult ? '2장' : '1장'})`);
    return { form: formPath, result: hasResult ? resultPath : null };

  } finally {
    await browser.close();
  }
}

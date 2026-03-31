import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, '../../config.json');

let _cache = null;

export function readConfig() {
  if (_cache) return _cache;
  _cache = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  return _cache;
}

/** 설정 캐시 초기화 (테스트용) */
export function clearConfigCache() {
  _cache = null;
}

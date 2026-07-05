// Нагрузочный smoke-сценарий (k6). Запуск: k6 run infra/load/k6-smoke.js
// Порог: p95 < 500мс, ошибок < 1%. Расширять реальными пользовательскими путями перед публичным запуском.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3011/api/v1';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 20 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(`${BASE}/health`);
  check(res, { 'health 200': (r) => r.status === 200 });
  sleep(1);
}

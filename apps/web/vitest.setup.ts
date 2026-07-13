import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Размонтируем компоненты после каждого теста (globals выключены — регистрируем вручную).
afterEach(() => cleanup());

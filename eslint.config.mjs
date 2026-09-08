import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.turbo/**',
      'scripts/**',
      'apps/mobile/android/**',
      'apps/desktop/src-tauri/**',
      'apps/desktop/gen-icon.mjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  /**
   * Заслон против новых русских строк в интерфейсе.
   *
   * Проверка полноты словарей доказывает, что русский и английский согласованы. Она ничего не
   * говорит о том, прошла ли строка через словарь вообще, — это и закрывает правило ниже.
   * Комментарии не узлы AST, поэтому принятый в проекте стиль русских пояснений не задевается.
   *
   * Список `ignores` — то, что ещё не переведено. Он сокращается каждым коммитом и в конце
   * работы содержит только тесты и сам русский словарь: тесты пишут по-русски намеренно, а
   * словарь на то и словарь. Отладочные сообщения для разработчика (console, падение при
   * сломанной сборке) пишутся по-английски и через словарь не идут.
   */
  {
    files: ['apps/app/src/**/*.{ts,tsx}'],
    ignores: [
      'apps/app/src/**/*.test.{ts,tsx}',
      'apps/app/src/lib/i18n/ru.ts',

      // Ещё не переведено:
      'apps/app/src/components/Attachments.tsx',
      'apps/app/src/components/DecisionsScreen.tsx',
      'apps/app/src/components/HouseholdScreen.tsx',
      'apps/app/src/components/LedgerScreen.tsx',
      'apps/app/src/components/NavigatorScreen.tsx',
      'apps/app/src/components/ObjectDetailScreen.tsx',
      'apps/app/src/components/SearchScreen.tsx',
      'apps/app/src/components/SettingsScreen.tsx',
      'apps/app/src/components/TodayScreen.tsx',
      'apps/app/src/lib/backup-crypto.ts',
      'apps/app/src/lib/backup.ts',
      'apps/app/src/lib/notifications.ts',
      'apps/app/src/lib/object-visuals.ts',
      'apps/app/src/lib/platform-files.ts',
      'apps/app/src/lib/search.ts',
      'apps/app/src/lib/theme.ts',
      'apps/app/src/lib/store/decisions.ts',
      'apps/app/src/lib/store/household.ts',
      'apps/app/src/lib/store/navigator.ts',
      'apps/app/src/lib/store/objects.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/[\\u0400-\\u04FF]/]',
          message: 'Строка интерфейса пишется в словаре lib/i18n, а не в коде.',
        },
        {
          selector: 'JSXText[value=/[\\u0400-\\u04FF]/]',
          message: 'Строка интерфейса пишется в словаре lib/i18n, а не в коде.',
        },
        {
          selector: 'TemplateElement[value.raw=/[\\u0400-\\u04FF]/]',
          message: 'Строка интерфейса пишется в словаре lib/i18n, а не в коде.',
        },
      ],
    },
  },

  prettier,
);

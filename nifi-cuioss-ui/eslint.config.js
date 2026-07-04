/**
 * ESLint flat configuration (ESLint v9+/v10) for nifi-cuioss-ui.
 *
 * Migrated from the legacy .eslintrc.cjs / .eslintignore pair. Layout and
 * formatting rules that were removed from ESLint core in v9 are provided by
 * @stylistic/eslint-plugin and namespaced under `@stylistic/*`.
 */
import js from '@eslint/js';
import globals from 'globals';
import stylistic from '@stylistic/eslint-plugin';
import jest from 'eslint-plugin-jest';

export default [
    {
        ignores: [
            'target/**',
            'node_modules/**',
            'dist/**',
            'build/**',
            'coverage/**',
            '**/*.min.js',
            'src/main/webapp/js/bundle.webpack.js',
            'src/main/webapp/js/bundle.webpack.js.LICENSE.txt',
            'src/main/webapp/js/bundle.js',
            'webpack.config.js',
            // Tooling config dotfile, not source — legacy ESLint auto-ignored dotfiles
            '.stylelintrc.*'
        ]
    },
    js.configs.recommended,
    {
        // Match legacy (.eslintrc) behavior: do not flag unused disable directives.
        linterOptions: {
            reportUnusedDisableDirectives: 'off'
        },
        plugins: {
            '@stylistic': stylistic
        },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                globalThis: 'readonly'
            }
        },
        rules: {
            // Error prevention - Allow structured logging methods but fail on console.log
            'no-console': ['error', {
                allow: ['debug', 'info', 'warn', 'error', 'table', 'time', 'timeEnd']
            }],
            'no-debugger': 'warn',
            'no-alert': 'warn',
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-var': 'warn',
            'prefer-const': 'warn',
            camelcase: ['error', { properties: 'never' }],

            // Code style (moved to @stylistic in ESLint v9+)
            '@stylistic/indent': ['error', 4, { SwitchCase: 1 }],
            '@stylistic/linebreak-style': ['error', 'unix'],
            '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
            '@stylistic/semi': ['error', 'always'],
            '@stylistic/comma-dangle': ['error', 'never'],
            '@stylistic/arrow-spacing': 'error',
            '@stylistic/space-before-function-paren': ['error', {
                anonymous: 'always',
                named: 'never',
                asyncArrow: 'always'
            }],
            '@stylistic/keyword-spacing': 'error',
            '@stylistic/space-infix-ops': 'error',
            '@stylistic/eol-last': 'error',
            '@stylistic/object-curly-spacing': ['error', 'always'],
            '@stylistic/array-bracket-spacing': ['error', 'never'],
            '@stylistic/block-spacing': 'error',
            '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
            '@stylistic/comma-spacing': ['error', { before: false, after: true }],
            '@stylistic/function-call-spacing': ['error', 'never'],
            '@stylistic/key-spacing': ['error', { beforeColon: false, afterColon: true }],
            '@stylistic/max-len': ['warn', { code: 100, ignoreComments: true, ignoreStrings: true }],
            '@stylistic/no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
            '@stylistic/no-trailing-spaces': 'error',
            '@stylistic/padded-blocks': ['error', 'never']
        }
    },
    {
        // Production webapp source: console is forbidden — use the `log` utility
        // from utils.js instead. The only sanctioned exceptions (below) are
        // utils.js itself (it implements the log wrapper) and nifi-common-init.js
        // (a classic non-module script that cannot import utils.js).
        files: ['src/main/webapp/js/**/*.js'],
        rules: {
            'no-console': 'error'
        }
    },
    {
        files: [
            'src/main/webapp/js/utils.js',
            'src/main/webapp/js/nifi-common-init.js'
        ],
        rules: {
            'no-console': ['error', {
                allow: ['debug', 'info', 'warn', 'error']
            }]
        }
    },
    {
        files: ['src/test/js/**/*.js'],
        ...jest.configs['flat/recommended'],
        languageOptions: {
            ...(jest.configs['flat/recommended'].languageOptions ?? {}),
            globals: {
                ...(jest.configs['flat/recommended'].languageOptions?.globals ?? {}),
                ...globals.jest
            }
        },
        rules: {
            ...jest.configs['flat/recommended'].rules,
            'jest/expect-expect': 'error',
            'jest/no-disabled-tests': 'warn',
            'jest/no-standalone-expect': 'off',
            'jest/no-focused-tests': 'error',
            'jest/no-identical-title': 'error',
            'jest/valid-expect': 'error',
            'no-console': 'off',
            'no-alert': 'off',
            'no-debugger': 'off',
            'no-unused-vars': 'off',
            'no-redeclare': 'off',
            'no-undef': 'off',
            '@stylistic/max-len': 'off'
        }
    }
];

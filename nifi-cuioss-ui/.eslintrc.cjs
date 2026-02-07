module.exports = {
    'env': {
        'browser': true,
        'es6': true,
        'jest': true,
        'node': true
    },
    'ignorePatterns': [
        'target/**',
        'node_modules/**'
    ],
    'extends': [
        'eslint:recommended',
        'plugin:jest/recommended'
    ],
    'plugins': [
        'jest'
    ],
    'parserOptions': {
        'ecmaVersion': 2020,
        'sourceType': 'module'
    },
    'globals': {
        'globalThis': 'readonly'
    },
    'rules': {
        // Error prevention - Allow structured logging methods but fail on console.log
        'no-console': ['error', {
            'allow': ['debug', 'info', 'warn', 'error', 'table', 'time', 'timeEnd']
        }],
        'no-debugger': 'warn',
        'no-alert': 'warn',
        'no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }],
        'no-var': 'warn',
        'prefer-const': 'warn',

        // Code style
        'indent': ['error', 4, { 'SwitchCase': 1 }],
        'linebreak-style': ['error', 'unix'],
        'quotes': ['error', 'single', { 'avoidEscape': true }],
        'semi': ['error', 'always'],
        'comma-dangle': ['error', 'never'],
        'arrow-spacing': 'error',
        'space-before-function-paren': ['error', {
            'anonymous': 'always',
            'named': 'never',
            'asyncArrow': 'always'
        }],
        'keyword-spacing': 'error',
        'space-infix-ops': 'error',
        'eol-last': 'error',
        'object-curly-spacing': ['error', 'always'],
        'array-bracket-spacing': ['error', 'never'],
        'block-spacing': 'error',
        'brace-style': ['error', '1tbs', { 'allowSingleLine': true }],
        'camelcase': ['error', { 'properties': 'never' }],
        'comma-spacing': ['error', { 'before': false, 'after': true }],
        'func-call-spacing': ['error', 'never'],
        'key-spacing': ['error', { 'beforeColon': false, 'afterColon': true }],
        'max-len': ['warn', { 'code': 100, 'ignoreComments': true, 'ignoreStrings': true }],
        'no-multiple-empty-lines': ['error', { 'max': 2, 'maxEOF': 1 }],
        'no-trailing-spaces': 'error',
        'padded-blocks': ['error', 'never']
    },
    'overrides': [
        {
            'files': ['src/test/js/**/*.js'],
            'rules': {
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
                'max-len': 'off'
            }
        }
    ]
};

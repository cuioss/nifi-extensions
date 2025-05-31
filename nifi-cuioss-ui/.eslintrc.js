module.exports = {
    'env': {
        'browser': true,
        'amd': true,
        'jquery': true,
        'es6': true,
        'jest': true
    },
    'extends': [
        'eslint:recommended',
        'plugin:jest/recommended'
    ],
    'plugins': [
        'jest',
        'jquery'
    ],
    'parserOptions': {
        'ecmaVersion': 2020,
        'sourceType': 'module'
    },
    'globals': {
        'define': 'readonly',
        'nf': 'readonly',
        'module': 'writable'
    },
    'rules': {
        // Error prevention
        'no-console': 'warn',
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
        'camelcase': ['error', { 'properties': 'never', 'allow': ['jwks_type'] }],
        'comma-spacing': ['error', { 'before': false, 'after': true }],
        'func-call-spacing': ['error', 'never'],
        'key-spacing': ['error', { 'beforeColon': false, 'afterColon': true }],
        'max-len': ['warn', { 'code': 100, 'ignoreComments': true, 'ignoreStrings': true }],
        'no-multiple-empty-lines': ['error', { 'max': 2, 'maxEOF': 1 }],
        'no-trailing-spaces': 'error',
        'padded-blocks': ['error', 'never'],

        // jQuery specific rules
        'jquery/no-ajax': 'off',
        'jquery/no-animate': 'off',
        'jquery/no-attr': 'off',
        'jquery/no-bind': 'warn',
        'jquery/no-class': 'off',
        'jquery/no-clone': 'off',
        'jquery/no-closest': 'off',
        'jquery/no-css': 'off',
        'jquery/no-data': 'off',
        'jquery/no-deferred': 'off',
        'jquery/no-delegate': 'warn',
        'jquery/no-each': 'off',
        'jquery/no-fade': 'off',
        'jquery/no-filter': 'off',
        'jquery/no-find': 'off',
        'jquery/no-global-eval': 'error',
        'jquery/no-has': 'off',
        'jquery/no-hide': 'off',
        'jquery/no-html': 'off',
        'jquery/no-in-array': 'off',
        'jquery/no-is': 'off',
        'jquery/no-map': 'off',
        'jquery/no-merge': 'off',
        'jquery/no-param': 'off',
        'jquery/no-parent': 'off',
        'jquery/no-parents': 'off',
        'jquery/no-parse-html': 'off',
        'jquery/no-prop': 'off',
        'jquery/no-proxy': 'warn',
        'jquery/no-serialize': 'off',
        'jquery/no-show': 'off',
        'jquery/no-size': 'error',
        'jquery/no-sizzle': 'off',
        'jquery/no-slide': 'off',
        'jquery/no-submit': 'off',
        'jquery/no-text': 'off',
        'jquery/no-toggle': 'off',
        'jquery/no-trigger': 'off',
        'jquery/no-trim': 'off',
        'jquery/no-val': 'off',
        'jquery/no-wrap': 'off'
    },
    'overrides': [
        {
            'files': ['src/test/js/**/*.js'],
            'rules': {
                'jest/expect-expect': 'error',
                'jest/no-disabled-tests': 'warn',
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

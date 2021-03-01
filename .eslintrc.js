module.exports = {
    "extends": "eslint:recommended",
   
    "globals":{
        "window":true,
        "define":true,
        "require":true,
        "requirejs":true,
        "jQuery":true,
        "OneSignal":true
    },
    "env": {
        "browser": 'true',
        "amd":'true',
        "node":'false',
        "es6":'false'
    },

    "rules": {
        "vars-on-top":0,
        "quote-props": ["error", "as-needed"],
        "no-underscore-dangle": ["error", { "allow": ["_this"] }],
        "func-names":0,
        "requirejs/no-invalid-define": 2,
        "requirejs/no-multiple-define": 2,
        "requirejs/no-named-define": 0,
        "requirejs/no-commonjs-wrapper": 0,
        "requirejs/no-object-define": 1,
        "requirejs/no-multiple-define":0,
        "max-len":["error",500],
        "no-console": 0,
        "no-unused-vars": [1, {"vars": "local", "args": "none"}],
        "id-length": 0,
        "no-param-reassign":0,
        'quotes': [2, 'double', 'avoid-escape'],
        "indent": ["warn", 4]
    },
    "plugins": [
        "requirejs"
    ]
};

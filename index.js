var acorn = require('acorn');
var walk = require('acorn/dist/walk');
var copy = require('shallow-copy');
var defined = require('defined');
var fastFind = require('./find-fast');

var requireRe = /\brequire\b/;

function getParseOpts (opts) {
    opts = opts || {};
    return {
        ecmaVersion: defined(opts.ecmaVersion, 8),
        sourceType: opts.sourceType,
        ranges: defined(opts.ranges, opts.range),
        locations: defined(opts.locations, opts.loc),
        allowReserved: defined(opts.allowReserved, true),
        allowReturnOutsideFunction: defined(
            opts.allowReturnOutsideFunction, true
        ),
        allowImportExportEverywhere: defined(
            opts.allowImportExportEverywhere, true
        ),
        allowHashBang: defined(opts.allowHashBang, true)
    };
}

var exports = module.exports = function (src, opts) {
    return exports.find(src, opts).strings;
};

exports.find = function (src, opts) {
    if (!opts) opts = {};
    else opts = copy(opts);
    opts.parse = getParseOpts(opts.parse);

    if (!opts.isRequire && !opts.fullParse) {
        return fastFind(src, opts);
    }
    
    var word = opts.word === undefined ? 'require' : opts.word;
    if (typeof src !== 'string') src = String(src);
    
    var isRequire = opts.isRequire || function (node) {
        return node.callee.type === 'Identifier'
            && node.callee.name === word
        ;
    };
    
    var modules = { strings : [], expressions : [] };
    if (opts.nodes) modules.nodes = [];
    
    var wordRe = word === 'require' ? requireRe : RegExp('\\b' + word + '\\b');
    if (!wordRe.test(src)) return modules;
    
    var ast = acorn.parse(src, opts.parse);
    
    function visit(node, st, c) {
        var hasRequire = wordRe.test(src.slice(node.start, node.end));
        if (!hasRequire) return;
        walk.base[node.type](node, st, c);
        if (node.type !== 'CallExpression') return;
        if (isRequire(node)) {
            if (node.arguments.length) {
                var arg = node.arguments[0];
                if (arg.type === 'Literal') {
                    modules.strings.push(arg.value);
                }
                else {
                    modules.expressions.push(src.slice(arg.start, arg.end));
                }
            }
            if (opts.nodes) modules.nodes.push(node);
        }
    }
    
    walk.recursive(ast, null, {
        Statement: visit,
        Expression: visit
    });
    
    return modules;
};

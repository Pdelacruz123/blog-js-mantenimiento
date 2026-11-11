const test = require('node:test');
const assert = require('node:assert');
const { parseTags, plainText } = require('./tags');

test('parseTags normalizes, dedupes and limits tags', () => {
    assert.deepStrictEqual(parseTags('#JavaScript, web dev ,, javascript'), ['javascript', 'web-dev']);
    assert.deepStrictEqual(parseTags(['Diseño', '<b>x</b>']), ['diseño', 'b-x-b']);
    assert.deepStrictEqual(parseTags('a,b,c,d,e,f'), ['a', 'b', 'c', 'd', 'e']);
    assert.strictEqual(parseTags(undefined), undefined);
    assert.deepStrictEqual(parseTags(''), []);
});

test('plainText ignores formatting', () => {
    assert.strictEqual(plainText('<p><br></p>'), '');
    assert.strictEqual(plainText('<p><strong>Hi</strong></p>'), 'Hi');
});

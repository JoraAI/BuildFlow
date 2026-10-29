import assert from 'node:assert/strict';
import { itemImageUploadBody } from './item-image-upload';

const payload = 'abc'.repeat(200);
const parsed = itemImageUploadBody(`data:image/png;base64,${payload}`);
assert.equal(parsed?.contentType, 'image/png');
assert.equal(parsed?.dataBase64, payload);
assert.ok((parsed?.dataBase64.length ?? 0) > 255);

const jpeg = itemImageUploadBody('data:image/jpg;base64,qq==');
assert.equal(jpeg?.contentType, 'image/jpeg');
assert.equal(itemImageUploadBody('file:///var/photo.png'), null);

console.log('item-image-upload ok');

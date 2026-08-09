import { detectEntities } from '../links/detect';

function assert(name: string, cond: boolean) {
  if (!cond) throw new Error(`detect test failed: ${name}`);
}

const mixed = `Call me on +255712345678 or email me at test@example.com.

Website:
https://aochats.chat`;

const entities = detectEntities(mixed);
const types = entities.map((e) => e.type).sort().join(',');
assert('mixed types', types.includes('phone') && types.includes('email') && types.includes('ao_chats'));

const urlOnly = detectEntities('See https://example.com now');
assert('url not phone', urlOnly.length === 1 && urlOnly[0].type === 'url');

const phone = detectEntities('Reach +255 712 345 678 please');
assert('tz phone', phone.some((e) => e.type === 'phone'));

const year = detectEntities('In 2024 we launched');
assert('year not phone', !year.some((e) => e.type === 'phone'));

console.log('detect tests ok');

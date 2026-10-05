import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryQueryString, createCategoryCachePool } from '../src/lib/categoryQuery.ts';
import { createProgressiveCatalog } from '../src/lib/catalogCache.ts';
const base = {categoryIds: [], brand: null, query: '', price: 'all', sort: 'featured'};
test('category keys are canonical and preserve encoded search and price boundaries', () => {
  assert.equal(categoryQueryString({...base,categoryIds:['2','1','2']}), categoryQueryString({...base,categoryIds:['1','2']}));
  const params = new URLSearchParams(categoryQueryString({...base,query:'  GPU & RAM  ',brand:'A&B',price:'under-5k',sort:'price-low'}));
  assert.equal(params.get('q'),'GPU & RAM'); assert.equal(params.get('brand'),'A&B');
  assert.equal(params.get('max_price'),'4999.99'); assert.equal(params.get('sort'),'price_asc');
  assert.equal(new URLSearchParams(categoryQueryString({...base,price:'under-15k'})).get('max_price'),'14999.99');
  assert.equal(new URLSearchParams(categoryQueryString({...base,price:'over-15k'})).get('min_price'),'15000');
});
test('filter cache keeps recently visited selections and evicts oldest entries', () => {
  const pool=createCategoryCachePool(key=>({key,scrollOffset:0}),2);
  const a=pool('a'); a.scrollOffset=240; pool('b'); assert.equal(pool('a'),a); pool('c');
  assert.equal(pool('a').scrollOffset,240); assert.notEqual(pool('b'),pool('c'));
});
test('rapid switches isolate late responses and cached revisits avoid extra requests', async () => {
  const resolvers={}; let requests=0;
  const pool=createCategoryCachePool(key=>createProgressiveCatalog(page=>{requests++;return new Promise(resolve=>{resolvers[key]=()=>resolve({data:[key+page],meta:{last_page:2}});});}));
  const a=pool('a'),b=pool('b'); const first=a.resume(); const duplicate=a.resume(); const second=b.resume();
  resolvers.b(); await second; resolvers.a(); await Promise.all([first,duplicate]);
  assert.deepEqual(b.snapshot().rows,['b1']); assert.equal(requests,2);
  await pool('a').resume(); assert.equal(requests,2);
  const next=a.next(); const repeated=a.next(); resolvers.a(); await Promise.all([next,repeated]);
  assert.deepEqual(a.snapshot().rows,['a1','a2']); assert.equal(requests,3);
  await a.next(); assert.equal(requests,3);
});

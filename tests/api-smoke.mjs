import assert from 'node:assert/strict';
const base=process.env.TRIPS_LOOM_TEST_URL||process.env.ELSEWHERE_TEST_URL||'http://localhost:5173';
async function open(){const response=await fetch(base+'/api/workspace');assert.equal(response.status,200);return {cookie:response.headers.get('set-cookie').split(';')[0],data:await response.json()}}
const a=await open(),b=await open();assert.notEqual(a.cookie,b.cookie);
const edited=structuredClone(a.data.workspace);edited.trips[0].name='API isolation test';
const put=(revision,workspace=edited,origin=base)=>fetch(base+'/api/workspace',{method:'PUT',headers:{Cookie:a.cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({revision,workspace})});
assert.equal((await put(0,edited,'https://untrusted.example')).status,403);
const invalid=structuredClone(edited);invalid.outfits[0].items=['missing'];assert.equal((await put(0,invalid)).status,400);
const concurrent=await Promise.all([put(0),put(0)]);assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
const ar=await (await fetch(base+'/api/workspace',{headers:{Cookie:a.cookie}})).json();const br=await (await fetch(base+'/api/workspace',{headers:{Cookie:b.cookie}})).json();assert.equal(ar.workspace.trips[0].name,'API isolation test');assert.equal(ar.revision,1);assert.equal(br.workspace.trips[0].name,'A week in Lisbon');assert.equal(br.revision,0);
const image=new FormData();image.set('image',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6eTQAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'fixture.png');
const upload=await fetch(base+'/api/images',{method:'POST',headers:{Cookie:a.cookie,Origin:base},body:image});assert.equal(upload.status,200);const {url}=await upload.json();assert.equal((await fetch(base+url,{headers:{Cookie:a.cookie}})).status,200);assert.equal((await fetch(base+url,{headers:{Cookie:b.cookie}})).status,404);
const fake=new FormData();fake.set('image',new Blob(['<svg/>'],{type:'image/png'}),'unsafe.png');assert.equal((await fetch(base+'/api/images',{method:'POST',headers:{Cookie:a.cookie,Origin:base},body:fake})).status,400);
console.log('Passed: anonymous workspaces, durable saves, visitor isolation, concurrent edit conflict, invalid data, CSRF, image upload and image ownership.');

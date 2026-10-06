import {test} from 'node:test';
import assert from 'node:assert/strict';
import {temporaryAccess,licenseFor} from '../src/license';
import type {AppEnv} from '../src/meta';
test('temporary access is opt-in, has strict expiry and never leaks into license cache',async()=>{
 const at=Date.parse('2026-09-15T00:00:00Z')/1000;
 assert.equal(temporaryAccess({},'123',at),null);
 for(const value of ['true','invalid','2026-09-22','2026-09-15T00:00:00Z','2026-02-30T00:00:00Z'])assert.equal(temporaryAccess({TEST_ACCESS_UNTIL:value},'123',at),null);
 const expires='2026-09-22T23:59:59Z';const result=temporaryAccess({TEST_ACCESS_UNTIL:expires},'123',at);assert.equal(result?.temporary,true);assert.equal(result?.accountId,'123');assert.equal(temporaryAccess({TEST_ACCESS_UNTIL:expires},'',at),null);
 assert.equal(temporaryAccess({TEST_ACCESS_UNTIL:expires},'123',Date.parse(expires)/1000),null);
 let accessed=false;const env={LICENSE_ENFORCEMENT:'enabled',TEST_ACCESS_UNTIL:'2099-01-01T00:00:00Z',DB:{prepare(){accessed=true;throw Error('must not cache temporary access');}}} as unknown as AppEnv;
 assert.equal((await licenseFor(env,'123'))?.temporary,true);assert.equal(accessed,false);
 const fallback={LICENSE_ENFORCEMENT:'enabled',DB:{prepare(){accessed=true;return {first:async()=>null};}}} as unknown as AppEnv;
 assert.equal(await licenseFor(fallback,'123'),null);assert.equal(accessed,true);
});

test('owner suspension releases access without querying the license server',async()=>{const env={DB:{prepare(){throw Error('License DB should not be read');}}} as unknown as AppEnv;assert.equal((await licenseFor(env,'123'))?.paused,true);assert.equal(await licenseFor(env,''),null);});

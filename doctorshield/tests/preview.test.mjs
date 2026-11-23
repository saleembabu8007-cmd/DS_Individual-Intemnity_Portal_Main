import test from 'node:test';import assert from 'node:assert/strict';
import {createPreviewOtpService} from '../dist/otp-service.js';
import {insuranceApi} from '../dist/api.js';
test('sample verification rejects a wrong code and returns clearly marked sample records for 123456',async()=>{
 const s=createPreviewOtpService({delay:0});
 await s.send({flow:'claims',mobile:'0123456789',channel:'sms'});
 await assert.rejects(()=>s.verify({flow:'claims',code:'111111'}),/wrong/);
 const r=await s.verify({flow:'claims',code:'123456'});assert.equal(r.sample,true);assert.equal(r.kind,'claim-records');
 assert.equal((await s.submitClaim({})).sample,true);
});
test('review-only boundaries still refuse unconnected operations',async()=>{await assert.rejects(()=>insuranceApi.requestOtp(),/not connected/);});

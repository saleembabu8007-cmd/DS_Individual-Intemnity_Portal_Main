import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAttachments,validateClaim,safeServiceLink,claimGroups} from '../dist/service-model.js';
test('attachments enforce source extension and six MB limits',()=>{assert.equal(validateAttachments([{name:'report.pdf',size:6*1024*1024}]),'');assert.ok(validateAttachments([{name:'report.pdf',size:6*1024*1024+1}]));assert.ok(validateAttachments([{name:'report.exe',size:1}]));});
test('claim review cannot omit any source required field',()=>{assert.equal(Object.keys(validateClaim({})).length,claimGroups.flatMap(([,fields])=>fields).length);assert.ok(validateClaim({date_of_incident_loss:'2099-01-01'}).date_of_incident_loss);assert.equal(validateClaim({claim_phone_number:'012 345 6789'}).claim_phone_number,undefined);assert.ok(validateClaim({claim_phone_number:'12'}).claim_phone_number);});
test('handoffs reject script and foreign destinations',()=>{assert.equal(safeServiceLink('javascript:alert(1)'),null);assert.equal(safeServiceLink('https://evil.example'),null);assert.ok(safeServiceLink('https://my-individualindemnity.doctorshield.com/claims'));});

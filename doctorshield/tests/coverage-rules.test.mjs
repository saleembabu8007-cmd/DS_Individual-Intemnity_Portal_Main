import test from 'node:test';
import assert from 'node:assert/strict';
import {startDateBounds,policyEndDate,isFullYearPeriod,startDateError,apiDate,isValidIsoDate} from '../dist/coverage-rules.js';
import {validateCoverage} from '../dist/validation.js';

const day=iso=>new Date(iso+'T10:00:00');

test('end date follows the live 1 July cut-off: always 31 December',()=>{
 assert.equal(policyEndDate('2026-01-01'),'2026-12-31');
 assert.equal(policyEndDate('2026-06-30'),'2026-12-31');
 assert.equal(policyEndDate('2026-07-01'),'2027-12-31');
 assert.equal(policyEndDate('2026-11-26'),'2027-12-31'); // matches live portal screenshot 26/11/2026 – 31/12/2027
 assert.equal(policyEndDate('2027-03-15'),'2027-12-31');
 assert.equal(policyEndDate(''),'');
 assert.equal(policyEndDate('2026-02-30'),'');
});

test('latest start is 30 June of next year from 1 April, otherwise this year',()=>{
 assert.deepEqual(startDateBounds(day('2026-11-23')),{min:'2026-11-23',max:'2027-06-30'});
 assert.deepEqual(startDateBounds(day('2026-04-01')),{min:'2026-04-01',max:'2027-06-30'});
 assert.deepEqual(startDateBounds(day('2026-03-31')),{min:'2026-03-31',max:'2026-06-30'});
 assert.deepEqual(startDateBounds(day('2027-01-10')),{min:'2027-01-10',max:'2027-06-30'});
});

test('start date errors: missing, invalid, backdated, beyond limit',()=>{
 const today=day('2026-11-23');
 assert.match(startDateError('',today),/Enter the insurance start date/);
 assert.match(startDateError('2026-13-01',today),/valid date/);
 assert.match(startDateError('2026-11-22',today),/Backdated/);
 assert.equal(startDateError('2026-11-23',today),'');
 assert.equal(startDateError('2027-06-30',today),'');
 assert.match(startDateError('2027-07-01',today),/30 Jun 2027/);
 assert.equal(startDateError('2026-11-22',today,{backdateAllowed:true}),'');
});

test('full-year period only when cover starts on 1 January',()=>{
 assert.equal(isFullYearPeriod('2027-01-01'),true);
 assert.equal(isFullYearPeriod('2026-11-26'),false);
 assert.equal(isFullYearPeriod(''),false);
});

test('API date format and ISO validation',()=>{
 assert.equal(apiDate('2026-11-26'),'26/11/2026');
 assert.equal(apiDate('bad'),'');
 assert.equal(isValidIsoDate('2028-02-29'),true);
 assert.equal(isValidIsoDate('2027-02-29'),false);
});

test('coverage validation accepts live limits when the service supplies them',()=>{
 const data={classification:'General Medical Practitioner',liability:'RM 750,000',start:'2026-11-30',email:'a@b.co',consent:true,allocations:{}};
 assert.ok(validateCoverage(data,day('2026-11-23')).liability);
 assert.equal(validateCoverage(data,day('2026-11-23'),{limits:['RM 750,000']}).liability,undefined);
});

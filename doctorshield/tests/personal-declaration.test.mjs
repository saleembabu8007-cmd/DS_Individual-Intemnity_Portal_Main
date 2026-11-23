import test from 'node:test';
import assert from 'node:assert/strict';
import {nameError,dobError,identityError,maskId,normaliseMobile,mobileError,patientsError,incomeError,parseIncome,formatIncome,patientsLabel,tinError,isMalaysianNric} from '../dist/personal-rules.js';
import {validatePersonal,validateDeclarations,declarationDetailFields} from '../dist/validation.js';
import {importantNoticesHtml,declarationAuthorizationHtml,disclosureHtml} from '../dist/content.js';

const today=new Date('2026-11-23T10:00:00');
const applicant=()=>({classification:'General Medical Practitioner',fullName:'Alex Tan',dob:'1985-06-15',nric:'850615101234',nationality:'Malaysia',tin:'',mobile:'012-345 6789',email:'alex@example.com',practice:'Klinik Damansara, Kuala Lumpur',patients:'1200',revenue:'250,000.00'});

test('name follows live character rule',()=>{
 assert.equal(nameError('Dr. Alex bin Tan'),'');assert.equal(nameError('A/L Kumar'),'');
 assert.match(nameError(''),/Enter your full name/);assert.match(nameError('Alex123'),/letters only/i);
});

test('date of birth: age 16 to 117, not in future',()=>{
 assert.equal(dobError('2010-11-23',today),'');                 // exactly 16
 assert.match(dobError('2010-11-24',today),/at least 16/);
 assert.match(dobError('2027-01-01',today),/future/);
 assert.equal(dobError('1909-11-23',today),'');                 // exactly 117
 assert.match(dobError('1909-11-22',today),/valid date/);
 assert.match(dobError('',today),/Enter your date of birth/);
});

test('identity: 12-digit NRIC for Malaysians, NRIC or passport otherwise',()=>{
 assert.equal(identityError('850615-10-1234','Malaysia'),'');
 assert.match(identityError('A1234567','Malaysia'),/12-digit NRIC/);
 assert.equal(identityError('A1234567','Singapore'),'');
 assert.match(identityError('','Singapore'),/NRIC or passport/);
 assert.match(identityError('AB12345678901','Others'),/maximum of 12/);
 assert.match(identityError('A12#45','Others'),/letters and numbers/);
 assert.equal(isMalaysianNric('850615-10-1234'),true);
});

test('identity is masked for confirmation screens',()=>{
 assert.equal(maskId('850615101234'),'850615-••-••34');
 assert.equal(maskId('A1234567'),'••••4567');
});

test('mobile: +60 prefix, leading zero removed, 7-10 digits',()=>{
 assert.equal(normaliseMobile('012-345 6789'),'123456789');assert.equal(normaliseMobile('+60 12 345 6789'),'123456789');
 assert.equal(mobileError('0123456789'),'');assert.equal(mobileError('11 2345 6789'),'');
 assert.match(mobileError('12345'),/valid mobile/);assert.match(mobileError('abc'),/numbers only/);assert.match(mobileError(''),/Enter your mobile/);
});

test('patients and income are mandatory and well-formed (review #8)',()=>{
 assert.equal(patientsError('1200'),'');assert.equal(patientsError('1,200'),'');
 assert.match(patientsError(''),/Enter the number/);assert.match(patientsError('12.5'),/whole number/);assert.match(patientsError('123456789'),/8 digits/);
 assert.equal(incomeError('250,000.00'),'');assert.equal(incomeError('RM 250000'),'');
 assert.match(incomeError(''),/Enter your income/);assert.match(incomeError('abc'),/amount in RM/);assert.match(incomeError('12.345'),/amount in RM/);
 assert.equal(parseIncome('RM 1,234.5'),1234.5);assert.equal(formatIncome('250000'),'250,000.00');
 assert.equal(patientsLabel(today),'No of Patients Served in 2025');
});

test('personal validation blocks missing patients and income only when the classification asks',()=>{
 assert.deepEqual(validatePersonal(applicant(),today),{});
 const missing=validatePersonal({...applicant(),patients:'',revenue:''},today);
 assert.ok(missing.patients);assert.ok(missing.revenue);
 const lecturer=validatePersonal({...applicant(),classification:'Lecturer',patients:'',revenue:''},today);
 assert.equal(lecturer.patients,undefined);assert.equal(lecturer.revenue,undefined);
});

test('TIN is optional but must be well-formed when given',()=>{
 assert.equal(tinError(''),'');assert.equal(tinError('IG12345678090'),'');assert.match(tinError('IG-123!'),/letters and numbers/);
 assert.ok(validatePersonal({...applicant(),tin:'bad!!'},today).tin);
});

test('individual declarations: each adverse answer needs its own explanation (review #4)',()=>{
 const base={answers:{q0:'Agree',q1:'No',q2:'No',q3:'No'},declaration:true};
 assert.deepEqual(validateDeclarations(base),{});
 const adverse={...base,answers:{q0:'Disagree',q1:'No',q2:'Yes',q3:'No'}};
 const e=validateDeclarations(adverse);
 assert.deepEqual(Object.keys(e).sort(),['q0Details','q2Details']);
 assert.deepEqual(validateDeclarations({...adverse,q0Details:'Settled 2019.'}),{q2Details:'Please provide details below.'});
 // "Agree" to Q1 and "No" to the others never trigger; "Yes" to Q1 is not a valid individual answer.
 assert.deepEqual(declarationDetailFields(base).filter(f=>f.required),[]);
});

test('clinic declarations: Q1-3 share one explanation, Q4 has its own (live mapping)',()=>{
 const base={clinicCover:true,answers:{qOrg0:'No',qOrg1:'No',qOrg2:'No',qOrg3:'No'},declaration:true};
 assert.deepEqual(validateDeclarations(base),{});
 assert.deepEqual(Object.keys(validateDeclarations({...base,answers:{...base.answers,qOrg1:'Yes'}})),['orgDetails']);
 assert.deepEqual(Object.keys(validateDeclarations({...base,answers:{...base.answers,qOrg3:'Yes'}})),['orgCriminalDetails']);
 assert.deepEqual(validateDeclarations({...base,answers:{...base.answers,qOrg0:'Yes',qOrg3:'Yes'},orgDetails:'x',orgCriminalDetails:'y'}),{});
});

test('legal popups use distinct parts of the approved text, unchanged in total (review #14)',()=>{
 assert.match(importantNoticesHtml,/Your Duty of Disclosure/);assert.match(importantNoticesHtml,/Subrogation/);
 assert.doesNotMatch(importantNoticesHtml,/Declaration &amp; Signature/);
 assert.match(declarationAuthorizationHtml,/^<h3>Declaration &amp; Signature<\/h3>/);
 assert.match(declarationAuthorizationHtml,/Personal Data Protection Notice/);
 assert.doesNotMatch(declarationAuthorizationHtml,/Duty of Disclosure/);
 assert.equal(disclosureHtml,importantNoticesHtml+declarationAuthorizationHtml);
 assert.equal(disclosureHtml.length,3824);
});

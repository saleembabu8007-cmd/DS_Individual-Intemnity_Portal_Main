import test from 'node:test';
import assert from 'node:assert/strict';
import {registeredMobile,displayMobile,maskMobile,otpError,parseRenewalVerify,createLiveOtpService,createUnconnectedOtpService,createOtpService,OtpError,otpLifetime,bookingUrl,wrongOtpMessage} from '../dist/otp-service.js';
import {createLiveClient} from '../dist/quote-service.js';
import {IntegrationRequiredError} from '../dist/api.js';

test('mobile numbers: local, +60 and spaced input all give the registered format (#7)',()=>{
 for(const v of ['012 345 6789','0123456789','+60 12-345 6789','60123456789','123456789'])assert.equal(registeredMobile(v),'123456789',v);
 assert.equal(registeredMobile('011 2345 6789'),'1123456789');
 for(const v of ['','12','abc','0123456789012'])assert.equal(registeredMobile(v),null,v);
 assert.equal(displayMobile('123456789'),'+60 12 345 6789');assert.equal(maskMobile('123456789'),'+60 ••• 6789');
});

test('verification code format',()=>{
 assert.equal(otpError('123456'),'');assert.match(otpError(''),/Enter the verification code/);assert.match(otpError('12a456'),/4 to 8 digits/);
});

const fake=routes=>{const calls=[];const fn=async(url,init)=>{const path=new URL(url).pathname;const body=init.body instanceof URLSearchParams?Object.fromEntries(init.body):init.body;calls.push({path,body,headers:init.headers});const r=routes[path];return r?{ok:true,status:200,json:async()=>typeof r==='function'?r(body):r}:{ok:false,status:404,json:async()=>({})};};fn.calls=calls;return fn;};
const live=routes=>{const fetchImpl=fake({'/api/getCSRFToken':{token:'tok'},...routes});return {fetchImpl,service:createLiveOtpService({apiBase:'https://api.example.com',client:createLiveClient({apiBase:'https://api.example.com',fetchImpl})})};};

test('renewal: live field names, national number format and channel',async()=>{
 const {fetchImpl,service}=live({'/api/renewFormOtpSend':{user_ids:['x'],cus_user_id:'77'},'/api/formRenewOtpVerify':{count_user_id:1,user_ids:'https://my-individualindemnity.doctorshield.com/renew/abc'}});
 const sent=await service.send({flow:'renewal',mobile:'012-345 6789',channel:'whatsapp'});
 assert.deepEqual(sent,{phone:'123456789',channel:'whatsapp',lifetime:otpLifetime.renewal});
 assert.deepEqual(fetchImpl.calls[1].body,{_token:'tok',phoneNumber:'123456789',selectedType:'whatsapp'});
 const r=await service.verify({flow:'renewal',code:'123456'});
 assert.deepEqual(fetchImpl.calls.at(-1).body,{_token:'tok',user_id:'77',phoneNumber:'123456789',otpValue:'123456'});
 assert.equal(r.kind,'policies');assert.equal(r.policies[0].url,'https://my-individualindemnity.doctorshield.com/renew/abc');
});

test('renewal verify outcomes: wrong code, no records, several policies, unsafe links',()=>{
 assert.throws(()=>parseRenewalVerify({user_ids:'',error:'Error'}),e=>e.code==='wrong-otp'&&e.message===wrongOtpMessage);
 assert.deepEqual(parseRenewalVerify({user_ids:''}),{kind:'none'});
 const many=parseRenewalVerify({user_ids:{'DS-1 Alex':'/renew/1','DS-2 Alex':'https://evil.example/x'}});
 assert.equal(many.policies.length,1);assert.equal(many.policies[0].url,'https://my-individualindemnity.doctorshield.com/renew/1');
 assert.throws(()=>parseRenewalVerify({count_user_id:1,user_ids:'javascript:alert(1)'}),OtpError);
 assert.throws(()=>parseRenewalVerify({user_ids:42}),OtpError);
});

test('send failures use one neutral message (no registration disclosure)',async()=>{
 const {service}=live({'/api/renewFormOtpSend':{error:'error',message:'This number 0123456789 is not registered'}});
 await assert.rejects(service.send({flow:'renewal',mobile:'0123456789',channel:'sms'}),e=>e.code==='not-sent'&&!/0123456789|not registered/.test(e.message));
 await assert.rejects(service.send({flow:'renewal',mobile:'12',channel:'sms'}),e=>e.code==='mobile');
});

test('claims: single record is loaded after verification; wrong code is rejected',async()=>{
 const {fetchImpl,service}=live({
  '/api/claimFormOtpSend':{user_ids:['DS-1--Alex Tan'],count_claims_user_ids:1,user_claim_quote_number:'Q9'},
  '/api/claimFormOtpVerify':b=>b.otpValue==='000000'?{error:'invalid_otp'}:{claim_user_data:{customer_name:'Alex Tan',customer_email:'a@example.com',customer_phone:'123456789'},user_claim_quote_policy_number:'DS-1',user_claim_quote_number:'Q9'}});
 await service.send({flow:'claims',mobile:'0123456789',channel:'sms'});
 assert.deepEqual(fetchImpl.calls[1].body,{_token:'tok',claim_otp_phoneNumber:'123456789',selectedType:'sms'});
 await assert.rejects(service.verify({flow:'claims',code:'000000'}),e=>e.code==='wrong-otp');
 const r=await service.verify({flow:'claims',code:'123456'});
 assert.equal(fetchImpl.calls.at(-1).body.claim_record_check,'single_record');assert.equal(fetchImpl.calls.at(-1).body.user_claim_quote_number,'Q9');
 assert.deepEqual(r,{kind:'claim',record:{quoteNumber:'Q9',policyNumber:'DS-1',insured:{name_of_insured:'Alex Tan',claim_contact_email:'a@example.com',claim_phone_number:'123456789'}}});
});

test('claims: several records are listed, then one is loaded',async()=>{
 const {fetchImpl,service}=live({
  '/api/claimFormOtpSend':{user_ids:{Q1:'DS-1--Alex Tan',Q2:'DS-2--Alex Tan'},count_claims_user_ids:2},
  '/api/claimFormOtpVerify':{},
  '/api/getSingleRecordInMultiple':{claim_user_data:{customer_name:'Alex Tan',customer_email:'a@example.com',customer_phone:'1'},user_claim_quote_policy_number:'DS-2',user_claim_quote_number:'Q2'}});
 await service.send({flow:'claims',mobile:'0123456789',channel:'sms'});
 const r=await service.verify({flow:'claims',code:'123456'});
 assert.equal(fetchImpl.calls.at(-1).body.claim_record_check,'multiple_record');
 assert.deepEqual(r.records.map(x=>[x.key,x.primary,x.secondary]),[['Q1','DS-1','Alex Tan'],['Q2','DS-2','Alex Tan']]);
 assert.equal((await service.selectClaimRecord('Q2')).policyNumber,'DS-2');
});

test('claims discussion: verified numbers get the booking link only',async()=>{
 const ok=live({'/api/claimFormOtpSend':{user_ids:['x'],count_claims_user_ids:1},'/api/initialClaimFormOtpVerify':{count_user_id:1}});
 await ok.service.send({flow:'discussion',mobile:'0123456789',channel:'sms'});
 assert.deepEqual(await ok.service.verify({flow:'discussion',code:'123456'}),{kind:'booking',url:bookingUrl});
 const wrong=live({'/api/claimFormOtpSend':{user_ids:['x']},'/api/initialClaimFormOtpVerify':{user_ids:'',error:'Error'}});
 await wrong.service.send({flow:'discussion',mobile:'0123456789',channel:'sms'});
 await assert.rejects(wrong.service.verify({flow:'discussion',code:'123456'}),e=>e.code==='wrong-otp');
});

test('verify without a code request is refused',async()=>{
 const {service}=live({});
 await assert.rejects(service.verify({flow:'renewal',code:'123456'}),e=>e.code==='expired');
});

test('claim submission: multipart with files; confirmed only by a safe server link',async()=>{
 const good=live({'/api/sendClaimsEmail':{url:'https://my-individualindemnity.doctorshield.com/claimSuccess'}});
 const file=new File(['x'],'report.pdf',{type:'application/pdf'});
 const r=await good.service.submitClaim({record:{quoteNumber:'Q9'},details:{name_of_insured:'Alex Tan'},files:[file]});
 assert.deepEqual(r,{accepted:true,confirmationUrl:'https://my-individualindemnity.doctorshield.com/claimSuccess'});
 const call=good.fetchImpl.calls.at(-1);assert.ok(call.body instanceof FormData);
 assert.equal(call.body.get('name_of_insured'),'Alex Tan');assert.equal(call.body.get('user_claim_quote_number'),'Q9');assert.equal(call.body.getAll('claim_to_upload[]').length,1);
 assert.equal(call.headers['Content-Type'],undefined);
 for(const response of [{},{url:'https://evil.example/ok'},{error:true,url:'https://my-individualindemnity.doctorshield.com/claimSuccess'}]){
  const bad=live({'/api/sendClaimsEmail':response});
  await assert.rejects(bad.service.submitClaim({record:{},details:{},files:[]}),/could not confirm/);
 }
});

test('without a backend nothing is sent or confirmed',async()=>{
 const s=createUnconnectedOtpService();
 for(const op of ['send','verify','selectClaimRecord','submitClaim'])await assert.rejects(s[op]({}),IntegrationRequiredError);
 assert.equal(createOtpService({apiBase:''}).mode,'unconnected');
});

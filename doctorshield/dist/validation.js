import {configuration} from './catalog.js';
import {clinicRoute} from './clinic-rules.js';
import {startDateError} from './coverage-rules.js';
import {nameError,dobError,identityError,mobileError,patientsError,incomeError,tinError} from './personal-rules.js';
export const allocationTotal=values=>Math.round(Object.values(values).reduce((sum,n)=>sum+(Number(n)||0),0)*100)/100;
export function validateCoverage(data,today=new Date(),{limits}={}){
 const errors={};
 if(!data.classification)errors.classification='Select your classification.';
 if(!(limits||configuration(data)?.limits||[]).includes(data.liability))errors.liability='Select a limit of liability for your classification.';
 {const message=startDateError(data.start,today);if(message)errors.start=message;}
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()))errors.email='Enter a valid email address.';
 if(!data.consent)errors.consent='Please read and agree to the terms before continuing.';
 if(configuration(data)?.specialist&&(allocationTotal(data.allocations)!==100||Object.values(data.allocations).some(n=>!Number.isFinite(Number(n))||n<0||n>100)))errors.allocations='Complete Service Details with a total of 100%.';
 return errors;
}
export function validateQuotation(data){
 const errors={},route=clinicRoute(data,configuration(data)?.clinic ?? true);
 for(const key of route.questions)if(!data[key])errors[key]='Select an answer.';
 if(data.clinicCover&&route.clinic&&!configuration(data)?.limits.includes(data.clinicLiability))errors.clinicLiability='Please select clinic limit of liability.';
 return errors;
}
export function validatePersonal(data,today=new Date()){
 const errors={},config=configuration(data);
 const set=(key,message)=>{if(message)errors[key]=message;};
 set('fullName',nameError(data.fullName));
 set('dob',dobError(data.dob,today));
 if(!data.nationality?.trim())errors.nationality='Select your nationality.';
 if(data.nationality==='Others'&&!data.otherNationality?.trim())errors.otherNationality='Enter your country name.';
 if(config?.nric)set('nric',identityError(data.nric,data.nationality));
 set('tin',tinError(data.tin));
 set('mobile',mobileError(data.mobile));
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email||'').trim()))errors.email='Enter a valid email address.';
 if(!data.practice?.trim())errors.practice='Enter your primary location of practice.';
 if(data.clinicCover&&!data.clinicName?.trim())errors.clinicName='Please enter the clinic name.';
 if(config?.patients)set('patients',patientsError(data.patients));
 if(config?.revenue)set('revenue',incomeError(data.revenue));
 return errors;
}
/** Explanation fields required by the current declaration answers (live portal mapping). */
export function declarationDetailFields(data){
 const a=data.answers||{};
 if(data.clinicCover)return [
  {key:'orgDetails',after:2,questions:[0,1,2],required:[0,1,2].some(i=>a['qOrg'+i]==='Yes')},
  {key:'orgCriminalDetails',after:3,questions:[3],required:a.qOrg3==='Yes'}
 ];
 return [0,1,2,3].map(i=>({key:'q'+i+'Details',after:i,questions:[i],required:i===0?a.q0==='Disagree':a['q'+i]==='Yes'}));
}
export function validateDeclarations(data){
 const errors={},org=!!data.clinicCover;
 for(let i=0;i<4;i++){const key=(org?'qOrg':'q')+i;if(!data.answers?.[key])errors[key]='Select an answer.';}
 for(const field of declarationDetailFields(data))if(field.required&&!String(data[field.key]||'').trim())errors[field.key]='Please provide details below.';
 if(!data.declaration)errors.declaration='Please read and accept the declaration before continuing.';
 return errors;
}

/** Design preview only. These illustrative rates are NOT insurer pricing. */
import {policyEndDate} from './coverage-rules.js';
const days=(a,b)=>Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/864e5)+1;
export function sampleQuote({clinicCover=false,picCover=false,start=''}={}){
 const items=[{label:'Individual indemnity',amount:1200}];
 if(clinicCover)items.push({label:'Clinic Medical Malpractice Insurance',amount:300});
 if(picCover)items.push({label:'PIC coverage',amount:150});
 const total=items.reduce((sum,item)=>sum+item.amount,0),discount=60,net=total-discount,sst=Math.round(net*8)/100,stampDuty=10;
 const final=Math.round((net+sst+stampDuty)*100)/100;
 const end=policyEndDate(start),period=end?days(start,end):0;
 // Illustrative 12-month reference for a pro-rated sample period.
 const oneYear=period?Math.round(final*365/period*100)/100:null;
 return {sample:true,items,total,discount,net,sst,stampDuty,final,oneYear};
}

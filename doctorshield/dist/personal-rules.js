// Personal particulars rules. Source: live portal client (assets/js/home.min.js and quote form markup,
// reviewed 23 Nov 2026) unless marked REVIEW #n (team-review decision).
//  - customer_name: jsCharacterOnly  /^[A-Za-z.,/@ ]*$/
//  - customer_dob: validateDOB  -> not in the future, age 16..117 years
//  - nric_number: required when the classification needs it (need_reg_no), maxlength 12; a 12-digit
//    value is a Malaysian NRIC and locks nationality to Malaysia; other values (e.g. passport) allowed.
//  - customer_phone: "+60" prefix shown, removeFirstZero, numeric, length >= 7, maxlength 11
//  - no_of_patients: numeric, maxlength 8; label "No of Patients Served in <previous year>"
//  - revenue: numeric, 2 decimals, thousands separators
//  - REVIEW #8: patients and income are mandatory when the classification asks for them.

const isoParts=iso=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso||''));if(!m)return null;const d=new Date(+m[1],+m[2]-1,+m[3]);return d.getFullYear()===+m[1]&&d.getMonth()===+m[2]-1&&d.getDate()===+m[3]?d:null;};

export function nameError(value){
 const v=String(value||'').trim();
 if(!v)return 'Enter your full name as per IC.';
 if(!/^[A-Za-z.,/@ ]+$/.test(v))return 'Use letters only. Spaces and . , / @ are allowed.';
 return '';
}

/** Age 16 to 117 on the given day. */
export function dobError(iso,today=new Date()){
 if(!iso)return 'Enter your date of birth.';
 const dob=isoParts(iso);if(!dob)return 'Enter a valid date of birth.';
 const day=new Date(today.getFullYear(),today.getMonth(),today.getDate());
 if(dob>day)return 'Date of birth cannot be in the future.';
 const latest=new Date(day.getFullYear()-16,day.getMonth(),day.getDate());
 const earliest=new Date(day.getFullYear()-117,day.getMonth(),day.getDate());
 if(dob>latest)return 'You must be at least 16 years old to apply.';
 if(dob<earliest)return 'Enter a valid date of birth.';
 return '';
}

export const normaliseId=value=>String(value||'').replace(/[\s-]/g,'').toUpperCase();
export const isMalaysianNric=value=>/^\d{12}$/.test(normaliseId(value));

/** NRIC for Malaysians; NRIC or passport number for other nationalities (same live field, max 12). */
export function identityError(value,nationality=''){
 const v=normaliseId(value);
 if(!v)return nationality&&nationality!=='Malaysia'?'Enter your NRIC or passport number.':'Enter your NRIC number.';
 if(v.length>12)return 'Use a maximum of 12 characters.';
 if(!/^[A-Z0-9]+$/.test(v))return 'Use letters and numbers only.';
 if(nationality==='Malaysia'&&!/^\d{12}$/.test(v))return 'Enter your 12-digit NRIC number without dashes.';
 return '';
}

/** 850615-10-1234 -> "850615-••-••34" for confirmation screens. */
export function maskId(value){
 const v=normaliseId(value);
 if(/^\d{12}$/.test(v))return `${v.slice(0,6)}-••-••${v.slice(10)}`;
 if(v.length<=4)return v;
 return '•'.repeat(v.length-4)+v.slice(-4);
}

/** Digits after the +60 prefix; leading 0 removed (live removeFirstZero). */
export function normaliseMobile(value){
 let v=String(value||'').replace(/[\s()-]/g,'');
 if(v.startsWith('+60'))v=v.slice(3);
 return v.replace(/^0/,'');
}
export function mobileError(value){
 const raw=String(value||'').trim();
 if(!raw)return 'Enter your mobile number.';
 const v=normaliseMobile(raw);
 if(!/^\d+$/.test(v))return 'Use numbers only, for example 12 345 6789.';
 if(v.length<7||v.length>10)return 'Enter a valid mobile number, for example 12 345 6789.';
 return '';
}

export const patientsLabel=(today=new Date())=>`No of Patients Served in ${today.getFullYear()-1}`;
export function patientsError(value){
 const v=String(value??'').replace(/[\s,]/g,'');
 if(!v)return 'Enter the number of patients served.';
 if(!/^\d+$/.test(v))return 'Enter a whole number, for example 1200.';
 if(v.length>8)return 'Use a maximum of 8 digits.';
 return '';
}

export const parseIncome=value=>{const v=String(value??'').replace(/RM|,|\s/gi,'');return /^\d+(\.\d{1,2})?$/.test(v)?Number(v):null;};
export function incomeError(value){
 const raw=String(value??'').trim();
 if(!raw)return 'Enter your income in RM.';
 const n=parseIncome(raw);
 if(n===null)return 'Enter an amount in RM, for example 250,000.00.';
 if(n>999999999999.99)return 'Enter a valid amount.';
 return '';
}
/** 250000 -> "250,000.00" (live inputmask: 2 decimals, grouped). */
export const formatIncome=value=>{const n=parseIncome(value);return n===null?String(value??''):n.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});};

export function tinError(value){
 const v=String(value||'').trim();
 if(!v)return '';
 if(!/^[A-Za-z0-9]{2,20}$/.test(v.replace(/\s/g,'')))return 'Use letters and numbers only.';
 return '';
}

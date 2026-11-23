// Coverage period rules. Source: live portal client (my-individualindemnity.doctorshield.com,
// assets/js/home.min.js, reviewed 23 Nov 2026):
//  - validateInsuranceDate: start >= today (backdating only via the admin-enabled backdate
//    agreement); latest start is 30 June of next year when today is on/after 1 April,
//    otherwise 30 June of the current year.
//  - setInsuranceEndDate (runs last on change): start before 1 July -> 31 Dec of the start year;
//    start on/after 1 July -> 31 Dec of the following year. "Policy end date is always 31st December".
//  - Premium wording: a start on 1 January is a full-year period; any other start is pro-rated and
//    the standard 12-month premium is shown for reference.
// All dates are ISO yyyy-mm-dd strings in local time. Server validation remains authoritative.

const pad=n=>String(n).padStart(2,'0');
export const isoDate=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parts=iso=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso||''));if(!m)return null;const [y,mo,d]=[+m[1],+m[2],+m[3]];const date=new Date(y,mo-1,d);return date.getFullYear()===y&&date.getMonth()===mo-1&&date.getDate()===d?{y,mo,d}:null;};

export const isValidIsoDate=iso=>!!parts(iso);

/** Earliest and latest permitted insurance start dates for a given day. */
export function startDateBounds(today=new Date()){
 const y=today.getFullYear(),april=new Date(y,3,1),day=new Date(y,today.getMonth(),today.getDate());
 return {min:isoDate(day),max:`${day>=april?y+1:y}-06-30`};
}

/** Policy end date for a start date, or '' when the start date is invalid. */
export function policyEndDate(startIso){
 const p=parts(startIso);if(!p)return '';
 return `${p.mo>=7?p.y+1:p.y}-12-31`;
}

/** True when the period is a full calendar year (start on 1 January). */
export const isFullYearPeriod=startIso=>{const p=parts(startIso);return !!p&&p.mo===1&&p.d===1;};

/** Validation message for a start date, or '' when acceptable. */
export function startDateError(startIso,today=new Date(),{backdateAllowed=false}={}){
 if(!startIso)return 'Enter the insurance start date.';
 if(!isValidIsoDate(startIso))return 'Enter a valid date.';
 const {min,max}=startDateBounds(today);
 if(startIso<min&&!backdateAllowed)return 'Backdated coverage requires the existing policy eligibility service.';
 if(startIso>max)return `Please choose a start date on or before ${displayDate(max)}.`;
 return '';
}

/** "23 Nov 2026" */
export function displayDate(iso){const p=parts(iso);if(!p)return '—';return new Date(p.y,p.mo-1,p.d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}

/** Live API date format: DD/MM/YYYY */
export function apiDate(iso){const p=parts(iso);return p?`${pad(p.d)}/${pad(p.mo)}/${p.y}`:'';}

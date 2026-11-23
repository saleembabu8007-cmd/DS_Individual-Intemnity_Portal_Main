// Synthetic QA fixtures. Every person, number and address here is invented for testing.
// Identity numbers follow the documented formats only; they belong to no one.
const today=()=>new Date().toLocaleDateString('en-CA');

const common={
 classification:'General Medical Practitioner',liability:'RM 1,000,000',promo:'',consent:true,allocations:{},
 locum:'',ownership:'',picOther:'',clinicLiability:'',clinicCover:false,picCover:false,clinicName:'',branches:[],
 intent:'Buy now',payment:'credit_card_payment',declaration:true,tin:'',otherNationality:'',
 q0Details:'',q1Details:'',q2Details:'',q3Details:'',orgDetails:'',orgCriminalDetails:'',riskDetails:''
};

export const personas=Object.freeze({
 malaysian:{
  label:'Malaysian GP (NRIC)',
  data:()=>({...common,start:today(),email:'aina.test@example.com',clinic:'No',picAny:'No',
   fullName:'Dr Aina Rahman',dob:'1986-04-12',nric:'860412140001',nationality:'Malaysia',
   mobile:'0123456789',practice:'Test Clinic, Petaling Jaya, Selangor',patients:'1500',revenue:'320,000.00',
   answers:{q0:'Agree',q1:'No',q2:'No',q3:'No'}})
 },
 passport:{
  label:'Singaporean GP (passport)',
  data:()=>({...common,start:today(),email:'wei.test@example.com',clinic:'No',picAny:'No',
   fullName:'Dr Tan Wei Ming',dob:'1979-09-30',nric:'K1234567T',nationality:'Singapore',
   mobile:'0198765432',practice:'Test Specialist Centre, Johor Bahru',patients:'900',revenue:'410,000.00',
   answers:{q0:'Agree',q1:'No',q2:'No',q3:'No'}})
 },
 clinicOwner:{
  label:'Clinic owner with add-ons',
  data:()=>({...common,start:today(),email:'farid.test@example.com',clinic:'Yes',ownership:'Partnership / Sdn Bhd',picOther:'Yes',picAny:'',
   clinicCover:true,clinicLiability:'RM 1,000,000',picCover:true,clinicName:'Test Medical Centre Sdn Bhd',
   fullName:'Dr Farid Hassan',dob:'1975-02-18',nric:'750218105555',nationality:'Malaysia',
   mobile:'0171234567',practice:'Test Medical Centre, Shah Alam, Selangor',patients:'4200',revenue:'780,000.00',
   answers:{qOrg0:'No',qOrg1:'No',qOrg2:'No',qOrg3:'No'}})
 }
});

/** Variations applied on top of a persona for scenarios. */
export const variants=Object.freeze({
 coverageOnly:d=>({...d,fullName:'',dob:'',nric:'',mobile:'',practice:'',patients:'',revenue:'',declaration:false,answers:{},payment:''}),
 invalidFormat:d=>({...d,email:'aina.test@',mobile:'12',nric:'86041214',patients:'12.5',revenue:'abc'}),
 adverse:d=>({...d,answers:{q0:'Disagree',q1:'No',q2:'Yes',q3:'No'},q0Details:'',q2Details:'',declaration:false})
});

export const testMobile='012 345 6789';
export const testCode='123456';

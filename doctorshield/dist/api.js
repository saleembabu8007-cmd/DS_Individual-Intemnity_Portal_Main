// Integration boundary. Never fabricate a quote, delivery receipt, verification or successful payment.
// Live services: quote-service.js (quotation), payment-service.js (checkout), otp-service.js (renewal/claims).
export class IntegrationRequiredError extends Error {
  constructor(operation){super(`${operation} is not connected yet. No information has been submitted.`);this.name='IntegrationRequiredError';}
}
/** Review-only application states (additional OTP and referral screens) that have no live contract yet. */
export const insuranceApi=Object.freeze({
  async requestOtp(){throw new IntegrationRequiredError('OTP delivery');},
  async verifyOtp(){throw new IntegrationRequiredError('OTP verification');},
  async requestSupport(){throw new IntegrationRequiredError('Support requests');}
});

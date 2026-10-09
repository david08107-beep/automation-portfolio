export const platforms = ['Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'Email', 'Google Business', 'Other'];
export const tones = ['Friendly', 'Professional', 'Playful', 'Educational', 'Other'];
export const emptyCampaign = () => ({business:'', audience:'', platform:'Instagram', tone:'Friendly', goal:''});

export function normalizeCampaign(input) {
  const result = {};
  for (const field of ['business','audience','platform','tone','goal']) {
    const value=input?.[field];
    const max=['platform','tone'].includes(field)?80:1000;
    if(typeof value!=='string'||!value.trim()||value.length>max) throw Error(`Campaign ${field} must be non-empty text no longer than ${max} characters.`);
    result[field]=value.trim();
  }
  if(!platforms.includes(result.platform)||!tones.includes(result.tone)) throw Error('Choose a supported platform and tone.');
  return result;
}

export function campaignRequest(brief, notes='') {
  const b=normalizeCampaign(brief);
  if(typeof notes!=='string'||notes.length>12000) throw Error('Additional details must be text no longer than 12000 characters.');
  return `Prepare a marketing campaign.\nBusiness: ${b.business}\nAudience: ${b.audience}\nPlatform: ${b.platform}\nTone: ${b.tone}\nDesired result: ${b.goal}${notes.trim()?'\nAdditional details: '+notes.trim():''}`;
}

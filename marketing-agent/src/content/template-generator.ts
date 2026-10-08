import type {Assets, Brief, Profile, CampaignKind, ContentGenerator} from '../domain/contracts.js';
import {profileDefaults} from '../domain/validation.js';
const defaults = profileDefaults;
function bookingUrl(p: Profile) { try { return ['http:','https:'].includes(new URL(p.booking).protocol)?p.booking:''; } catch { return ''; } }
function cta(s: Brief,p: Profile): string {
 if(s.goal==='Get bookings') return bookingUrl(p) ? s.platform==='Instagram' || s.platform==='TikTok' ? 'Message our team to request an appointment.' : `Book your visit: ${p.booking}` : 'Message our team to request an appointment.';
 return ({'Build awareness':`Follow ${p.name} for practical care tips.`,'Start conversations':'What would you like to know about your pup’s care? Tell us in the comments.','Thank customers':'Thank you for supporting our local team.'} as Record<string,string>)[s.goal] || 'Contact our team.';
}
function voiceIntro(tone: string,variant: 0 | 1): string {
 return ({
 'Warm & playful':['A little care for your favorite four-legged friend. 🐾','Here’s something for our local pup parents. 🐾'],
 'Polished & helpful':['A helpful update from our care team.','Care information for your next visit.'],
 'Bold & punchy':['Your pup. Their next fresh start.','Good care starts here.'],
 'Neighborly & sincere':['A little update for our neighbors.','To the dog parents in our community:']
 } as Record<string,string[]>)[tone]?.[variant] || 'An update from our team.';
}
export function instructionFacts(text: string) {
 // Common prompt instructions must not be sent as customer copy.
 return /^(write|create|generate|draft|check in with|invite a returning customer|help new|share a|promote|follow up with)\b/i.test(text.trim());
}
export function seriousConcern(text: string) { return /\b(injur\w*|bleed\w*|burn\w*|hurt|unsafe|abuse\w*|bitten|cut my|cut her|cut him|hospital\w*|vet\b)/i.test(text); }
export function createAssets(tool: CampaignKind,s: Brief,p: Profile,variant: 0 | 1): Assets {
 const audience=p.audience || defaults.audience;
 const intro=voiceIntro(s.tone,variant), action=cta(s,p), signature=p.tagline?`\n\n${p.tagline}`:'';
 const context=variant===0?`${p.name} · ${p.location}\nFor ${audience}.`:`For ${audience} — from ${p.name}.`;
 const post=`${intro}\n\n${s.topic}\n\n${context}\n${p.difference}\n\n${action}${signature}${s.platform==='Facebook'?'':'\n\n#DogCare #ShopLocal'}`;
 if(tool==='social') return {message:s.platform==='TikTok'?`ON-SCREEN HOOK\n${intro}\n\nSTARTER SCRIPT\n${s.topic}\n${action}\n\nFILM\nShow a real care detail or speak to camera; add subtitles.\n\nCAPTION\n${post}`:post};
 if(tool==='review') {
  if(seriousConcern(s.topic))return {message:variant===0?`Thank you for bringing this to our attention. We’re concerned to hear about what you described. Please contact ${p.name} directly so we can speak with you personally and understand what happened.`:`We’re concerned by your account and appreciate you letting us know. Please contact the ${p.name} team directly so we can listen to you and discuss the circumstances personally.`};
  const concern=/wait|late|delay/i.test(s.topic)?'the timing of your appointment':/price|cost|expensive|charg/i.test(s.topic)?'the pricing of your visit':'your visit';
  if(s.reviewSentiment==='Negative')return {message:variant===0?`Thank you for telling us about ${concern}. We’re sorry to hear you were disappointed. Please contact ${p.name} directly so we can listen, review what happened, and discuss next steps.`:`We appreciate you bringing your concerns about ${concern} to our attention. We’re sorry your experience was disappointing. Please reach out to the ${p.name} team so we can look into it with you.`};
  if(s.reviewSentiment==='Positive')return {message:variant===0?`Thank you for your thoughtful review! It means a great deal to the ${p.name} team. We appreciate your trust in our care and look forward to welcoming you and your pup again.`:`Your kind feedback means so much to us at ${p.name}. Thank you for supporting our local team and trusting us with your pup’s care.`};
  return {message:variant===0?`Thank you for sharing your feedback with ${p.name}. We appreciate hearing what worked and what could be better. Please contact our team if you’d like to discuss concerns from your visit.`:`We appreciate you taking the time to review ${p.name}. Your feedback helps us understand your experience. Please reach out directly if there is anything you’d like us to look into.`};
 }
 if(tool==='followup') {
  const greeting=s.customerName?`Hi ${s.customerName},`:'Hi there,';
  const closing=`\n\nWarmly,\nThe ${p.name} team`;
  if(s.followupPurpose==='Follow up on a concern')return {message:`Subject: Following up on your feedback\n\n${greeting}\n\n${s.topic}\n\n${variant===0?'We wanted to check in and hear anything else you’d like us to know. Please reply so our team can discuss next steps with you.':'Thank you for bringing this to our attention. We’re here to listen. Please reply if you would like to speak with our team about your experience.'}${closing}`};
  if(s.followupPurpose==='Invite a rebooking')return {message:`Subject: Your pup’s next visit to ${p.name}\n\n${greeting}\n\n${s.topic}\n\n${variant===0?'Would you like to arrange your next visit?':'We’d be happy to help you plan your pup’s next appointment.'} ${bookingUrl(p)?`You can request a booking here: ${p.booking}`:'Reply to ask about availability.'}${closing}`};
  return {message:`Subject: A check-in from ${p.name}\n\n${greeting}\n\n${s.topic}\n\n${variant===0?'How is your pup doing? If you have any questions about their care after the visit, just reply—we’d be happy to help.':'We wanted to see how things are going after your visit. Please reply with any questions or feedback for our team.'}${closing}`};
 }
 const focus=s.offer || s.topic;
 const themes: [string,string,string][]=variant===0?[
  ['Preparation','One step toward a calmer visit','Before your visit, tell us about your pup’s coat, comfort level, and previous grooming experiences. Ask our team which preparation would help.'],
  ['Trust','Meet the team behind your pup’s care',`${p.difference} At ${p.name}, we’re happy to discuss your pup’s needs before the appointment.`],
  ['Invitation','Ready to plan your pup’s next visit?',`${s.topic} ${action}`]
 ]:[
  ['Questions','A grooming question worth asking','Ask your groomer how they adapt care to your dog’s coat and comfort level. Our team welcomes your questions.'],
  ['Process','What happens before the groom?',`Tell us what matters to your pup. Here’s our approach: ${p.difference}`],
  ['Next step','Let’s talk about your pup’s care',`${s.topic} Contact ${p.name} to discuss the care options that suit your pup.`]
 ];
 const result:Assets={
  strategy:`CAMPAIGN · ${p.name}\n\nOutcome: ${s.goal}\nAudience: ${audience}\nChannel: ${s.platform}\nFocus: ${focus}\nFacts: ${s.topic}${s.deadline?`\nDeadline: ${s.deadline}`:''}\n\nAPPROACH\n${variant===0?'Lead with practical help, demonstrate your care, then invite a next step.':'Answer a real customer question, show your approach, then make a clear invitation.'}\n\nNEXT STEP\n${action}\n${bookingUrl(p)?`Booking destination: ${p.booking}\nFor Instagram/TikTok, confirm your profile booking route or handle inquiries through messages.\n`:''}\nMEASURE\nLog inquiries, confirmed bookings, completed-sale revenue, and marketing spend in Results.\n\nBEFORE SHARING\nConfirm offer details, availability, and permission for any customer photos.`,
  'Launch post':post
 };
 themes.forEach(([purpose,hook,body],index)=>{
  result[`Video ${index+1} script: ${purpose}`]=`${hook}\n\n${body}`;
  result[`Video ${index+1} caption: ${purpose}`]=`${hook}\n\n${body}${index===2?'':`\n${s.goal==='Get bookings'?'Message us with your questions.':action}`}${signature}`;
 });
 result['Filming notes']='Film vertical clips with subtitles. For the first concept, speak to camera or demonstrate the care tip. For the second, introduce a team member or show a real care detail. For the third, speak directly to the viewer with one clear invitation. Obtain permission before including a customer or their dog.';
 result['Seven-day plan']=`WEEKLY FOCUS\n${focus}\n\nMONDAY · Film the three concepts and check their details.\nTUESDAY · Share Video 1 and reply to questions.\nWEDNESDAY · Answer a question from ${audience}.\nTHURSDAY · Share Video 2 to show your care.\nFRIDAY · Share the launch post${s.deadline?` and mention the ${s.deadline} deadline`:''}.\nSATURDAY · Share Video 3 with your invitation.\nSUNDAY · Log outcomes in Results and decide what to repeat.`;
 return result;
}

export class TemplateContentGenerator implements ContentGenerator {generate(kind:CampaignKind,brief:Brief,profile:Profile,variant:0|1):Assets{return createAssets(kind,brief,profile,variant);}}

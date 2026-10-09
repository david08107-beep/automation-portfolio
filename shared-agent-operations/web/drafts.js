// Recovery copies are editable browser notes, never approval authority.
import {emptyCampaign, platforms, tones} from './campaign.js';
export const STORAGE_KEY = 'orbit.assistant.recovery.v1';
const validPayload = p => p && typeof p.launchPost === 'string' && typeof p.shortVideoScript === 'string'
  && Array.isArray(p.calendar) && p.calendar.every(item => typeof item === 'string');

export class DraftRecovery {
  constructor(storage) {
    this.storage = storage;
    this.state = {drafts: {}, request: '', priorities: '', view: 'overview', selected: null, campaign:emptyCampaign(), briefMode:'guided'};
    this.persistent = true;
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        this.state.request = typeof data.request === 'string' ? data.request.slice(0, 20_000) : '';
        this.state.priorities = typeof data.priorities === 'string' ? data.priorities.slice(0, 2000) : '';
        this.state.view = ['overview','work','studio','review','activity'].includes(data.view) ? data.view : 'overview';
        this.state.selected = typeof data.selected === 'string' ? data.selected : null;
        this.state.briefMode = data.briefMode === 'free' ? 'free' : 'guided';
        for(const field of ['business','audience','goal']) if(typeof data.campaign?.[field]==='string') this.state.campaign[field]=data.campaign[field].slice(0,1000);
        if(platforms.includes(data.campaign?.platform)) this.state.campaign.platform=data.campaign.platform;
        if(tones.includes(data.campaign?.tone)) this.state.campaign.tone=data.campaign.tone;
        for (const [id, draft] of Object.entries(data.drafts ?? {})) {
          if (typeof draft?.baseVersionId === 'string' && validPayload(draft.payload)) this.state.drafts[id] = draft;
        }
      }
    } catch {this.persistent = false;}
  }
  write(update) {
    try {
      const latest = new DraftRecovery(this.storage);
      if (!latest.persistent) throw new Error('Storage unavailable');
      update(latest.state);
      this.storage.setItem(STORAGE_KEY, JSON.stringify(latest.state));
      this.state = latest.state;
      this.persistent = true;
    } catch {update(this.state); this.persistent = false;}
    return this.persistent;
  }
  remember(id, baseVersionId, payload) {
    if (!validPayload(payload)) throw new Error('Invalid recovery draft.');
    return this.write(state => {state.drafts[id] = {baseVersionId, payload: structuredClone(payload)};});
  }
  get(id) {return this.state.drafts[id] ? structuredClone(this.state.drafts[id]) : null;}
  discard(id) {return this.write(state => {delete state.drafts[id];});}
  note(field, value) {
    if (!['request', 'priorities'].includes(field)) throw new Error('Unknown note.');
    return this.write(state => {state[field] = value;});
  }
  setView(view, selected) {
    return this.write(state => {state.view = view; state.selected = selected;});
  }
  campaignNote(campaign, briefMode) {
    return this.write(state=>{state.campaign=structuredClone(campaign); state.briefMode=briefMode==='free'?'free':'guided';});
  }
}

export type Revision = number;
export type CampaignKind = 'social' | 'campaign' | 'review' | 'followup';
export type Assets = Record<string, string>;
export interface Actor { id: string; name: string; }
export interface Workspace { id: string; ownerId: string; name: string; }
export interface ActorContext { actor: Actor; workspaceId: string; }
export interface Brief {
 topic: string; goal: string; platform: string; tone: string; offer: string; deadline: string;
 reviewSentiment: string; followupPurpose: string; customerName: string;
}
export interface Profile { name: string; type: string; difference: string; location: string; voice: string; tagline: string; booking: string; audience: string; }
export interface CampaignVersion {
 id: string; campaignId: string; revision: Revision; assets: Assets; variant: 0 | 1;
 label: string; createdBy: string; createdAt: string; updatedAt: string;
}
export interface Campaign {
 id: string; workspaceId: string; kind: CampaignKind; brief: Brief; profile: Profile;
 revision: Revision; archived: boolean; createdBy: string; createdAt: string; updatedAt: string;
 versions: CampaignVersion[]; legacyId?: string;
}
/** Manual business result, not an execution result or an attribution claim. */
export interface Result { id: string; workspaceId: string; revision: Revision; campaign: string; source: string; date: string; currency: string; inquiries: number; bookings: number; booked: number; revenue: number; spend: number; }
export type ErrorCode = 'VALIDATION_ERROR' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'REVISION_CONFLICT' | 'IDEMPOTENCY_CONFLICT' | 'ID_CONFLICT' | 'ARCHIVED' | 'PERSISTENCE_ERROR';
export interface StructuredError { code: ErrorCode; message: string; retryable: boolean; details?: Record<string, unknown>; }
export type ServiceResult<T> = {ok: true; value: T} | {ok: false; error: StructuredError};
export interface ContentGenerator { generate(kind: CampaignKind, brief: Brief, profile: Profile, variant: 0 | 1): Assets; }
export interface CreateCampaignInput { id?: string; kind: CampaignKind; brief: Brief; profile: Profile; variant: 0 | 1; }
export interface SaveVersionInput { campaignId: string; expectedRevision: Revision; assets: Assets; variant: 0 | 1; label: string; }
export interface UpdateVersionInput extends SaveVersionInput { versionId: string; expectedVersionRevision: Revision; }
export interface CampaignWriteInput { campaignId: string; expectedRevision: Revision; }
export interface ImportReport { imported: string[]; unchanged: string[]; rejected: {index: number; error: StructuredError}[]; batchId: string; }

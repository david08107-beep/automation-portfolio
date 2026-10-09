import {
  FixtureOrbitBriefAdapter,
  MemoryWorkflowRepository,
  OperationError,
  SharedAgentOperations,
} from './operations.js';

const clone = value => structuredClone(value);

function canonical(value) {
  const sort = item => Array.isArray(item)
    ? item.map(sort)
    : item && typeof item === 'object'
      ? Object.fromEntries(Object.keys(item).sort().map(key => [key, sort(item[key])]))
      : item;
  return JSON.stringify(sort(value));
}

function serviceValue(result, fallbackCode, fallbackMessage) {
  if (result?.ok === true) return result.value;
  const error = result?.error ?? {};
  throw new OperationError(
    typeof error.code === 'string' ? error.code : fallbackCode,
    typeof error.message === 'string' ? error.message : fallbackMessage,
    error.retryable === true,
    error.details,
  );
}

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new OperationError('ADAPTER_CONTRACT_INVALID', `${label} is required.`);
  }
  return value.trim();
}

function requireContext(expected, actual) {
  if (!actual || actual.actorId !== expected.actorId || actual.workspaceId !== expected.workspaceId) {
    throw new OperationError('WORKSPACE_MISMATCH', 'The baseline adapter context does not match the shared workflow.');
  }
}

export class AiOsEngineAdapter {
  constructor({engine, repository}) {
    if (!engine || typeof engine.enqueue !== 'function') {
      throw new OperationError('ADAPTER_CONTRACT_INVALID', 'AI OS engine.enqueue is required.');
    }
    if (!repository || typeof repository.read !== 'function' || typeof repository.write !== 'function') {
      throw new OperationError('ADAPTER_CONTRACT_INVALID', 'AI OS state repository read/write methods are required.');
    }
    this.engine = engine;
    this.repository = repository;
  }

  schedule(brief, metadata = {}) {
    const request = requireText(brief?.request, 'Orbit request');
    let state;
    try {
      state = this.repository.read();
    } catch {
      throw new OperationError('PERSISTENCE_FAILED', 'AI OS state could not be read.', true);
    }
    const baselineWorkflow = this.engine.enqueue(state, request, 'brief');
    if (!baselineWorkflow || !Array.isArray(baselineWorkflow.tasks)) {
      throw new OperationError('AI_OS_SCHEDULE_FAILED', 'AI OS rejected the shared workflow request.');
    }
    try {
      this.repository.write(state);
    } catch {
      throw new OperationError('PERSISTENCE_FAILED', 'AI OS scheduling state could not be saved.', true);
    }
    return baselineWorkflow.tasks.map((item, index, items) => ({
      id: requireText(item.id, 'AI OS task ID'),
      owner: item.agent === 'writer' ? 'marketing-agent' : 'ai-os',
      title: requireText(item.title, 'AI OS task title'),
      dependsOn: index === 0 ? [] : [items[index - 1].id],
      baseline: {
        project: 'ai-os',
        workflowId: baselineWorkflow.id,
        taskId: item.id,
        agent: item.agent,
        sharedWorkflowId: metadata.workflowId,
      },
    }));
  }
}

const defaultBrief = brief => ({
  topic: brief.request,
  goal: brief.goal,
  platform: 'shared-agent-operations',
  tone: 'professional',
  offer: 'fictional demonstration only',
  deadline: 'not scheduled',
  reviewSentiment: 'mixed',
  followupPurpose: 'owner review',
  customerName: 'fictional customer',
});

const defaultProfile = Object.freeze({
  name: 'Fictional Operations Studio',
  type: 'simulation',
  difference: 'review-first shared agent workflow',
  location: 'fictional workspace',
  voice: 'clear and practical',
  tagline: 'Prepared for review, never auto-published',
  booking: 'No real booking destination',
  audience: 'fictional dog-care clients',
});

export class MarketingCampaignServiceAdapter {
  #versionCampaigns = new Map();

  constructor({service, context, mapBrief = defaultBrief, profile = defaultProfile}) {
    if (!service || typeof service.createCampaign !== 'function' || typeof service.getCampaign !== 'function' || typeof service.listCampaigns !== 'function') {
      throw new OperationError('ADAPTER_CONTRACT_INVALID', 'Marketing CampaignService create/get/list methods are required.');
    }
    this.service = service;
    this.context = {
      actor: {id: requireText(context?.actor?.id, 'Marketing actor ID'), name: requireText(context?.actor?.name, 'Marketing actor name')},
      workspaceId: requireText(context?.workspaceId, 'Marketing workspace ID'),
    };
    this.mapBrief = mapBrief;
    this.profile = clone(profile);
  }

  #remember(campaign) {
    if (!campaign || !Array.isArray(campaign.versions) || !Number.isSafeInteger(campaign.revision)) {
      throw new OperationError('ADAPTER_CONTRACT_INVALID', 'Marketing returned an invalid campaign.');
    }
    for (const version of campaign.versions) this.#versionCampaigns.set(version.id, campaign.id);
    return campaign;
  }

  #source(campaign, versionId) {
    const version = campaign.versions.find(item => item.id === versionId);
    if (!version || !Number.isSafeInteger(version.revision) || !version.assets || typeof version.assets !== 'object') {
      throw new OperationError('SOURCE_NOT_FOUND', 'Marketing source version not found.');
    }
    return {
      campaignId: campaign.id,
      campaignRevision: campaign.revision,
      versionId: version.id,
      versionRevision: version.revision,
      assets: clone(version.assets),
    };
  }

  prepare(brief, metadata = {}) {
    requireContext({actorId: this.context.actor.id, workspaceId: this.context.workspaceId}, metadata);
    const workflowId = requireText(metadata.workflowId, 'Shared workflow ID');
    const input = {kind: 'campaign', brief: this.mapBrief(clone(brief)), profile: clone(this.profile), variant: 0};
    const campaign = this.#remember(serviceValue(
      this.service.createCampaign(this.context, input, `shared:${this.context.workspaceId}:${workflowId}:prepare`),
      'MARKETING_PREPARATION_FAILED',
      'Marketing could not prepare the campaign.',
    ));
    const version = campaign.versions.at(-1);
    return this.#source(campaign, version?.id);
  }

  source(versionId) {
    let campaignId = this.#versionCampaigns.get(versionId);
    if (!campaignId) {
      const campaigns = serviceValue(this.service.listCampaigns(this.context), 'SOURCE_NOT_FOUND', 'Marketing source version not found.');
      const match = campaigns.find(campaign => campaign.versions?.some(version => version.id === versionId));
      if (!match) throw new OperationError('SOURCE_NOT_FOUND', 'Marketing source version not found.');
      this.#remember(match);
      campaignId = match.id;
    }
    const campaign = this.#remember(serviceValue(
      this.service.getCampaign(this.context, campaignId),
      'SOURCE_NOT_FOUND',
      'Marketing source campaign not found.',
    ));
    return this.#source(campaign, versionId);
  }
}

export class OrbitReplyServiceExecutorAdapter {
  #receipts = new Map();

  constructor({service, context, messageId, to, subject = 'Shared Agent Operations simulated campaign'}) {
    const required = ['createReplyDraft', 'reviseReplyDraft', 'requestReplyReview', 'approveReplyVersion', 'executeApprovedReply', 'getReplyHistory'];
    if (!service || required.some(method => typeof service[method] !== 'function')) {
      throw new OperationError('ADAPTER_CONTRACT_INVALID', 'Orbit reply service draft/review/approval/execution methods are required.');
    }
    this.service = service;
    this.context = {
      actorId: requireText(context?.actorId, 'Orbit actor ID'),
      workspaceId: requireText(context?.workspaceId, 'Orbit workspace ID'),
    };
    this.messageId = requireText(messageId, 'Orbit message ID');
    this.to = requireText(to, 'Orbit simulated recipient');
    this.subject = requireText(subject, 'Orbit simulated subject');
  }

  #input(extra = {}) {
    return {
      actor: {id: this.context.actorId},
      workspace: {id: this.context.workspaceId},
      messageId: this.messageId,
      ...extra,
    };
  }

  #receipt(execution, idempotencyKey, payload) {
    if (!execution || execution.simulated !== true || execution.status !== 'Sent') {
      throw new OperationError('UNSAFE_EXECUTION', 'Orbit must return a simulated execution receipt.');
    }
    return {
      id: requireText(execution.id, 'Orbit execution ID'),
      idempotencyKey,
      simulated: true,
      status: 'Sent',
      payload: clone(payload),
      at: requireText(execution.at, 'Orbit execution timestamp'),
      baseline: {project: 'orbit', executionId: execution.id, versionId: execution.versionId},
    };
  }

  execute(input) {
    requireContext(this.context, input.context);
    const key = requireText(input.idempotencyKey, 'Shared execution idempotency key');
    const cached = this.#receipts.get(key);
    if (cached) return clone(cached);
    const payload = clone(input.payload);
    if (input.approval?.status !== 'approved'
      || input.approval.versionId !== input.version?.id
      || input.approval.payloadDigest !== input.version?.payloadDigest
      || canonical(input.version?.payload) !== canonical(payload)) {
      throw new OperationError('APPROVAL_REQUIRED', 'Orbit requires the current exact shared approval and payload.');
    }
    const workflowId = requireText(input.workflowId, 'Shared workflow ID');
    const body = `SHARED AGENT OPERATIONS — SIMULATED\nWorkflow: ${workflowId}\n\n${canonical(payload)}`;
    const history = serviceValue(
      this.service.getReplyHistory(this.#input()),
      'PERSISTENCE_FAILED',
      'Orbit reply history could not be read.',
    );
    const existing = history.executions?.find(item => item.simulated === true
      && item.status === 'Sent'
      && item.payload?.body === body
      && item.payload?.to === this.to
      && item.payload?.subject === this.subject);
    if (existing) {
      const receipt = this.#receipt(existing, key, payload);
      this.#receipts.set(key, receipt);
      return clone(receipt);
    }
    const settings = {goal: 'confirm', tone: 'professional', feedback: 'positive'};
    let prepared = serviceValue(this.service.createReplyDraft(this.#input({
      body,
      to: this.to,
      subject: this.subject,
      brief: `Shared workflow ${workflowId}; exact payload only.`,
      settings,
    })), 'ORBIT_DRAFT_FAILED', 'Orbit could not create the simulated reply draft.');
    if (prepared.version?.body !== body || prepared.version?.to !== this.to || prepared.version?.subject !== this.subject) {
      prepared = serviceValue(this.service.reviseReplyDraft(this.#input({
        draftId: prepared.draft.id,
        expectedRevision: prepared.draft.currentRevision,
        body,
        to: this.to,
        subject: this.subject,
        brief: `Shared workflow ${workflowId}; exact payload only.`,
        settings,
      })), 'ORBIT_DRAFT_FAILED', 'Orbit could not freeze the simulated reply draft.');
    }
    const review = serviceValue(this.service.requestReplyReview(this.#input({
      draftId: prepared.draft.id,
      versionId: prepared.version.id,
    })), 'ORBIT_REVIEW_FAILED', 'Orbit could not create the exact-version review.');
    const approval = serviceValue(this.service.approveReplyVersion(this.#input({
      draftId: prepared.draft.id,
      reviewId: review.review.id,
    })), 'ORBIT_APPROVAL_FAILED', 'Orbit could not project the shared approval.');
    let execution;
    try {
      execution = serviceValue(this.service.executeApprovedReply(this.#input({
        draftId: prepared.draft.id,
        approvalId: approval.approval.id,
      })), 'EXECUTION_FAILED', 'Orbit simulated execution failed.').execution;
    } catch (error) {
      if (error instanceof OperationError && error.code === 'ALREADY_EXECUTED' && error.details?.execution) {
        execution = error.details.execution;
      } else {
        throw error;
      }
    }
    const receipt = this.#receipt(execution, key, payload);
    this.#receipts.set(key, receipt);
    return clone(receipt);
  }
}

export function createBaselineAdapterSystem({
  aiOsEngine,
  aiOsRepository,
  marketingService,
  marketingContext,
  orbitReplyService,
  orbitContext,
  orbitMessageId,
  orbitRecipient,
  orbitSubject,
  orbitBrief = new FixtureOrbitBriefAdapter(),
  repository = new MemoryWorkflowRepository(),
}) {
  const aiOs = new AiOsEngineAdapter({engine: aiOsEngine, repository: aiOsRepository});
  const marketing = new MarketingCampaignServiceAdapter({service: marketingService, context: marketingContext});
  const orbitExecutor = new OrbitReplyServiceExecutorAdapter({
    service: orbitReplyService,
    context: orbitContext,
    messageId: orbitMessageId,
    to: orbitRecipient,
    subject: orbitSubject,
  });
  const operations = new SharedAgentOperations({repository, orbitBrief, aiOs, marketing, orbitExecutor});
  return {operations, repository, aiOs, marketing, orbitExecutor};
}

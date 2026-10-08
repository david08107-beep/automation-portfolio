export function reviewedExport(workflow) {
  const version=workflow.results.at(-1);
  const approved=workflow.approvals.some(a=>['approved','executed'].includes(a.status)&&a.versionId===version?.id&&a.payloadDigest===version?.payloadDigest);
  if(!version||!approved||workflow.status==='cancelled') throw Error('Approve the current saved version before copying or downloading.');
  const brief=workflow.command.campaignBrief;
  const content=[
    'ORBIT — REVIEWED CAMPAIGN DRAFT',
    'Local preview: sample content, not AI-generated. Nothing was published or sent.',
    `Request ID: ${workflow.id}`, `Reviewed version: ${version.number} (${version.id})`,
    '', 'REQUEST',workflow.command.request,
    ...(brief?['','CAMPAIGN BRIEF',...Object.entries(brief).map(([key,value])=>`${key}: ${value}`)]:[]),
    '', 'LAUNCH POST',version.payload.launchPost,
    '', 'SHORT VIDEO SCRIPT',version.payload.shortVideoScript,
    '', 'CONTENT CALENDAR',...version.payload.calendar.map((item,index)=>`${index+1}. ${item}`),
  ].join('\n');
  return {content,filename:`orbit-campaign-${workflow.id.replace(/[^a-zA-Z0-9-]/g,'').slice(0,64)}-v${version.number}.txt`};
}

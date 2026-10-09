(function(root){
  'use strict';
  const clone=v=>JSON.parse(JSON.stringify(v));
  const empty=()=>({
    schemaVersion:1,drafts:[],reviews:[],approvals:[],executions:[],activity:[]
  });
  function validateStore(v){
    const invalid=()=>{
      throw new Error('Invalid reply repository');
    };
    const text=x=>typeof x==='string'&&x.length>0;
    const date=x=>text(x)&&Number.isFinite(Date.parse(x));
    const identity=x=>x&&['id','messageId','workspaceId','actorId'].every(k=>text(x[k]));
    const same=(a,b)=>['messageId','workspaceId','actorId'].every(k=>a[k]===b[k]);
    if(!v || v.schemaVersion!==1 || !['drafts','reviews','approvals','executions','activity'].every(k=>Array.isArray(v[k])))invalid();
    const ids=new Set(),versions=new Map(),drafts=new Map(),reviews=new Map(),approvals=new Map(),keys=new Set();
    const unique=x=>{
      if(!text(x.id)||ids.has(x.id))invalid();
      ids.add(x.id);
    };
    for(const d of v.drafts){
      if(!identity(d)||!Number.isInteger(d.currentRevision)||d.currentRevision<1||!Array.isArray(d.versions)||d.versions.length!==d.currentRevision)invalid();
      unique(d);
      drafts.set(d.id,d);
      d.versions.forEach((version,index)=>{
        if(!identity(version)||!same(d,version)||version.draftId!==d.id||version.revision!==index+1||version.status!=='saved'||!date(version.createdAt)||!text(version.body)||version.body.length>10000||!text(version.to)||!text(version.subject)||typeof version.brief!=='string'||!version.settings||typeof version.settings!=='object'||Array.isArray(version.settings))invalid();
        unique(version);
        versions.set(version.id,version);
      });
    }
    const linked=x=>{
      const version=versions.get(x?.versionId);
      return identity(x)&&version&&same(x,version)&&x.draftId===version.draftId&&x.revision===version.revision;
    };
    for(const r of v.reviews){
      if(!linked(r)||r.status!=='requested'||!date(r.createdAt))invalid();
      unique(r);
      reviews.set(r.id,r);
    }
    for(const a of v.approvals){
      const r=reviews.get(a?.reviewId);
      if(!linked(a)||!r||r.versionId!==a.versionId||!same(r,a)||!['approved','invalidated','executed'].includes(a.status)||!date(a.approvedAt)||!date(a.expiresAt)||Date.parse(a.expiresAt)<=Date.parse(a.approvedAt))invalid();
      unique(a);
      approvals.set(a.id,a);
    }
    for(const e of v.executions){
      const version=versions.get(e?.versionId),approval=approvals.get(e?.approvalId);
      if(!identity(e)||!version||!approval||!same(e,version)||e.draftId!==version.draftId||approval.versionId!==e.versionId||approval.status!=='executed'||e.idempotencyKey!==`${e.workspaceId}:${e.draftId}:${e.versionId}`||keys.has(e.idempotencyKey)||e.status!=='Sent'||e.simulated!==true||!date(e.at)||!e.payload||['to','subject','body'].some(k=>e.payload[k]!==version[k]))invalid();
      unique(e);
      keys.add(e.idempotencyKey);
    }
    for(const e of v.activity){
      if(!identity(e)||!date(e.at)||!text(e.kind))invalid();
      unique(e);
    }
    return clone(v);
  }
  function memoryRepository(initial=empty()){
    let data=validateStore(initial);
    return {
      read:()=>clone(data),write:next=>{
        data=validateStore(next);
        return {
          durable:true
        };
      }
    };
  }
  function demoExecutor(){
    const receipts=new Map();
    let fail=false,calls=0;
    return {
      failNext:()=>{
        fail=true;
      },get calls(){
        return calls;
      },execute({
        version,approval,idempotencyKey,now
      }){
        if(!approval || approval.versionId!==version.id || approval.status!=='approved')throw Error('Unapproved demo execution');
        if(receipts.has(idempotencyKey))return clone(receipts.get(idempotencyKey));
        if(fail){
          fail=false;
          throw Error('Simulated execution failure');
        }
        calls++;
        const receipt={
          id:'demo:'+idempotencyKey,idempotencyKey,versionId:version.id,status:'Sent',simulated:true,at:now,payload:{
            to:version.to,subject:version.subject,body:version.body
          }
        };
        receipts.set(idempotencyKey,receipt);
        return clone(receipt);
      }
    };
  }
  function alternativeBody({
    message,settings,brief,variant
  }){
    const i=(variant-1)%3;
    const greetings=settings.tone==='warm'?['Hi','Hello','Hey']:['Hello','Hi','Dear'];
    const response={
      positive:['The direction looks promising.','I appreciate the progress so far.','This looks like a constructive next step.'],mixed:['There are useful points here, and a few details still need review.','I see potential, but I need to resolve the open questions first.','Some elements work well; others need clarification.'],negative:['I have concerns about proceeding as proposed.','The current proposal does not meet what I need.','I cannot support the proposal in its current form.']
    }
    [settings.feedback][i];
    const action={
      clarify:['Please clarify the details and any outstanding constraints before I decide.','Could you send the missing information so I can review the next step?','I need more context on the proposal before making a commitment.'],confirm:['I confirm the proposed next step as described in this fictional message.','Please proceed with the next step outlined in this demo conversation.','The proposed next step works for me in this fictional scenario.'],decline:['I will not proceed with this proposal. Thank you for understanding.','Please treat this as a respectful decline of the proposed next step.','I am declining the proposal for now; thank you for sharing it.']
    }
    [settings.goal][i];
    const effectiveAction=settings.goal==='confirm' && settings.feedback==='negative'?'I can confirm a further review, but not acceptance of the proposal while these concerns remain.':settings.goal==='confirm' && settings.feedback==='mixed'?'I can confirm the next review step, subject to resolving the points above.':action;
    const ending=settings.tone==='warm'?'Thanks again,':settings.tone==='concise'?'Regards,':'Best regards,';
    const body=`${greetings[i]} ${message.sender.split(' ')[0]},\n\n${(settings.tone==='concise'?{positive:'Looks promising.',mixed:'Some points need review.',negative:'I have concerns.'}[settings.feedback]:response)+'\n\n'}Regarding ${message.subject}: ${effectiveAction}${brief?'\n\nMy review notes: '+brief:''}\n\n${ending}\nDave`;
    return body;
  }
  function createService({
    repository,messages,executor=demoExecutor(),clock=()=>new Date().toISOString(),id=()=>globalThis.crypto.randomUUID()
  }){
    const fault=(code,message,details={
    })=>{
      const e=Error(message);
      e.code=code;
      e.details=details;
      throw e;
    };
    const header=(v,max)=>typeof v==='string'&&v.trim()&&v.length<=max&&!/[\r\n\x00]/.test(v);
    const address=v=>header(v,320)&&/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(v);
    function context(input){
      if(!input || !header(input.actor?.id,100) || !header(input.workspace?.id,100) || !header(input.messageId,100))fault('INVALID_INPUT','Provide actor, workspace, and message identity.');
      const message=messages.find(m=>m.id===input.messageId);
      if(!message)fault('MESSAGE_NOT_FOUND','Fictional message was not found.');
      if(message.workspaceId!==input.workspace.id)fault('WORKSPACE_MISMATCH','Message does not belong to this workspace.');
      return clone(message);
    }
    function run(input,fn){
      try{
        const message=context(input);
        let data;
        try{
          data=validateStore(repository.read());
        }
        catch{
          fault('PERSISTENCE_FAILED','Reply history could not be read.');
        }
        const now=clock();
        const event=(kind,record)=>{
          data.activity.push({
            id:id(),workspaceId:input.workspace.id,actorId:input.actor.id,messageId:message.id,kind,at:now,...record
          });
        };
        const persist=()=>{
          let result;
          try{
            result=repository.write(clone(data));
          }
          catch{
            fault('PERSISTENCE_FAILED','Reply changes could not be persisted.');
          }
          return {
            durable:result?.durable!==false
          };
        };
        return {
          ok:true,value:fn({
            message,data,now,event,persist
          })
        };
      }
      catch(e){
        return {
          ok:false,error:{
            code:e.code||'INVALID_INPUT',message:e.code?e.message:'Invalid reply operation.',retryable:['PERSISTENCE_FAILED','EXECUTION_FAILED'].includes(e.code),details:e.details||{
            }
          }
        };
      }
    }
    function findDraft(data,input){
      const d=data.drafts.find(d=>d.id===input.draftId);
      if(!d)fault('INVALID_INPUT','Draft was not found.');
      if(d.workspaceId!==input.workspace.id || d.messageId!==input.messageId || d.actorId!==input.actor.id)fault('WORKSPACE_MISMATCH','Draft context does not match.');
      return d;
    }
    function append({
      data,message,now,event
    },draft,input){
      if(input.expectedRevision!==draft.currentRevision)fault('STALE_REVISION','Draft changed; reload before saving.');
      if(data.executions.some(e=>e.draftId===draft.id))fault('ALREADY_EXECUTED','This message reply already executed.');
      const body=input.body;
      if(typeof body!=='string'||!body.trim()||body.length>10000||!address(input.to??message.to)||!header(input.subject??('Re: '+message.subject),300)||typeof (input.brief??'')!=='string'||(input.brief??'').length>4000)fault('INVALID_INPUT','Provide a valid reply body, brief, recipient, and subject.');
      const settings=clone(input.settings||{
      });
      if(Object.keys(settings).some(k=>!['goal','tone','feedback'].includes(k)) || (settings.goal!==undefined&&!['clarify','confirm','decline'].includes(settings.goal)) || (settings.tone!==undefined&&!['professional','warm','concise'].includes(settings.tone)) || (settings.feedback!==undefined&&!['positive','mixed','negative'].includes(settings.feedback)))fault('INVALID_INPUT','Invalid reply settings.');
      const value={
        body,to:input.to??message.to,subject:input.subject??('Re: '+message.subject),brief:input.brief??'',settings
      };
      const previous=draft.versions.at(-1);
      if(previous && JSON.stringify(value)===JSON.stringify({
        body:previous.body,to:previous.to,subject:previous.subject,brief:previous.brief,settings:previous.settings
      }))return previous;
      const revision=draft.currentRevision+1;
      const version={
        id:id(),draftId:draft.id,revision,messageId:message.id,workspaceId:input.workspace.id,actorId:input.actor.id,createdAt:now,status:'saved',...value
      };
      draft.currentRevision=revision;
      draft.versions.push(version);
      for(const approval of data.approvals.filter(a=>a.draftId===draft.id&&a.status==='approved'))approval.status='invalidated';
      event('draft.saved',{
        draftId:draft.id,versionId:version.id,revision
      });
      return version;
    }
    const service={
      prepareReplyAlternative:input=>run(input,c=>{
        const draft=findDraft(c.data,input);
        if(input.expectedRevision!==draft.currentRevision)fault('STALE_REVISION','Draft changed.');
        draft.alternativeIndex=(draft.alternativeIndex||0)+1;
        const body=alternativeBody({
          message:c.message,settings:input.settings||{
            goal:'clarify',tone:'professional',feedback:'mixed'
          },brief:input.brief||'',variant:draft.alternativeIndex
        });
        const version=append(c,draft,{
          ...input,body
        });
        return {
          draft:clone(draft),version:clone(version),...c.persist()
        };
      }),
      loadMessage:input=>run(input,({
        message
      })=>message),
      createReplyDraft:input=>run(input,c=>{
        const existing=c.data.drafts.find(d=>d.messageId===c.message.id&&d.workspaceId===input.workspace.id&&d.actorId===input.actor.id);
        if(existing)return {
          draft:clone(existing),version:clone(existing.versions.at(-1))
        };
        const draft={
          id:id(),messageId:c.message.id,workspaceId:input.workspace.id,actorId:input.actor.id,currentRevision:0,versions:[]
        };
        c.data.drafts.push(draft);
        const version=append(c,draft,{
          ...input,expectedRevision:0,body:input.body??c.message.draft,brief:input.brief??c.message.summary
        });
        const persistence=c.persist();
        return {
          draft:clone(draft),version:clone(version),...persistence
        };
      }),
      reviseReplyDraft:input=>run(input,c=>{
        const draft=findDraft(c.data,input),version=append(c,draft,input);
        return {
          draft:clone(draft),version:clone(version),...c.persist()
        };
      }),
      saveReplyDraftVersion:input=>service.reviseReplyDraft(input),
      requestReplyReview:input=>run(input,c=>{
        const draft=findDraft(c.data,input);
        const version=draft.versions.find(v=>v.id===input.versionId);
        if(!version)fault('INVALID_INPUT','Draft version does not exist.');
        if(version.revision!==draft.currentRevision)fault('STALE_REVISION','Only the current draft can be reviewed.');
        const review={
          id:id(),draftId:draft.id,versionId:version.id,revision:version.revision,messageId:c.message.id,workspaceId:input.workspace.id,actorId:input.actor.id,createdAt:c.now,status:'requested'
        };
        c.data.reviews.push(review);
        c.event('review.requested',{
          reviewId:review.id,versionId:version.id
        });
        return {
          review:clone(review),...c.persist()
        };
      }),
      approveReplyVersion:input=>run(input,c=>{
        const draft=findDraft(c.data,input);
        const review=c.data.reviews.find(r=>r.id===input.reviewId&&r.draftId===draft.id);
        if(!review)fault('APPROVAL_REQUIRED','Review this draft before approval.');
        if(review.workspaceId!==input.workspace.id||review.actorId!==input.actor.id)fault('WORKSPACE_MISMATCH','Review context does not match.');
        if(review.revision!==draft.currentRevision)fault('APPROVAL_STALE','Review refers to an older draft.');
        if(c.data.executions.some(e=>e.draftId===draft.id))fault('ALREADY_EXECUTED','Reply already executed.');
        const approval={
          id:id(),draftId:draft.id,reviewId:review.id,versionId:review.versionId,revision:review.revision,messageId:c.message.id,workspaceId:input.workspace.id,actorId:input.actor.id,approvedAt:c.now,expiresAt:new Date(Date.parse(c.now)+10*60*1000).toISOString(),status:'approved'
        };
        c.data.approvals.push(approval);
        c.event('reply.approved',{
          approvalId:approval.id,versionId:approval.versionId
        });
        return {
          approval:clone(approval),...c.persist()
        };
      }),
      executeApprovedReply:input=>run(input,c=>{
        const draft=findDraft(c.data,input);
        const approval=c.data.approvals.find(a=>a.id===input.approvalId&&a.draftId===draft.id);
        if(!approval)fault('APPROVAL_REQUIRED','An exact-version approval is required.');
        if(approval.workspaceId!==input.workspace.id||approval.actorId!==input.actor.id||approval.messageId!==c.message.id)fault('WORKSPACE_MISMATCH','Approval context does not match.');
        const previous=c.data.executions.find(e=>e.versionId===approval.versionId);
        if(previous)fault('ALREADY_EXECUTED','Approved revision already executed.',{
          execution:clone(previous)
        });
        if(approval.status!=='approved'||approval.revision!==draft.currentRevision||Date.parse(approval.expiresAt)<=Date.parse(c.now))fault('APPROVAL_STALE','Approval is expired or invalidated.');
        const version=draft.versions.find(v=>v.id===approval.versionId);
        if(!version||version.revision!==approval.revision)fault('APPROVAL_STALE','Approved version does not exist.');
        const idempotencyKey=`${input.workspace.id}:${draft.id}:${version.id}`;
        let receipt;
        try{
          receipt=executor.execute({
            version:clone(version),approval:clone(approval),idempotencyKey,now:c.now
          });
        }
        catch{
          fault('EXECUTION_FAILED','Demo execution failed; nothing was sent.',{
            idempotencyKey
          });
        }
        if(!receipt||receipt.versionId!==version.id||receipt.idempotencyKey!==idempotencyKey||receipt.status!=='Sent'||receipt.simulated!==true||!receipt.id||!Number.isFinite(Date.parse(receipt.at))||!receipt.payload||['to','subject','body'].some(k=>receipt.payload[k]!==version[k]))fault('EXECUTION_FAILED','Demo executor returned an invalid receipt.',{
          idempotencyKey
        });
        const execution={
          ...receipt,draftId:draft.id,messageId:c.message.id,workspaceId:input.workspace.id,actorId:input.actor.id,approvalId:approval.id
        };
        c.data.executions.push(execution);
        approval.status='executed';
        c.event('reply.executed',{
          executionId:execution.id,versionId:version.id,simulated:true
        });
        try{
          const persistence=c.persist();
          return {
            execution:clone(execution),...persistence
          };
        }
        catch(e){
          e.details={
            ...e.details,idempotencyKey,phase:'receipt-not-persisted'
          };
          throw e;
        }
      }),
      getReplyHistory:input=>run(input,c=>{
        const draft=c.data.drafts.find(d=>d.messageId===c.message.id&&d.workspaceId===input.workspace.id&&d.actorId===input.actor.id);
        return {
          draft:clone(draft||null),versions:clone(draft?.versions||[]),reviews:clone(c.data.reviews.filter(r=>r.draftId===draft?.id)),approvals:clone(c.data.approvals.filter(a=>a.draftId===draft?.id)),executions:clone(c.data.executions.filter(e=>e.draftId===draft?.id)),activity:clone(c.data.activity.filter(e=>e.messageId===c.message.id&&e.actorId===input.actor.id))
        };
      })
    };
    return service;
  }
  const api={
    empty,validateStore,memoryRepository,demoExecutor,createService
  };
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.OrbitReplyCore=api;
})(globalThis);

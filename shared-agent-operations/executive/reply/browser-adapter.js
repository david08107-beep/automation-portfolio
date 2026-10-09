(function(root){
  'use strict';
  // Storage belongs to the UI adapter; the service knows only read/write.
  function create({
    workspaceId,read,write,executor
  }){
    const messages=root.OrbitReplyFixtures[workspaceId];
    return root.OrbitReplyCore.createService({
      messages,executor,repository:{
        read:()=>{
          const stored=read();
          return stored===undefined?root.OrbitReplyCore.empty():stored;
        },write:next=>write(next)
      }
    });
  }
  root.OrbitReplyBrowserAdapter={
    create
  };
})(globalThis);

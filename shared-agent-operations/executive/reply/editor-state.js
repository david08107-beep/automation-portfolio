(function(root){
  // Compare editable values only; history timestamps and labels are not edits.
  const values=snapshot=>['body','brief','to','subject'].map(key=>String(snapshot[key]??'').replace(/\r\n/g,'\n')).concat(['goal','tone','feedback'].map(key=>snapshot.settings?.[key]??''));
  const matches=(before,after)=>JSON.stringify(values(before))===JSON.stringify(values(after));
  const lock=controls=>{
    const previous=controls.map(control=>({control,disabled:control.disabled}));
    controls.forEach(control=>{control.disabled=true;});
    return ()=>previous.forEach(({control,disabled})=>{control.disabled=disabled;});
  };
  const api={matches,lock};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.OrbitReplyEditorState=api;
})(globalThis);

/** Reconcile the rendered workspace while retaining native controls, undo history and scroll positions. */
function key(node) {
  if(node.nodeType!==Node.ELEMENT_NODE)return null;
  const identity=node.dataset.key || node.dataset.focus || node.id || (node.dataset.action?`${node.dataset.action}:${node.dataset.id||''}:${node.dataset.type||''}`:null);
  return identity?`${node.tagName}:${identity}:${node.dataset.workflow||''}`:null;
}
function compatible(a,b) {return a.nodeType===b.nodeType&&(a.nodeType!==Node.ELEMENT_NODE||(a.tagName===b.tagName&&key(a)===key(b)));}
function patch(current,next) {
  if(current.nodeType===Node.TEXT_NODE){if(current.nodeValue!==next.nodeValue)current.nodeValue=next.nodeValue;return;}
  if(current.nodeType!==Node.ELEMENT_NODE)return;
  for(const attribute of [...current.attributes])if(!next.hasAttribute(attribute.name))current.removeAttribute(attribute.name);
  for(const attribute of next.attributes)if(current.getAttribute(attribute.name)!==attribute.value)current.setAttribute(attribute.name,attribute.value);
  if(current.tagName==='TEXTAREA'){
    // Assigning .value or replacing the node destroys Undo. Leave an unchanged editor entirely intact.
    if(current.value!==next.value)current.value=next.value;
    return;
  }
  reconcile(current,next);
  if(['INPUT','SELECT'].includes(current.tagName)&&current.value!==next.value)current.value=next.value;
}
function reconcile(current,next) {
  const original=[...current.childNodes],byKey=new Map(original.map(n=>[key(n),n]).filter(([k])=>k));
  let cursor=current.firstChild;
  for(const incoming of [...next.childNodes]) {
    const identity=key(incoming);
    let existing=identity?byKey.get(identity):cursor;
    if(!existing||!compatible(existing,incoming))existing=null;
    if(existing){if(existing!==cursor)current.insertBefore(existing,cursor);patch(existing,incoming);cursor=existing.nextSibling;}
    else {current.insertBefore(incoming,cursor);}
  }
  while(cursor){const following=cursor.nextSibling;current.removeChild(cursor);cursor=following;}
}
export function patchWorkspace(root,html) {
  const template=document.createElement('template');template.innerHTML=html;
  reconcile(root,template.content);
}

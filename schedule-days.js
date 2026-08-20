(function(){
  const days={1:'Понедельник',2:'Вторник',3:'Среда',4:'Четверг',5:'Пятница',6:'Суббота',7:'Воскресенье'};
  function replaceDays(root=document){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      if(node.parentElement?.closest('script,style')) return;
      node.nodeValue=node.nodeValue.replace(/\b([1-7])\s*\.\s*день\b/g,(_,n)=>days[n]||`${n}. день`);
    });
    const select=document.getElementById('sd');
    if(select) [...select.options].forEach(o=>{const n=o.value; if(days[n]) o.textContent=days[n]});
  }
  const oldRender=window.render;
  if(typeof oldRender==='function'){
    window.render=function(){oldRender();requestAnimationFrame(()=>replaceDays(document));};
  }
  const observer=new MutationObserver(()=>replaceDays(document));
  observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('load',()=>replaceDays(document));
})();

// Offsets refer to source text, including text nested in emphasis and note links.
export function characterRange(element,offset){
  const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);let node,total=0;
  while(node=walker.nextNode()){
    const length=node.textContent.length;
    if(offset<total+length){const r=document.createRange();r.setStart(node,offset-total);r.setEnd(node,Math.min(length,offset-total+1));return r;}
    total+=length;
  }
  return null;
}
export function visibleCharacter(element,edge){
  const length=element.textContent.length;if(!length)return {offset:0,inset:0};
  let low=0,high=length-1;
  while(low<high){const middle=Math.floor((low+high)/2),rect=characterRange(element,middle)?.getBoundingClientRect();if(rect&&rect.bottom>edge)high=middle;else low=middle+1;}
  const rect=characterRange(element,low)?.getBoundingClientRect();return {offset:low,inset:Math.max(-100,Math.min(500,(rect?.top??edge)-edge))};
}

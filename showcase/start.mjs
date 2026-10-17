const prompt=document.querySelector('#agent-prompt');
const button=document.querySelector('#copy-prompt');
const status=document.querySelector('#copy-status');

// The complete instruction and repository link also work without JavaScript.
if(prompt&&button&&status){
  button.hidden=false;
  button.addEventListener('click',async()=>{
    button.disabled=true;
    try{
      if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(prompt.value);
      status.textContent='Copied. Paste it into your coding agent.';
      button.querySelector('span').textContent='Copy again';
    }catch{
      prompt.focus();prompt.select();prompt.setSelectionRange(0,prompt.value.length);
      status.textContent='Select and copy the instruction above.';
    }finally{button.disabled=false;}
  });
}

// An explicit touch/keyboard equivalent of each plate's hover preview.
// Reader links always open the reader on their first activation.
const peek=document.querySelector('#peek-books');
const shelf=document.querySelector('.books');
if(peek&&shelf){
  peek.hidden=false;
  const setOpen=open=>{
    shelf.classList.toggle('is-peeking',open);
    peek.setAttribute('aria-pressed',String(open));
    peek.querySelector('span').textContent=open?'Show artwork':'Peek inside';
    for(const description of shelf.querySelectorAll('.inside')){
      description.setAttribute('aria-hidden',String(!open));
      const reader=description.closest('.reader');
      reader.dataset.description ||= reader.getAttribute('aria-describedby')||'';
      reader.setAttribute('aria-describedby',reader.dataset.description+(open?' '+description.id:''));
    }
  };
  peek.addEventListener('click',()=>setOpen(peek.getAttribute('aria-pressed')!=='true'));
  shelf.addEventListener('keydown',event=>{if(event.key==='Escape')setOpen(false);});
}

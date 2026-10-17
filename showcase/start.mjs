const prompt=document.querySelector('#agent-prompt');
const button=document.querySelector('#copy-prompt');
const status=document.querySelector('#copy-status');

// The complete prompt and repository link also work without JavaScript.
button.hidden=false;
button.addEventListener('click',async()=>{
  button.disabled=true;
  try{
    if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(prompt.value);
    status.textContent='Copied. Paste it into your coding agent.';
    button.textContent='Copy again';
  }catch{
    prompt.focus();prompt.select();prompt.setSelectionRange(0,prompt.value.length);
    status.textContent='Select and copy the prompt above.';
  }finally{button.disabled=false;}
});

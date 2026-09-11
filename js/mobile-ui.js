export function createMobileUI({onModalChange}) {
  const $=selector=>document.querySelector(selector);
  const dialog=$('#mobile-sheet'),explorer=$('.explorer');
  const moved=['.explorer','#play-toggle','#reset-view','#orbits-toggle','#labels-toggle','#trails-toggle'].map(selector=>{
    const node=$(selector),slot=document.createComment(selector);
    node.before(slot);return {node,slot};
  });
  let mobile=false,opener=null;
  function selectPanel(name) {
    dialog.dataset.panel=name;
    for (const button of dialog.querySelectorAll('[data-panel]')) button.setAttribute('aria-pressed',String(button.dataset.panel===name));
    $('#sheet-scroll').scrollTop=0;
  }
  function close() { if (dialog.open) dialog.close(); }
  dialog.addEventListener('close',()=>{
    onModalChange(false);
    if (opener?.isConnected && opener.getClientRects().length) opener.focus({preventScroll:true});
  });
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape') {event.preventDefault();event.stopPropagation();close();}});
  let backdropStart=false;
  dialog.addEventListener('pointerdown',event=>{backdropStart=event.target===dialog;});
  dialog.addEventListener('click',event=>{
    if (event.target===dialog && backdropStart) close();
    const tab=event.target.closest('[data-panel]');if(tab) selectPanel(tab.dataset.panel);
  });
  $('#sheet-close').addEventListener('click',close);
  for (const button of document.querySelectorAll('[data-open-panel]')) button.addEventListener('click',()=>{
    if (!mobile) return;
    opener=button;selectPanel(button.dataset.openPanel);onModalChange(true);dialog.showModal();
    $('#sheet-close').focus({preventScroll:true});
  });
  return {
    close,
    setMobile(value) {
      if (mobile===value) return;
      mobile=value;document.documentElement.classList.toggle('mobile-layout',mobile);
      close();
      if (mobile) {
        $('#sheet-explorer').append(explorer);
        $('#mobile-play').append($('#play-toggle'));
        $('#mobile-reset').append($('#reset-view'));
        $('#sheet-settings').append($('#orbits-toggle'),$('#labels-toggle'),$('#trails-toggle'));
      } else {
        for (const {node,slot} of moved) slot.after(node);
      }
    },
    localize(t,name) {
      $('#mobile-name').textContent=name;
      for (const node of document.querySelectorAll('[data-mobile-text]')) node.textContent=t[node.dataset.mobileText];
      $('#mobile-speed').setAttribute('aria-label',t.speed);
      $('#mobile-speed').title=t.speed;
      dialog.setAttribute('aria-label',t.explorerLabel);
      $('#sheet-close').setAttribute('aria-label',t.close);
    },
  };
}

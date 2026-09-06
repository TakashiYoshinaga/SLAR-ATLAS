// A multi-touch gesture stays disqualified until every pointer is released.
export function createTapTracker() {
  const active=new Map();
  let blocked=false;
  return {
    down(event,bodyId=null) {
      if (active.size===0) blocked=false;
      if (event.button!==0) blocked=true;
      active.set(event.pointerId,{x:event.clientX,y:event.clientY,bodyId,
        limit:event.pointerType==='mouse'?5:10,moved:false});
      if (active.size>1) blocked=true;
    },
    move(event) {
      const start=active.get(event.pointerId);
      if (start && Math.hypot(event.clientX-start.x,event.clientY-start.y)>start.limit) start.moved=true;
    },
    up(event) {
      this.move(event);
      const start=active.get(event.pointerId);
      const valid=start && !blocked && !start.moved && event.button===0;
      active.delete(event.pointerId);
      return valid?{bodyId:start.bodyId}:null;
    },
    cancel(event) { blocked=true;active.delete(event.pointerId); },
    clear() { active.clear();blocked=true; },
  };
}

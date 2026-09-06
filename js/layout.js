export function isMobileLayout(width,height,touch=false) {
  return width<=900 || (touch && width<=1100 && height<=500);
}

// The scene is full screen; frame its subject inside the unobstructed area.
export function viewingArea({width,height,mobile,headerBottom,dockTop,panelLeft}) {
  const left=mobile?16:28, right=mobile?width-16:panelLeft-24;
  const top=headerBottom+12, bottom=dockTop-18;
  return {x:left,y:top,width:Math.max(80,right-left),height:Math.max(80,bottom-top)};
}

export function framing({width,height,area,fov=42}) {
  const tangent=Math.tan(fov*Math.PI/360);
  const halfAngle=Math.atan(tangent*Math.min(area.width,area.height)/height);
  return {
    offsetX:width/2-(area.x+area.width/2),
    offsetY:height/2-(area.y+area.height/2),
    fitDistance:radius=>radius/Math.sin(halfAngle)*1.12,
  };
}

// Labels keep one anchor relative to their body, regardless of nearby objects.
export function labelAnchor({x,y,radius,width,isMoon=false}) {
  return isMoon
    ? {x:x+radius+width/2+10,y}
    : {x,y:y+radius+18};
}

// Brief overlaps should not flash labels off and back on. Reappearance needs
// a longer clear interval so crowded parts of the scene stay visually quiet.
export function updateLabelVisibility(state,wantsVisible,delta) {
  if (!state.initialized) {
    state.initialized=true;
    state.visible=wantsVisible;
    state.pendingSeconds=0;
  } else if (wantsVisible===state.visible) {
    state.pendingSeconds=0;
  } else {
    state.pendingSeconds+=delta;
    const delay=wantsVisible?.45:.3;
    if (state.pendingSeconds+1e-9>=delay) {
      state.visible=wantsVisible;
      state.pendingSeconds=0;
    }
  }
  return state.visible;
}

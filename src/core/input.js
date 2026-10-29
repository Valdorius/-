export function createInput(canvas){
  const keys = new Set();

  // Desktop-only input (keyboard + mouse with pointer-lock).
  const mouse = { dx:0, dy:0, locked:false, down:false, rightDown:false };

  function requestPointerLock(){
    // Pointer Lock works only after a user gesture; some browsers return a Promise.
    try{
      const r = canvas.requestPointerLock?.();
      if (r && typeof r.catch === "function") r.catch(()=>{});
    }catch(e){}
  }

  document.addEventListener("pointerlockchange", ()=>{
    mouse.locked = (document.pointerLockElement === canvas);
  });

  // --- Keyboard ---
  window.addEventListener("keydown", (e)=> keys.add(e.code));
  window.addEventListener("keyup", (e)=> keys.delete(e.code));

  // --- Mouse buttons ---
  window.addEventListener("mousedown", (e)=> {
    if (e.button === 0) mouse.down = true;
    if (e.button === 2) mouse.rightDown = true;
  });
  window.addEventListener("mouseup", (e)=> {
    if (e.button === 0) mouse.down = false;
    if (e.button === 2) mouse.rightDown = false;
  });

  // --- Mouse look (pointer-lock) ---
  window.addEventListener("mousemove", (e)=>{
    if (!mouse.locked) return;
    mouse.dx += e.movementX;
    mouse.dy += e.movementY;
  });

  // Prevent context menu (RMB) stealing focus during gameplay
  window.addEventListener("contextmenu", (e)=> e.preventDefault(), { capture:true });

  function consumeMouse(){
    const out = { dx: mouse.dx, dy: mouse.dy, down: mouse.down, rightDown: mouse.rightDown, locked: mouse.locked };
    mouse.dx = 0; mouse.dy = 0;
    return out;
  }

  function isDown(code){
    return keys.has(code);
  }

  function clear(){
    keys.clear();
    mouse.dx = 0; mouse.dy = 0; mouse.down = false; mouse.rightDown = false;
  }

  function tick(){
    // no-op (touch controls removed)
  }

  return { isDown, consumeMouse, requestPointerLock, tick, clear, mouse, isTouch:false };
}

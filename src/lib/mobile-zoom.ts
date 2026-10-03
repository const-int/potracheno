// Safari can ignore viewport zoom limits, so also cancel its gesture events.
export function installMobileZoomLock() {
  const preventGesture = (event: Event) => {
    if (navigator.maxTouchPoints > 0 && event.cancelable) event.preventDefault();
  };
  const preventPinch = (event: TouchEvent) => {
    if (event.touches.length > 1 && event.cancelable) event.preventDefault();
  };
  document.addEventListener('gesturestart', preventGesture, { passive: false });
  document.addEventListener('gesturechange', preventGesture, { passive: false });
  document.addEventListener('touchstart', preventPinch, { passive: false });
  document.addEventListener('touchmove', preventPinch, { passive: false });
  return () => {
    document.removeEventListener('gesturestart', preventGesture);
    document.removeEventListener('gesturechange', preventGesture);
    document.removeEventListener('touchstart', preventPinch);
    document.removeEventListener('touchmove', preventPinch);
  };
}

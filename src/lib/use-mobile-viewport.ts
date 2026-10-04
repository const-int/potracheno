import { useLayoutEffect } from 'react';

const viewportClasses = ['app-viewport-regular', 'app-viewport-short', 'app-viewport-tiny'];

export function useMobileViewport(active: boolean, lockEntry: boolean) {
  useLayoutEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame = 0;
    let previous = '';
    const measure = () => {
      frame = 0;
      const height = Math.floor(viewport?.height ?? window.innerHeight);
      const top = viewport?.offsetTop ?? 0;
      if (height <= 0) return;
      const key = `${height}:${top}`;
      if (key !== previous) {
        previous = key;
        root.style.setProperty('--app-viewport-height', `${height}px`);
        root.style.setProperty('--app-viewport-unit', `${height / 100}px`);
        root.style.setProperty('--app-viewport-top', `${top}px`);
        const size = height <= 550 ? 'tiny' : height <= 620 ? 'short' : 'regular';
        for (const name of viewportClasses)
          root.classList.toggle(name, name === `app-viewport-${size}`);
      }
      if (root.classList.contains('entry-viewport-locked') && window.scrollY !== 0)
        window.scrollTo(0, 0);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const visible = () => {
      if (document.visibilityState === 'visible') schedule();
    };
    measure();
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    window.addEventListener('pageshow', schedule);
    window.addEventListener('focus', schedule);
    document.addEventListener('visibilitychange', visible);
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      window.removeEventListener('pageshow', schedule);
      window.removeEventListener('focus', schedule);
      document.removeEventListener('visibilitychange', visible);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      root.classList.remove(...viewportClasses);
      for (const name of ['--app-viewport-height', '--app-viewport-unit', '--app-viewport-top'])
        root.style.removeProperty(name);
    };
  }, [active]);

  useLayoutEffect(() => {
    if (!lockEntry) return;
    const root = document.documentElement;
    const restoration = history.scrollRestoration;
    root.classList.add('entry-viewport-locked');
    history.scrollRestoration = 'manual';
    const resetScroll = () => {
      if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
    };
    resetScroll();
    window.addEventListener('scroll', resetScroll, { passive: true });
    window.addEventListener('pageshow', resetScroll);
    return () => {
      root.classList.remove('entry-viewport-locked');
      history.scrollRestoration = restoration;
      window.removeEventListener('scroll', resetScroll);
      window.removeEventListener('pageshow', resetScroll);
      window.scrollTo(0, 0);
    };
  }, [lockEntry]);
}

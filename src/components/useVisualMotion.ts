// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 CAB Ingénierie / Christophe ABOULICAM
import {useEffect, useRef} from 'react';

const stagger = (index: number): number => Math.min(index * 90, 360);
const emphasis = [{filter: 'brightness(1)'}, {filter: 'brightness(1.22)'}, {filter: 'brightness(1)'}];
const reveal = [{clipPath: 'inset(0 100% 0 0)'}, {clipPath: 'inset(0)'}];

function playSvg(svg: Element, track: (animation: Animation) => void) {
  const edges = Array.from(svg.querySelectorAll<SVGGeometryElement>('path, line, polyline'));
  let edgeIndex = 0;

  for (const edge of edges) {
    if (edge.closest('defs, marker, clipPath, mask, pattern')) continue;
    const style = getComputedStyle(edge);
    const start = style.getPropertyValue('marker-start');
    const end = style.getPropertyValue('marker-end');
    const hasStart = start.startsWith('url(');
    const hasEnd = end.startsWith('url(');

    // Circle and cross markers indicate conditions, not flow direction.
    const marker = hasStart ? start : end;
    if (hasStart === hasEnd || /circle|cross|aggregation|composition|(?:zero|one)(?:Or|_or|Only|_only)/i.test(marker)) continue;
    if (style.stroke === 'none' || edge.getTotalLength() === 0) continue;

    const accent = edge.cloneNode(false) as SVGGeometryElement;
    for (const name of ['class', 'id', 'style', 'marker-start', 'marker-mid', 'marker-end']) {
      accent.removeAttribute(name);
    }
    accent.setAttribute('aria-hidden', 'true');
    accent.setAttribute('pathLength', '1');
    Object.assign(accent.style, {
      fill: 'none',
      stroke: style.stroke,
      strokeWidth: `${parseFloat(style.strokeWidth) + 1.2}px`,
      strokeLinecap: 'round',
      strokeDasharray: '.18 1.82',
      marker: 'none',
      opacity: '0',
      pointerEvents: 'none',
    });
    edge.after(accent);

    // A short accent runs along the existing path in the arrow's direction.
    const animation = accent.animate([
      {strokeDashoffset: '.2', opacity: 0},
      {offset: .15, opacity: .65},
      {offset: .85, opacity: .65},
      {strokeDashoffset: '-1.03', opacity: 0},
    ], {
      duration: 670,
      delay: stagger(edgeIndex++),
      direction: hasStart ? 'reverse' : 'normal',
      easing: 'ease-in-out',
    });
    animation.onfinish = animation.oncancel = () => accent.remove();
    track(animation);
  }

  const bars = svg.querySelectorAll('rect.task, rect.milestone');
  bars.forEach((bar, index) => {
    track(bar.animate(reveal, {duration: 580, delay: stagger(index), easing: 'ease-out', fill: 'backwards'}));
  });

  if (edgeIndex === 0 && bars.length === 0) {
    // Undirected relationships get a single gentle accent with no implied flow.
    svg.querySelectorAll('g.node, g.stateGroup, .actor').forEach((node) => {
      track(node.animate(emphasis, {duration: 520}));
    });
  }
}

function playScene(scene: Element, track: (animation: Animation) => void) {
  scene.querySelectorAll<HTMLElement>('[data-visual-arrow], [data-visual-step]').forEach((element, index) => {
    const direction = element.dataset.visualArrow;
    const movement = direction === 'right' ? 'translateX(5px)' :
      direction === 'down' ? 'translateY(5px)' : null;
    const isValue = element.dataset.visualStep === 'value';
    const frames = movement ? [{transform: 'none'}, {transform: movement}, {transform: 'none'}] :
      isValue ? reveal : emphasis;

    track(element.animate(frames, {
      duration: 520, delay: stagger(index), easing: 'ease-in-out', fill: isValue ? 'backwards' : 'none',
    }));
  });
}

export default function useVisualMotion(scene: string | number, kind: 'html' | 'svg' = 'html') {
  const ref = useRef<HTMLDivElement>(null);
  const played = useRef(new Set<string>());

  useEffect(() => {
    const root = ref.current;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!root || !window.IntersectionObserver || !Element.prototype.animate) return;

    const animations = new Set<Animation>();
    const sceneKeys = new Map<Element, string>();
    const track = (animation: Animation) => {
      animations.add(animation);
      animation.addEventListener('finish', () => animations.delete(animation), {once: true});
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const key = sceneKeys.get(entry.target);
        if (!entry.isIntersecting || preference.matches || key === undefined || played.current.has(key)) continue;

        played.current.add(key);
        observer.unobserve(entry.target);
        if (kind === 'svg') playSvg(entry.target, track);
        else playScene(entry.target, track);
      }
    }, {rootMargin: '0px 0px -5% 0px'});

    const sceneSelector = kind === 'svg' ? 'svg' : '[data-visual-scene]';
    const observeScenes = () => {
      observer.disconnect();
      sceneKeys.clear();
      if (preference.matches) return;

      const targetSelector = kind === 'svg' ? 'svg' : '[data-visual-panel] [data-visual-scene]';
      const targets = root.querySelectorAll(targetSelector);
      targets.forEach((target, index) => {
        const key = `${scene}:${index}`;
        if (played.current.has(key)) return;

        sceneKeys.set(target, key);
        observer.observe(target);
      });
    };

    // Mermaid renders after hydration, and an interactive panel can replace its scene.
    const renders = new MutationObserver((mutations) => {
      if (mutations.some(({addedNodes}) => Array.from(addedNodes).some(
        (node) => node instanceof Element && (node.matches(sceneSelector) || node.querySelector(sceneSelector)),
      ))) observeScenes();
    });
    renders.observe(root, {childList: true, subtree: true});
    observeScenes();

    const stopAnimations = () => {
      animations.forEach((animation) => animation.cancel());
      animations.clear();
    };
    const onPreferenceChange = () => {
      if (preference.matches) stopAnimations();
      observeScenes();
    };
    preference.addEventListener('change', onPreferenceChange);

    return () => {
      observer.disconnect();
      renders.disconnect();
      preference.removeEventListener('change', onPreferenceChange);
      stopAnimations();
    };
  }, [kind, scene]);

  return ref;
}

/**
 * Interruptible animated modal host (Web implementation).
 *
 * React Native Web's `<Modal>` wraps children inside fixed `ModalAnimation` and
 * `ModalContent` divs (`z-index: 9999`, default `pointer-events: auto`) and a
 * `ModalFocusTrap`, so keeping `<Modal visible={mounted}>` alive during an exit
 * animation swallows taps meant for the screen underneath.
 *
 * This web portal mounts directly to `document.body` and flips
 * `data-motion-modal-exiting="true"` synchronously on the render `interactive`
 * becomes `false`, applying `pointer-events: none !important` across the entire
 * exiting subtree (beating RN Web's `Pressable` `box-none > *` rule) so clicks
 * pass straight through to the underlying screen on frame 0 of exit.
 */
import React, { useEffect, useId, useState } from 'react';
import type { MotionModalProps } from './MotionModal';

export type { MotionModalProps };

const { createPortal } = require('react-dom') as {
  createPortal: (children: React.ReactNode, container: Element) => React.ReactPortal;
};

const STYLE_TAG_ID = 'nshapes-motion-modal-css';
const activeModalStack: string[] = [];

function ensureExitStyles(): void {
  if (typeof document === 'undefined' || !document.head) return;
  if (document.getElementById(STYLE_TAG_ID)) return;
  const styleEl = document.createElement('style');
  styleEl.id = STYLE_TAG_ID;
  styleEl.textContent =
    'div[data-motion-modal-exiting="true"], div[data-motion-modal-exiting="true"] * { pointer-events: none !important; }';
  document.head.appendChild(styleEl);
}

const MotionModalPortal: React.FC<MotionModalProps> = ({
  interactive,
  onRequestClose,
  transparent = true,
  testID,
  children,
}) => {
  const modalId = useId();
  const [hostEl] = useState<HTMLDivElement | null>(() => {
    if (typeof document === 'undefined' || !document.body) return null;
    ensureExitStyles();
    const el = document.createElement('div');
    document.body.appendChild(el);
    return el;
  });

  useEffect(() => {
    if (!hostEl || typeof document === 'undefined' || !document.body) return;
    if (!hostEl.parentNode) {
      document.body.appendChild(hostEl);
    }
    return () => {
      if (hostEl.parentNode) {
        hostEl.parentNode.removeChild(hostEl);
      }
    };
  }, [hostEl]);

  useEffect(() => {
    if (!interactive || typeof document === 'undefined') return;
    const prevIdx = activeModalStack.indexOf(modalId);
    if (prevIdx !== -1) activeModalStack.splice(prevIdx, 1);
    activeModalStack.push(modalId);

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (activeModalStack[activeModalStack.length - 1] !== modalId) return;
      e.stopPropagation();
      onRequestClose?.();
    };
    document.addEventListener('keyup', onKeyUp, false);
    return () => {
      document.removeEventListener('keyup', onKeyUp, false);
      const idx = activeModalStack.indexOf(modalId);
      if (idx !== -1) activeModalStack.splice(idx, 1);
    };
  }, [interactive, modalId, onRequestClose]);

  if (!hostEl) return null;

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    backgroundColor: transparent ? 'transparent' : '#FFFFFF',
    pointerEvents: interactive ? 'auto' : 'none',
    overflow: 'hidden',
  };

  return createPortal(
    React.createElement(
      'div',
      {
        'data-testid': testID,
        'data-motion-modal-exiting': interactive ? 'false' : 'true',
        role: interactive ? 'dialog' : undefined,
        'aria-modal': interactive ? true : undefined,
        'aria-hidden': interactive ? undefined : true,
        style: containerStyle,
      },
      children
    ),
    hostEl
  );
};

export const MotionModal: React.FC<MotionModalProps> = props => {
  if (!props.visible) return null;
  return <MotionModalPortal {...props} />;
};

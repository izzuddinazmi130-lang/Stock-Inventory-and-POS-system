import { useEffect, useRef } from 'react';

export function useHardwareScanner(onScan, {
  maxKeystrokeDelay = 50,
  minLength = 3,
  prefix = null,
  enabled = true,
  scanInputRef = null
} = {}) {
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return undefined;

    let buffer = '';
    let lastKeyTime = 0;

    const handleKeyDown = (event) => {
      const target = event.target;
      const activeElement = document.activeElement;
      const designatedInput = scanInputRef?.current;
      const focusedElement = activeElement || target;
      const isTextEntry = focusedElement instanceof HTMLElement && (
        focusedElement.isContentEditable ||
        /^(INPUT|TEXTAREA|SELECT)$/.test(focusedElement.tagName)
      );
      const isDesignatedInput = designatedInput && focusedElement === designatedInput;
      const isInModal = Boolean(document.querySelector('[role="dialog"], [aria-modal="true"]')) || (
        focusedElement instanceof Element && Boolean(
          focusedElement.closest('[role="dialog"], [aria-modal="true"]')
        )
      );

      if ((isTextEntry && !isDesignatedInput) || isInModal) {
        buffer = '';
        lastKeyTime = 0;
        return;
      }

      if (event.key === 'Enter') {
        const hasPrefix = !prefix || buffer.startsWith(prefix);
        const code = prefix && hasPrefix ? buffer.slice(prefix.length) : buffer;
        if (hasPrefix && code.length >= minLength) {
          event.preventDefault();
          onScanRef.current(code);
        }
        buffer = '';
        lastKeyTime = 0;
        return;
      }

      if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;

      const now = Date.now();
      if (lastKeyTime && now - lastKeyTime > maxKeystrokeDelay) buffer = '';
      buffer += event.key;
      lastKeyTime = now;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, maxKeystrokeDelay, minLength, prefix, scanInputRef]);
}

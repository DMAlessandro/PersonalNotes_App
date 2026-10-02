import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

type Props = {
  initial: string;
  placeholder?: string;
  className?: string;
  /** Called once, with the final text, on Enter or when focus leaves. */
  onDone: (text: string) => void;
  onCancel: () => void;
  /** Laptop: Tab / Shift+Tab while editing (spec §4.4). Gets the current text so it can be saved first. */
  onTab?: (text: string, shift: boolean) => void;
};

/** Edit text in place: wrapping multi-line field; Enter saves, Shift+Enter is a new line, Esc cancels. */
export function TextEditor({ initial, placeholder, className, onDone, onCancel, onTab }: Props) {
  const [text, setText] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  const finished = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current!;
    el.style.height = '0';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  useLayoutEffect(() => {
    const el = ref.current!;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const finish = (fn: () => void) => {
    if (finished.current) return;
    finished.current = true;
    fn();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      finish(() => onDone(text));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finish(onCancel);
    } else if (e.key === 'Tab' && onTab) {
      e.preventDefault();
      finish(() => onTab(text, e.shiftKey));
    }
  };

  return (
    <textarea
      ref={ref}
      className={`editor ${className ?? ''}`}
      value={text}
      rows={1}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => finish(() => onDone(text))}
    />
  );
}

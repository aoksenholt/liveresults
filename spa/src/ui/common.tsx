import type { ReactNode } from 'react';
import { useDisplay } from './context';
import { ThemeToggle } from './ThemeToggle';

/** Cell content built by the domain layer from numbers and fixed markup only, never from API text. */
export const html = (__html: string) => ({ dangerouslySetInnerHTML: { __html } });

export function Message({ children }: { children: ReactNode }) {
  return <p className="message">{children}</p>;
}

export function Loading({ error, text }: { error: string | null; text: string }) {
  const { res } = useDisplay();
  return <Message>{error ? `${res._LOADERROR} (${error})` : text}</Message>;
}

/** Pages with the theme toggle in the top bar leave it out here. */
export function Info({ themeToggle = true }: { themeToggle?: boolean }) {
  return (
    <div className="info">
      Timing data from Time4o: <a href="https://time4o.com/">time4o.com</a>
      <br />
      &copy; Liveresults: <a href="https://github.com/aoksenholt/liveresults">Source code</a>
      {themeToggle && (
        <>
          <br />
          <ThemeToggle className="link-button" text />
        </>
      )}
    </div>
  );
}

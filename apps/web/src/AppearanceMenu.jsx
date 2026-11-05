import { useEffect, useRef, useState } from 'react';
import { Palette } from 'lucide-react';
import { ACCENTS, THEMES, applyAppearance, loadAppearance, saveAppearance } from './theme.js';

// The theme and accent picker behind the palette button in the header.
export default function AppearanceMenu() {
  const [appearance, setAppearance] = useState(loadAppearance);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    applyAppearance(appearance);
    saveAppearance(appearance);
    if (appearance.theme !== 'auto') return undefined;
    // Follow the device when it switches between light and dark.
    let media;
    try {
      media = window.matchMedia('(prefers-color-scheme: dark)');
    } catch {
      return undefined;
    }
    const follow = () => applyAppearance(appearance);
    media.addEventListener?.('change', follow);
    return () => media.removeEventListener?.('change', follow);
  }, [appearance]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = event => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointer = event => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const set = patch => setAppearance(prev => ({ ...prev, ...patch }));

  return (
    <div className="appearance" ref={wrapRef}>
      <button
        type="button"
        className="icon-button"
        aria-expanded={open}
        aria-controls="appearance-panel"
        aria-label="Appearance"
        title="Appearance"
        onClick={() => setOpen(value => !value)}
      >
        <Palette aria-hidden="true" />
      </button>
      {open && (
        <div id="appearance-panel" className="appearance-panel" role="group" aria-label="Appearance">
          <fieldset>
            <legend>Theme</legend>
            <div className="theme-options">
              {THEMES.map(item => (
                <label key={item.key} className="option">
                  <input
                    type="radio"
                    name="theme"
                    value={item.key}
                    checked={appearance.theme === item.key}
                    onChange={() => set({ theme: item.key })}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Button colour</legend>
            <div className="accent-options">
              {ACCENTS.map(item => (
                <label key={item.key} className="option swatch-option">
                  <input
                    type="radio"
                    name="accent"
                    value={item.key}
                    checked={appearance.accent === item.key}
                    onChange={() => set({ accent: item.key })}
                  />
                  <span className="swatch" data-swatch={item.key} aria-hidden="true" />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="meta">Saved on this device.</p>
        </div>
      )}
    </div>
  );
}

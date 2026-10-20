/** Shared motion presets so the whole app moves the same way. */
export const ease = [0.22, 1, 0.36, 1];

export const stagger = (step = 0.05, delay = 0) => ({
    hidden: {},
    show: { transition: { staggerChildren: step, delayChildren: delay } },
});

export const rise = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};

export const fade = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.4, ease } },
};

/** Cursor-follow spotlight on cards with the `spotlight` class. */
export function trackSpotlight(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
}

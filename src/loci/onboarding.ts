/**
 * First-launch onboarding walkthrough — 3 steps guiding the user through
 * capture → organize → recall. Stored in localStorage so it only shows once.
 * Plays after the splash screen fades and the world is ready.
 */

const ONBOARDED_KEY = 'loci.onboarded';

interface OnboardStep {
  label: string;
  title: string;
  desc: string;
  /** Button ID to highlight during this step. */
  highlight?: string;
  buttonText: string;
}

const STEPS: OnboardStep[] = [
  {
    label: 'Step 1 of 3',
    title: 'Capture a thought',
    desc: 'Type anything in the box below and press <b>Add</b> — or hold the mic button to speak. Each thought becomes a floating card in your palace.',
    highlight: 'add-btn',
    buttonText: 'Next',
  },
  {
    label: 'Step 2 of 3',
    title: 'Organize with Sage',
    desc: 'Once you have a few thoughts, press <b>Organize</b>. Sage (your AI agent) reads your notes and snaps them into a living constellation — clusters, connections, and suggestions.',
    highlight: 'organize-btn',
    buttonText: 'Next',
  },
  {
    label: 'Step 3 of 3',
    title: 'Recall & remember',
    desc: 'Press <b>Recall</b> to quiz yourself. Loci uses spaced repetition — the thoughts you struggle with come back more often. Use <b>Rewind</b> to scrub through your palace\'s history.',
    highlight: 'recall-btn',
    buttonText: 'Let\'s go!',
  },
];

export function shouldOnboard(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) == null;
  } catch {
    return false; // storage blocked — skip onboarding
  }
}

export function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1');
  } catch {
    // storage blocked
  }
}

/**
 * Show the onboarding walkthrough. Returns a promise that resolves when
 * the user either finishes all steps or clicks "Skip intro".
 */
export function runOnboarding(): Promise<void> {
  return new Promise<void>((resolve) => {
    const overlay = document.getElementById('loci-onboard');
    const titleEl = document.getElementById('onboard-title');
    const descEl = document.getElementById('onboard-desc');
    const stepLabel = document.getElementById('onboard-step-label');
    const nextBtn = document.getElementById('onboard-next');
    const skipBtn = document.getElementById('onboard-skip');
    const dots = overlay?.querySelectorAll('.onboard-dot');

    if (overlay == null || titleEl == null || descEl == null || nextBtn == null) {
      markOnboarded();
      resolve();
      return;
    }

    let current = 0;
    let prevHighlight: HTMLElement | null = null;

    function renderStep(): void {
      const step = STEPS[current];
      stepLabel!.textContent = step.label;
      titleEl!.textContent = step.title;
      descEl!.innerHTML = step.desc;
      nextBtn!.textContent = step.buttonText;

      // Update dots
      dots?.forEach((dot, i) => {
        dot.classList.toggle('active', i === current);
        dot.classList.toggle('done', i < current);
      });

      // Highlight the relevant button
      if (prevHighlight != null) {
        prevHighlight.style.removeProperty('outline');
        prevHighlight.style.removeProperty('outline-offset');
        prevHighlight.style.removeProperty('z-index');
      }
      if (step.highlight != null) {
        const el = document.getElementById(step.highlight);
        if (el != null) {
          el.style.outline = '2px solid rgba(70, 200, 232, 0.7)';
          el.style.outlineOffset = '3px';
          el.style.zIndex = '41';
          prevHighlight = el;
        }
      }
    }

    function finish(): void {
      // Clean up highlight
      if (prevHighlight != null) {
        prevHighlight.style.removeProperty('outline');
        prevHighlight.style.removeProperty('outline-offset');
        prevHighlight.style.removeProperty('z-index');
      }
      overlay!.classList.remove('visible');
      markOnboarded();
      resolve();
    }

    renderStep();

    // Small delay so the card animates in
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
    });

    nextBtn.addEventListener('click', () => {
      current += 1;
      if (current >= STEPS.length) {
        finish();
      } else {
        renderStep();
      }
    });

    skipBtn?.addEventListener('click', () => {
      finish();
    });
  });
}

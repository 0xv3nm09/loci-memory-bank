/**
 * The universal safety gate — runs on EVERY capture, before the note enters
 * the palace or any model call. A reviewed high-recall trigger list, never
 * the main model: near-zero latency, auditable, fail-toward-showing-resources.
 */

export interface DistressCheck {
  flagged: boolean;
}

const TRIGGERS: RegExp[] = [
  /\bsuicid\w*\b/i,
  /\bkill(ing)? (myself|me)\b/i,
  /\bend(ing)? (it all|my life)\b/i,
  /\bwant (to die|to be dead)\b/i,
  /\bbetter off dead\b/i,
  /\bhurt(ing)? myself\b/i,
  /\bself[- ]?harm\b/i,
  /\bno reason to (live|go on)\b/i,
  /\bdo(n'?t| not) want to (be here|live|exist|wake up)\b/i,
  /\btake my (own )?life\b/i,
  /\boverdos(e|ing)\b/i,
  /\bcut(ting)? myself\b/i,
  /\bdon'?t want to be alive\b/i,
];

export function checkDistress(text: string): DistressCheck {
  const flagged = TRIGGERS.some((pattern) => pattern.test(text));
  return { flagged };
}

/**
 * The calm crisis surface. Plain, caring, no product voice — real resources,
 * region-aware by default ("local emergency services" + a global directory),
 * dismissible when the user is okay.
 */
export function showCrisisCard(): void {
  if (document.getElementById('loci-crisis') != null) {
    return;
  }
  const overlay = document.createElement('div');
  overlay.id = 'loci-crisis';
  overlay.innerHTML = `
    <div class="crisis-card">
      <div class="crisis-title">That sounds really heavy.</div>
      <div class="crisis-body">
        You don't have to carry this alone, and nothing here needs to be
        organized right now. Please reach out to a real person:
      </div>
      <ul class="crisis-list">
        <li><b>findahelpline.com</b> — free, confidential helplines in your country</li>
        <li>US &amp; Canada: call or text <b>988</b> (Suicide &amp; Crisis Lifeline)</li>
        <li>If you're in immediate danger, contact your <b>local emergency services</b></li>
        <li>Tell someone you trust. You matter.</li>
      </ul>
      <button id="crisis-ok">I'm okay — continue</button>
    </div>`;
  const style = document.createElement('style');
  style.textContent = `
    #loci-crisis {
      position: fixed; inset: 0; z-index: 100;
      background: rgba(4, 6, 14, 0.92);
      display: flex; align-items: center; justify-content: center;
      font-family: system-ui, sans-serif;
    }
    #loci-crisis .crisis-card {
      max-width: 460px; padding: 28px 32px;
      background: #0e1428; border: 1px solid rgba(140, 170, 255, 0.3);
      border-radius: 16px; color: #dfe6ff;
    }
    #loci-crisis .crisis-title { font-size: 20px; font-weight: 700; margin-bottom: 12px; }
    #loci-crisis .crisis-body { font-size: 14px; line-height: 1.5; color: #b9c4e8; }
    #loci-crisis .crisis-list { font-size: 14px; line-height: 1.7; padding-left: 18px; color: #dfe6ff; }
    #loci-crisis button {
      margin-top: 18px; padding: 10px 18px; font-size: 14px; font-weight: 600;
      color: #06131c; background: linear-gradient(180deg, #7ee7d2, #46c9ae);
      border: none; border-radius: 8px; cursor: pointer;
    }
  `;
  overlay.appendChild(style);
  document.body.appendChild(overlay);
  overlay.querySelector('#crisis-ok')?.addEventListener('click', () => {
    overlay.remove();
  });
}

import { createSystem, Pressed, VisibilityState, type Entity } from '@iwsdk/core';
import { Group, Mesh, MeshBasicMaterial, SphereGeometry, Vector3, CylinderGeometry } from 'three';
import { ExperienceAction } from './components.js';
import { getLoci } from './globals.js';
import { surface, text, spatialButton, frame } from './spatial-ui.js';
import { SEMANTIC, GLASS } from './palette.js';
import { playSnapChord, playOrbClick, ensureAudio, setAudioMuted } from './audio.js';
import { markOnboarded, shouldOnboard } from './onboarding.js';
import { GUIDE_STEPS } from './guide.js';
import { setAppStatus } from './status3d.js';
import { currentMode, MODES } from './modes.js';

const EXAMPLES = ['Biology exam', 'Morning walk', 'A floating city', 'Physics formulas', 'Call a friend', 'A rebel queen'];
const POSITIONS = [[-.34,.08], [0,.12], [.34,.06], [-.34,-.14], [0,-.10], [.34,-.15]];

/** One opening sequence and persistent, genuine world-space controls. */
export class ExperienceSystem extends createSystem({ actions: { required: [ExperienceAction, Pressed] } }) {
  private intro: Entity | null = null;
  private help: Entity | null = null;
  private elapsed = 0;
  private running = false;
  private phase = -1;
  private cards: Group[] = [];
  private links: Mesh[] = [];
  private caption: Mesh | null = null;
  private title: Mesh | null = null;
  private sage: Mesh | null = null;
  private buttons: Entity[] = [];
  private muted = false;
  private reduced = false;
  private uiObjects: import('three').Object3D[] = [];
  private uiModal = false;

  init(): void {
    this.renderer.setPixelRatio(Math.min(2, Math.max(1.5, window.devicePixelRatio)));
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const brand = text('Loci', 0.5, 0.055, GLASS.ink);
    brand.position.set(0, 2.12, -1.45);
    brand.name = 'loci-brand';
    this.world.createTransformEntity(brand, { persistent: true });
    const subtitle = text(`${MODES[currentMode()].glyph} ${MODES[currentMode()].label.toUpperCase()}`, 0.5, 0.020, SEMANTIC.statusText);
    subtitle.position.set(0, 2.05, -1.45);
    subtitle.name = 'loci-subtitle';
    this.world.createTransformEntity(subtitle, { persistent: true });
    this.action('?', 'help', new Vector3(0.67, 0.9, -0.95), 0.07);
    this.action('Enter VR', 'xr', new Vector3(0.73, 1.87, -1.26), 0.18);
    this.action('Sound', 'sound', new Vector3(-0.73, 1.87, -1.26), 0.18);
    Object.entries(MODES).forEach(([mode,meta],i)=>this.action(`${meta.glyph} ${meta.label}`,`mode-${mode}`,new Vector3((i-1)*.24,1.97,-1.28),.21));
    this.queries.actions.subscribe('qualify', entity => this.dispatch(entity.getValue(ExperienceAction, 'action') ?? ''));
    const xr = document.getElementById('xr-entry');
    const replay = document.getElementById('replay-intro');
    const sound = document.getElementById('sound-toggle');
    const size = document.getElementById('text-toggle');
    const launch = () => this.dispatch('xr');
    const replayStory = () => { this.closeHelp(); this.openIntro(); };
    const mute = () => this.dispatch('sound');
    const changeSize = () => {
      document.getElementById('text-size-status')?.remove();
      // The existing Aa control owns the same accessibility action.
      this.dispatch('text');
    };
    xr?.addEventListener('click', launch);
    replay?.addEventListener('click', replayStory);
    sound?.addEventListener('click', mute);
    size?.addEventListener('click', changeSize);
    // VR button always visible — the click handler shows a helpful message
    // if immersive-vr isn't available, and hiding it blocks emulator users
    // and WebXR-capable browsers from reaching the entry point.
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') this.closeHelp();
      if (event.key === 'Tab' && document.getElementById('loci-help')?.classList.contains('visible')) {
        const controls = document.querySelectorAll<HTMLElement>('#loci-help button');
        const first=controls[0], last=controls[controls.length-1];
        if (event.shiftKey && (document.activeElement===first || document.activeElement?.getAttribute('role')==='dialog')) { event.preventDefault();last?.focus(); }
        else if (!event.shiftKey && document.activeElement===last) { event.preventDefault();first?.focus(); }
      }
    };
    window.addEventListener('keydown', escape);
    const resize = () => {
      if (this.world.visibilityState.peek() !== VisibilityState.NonImmersive) return;
      this.world.camera.position.z = Math.max(0.9, 1.15 / Math.max(0.38, window.innerWidth / window.innerHeight));
    };
    window.addEventListener('resize', resize);
    resize();
    this.cleanupFuncs.push(() => xr?.removeEventListener('click', launch), () => replay?.removeEventListener('click', replayStory), () => sound?.removeEventListener('click', mute), () => size?.removeEventListener('click', changeSize), () => window.removeEventListener('keydown', escape), () => window.removeEventListener('resize', resize));
    if (shouldOnboard() && getLoci(this.globals).noteById.size === 0) this.openIntro();
    const container = document.getElementById('scene-container');
    if (container) container.dataset.sceneReady = 'true';
    this.world.scene.traverse(object => {
      if (/^(seed-|.*-orb$|rewind-dial$|rewind-knob$|rewind-now-orb$|rewind-title$|loci-status$|cluster-label$|loci-connection$|experience-help$|experience-sound$)/.test(object.name)) this.uiObjects.push(object);
    });
    this.cleanupFuncs.push(this.world.visibilityState.subscribe(state => {
      const immersive = state !== VisibilityState.NonImmersive;
      document.body.classList.toggle('immersive', immersive);
      this.world.scene.getObjectByName('experience-xr')?.traverse(o => o.userData.redraw?.(immersive ? 'Exit VR' : 'Enter VR'));
      if (state === VisibilityState.NonImmersive) resize();
    }));
  }

  private action(label: string, action: string, pos: Vector3, width = 0.18, parent?: Entity): Entity {
    const entity = spatialButton(this.world, label, pos, width, GLASS.buttonBody, parent);
    if (entity.object3D) entity.object3D.name = `experience-${action}`;
    entity.addComponent(ExperienceAction, { action });
    return entity;
  }

  private async dispatch(action: string): Promise<void> {
    const loci = getLoci(this.globals);
    if (action.startsWith('mode-')) { document.querySelector<HTMLButtonElement>(`[data-palace-mode="${action.slice(5)}"]`)?.click();return; }
    if (action === 'begin') { ensureAudio(); playOrbClick(); this.running = true; return; }
    if (action === 'enter' || action === 'skip') { this.finishIntro(); return; }
    if (action === 'sound') {
      this.muted = !this.muted;
      setAudioMuted(this.muted);
      const control = document.getElementById('sound-toggle');
      control?.setAttribute('aria-pressed', String(this.muted));
      if (control) control.textContent = this.muted ? 'Sound off' : 'Sound on';
      this.world.scene.getObjectByName('experience-sound')?.traverse(o => o.userData.redraw?.(this.muted ? 'Sound off' : 'Sound on'));
      setAppStatus(this.muted ? 'Sound off.' : 'Sound on.');
      return;
    }
    if (action === 'text') {
      const { getTextScale, setTextScale } = await import('./text-label.js');
      const next = getTextScale() === 1 ? 1.25 : getTextScale() === 1.25 ? 1.5 : 1;
      setTextScale(next);
      this.world.scene.traverse(o => { if (o.userData.isLociLabel) o.scale.setScalar(next); });
      const control = document.getElementById('text-toggle');
      if (control) control.textContent = `Aa ${Math.round(next * 100)}%`;
      return;
    }
    if (action === 'xr') {
      if (this.world.visibilityState.peek() === VisibilityState.NonImmersive) {
        try { await this.world.launchXR(); } catch { setAppStatus('VR could not start — the full VR view opens in the Quest browser. Desktop mode still works.'); }
      }
      else this.world.exitXR();
      return;
    }
    if (action === 'help-close') { this.closeHelp(); return; }
    if (action === 'help' && !loci.crisActive && !loci.recallActive && !loci.introActive && !loci.keyboardActive) this.openHelp();
  }

  private openIntro(): void {
    if (this.intro) return;
    const loci = getLoci(this.globals);
    if (loci.recallActive || loci.crisActive || loci.rewindActive) return;
    loci.cancelAutoOrganize();
    loci.introActive = true;
    this.elapsed = 0; this.phase = -1; this.running = false;
    const root = new Group(); root.name = 'loci-opening-story';
    root.position.set(0, 1.48, -1.18);
    this.intro = this.world.createTransformEntity(root);
    this.title = text('Welcome to Loci', 0.9, 0.047);
    this.title.position.set(0, 0.28, 0.06); root.add(this.title);
    this.caption = text('A little room for everything on your mind.', 0.9, 0.022, GLASS.inkDim);
    this.caption.position.set(0, 0.21, 0.06); root.add(this.caption);
    this.sage = new Mesh(new SphereGeometry(0.028, 16, 12), new MeshBasicMaterial({ color: SEMANTIC.sage, toneMapped: false }));
    this.sage.position.set(0, -.01, .06); root.add(this.sage);
    this.cards = EXAMPLES.map((value, i) => {
      const card = new Group(); card.add(surface(.21, .095, GLASS.body));
      card.add(frame(.21,.095, i%3===0 ? SEMANTIC.connection : i%3===1 ? SEMANTIC.expand : SEMANTIC.challenge));
      const label = text(value, .19, .024); label.position.z = .018; card.add(label);
      card.position.set(POSITIONS[i]?.[0] ?? 0, POSITIONS[i]?.[1] ?? 0, 0);
      card.visible = false; root.add(card); return card;
    });
    this.links = [0, 1, 2].map(() => {
      const link = new Mesh(new CylinderGeometry(.0015,.0015,1,6),new MeshBasicMaterial({color:SEMANTIC.connection,toneMapped:false}));
      link.visible=false;root.add(link);return link;
    });
    this.buttons = [this.action('Begin', 'begin', new Vector3(0,-.29,.07),.23,this.intro), this.action('Skip', 'skip',new Vector3(.32,-.29,.07),.12,this.intro)];
    document.body.classList.add('opening');
  }

  private finishIntro(): void {
    if (!this.intro) return;
    this.intro.dispose(); this.intro=null;
    for (const button of this.buttons) { if (button.active) button.dispose(); }
    this.buttons=[];this.cards=[];this.links=[];
    this.title=null;this.caption=null;this.sage=null;
    getLoci(this.globals).introActive=false;
    markOnboarded(); document.body.classList.remove('opening');
    setAppStatus('Welcome in. What is on your mind?');
  }

  private openHelp(): void {
    if (this.help) return;
    getLoci(this.globals).helpActive=true;
    const root = new Group(); root.name='loci-help-spatial';
    root.add(frame(.88,.90));root.add(surface(.88,.90));
    const title=text('A little space to think',.74,.034);title.position.set(0,.35,.015);root.add(title);
    GUIDE_STEPS.forEach((step,i)=>{
      const label=text(`${step.title} · ${step.body}`,.75,.016,GLASS.inkDim);
      label.position.set(0,.23-i*.09,.018);root.add(label);
    });
    root.position.set(0,1.46,-.78);
    this.help=this.world.createTransformEntity(root);
    this.action('Back to palace','help-close',new Vector3(0,-.36,.03),.28,this.help);
  }

  private closeHelp(): void {
    if (this.help) { this.help.dispose();this.help=null; }
    getLoci(this.globals).helpActive=false;
    const overlay=document.getElementById('loci-help');
    overlay?.classList.remove('visible');overlay?.setAttribute('aria-hidden','true');
    requestAnimationFrame(()=>requestAnimationFrame(()=>document.getElementById('help-btn')?.focus({preventScroll:true})));
  }

  update(delta: number): void {
    const loci=getLoci(this.globals);
    const modal=loci.introActive || loci.helpActive || loci.crisActive || loci.keyboardActive || loci.recallActive;
    document.body.classList.toggle('spatial-modal', modal);
    const immersive = this.world.visibilityState.peek() !== VisibilityState.NonImmersive;
    const result=this.world.scene.getObjectByName('recall-result');
    if (result) result.visible=!modal;
    const status=this.world.scene.getObjectByName('loci-status');
    if (status) status.visible=immersive && !modal;
    const soundControl=this.world.scene.getObjectByName('experience-sound');
    if (soundControl) soundControl.visible=immersive && !modal;
    for (const mode of Object.keys(MODES)) {
      const control=this.world.scene.getObjectByName(`experience-mode-${mode}`);
      if (control) control.visible=immersive && !modal;
    }
    if (!immersive && window.innerWidth < 680) {
      this.world.camera.position.z = modal ? 1.5 : Math.max(.9, 1.15 / Math.max(.38, window.innerWidth / window.innerHeight));
    }
    for (const [id,entity] of loci.noteById) {
      if (entity.object3D && !loci.rewindActive) entity.object3D.visible=!modal;
    }
    if (modal !== this.uiModal) {
      this.uiModal = modal;
      this.uiObjects.length = 0;
      this.world.scene.traverse(object => {
        if (/^(seed-|.*-orb$|rewind-dial$|rewind-knob$|rewind-now-orb$|rewind-title$|loci-status$|cluster-label$|loci-connection$|experience-help$|experience-sound$)/.test(object.name)) this.uiObjects.push(object);
      });
    }
    for (const object of this.uiObjects) {
      // Flat browser views already have the bottom bar; keep the spatial dock for VR.
      const browserWorld = !/^(.*-orb$|rewind-|experience-|loci-status$)/.test(object.name);
      object.visible = !modal && (immersive || browserWorld);
    }
    const xrControl = this.world.scene.getObjectByName('experience-xr');
    if (xrControl) xrControl.visible = immersive;
    for (const object of this.world.scene.children) {
      if (object.name === 'loci-brand' || object.name === 'loci-subtitle') object.visible=!modal && immersive; // browser header already shows the name and mode
    }
    if (!this.intro || !this.running) return;
    this.elapsed += delta;
    if (this.elapsed > 1 && this.buttons[0]?.getValue(ExperienceAction, 'action') === 'begin') {
      this.buttons[0].setValue(ExperienceAction, 'action', 'skip');
      this.buttons[0].object3D?.traverse(object => object.userData.redraw?.('Enter your palace'));
    }
    const phase=this.elapsed<3?0:this.elapsed<6?1:this.elapsed<9?2:3;
    if (phase!==this.phase) {
      this.phase=phase;
      const headlines=['Let it all out.','Find the threads.','Make it memorable.','Your palace is waiting.'];
      const captions=['Big ideas. Tiny reminders. All welcome here.','Scattered thoughts, a little more connected.','Come back to the thoughts worth keeping.','Capture · Organize · Recall'];
      this.title?.userData.redraw?.(headlines[phase]);this.caption?.userData.redraw?.(captions[phase]);
      if (phase===1) playSnapChord();
      if (phase===3) {
        const button=this.buttons[0];
        if (button) { button.setValue(ExperienceAction,'action','enter');button.object3D?.traverse(o=>o.userData.redraw?.('Enter your palace')); }
      }
    }
    if (this.sage) { this.sage.visible=phase===3;this.sage.scale.setScalar(this.reduced?1:1+Math.sin(this.elapsed*2)*.08); }
    this.cards.forEach((card,i)=>{
      card.visible=phase<3;
      const start=POSITIONS[i] ?? [0,0];
      const target=[(i%3-1)*.30, i<3?.065:-.105];
      const t=phase===0?0:this.reduced?1:Math.min(1,(this.elapsed-3)/.8);
      const blend=1-Math.pow(1-t,3);
      card.position.set((start[0]??0)*(1-blend)+(target[0]??0)*blend,(start[1]??0)*(1-blend)+(target[1]??0)*blend,0);
      card.rotation.z=phase===0&&!this.reduced?Math.sin(i+this.elapsed)*.04:0;
      const label = card.children.find(child => child.userData.isLociLabel);
      if (label) {
        const material = (label as Mesh).material as MeshBasicMaterial;
        material.opacity = phase===2 && this.elapsed<7.5 && i===0 ? .12 : 1;
      }
    });
    this.links.forEach((link,i)=>{
      link.visible=phase===1||phase===2;
      link.position.set((i-1)*.30,-.02,-.02);link.scale.set(1,.17,1);
    });
  }
}

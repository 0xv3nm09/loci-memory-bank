/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createSystem, UIKitMLAsset, VisibilityState } from '@iwsdk/core';
import { getLoci } from './loci/globals.js';

export class PanelSystem extends createSystem({}) {
  init(): void {
    // The welcome panel's job is onboarding — once the first organize runs,
    // OrganizeSystem hides it so the snap happens in a clear space. The same
    // guide lives on in the desktop help overlay.
    getLoci(this.globals).hideWelcome = () => {
      // UIKitMLAsset IS an Object3D — hide it directly.
      const panel = this.world.getSceneObject<UIKitMLAsset>('welcome-panel');
      if (panel != null) {
        panel.visible = false;
      }
      const screenSpace = document.getElementById('welcome-panel');
      if (screenSpace != null) {
        screenSpace.style.transition = 'opacity 0.35s ease-out';
        screenSpace.style.opacity = '0';
        setTimeout(() => { screenSpace.style.display = 'none'; }, 360);
      }
    };
    const panel = this.world.getSceneObject<UIKitMLAsset>('welcome-panel');
    const xrButton = panel?.getElementById('xr-button');
    const exitButton = panel?.getElementById('exit-button');
    if (xrButton == null || exitButton == null) {
      return;
    }
    if (!this.world.xrEnabled) {
      xrButton.setProperties({ display: 'none' });
      exitButton.setProperties({ display: 'none' });
      return;
    }

    const launchXR = () => this.world.launchXR();
    const exitXR = () => this.world.exitXR();
    xrButton.addEventListener('click', launchXR);
    exitButton.addEventListener('click', exitXR);
    this.cleanupFuncs.push(
      () => xrButton.removeEventListener('click', launchXR),
      () => exitButton.removeEventListener('click', exitXR),
      this.world.visibilityState.subscribe((visibilityState) => {
        const is2D = visibilityState === VisibilityState.NonImmersive;
        xrButton.setProperties({ display: is2D ? 'flex' : 'none' });
        exitButton.setProperties({ display: is2D ? 'none' : 'flex' });
      }),
    );
  }
}

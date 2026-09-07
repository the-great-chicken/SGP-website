"use client";

import { useEffect, useRef, useState } from "react";
import type { KitPreview } from "@/lib/kit-preview";

export function KitPlayerModel({ preview, name }: { preview: KitPreview; name: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const surface = canvas.current!;
    let disposed = false;
    let cleanup = () => {};
    async function mount() {
      const [THREE, { createKitPlayer, disposePlayer, rightHandAttachment }] = await Promise.all([
        import("three"), import("@/lib/kit-player-scene"),
      ]);
      if (disposed) return;
      const renderer = new THREE.WebGLRenderer({ canvas: surface, alpha: true, antialias: false });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      const scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight(0xffffff, 2));
      const light = new THREE.DirectionalLight(0xffffff, 2);
      light.position.set(-10, 20, 30);
      scene.add(light);
      const camera = new THREE.OrthographicCamera(-22, 22, 22, -22, 0.1, 200);
      camera.position.z = 80;
      const rig = new THREE.Group();
      rig.position.y = 8;
      rig.rotation.y = -Math.PI / 10;
      scene.add(rig);
      let frame = 0;
      const draw = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => renderer.render(scene, camera));
      };
      const resize = new ResizeObserver(() => {
        const { width, height } = surface.getBoundingClientRect();
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.left = -22 * width / height;
        camera.right = 22 * width / height;
        camera.updateProjectionMatrix();
        draw();
      });
      resize.observe(surface);
      const controller = new AbortController();
      cleanup = () => {
        controller.abort();
        resize.disconnect();
        cancelAnimationFrame(frame);
        disposePlayer(scene);
        renderer.dispose();
      };
      const player = await createKitPlayer(preview);
      if (disposed) { disposePlayer(player.root); return; }
      rig.add(player.root);
      draw();
      if (preview.weapon) {
        const response = await fetch(preview.weapon.src, { signal: controller.signal });
        if (!response.ok) throw new Error(`Held-item model: ${response.status}`);
        const item = await new THREE.ObjectLoader().parseAsync(await response.json());
        if (disposed) { disposePlayer(item); return; }
        const hand = new THREE.Group();
        hand.applyMatrix4(rightHandAttachment());
        hand.add(item);
        player.rightArm.add(hand);
      }
      const motion = matchMedia("(prefers-reduced-motion: reduce)");
      const move = (event: PointerEvent) => {
        if (event.pointerType !== "mouse" || motion.matches) return;
        const rect = surface.getBoundingClientRect();
        const yaw = Math.atan((event.clientX - rect.left - rect.width / 2) / 220);
        const pitch = Math.atan((event.clientY - rect.top - rect.height / 2 + 60) / 220);
        rig.rotation.y = yaw * 0.35;
        player.head.rotation.set(pitch * 0.6, -yaw * 0.5, 0);
        draw();
      };
      const reset = () => {
        rig.rotation.y = -Math.PI / 10;
        player.head.rotation.set(0, 0, 0);
        draw();
      };
      window.addEventListener("pointermove", move, { signal: controller.signal });
      document.documentElement.addEventListener("pointerleave", reset, { signal: controller.signal });
      draw();
    }
    mount().catch(() => { cleanup(); if (!disposed) setError(true); });
    return () => { disposed = true; cleanup(); };
  }, [preview]);

  return (
    <div className="kit-player-stage">
      <div className="kit-player-shadow" />
      <canvas className="kit-player-canvas" ref={canvas} role="img" aria-label={`${name} portant son armure${preview.weapon ? ` et tenant ${preview.weapon.name}` : ""}`} />
      {error ? <p className="kit-player-error">L’aperçu 3D n’a pas pu être chargé.</p> : null}
    </div>
  );
}

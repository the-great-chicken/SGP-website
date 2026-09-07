"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import type { KitPreview } from "@/lib/kit-preview";

const scale = 6;
const skin = "/generated/kit-models/steve.png";

export function KitPlayerModel({ preview, name }: { preview: KitPreview; name: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const rig = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const region = stage.current!;
    const body = rig.current!;
    const face = head.current!;
    let frame = 0;
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = region.getBoundingClientRect();
        const yaw = Math.atan((event.clientX - rect.left - rect.width / 2) / 220) * 180 / Math.PI;
        const pitch = -Math.atan((event.clientY - rect.top - rect.height / 2 + 60) / 220) * 180 / Math.PI;
        body.style.transform = `rotateY(${yaw * 0.35}deg)`;
        face.style.transform = `rotateY(${yaw * 0.5}deg) rotateX(${pitch * 0.6}deg)`;
      });
    };
    const reset = () => {
      cancelAnimationFrame(frame);
      body.style.transform = "rotateY(-18deg)";
      face.style.transform = "rotateY(10deg)";
    };
    window.addEventListener("pointermove", move);
    document.documentElement.addEventListener("pointerleave", reset);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", reset);
    };
  }, []);

  const { armor, weapon } = preview;
  const headSkin = armor.head?.head ? armor.head.src : skin;
  return (
    <div className="kit-player-stage" ref={stage} role="img" aria-label={`${name} portant son armure${weapon ? ` et tenant ${weapon.name}` : ""}`}>
      <div className="kit-player-shadow" />
      <div className="kit-player-rig" ref={rig} aria-hidden="true">
        <div className="model-part model-head" ref={head}>
          <Cube size={[8, 8, 8]} uv={[0, 0]} src={headSkin} y={-4} textureHeight={64} />
          <Cube size={[8, 8, 8]} uv={[32, 0]} src={headSkin} y={-4} grow={0.25} textureHeight={64} />
          {armor.head && !armor.head.head ? <Cube size={[8, 8, 8]} uv={[0, 0]} src={armor.head.src} y={-4} grow={0.5} /> : null}
        </div>
        <Cube size={[8, 12, 4]} uv={[16, 16]} src={skin} y={14} />
        {armor.legs ? <Cube size={[8, 12, 4]} uv={[16, 16]} src={armor.legs.src} y={14} grow={0.25} /> : null}
        {armor.chest && !armor.chest.wings ? <Cube size={[8, 12, 4]} uv={[16, 16]} src={armor.chest.src} y={14} grow={0.5} /> : null}
        {[-1, 1].map((side) => (
          <div className={`model-part model-arm ${side === -1 ? "model-main-arm" : ""}`} key={`arm${side}`} style={{ left: side * 6 * scale }}>
            <Cube size={[4, 12, 4]} uv={side === -1 ? [40, 16] : [32, 48]} src={skin} y={5} />
            {armor.chest && !armor.chest.wings ? <Cube size={[4, 12, 4]} uv={[40, 16]} src={armor.chest.src} y={5} grow={0.5} /> : null}
            {side === -1 && weapon?.src ? <span className="model-weapon" style={{ backgroundImage: `url("${weapon.src}")` }} /> : null}
          </div>
        ))}
        {[-1, 1].map((side) => (
          <div className="model-part model-leg" key={`leg${side}`} style={{ left: side * 2 * scale }}>
            <Cube size={[4, 12, 4]} uv={side === -1 ? [0, 16] : [16, 48]} src={skin} y={6} />
            {armor.legs ? <Cube size={[4, 12, 4]} uv={[0, 16]} src={armor.legs.src} y={6} grow={0.25} /> : null}
            {armor.feet ? <Cube size={[4, 12, 4]} uv={[0, 16]} src={armor.feet.src} y={6} grow={0.5} /> : null}
          </div>
        ))}
        {armor.chest?.wings ? [-1, 1].map((side) => <div className="model-part model-wing" key={`wing${side}`} style={{ transform: `translateZ(-20px) rotateY(${side * 12}deg) rotateZ(${side * -15}deg)`, left: side * 4 * scale }}><Cube size={[10, 20, 2]} uv={[22, 0]} src={armor.chest.src} y={9} /></div>) : null}
      </div>
    </div>
  );
}

function Cube({ size: [w, h, d], uv: [u, v], src, y, grow = 0, textureHeight = src === skin ? 64 : 32 }: {
  size: [number, number, number]; uv: [number, number]; src: string; y: number; grow?: number; textureHeight?: number;
}) {
  const width = (w + grow * 2) * scale;
  const height = (h + grow * 2) * scale;
  const depth = (d + grow * 2) * scale;
  const faces = [
    { name: "front", w: width, h: height, tw: w, th: h, u: u + d, v: v + d, transform: `translateZ(${depth / 2}px)` },
    { name: "back", w: width, h: height, tw: w, th: h, u: u + d * 2 + w, v: v + d, transform: `rotateY(180deg) translateZ(${depth / 2}px)` },
    { name: "right", w: depth, h: height, tw: d, th: h, u: u + d + w, v: v + d, transform: `rotateY(90deg) translateZ(${width / 2}px)` },
    { name: "left", w: depth, h: height, tw: d, th: h, u, v: v + d, transform: `rotateY(-90deg) translateZ(${width / 2}px)` },
    { name: "top", w: width, h: depth, tw: w, th: d, u: u + d, v, transform: `rotateX(90deg) translateZ(${height / 2}px)` },
    { name: "bottom", w: width, h: depth, tw: w, th: d, u: u + d + w, v, transform: `rotateX(-90deg) translateZ(${height / 2}px)` },
  ];
  return <div className="model-cube" style={{ top: y * scale }}>{faces.map((face) => (
    <span className={`model-face model-face-${face.name}`} key={face.name} style={{
      width: face.w, height: face.h,
      transform: `translate(-50%, -50%) ${face.transform}`,
      backgroundImage: `url("${src}")`,
      backgroundSize: `${64 * face.w / face.tw}px ${textureHeight * face.h / face.th}px`,
      backgroundPosition: `${-face.u * face.w / face.tw}px ${-face.v * face.h / face.th}px`,
    } as CSSProperties} />
  ))}</div>;
}

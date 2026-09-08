import { BoxGeometry, DoubleSide, Group, Matrix4, Mesh, MeshLambertMaterial, NearestFilter, ShaderMaterial, SRGBColorSpace, Texture, TextureLoader, type Object3D } from "three";
import type { KitPreview } from "./kit-preview";

// Minecraft 26.1 ItemInHandLayer: after the arm bone, rotate X -90°, Y 180°,
// then translate (1/16, 2/16, -10/16) blocks. Our model units are pixels (1/16 block).
export function rightHandAttachment() {
  return new Matrix4().makeRotationX(-Math.PI / 2)
    .multiply(new Matrix4().makeRotationY(Math.PI))
    .multiply(new Matrix4().makeTranslation(1, 2, -10));
}

export async function createKitPlayer(preview: KitPreview) {
  const textures = new Map<string, Promise<Texture>>();
  const materials = new Map<string, MeshLambertMaterial>();
  const loader = new TextureLoader();
  const texture = (src: string) => {
    if (!textures.has(src)) textures.set(src, loader.loadAsync(src).then((value) => {
      value.colorSpace = SRGBColorSpace;
      value.magFilter = NearestFilter;
      value.minFilter = NearestFilter;
      value.generateMipmaps = false;
      return value;
    }));
    return textures.get(src)!;
  };
  const root = new Group();
  // Minecraft's biped coordinates: Y down, front toward -Z.
  root.scale.set(1, -1, -1);
  const head = new Group();
  const rightArm = new Group();
  const leftArm = new Group();
  rightArm.position.set(-5, 2, 0);
  leftArm.position.set(5, 2, 0);
  // HumanoidModel's stationary ITEM pose.
  if (preview.weapon) rightArm.rotation.x = -Math.PI / 10;
  root.add(head, rightArm, leftArm);

  async function cube(parent: Object3D, src: string, size: [number, number, number], uv: [number, number], center: [number, number, number], grow = 0, doubleSided = false) {
    const map = await texture(src);
    const materialKey = `${src}\0${doubleSided ? "double" : "front"}`;
    if (!materials.has(materialKey)) materials.set(materialKey, new MeshLambertMaterial({ map, alphaTest: 0.5, ...(doubleSided ? { side: DoubleSide } : {}) }));
    const [w, h, d] = size;
    const [u, v] = uv;
    const geometry = new BoxGeometry(w + grow * 2, h + grow * 2, d + grow * 2);
    const position = geometry.getAttribute("position");
    const coords = geometry.getAttribute("uv");
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i) / (w + grow * 2) + 0.5;
      const y = position.getY(i) / (h + grow * 2) + 0.5;
      const z = position.getZ(i) / (d + grow * 2) + 0.5;
      const face = Math.floor(i / 4);
      let [tu, tv] = face === 0 ? [u + d + w + z * d, v + d + y * h]
        : face === 1 ? [u + (1 - z) * d, v + d + y * h]
          : face === 2 ? [u + d + w + x * w, v + z * d]
            : face === 3 ? [u + d + x * w, v + (1 - z) * d]
              : face === 4 ? [u + d * 2 + w + (1 - x) * w, v + d + y * h]
                : [u + d + x * w, v + d + y * h];
      coords.setXY(i, tu / map.image.width, 1 - tv / map.image.height);
    }
    const mesh = new Mesh(geometry, materials.get(materialKey));
    mesh.position.set(...center);
    parent.add(mesh);
  }

  const skin = "/generated/kit-models/steve.png";
  const { armor } = preview;
  const headSkin = armor.head?.head ? armor.head.src : skin;
  const jobs = [
    cube(head, headSkin, [8, 8, 8], [0, 0], [0, -4, 0]),
    cube(head, headSkin, [8, 8, 8], [32, 0], [0, -4, 0], 0.25),
    cube(root, skin, [8, 12, 4], [16, 16], [0, 6, 0]),
    cube(rightArm, skin, [4, 12, 4], [40, 16], [-1, 4, 0]),
    cube(leftArm, skin, [4, 12, 4], [32, 48], [1, 4, 0]),
  ];
  if (armor.head && !armor.head.head) jobs.push(cube(head, armor.head.src, [8, 8, 8], [0, 0], [0, -4, 0], 0.5));
  if (armor.legs) jobs.push(cube(root, armor.legs.src, [8, 12, 4], [16, 16], [0, 6, 0], 0.25));
  if (armor.chest && !armor.chest.wings) jobs.push(
    cube(root, armor.chest.src, [8, 12, 4], [16, 16], [0, 6, 0], 0.5),
    cube(rightArm, armor.chest.src, [4, 12, 4], [40, 16], [-1, 4, 0], 0.5),
    cube(leftArm, armor.chest.src, [4, 12, 4], [40, 16], [1, 4, 0], 0.5),
  );
  for (const side of [-1, 1] as const) {
    const leg = new Group();
    leg.position.set(side * 1.9, 12, 0);
    root.add(leg);
    jobs.push(cube(leg, skin, [4, 12, 4], side === -1 ? [0, 16] : [16, 48], [0, 6, 0]));
    if (armor.legs) jobs.push(cube(leg, armor.legs.src, [4, 12, 4], [0, 16], [0, 6, 0], 0.25));
    if (armor.feet) jobs.push(cube(leg, armor.feet.src, [4, 12, 4], [0, 16], [0, 6, 0], 0.5));
    if (armor.chest?.wings) {
      const pose = elytraWingPose(side);
      const wing = new Group();
      wing.position.set(...pose.pivot);
      wing.rotation.set(...pose.rotation);
      wing.scale.x = pose.scaleX;
      root.add(wing);
      // Minecraft renders elytra through armorCutoutNoCull. The atlas only
      // paints one broad face of the wing cuboid, so culling would make a wing
      // disappear as the preview turns. DoubleSide reproduces the no-cull pass.
      jobs.push(cube(wing, armor.chest.src, [10, 20, 2], [22, 0], pose.center, 1, true));
    }
  }
  const results = await Promise.allSettled(jobs);
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") { disposePlayer(root); throw failed.reason; }
  return { root, head, rightArm };
}


export function elytraWingPose(side: -1 | 1) {
  return {
    // Vanilla ElytraModel defines one 10×20×2 wing cuboid from x -10..0,
    // then mirrors the complete model part for the right wing. Mirroring the
    // Three.js group (instead of reflecting the atlas coordinates) preserves
    // the same UV island on both wings and mirrors the geometry exactly.
    // ElytraLayer offsets the model 1/8 block backward.
    pivot: [side * 5, 0, 2] as [number, number, number],
    rotation: [Math.PI / 12, 0, -side * Math.PI / 12] as [number, number, number],
    center: [-5, 10, 1] as [number, number, number],
    scaleX: side === -1 ? -1 : 1,
  };
}

export function disposePlayer(root: Object3D) {
  const textures = new Set<Texture>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
      if (material instanceof ShaderMaterial) {
        for (const { value } of Object.values(material.uniforms)) if (value instanceof Texture) textures.add(value);
      }
      material.dispose();
    }
  });
  for (const texture of textures) texture.dispose();
}

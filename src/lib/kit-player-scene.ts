import { BoxGeometry, BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Matrix4, Mesh, MeshLambertMaterial, NearestFilter, ShaderMaterial, SRGBColorSpace, Texture, TextureLoader, type Object3D } from "three";
import type { KitPreview } from "./kit-preview";

// Minecraft 26.1 ItemInHandLayer: after the arm bone, rotate X -90°, Y 180°,
// then translate (1/16, 2/16, -10/16) blocks. Our model units are pixels (1/16 block).
export function rightHandAttachment() {
  return new Matrix4().makeRotationX(-Math.PI / 2)
    .multiply(new Matrix4().makeRotationY(Math.PI))
    .multiply(new Matrix4().makeTranslation(1, 2, -10));
}


function minecraftCuboidGeometry(
  origin: [number, number, number],
  size: [number, number, number],
  uv: [number, number],
  textureSize: [number, number],
  grow = 0,
  mirror = false,
) {
  const [x, y, z] = origin;
  const [dx, dy, dz] = size;
  const [u, v] = uv;
  const [textureWidth, textureHeight] = textureSize;
  let x0 = x - grow;
  const y0 = y - grow;
  const z0 = z - grow;
  let x1 = x + dx + grow;
  const y1 = y + dy + grow;
  const z1 = z + dz + grow;
  if (mirror) [x0, x1] = [x1, x0];

  const vertices: [number, number, number][] = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
  const quads: [number[], [number, number, number, number]][] = [
    [[5, 1, 2, 6], [u + dz + dx, v + dz, u + dz + dx + dz, v + dz + dy]],
    [[0, 4, 7, 3], [u, v + dz, u + dz, v + dz + dy]],
    [[4, 0, 1, 5], [u + dz, v, u + dz + dx, v + dz]],
    [[2, 6, 7, 3], [u + dz + dx, v + dz, u + dz + dx + dx, v]],
    [[1, 0, 3, 2], [u + dz, v + dz, u + dz + dx, v + dz + dy]],
    [[4, 5, 6, 7], [u + dz + dx + dz, v + dz, u + dz + dx + dz + dx, v + dz + dy]],
  ];

  const positions: number[] = [];
  const uvs: number[] = [];
  const triangles = [0, 1, 2, 0, 2, 3];
  for (const [indices, [u1, v1, u2, v2]] of quads) {
    let corners = [
      { vertex: indices[0], uv: [u2, v1] as [number, number] },
      { vertex: indices[1], uv: [u1, v1] as [number, number] },
      { vertex: indices[2], uv: [u1, v2] as [number, number] },
      { vertex: indices[3], uv: [u2, v2] as [number, number] },
    ];
    // CubeListBuilder.mirror() swaps the X bounds, then ModelPart flips each
    // completed face. Keeping the UV attached to its vertex reproduces that
    // behavior without a negative-scale transform.
    if (mirror) corners = [...corners].reverse();
    for (const cornerIndex of triangles) {
      const corner = corners[cornerIndex];
      positions.push(...vertices[corner.vertex]);
      uvs.push(corner.uv[0] / textureWidth, 1 - corner.uv[1] / textureHeight);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
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

  async function cube(
    parent: Object3D,
    src: string,
    size: [number, number, number],
    uv: [number, number],
    center: [number, number, number],
    grow = 0,
    doubleSided = false,
    depthBias = 0,
  ) {
    const map = await texture(src);
    const materialKey = `${src}\0${doubleSided ? "double" : "front"}\0depth:${depthBias}`;
    if (!materials.has(materialKey)) {
      materials.set(materialKey, new MeshLambertMaterial({
        map,
        alphaTest: 0.5,
        ...(doubleSided ? { side: DoubleSide } : {}),
        ...(depthBias ? {
          // Armor parts overlap at Minecraft's limb seams. A tiny, per-part
          // depth bias makes those coplanar pixels deterministic without
          // changing the visible geometry or pulling armor off the player.
          polygonOffset: true,
          polygonOffsetFactor: 0,
          polygonOffsetUnits: -depthBias,
        } : {}),
      }));
    }
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
      const [tu, tv] = face === 0 ? [u + d + w + z * d, v + d + y * h]
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
  if (armor.head && !armor.head.head) jobs.push(cube(head, armor.head.src, [8, 8, 8], [0, 0], [0, -4, 0], 0.5, false, 1));
  if (armor.legs) jobs.push(cube(root, armor.legs.src, [8, 12, 4], [16, 16], [0, 6, 0], 0.25, false, 2));
  if (armor.chest && !armor.chest.wings) jobs.push(
    cube(root, armor.chest.src, [8, 12, 4], [16, 16], [0, 6, 0], 0.5, false, 3),
    cube(rightArm, armor.chest.src, [4, 12, 4], [40, 16], [-1, 4, 0], 0.5, false, 4),
    // Generated armor textures use Minecraft's modern 64x64 humanoid layout:
    // the left arm is a horizontally mirrored copy of the vanilla 64x32
    // right-arm faces, matching skinview-utils v0.7.1's convertSkinTo1_8 semantics.
    cube(leftArm, armor.chest.src, [4, 12, 4], [32, 48], [1, 4, 0], 0.5, false, 5),
  );
  for (const side of [-1, 1] as const) {
    const leg = new Group();
    // Exact Minecraft leg centers. The old 1.9 spacing made the two leg
    // cuboids overlap by 0.2 units before armor deformation was even applied.
    leg.position.set(side * 2, 12, 0);
    root.add(leg);
    jobs.push(cube(leg, skin, [4, 12, 4], side === -1 ? [0, 16] : [16, 48], [0, 6, 0]));
    const armorLegUv: [number, number] = side === -1 ? [0, 16] : [16, 48];
    if (armor.legs) jobs.push(cube(leg, armor.legs.src, [4, 12, 4], armorLegUv, [0, 6, 0], 0.25, false, side === -1 ? 6 : 7));
    if (armor.feet) jobs.push(cube(leg, armor.feet.src, [4, 12, 4], armorLegUv, [0, 6, 0], 0.5, false, side === -1 ? 8 : 9));
    if (armor.chest?.wings) {
      const pose = elytraWingPose(side);
      const wing = new Group();
      wing.position.set(...pose.pivot);
      wing.rotation.set(...pose.rotation);
      root.add(wing);
      jobs.push((async () => {
        const map = await texture(armor.chest.src);
        const materialKey = `${armor.chest.src}\0elytra`;
        if (!materials.has(materialKey)) {
          materials.set(materialKey, new MeshLambertMaterial({ map, alphaTest: 0.5, side: DoubleSide }));
        }
        const geometry = minecraftCuboidGeometry(
          pose.origin,
          [10, 20, 2],
          [22, 0],
          [map.image.width, map.image.height],
          1,
          pose.mirror,
        );
        wing.add(new Mesh(geometry, materials.get(materialKey)!));
      })());
    }
  }
  const results = await Promise.allSettled(jobs);
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") { disposePlayer(root); throw failed.reason; }
  return { root, head, rightArm };
}


export function elytraWingPose(side: -1 | 1) {
  return {
    // Vanilla standing pose: each wing has its own shoulder pivot. The right
    // wing is a separately mirrored cuboid, not a negatively scaled left wing.
    // ElytraLayer's 1/8-block backward offset is folded into the Z pivot here.
    pivot: [side * 5, 0, 2] as [number, number, number],
    rotation: [Math.PI / 12, 0, -side * Math.PI / 12] as [number, number, number],
    origin: (side === 1 ? [-10, 0, 0] : [0, 0, 0]) as [number, number, number],
    mirror: side === -1,
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

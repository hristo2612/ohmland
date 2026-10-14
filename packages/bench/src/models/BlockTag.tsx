// The short name printed on a desk block's front face ("S1", "K1"), shared by every block model.

import { useMemo } from "react";
import * as THREE from "three";
import { BLOCK } from "../dims";
import { FONT, canvasTexture } from "../three/canvas";

function tagTexture(tag: string): THREE.Texture {
  return canvasTexture(`blk-tag:${tag}`, 256, 96, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(250,244,230,0.95)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${tag.length > 4 ? 58 : 76}px ${FONT}`;
    ctx.fillText(tag, w / 2, h / 2 + 3);
  });
}

/**
 * The block's name on its front face: centred and large on a plain block, or in the top band above the terminal names
 * (`above`).
 */
export function BlockTag({ tag, above = false }: { tag: string; above?: boolean }) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ map: tagTexture(tag), transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }), [tag]);
  const h = above ? 5.2 : 8;
  return (
    <mesh material={material} position={[0, above ? BLOCK.h - 3.4 : BLOCK.h * 0.5, BLOCK.d / 2 + 0.06]}>
      <planeGeometry args={[(h * 256) / 96, h]} />
    </mesh>
  );
}

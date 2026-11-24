import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

/* Guará 3D de brinquedo, montado só com formas (esferas, elipsoides, caixas arredondadas) e luz de estúdio.
   Peças que afinam (pescoço, bico, pernas) são correntes de esferas ao longo de uma curva.
   O personagem olha para +x. Uma pose é um objeto em POSES; acrescentar pose = acrescentar uma entrada. */

const COR = {
  corpo: "#EB4A3A", corpoLuz: "#FF7A66", barriga: "#FF9C88", rosto: "#F68C7B", perna: "#E5705F",
  bico: "#2E2832", ponta: "#23242D", branco: "#FFFFFF", tinta: "#16202E",
  papel: "#FBFBF8", azul: "#1F6A96", azulEscuro: "#13324A", creme: "#EFE4CE", cremeEscuro: "#D9C9A6", almofada: "#E9786B",
};

type V3 = [number, number, number];

/** Corrente de esferas que afina ao longo de uma curva: dá pescoço, bico e pernas suaves. */
function Cadeia({ pontos, raioIni, raioFim, cor, n = 40, rugosidade = 0.38, verniz = 0.55 }: { pontos: V3[]; raioIni: number; raioFim: number; cor: string; n?: number; rugosidade?: number; verniz?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const chave = JSON.stringify(pontos) + raioIni + raioFim + n;
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const curva = new THREE.CatmullRomCurve3(pontos.map((p) => new THREE.Vector3(...p)));
    const o = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      o.position.copy(curva.getPoint(t));
      o.scale.setScalar(THREE.MathUtils.lerp(raioIni, raioFim, t));
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]} castShadow receiveShadow>
      <sphereGeometry args={[1, 24, 24]} />
      <meshPhysicalMaterial color={cor} roughness={rugosidade} clearcoat={verniz} clearcoatRoughness={0.3} />
    </instancedMesh>
  );
}

function Elipsoide({ pos, escala, rot = [0, 0, 0], cor, rugosidade = 0.4, verniz = 0.5 }: { pos: V3; escala: V3; rot?: V3; cor: string; rugosidade?: number; verniz?: number }) {
  return (
    <mesh position={pos} scale={escala} rotation={rot} castShadow receiveShadow>
      <sphereGeometry args={[1, 40, 40]} />
      <meshPhysicalMaterial color={cor} roughness={rugosidade} clearcoat={verniz} clearcoatRoughness={0.3} />
    </mesh>
  );
}

function Olho({ lado, olhar }: { lado: 1 | -1; olhar: [number, number] }) {
  return (
    <group position={[0.14, 0.07, 0.17 * lado]} rotation={[0, lado * 0.25, 0]}>
      <Elipsoide pos={[0, 0, 0]} escala={[0.12, 0.13, 0.11]} cor={COR.branco} rugosidade={0.15} verniz={1} />
      <Elipsoide pos={[0.07 + olhar[0] * 0.02, olhar[1] * 0.03, 0.045 * lado]} escala={[0.065, 0.07, 0.06]} cor={COR.tinta} rugosidade={0.1} verniz={1} />
      <Elipsoide pos={[0.1, 0.035, 0.07 * lado]} escala={[0.022, 0.022, 0.022]} cor={COR.branco} rugosidade={0.05} verniz={0} />
    </group>
  );
}

/** Asa dobrada: elipsoide achatada com fileiras de penas e pontas pretas em leque. */
function Asa({ lado, giro }: { lado: 1 | -1; giro: V3 }) {
  return (
    <group position={[0.25, 0.28, 0.58 * lado]} rotation={giro}>
      <Elipsoide pos={[-0.5, -0.12, 0]} escala={[0.86, 0.42, 0.1]} rot={[0, 0, 0.3]} cor={COR.corpo} />
      {[0, 1, 2].map((i) => (
        <Elipsoide key={`c${i}`} pos={[-0.22 - i * 0.3, -0.06 - i * 0.1, 0.07 * lado]} escala={[0.3, 0.2, 0.05]} rot={[0, 0, 0.32]} cor={i % 2 ? "#F25A48" : "#FF6B58"} rugosidade={0.45} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <Elipsoide key={i} pos={[-1.18 - i * 0.05, -0.28 - i * 0.07, 0.035 * (i - 1.5)]} escala={[0.4, 0.075, 0.06]} rot={[0, 0, 0.46 + i * 0.09]} cor={COR.ponta} />
      ))}
    </group>
  );
}

function Perna({ lado, giro }: { lado: 1 | -1; giro: number }) {
  const z = 0.26 * lado;
  return (
    <group position={[-0.05, -0.62, z]} rotation={[0, 0, giro]}>
      <Cadeia pontos={[[0, 0, 0], [0.04, -0.34, 0], [0.0, -0.7, 0]]} raioIni={0.052} raioFim={0.036} cor={COR.perna} n={50} />
      {[-0.28, 0, 0.28].map((a) => (
        <mesh key={a} position={[0.1 * Math.cos(a), -0.7, 0.1 * Math.sin(a)]} rotation={[0, -a, -Math.PI / 2]} castShadow>
          <capsuleGeometry args={[0.028, 0.16, 6, 10]} />
          <meshPhysicalMaterial color={COR.perna} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function PernaSentada({ lado }: { lado: 1 | -1 }) {
  const z = 0.26 * lado;
  return (
    <group position={[-0.05, -0.55, z]}>
      <Cadeia pontos={[[0, 0, 0], [0.5, -0.06, 0], [0.98, -0.2, 0]]} raioIni={0.056} raioFim={0.04} cor={COR.perna} n={50} />
      {[-0.28, 0, 0.28].map((a) => (
        <mesh key={a} position={[0.98 + 0.08 * Math.cos(a), -0.24, 0.08 * Math.sin(a)]} rotation={[0, -a, -Math.PI / 2 + 0.2]} castShadow>
          <capsuleGeometry args={[0.028, 0.14, 6, 10]} />
          <meshPhysicalMaterial color={COR.perna} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function Jornal({ aberto = true }: { aberto?: boolean }) {
  return (
    <group>
      <RoundedBox args={[0.95, 0.72, 0.03]} radius={0.02} smoothness={4} castShadow>
        <meshStandardMaterial color={COR.papel} roughness={0.8} />
      </RoundedBox>
      <mesh position={[0, 0.27, 0.02]}><boxGeometry args={[0.95, 0.16, 0.012]} /><meshStandardMaterial color={COR.tinta} /></mesh>
      {[[-0.18, 0.07, 0.4, 0.07], [-0.28, -0.04, 0.24, 0.07]].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.02]}><boxGeometry args={[w, h, 0.012]} /><meshStandardMaterial color={COR.tinta} /></mesh>
      ))}
      <mesh position={[0.27, 0.0, 0.02]}><boxGeometry args={[0.3, 0.22, 0.012]} /><meshStandardMaterial color={COR.azul} /></mesh>
      {[-0.17, -0.24, -0.31].map((y, i) => (
        <mesh key={y} position={[-0.1 - i * 0.04, y, 0.02]}><boxGeometry args={[0.62 - i * 0.12, 0.03, 0.012]} /><meshStandardMaterial color="#C9C9C9" /></mesh>
      ))}
      {[-0.5, 0.5].map((x) => (
        <Elipsoide key={x} pos={[x, -0.12, 0.05]} escala={[0.09, 0.22, 0.06]} rot={[0, 0, x * 0.4]} cor={COR.ponta} />
      ))}
      {!aberto && null}
    </group>
  );
}

function Sofa() {
  const mat = <meshStandardMaterial color={COR.creme} roughness={0.85} />;
  const mat2 = <meshStandardMaterial color={COR.cremeEscuro} roughness={0.85} />;
  return (
    <group position={[0, 0, 0]}>
      <RoundedBox args={[3.4, 0.5, 1.5]} radius={0.16} smoothness={5} position={[0.1, 0.38, 0]} castShadow receiveShadow>{mat}</RoundedBox>
      <RoundedBox args={[0.5, 1.4, 1.5]} radius={0.2} smoothness={5} position={[-1.55, 0.95, 0]} castShadow receiveShadow>{mat2}</RoundedBox>
      <RoundedBox args={[0.55, 0.95, 1.5]} radius={0.2} smoothness={5} position={[1.75, 0.72, 0]} castShadow receiveShadow>{mat2}</RoundedBox>
      <RoundedBox args={[0.55, 0.55, 0.3]} radius={0.15} smoothness={4} position={[-1.1, 1.05, 0.5]} rotation={[0, 0.2, 0.2]} castShadow>
        <meshStandardMaterial color={COR.almofada} roughness={0.9} />
      </RoundedBox>
      {[[-1.4, 0.55], [1.5, 0.55], [-1.4, -0.55], [1.5, -0.55]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.07, z]} castShadow><cylinderGeometry args={[0.06, 0.05, 0.16, 12]} /><meshStandardMaterial color={COR.azulEscuro} /></mesh>
      ))}
    </group>
  );
}

export type Pose3D = "parado" | "acenando" | "lendo" | "sofa" | "comemorando" | "acenandoE" | "apontando" | "encostado";

interface Aj {
  corpoY: number; inclina: number;
  pescoco: V3[]; cabeca: number; olhar: [number, number];
  asaD: V3; asaE: V3;
  pernas: [number, number]; sentado?: boolean; jornal?: boolean; sofa?: boolean; feliz?: boolean;
}
const POSES: Record<Pose3D, Aj> = {
  parado:   { corpoY: 1.3, inclina: 0.32, pescoco: [[0.7, 0.45, 0], [1.05, 0.95, 0], [0.8, 1.5, 0], [1.12, 1.92, 0]], cabeca: 0.1, olhar: [0, 0], asaD: [0, 0, 0], asaE: [0, 0, 0], pernas: [0.03, -0.03] },
  acenando: { corpoY: 1.3, inclina: 0.3, pescoco: [[0.7, 0.45, 0], [1.05, 0.95, 0], [0.8, 1.5, 0], [1.1, 1.92, 0]], cabeca: 0.0, olhar: [0, 0], asaD: [-2.5, 0.2, 0.9], asaE: [0, 0, 0], pernas: [0.03, -0.03] },
  lendo:    { corpoY: 1.3, inclina: 0.2, pescoco: [[0.7, 0.45, 0], [1.1, 0.8, 0], [1.15, 1.25, 0], [1.3, 1.55, 0]], cabeca: -0.55, olhar: [0, -1], asaD: [0, 0, 0], asaE: [0, 0, 0], pernas: [0.02, -0.02], jornal: true },
  acenandoE: { corpoY: 1.3, inclina: 0.3, pescoco: [[0.7, 0.45, 0], [1.05, 0.95, 0], [0.8, 1.5, 0], [1.1, 1.92, 0]], cabeca: 0.05, olhar: [0, 0], asaD: [0, 0, 0], asaE: [2.5, -0.2, 0.9], pernas: [0.03, -0.03] },
  apontando: { corpoY: 1.3, inclina: 0.25, pescoco: [[0.7, 0.45, 0], [1.05, 0.95, 0], [0.8, 1.5, 0], [1.1, 1.92, 0]], cabeca: 0.05, olhar: [0, 0], asaD: [0, Math.PI / 2, 0.3], asaE: [0, 0, 0], pernas: [0.03, -0.03] },
  encostado: { corpoY: 1.3, inclina: 0.38, pescoco: [[0.7, 0.45, 0], [1.0, 0.95, 0], [0.82, 1.5, 0], [1.1, 1.92, 0]], cabeca: -0.1, olhar: [0, -0.4], asaD: [0, 0, 0], asaE: [0, Math.PI, 0.35], pernas: [0.0, 0.0] },
  comemorando: { corpoY: 1.5, inclina: 0.2, pescoco: [[0.7, 0.45, 0], [0.95, 1.0, 0], [0.7, 1.55, 0], [0.85, 2.0, 0]], cabeca: 0.5, olhar: [0, 0], asaD: [-2.6, 0.1, 0.9], asaE: [2.6, -0.1, 0.9], pernas: [0.25, -0.25], feliz: true },
  sofa:     { corpoY: 0.82, inclina: 0.15, pescoco: [[0.7, 0.45, 0], [1.1, 0.8, 0], [1.15, 1.25, 0], [1.3, 1.55, 0]], cabeca: -0.55, olhar: [0, -1], asaD: [0, 0, 0], asaE: [0, 0, 0], pernas: [0, 0], sentado: true, jornal: true, sofa: true },
};

function Guara({ pose }: { pose: Pose3D }) {
  const p = POSES[pose];
  const cabeca = p.pescoco[p.pescoco.length - 1];
  const bico: V3[] = [[0.2, -0.02, 0], [0.55, -0.02, 0], [0.88, -0.2, 0], [1.02, -0.58, 0], [1.0, -0.86, 0]];
  return (
    <group position={[0, p.corpoY, 0]}>
      <group rotation={[0, 0, p.inclina]}>
        {/* corpo de ovo e barriga clara */}
        <Elipsoide pos={[0, 0, 0]} escala={[1.0, 0.72, 0.6]} cor={COR.corpo} />
        <Elipsoide pos={[0.2, -0.16, 0]} escala={[0.82, 0.52, 0.6]} cor="#FF7F6B" rugosidade={0.55} verniz={0.2} />
        {/* rabo curto */}
        {[-0.16, 0, 0.16].map((z, i) => (
          <group key={i} position={[-1.0, -0.18, z]} rotation={[0, z * 0.9, 0]}>
            <Elipsoide pos={[-0.3, -0.16, 0]} escala={[0.42, 0.09, 0.09]} rot={[0, 0, 0.55 + i * 0.05]} cor={COR.corpo} />
            <Elipsoide pos={[-0.62, -0.34, 0]} escala={[0.18, 0.07, 0.08]} rot={[0, 0, 0.65 + i * 0.05]} cor={COR.ponta} />
          </group>
        ))}
        <Asa lado={1} giro={p.asaD} />
        <Asa lado={-1} giro={p.asaE} />
      </group>

      {/* pescoço em S, cabeça e bico (o ponto de partida do pescoço está no peito) */}
      <Cadeia pontos={p.pescoco} raioIni={0.2} raioFim={0.135} cor={COR.corpo} n={160} />
      <group position={cabeca} rotation={[0, 0, p.cabeca]}>
        <Elipsoide pos={[0, 0, 0]} escala={[0.27, 0.24, 0.24]} cor={COR.corpo} />
        <Elipsoide pos={[0.1, -0.03, 0]} escala={[0.2, 0.17, 0.22]} cor={COR.rosto} rugosidade={0.5} verniz={0.2} />
        <Olho lado={1} olhar={p.olhar} />
        <Olho lado={-1} olhar={p.olhar} />
        <Cadeia pontos={bico} raioIni={0.115} raioFim={0.022} cor={COR.bico} n={120} rugosidade={0.3} verniz={0.8} />
      </group>

      {p.sentado ? (
        <>
          <PernaSentada lado={1} />
          <PernaSentada lado={-1} />
        </>
      ) : (
        <>
          <Perna lado={1} giro={p.pernas[0]} />
          <Perna lado={-1} giro={p.pernas[1]} />
        </>
      )}
      {p.jornal && (
        <group position={[1.45, p.sentado ? 0.2 : 0.45, 0.55]} rotation={[0.25, 0.45, 0.12]}>
          <Jornal />
        </group>
      )}
    </group>
  );
}

function Luzes() {
  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#ffffff", "#c9d6e2", 0.7]} />
      <directionalLight position={[3.5, 6, 4]} intensity={2.6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={5} shadow-camera-bottom={-1} shadow-bias={-0.0004} />
      <directionalLight position={[-4, 3, -3]} intensity={1.4} color="#9fc6ff" />
      <pointLight position={[0, 1.6, 3]} intensity={6} distance={8} color="#fff1e6" />
    </>
  );
}

export function Guara3D({ pose = "parado", largura = 420, altura = 520, children, fundo = "transparent", espelho = false, giro }: { giro?: number; espelho?: boolean; pose?: Pose3D; largura?: number; altura?: number; children?: ReactNode; fundo?: string }) {
  const sofa = POSES[pose].sofa;
  return (
    <div style={{ width: largura, height: altura, background: fundo }}>
      <Canvas shadows dpr={[1, 2]} resize={{ scroll: false, offsetSize: true }} style={{ width: "100%", height: "100%" }} camera={{ position: sofa ? [3.9, 2.5, 7.1] : giro !== undefined ? [1.2, 2.7, 8.6] : [espelho ? -4.4 : 4.4, 2.8, 8.2], fov: 30 }} gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }} onCreated={({ camera }) => camera.lookAt(sofa ? 0.3 : giro !== undefined ? 0.1 : espelho ? -0.5 : 0.5, sofa ? 1.5 : 1.55, 0)}>
        <Luzes />
        <group rotation={[0, giro !== undefined ? giro : espelho ? Math.PI + 0.15 : -0.15, 0]}>
          {sofa && <Sofa />}
          <group position={sofa ? [-0.1, 0.52, 0] : [0, 0, 0]}>
            <Guara pose={pose} />
          </group>
        </group>
        <ContactShadows position={[0, 0.005, 0]} opacity={0.5} scale={9} blur={2.6} far={3.2} color="#13324A" />
        {children}
      </Canvas>
    </div>
  );
}

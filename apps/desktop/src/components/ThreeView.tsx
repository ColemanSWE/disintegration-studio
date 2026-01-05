import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';

interface ThreeViewProps {
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;
  displacementScale?: number;
  wireframe?: boolean;
}

function MediaMesh({ 
  source, 
  displacementScale = 3, 
  wireframe = true 
}: { 
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;
  displacementScale: number;
  wireframe: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const textureRef = useRef<THREE.Texture | null>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const lastCanvasSizeRef = useRef<{ width: number; height: number } | null>(null);
  const frameCountRef = useRef(0);

  const texture = useMemo(() => {
    if (textureRef.current) {
      textureRef.current.dispose();
    }
    
    let tex: THREE.Texture;
    if (source instanceof HTMLVideoElement) {
      tex = new THREE.VideoTexture(source);
      tex.needsUpdate = true;
    } else if (source instanceof HTMLCanvasElement) {
      tex = new THREE.CanvasTexture(source);
      tex.needsUpdate = true;
      lastCanvasSizeRef.current = { width: source.width, height: source.height };
    } else {
      tex = new THREE.Texture(source);
      tex.needsUpdate = true;
    }
    
    tex.format = THREE.RGBAFormat;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    textureRef.current = tex;
    return tex;
  }, [source]);

  useFrame(() => {
    frameCountRef.current++;
    
    if (source instanceof HTMLCanvasElement) {
      const canvas = source;
      
      if (canvas.width === 0 || canvas.height === 0) return;
      
      const currentSize = { width: canvas.width, height: canvas.height };
      const sizeChanged = !lastCanvasSizeRef.current || 
          lastCanvasSizeRef.current.width !== currentSize.width || 
          lastCanvasSizeRef.current.height !== currentSize.height;
      
      if (sizeChanged || frameCountRef.current % 1 === 0) {
        if (textureRef.current) {
          textureRef.current.dispose();
        }
        const newTex = new THREE.CanvasTexture(canvas);
        newTex.format = THREE.RGBAFormat;
        newTex.minFilter = THREE.LinearFilter;
        newTex.magFilter = THREE.LinearFilter;
        newTex.needsUpdate = true;
        textureRef.current = newTex;
        if (materialRef.current) {
          materialRef.current.map = newTex;
          materialRef.current.displacementMap = newTex;
          materialRef.current.needsUpdate = true;
        }
        lastCanvasSizeRef.current = currentSize;
      }
    } else if (textureRef.current && source instanceof HTMLVideoElement) {
      textureRef.current.needsUpdate = true;
    }
  });
  
  useEffect(() => {
    if (source instanceof HTMLImageElement) {
      texture.needsUpdate = true;
    }
    
    return () => {
      if (textureRef.current) {
        textureRef.current.dispose();
      }
    };
  }, [source, texture]);

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[16, 12, 128, 128]} />
      <meshStandardMaterial 
        ref={materialRef}
        map={texture} 
        displacementMap={texture} 
        displacementScale={displacementScale} 
        wireframe={wireframe}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function ThreeView({ source, displacementScale = 3, wireframe = true }: ThreeViewProps) {
  return (
    <div style={{ width: '100%', height: '100%', background: '#000' }}>
      <Canvas camera={{ position: [0, 5, 10], fov: 60 }}>
        <color attach="background" args={['#000000']} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        
        <MediaMesh 
          source={source} 
          displacementScale={displacementScale}
          wireframe={wireframe}
        />
        
        <OrbitControls />
      </Canvas>
    </div>
  );
}

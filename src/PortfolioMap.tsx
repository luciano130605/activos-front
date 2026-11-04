import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { feature } from 'topojson-client';
import world from 'world-atlas/countries-110m.json';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Investment } from './portfolio';

const countryIds: Record<string, string> = { 'Estados Unidos': '840', 'Uruguay': '858', 'Canadá': '124', 'Luxemburgo': '442', 'Taiwán': '158', 'Países Bajos': '528', 'Alemania': '276', 'China': '156', 'Brasil': '076', 'Argentina': '032', 'México': '484' };
type Position = { investment: Investment; country: string; value: number };
type GeoFeature = { id?: string | number; geometry: { type: string; coordinates: number[][][][] | number[][][] } };
const topology = world as unknown as Topology;
const countries = (feature(topology, topology.objects.countries as GeometryCollection) as unknown as { features: GeoFeature[] }).features;
const idOf = (id: string | number | undefined) => String(id ?? '').padStart(3, '0');

function Globe({ active, available, onSelect }: { active: string | null; available: string[]; onSelect: (country: string) => void }) {
    const mount = useRef<HTMLDivElement>(null);
    const select = useRef(onSelect);
    useEffect(() => { select.current = onSelect; }, [onSelect]);
    const [failed, setFailed] = useState(false);
    const availableKey = available.join('|');
    useEffect(() => {
        const host = mount.current;
        if (!host) return;
        let renderer: THREE.WebGLRenderer;
        try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { setFailed(true); return; }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        host.appendChild(renderer.domElement);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(35, 1, .1, 100); camera.position.set(0, 0, 3.9);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 2.5; controls.maxDistance = 6;
        controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches; controls.autoRotateSpeed = .35;
        const canvas = document.createElement('canvas'); canvas.width = 2048; canvas.height = 1024;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#101d22'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const availableIds = new Set(availableKey.split('|').map(name => countryIds[name]));
        const selectedId = active ? countryIds[active] : '';
        function drawRing(ring: number[][]) {
            ring.forEach(([lon, lat], i) => { const x = (lon + 180) / 360 * canvas.width, y = (90 - lat) / 180 * canvas.height; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
            ctx.closePath();
        }
        for (const country of countries) {
            const id = idOf(country.id); const polygons = country.geometry.type === 'Polygon' ? [country.geometry.coordinates as number[][][]] : country.geometry.coordinates as number[][][][];
            ctx.beginPath(); for (const polygon of polygons) for (const ring of polygon) drawRing(ring);
            ctx.fillStyle = id === selectedId ? '#dafb99' : availableIds.has(id) ? '#9bcf91' : '#344b49';
            ctx.fill('evenodd'); ctx.strokeStyle = '#172d2c'; ctx.lineWidth = 1.2; ctx.stroke();
        }
        const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
        const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshStandardMaterial({ map: texture, roughness: .85 })); scene.add(globe);
        scene.add(new THREE.AmbientLight(0xffffff, 1.35)); const light = new THREE.DirectionalLight(0xffffff, 2); light.position.set(-3, 2, 4); scene.add(light);
        const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.025, 64, 48), new THREE.MeshBasicMaterial({ color: 0x98d9bd, transparent: true, opacity: .07, side: THREE.BackSide })); scene.add(atmosphere);
        const resize = () => { const width = host.clientWidth, height = host.clientHeight; if (!width || !height) return; camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height); };
        const observer = new ResizeObserver(resize); observer.observe(host); resize();
        let downX = 0, downY = 0;
        const onDown = (e: PointerEvent) => { downX = e.clientX; downY = e.clientY; };
        const onUp = (e: PointerEvent) => {
            if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
            const rect = renderer.domElement.getBoundingClientRect();
            const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), camera);
            const hit = ray.intersectObject(globe)[0]; if (!hit?.uv) return;
            const x = Math.min(canvas.width - 1, Math.max(0, Math.floor(hit.uv.x * canvas.width)));
            const y = Math.min(canvas.height - 1, Math.max(0, Math.floor((1 - hit.uv.y) * canvas.height)));
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            // The country colors identify only highlighted countries; a separate geometry lookup disambiguates them.
            if (pixel[0] < 100) return;
            const lon = hit.uv.x * 360 - 180, lat = 90 - (1 - hit.uv.y) * 180;
            const insideRing = (ring: number[][]) => { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside; } return inside; };
            const found = countries.find(country => { const polygons = country.geometry.type === 'Polygon' ? [country.geometry.coordinates as number[][][]] : country.geometry.coordinates as number[][][][]; return polygons.some(polygon => polygon.length > 0 && insideRing(polygon[0]) && !polygon.slice(1).some(insideRing)); });
            const name = Object.keys(countryIds).find(key => countryIds[key] === idOf(found?.id) && availableKey.split('|').includes(key)); if (name) select.current(name);
        };
        renderer.domElement.addEventListener('pointerdown', onDown); renderer.domElement.addEventListener('pointerup', onUp);
        let frame = 0; const animate = () => { frame = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }; animate();
        return () => { cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener('pointerdown', onDown); renderer.domElement.removeEventListener('pointerup', onUp); controls.dispose(); globe.geometry.dispose(); (globe.material as THREE.Material).dispose(); atmosphere.geometry.dispose(); (atmosphere.material as THREE.Material).dispose(); texture.dispose(); renderer.dispose(); renderer.domElement.remove(); };
    }, [active, availableKey]);
    return <div className="relative h-[340px] w-full sm:h-[480px]"><div ref={mount} className="h-full w-full cursor-grab touch-none active:cursor-grabbing" aria-hidden="true" />{failed && <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-white/60">No se pudo mostrar el globo 3D. Podés explorar los países desde la lista.</p>}</div>;
}

export default function PortfolioMap({ positions, format }: { positions: Position[]; format: (value: number) => string }) {
    const [selected, setSelected] = useState<string | null>(null);
    const groups = useMemo(() => { const result = new Map<string, Position[]>(); positions.forEach(position => result.set(position.country, [...(result.get(position.country) ?? []), position])); return [...result].map(([country, entries]) => ({ country, entries, value: entries.reduce((sum, entry) => sum + entry.value, 0) })).sort((a, b) => b.value - a.value); }, [positions]);
    const total = groups.reduce((sum, group) => sum + group.value, 0);
    const mapped = groups.filter(group => countryIds[group.country]);
    const current = groups.find(group => group.country === selected) ?? null;
    const pct = (value: number) => total > 0 ? `${(value / total * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%` : '—';
    return <section className="card overflow-hidden" aria-label="Mapa de inversiones">
        <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,1fr)]">
            <div className="relative overflow-hidden bg-[#0b1518] text-white"><div className="absolute left-5 top-5 z-10 sm:left-7 sm:top-7"><p className="font-mono text-[10px] tracking-[.16em] text-[#a8d5ba]">TU CARTERA EN EL MUNDO</p><h2 className="mt-2 text-[24px] font-light tracking-tight">Explorá tus inversiones</h2><p className="mt-2 text-[12px] text-white/50">Arrastrá para girar · tocá un país destacado</p></div><div className="pt-20"><Globe active={selected} available={mapped.map(group => group.country)} onSelect={setSelected} /></div><p className="absolute bottom-4 left-5 text-[10px] text-white/40 sm:left-7">● Países presentes en tu cartera</p></div>
            <div className="p-5 sm:p-7"><div className="flex items-start justify-between gap-3"><div><p className="lb">{current ? 'PAÍS SELECCIONADO' : 'DISTRIBUCIÓN GEOGRÁFICA'}</p><h3 className="mt-2 text-[23px] font-light tracking-tight">{current?.country ?? 'Tu cartera por país'}</h3></div>{current && <button type="button" onClick={() => setSelected(null)} className="btn-ghost text-[11px]">Ver todos</button>}</div>
                {current ? <><div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--raised)] p-4"><p className="mu text-[11px]">Participación en la cartera</p><div className="mt-1 flex flex-wrap items-end justify-between gap-2"><span className="text-[30px] font-light tabular-nums">{pct(current.value)}</span><span className="font-mono text-[12px]">{format(current.value)}</span></div></div><p className="lb mt-7">INVERSIONES · {current.entries.length}</p><ul className="mt-2 divide-y divide-[var(--line)]">{current.entries.map(({ investment, value }) => <li key={investment.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-[13px]">{investment.name}</p><p className="mu mt-1 text-[11px]">{investment.coin ?? 'Con tasa'}</p></div><span className="shrink-0 font-mono text-[11px]">{format(value)}</span></li>)}</ul></> : <><p className="mu mt-3 text-[12px] leading-5">Seleccioná un país para ver los activos que lo componen.</p><div className="mt-5 divide-y divide-[var(--line)]">{groups.length ? groups.map(group => <button key={group.country} type="button" onClick={() => setSelected(group.country)} className="flex w-full items-center gap-3 py-3 text-left hover:text-[var(--sig)]"><span className={`h-2 w-2 rounded-full ${countryIds[group.country] ? 'bg-[#a3d99d]' : 'bg-[var(--faint)]'}`} /><span className="flex-1 text-[13px]">{group.country}<span className="mu ml-2 text-[10px]">{group.entries.length}</span></span><span className="font-mono text-[12px]">{pct(group.value)}</span><span className="text-[var(--faint)]">›</span></button>) : <p className="py-8 text-[13px] text-[var(--muted)]">Agregá inversiones para descubrir tu cartera en el mapa.</p>}</div></>}
                <p className="mu mt-6 border-t border-[var(--line)] pt-4 text-[10.5px] leading-5">Clasificación orientativa por emisor o mercado del ETF, no por exposición real. Cripto y activos sin datos se muestran por separado. Los porcentajes incluyen toda la cartera; si falta un precio puede usarse el monto original. Si falta una conversión, no se calcula el porcentaje.</p>
            </div>
        </div>
    </section>;
}

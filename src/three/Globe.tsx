import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { BY_ISO2 } from '@/data/countries'

type GlobeData = { dots: number[] }

export type GlobeProps = {
  /** ISO-2 to job count. Drives marker size. */
  counts: Record<string, number>
  /** Currently filtered countries. Rendered hot. */
  selected: string[]
  onSelect: (iso2: string) => void
  className?: string
}

const R = 1
const DEG = Math.PI / 180

/** Atmosphere shell radius, and the camera distance that keeps it in frame. */
const ATMO = 1.09
const CAM_Z = 3.5

function toVec(lat: number, lon: number, r: number, out = new THREE.Vector3()) {
  const phi = (90 - lat) * DEG
  const theta = (lon + 180) * DEG
  return out.set(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  )
}

/** A soft round sprite, drawn once. Square points read as pixels, not dots. */
function discTexture(): THREE.Texture {
  const s = 64
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.55, 'rgba(255,255,255,0.85)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, s, s)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export default function Globe({ counts, selected, onSelect, className }: GlobeProps) {
  const host = useRef<HTMLDivElement>(null)
  /** Which country is hovered. Changes rarely, so it can drive a render. */
  const [hover, setHover] = useState<string | null>(null)
  /**
   * The label's position, moved directly on the node. Routing this through
   * state would re-render on every frame while the globe turns under the
   * cursor, for a value only one element reads.
   */
  const tip = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  /**
   * Marker rebuild, published by the scene effect. The job index arrives after
   * mount, so the markers have to be rebuilt then — and it must not be done by
   * re-running the scene effect, which would tear down the whole globe.
   */
  const rebuildRef = useRef<(() => void) | null>(null)

  // Live values the animation loop reads without forcing React re-renders.
  const api = useRef({
    counts,
    selected,
    onSelect,
    /**
     * Opens facing Europe and Africa rather than the Pacific, which is almost
     * all ocean and makes the globe look empty on arrival.
     *
     * At spin 0 the meridian facing the camera is -90°, and rotation follows
     * lon = -90 - spin, so centring on roughly 15°E needs -1.83 rad.
     */
    spin: -1.83,
    spinVel: 0,
    tilt: -0.18,
    dragging: false,
    lastX: 0,
    lastY: 0,
    moved: 0,
    pointer: { x: -9999, y: -9999, inside: false },
    hoverIso: null as string | null,
    /** A finger needs a wider hit radius than a cursor. */
    coarse: false,
  })
  api.current.counts = counts
  api.current.selected = selected
  api.current.onSelect = onSelect

  useEffect(() => {
    const el = host.current
    if (!el) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    /**
     * Far enough back that the atmosphere shell fits inside the frame. At this
     * field of view the visible half-height is dist * tan(19°), so the shell's
     * radius has to stay under that or its edges are clipped square by the
     * viewport — which reads as a box drawn around the globe.
     */
    camera.position.set(0, 0, CAM_Z)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    el.appendChild(renderer.domElement)
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab'

    const world = new THREE.Group()
    world.rotation.z = api.current.tilt
    scene.add(world)

    /* --- solid core, so land on the far side is hidden rather than showing
           through and turning the globe into a wireframe ball --- */
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.985, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x081a36 })
    )
    world.add(core)

    /* --- atmosphere: a fresnel rim on a slightly larger back-facing sphere --- */
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(ATMO, 64, 64),
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color(0x3b82f6) } },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform vec3 uColor;
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            float rim = 1.0 - abs(dot(vNormal, vView));
            float a = pow(rim, 3.2) * 0.85;
            gl_FragColor = vec4(uColor, a);
          }`,
      })
    )
    scene.add(atmo)

    /* --- graticule: real parallels and meridians. A WireframeGeometry sphere
           gives triangulated edges, which read as a noisy mesh rather than a
           globe, so the lines are built by hand. --- */
    const gridPts: number[] = []
    const STEP = 4

    // Parallels every 30 degrees, poles excluded.
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let lon = -180; lon < 180; lon += STEP) {
        const a = toVec(lat, lon, R * 0.995)
        const b = toVec(lat, lon + STEP, R * 0.995)
        gridPts.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
    }
    // Meridians every 30 degrees.
    for (let lon = -180; lon < 180; lon += 30) {
      for (let lat = -90; lat < 90; lat += STEP) {
        const a = toVec(lat, lon, R * 0.995)
        const b = toVec(lat + STEP, lon, R * 0.995)
        gridPts.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
    }

    const gridGeo = new THREE.BufferGeometry()
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPts, 3))
    const grid = new THREE.LineSegments(
      gridGeo,
      new THREE.LineBasicMaterial({ color: 0x1e4478, transparent: true, opacity: 0.3 })
    )
    world.add(grid)

    const disc = discTexture()
    const markerGroup = new THREE.Group()
    world.add(markerGroup)

    type Marker = { iso2: string; base: THREE.Vector3; dot: THREE.Sprite; ring: THREE.Sprite }
    let markers: Marker[] = []
    let landPoints: THREE.Points | null = null

    let raf = 0
    let disposed = false

    /* ------------------------------------------------------------ data --- */
    fetch(`${import.meta.env.BASE_URL}data/globe.json`)
      .then((r) => r.json())
      .then((data: GlobeData) => {
        if (disposed) return

        const n = data.dots.length / 2
        const pos = new Float32Array(n * 3)
        const v = new THREE.Vector3()
        for (let i = 0; i < n; i++) {
          const lon = data.dots[i * 2] / 100
          const lat = data.dots[i * 2 + 1] / 100
          toVec(lat, lon, R, v)
          pos[i * 3] = v.x
          pos[i * 3 + 1] = v.y
          pos[i * 3 + 2] = v.z
        }
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))

        landPoints = new THREE.Points(
          geo,
          new THREE.PointsMaterial({
            size: 0.023,
            map: disc,
            color: 0x7fb6ff,
            transparent: true,
            opacity: 1,
            depthWrite: false,
            sizeAttenuation: true,
          })
        )
        world.add(landPoints)
        setReady(true)
      })
      .catch(() => setReady(true))

    /* --------------------------------------------------- marker rebuild --- */
    const dotMat = () =>
      new THREE.SpriteMaterial({ map: disc, transparent: true, depthWrite: false, depthTest: false })

    function rebuild() {
      for (const m of markers) {
        markerGroup.remove(m.dot, m.ring)
        m.dot.material.dispose()
        m.ring.material.dispose()
      }
      markers = []

      const entries = Object.entries(api.current.counts).filter(([, c]) => c > 0)
      if (!entries.length) return
      const max = Math.max(...entries.map(([, c]) => c))

      for (const [iso2, count] of entries) {
        const c = BY_ISO2[iso2]
        if (!c) continue

        const base = toVec(c.lat, c.lon, R * 1.012)
        const t = Math.sqrt(count / max)

        const ring = new THREE.Sprite(dotMat())
        ring.material.color.set(0x38d9e8)
        ring.material.opacity = 0.22
        ring.position.copy(base)
        ring.scale.setScalar(0.055 + t * 0.075)

        const dot = new THREE.Sprite(dotMat())
        dot.material.color.set(0xa5cdff)
        dot.position.copy(base)
        dot.scale.setScalar(0.022 + t * 0.03)

        markerGroup.add(ring, dot)
        markers.push({ iso2, base, dot, ring })
      }
    }
    rebuild()
    rebuildRef.current = rebuild

    /* ------------------------------------------------------------ input --- */
    const dom = renderer.domElement

    const onDown = (e: PointerEvent) => {
      const rect = dom.getBoundingClientRect()
      // Seeded here because a tap produces no pointermove at all, and without a
      // position there is nothing for the release to test against.
      api.current.pointer.x = e.clientX - rect.left
      api.current.pointer.y = e.clientY - rect.top
      api.current.pointer.inside = true
      api.current.coarse = e.pointerType !== 'mouse'
      api.current.dragging = true
      api.current.moved = 0
      api.current.lastX = e.clientX
      api.current.lastY = e.clientY
      dom.style.cursor = 'grabbing'
      try {
        dom.setPointerCapture(e.pointerId)
      } catch {
        // Synthetic events have no active pointer; harmless.
      }
    }
    const onMove = (e: PointerEvent) => {
      const rect = dom.getBoundingClientRect()
      api.current.pointer.x = e.clientX - rect.left
      api.current.pointer.y = e.clientY - rect.top
      api.current.pointer.inside = true

      if (!api.current.dragging) return
      const dx = e.clientX - api.current.lastX
      const dy = e.clientY - api.current.lastY
      api.current.lastX = e.clientX
      api.current.lastY = e.clientY
      api.current.moved += Math.abs(dx) + Math.abs(dy)
      api.current.spinVel = dx * 0.004
      api.current.spin += dx * 0.004
      api.current.tilt = THREE.MathUtils.clamp(api.current.tilt + dy * 0.003, -0.9, 0.9)
    }
    const onUp = (e: PointerEvent) => {
      // A short press with almost no travel is a click, not a drag. The marker
      // is looked up from where the finger actually lifted rather than from a
      // hover the loop was never allowed to compute.
      if (api.current.dragging && api.current.moved < 8) {
        const rect = dom.getBoundingClientRect()
        const hit = nearestMarker(e.clientX - rect.left, e.clientY - rect.top)
        if (hit) api.current.onSelect(hit.iso2)
      }
      api.current.dragging = false
      dom.style.cursor = 'grab'
      try {
        dom.releasePointerCapture(e.pointerId)
      } catch {
        /* see onDown */
      }
    }
    const onLeave = () => {
      api.current.pointer.inside = false
      setHover(null)
    }

    dom.addEventListener('pointerdown', onDown)
    dom.addEventListener('pointermove', onMove)
    dom.addEventListener('pointerup', onUp)
    dom.addEventListener('pointercancel', onUp)
    dom.addEventListener('pointerleave', onLeave)

    /* ------------------------------------------------------------ sizing --- */
    const resize = () => {
      const w = el.clientWidth || 1
      const h = el.clientHeight || 1
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6))
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      // A narrow column crops the sphere, so pull back as it gets tighter.
      camera.position.z = CAM_Z * Math.max(1, 1.05 / camera.aspect) ** 0.6
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    /* -------------------------------------------------------------- loop --- */
    const clock = new THREE.Clock()
    const screen = new THREE.Vector3()
    /*
     * The loop used to run for the whole session. On the Today tab the globe is
     * near the top and the picks are below it, so reading job cards kept a WebGL
     * scene re-rendering off screen at roughly a fifth of the main thread — and
     * on a phone that is battery and scroll smoothness for nothing.
     */
    let onScreen = true
    let shown = !document.hidden
    const isVisible = () => onScreen && shown

    const onVis = () => {
      shown = !document.hidden
    }
    document.addEventListener('visibilitychange', onVis)

    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting
      },
      { rootMargin: '120px' }
    )
    io.observe(renderer.domElement)

    /**
     * The marker nearest a point on screen, or null.
     *
     * Pulled out of the render loop so a tap can ask the same question the
     * hover does. It used to exist only inside the loop, and the loop refuses
     * to run it while a pointer is down — so on press the hover was cleared,
     * and by the time the release checked for one there was nothing there.
     * That made "tap a marker to filter" dead on touch, and on a mouse unless
     * press and release landed inside the same frame.
     */
    let lastStateKey = ''

    const nearestMarker = (px: number, py: number) => {
      const w = renderer.domElement.clientWidth
      const h = renderer.domElement.clientHeight
      let found: { iso2: string; d: number; x: number; y: number } | null = null

      for (const m of markers) {
        screen.copy(m.base).applyMatrix4(world.matrixWorld)
        // Facing away from the camera means it is behind the globe.
        const toCam = screen.clone().sub(camera.position).normalize()
        const normal = screen.clone().normalize()
        if (normal.dot(toCam) > -0.12) continue

        screen.project(camera)
        const sx = (screen.x * 0.5 + 0.5) * w
        const sy = (-screen.y * 0.5 + 0.5) * h
        const d = Math.hypot(sx - px, sy - py)
        // A finger is far blunter than a cursor, so touch gets a wider reach.
        const reach = api.current.coarse ? 40 : 26
        if (d < reach && (!found || d < found.d)) found = { iso2: m.iso2, d, x: sx, y: sy }
      }
      return found
    }

    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!isVisible()) return

      const dt = Math.min(clock.getDelta(), 0.1)

      if (!api.current.dragging) {
        api.current.spin += api.current.spinVel
        api.current.spinVel *= Math.pow(0.94, dt * 60)
        if (!reduced) api.current.spin += dt * 0.045
      }
      world.rotation.y = api.current.spin
      world.rotation.z = api.current.tilt

      /* Rewritten only when something changed. Setting three material values on
         every marker every frame was pure cost once the country list grew. */
      const sel = api.current.selected
      const hoveredNow = api.current.hoverIso
      const stateKey = `${hoveredNow ?? ''}|${sel.join(',')}`
      if (stateKey !== lastStateKey) {
        lastStateKey = stateKey
        for (const m of markers) {
          const isSel = sel.includes(m.iso2)
          const isHov = m.iso2 === hoveredNow
          m.dot.material.color.set(isSel ? 0xf6a723 : isHov ? 0xffffff : 0xa5cdff)
          m.ring.material.color.set(isSel ? 0xf6a723 : 0x38d9e8)
          m.ring.material.opacity = isSel ? 0.45 : isHov ? 0.38 : 0.22
        }
      }

      /* Hover by screen projection rather than raycasting. Sprites ignore
         depth here, so this also has to reject markers on the far side. */
      const best =
        api.current.pointer.inside && !api.current.dragging
          ? nearestMarker(api.current.pointer.x, api.current.pointer.y)
          : null

      const nextIso = best?.iso2 ?? null
      if (nextIso !== api.current.hoverIso) {
        api.current.hoverIso = nextIso
        dom.style.cursor = nextIso ? 'pointer' : api.current.dragging ? 'grabbing' : 'grab'
        setHover(nextIso)
      }
      // Keep the label glued to its marker while the globe keeps turning.
      if (best && tip.current) {
        tip.current.style.transform = `translate(${best.x}px, ${best.y}px)`
      }

      renderer.render(scene, camera)
    }
    tick()

    /* ---------------------------------------------------------- teardown --- */
    return () => {
      disposed = true
      rebuildRef.current = null
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      dom.removeEventListener('pointerdown', onDown)
      dom.removeEventListener('pointermove', onMove)
      dom.removeEventListener('pointerup', onUp)
      dom.removeEventListener('pointercancel', onUp)
      dom.removeEventListener('pointerleave', onLeave)

      scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        mesh.geometry?.dispose?.()
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
        else mat?.dispose?.()
      })
      landPoints?.geometry.dispose()
      disc.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement)
    }
    // The scene is built once. Live values are read through the api ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* Rebuild the markers whenever the counts actually change — on first load of
     the index, and on every filter change after that. Keyed on a signature
     rather than the object so an unchanged map does not rebuild the geometry. */
  const sig = Object.entries(counts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}:${v}`)
    .join(',')

  useEffect(() => {
    rebuildRef.current?.()
  }, [sig])

  const hoverCountry = hover ? BY_ISO2[hover] : null

  return (
    <div ref={host} className={`relative ${className ?? ''}`}>
      {!ready && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="h-24 w-24 animate-spin-slow rounded-full border border-line border-t-beam" />
        </div>
      )}

      {/* Positioned by the loop. The inner element carries the offset so the
          outer transform stays a pure translate the loop can overwrite. */}
      <div
        ref={tip}
        className="pointer-events-none absolute left-0 top-0 z-10"
        style={{ visibility: hoverCountry ? 'visible' : 'hidden' }}
      >
        <div className="-translate-x-1/2 -translate-y-[150%] whitespace-nowrap rounded-lg border border-line bg-abyss/95 px-2.5 py-1.5 text-xs shadow-lg backdrop-blur">
          <span className="font-medium text-chalk">{hoverCountry?.name}</span>
          <span className="ml-2 font-mono text-cyan">{hover ? (counts[hover] ?? 0) : 0}</span>
        </div>
      </div>
    </div>
  )
}

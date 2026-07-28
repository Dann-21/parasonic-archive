import { useState, useRef, useEffect } from 'react'
import * as d3 from 'd3'
import WaveSurfer from 'wavesurfer.js'
import { recordings } from '../data/recordings'
import './ListView.css'

export const catColors = {
  EMF: '#e8d271',
  Conduction: '#463f70',
  Infrasound: '#5c4d8a',
  Ultrasound: '#3d7a5c',
}

const elementAnchors = {
  Ground: { x: 250, y: 350, color: '#7d5a35', tier: 'primary', r: 150 },
  Water: { x: 250, y: 650, color: '#6fa0b3', tier: 'primary', r: 150 },
  Wind: { x: 750, y: 350, color: '#a8b5c0', tier: 'primary', r: 150 },
  Electricity: { x: 750, y: 650, color: '#d4b25a', tier: 'primary', r: 150 },
  Metal: { x: 475, y: 560, color: '#8f9aa8', tier: 'primary', r: 150 },
  Biological: { x: 500, y: 230, color: '#8fb37a', tier: 'primary', r: 150 },
  Heat: { x: 487, y: 395, color: '#c9432f', tier: 'secondary', r: 70 },
}
export const elementColorMap = Object.fromEntries(Object.entries(elementAnchors).map(([k, v]) => [k, v.color]))

const labelOffsets = {
  Ground: { dx: -70, dy: -55 },
  Water: { dx: -70, dy: 60 },
  Wind: { dx: 70, dy: -55 },
  Electricity: { dx: 70, dy: 60 },
  Metal: { dx: 0, dy: 170 },
  Biological: { dx: 0, dy: -95 },
  Heat: { dx: -70, dy: 15 },
}

const entityElements = {
  'Pavement': ['Ground'],
  'Ground': ['Ground'],
  'Compost': ['Ground', 'Biological'],
  'Worms': ['Ground', 'Biological'],
  'Rain': ['Water'],
  'Drain pipe': ['Water', 'Metal'],
  'Manhole': ['Ground', 'Metal'],
  'Wind': ['Wind'],
  'Leaf': ['Biological'],
  'Bird': ['Wind', 'Biological'],
  'Balcony railing': ['Metal'],
  'Bus': ['Electricity', 'Metal'],
  'Hand rails': ['Metal'],
  'Electrical cables': ['Electricity'],
  'Traffic': ['Metal', 'Biological', 'Heat'],
  'Traffic light': ['Electricity', 'Metal'],
  'Voices': ['Biological'],
  'Synthesiser': ['Electricity', 'Metal'],
  'Charger': ['Electricity'],
  'Computer': ['Metal', 'Electricity'],
  'Lift': ['Metal', 'Electricity'],
  'Circuit breaker': ['Electricity'],
  'Microwave': ['Metal', 'Electricity'],
  'Mobile phone': ['Metal', 'Electricity'],
  'Train': ['Metal', 'Electricity'],
  'Speakers': ['Metal', 'Electricity'],
  'Supermarket': ['Metal', 'Electricity'],
  'Washing machine': ['Metal', 'Electricity'],
  'Metro': ['Metal', 'Electricity'],
  'Metro station': ['Electricity', 'Metal'],
  'Shop': ['Metal', 'Electricity'],
  'Kitchen': ['Metal', 'Electricity'],
  'Living room': ['Biological', 'Electricity'],
  'Train station': ['Metal', 'Electricity'],
  'Cow': ['Biological', 'Ground'],
  'Electrified fence': ['Metal', 'Electricity'],
  'River': ['Water'],
  'Tree': ['Biological'],
  'Mountain': ['Ground', 'Wind'],
  'Mycelium': ['Biological', 'Ground'],
  'Ambulance': ['Metal', 'Heat', 'Biological'],
  'Trash bin': ['Metal'],
  'Boat': ['Metal', 'Water'],
  'Bridge': ['Metal'],
  'Carriage rails': ['Metal'],
  'Roof': ['Metal'],
  'Container': ['Metal'],
  'Gate': ['Metal'],
  'Crowd': ['Biological'],
  'Guardrail': ['Metal'],
  'Lamp': ['Metal', 'Electricity'],
  'Architectonic structure': ['Metal'],
  'Street sign': ['Metal'],
  'Tram': ['Metal', 'Electricity'],
  'Fireworks': ['Heat'],
  'Harbour': ['Metal', 'Water', 'Heat'],
  'Post box': ['Metal'],
  'Car': ['Metal', 'Electricity', 'Heat'],
  'Stairs': ['Metal'],
  'Waterfall': ['Water'],
  'Rocks': ['Ground'],
  'Rod': ['Metal'],
  'Chain': ['Metal'],
  'Flag pole': ['Metal'],
}

const allEntities = [...new Set(recordings.flatMap((r) => r.entities))]

const singleElementOffsets = {}
Object.keys(elementAnchors).forEach((elName, elIndex) => {
  const members = allEntities.filter((e) => {
    const els = entityElements[e] || []
    return els.length === 1 && els[0] === elName
  })
  members.forEach((e, i) => {
    const baseAngle = elIndex * 0.9
    const angle = baseAngle + (i / Math.max(members.length, 1)) * Math.PI * 2
    const dist = members.length === 1 ? 18 : 45 + (i % 2) * 25
    singleElementOffsets[e] = { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist }
  })
})

function anchorForStatic(entity) {
  const els = entityElements[entity] || []
  if (els.length === 0) return { x: 480, y: 480 }
  if (els.length === 1) {
    const base = elementAnchors[els[0]]
    const off = singleElementOffsets[entity] || { dx: 0, dy: 0 }
    return { x: base.x + off.dx, y: base.y + off.dy }
  }
  if (els.length === 2) {
    const primary = elementAnchors[els[0]], secondary = elementAnchors[els[1]]
    return { x: primary.x * 0.65 + secondary.x * 0.35, y: primary.y * 0.65 + secondary.y * 0.35 }
  }
  const totalWeight = els.reduce((s, el) => s + 1 / elementAnchors[el].r, 0)
  return {
    x: els.reduce((s, el) => s + elementAnchors[el].x / elementAnchors[el].r, 0) / totalWeight,
    y: els.reduce((s, el) => s + elementAnchors[el].y / elementAnchors[el].r, 0) / totalWeight,
  }
}

function colorFor(entity) {
  const els = entityElements[entity] || []
  if (els.length === 0) return '#7c8a80'
  if (els.length === 1) return elementAnchors[els[0]].color
  return `url(#grad-${entity.replace(/\s+/g, '-')})`
}

function eclipseStops(colors) {
  const n = colors.length
  const segment = 100 / n
  const blend = Math.min(9, segment * 0.28)
  const stops = []
  colors.forEach((color, i) => {
    const start = i * segment
    const end = (i + 1) * segment
    stops.push({ offset: i === 0 ? 0 : start + blend, color })
    stops.push({ offset: i === n - 1 ? 100 : end - blend, color })
  })
  return stops
}

export function elementsForRecording(r) {
  const set = new Set()
  r.entities.forEach((e) => (entityElements[e] || []).forEach((el) => set.add(el)))
  return [...set]
}

function computeAnchors(selectedPath, activeElement) {
  if (activeElement) {
    const base = elementAnchors[activeElement]
    return { ...elementAnchors, [activeElement]: { ...base, r: base.r * 1.25 } }
  }
  if (selectedPath.length >= 1) {
    const ownElements = new Set()
    selectedPath.forEach((id) => (entityElements[id] || []).forEach((el) => ownElements.add(el)))
    if (ownElements.size >= 2) {
      const names = [...ownElements]
      const mid = {
        x: names.reduce((s, el) => s + elementAnchors[el].x, 0) / names.length,
        y: names.reduce((s, el) => s + elementAnchors[el].y, 0) / names.length,
      }
      const result = { ...elementAnchors }
      names.forEach((el) => {
        const base = elementAnchors[el]
        result[el] = { ...base, x: base.x * 0.4 + mid.x * 0.6, y: base.y * 0.4 + mid.y * 0.6 }
      })
      return result
    }
  }
  return elementAnchors
}

function entitiesOfElement(name) {
  return allEntities.filter((e) => (entityElements[e] || []).includes(name))
}

function buildLinks() {
  const seen = new Set()
  const links = []
  recordings.forEach((r) => {
    const ents = r.entities
    for (let i = 0; i < ents.length; i++) {
      for (let j = i + 1; j < ents.length; j++) {
        const key = [ents[i], ents[j]].sort().join('|')
        if (!seen.has(key)) {
          seen.add(key)
          links.push({ source: ents[i], target: ents[j] })
        }
      }
    }
  })
  return links
}

function connectedTo(entity) {
  const set = new Set()
  recordings.forEach((r) => {
    if (r.entities.includes(entity)) {
      r.entities.forEach((e) => { if (e !== entity) set.add(e) })
    }
  })
  return set
}

function frontierSet(path) {
  const set = new Set()
  path.forEach((p) => connectedTo(p).forEach((c) => set.add(c)))
  path.forEach((p) => set.delete(p))
  return set
}

function matchesGeneric(r, selectedPath, searchQuery) {
  const q = searchQuery.trim().toLowerCase()
  if (q) return r.title.toLowerCase().includes(q) || r.entities.some((e) => e.toLowerCase().includes(q))
  if (selectedPath.length === 0) return true
  if (selectedPath.length === 1) return r.entities.includes(selectedPath[0])
  return r.entities.filter((e) => selectedPath.includes(e)).length >= 2
}

function matchesElement(r, activeElement) {
  return r.entities.some((e) => (entityElements[e] || []).includes(activeElement))
}

export function ElementTags({ elements }) {
  return (
    <span className="element-tags">
      {elements.map((el) => (
        <span key={el} className="element-tag" style={{ color: elementAnchors[el].color }}>{el}</span>
      ))}
    </span>
  )
}

export function Waveform({ recording, isPlaying, onPlayingChange }) {
  const containerRef = useRef(null)
  const wsRef = useRef(null)
  const [activated, setActivated] = useState(false)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    if (isPlaying && !activated) setActivated(true)
  }, [isPlaying, activated])

  useEffect(() => {
    if (!activated || !containerRef.current) return
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#3a4038',
      progressColor: '#e4402a',
      cursorColor: 'transparent',
      height: 34,
      barWidth: 2,
      barGap: 1,
      url: recording.audioFile,
    })
    wsRef.current = ws
    ws.on('ready', () => {
      setRevealed(true)
      if (isPlaying) ws.play()
    })
    ws.on('play', () => onPlayingChange(true))
    ws.on('pause', () => onPlayingChange(false))
    ws.on('finish', () => onPlayingChange(false))
    return () => ws.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activated])

  useEffect(() => {
    const ws = wsRef.current
    if (!ws) return
    if (isPlaying && !ws.isPlaying()) ws.play()
    else if (!isPlaying && ws.isPlaying()) ws.pause()
  }, [isPlaying])

  return (
    <div className="waveform-slot" onClick={() => setActivated(true)}>
      <div className={'waveform-cloud' + (revealed ? ' faded' : '')}></div>
      <div ref={containerRef} className={'waveform' + (revealed ? ' revealed' : '')}></div>
    </div>
  )
}

function RelationsGraph({ selectedPath, setSelectedPath, searchQuery, setSearchQuery }) {
  const graphRef = useRef(null)
  const selsRef = useRef(null)
  const zonesRef = useRef(null)
  const simulationRef = useRef(null)
  const selectedPathRef = useRef([])
  const dynamicAnchorsRef = useRef(elementAnchors)
  const svgSelRef = useRef(null)
  const zoomBehaviorRef = useRef(null)
  const dimsRef = useRef({ width: 960, height: 700 })
  const audioRef = useRef(null)
  const [playingId, setPlayingId] = useState(null)
  const [activeElement, setActiveElement] = useState(null)

  useEffect(() => { selectedPathRef.current = selectedPath }, [selectedPath])

  function togglePlay(r) {
    const audio = audioRef.current
    if (!audio) return
    if (playingId === r.id) {
      audio.pause()
      setPlayingId(null)
    } else {
      audio.src = r.audioFile
      audio.play().catch(() => {})
      setPlayingId(r.id)
    }
  }

  // auto-play the top matching recording as the entity selection changes;
  // stop entirely when an element zone is active or nothing is selected
  useEffect(() => {
    if (activeElement || selectedPath.length === 0) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }
    const matches = recordings.filter((r) => matchesGeneric(r, selectedPath, ''))
    if (matches.length === 0) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }
    const top = matches[0]
    const audio = audioRef.current
    if (audio && audio.src.indexOf(top.audioFile) === -1) {
      audio.src = top.audioFile
      audio.play().catch(() => {})
    } else if (audio) {
      audio.play().catch(() => {})
    }
    setPlayingId(top.id)
  }, [selectedPath, activeElement])

  function toggleEntity(e) {
    setSearchQuery('')
    setActiveElement(null)
    setSelectedPath((prev) => {
      if (prev.length === 0) return [e]
      const idx = prev.indexOf(e)
      if (idx !== -1) return prev.slice(0, idx)
      const canExtend = prev.some((p) => connectedTo(p).has(e))
      if (canExtend) return [...prev, e]
      return [e]
    })
  }

  function toggleElement(name) {
    setSearchQuery('')
    setSelectedPath([])
    setActiveElement((prev) => (prev === name ? null : name))
  }

  useEffect(() => {
    d3.select(graphRef.current).selectAll('*').remove()

    const width = graphRef.current.clientWidth || 960
    const height = graphRef.current.clientHeight || 700
    dimsRef.current = { width, height }

    const nodes = allEntities.map((e) => {
      const a = anchorForStatic(e)
      return { id: e, fillRef: colorFor(e), x: a.x + (Math.random() - 0.5) * 30, y: a.y + (Math.random() - 0.5) * 30 }
    })
    const links = buildLinks()

    function anchorForceFn(alpha) {
      const anchors = dynamicAnchorsRef.current
      nodes.forEach((n) => {
        const els = entityElements[n.id] || []
        if (els.length === 0) return
        let tx, ty
        if (els.length === 1) {
          const off = singleElementOffsets[n.id] || { dx: 0, dy: 0 }
          tx = anchors[els[0]].x + off.dx; ty = anchors[els[0]].y + off.dy
        } else if (els.length === 2) {
          const primary = anchors[els[0]], secondary = anchors[els[1]]
          tx = primary.x * 0.65 + secondary.x * 0.35
          ty = primary.y * 0.65 + secondary.y * 0.35
        } else {
          const totalWeight = els.reduce((s, el) => s + 1 / anchors[el].r, 0)
          tx = els.reduce((s, el) => s + anchors[el].x / anchors[el].r, 0) / totalWeight
          ty = els.reduce((s, el) => s + anchors[el].y / anchors[el].r, 0) / totalWeight
        }
        n.vx += (tx - n.x) * 0.22 * alpha
        n.vy += (ty - n.y) * 0.22 * alpha
      })
    }

    function focusForce(alpha) {
      const sel = selectedPathRef.current
      if (sel.length === 0) return
      const selectedNodes = nodes.filter((n) => sel.includes(n.id))
      if (selectedNodes.length === 0) return
      const targetX = selectedNodes.reduce((s, n) => s + n.x, 0) / selectedNodes.length
      const targetY = selectedNodes.reduce((s, n) => s + n.y, 0) / selectedNodes.length
      const frontier = frontierSet(sel)
      nodes.forEach((n) => {
        if (sel.includes(n.id)) return
        if (frontier.has(n.id)) {
          n.vx += (targetX - n.x) * 0.05 * alpha
          n.vy += (targetY - n.y) * 0.05 * alpha
        }
      })
    }

    function driftForce() {
      nodes.forEach((n) => {
        if (n.fx != null) return
        n.vx += (Math.random() - 0.5) * 0.15
        n.vy += (Math.random() - 0.5) * 0.15
      })
    }

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d) => d.id).distance(55).strength(0.01))
      .force('charge', d3.forceManyBody().strength(-110))
      .force('collide', d3.forceCollide(28))
      .force('anchor', anchorForceFn)
      .force('focus', focusForce)
      .force('drift', driftForce)
      .velocityDecay(0.55)
      .alphaTarget(0.015)
    simulationRef.current = simulation

    const svg = d3.select(graphRef.current)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', [0, 0, width, height])
    svgSelRef.current = svg

    const g = svg.append('g')
    const defs = svg.append('defs')

    Object.entries(entityElements).forEach(([entity, els]) => {
      if (els.length >= 2) {
        const grad = defs.append('linearGradient')
          .attr('id', `grad-${entity.replace(/\s+/g, '-')}`)
          .attr('x1', '0%').attr('x2', '100%').attr('y1', '0%').attr('y2', '0%')
        eclipseStops(els.map((el) => elementAnchors[el].color)).forEach((s) => {
          grad.append('stop').attr('offset', `${s.offset}%`).attr('stop-color', s.color)
        })
      }
    })

    const haloFilter = defs.append('filter').attr('id', 'halo-blur')
      .attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%')
    haloFilter.append('feGaussianBlur').attr('stdDeviation', 26)

    const zoneGroup = g.append('g')
    const hitGroup = g.append('g')
    const zoneCircles = {}
    const zoneLabels = {}
    const zoneHits = {}
    let seed = 2
    Object.entries(elementAnchors).forEach(([name, a]) => {
      const zonegrad = defs.append('radialGradient').attr('id', `zonegrad-${name}`)
      zonegrad.append('stop').attr('offset', '0%').attr('stop-color', a.color).attr('stop-opacity', 0.95)
      zonegrad.append('stop').attr('offset', '100%').attr('stop-color', a.color).attr('stop-opacity', 0)

      const nebFilter = defs.append('filter').attr('id', `nebula-${name}`)
        .attr('x', '-100%').attr('y', '-100%').attr('width', '300%').attr('height', '300%')
      nebFilter.append('feTurbulence')
        .attr('type', 'fractalNoise').attr('baseFrequency', 0.018).attr('numOctaves', 2)
        .attr('seed', seed).attr('result', 'noise')
      nebFilter.append('feDisplacementMap')
        .attr('in', 'SourceGraphic').attr('in2', 'noise').attr('scale', 45)
      nebFilter.append('feGaussianBlur').attr('stdDeviation', 4)
      seed += 6

      const zg = zoneGroup.append('g')
        .attr('transform', `translate(${a.x},${a.y}) scale(${a.r / 100})`)
        .attr('opacity', a.tier === 'secondary' ? 0.45 : 0.65)
      zg.append('circle')
        .attr('cx', 0).attr('cy', 0).attr('r', 100)
        .attr('fill', `url(#zonegrad-${name})`)
        .attr('filter', `url(#nebula-${name})`)
      zoneCircles[name] = zg

      const lx = a.x + labelOffsets[name].dx, ly = a.y + labelOffsets[name].dy

      zoneHits[name] = hitGroup.append('circle')
        .attr('cx', lx).attr('cy', ly).attr('r', 55)
        .attr('fill', 'transparent')
        .style('pointer-events', 'all')
        .style('cursor', 'pointer')
        .on('click', () => toggleElement(name))

      zoneLabels[name] = zoneGroup.append('text')
        .attr('x', lx).attr('y', ly)
        .attr('text-anchor', 'middle')
        .attr('font-family', "'M PLUS 1mn', 'Courier New', monospace")
        .attr('font-size', a.tier === 'secondary' ? 14 : 19)
        .attr('font-weight', 'bold')
        .attr('letter-spacing', '3px')
        .attr('fill', a.color)
        .attr('opacity', a.tier === 'secondary' ? 0.6 : 1)
        .style('pointer-events', 'none')
        .text(name.toUpperCase())
    })
    zonesRef.current = { zoneCircles, zoneLabels, zoneHits }

    const zoom = d3.zoom()
      .scaleExtent([0.2, 6])
      .translateExtent([[-400, -400], [width + 400, height + 400]])
      .filter((event) => {
        if (event.type === 'wheel') return false
        return !event.ctrlKey && !event.button
      })
      .on('zoom', (event) => g.attr('transform', event.transform))
    svg.call(zoom)
    zoomBehaviorRef.current = zoom

    const xs = Object.values(elementAnchors).map((a) => a.x)
    const ys = Object.values(elementAnchors).map((a) => a.y)
    const pad = 220
    const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad
    const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad
    const fitScale = Math.min(width / (maxX - minX), height / (maxY - minY), 1.6) * 0.92
    const fitTransform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(fitScale)
      .translate(-(minX + maxX) / 2, -(minY + maxY) / 2)
    svg.call(zoom.transform, fitTransform)

    svg.on('wheel', (event) => {
      event.preventDefault()
      const t = d3.zoomTransform(svg.node())
      if (event.ctrlKey || event.metaKey) {
        const factor = Math.pow(2, -event.deltaY * 0.01)
        zoom.scaleBy(svg, factor)
      } else {
        zoom.translateBy(svg, (-event.deltaX * 1.4) / t.k, (-event.deltaY * 1.4) / t.k)
      }
    }, { passive: false })

    const linkSel = g.append('g').selectAll('line').data(links).join('line')
      .attr('stroke', '#8a9890').attr('stroke-width', 1)
      .attr('x1', (d) => d.source.x).attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x).attr('y2', (d) => d.target.y)

    const haloSel = g.append('g').selectAll('circle').data(nodes).join('circle')
      .attr('r', 14).attr('fill', (d) => d.fillRef).attr('opacity', 0.22)
      .attr('filter', 'url(#halo-blur)')
      .attr('cx', (d) => d.x).attr('cy', (d) => d.y)
      .style('pointer-events', 'none')

    const nodeSel = g.append('g').selectAll('circle').data(nodes).join('circle')
      .attr('r', 7).attr('fill', '#0e1210').attr('stroke', (d) => d.fillRef).attr('stroke-width', 1.5)
      .attr('cx', (d) => d.x).attr('cy', (d) => d.y)
      .style('cursor', 'pointer')

    const labelSel = g.append('g').selectAll('text').data(nodes).join('text')
      .text((d) => d.id)
      .attr('font-family', "'M PLUS 1mn', 'Courier New', monospace")
      .attr('font-size', 15)
      .attr('fill', '#e8e4da')
      .attr('x', (d) => d.x).attr('y', (d) => d.y)
      .attr('dx', 11).attr('dy', 4)
      .style('cursor', 'pointer')

    selsRef.current = { nodeSel, linkSel, labelSel, haloSel }

    nodeSel.on('click', (event, d) => toggleEntity(d.id))
    labelSel.on('click', (event, d) => toggleEntity(d.id))

    simulation.on('tick', () => {
      linkSel
        .attr('x1', (d) => d.source.x).attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x).attr('y2', (d) => d.target.y)
      nodeSel.attr('cx', (d) => d.x).attr('cy', (d) => d.y)
      labelSel.attr('x', (d) => d.x).attr('y', (d) => d.y)
      haloSel.attr('cx', (d) => d.x).attr('cy', (d) => d.y)
    })

    const drag = d3.drag()
      .clickDistance(6)
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.2).restart()
        d.fx = d.x; d.fy = d.y
      })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
      .on('end', (event) => {
        if (!event.active) simulation.alphaTarget(0.015)
      })
    nodeSel.call(drag)

    return () => {
      simulation.stop()
      d3.select(graphRef.current).selectAll('*').remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const anchors = computeAnchors(selectedPath, activeElement)
    dynamicAnchorsRef.current = anchors
    if (zonesRef.current) {
      const { zoneCircles, zoneLabels, zoneHits } = zonesRef.current
      Object.entries(anchors).forEach(([name, a]) => {
        zoneCircles[name].transition().duration(600).attr('transform', `translate(${a.x},${a.y}) scale(${a.r / 100})`)
        const lx = a.x + labelOffsets[name].dx, ly = a.y + labelOffsets[name].dy
        zoneLabels[name].transition().duration(600).attr('x', lx).attr('y', ly)
        zoneHits[name].transition().duration(600).attr('cx', lx).attr('cy', ly)
      })
    }
    simulationRef.current?.alpha(0.6).restart()

    if (!svgSelRef.current || !zoomBehaviorRef.current) return
    const { width, height } = dimsRef.current

    if (activeElement) {
      const a = anchors[activeElement]
      const pad = 160
      const minX = a.x - a.r - pad, maxX = a.x + a.r + pad
      const minY = a.y - a.r - pad, maxY = a.y + a.r + pad
      const scale = Math.min(width / (maxX - minX), height / (maxY - minY), 2.4) * 0.9
      const transform = d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(scale)
        .translate(-(minX + maxX) / 2, -(minY + maxY) / 2)
      svgSelRef.current.transition().duration(750).call(zoomBehaviorRef.current.transform, transform)
    } else if (selectedPath.length > 0) {
      const ownElements = new Set()
      selectedPath.forEach((id) => (entityElements[id] || []).forEach((el) => ownElements.add(el)))
      if (ownElements.size > 0) {
        const pts = [...ownElements].map((el) => anchors[el])
        const pad = 160
        const minX = Math.min(...pts.map((p) => p.x)) - pad
        const maxX = Math.max(...pts.map((p) => p.x)) + pad
        const minY = Math.min(...pts.map((p) => p.y)) - pad
        const maxY = Math.max(...pts.map((p) => p.y)) + pad
        const scale = Math.min(width / (maxX - minX), height / (maxY - minY), 2.4) * 0.9
        const transform = d3.zoomIdentity
          .translate(width / 2, height / 2)
          .scale(scale)
          .translate(-(minX + maxX) / 2, -(minY + maxY) / 2)
        svgSelRef.current.transition().duration(750).call(zoomBehaviorRef.current.transform, transform)
      }
    } else {
      const xs = Object.values(elementAnchors).map((a) => a.x)
      const ys = Object.values(elementAnchors).map((a) => a.y)
      const pad2 = 220
      const minX2 = Math.min(...xs) - pad2, maxX2 = Math.max(...xs) + pad2
      const minY2 = Math.min(...ys) - pad2, maxY2 = Math.max(...ys) + pad2
      const fitScale = Math.min(width / (maxX2 - minX2), height / (maxY2 - minY2), 1.6) * 0.92
      const fitTransform = d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(fitScale)
        .translate(-(minX2 + maxX2) / 2, -(minY2 + maxY2) / 2)
      svgSelRef.current.transition().duration(750).call(zoomBehaviorRef.current.transform, fitTransform)
    }
  }, [selectedPath, activeElement])

  useEffect(() => {
    if (!selsRef.current || !zonesRef.current) return
    const { nodeSel, linkSel, labelSel } = selsRef.current
    const { zoneCircles, zoneLabels, zoneHits } = zonesRef.current
    const q = searchQuery.trim().toLowerCase()
    const frontier = selectedPath.length > 0 ? frontierSet(selectedPath) : null
    const elementGroup = activeElement ? new Set(entitiesOfElement(activeElement)) : null

    function state(id) {
      if (q) return id.toLowerCase().includes(q) ? 'match' : 'fade'
      if (activeElement) return elementGroup.has(id) ? 'elementActive' : 'fade'
      if (selectedPath.length === 0) return 'neutral'
      if (selectedPath.includes(id)) return 'selected'
      if (frontier.has(id)) return 'connected'
      return 'fade'
    }

    nodeSel
      .attr('stroke', (d) => d.fillRef)
      .attr('stroke-width', (d) => (state(d.id) === 'connected' ? 2.5 : 1.5))
      .attr('fill', (d) => (state(d.id) === 'selected' ? '#e4402a' : '#0e1210'))
      .attr('opacity', (d) => (state(d.id) === 'fade' ? 0.35 : 1))

    labelSel
      .attr('fill', '#e8e4da')
      .attr('font-weight', (d) => (state(d.id) === 'selected' ? 'bold' : 'normal'))
      .attr('opacity', (d) => (state(d.id) === 'fade' ? 0.25 : 1))

    linkSel
      .attr('stroke', (l) => {
        const a = l.source.id ?? l.source, b = l.target.id ?? l.target
        if (activeElement) return elementGroup.has(a) && elementGroup.has(b) ? '#e8e4da' : '#8a9890'
        const bothIn = selectedPath.includes(a) && selectedPath.includes(b)
        const oneInOneFrontier = (selectedPath.includes(a) && frontier?.has(b)) || (selectedPath.includes(b) && frontier?.has(a))
        return bothIn || oneInOneFrontier ? '#e4402a' : '#8a9890'
      })
      .attr('opacity', (l) => {
        const a = l.source.id ?? l.source, b = l.target.id ?? l.target
        if (activeElement) return elementGroup.has(a) && elementGroup.has(b) ? 0.85 : 0.06
        if (selectedPath.length === 0) return 0.3
        const bothIn = selectedPath.includes(a) && selectedPath.includes(b)
        const oneInOneFrontier = (selectedPath.includes(a) && frontier?.has(b)) || (selectedPath.includes(b) && frontier?.has(a))
        return bothIn || oneInOneFrontier ? 1 : 0.05
      })

    let ownElements = new Set()
    let frontierElements = new Set()
    if (activeElement) {
      ownElements = new Set([activeElement])
      entitiesOfElement(activeElement).forEach((id) => {
        connectedTo(id).forEach((c) => (entityElements[c] || []).forEach((el) => { if (!ownElements.has(el)) frontierElements.add(el) }))
      })
    } else if (selectedPath.length > 0) {
      selectedPath.forEach((id) => (entityElements[id] || []).forEach((el) => ownElements.add(el)))
      if (frontier) frontier.forEach((id) => (entityElements[id] || []).forEach((el) => { if (!ownElements.has(el)) frontierElements.add(el) }))
    }
    const hasSelection = activeElement || selectedPath.length > 0

    Object.entries(elementAnchors).forEach(([name, a]) => {
      const isSecondary = a.tier === 'secondary'
      let opacity, labelOpacity, isVivid
      if (!hasSelection) {
        opacity = isSecondary ? 0.45 : 0.65
        labelOpacity = isSecondary ? 0.6 : 1
        isVivid = false
      } else if (ownElements.has(name)) {
        opacity = isSecondary ? 0.9 : 0.85
        labelOpacity = 1
        isVivid = true
      } else if (frontierElements.has(name)) {
        opacity = isSecondary ? 0.3 : 0.22
        labelOpacity = 0.5
        isVivid = false
      } else {
        opacity = 0.015
        labelOpacity = isSecondary ? 0.08 : 0.1
        isVivid = false
      }
      zoneCircles[name].attr('opacity', opacity)
      zoneLabels[name].attr('opacity', labelOpacity)
      if (isVivid) zoneCircles[name].raise()
    })

    Object.values(zoneHits).forEach((hit) => hit.raise())
  }, [selectedPath, activeElement, searchQuery])

  const matchedRecordings = activeElement
    ? recordings.filter((r) => matchesElement(r, activeElement))
    : selectedPath.length > 0
    ? recordings.filter((r) => matchesGeneric(r, selectedPath, ''))
    : []

  return (
    <div className="relations-layout">
      <div className="graph-wrap" ref={graphRef}></div>
      {(selectedPath.length > 0 || activeElement) && (
        <div className="relations-sidebar">
          <audio ref={audioRef} onEnded={() => setPlayingId(null)} />
          <div className="sidebar-title">{matchedRecordings.length} recording{matchedRecordings.length === 1 ? '' : 's'}</div>
          {matchedRecordings.length === 0 && (
            <div className="sidebar-empty">No recordings share all of these together yet.</div>
          )}
          {matchedRecordings.map((r) => (
            <div key={r.id} className="sidebar-rec">
              <div className="sidebar-rec-top">
                <span className="cat-tag" style={{ color: catColors[r.frequencyCategory], borderColor: catColors[r.frequencyCategory] }}>
                  {r.frequencyCategory}
                </span>
                <button className="play-btn" onClick={() => togglePlay(r)}>
                  {playingId === r.id ? '❚❚' : '▶'}
                </button>
              </div>
              <div className="sidebar-rec-title">{r.title}</div>
              <div className="sidebar-rec-meta">{r.location} · {r.date}</div>
              <ElementTags elements={elementsForRecording(r)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MomentsList({ selectedPath, setSelectedPath, searchQuery, setSearchQuery, flashId, setFlashId }) {
  const [playingId, setPlayingId] = useState(null)

  function handlePlayingChange(r, playing) {
    if (playing) setPlayingId(r.id)
    else setPlayingId((prev) => (prev === r.id ? null : prev))
  }

  function toggleEntity(e) {
    setSearchQuery('')
    setSelectedPath((prev) => {
      if (prev.length === 0) return [e]
      const idx = prev.indexOf(e)
      if (idx !== -1) return prev.slice(0, idx)
      const canExtend = prev.some((p) => connectedTo(p).has(e))
      if (canExtend) return [...prev, e]
      return [e]
    })
  }

  function jumpToTwin(twinId) {
    const el = document.getElementById('rec-' + twinId)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFlashId(twinId)
    setTimeout(() => setFlashId(null), 1000)
  }

  function chipModifier(e) {
    const q = searchQuery.trim().toLowerCase()
    if (q) return e.toLowerCase().includes(q) ? '' : 'faded'
    if (selectedPath.length === 0) return ''
    if (selectedPath.includes(e)) return 'selected'
    if (frontierSet(selectedPath).has(e)) return 'connected'
    return 'faded'
  }

  const activeFilter = selectedPath.length > 0 || searchQuery.trim() !== ''
  const sortedRecordings = activeFilter
    ? [...recordings].sort((a, b) => {
        const ma = matchesGeneric(a, selectedPath, searchQuery)
        const mb = matchesGeneric(b, selectedPath, searchQuery)
        return ma === mb ? 0 : ma ? -1 : 1
      })
    : recordings

  return (
    <div className="list">
      {sortedRecordings.map((r) => {
        const faded = activeFilter && !matchesGeneric(r, selectedPath, searchQuery)
        return (
          <div
            key={r.id}
            id={'rec-' + r.id}
            className={'rec' + (faded ? ' faded' : '') + (flashId === r.id ? ' flash' : '')}
            style={{ '--cat-color': catColors[r.frequencyCategory] }}
          >
            <div className="rec-top">
              <span className="cat-tag" style={{ color: catColors[r.frequencyCategory], borderColor: catColors[r.frequencyCategory] }}>
                {r.frequencyCategory}
              </span>
              <span>{r.micMethod} — {r.location} · {r.date}</span>
              <button className="play-btn" onClick={() => handlePlayingChange(r, playingId !== r.id)}>
                {playingId === r.id ? '❚❚' : '▶'}
              </button>
            </div>
            <div className="rec-title">{r.title}</div>
            <Waveform
              recording={r}
              isPlaying={playingId === r.id}
              onPlayingChange={(playing) => handlePlayingChange(r, playing)}
            />
            <ElementTags elements={elementsForRecording(r)} />
            <div className="rec-tags">
              {r.entities.map((e) => (
                <span key={e} className={'entity-chip ' + chipModifier(e)} onClick={() => toggleEntity(e)}>
                  {e}
                </span>
              ))}
            </div>
            {r.twinId && (
              <button className="twin-link" onClick={() => jumpToTwin(r.twinId)}>
                ⇄ hear the {recordings.find((x) => x.id === r.twinId)?.frequencyCategory.toLowerCase()} twin
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function ListView() {
  const [selectedPath, setSelectedPath] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [flashId, setFlashId] = useState(null)
  const [subView, setSubView] = useState('relations')

  function switchTab(tab) {
    setSubView(tab)
    setSelectedPath([])
    setSearchQuery('')
  }

  function handleSearchChange(value) {
    setSearchQuery(value)
    if (value.trim() !== '') setSelectedPath([])
  }

  return (
    <div className="parasonic">
      <div className="subnav">
        <button className={'subnav-tab' + (subView === 'relations' ? ' active' : '')} onClick={() => switchTab('relations')}>Relations</button>
        <button className={'subnav-tab' + (subView === 'moments' ? ' active' : '')} onClick={() => switchTab('moments')}>Moments</button>
      </div>

      <input
        className="search-input"
        type="text"
        placeholder="Search entities or recordings"
        value={searchQuery}
        onChange={(e) => handleSearchChange(e.target.value)}
      />

      {subView === 'relations' ? (
        <RelationsGraph
          selectedPath={selectedPath}
          setSelectedPath={setSelectedPath}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      ) : (
        <MomentsList
          selectedPath={selectedPath}
          setSelectedPath={setSelectedPath}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          flashId={flashId}
          setFlashId={setFlashId}
        />
      )}
    </div>
  )
}
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { recordings } from '../data/recordings'
import { catColors, elementColorMap, elementsForRecording, ElementTags, Waveform } from './ListView'
import './MapView.css'

const locationCoords = {
  'Berlin, Neukölln': [52.4809, 13.4294],
  'Berlin, Hermannplatz': [52.4867, 13.4247],
  'Berlin, Friedrichshain': [52.5158, 13.4536],
  'Berlin, Karlshorst': [52.4783, 13.5297],
  'Berlin, Landsberger Allee': [52.5316, 13.4593],
  'Berlin, Funkhaus': [52.4636, 13.4954],
  'Berlin, Warschauer': [52.5058, 13.4494],
  'Milano, Bolívar': [45.4642, 9.1900],
  'Lecco': [45.8566, 9.3931],
  'Sanremo': [43.8185, 7.7790],
  'Chamonix, Les Houches': [45.8909, 6.7997],
}

const locationSafeBearings = {
  Sanremo: [0, 25, -25, 340, 15],
}

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return hash
}

function coordSeedFor(recording) {
  return recording.twinId ? [recording.id, recording.twinId].sort()[0] : recording.id
}

function jitteredCoords(recording) {
  const base = locationCoords[recording.location]
  if (!base) return null
  const seed = coordSeedFor(recording)
  const h = Math.abs(hashString(seed))
  const bearings = locationSafeBearings[recording.location]
  const bearingDeg = bearings ? bearings[h % bearings.length] : h % 360
  const angle = bearingDeg * (Math.PI / 180)
  const dist = 0.006 + ((h % 100) / 100) * 0.01
  return [base[0] + Math.cos(angle) * dist, base[1] + Math.sin(angle) * dist]
}

// a wide, soft blend zone in the middle — each color still holds its own
// end, but they genuinely fade into one another rather than sitting apart
function mapBlendStops(colors) {
  const n = colors.length
  const segment = 100 / n
  const blend = segment * 0.45
  const stops = []
  colors.forEach((color, i) => {
    const start = i * segment
    const end = (i + 1) * segment
    stops.push({ offset: i === 0 ? 0 : start + blend, color })
    stops.push({ offset: i === n - 1 ? 100 : end - blend, color })
  })
  return stops
}

function gradientFromElementColors(colors) {
  if (colors.length === 0) return 'transparent'
  if (colors.length === 1) return `radial-gradient(circle, ${colors[0]} 0%, ${colors[0]} 30%, transparent 75%)`
  const stops = mapBlendStops(colors)
  const stopStr = stops.map((s) => `${s.color} ${s.offset}%`).join(', ')
  return `linear-gradient(90deg, ${stopStr})`
}

function detailsHtml(r) {
  return `<div class="comic-box"><div class="comic-bar">DETAILS</div><div class="comic-body"><div class="comic-line"><strong>Mic:</strong> ${r.micMethod}</div><div class="comic-line">${r.description || 'No story added yet for this recording.'}</div></div></div>`
}

export default function MapView() {
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const [selectedId, setSelectedId] = useState(null)
  const [playingId, setPlayingId] = useState(null)

  function handlePlayingChange(r, playing) {
    if (playing) setPlayingId(r.id)
    else setPlayingId((prev) => (prev === r.id ? null : prev))
  }

  useEffect(() => {
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: true,
      worldCopyJump: true,
    }).setView([49, 9], 5)
    mapRef.current = map

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)

    map.on('zoomend', () => {
      const el = mapContainerRef.current
      if (!el) return
      if (map.getZoom() >= 10) el.classList.add('zoomed-in')
      else el.classList.remove('zoomed-in')
    })
    function updateMarkerScale() {
      const el = mapContainerRef.current
      if (!el) return
      const zoom = map.getZoom()
      const scale = Math.min(1, Math.max(0.35, (zoom - 3) / 7))
      el.style.setProperty('--marker-scale', scale)
    }
    map.on('zoom', updateMarkerScale)
    updateMarkerScale()

    recordings.forEach((r) => {
      if (r.frequencyCategory === 'Infrasound' && r.twinId) return

      const coords = jitteredCoords(r)
      if (!coords) return

      const twin = r.twinId ? recordings.find((x) => x.id === r.twinId) : null
      const ringColorA = catColors[r.frequencyCategory]
      const ringColorB = twin ? catColors[twin.frequencyCategory] : ringColorA

      const cloudBg = twin
        ? `conic-gradient(${ringColorA} 0deg, ${ringColorA} 165deg, ${ringColorB} 195deg, ${ringColorB} 345deg, ${ringColorA} 360deg)`
        : `radial-gradient(circle, ${ringColorA} 0%, ${ringColorA} 20%, transparent 82%)`

      const cloudColors = elementsForRecording(r).map((el) => elementColorMap[el])
      const blendBg = gradientFromElementColors(cloudColors)
      const blendHtml = cloudColors.length > 0
        ? `<div class="element-blend" style="--blend-bg:${blendBg};"></div>`
        : ''

      const icon = L.divIcon({
        className: 'bubble-marker-wrap',
        html: `<div class="bubble-marker" style="--cloud-bg:${cloudBg}; --ring-color:${ringColorA};"><div class="bubble-inner">${blendHtml}</div></div>`,
        iconSize: [70, 70],
        iconAnchor: [35, 35],
      })
      L.marker(coords, { icon })
        .addTo(map)
        .bindPopup(detailsHtml(r), { className: 'comic-popup-wrap', maxWidth: 260 })
        .on('click', () => {
          setSelectedId(r.id)
          map.flyTo(coords, 12, { duration: 1 })
        })
    })

    return () => map.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setPlayingId(selectedId || null)
  }, [selectedId])

  const selected = recordings.find((r) => r.id === selectedId)

  return (
    <div className="map-page">
      <div className="map-canvas" ref={mapContainerRef}></div>
      {selected && (
        <div className="map-sidebar">
          <div className="sidebar-title">{selected.location}</div>
          <div className="sidebar-rec">
            <div className="sidebar-rec-top">
              <span className="cat-tag" style={{ color: catColors[selected.frequencyCategory], borderColor: catColors[selected.frequencyCategory] }}>
                {selected.frequencyCategory}
              </span>
              <button className="play-btn" onClick={() => handlePlayingChange(selected, playingId !== selected.id)}>
                {playingId === selected.id ? '❚❚' : '▶'}
              </button>
            </div>
            <div className="sidebar-rec-title">{selected.title}</div>
            <Waveform
              key={selected.id}
              recording={selected}
              isPlaying={playingId === selected.id}
              onPlayingChange={(playing) => handlePlayingChange(selected, playing)}
            />
            <div className="sidebar-rec-meta">{selected.date}</div>
            <ElementTags elements={elementsForRecording(selected)} />
          </div>
        </div>
      )}
    </div>
  )
}
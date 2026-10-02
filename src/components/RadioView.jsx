import { useState, useRef, useEffect } from 'react'
import * as Tone from 'tone'
import { recordings } from '../data/recordings'
import { allEntities, connectedTo, matchesElement, previewUrlFor } from './ListView'
import './RadioView.css'

const elementNames = ['Ground', 'Water', 'Wind', 'Metal', 'Electricity', 'Biological', 'Heat']

function recordingsForEntityStation(entityName) {
  const frontier = connectedTo(entityName)
  return recordings.filter((r) => r.entities.includes(entityName) || r.entities.some((e) => frontier.has(e)))
}
function recordingsForElementStation(elementName) {
  return recordings.filter((r) => matchesElement(r, elementName))
}

function Dial({ mode, stations, tunedStation, onTune }) {
  const scrollRef = useRef(null)
  const timeoutRef = useRef(null)
  const draggingRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragStartScrollRef = useRef(0)

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const target = container.querySelector(`[data-station="${CSS.escape(tunedStation)}"]`)
    if (target) target.scrollIntoView({ inline: 'center', behavior: 'auto', block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  function handleScroll() {
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      const container = scrollRef.current
      if (!container) return
      const center = container.scrollLeft + container.clientWidth / 2
      let closest = null
      let closestDist = Infinity
      container.querySelectorAll('.dial-station').forEach((el) => {
        const elCenter = el.offsetLeft + el.offsetWidth / 2
        const dist = Math.abs(elCenter - center)
        if (dist < closestDist) { closestDist = dist; closest = el.dataset.station }
      })
      if (closest && closest !== tunedStation) onTune(closest)
    }, 150)
  }

  function handlePointerDown(e) {
    if (e.pointerType !== 'mouse') return
    draggingRef.current = true
    dragStartXRef.current = e.clientX
    dragStartScrollRef.current = scrollRef.current.scrollLeft
    scrollRef.current.setPointerCapture(e.pointerId)
  }
  function handlePointerMove(e) {
    if (!draggingRef.current) return
    const deltaX = e.clientX - dragStartXRef.current
    scrollRef.current.scrollLeft = dragStartScrollRef.current - deltaX
    handleScroll()
  }
  function handlePointerUp() {
    draggingRef.current = false
  }

  return (
    <div className="dial-wrap">
      <div className="dial-needle"></div>
      <div
        className="dial-scroll"
        ref={scrollRef}
        onScroll={handleScroll}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div className="dial-pad"></div>
        {stations.map((s) => (
          <div key={s} className={'dial-station' + (s === tunedStation ? ' tuned' : '')} data-station={s}>
            {s.toUpperCase()}
          </div>
        ))}
        <div className="dial-pad"></div>
      </div>
    </div>
  )
}

function Fader({ value, min, max, onChange }) {
  const trackRef = useRef(null)
  const draggingRef = useRef(false)

  function updateFromClientX(clientX) {
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    onChange(min + fraction * (max - min))
  }

  function handlePointerDown(e) {
    draggingRef.current = true
    e.target.setPointerCapture(e.pointerId)
    updateFromClientX(e.clientX)
  }
  function handlePointerMove(e) {
    if (!draggingRef.current) return
    updateFromClientX(e.clientX)
  }
  function handlePointerUp() {
    draggingRef.current = false
  }

  const fraction = (value - min) / (max - min)

  return (
    <div className="fader-track" ref={trackRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
      <div className="fader-cap" style={{ left: `${fraction * 100}%` }}></div>
    </div>
  )
}

export default function RadioView() {
  const [power, setPower] = useState(false)
  const [mode, setMode] = useState('elements')
  const [tunedStation, setTunedStation] = useState(elementNames[0])
  const [volume, setVolume] = useState(0.8)

  const playerRef = useRef(null)
  const volumeNodeRef = useRef(null)
  const queueRef = useRef([])
  const lastTrackIdRef = useRef(null)
  const manualStopRef = useRef(false)
  const startedRef = useRef(false)
  const modeRef = useRef(mode)
  const stationRef = useRef(tunedStation)

  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => { stationRef.current = tunedStation }, [tunedStation])

  function buildQueue(stationName, stationMode) {
    const matches = stationMode === 'elements' ? recordingsForElementStation(stationName) : recordingsForEntityStation(stationName)
    queueRef.current = [...matches].sort(() => Math.random() - 0.5)
  }

  async function playNext() {
    if (queueRef.current.length === 0) buildQueue(stationRef.current, modeRef.current)
    if (queueRef.current.length === 0) return
    let next = queueRef.current.shift()
    if (next.id === lastTrackIdRef.current && queueRef.current.length > 0) {
      queueRef.current.push(next)
      next = queueRef.current.shift()
    }
    lastTrackIdRef.current = next.id
    await playerRef.current.load(previewUrlFor(next))
    playerRef.current.start()
  }

  async function ensureStarted() {
    if (startedRef.current) return
    await Tone.start()
    const volumeNode = new Tone.Gain(volume).toDestination()
    const player = new Tone.Player({ loop: false })
    player.connect(volumeNode)
    player.onstop = () => {
      if (manualStopRef.current) { manualStopRef.current = false; return }
      playNext()
    }
    playerRef.current = player
    volumeNodeRef.current = volumeNode
    startedRef.current = true
  }

  async function togglePower() {
    if (power) {
      manualStopRef.current = true
      playerRef.current?.stop()
      setPower(false)
    } else {
      setPower(true)
      await ensureStarted()
      buildQueue(tunedStation, mode)
      playNext()
    }
  }

  async function tuneTo(stationName) {
    setTunedStation(stationName)
    if (!power) return
    await ensureStarted()
    manualStopRef.current = true
    playerRef.current.stop()
    buildQueue(stationName, mode)
    playNext()
  }

  async function toggleMode() {
    const newMode = mode === 'elements' ? 'entities' : 'elements'
    const newStation = newMode === 'elements' ? elementNames[0] : [...allEntities].sort()[0]
    setMode(newMode)
    setTunedStation(newStation)
    if (power) {
      await ensureStarted()
      manualStopRef.current = true
      playerRef.current.stop()
      buildQueue(newStation, newMode)
      playNext()
    }
  }

  useEffect(() => {
    if (volumeNodeRef.current) volumeNodeRef.current.gain.value = volume
  }, [volume])

  useEffect(() => {
    return () => {
      manualStopRef.current = true
      playerRef.current?.dispose()
      volumeNodeRef.current?.dispose()
    }
  }, [])

  const stations = mode === 'elements' ? elementNames : [...allEntities].sort()

  return (
    <div className="radio-page">
      <div className="radio-body">
        <div className="radio-grille"></div>
        <div className="radio-display">
          <div className="radio-display-label">{power ? 'TUNED TO' : 'OFF AIR'}</div>
          <div className="radio-display-station">{power ? tunedStation.toUpperCase() : '— — —'}</div>
        </div>
        <Dial mode={mode} stations={stations} tunedStation={tunedStation} onTune={tuneTo} />
        <div className="radio-controls">
          <button className={'radio-power' + (power ? ' on' : '')} onClick={togglePower}>⏻</button>
            <Fader value={volume} min={0} max={1} onChange={setVolume} />
          <button className="radio-switch" onClick={toggleMode}>
            <span className={mode === 'entities' ? 'active' : ''}>AM</span>
            <span className={mode === 'elements' ? 'active' : ''}>FM</span>
          </button>
        </div>
      </div>
    </div>
  )
}
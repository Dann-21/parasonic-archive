import { useState, useRef, useEffect } from 'react'
import * as Tone from 'tone'
import { recordings } from '../data/recordings'
import { previewUrlFor, catColors } from './ListView'
import './MixerView.css'

const MAX_LAYERS = 4

function interleave(left, right) {
  const length = left.length + right.length
  const result = new Float32Array(length)
  let index = 0, inputIndex = 0
  while (index < length) {
    result[index++] = left[inputIndex]
    result[index++] = right[inputIndex]
    inputIndex++
  }
  return result
}

function encodeWAV(samples, sampleRate, numChannels) {
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample)
  const view = new DataView(buffer)
  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i))
  }
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * bytesPerSample, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, samples.length * bytesPerSample, true)
  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([view], { type: 'audio/wav' })
}

function audioBufferToWav(buffer) {
  const samples = buffer.numberOfChannels === 2
    ? interleave(buffer.getChannelData(0), buffer.getChannelData(1))
    : buffer.getChannelData(0)
  return encodeWAV(samples, buffer.sampleRate, buffer.numberOfChannels)
}

export function Knob({ label, value, min, max, onChange, displayValue }) {
  const draggingRef = useRef(false)
  const startYRef = useRef(0)
  const startValueRef = useRef(0)

  function handlePointerDown(e) {
    draggingRef.current = true
    startYRef.current = e.clientY
    startValueRef.current = value
    e.target.setPointerCapture(e.pointerId)
  }
  function handlePointerMove(e) {
    if (!draggingRef.current) return
    const deltaY = startYRef.current - e.clientY
    const range = max - min
    const newValue = Math.min(max, Math.max(min, startValueRef.current + (deltaY / 120) * range))
    onChange(newValue)
  }
  function handlePointerUp() {
    draggingRef.current = false
  }

  const fraction = (value - min) / (max - min)
  const angle = -135 + fraction * 270

  return (
    <div className="knob-wrap">
      <div
        className="knob"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="knob-indicator" style={{ transform: `rotate(${angle}deg)` }}></div>
      </div>
      <div className="knob-label">{label}</div>
      <div className="knob-value">{displayValue}</div>
    </div>
  )
}

function RecordingPicker({ onSelect, onClose }) {
  const [query, setQuery] = useState('')
  const filtered = recordings.filter((r) => r.title.toLowerCase().includes(query.toLowerCase()))
  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="picker-panel" onClick={(e) => e.stopPropagation()}>
        <input
          className="picker-search"
          placeholder="Search recordings"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="picker-list">
          {filtered.map((r) => (
            <div key={r.id} className="picker-item" onClick={() => onSelect(r)}>
              <span className="cat-tag" style={{ color: catColors[r.frequencyCategory], borderColor: catColors[r.frequencyCategory] }}>
                {r.frequencyCategory}
              </span>
              <span className="picker-item-title">{r.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Layer({ index, layer, onAssign, onRemove, onUpdate }) {
  const [pickerOpen, setPickerOpen] = useState(false)

  if (!layer.recording) {
    return (
      <div className="mixer-layer empty">
        <button className="add-layer-btn" onClick={() => setPickerOpen(true)}>+</button>
        {pickerOpen && (
          <RecordingPicker
            onSelect={(r) => { onAssign(index, r); setPickerOpen(false) }}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="mixer-layer filled">
      <div className="mixer-layer-header">
        <span className="cat-tag" style={{ color: catColors[layer.recording.frequencyCategory], borderColor: catColors[layer.recording.frequencyCategory] }}>
          {layer.recording.frequencyCategory}
        </span>
        <span className="mixer-layer-title">{layer.recording.title}</span>
        <button className="mixer-playbtn" onClick={() => onUpdate(index, 'playing', !layer.playing)}>
          {layer.playing ? '❚❚' : '▶'}
        </button>
        <button className="mixer-removebtn" onClick={() => onRemove(index)}>✕</button>
      </div>
            <div className="mixer-knobs">
        <Knob label="VOLUME" value={layer.volume} min={0} max={1} onChange={(v) => onUpdate(index, 'volume', v)} displayValue={`${Math.round(layer.volume * 100)}%`} />
        <Knob label="REVERB" value={layer.reverb} min={0} max={1} onChange={(v) => onUpdate(index, 'reverb', v)} displayValue={`${Math.round(layer.reverb * 100)}%`} />
        <Knob label="PHASER" value={layer.phaser} min={0} max={1} onChange={(v) => onUpdate(index, 'phaser', v)} displayValue={`${Math.round(layer.phaser * 100)}%`} />
        <div className="knob-group">
          <Knob label="DELAY" value={layer.delay} min={0} max={1} onChange={(v) => onUpdate(index, 'delay', v)} displayValue={`${Math.round(layer.delay * 100)}%`} />
          <select className="delay-character" value={layer.delayCharacter} onChange={(e) => onUpdate(index, 'delayCharacter', e.target.value)}>
            <option value="short">Short</option>
            <option value="medium">Medium</option>
            <option value="long">Long</option>
          </select>
        </div>
        <Knob label="DRIVE" value={layer.distortion} min={0} max={1} onChange={(v) => onUpdate(index, 'distortion', v)} displayValue={`${Math.round(layer.distortion * 100)}%`} />
        <Knob label="TRANSPOSE" value={layer.transpose} min={-12} max={12} onChange={(v) => onUpdate(index, 'transpose', v)} displayValue={`${layer.transpose > 0 ? '+' : ''}${layer.transpose.toFixed(0)}st`} />
        <Knob label="FILTER" value={layer.filter} min={-1} max={1} onChange={(v) => onUpdate(index, 'filter', v)} displayValue={layer.filter > -0.03 && layer.filter < 0.03 ? 'OPEN' : layer.filter > 0 ? 'HP' : 'LP'} />
      </div>
    </div>
  )
}

const defaultLayer = () => ({ recording: null, playing: false, volume: 0.8, reverb: 0, phaser: 0, delay: 0, delayCharacter: 'medium', distortion: 0, filter: 0, transpose: 0 })

export default function MixerView() {
  const [layers, setLayers] = useState(Array.from({ length: MAX_LAYERS }, defaultLayer))
  const [isRecording, setIsRecording] = useState(false)
  const chainsRef = useRef([])
  const masterRef = useRef(null)
  const mediaDestRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const startedRef = useRef(false)

  async function ensureStarted() {
    if (startedRef.current) return
    await Tone.start()
    const master = new Tone.Gain(1).toDestination()
    const mediaDest = Tone.context.rawContext.createMediaStreamDestination()
    master.connect(mediaDest)
    masterRef.current = master
    mediaDestRef.current = mediaDest
    startedRef.current = true
  }

function getOrCreateChain(index) {
  if (!chainsRef.current[index]) {
    const player = new Tone.Player({ loop: true })
    const volume = new Tone.Gain(0.8)
    const phaser = new Tone.Phaser({ frequency: 0.5, octaves: 3, baseFrequency: 350, wet: 0 })
    const delay = new Tone.FeedbackDelay({ delayTime: 0.25, feedback: 0.35, wet: 0 })
    const reverb = new Tone.Reverb({ decay: 3, wet: 0 })
    reverb.generate()
    const distortion = new Tone.Distortion({ distortion: 0.8, wet: 0 })
    const filter = new Tone.Filter({ type: 'lowpass', frequency: 20000 })
    player.chain(volume, phaser, delay, reverb, distortion, filter)
    filter.connect(masterRef.current)
    chainsRef.current[index] = { player, volume, phaser, delay, reverb, distortion, filter }
  }
  return chainsRef.current[index]
}

  async function assignRecording(index, recording) {
    await ensureStarted()
    const chain = getOrCreateChain(index)
    await chain.player.load(previewUrlFor(recording))
    setLayers((prev) => {
      const next = [...prev]
      next[index] = { ...defaultLayer(), recording }
      return next
    })
  }

  function removeRecording(index) {
    chainsRef.current[index]?.player.stop()
    setLayers((prev) => {
      const next = [...prev]
      next[index] = defaultLayer()
      return next
    })
  }

  function updateLayer(index, key, value) {
    setLayers((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [key]: value }
      return next
    })
    const chain = chainsRef.current[index]
    if (!chain) return
    if (key === 'playing') {
      if (value) chain.player.start()
      else chain.player.stop()
    } else if (key === 'volume') {
      chain.volume.gain.value = value
    } else if (key === 'reverb') {
      chain.reverb.wet.value = value
    } else if (key === 'phaser') {
      chain.phaser.wet.value = value
    } else if (key === 'delay') {
      chain.delay.wet.value = value
    } else if (key === 'transpose') {
      chain.player.playbackRate = Math.pow(2, value / 12)
    } else if (key === 'distortion') {
      chain.distortion.wet.value = value
    } else if (key === 'filter') {
      if (value > 0) {
        chain.filter.type = 'highpass'
        chain.filter.frequency.value = 20 + value * 2000
      } else {
        chain.filter.type = 'lowpass'
        chain.filter.frequency.value = 20000 + value * 18000
      }
    } else if (key === 'delayCharacter') {
      const presets = { short: [0.08, 0.2], medium: [0.25, 0.35], long: [0.5, 0.5] }
      const [time, fb] = presets[value]
      chain.delay.delayTime.value = time
      chain.delay.feedback.value = fb
    }
  }

  function stopAll() {
    chainsRef.current.forEach((chain) => chain?.player.stop())
    setLayers((prev) => prev.map((l) => ({ ...l, playing: false })))
  }

  function toggleRecording() {
    if (!mediaDestRef.current) return
    if (isRecording) {
      recorderRef.current.stop()
      setIsRecording(false)
    } else {
      chunksRef.current = []
      const recorder = new MediaRecorder(mediaDestRef.current.stream)
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' })
        const arrayBuffer = await blob.arrayBuffer()
        const audioBuffer = await Tone.context.rawContext.decodeAudioData(arrayBuffer)
        const wavBlob = audioBufferToWav(audioBuffer)
        const url = URL.createObjectURL(wavBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `parasonic-mix-${Date.now()}.wav`
        a.click()
        URL.revokeObjectURL(url)
      }
      recorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
    }
  }

  useEffect(() => {
    return () => {
      chainsRef.current.forEach((chain) => {
        chain?.player.dispose()
        chain?.volume.dispose()
        chain?.phaser.dispose()
        chain?.delay.dispose()
        chain?.reverb.dispose()
        chain?.distortion.dispose()
        chain?.filter.dispose()
      })
      masterRef.current?.dispose()
    }
  }, [])

  return (
    <div className="parasonic mixer-page">
      <div className="mixer-toolbar">
        <div className="mixer-toolbar-buttons">
          <button className="mixer-toolbar-btn" onClick={stopAll}>Stop all</button>
          <button className={'mixer-toolbar-btn record' + (isRecording ? ' active' : '')} onClick={toggleRecording}>
            {isRecording ? '⬤ Stop & download' : '⬤ Record mix'}
          </button>
        </div>
      </div>
      <div className="mixer-layers">
        {layers.map((layer, i) => (
          <Layer key={i} index={i} layer={layer} onAssign={assignRecording} onRemove={removeRecording} onUpdate={updateLayer} />
        ))}
      </div>
    </div>
  )
}
import { useState } from 'react'
import MixerView from './MixerView'
import RadioView from './RadioView'

export default function MusicView() {
  const [subView, setSubView] = useState('radio')

  return (
    <div className="parasonic">
      <div className="subnav">
        <button className={'subnav-tab' + (subView === 'radio' ? ' active' : '')} onClick={() => setSubView('radio')}>Radio</button>
        <button className={'subnav-tab' + (subView === 'mixer' ? ' active' : '')} onClick={() => setSubView('mixer')}>Live Mixer</button>
      </div>
      {subView === 'radio' ? (
        <RadioView />
      ) : (
        <MixerView />
      )}
    </div>
  )
}
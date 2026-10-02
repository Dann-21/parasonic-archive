import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import ListView from './components/ListView'
import MapView from './components/MapView'
import MixerView from './components/MixerView'
import AboutView from './components/AboutView'

function App() {
  return (
    <BrowserRouter>
      <nav>
  <NavLink to="/">List</NavLink>
  <NavLink to="/map">Map</NavLink>
  <NavLink to="/radio">Radio</NavLink>
  <NavLink to="/about">About</NavLink>
</nav>
<Routes>
  <Route path="/" element={<ListView />} />
  <Route path="/map" element={<MapView />} />
  <Route path="/radio" element={<MixerView />} />
  <Route path="/about" element={<AboutView />} />
</Routes>
    </BrowserRouter>
  )
}

export default App
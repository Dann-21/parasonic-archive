import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import ListView from './components/ListView'
import MapView from './components/MapView'

function AboutView() {
  return <h2>About</h2>
}

function App() {
  return (
    <BrowserRouter>
      <nav>
        <NavLink to="/">List</NavLink>
        <NavLink to="/map">Map</NavLink>
        <NavLink to="/about">About</NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<ListView />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/about" element={<AboutView />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
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
        <NavLink to="/">Map</NavLink>
        <NavLink to="/list">List</NavLink>
        <NavLink to="/about">About</NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<MapView />} />
        <Route path="/list" element={<ListView />} />
        <Route path="/about" element={<AboutView />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
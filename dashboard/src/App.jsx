import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Pipeline from './pages/Pipeline';
import Websites from './pages/Websites';
import Settings from './pages/Settings';
import Logs from './pages/Logs';
import MapView from './pages/Map';
import Answers from './pages/Answers';
import Analytics from './pages/Analytics';
import WhatsApp from './pages/WhatsApp';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="websites" element={<Websites />} />
          <Route path="map" element={<MapView />} />
          <Route path="answers" element={<Answers />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="whatsapp" element={<WhatsApp />} />
          <Route path="logs" element={<Logs />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

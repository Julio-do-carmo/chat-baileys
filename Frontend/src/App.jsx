import { useState } from 'react';
import Conexoes from './pages/Conexoes';
import Chat from './pages/Chat';
import '../public/style/sideBar.css';
import Contatos from './pages/contatos';

export default function App() {
  const [pagina, setPagina] = useState('chat');
  const [sidebarAberta, setSidebarAberta] = useState(true);

  return (
    <div className="d-flex">
      {/* Sidebar */}
      <div className={`sidebar ${sidebarAberta ? 'sidebar-expandida' : 'sidebar-retraida'}`}>
        <button className="btn-toggle ms-3" onClick={() => setSidebarAberta(!sidebarAberta)}>
          <i className={`bi ${sidebarAberta ? 'bi-chevron-left' : 'bi-chevron-right'}`}></i>
        </button>

        <ul className="nav flex-column mt-4 px-2">
          <li className="nav-item">
            <button
              className={`nav-link btn w-100 text-start ${pagina === 'chat' ? 'active' : ''}`}
              onClick={() => setPagina('chat')}
            >
              <i className="bi bi-chat-dots"></i> <span>Chat</span>
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link btn w-100 text-start ${pagina === 'contatos' ? 'active' : ''}`}
              onClick={() => setPagina('contatos')}
            >
              <i className="bi bi-person-lines-fill"></i> <span>Contatos</span>
            </button>
          </li>
          <li className="nav-item mb-2">
            <button
              className={`nav-link btn w-100 text-start ${pagina === 'conexoes' ? 'active' : ''}`}
              onClick={() => setPagina('conexoes')}
            >
              <i className="bi bi-qr-code-scan"></i> <span>Conexões</span>
            </button>
          </li>
        </ul>
      </div>

      {/* Conteúdo principal */}
      <div className="flex-grow-1 p-4" style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
        {pagina === 'conexoes' && <Conexoes />}
        {pagina === 'chat' && <Chat />}
        {pagina === 'contatos' && <Contatos />}
      </div>
    </div>
  );
}
import { useEffect, useState, useRef } from "react";
import axios from "axios";

export default function Contatos() {
    const [contatos, setContatos] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const observer = useRef();

    useEffect(() => {
        carregarContatos(page);
    }, [page]);

    const carregarContatos = async (pagina) => {
        const { data } = await axios.get(`http://localhost:3001/contatos?page=${pagina}&limit=20`);
        if (data.length < 20) setHasMore(false);
        setContatos((prev) => {
            const idsExistentes = new Set(prev.map(c => c.numero));
            const novos = data.filter(c => !idsExistentes.has(c.numero));
            return [...prev, ...novos];
        });
    };

    const ultimoRef = (node) => {
        if (!hasMore) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) setPage((prev) => prev + 1);
        });
        if (node) observer.current.observe(node);
    };

    return (
        <div className="p-3">
            <h2 className="mb-3">Contatos</h2>
            <ul className="list-group">
                {contatos.map((contato, i) => (
                    <li
                        key={contato.id || contato.numero || i}
                        className="list-group-item d-flex align-items-center"
                        ref={i === contatos.length - 1 ? ultimoRef : null}
                    >
                        <img
                            src={contato.foto}
                            alt="Foto"
                            className="rounded-circle me-3"
                            width="40"
                            height="40"
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = "default.png";
                            }}
                        />
                        <div>
                            <strong>{contato.nome.replace(/@s\.whatsapp\.net$/, '')}</strong>
                            <div className="text-muted small">{contato.numero}</div>
                        </div>
                    </li>
                ))}
            </ul>
            {!hasMore && <p className="text-muted mt-3">Fim da lista</p>}
        </div>
    );
}
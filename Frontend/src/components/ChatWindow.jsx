import React, { useState, useEffect, useRef } from "react";
import { Card, Form, Button, Image } from "react-bootstrap";
import axios from "axios";
import { io } from "socket.io-client";

const socket = io("http://localhost:3001");

export default function ChatWindow({ contato, onClose }) {
  const [mensagens, setMensagens] = useState([]);
  const [novaMensagem, setNovaMensagem] = useState("");
  const mensagensRef = useRef([]);
  const chatDentro = useRef(new Audio("../../public/sounds/chat-dentro.mp3"));
  const mensagensDiv = useRef(null);
  const idContato = contato.id || contato.numero;

  // Buscar histórico ao abrir o chat
  useEffect(() => {
    const carregarMensagens = async () => {
      try {
        const response = await axios.get(`http://localhost:3001/messages/${idContato}`);
        setMensagens(response.data || []);
        mensagensRef.current = response.data || [];
        scrollToBottom();
  
        // Zera mensagens não lidas ao abrir o chat
        socket.emit("zerarNaoLidas", idContato);
  
      } catch (error) {
        console.error("Erro ao carregar mensagens:", error);
      }
    };
  
    carregarMensagens();
  }, [idContato]);  

  useEffect(() => {
    const handleNovaMensagem = (data) => {
      const { contato: numero, mensagem } = data;

      // Só adiciona se for do contato atual
      if (numero === idContato) {
        const novaLista = [...mensagensRef.current, mensagem];
        mensagensRef.current = novaLista;
        setMensagens(novaLista);

        // Toca som só se for mensagem recebida
        if (mensagem.tipo === "recebida") {
          chatDentro.current.play();
        }
        
        scrollToBottom();
      }
    };

    socket.on("novaMensagem", handleNovaMensagem);

    return () => {
      socket.off("novaMensagem", handleNovaMensagem);
    };
  }, [idContato]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (mensagensDiv.current) {
        mensagensDiv.current.scrollTop = mensagensDiv.current.scrollHeight;
      }
    }, 100);
  };

  const enviarMensagem = async () => {
    if (novaMensagem.trim() === "") return;

    const texto = novaMensagem;

    try {
      await axios.post("http://localhost:3001/send-message", {
        numero: idContato,
        texto,
      });

      // A resposta já virá via socket, então não precisa atualizar manualmente
      setNovaMensagem("");
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      enviarMensagem();
    }
  };

  return (
    <Card className="shadow-sm h-100">
      <Card.Header className="d-flex align-items-center bg-white justify-content-between">
        <div className="d-flex align-items-center">
          <Button
            variant="outline-secondary"
            size="sm"
            className="me-2"
            onClick={onClose}
          >
            <i className="bi bi-arrow-left"></i>
          </Button>
          <Image
            src={contato.foto || "/images/default-avatar.png"}
            roundedCircle
            width="40"
            height="40"
            className="me-2"
          />
          <strong>{contato.nome || contato.numero}</strong>
        </div>
      </Card.Header>

      <Card.Body
        ref={mensagensDiv}
        style={{
          height: "400px",
          overflowY: "auto",
          backgroundColor: "#f0f0f0",
        }}
      >
        {mensagens.length === 0 ? (
          <div className="text-center text-muted mt-5">Nenhuma mensagem anterior</div>
        ) : (
          mensagens.map((msg, index) => (
            <div
              key={index}
              className={`d-flex flex-column ${
                msg.tipo === "enviada" ? "align-items-end" : "align-items-start"
              } mb-2`}
            >
              <div
                className={`p-2 px-3 rounded-3 ${
                  msg.tipo === "enviada" ? "bg-primary text-white" : "bg-light text-dark"
                }`}
                style={{ maxWidth: "75%" }}
              >
                <div>{msg.texto}</div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    opacity: 0.7,
                    textAlign: "right",
                  }}
                >
                  {msg.hora}
                </div>
              </div>
            </div>
          ))
        )}
      </Card.Body>

      <Card.Footer className="d-flex">
        <Form.Control
          type="text"
          placeholder="Digite uma mensagem..."
          value={novaMensagem}
          onChange={(e) => setNovaMensagem(e.target.value)}
          onKeyDown={handleKeyPress}
          className="me-2"
        />
        <Button variant="primary" onClick={enviarMensagem}>
          Enviar
        </Button>
      </Card.Footer>
    </Card>
  );
}

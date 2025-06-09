import React, { useState, useEffect, useRef } from "react";
import { Card, Button, ListGroup, Image, Badge } from "react-bootstrap";
import ChatWindow from "../components/ChatWindow";
import axios from "axios";
import io from "socket.io-client";

const socket = io("http://localhost:3001");

export default function Chat() {
  const [aguardando, setAguardando] = useState([]);
  const [atendendo, setAtendendo] = useState([]);
  const [contatoSelecionado, setContatoSelecionado] = useState(null);
  const chatForaAudio = useRef(null);

  useEffect(() => {
    chatForaAudio.current = new Audio("/sounds/chat-fora.mp3");
    chatForaAudio.current.load();

    const fetchContacts = async () => {
      try {
        const response = await axios.get("http://localhost:3001/contacts");
        setAguardando(response.data.waiting);
        setAtendendo(response.data.attending);
      } catch (error) {
        console.error("Erro ao buscar contatos:", error);
      }
    };

    fetchContacts();

    socket.on("newMessage", (contact) => {
      const isSelected = contatoSelecionado && contatoSelecionado.id === contact.id;
      if (!isSelected) playNotification();

      setAguardando((prev) => {
        const index = prev.findIndex((c) => c.id === contact.id);
        if (index !== -1) {
          const atualizados = [...prev];
          atualizados[index] = {
            ...atualizados[index],
            naoLidas: (atualizados[index].naoLidas || 0) + 1,
            hora: contact.hora,
          };
          return atualizados;
        }
        return [...prev, { ...contact, naoLidas: 1 }];
      });
    });

    socket.on("newMessageAtendendo", (contact) => {
      const isSelected = contatoSelecionado && contatoSelecionado.id === contact.id;
      if (!isSelected) playNotification();

      setAtendendo((prev) => {
        const index = prev.findIndex((c) => c.id === contact.id);
        if (index !== -1) {
          const atualizados = [...prev];
          atualizados[index] = {
            ...atualizados[index],
            naoLidas: isSelected ? 0 : (atualizados[index].naoLidas || 0) + 1,
            hora: contact.hora,
          };
          return atualizados;
        }
        return [...prev, { ...contact, naoLidas: 1 }];
      });

      // Remove da lista "aguardando" se já estiver em "atendendo"
      setAguardando((prev) => prev.filter((c) => c.id !== contact.id));
    });

    socket.on("updateContacts", ({ waiting, attending }) => {
      setAguardando(waiting);
      setAtendendo(attending);
    });

    return () => {
      socket.off("newMessage");
      socket.off("newMessageAtendendo");
      socket.off("updateContacts");
    };
  }, [contatoSelecionado]);

  const playNotification = () => {
    if (chatForaAudio.current) {
      const clone = chatForaAudio.current.cloneNode(true);
      clone.volume = 1;
      clone.play().catch((e) => {
        console.warn("Erro ao tocar som:", e);
      });
    }
  };

  const atenderContato = async (id) => {
    try {
      await axios.post("http://localhost:3001/attend-contact", { id });
      const response = await axios.get("http://localhost:3001/contacts");
      setAguardando(response.data.waiting);
      setAtendendo(response.data.attending);
    } catch (error) {
      console.error("Erro ao atender contato:", error);
    }
  };

  const finalizarContato = async (id) => {
    try {
      await axios.post("http://localhost:3001/finish-contact", { id });
    } catch (error) {
      console.error("Erro ao finalizar contato:", error);
    }
  };

  const abrirChat = (contato) => {
    // Ao abrir o chat, zera as mensagens não lidas
    const atualizar = (lista, setLista) => {
      const index = lista.findIndex((c) => c.id === contato.id);
      if (index !== -1) {
        const novaLista = [...lista];
        novaLista[index] = { ...novaLista[index], naoLidas: 0 };
        setLista(novaLista);
      }
    };
    atualizar(aguardando, setAguardando);
    atualizar(atendendo, setAtendendo);
    setContatoSelecionado(contato);
  };

  return (
    <div>
      <h2 className="h5 mb-4">
        <i className="bi bi-chat-dots me-2"></i>Atendimentos
      </h2>

      {contatoSelecionado ? (
        <ChatWindow
          contato={contatoSelecionado}
          onClose={() => setContatoSelecionado(null)}
        />
      ) : (
        <div className="row">
          {/* Atendendo */}
          <div className="col-md-6 mb-4">
            <Card className="shadow-sm h-100">
              <Card.Body>
                <Card.Title>
                  <i className="bi bi-person-lines-fill me-2"></i>Atendendo
                  <Badge bg="primary" className="ms-2">{atendendo.length}</Badge>
                </Card.Title>
                <ListGroup variant="flush">
                  {atendendo.map((contato) => (
                    <ListGroup.Item
                      key={contato.id}
                      className="d-flex align-items-center justify-content-between"
                      style={{ cursor: "pointer" }}
                      onClick={() => abrirChat(contato)}
                    >
                      <div className="d-flex align-items-center">
                        <div className="position-relative me-2">
                          <Image
                            src={contato.foto || "default-avatar.png"}
                            roundedCircle
                            width="40"
                            height="40"
                          />
                          {contato.naoLidas > 0 && (
                            <Badge
                              bg="danger"
                              pill
                              className="position-absolute top-0 start-100 translate-middle"
                            >
                              {contato.naoLidas}
                            </Badge>
                          )}
                        </div>
                        <div>
                          <strong>{contato.nome || contato.numero}</strong>
                          <div className="text-muted" style={{ fontSize: "0.8rem" }}>{contato.hora}</div>
                        </div>
                      </div>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          finalizarContato(contato.id);
                        }}
                      >
                        <i className="bi bi-x-circle"></i> Finalizar
                      </Button>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </Card.Body>
            </Card>
          </div>

          {/* Aguardando */}
          <div className="col-md-6 mb-4">
            <Card className="shadow-sm h-100">
              <Card.Body>
                <Card.Title>
                  <i className="bi bi-hourglass-split me-2"></i>Aguardando
                  <Badge bg="warning" className="ms-2">{aguardando.length}</Badge>
                </Card.Title>
                <ListGroup variant="flush">
                  {aguardando.map((contato) => (
                    <ListGroup.Item
                      key={contato.id}
                      className="d-flex align-items-center justify-content-between"
                      style={{ cursor: "pointer" }}
                      onClick={() => abrirChat(contato)}
                    >
                      <div className="d-flex align-items-center">
                        <div className="position-relative me-2">
                          <Image
                            src={contato.foto || "default-avatar.png"}
                            roundedCircle
                            width="40"
                            height="40"
                          />
                          {contato.naoLidas > 0 && (
                            <Badge
                              bg="danger"
                              pill
                              className="position-absolute top-0 start-100 translate-middle"
                            >
                              {contato.naoLidas}
                            </Badge>
                          )}
                        </div>
                        <div>
                          <strong>{contato.nome || contato.numero}</strong>
                          <div className="text-muted" style={{ fontSize: "0.8rem" }}>{contato.hora}</div>
                        </div>
                      </div>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="me-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          atenderContato(contato.id);
                        }}
                      >
                        <i className="bi bi-person-check"></i> Atender
                      </Button>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </Card.Body>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
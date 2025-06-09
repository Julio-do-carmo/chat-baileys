import { useState, useEffect } from "react";
import axios from "axios";

export default function Conexoes() {
    const [qrCode, setQrCode] = useState(null);
    const [connected, setConnected] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState("");

    const generateQRCode = async () => {
        try {
            const response = await axios.get("http://localhost:3001/generate-qr");
            if (response.data.qr) {
                setQrCode(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(response.data.qr)}`);
            } else {
                alert("QR Code ainda não disponível. Aguarde...");
            }
        } catch (error) {
            console.error("Erro ao gerar QR Code:", error);
        }
    };

    useEffect(() => {
        const checkConnection = async () => {
            try {
                const response = await axios.get("http://localhost:3001/status");
                if (response.data.connected) {
                    setConnected(true);
                    setPhoneNumber(response.data.phoneNumber.split(":")[0].replace(/@s\.whatsapp\.net$/, ""));
                }
            } catch (error) {
                console.error("Erro ao verificar conexão:", error);
            }
        };

        checkConnection();
        const interval = setInterval(checkConnection, 5000);
        return () => clearInterval(interval);
    }, []);

    const disconnect = async () => {
        try {
            await axios.get("http://localhost:3001/disconnect");
            setConnected(false);
            setPhoneNumber("");
            setQrCode(null);
        } catch (error) {
            console.error("Erro ao desconectar:", error);
        }
    };

    return (
        <div className="card shadow-sm">
            <div className="card-body text-center">
                <h2 className="h5 mb-3">
                    <i className="bi bi-qr-code-scan me-2"></i>Conectar WhatsApp
                </h2>
                {connected ? (
                    <div>
                        <i className="bi bi-wifi text-success fs-3"></i>
                        <p className="mt-2">Conectado: {phoneNumber}</p>
                        <button className="btn btn-danger" onClick={disconnect}>
                            <i className="bi bi-x-circle me-1"></i> Desconectar
                        </button>
                    </div>
                ) : (
                    <div>
                        <button className="btn btn-success" onClick={generateQRCode}>
                            <i className="bi bi-link-45deg me-1"></i> Gerar QR Code
                        </button>
                        <div className="mt-4 text-center">
                            {qrCode ? (
                                <img src={qrCode} alt="QR Code" className="img-fluid" />
                            ) : (
                                <p>QR Code aparecerá aqui após a conexão...</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
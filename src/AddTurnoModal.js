import React, { useEffect, useMemo, useState } from "react";
import moment from "moment";

const PROFESIONALES_VIERNES = ["Nati", "Seba", "Tami", "Cris"];

export default function AddTurnoModal({ open, onClose, onSave, slotInfo, esDividido, restantesPorProfesional, restantesDia }) {
  const [nombre, setNombre] = useState("");
  const [ci, setCi] = useState("");
  const [telefono, setTelefono] = useState("");
  const [notas, setNotas] = useState("");
  const [profesional, setProfesional] = useState("");

  // Reset fields whenever the modal opens/closes
  useEffect(() => {
    if (open) {
      setNombre(""); setCi(""); setTelefono(""); setNotas(""); setProfesional("");
    }
  }, [open]);

  const fechaTexto = useMemo(() => {
    if (!slotInfo) return "";
    const i = moment(slotInfo.start);
    return i.format("dddd DD/MM/YYYY HH:mm") + "–" + moment(slotInfo.end).format("HH:mm");
  }, [slotInfo]);

  const puedeGuardar = () => {
    if (!nombre || !ci || !telefono) return false;
    if (esDividido && !profesional) return false;
    return true;
  };

  const handleSave = () => {
    if (!puedeGuardar()) return;
    onSave({
      nombre: nombre.trim(),
      ci: ci.trim(),
      telefono: telefono.trim(),
      notas: (notas || "").trim(),
      profesional: esDividido ? profesional : null,
    });
    // fields are reset by effect when modal closes
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Nuevo turno</h3>
        <div className="helper">{fechaTexto}</div>

        {esDividido ? (
          <div className="capacity">
            Viernes dividido · Cupos por profesional:{" "}
            {PROFESIONALES_VIERNES.map(p => `${p}: ${restantesPorProfesional[p] ?? 0}`).join(" · ")}
          </div>
        ) : (
          <div className="capacity">Cupos del día disponibles: {restantesDia === Infinity ? "sin tope" : restantesDia}</div>
        )}

        <div style={{ marginTop: 10 }}>
          <input className="input" placeholder="Nombre y apellido" value={nombre} onChange={e => setNombre(e.target.value)} />
        </div>
        <div className="grid">
          <input className="input" placeholder="Cédula de identidad" value={ci} onChange={e => setCi(e.target.value)} />
          <input className="input" placeholder="Teléfono" value={telefono} onChange={e => setTelefono(e.target.value)} />
        </div>
        <div style={{ marginTop: 8 }}>
          <textarea className="textarea" placeholder="Notas (opcional)" value={notas} onChange={e => setNotas(e.target.value)} />
        </div>

        {esDividido && (
          <div style={{ marginTop: 8 }}>
            <select className="select" value={profesional} onChange={e => setProfesional(e.target.value)}>
              <option value="">Elegir profesional</option>
              {PROFESIONALES_VIERNES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={handleSave} disabled={!puedeGuardar()}>Guardar turno</button>
        </div>
      </div>
    </div>
  );
}
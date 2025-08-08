import React, { useMemo, useState, useEffect } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "moment/locale/es";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { db } from "./firebase-config";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  Timestamp,
  orderBy,
  query,
} from "firebase/firestore";
import AddTurnoModal from "./AddTurnoModal";

moment.locale("es");
const localizer = momentLocalizer(moment);

const FERIADOS_UY_2025 = [
  "2025-01-01",
  "2025-03-03","2025-03-04",
  "2025-04-17","2025-04-18",
  "2025-05-01",
  "2025-06-19",
  "2025-07-18",
  "2025-08-25",
  "2025-12-25",
];

const mensajesES = {
  date: "Fecha",
  time: "Hora",
  event: "Turno",
  allDay: "Todo el día",
  week: "Semana",
  work_week: "Semana laboral",
  day: "Día",
  month: "Mes",
  previous: "Anterior",
  next: "Siguiente",
  yesterday: "Ayer",
  tomorrow: "Mañana",
  today: "Hoy",
  agenda: "Agenda",
  noEventsInRange: "No hay turnos en este rango.",
  showMore: (total) => `+ Ver ${total} más`,
};

function tituloPorDia(date) {
  const d = moment(date);
  const dia = d.day();
  const semana = Math.ceil(d.date() / 7);
  if (dia === 1) return "Pie diabético";
  if (dia === 2) return "Agenda extra";
  if (dia === 3) return "Adolescentes";
  if (dia === 4) return "Diabetes tipo 2";
  if (dia === 5) {
    if (semana === 1) return "Bariátrica (10 cupos)";
    if (semana === 4) return "Reunión de equipo (no hay consulta)";
    return "Nati / Seba / Tami / Cris (5 c/u)";
  }
  return null;
}

function esFeriadoUY(date) {
  const s = moment(date).format("YYYY-MM-DD");
  return FERIADOS_UY_2025.includes(s);
}

function esDiaBloqueado(date) {
  const d = moment(date);
  const dia = d.day();
  const semana = Math.ceil(d.date() / 7);
  if (dia === 0 || dia === 6) return true; // Dom y Sáb
  if (esFeriadoUY(date)) return true;
  if (dia === 5 && semana === 4) return true;
  return false;
}

function minHora(date) { const d = new Date(date); d.setHours(8,30,0,0); return d; }
function maxHora(date) { const d = new Date(date); d.setHours(12,0,0,0); return d; }

function capacidadPorDia(date) {
  const d = moment(date);
  const dia = d.day();
  const semana = Math.ceil(d.date() / 7);
  if (dia === 1) return { tipo: "dia", limite: 10 };
  if (dia === 4) return { tipo: "dia", limite: 15 };
  if (dia === 5 && semana === 1) return { tipo: "dia", limite: 10 };
  if (dia === 5 && semana !== 1 && semana !== 4) return { tipo: "profesional", limite: 5 };
  return { tipo: "sin_tope", limite: Infinity };
}

const PROFESIONALES_VIERNES = ["Nati", "Seba", "Tami", "Cris"];

export default function App() {
  const [eventos, setEventos] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [slotInfo, setSlotInfo] = useState(null);
  const turnosRef = collection(db, "turnos");

  useEffect(() => {
    const q = query(turnosRef, orderBy("inicio", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const evs = snapshot.docs.map((docu) => {
        const data = docu.data();
        const numero = data.numero ? `${data.numero}. ` : "";
        const etiquetaProfesional = data.profesional ? ` | ${data.profesional}` : "";
        return {
          id: docu.id,
          title: `${numero}${data.nombre} | CI: ${data.ci} | Tel: ${data.telefono}${etiquetaProfesional}` + (data.notas ? ` — ${data.notas}` : ""),
          start: data.inicio.toDate(),
          end: data.fin.toDate(),
          notas: data.notas || "",
          profesional: data.profesional || null,
          numero: data.numero || null,
        };
      });
      setEventos(evs);
    });
    return () => unsub();
  }, []);

  const abrirModal = (slot) => {
    if (esDiaBloqueado(slot.start)) {
      alert("Este día está bloqueado (fin de semana, feriado o reunión).");
      return;
    }
    const inicio = moment(slot.start);
    const fin = moment(slot.end);
    if (inicio.hour() < 8 || (inicio.hour() === 8 && inicio.minute() < 30) ||
        fin.hour() > 12 || (fin.hour() === 12 && fin.minute() > 0)) {
      alert("Solo se puede agendar entre 08:30 y 12:00.");
      return;
    }
    setSlotInfo(slot);
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setSlotInfo(null);
  };

  const { esDividido, restantesDia, restantesPorProfesional, siguienteNumero } = useMemo(() => {
    if (!slotInfo) return { esDividido:false, restantesDia:0, restantesPorProfesional:{}, siguienteNumero:1 };
    const inicio = moment(slotInfo.start);
    const { tipo, limite } = capacidadPorDia(inicio.toDate());
    const delDia = eventos.filter(ev => moment(ev.start).isSame(inicio, "day"));
    const sig = delDia.length + 1;
    if (tipo === "dia") {
      return { esDividido:false, restantesDia:Math.max(0, limite - delDia.length), restantesPorProfesional:{}, siguienteNumero:sig };
    }
    if (tipo === "profesional") {
      const counts = {};
      PROFESIONALES_VIERNES.forEach(p => counts[p] = delDia.filter(ev => (ev.profesional || "") === p).length);
      const rest = {};
      PROFESIONALES_VIERNES.forEach(p => rest[p] = Math.max(0, limite - (counts[p] || 0)));
      return { esDividido:true, restantesDia:0, restantesPorProfesional:rest, siguienteNumero:sig };
    }
    return { esDividido:false, restantesDia:Infinity, restantesPorProfesional:{}, siguienteNumero:sig };
  }, [slotInfo, eventos]);

  const guardarTurno = async (payload) => {
    if (!slotInfo) return;
    const inicio = moment(slotInfo.start);
    const fin = moment(slotInfo.end);
    const { tipo, limite } = capacidadPorDia(inicio.toDate());
    const delDia = eventos.filter(ev => moment(ev.start).isSame(inicio, "day"));

    if (tipo === "dia" && delDia.length >= limite) {
      alert(`Se alcanzó el máximo de ${limite} turnos para este día.`);
      return;
    }
    if (tipo === "profesional") {
      const actuales = delDia.filter(ev => (ev.profesional || "") === payload.profesional).length;
      if (actuales >= limite) {
        alert(`${payload.profesional} ya tiene ${limite} turnos ese día.`);
        return;
      }
    }

    await addDoc(turnosRef, {
      nombre: payload.nombre,
      ci: payload.ci,
      telefono: payload.telefono,
      notas: payload.notas,
      inicio: Timestamp.fromDate(new Date(inicio)),
      fin: Timestamp.fromDate(new Date(fin)),
      profesional: payload.profesional || null,
      numero: siguienteNumero,
    });
    cerrarModal();
    setTimeout(() => alert(`Turno #${siguienteNumero} guardado ✅`), 10);
  };

  const imprimirTicket = (evento) => {
    const w = window.open("", "_blank", "width=480,height=640");
    const fecha = moment(evento.start).format("dddd DD/MM/YYYY HH:mm");
    const html = `
      <html><head><title>Ticket de turno</title>
      <style>
        body{font-family:Inter,Arial,sans-serif;padding:16px}
        .card{border:1px solid #e5e7eb;border-radius:12px;padding:16px}
        h2{margin:0 0 12px 0}
        .row{margin:6px 0}
        .muted{color:#6b7280;font-size:13px}
      </style>
      </head><body>
        <div class="card">
          <h2>Ticket de turno</h2>
          <div class="row"><strong>N°:</strong> ${evento.numero || "-"}</div>
          <div class="row"><strong>Paciente:</strong> ${evento.title.replace(/^\d+\.\s*/,'').split(' | CI:')[0]}</div>
          <div class="row"><strong>CI:</strong> ${/CI:\s([^|]+)/.exec(evento.title)?.[1] || ""}</div>
          <div class="row"><strong>Tel:</strong> ${/Tel:\s([^—]+)/.exec(evento.title)?.[1] || ""}</div>
          <div class="row"><strong>Fecha:</strong> ${fecha}</div>
          ${evento.profesional ? `<div class="row"><strong>Profesional:</strong> ${evento.profesional}</div>` : ""}
          ${evento.notas ? `<div class="row"><strong>Notas:</strong> ${evento.notas}</div>` : ""}
          <div class="row muted">Presentar este ticket al llegar al consultorio.</div>
        </div>
        <script>window.print();</script>
      </body></html>`;
    w.document.write(html);
    w.document.close();
  };

  const onSelectEvent = async (evento) => {
    const opcion = window.prompt("Escribí: IMPRIMIR para ticket, BORRAR para cancelar.", "IMPRIMIR");
    if (!opcion) return;
    const op = opcion.trim().toLowerCase();
    if (op.startsWith("impri")) {
      imprimirTicket(evento);
      return;
    }
    if (op.startsWith("borra")) {
      if (!window.confirm(\`¿Cancelar/borrar el turno de \${evento.title}?\`)) return;
      const eventoDoc = doc(db, "turnos", evento.id);
      await deleteDoc(eventoDoc);
    }
  };

  const DayHeader = ({ label, date }) => {
    const t = tituloPorDia(date);
    const esFeriado = esFeriadoUY(date);
    return (
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <strong>{label}</strong>
        {t ? <span className="daychip">{t}</span> : null}
        {esFeriado ? <span className="daychip" style={{ background:"#fee2e2", color:"#991b1b" }}>Feriado</span> : null}
      </div>
    );
  };

  return (
    <div>
      <div className="topbar">
        <div className="app-title">
          <span>📅 Agenda del consultorio</span>
          <span className="app-pill">08:30–12:00 · 15'</span>
        </div>
        <a className="btn ghost" href="#" onClick={(e)=>{e.preventDefault(); window.location.reload();}}>Actualizar</a>
      </div>

      <div className="container">
        <Calendar
          localizer={localizer}
          events={eventos}
          startAccessor="start"
          endAccessor="end"
          selectable
          step={15}
          timeslots={1}
          defaultView="week"
          min={minHora(new Date())}
          max={maxHora(new Date())}
          messages={mensajesES}
          onSelectSlot={abrirModal}
          onSelectEvent={onSelectEvent}
          components={{ dayHeader: DayHeader, event: ({ event }) => (
            <div className="event" title={event.notas ? `Notas: ${event.notas}` : ""}>{event.title}</div>
          )}}
          dayPropGetter={(date) => {
            const d = moment(date);
            const dia = d.day();
            const semana = Math.ceil(d.date()/7);
            let backgroundColor = "#ffffff";
            if (esDiaBloqueado(date)) backgroundColor = "#f1f5f9";
            else {
              if (dia === 1) backgroundColor = "#ecfdf5";
              if (dia === 3) backgroundColor = "#fffbeb";
              if (dia === 4) backgroundColor = "#eff6ff";
              if (dia === 5 && semana === 1) backgroundColor = "#fff7ed";
              if (dia === 5 && semana !== 1 && semana !== 4) backgroundColor = "#f0f9ff";
              if (dia === 5 && semana === 4) backgroundColor = "#fee2e2";
            }
            return { style: { backgroundColor } };
          }}
          style={{ height: "88vh", background:"#fff", borderRadius:12, boxShadow:"0 6px 24px rgba(2,6,23,.06)" }}
        />
      </div>

      <AddTurnoModal
        open={modalOpen}
        onClose={cerrarModal}
        onSave={guardarTurno}
        slotInfo={slotInfo}
        esDividido={(function(){
          if(!slotInfo) return false;
          const d = moment(slotInfo.start);
          const dia = d.day(); const semana = Math.ceil(d.date()/7);
          return dia === 5 && semana !== 1 && semana !== 4;
        })()}
        restantesDia={(function(){
          if(!slotInfo) return 0;
          const d = moment(slotInfo.start);
          const delDia = eventos.filter(ev => moment(ev.start).isSame(d, "day"));
          const cap = capacidadPorDia(d.toDate());
          if (cap.tipo === "dia") return Math.max(0, cap.limite - delDia.length);
          if (cap.tipo === "sin_tope") return Infinity;
          return 0;
        })()}
        restantesPorProfesional={(function(){
          if(!slotInfo) return {};
          const d = moment(slotInfo.start);
          const delDia = eventos.filter(ev => moment(ev.start).isSame(d, "day"));
          const cap = capacidadPorDia(d.toDate());
          if (cap.tipo !== "profesional") return {};
          const counts = {};
          ["Nati","Seba","Tami","Cris"].forEach(p => counts[p] = delDia.filter(ev => (ev.profesional||"")===p).length);
          const rest = {};
          ["Nati","Seba","Tami","Cris"].forEach(p => rest[p] = Math.max(0, cap.limite - (counts[p] || 0)));
          return rest;
        })()}
      />
    </div>
  );
}
import type { CSSProperties } from "react";

const featureRows = [
  {
    title: "Rooms stay visible",
    text: "Every active room shows patient, appointment type, provider, tech, notes, timer, and ready status in one shared view."
  },
  {
    title: "Setup matches your clinic",
    text: "Create your rooms, staff, color labels, timer alerts, quick notes, branding, and display preferences before opening the board."
  },
  {
    title: "Built for clinic flow",
    text: "Front desk, treatment, doctors, and techs can read the same board from a browser tab, wall display, laptop, or tablet."
  }
];

const boardDetails = [
  {
    title: "Track the whole room visit",
    text: "RoomBoard keeps the important room details together: who is in the room, why they are here, which doctor owns the case, which tech is helping, and what needs to happen next.",
    items: ["Patient and visit type", "Doctor and tech names", "Quick notes and status notes", "Room-ready and doctor-ready flags"]
  },
  {
    title: "Timers make waiting obvious",
    text: "Each active room can carry a live timer, cleaning timer, and alert colors so long waits do not disappear during a busy day.",
    items: ["Live room timers", "Cleaning timers", "Color alerts for long waits", "Sort by room or elapsed time"]
  },
  {
    title: "Display modes for real work",
    text: "Use a large card display when the team needs glanceable room status, or switch to a compact whiteboard list when you want dense room-by-room scanning.",
    items: ["Card view", "Whiteboard list view", "Only active rooms", "Doctor-focused filtering"]
  }
];

const setupSteps = [
  {
    step: "1",
    title: "Create your clinic",
    text: "Sign up with your clinic account so the board belongs to your team."
  },
  {
    step: "2",
    title: "Set up the board",
    text: "Add rooms, doctors, appointment colors, quick notes, timers, and display preferences."
  },
  {
    step: "3",
    title: "Open RoomBoard",
    text: "Launch the live board on the screens your team already uses throughout the clinic."
  }
];

const securityPoints = [
  "No public website download or source-code package",
  "Clinic login before setup and live board access",
  "Private clinic data separated by authenticated account",
  "Sensitive keys and admin logic should stay server-side"
];

const roomCards = [
  {
    room: "Room 1",
    patient: "Milo",
    type: "Limping",
    doctor: "Dr. Rivera",
    initials: "DR",
    tech: "Maya",
    note: "Waiting on radiographs",
    timer: "12:04",
    color: "#2563eb",
    ready: [true, false],
    badgeShape: "square"
  },
  {
    room: "Room 2",
    patient: "Luna",
    type: "Annual",
    doctor: "Dr. Shaw",
    initials: "JS",
    tech: "Noah",
    note: "Vaccines ready",
    timer: "04:18",
    color: "#16a34a",
    ready: [true, true],
    badgeShape: "circle"
  },
  {
    room: "Room 3",
    patient: "Cooper",
    type: "Recheck",
    doctor: "Dr. Kim",
    initials: "AK",
    tech: "Ivy",
    note: "Owner has estimate",
    timer: "00:42",
    color: "#7c3aed",
    ready: [false, true],
    badgeShape: "hexagon"
  },
  {
    room: "Room 4",
    patient: "Needs cleaning",
    type: "Discharged",
    doctor: "",
    initials: "",
    tech: "",
    note: "Wipe down table",
    timer: "02:30",
    color: "#f59e0b",
    ready: [false, false],
    badgeShape: "square",
    cleaning: true
  },
  {
    room: "Room 5",
    patient: "Nala",
    type: "Dental consult",
    doctor: "Dr. Patel",
    initials: "TP",
    tech: "Cam",
    note: "Call back after exam",
    timer: "18:36",
    color: "#dc2626",
    ready: [true, false],
    badgeShape: "star",
    alert: true
  },
  {
    room: "Room 6",
    patient: "Otis",
    type: "Tech appt",
    doctor: "Tech TC",
    initials: "TC",
    tech: "Ellis",
    note: "Nail trim",
    timer: "07:11",
    color: "#0891b2",
    ready: [true, true],
    badgeShape: "square"
  }
];

export default function HomePage() {
  return (
    <main className="landingPage">
      <div className="landingSyncPill" aria-hidden="true">✓</div>
      <header className="landingBoardHeader">
        <div className="landingBoardBar">
          <a className="landingBrandLockup" href="/" aria-label="RoomBoard home">
            <div className="landingBrandTitleRow">
              <div className="landingBrandWordmark">RoomBoard</div>
              <div className="landingPracticeBadge">DEMO CLINIC</div>
            </div>
            <small>Public overview</small>
          </a>
          <nav className="landingBoardControls" aria-label="RoomBoard actions">
            <span className="landingToggleControl">Only active <i /></span>
            <span className="landingSortControl">Sort <b>Room</b></span>
            <a href="#features">Features</a>
            <a href="#setup">Setup</a>
            <a href="/login">Login</a>
            <a className="landingSignupControl" href="/signup">Signup</a>
          </nav>
        </div>
      </header>

      <section className="landingHero">
        <div className="heroCopy">
          <h1>Know every room&apos;s status at a glance.</h1>
          <p>
            RoomBoard is a live clinic room display for veterinary teams. It shows
            which rooms are active, who is waiting, who is ready, who owns the case,
            and which rooms need cleaning or attention.
          </p>
          <div className="heroActions">
            <a className="primaryCta" href="/signup">Signup</a>
            <a className="secondaryCta" href="/login">Login</a>
          </div>
          <div className="heroProof" aria-label="RoomBoard highlights">
            <span>Live room timers</span>
            <span>Doctor initials</span>
            <span>Ready flags</span>
            <span>Cleaning status</span>
          </div>
        </div>

        <div className="landingBoardShell" aria-label="RoomBoard display preview">
          <div className="landingBoardHeaderPreview">
            <div className="landingBrandLockup previewBrand">
              <div className="landingBrandTitleRow">
                <div className="landingBrandWordmark">RoomBoard</div>
                <div className="landingPracticeBadge">NOT LOGGED IN</div>
              </div>
              <small>Ready</small>
            </div>
            <div className="landingBoardControls previewControls" aria-hidden="true">
              <span className="landingToggleControl">Only active <i /></span>
              <span className="landingSortControl">Sort <b>Room</b></span>
              <span>+</span>
              <span>▦</span>
              <span>⚙</span>
            </div>
          </div>
          <div className="previewGrid boxView">
            {roomCards.map((card) => (
              <article
                className={`previewRoom room hasDoctorBadge ${card.cleaning ? "cleaning" : ""} ${card.alert ? "timerAlertBorder" : ""}`}
                key={card.room}
                style={{ "--roomAccent": card.color } as CSSProperties}
              >
                <div className="roomTop">
                  <span className="roomName"><i className="tagDot" />{card.room}</span>
                  <span className="previewReady">
                    <span className={`r ${card.ready[0] ? "" : "off"}`}>R</span>
                    <span className={`r ${card.ready[1] ? "" : "off"}`}>D</span>
                  </span>
                </div>
                <div className="roomBody">
                  <strong className="previewPatientName">{card.patient}</strong>
                  <div className="summary roomInfoLine">
                    <span>{card.type}</span>
                    {card.doctor ? <><span className="roomInfoSep">|</span><span>{card.doctor}</span></> : null}
                  </div>
                  <div className="summary roomInfoLine muted">
                    {card.tech ? <span>Tech: {card.tech}</span> : <span>Cleaning</span>}
                    <span className="roomInfoSep">|</span>
                    <span>{card.note}</span>
                  </div>
                </div>
                {card.initials ? (
                  <span className="docInitBadge docInitCorner" data-shape={card.badgeShape}>
                    {card.initials}
                  </span>
                ) : null}
                <div className={`timerBox timerRunning ${card.cleaning ? "timerCleaning" : ""} ${card.alert ? "timerAlert2" : ""}`}>
                  <span className="muted">{card.cleaning ? "Cleaning" : "Timer"}</span>
                  <strong className={`time ${card.alert ? "timerAlert2" : ""}`}>{card.timer}</strong>
                </div>
              </article>
            ))}
          </div>
          <div className="previewWhiteboard" aria-hidden="true">
            <div className="previewWbHeader">
              <span>Room</span><span>Patient</span><span>Type</span><span>Doctor</span><span>Notes</span><span>Timer</span>
            </div>
            {roomCards.slice(0, 4).map((card) => (
              <div className={`previewWbRow ${card.cleaning ? "cleaning" : ""}`} key={`${card.room}-row`}>
                <span>{card.room}</span>
                <span>{card.patient}</span>
                <span>{card.type}</span>
                <span>{card.initials ? <b>{card.initials}</b> : "Clean"}</span>
                <span>{card.note}</span>
                <span>{card.timer}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landingWorkflow" id="features" aria-label="What RoomBoard does">
        {featureRows.map((feature) => (
          <article key={feature.title}>
            <h2>{feature.title}</h2>
            <p>{feature.text}</p>
          </article>
        ))}
      </section>

      <section className="infoBand" aria-label="RoomBoard feature details">
        <div className="sectionIntro">
          <h2>Everything your team checks between the lobby and treatment area.</h2>
          <p>
            RoomBoard replaces scattered verbal updates with one visible source of
            truth for room status, patient flow, provider ownership, and cleanup.
          </p>
        </div>
        <div className="featureMatrix">
          {boardDetails.map((detail) => (
            <article className="detailPanel" key={detail.title}>
              <h3>{detail.title}</h3>
              <p>{detail.text}</p>
              <ul>
                {detail.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="setupBand" id="setup" aria-label="How RoomBoard setup works">
        <div className="sectionIntro">
          <h2>Signup, configure, then open the board.</h2>
          <p>
            New clinics start with account access, move through setup, and then
            open the live RoomBoard display when the clinic layout is ready.
          </p>
        </div>
        <div className="setupTimeline">
          {setupSteps.map((step) => (
            <article key={step.step}>
              <span>{step.step}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="securityBand" aria-label="RoomBoard access and security">
        <div>
          <h2>Hosted access, not a public code download.</h2>
          <p>
            RoomBoard should run as a hosted website where users sign in to their
            clinic. The browser interface can be inspected like any website, so
            sensitive logic, secrets, and clinic data rules belong behind protected
            server and database boundaries.
          </p>
        </div>
        <ul>
          {securityPoints.map((point) => <li key={point}>{point}</li>)}
        </ul>
      </section>

      <section className="finalSignupBand" aria-label="Create a RoomBoard clinic">
        <h2>Ready to build your clinic board?</h2>
        <p>Create a clinic account, finish setup, then open the live RoomBoard display.</p>
        <div className="heroActions">
          <a className="primaryCta" href="/signup">Signup</a>
          <a className="secondaryCta" href="/login">Login</a>
        </div>
      </section>
    </main>
  );
}

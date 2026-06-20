import type { CSSProperties } from "react";

type DemoRoom = {
  name: string;
  patient?: string;
  type?: string;
  doctor?: string;
  timer: string;
  tone?: "green" | "pink" | "blue" | "magenta";
  badge?: string;
  badgeStyle?: "burst" | "berry" | "coin" | "leaf" | "ears";
  note?: string;
  alert?: boolean;
  warn?: boolean;
};

const sellingPoints = [
  {
    title: "See the whole floor",
    text: "Occupied rooms, empty rooms, walkback areas, discharge, comfort, car visits, cleaning, and treatment spaces stay visible at the same time."
  },
  {
    title: "Stop chasing updates",
    text: "Doctors, techs, and front desk can read the same patient status instead of asking who is waiting, where a patient is, or what needs to happen next."
  },
  {
    title: "Timers make delays obvious",
    text: "Room timers and color alerts help the team spot long waits, stalled appointments, and rooms that need attention."
  },
  {
    title: "Notes stay attached",
    text: "Quick notes keep appointment details, handoff notes, and special instructions visible on the room without opening a separate chart."
  },
  {
    title: "Built for clinic screens",
    text: "Run RoomBoard on a browser tab, lobby desk screen, treatment monitor, laptop, tablet, or wall display."
  },
  {
    title: "Setup before the board",
    text: "New clinics sign up, configure rooms and staff, then open the live board when their workflow is ready."
  }
];

const setupSteps = [
  { title: "Create clinic access", text: "Sign up or log in so each clinic has its own protected RoomBoard setup." },
  { title: "Build your room layout", text: "Add rooms, walkback spaces, doctors, techs, color labels, timer rules, and display preferences." },
  { title: "Open the live board", text: "Launch the board for the team and keep the current room flow visible all day." }
];

const securityPoints = [
  "No public website download button",
  "Hosted access through signup/login",
  "Clinic setup before opening the board",
  "Sensitive data and secrets should stay server-side",
  "Clinic data should be protected by account and database rules"
];

const demoRooms: DemoRoom[] = [
  {
    name: "Room 1",
    patient: "Lucy Long",
    type: "Exam",
    doctor: "Dr. Deaton",
    timer: "00:21:37",
    tone: "green",
    badge: "AD",
    badgeStyle: "burst",
    warn: true,
    note: "Exam, yearly exam/vaccs, new pt, kc. Checked Out, yearly exam/vaccs, new pt, kc Appt time: 9:00 AM-9:30 AM"
  },
  { name: "Room 2", timer: "00:00:00" },
  {
    name: "Room 3",
    patient: "Reese Stinnett",
    type: "Illness/Injury",
    doctor: "Dr. Berry",
    timer: "00:00:11",
    tone: "pink",
    badge: "DB",
    badgeStyle: "berry"
  },
  { name: "Room 4", timer: "00:00:00" },
  { name: "Room 5", timer: "00:00:00" },
  {
    name: "Room 6",
    patient: "Bella Ray Smith",
    type: "Exam",
    doctor: "Dr. Seibert",
    timer: "00:41:03",
    tone: "green",
    badge: "LS",
    badgeStyle: "leaf",
    alert: true
  },
  { name: "Room 7", timer: "00:00:00" },
  {
    name: "Room 8",
    patient: "Mayhem Butler",
    type: "Sx Consult",
    doctor: "Dr. Shelley",
    timer: "00:10:58",
    tone: "blue",
    badge: "AS",
    badgeStyle: "coin"
  },
  {
    name: "Room 9",
    patient: "Boomer Stallard",
    type: "Tech/Walkback",
    doctor: "TECH",
    timer: "00:01:31",
    tone: "magenta",
    badge: "TC",
    badgeStyle: "ears"
  },
  { name: "Discharge", timer: "00:00:00" },
  { name: "Comfort", timer: "00:00:00" },
  { name: "Car", timer: "00:00:00" },
  { name: "Walkback - Tx table", timer: "00:00:00" },
  { name: "Walkback - Bathroom", timer: "00:00:00" },
  { name: "Walkback - Sx", timer: "00:00:00" },
  { name: "Walkback - X-ray", timer: "00:00:00" }
];

function DemoRoomCard({ room }: { room: DemoRoom }) {
  const isActive = Boolean(room.patient);

  return (
    <article
      className={[
        "boardDemoRoom",
        isActive ? "isActive" : "isEmpty",
        room.tone ? `tone-${room.tone}` : "",
        room.alert ? "hasAlert" : "",
        room.warn ? "hasWarningTimer" : ""
      ].join(" ")}
    >
      <div className="boardDemoRoomTop">
        <h2>{room.name}</h2>
        <div className="boardDemoMiniActions" aria-hidden="true">
          <span>⌘</span>
          <span>↪</span>
          <span>▤</span>
        </div>
      </div>
      <div className="boardDemoRoomBody">
        {isActive ? (
          <>
            <div className="boardDemoPatient">
              <span>{room.patient}</span>
              <i>•</i>
              <span>{room.type}</span>
              <i>•</i>
              <span>{room.doctor}</span>
            </div>
            <button className="boardDemoNote" type="button" aria-label={`Edit ${room.name} note`}>
              📝
            </button>
            {room.note ? (
              <div className="boardDemoNotePopover">
                <strong>Notes</strong>
                <p>{room.note}</p>
              </div>
            ) : null}
          </>
        ) : (
          <div className="boardDemoEmpty">Empty</div>
        )}
        <div className="boardDemoTimer">{room.timer}</div>
        {room.badge ? (
          <span
            className={`boardDemoBadge badge-${room.badgeStyle || "coin"}`}
            style={{ "--badgeLetters": `"${room.badge}"` } as CSSProperties}
            aria-label={room.badge}
          />
        ) : null}
      </div>
    </article>
  );
}

function BoardExample() {
  return (
    <section className="boardExampleSection" aria-label="RoomBoard example board">
      <div className="boardExampleHeader">
        <a className="boardDemoBrand" href="/" aria-label="RoomBoard home">
          <span className="boardDemoLogoMark" aria-hidden="true"><span /></span>
          <span className="boardDemoBrandText">
            <strong>RoomBoard</strong>
            <small>BCAH ready.</small>
          </span>
        </a>
        <div className="boardDemoControls" aria-hidden="true">
          <span className="boardDemoToggle">Only active <i /></span>
          <span>+</span>
          <span>↗</span>
          <span>▦</span>
          <span>⚙</span>
        </div>
      </div>
      <div className="boardDemoGrid">
        {demoRooms.map((room) => <DemoRoomCard key={room.name} room={room} />)}
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <main className="landingPage landingBoardDemoPage">
      <div className="landingSyncPill" aria-hidden="true">✓</div>
      <header className="landingBoardHeader">
        <div className="landingBoardBar">
          <a className="landingBrandLockup" href="/" aria-label="RoomBoard home">
            <div className="landingBrandTitleRow">
              <div className="landingBrandWordmark">RoomBoard</div>
              <div className="landingPracticeBadge">CLINIC BOARD</div>
            </div>
            <small>Public overview</small>
          </a>
          <nav className="landingBoardControls" aria-label="RoomBoard actions">
            <a href="#features">Features</a>
            <a href="#setup">Setup</a>
            <a href="/login">Login</a>
            <a className="landingSignupControl" href="/signup">Signup</a>
          </nav>
        </div>
      </header>

      <section className="landingHero landingHeroCompact">
        <div className="heroCopy">
          <h1>A live room board for the whole clinic.</h1>
          <p>
            RoomBoard gives veterinary teams a shared display for rooms, patients,
            doctors, techs, timers, notes, and cleaning status.
          </p>
          <div className="heroActions">
            <a className="primaryCta" href="/signup">Signup</a>
            <a className="secondaryCta" href="/login">Login</a>
          </div>
        </div>
        <div className="heroSellingList" aria-label="RoomBoard highlights">
          <span>Live timers</span>
          <span>Quick notes</span>
          <span>Doctor badges</span>
          <span>Cleaning status</span>
          <span>Clinic setup</span>
        </div>
      </section>

      <BoardExample />

      <section className="infoBand" id="features" aria-label="RoomBoard selling points">
        <div className="sectionIntro">
          <h2>Built around the room board your team already understands.</h2>
          <p>
            The landing page can explain the product, but the product stays the star:
            a clear board that makes room flow obvious during a busy clinic day.
          </p>
        </div>
        <div className="featureMatrix">
          {sellingPoints.map((point) => (
            <article className="detailPanel" key={point.title}>
              <h3>{point.title}</h3>
              <p>{point.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="setupBand" id="setup" aria-label="RoomBoard setup flow">
        <div className="sectionIntro">
          <h2>From signup to live board in one flow.</h2>
          <p>
            Clinics start with account access, configure their board, then open
            the live display when setup is ready.
          </p>
        </div>
        <div className="setupTimeline">
          {setupSteps.map((step, index) => (
            <article key={step.title}>
              <span>{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="securityBand" aria-label="RoomBoard security and access">
        <div>
          <h2>Hosted access, not a public website download.</h2>
          <p>
            RoomBoard is meant to be opened through signup/login, with clinic data
            protected by account access and server/database rules.
          </p>
        </div>
        <ul>
          {securityPoints.map((point) => <li key={point}>{point}</li>)}
        </ul>
      </section>

      <section className="finalSignupBand" aria-label="Create a RoomBoard clinic">
        <h2>Ready to build your clinic board?</h2>
        <p>Create your clinic, set up your rooms, then open the live RoomBoard display.</p>
        <div className="heroActions">
          <a className="primaryCta" href="/signup">Signup</a>
          <a className="secondaryCta" href="/login">Login</a>
        </div>
      </section>
    </main>
  );
}

import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

const ADMIN_PIN = "vraki23";
const SCORE_PIN = "vrakaki23";
const STORAGE_KEY = "tichu-cup-v1";

const DEFAULT_TEAMS = [
  "Πάουλο - Κώστας Ζικ",
  "Ζιρανα - Κώστας",
  "Γιώργος G. - Νίκος Τ",
  "Σοφία G - Ιάκωβος",
  "Βασίλης Π - Μαγδαληνή",
  "Μπέλλος - Βαγγέλης",
  "Bounty - Χριστίνα",
  "Παπαδάκης - Κατσαρος",
  "Ζήσης - Σουηδός",
  "Χρήστος - Ακέφαλος",
  "Ορέστης Β. - Ορεστιος",
  "Georging - Ούζα"
].map((name, index) => ({ id: index + 1, name }));

const initialState = {
  teams: DEFAULT_TEAMS,
  stage1: [
    { id: "R1-A", team1: 1, team2: 2, score1: "", score2: "", winner: null },
    { id: "R1-B", team1: 3, team2: 4, score1: "", score2: "", winner: null },
    { id: "R1-C", team1: 5, team2: 6, score1: "", score2: "", winner: null },
    { id: "R1-D", team1: 7, team2: 8, score1: "", score2: "", winner: null },
    { id: "R1-E", team1: 9, team2: 10, score1: "", score2: "", winner: null },
    { id: "R1-F", team1: 11, team2: 12, score1: "", score2: "", winner: null }
  ],
  groups: { A: [], B: [] },
  groupMatches: [],
  semifinals: [],
  final: null,
  champion: null
};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : initialState;
  } catch {
    return initialState;
  }
}

function saveState(next) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function getTeam(state, id) {
  return state.teams.find(t => t.id === id);
}

function makeGroupMatches(groups) {
  const make = (groupName, ids) => [
    { id: `G-${groupName}-1`, group: groupName, team1: ids[0], team2: ids[1], score1: "", score2: "", winner: null },
    { id: `G-${groupName}-2`, group: groupName, team1: ids[0], team2: ids[2], score1: "", score2: "", winner: null },
    { id: `G-${groupName}-3`, group: groupName, team1: ids[1], team2: ids[2], score1: "", score2: "", winner: null }
  ];
  return [...make("A", groups.A), ...make("B", groups.B)];
}

function standingsFor(state, groupName) {
  const ids = state.groups[groupName] || [];
  const rows = ids.map(id => ({
    id,
    name: getTeam(state, id)?.name || "Unknown",
    played: 0,
    wins: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    diff: 0
  }));

  for (const match of state.groupMatches.filter(m => m.group === groupName)) {
    const a = rows.find(r => r.id === match.team1);
    const b = rows.find(r => r.id === match.team2);
    if (!a || !b || !match.winner) continue;

    const s1 = Number(match.score1 || 0);
    const s2 = Number(match.score2 || 0);

    a.played += 1;
    b.played += 1;
    a.pointsFor += s1;
    a.pointsAgainst += s2;
    b.pointsFor += s2;
    b.pointsAgainst += s1;

    if (match.winner === match.team1) a.wins += 1;
    if (match.winner === match.team2) b.wins += 1;
  }

  for (const r of rows) r.diff = r.pointsFor - r.pointsAgainst;

  return rows.sort((a, b) =>
    b.wins - a.wins ||
    b.diff - a.diff ||
    b.pointsFor - a.pointsFor ||
    a.name.localeCompare(b.name)
  );
}

function MatchCard({ state, match, onUpdate, canEditScores, compact = false }) {
  const team1 = getTeam(state, match.team1);
  const team2 = getTeam(state, match.team2);

  function patch(data) {
    onUpdate({ ...match, ...data });
  }

  return (
    <div className={`match ${match.winner ? "done" : ""}`}>
      <div className="match-id">{match.id}</div>

      <div className={`team-line ${match.winner === match.team1 ? "winner" : ""}`}>
        <span>{team1?.name || "TBD"}</span>
        <input
          disabled={!canEditScores}
          value={match.score1}
          onChange={e => patch({ score1: e.target.value })}
          placeholder="0"
        />
        {canEditScores && (
          <button onClick={() => patch({ winner: match.team1 })}>Win</button>
)}
      </div>

      <div className={`team-line ${match.winner === match.team2 ? "winner" : ""}`}>
        <span>{team2?.name || "TBD"}</span>
        <input
          disabled={!canEditScores}
          value={match.score2}
          onChange={e => patch({ score2: e.target.value })}
          placeholder="0"
        />
        {canEditScores && (
          <button onClick={() => patch({ winner: match.team2 })}>Win</button>
)}      </div>
    </div>
  );
}

function App() {
  const [state, setState] = useState(loadState);
  const [view, setView] = useState("public");
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
  async function loadFromSupabase() {
    const { data, error } = await supabase
      .from("tournament_state")
      .select("data")
      .eq("id", "main")
      .single();

    if (!error && data?.data) {
      setState(data.data);
    }
  }

  loadFromSupabase();

  const channel = supabase
    .channel("tournament-live")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "tournament_state"
      },
      payload => {
        if (payload.new?.data) {
          setState(payload.new.data);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);

 async function update(next) {
  setState(next);
  saveState(next);

  const { error } = await supabase
    .from("tournament_state")
    .upsert({
      id: "main",
      data: next,
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error("Supabase save error:", error);
  }
}

  function updateMatch(section, changed) {
    if (section === "stage1") {
      update({ ...state, stage1: state.stage1.map(m => m.id === changed.id ? changed : m) });
    }
    if (section === "groups") {
      update({ ...state, groupMatches: state.groupMatches.map(m => m.id === changed.id ? changed : m) });
    }
    if (section === "semis") {
      update({ ...state, semifinals: state.semifinals.map(m => m.id === changed.id ? changed : m) });
    }
    if (section === "final") {
      const champion = changed.winner || null;
      update({ ...state, final: changed, champion });
    }
  }

  const round1Winners = state.stage1.map(m => m.winner).filter(Boolean);
  const groupsReady = state.groups.A.length === 3 && state.groups.B.length === 3;
  const standingsA = standingsFor(state, "A");
  const standingsB = standingsFor(state, "B");

  function randomizeGroups() {
    if (round1Winners.length !== 6) {
      alert("Πρέπει πρώτα να έχεις 6 νικητές από το Round 1.");
      return;
    }
    const shuffled = [...round1Winners].sort(() => Math.random() - 0.5);
    const groups = { A: shuffled.slice(0, 3), B: shuffled.slice(3, 6) };
    update({ ...state, groups, groupMatches: makeGroupMatches(groups), semifinals: [], final: null, champion: null });
  }

  function generateSemis() {
    if (!groupsReady) return alert("Πρώτα φτιάξε τους ομίλους.");
    const allGroupMatchesDone = state.groupMatches.length === 6 && state.groupMatches.every(m => m.winner);
    if (!allGroupMatchesDone) return alert("Πρέπει να τελειώσουν όλα τα group matches.");

    const A1 = standingsA[0]?.id;
    const A2 = standingsA[1]?.id;
    const B1 = standingsB[0]?.id;
    const B2 = standingsB[1]?.id;

    update({
      ...state,
      semifinals: [
        { id: "SF-1", team1: A1, team2: B2, score1: "", score2: "", winner: null },
        { id: "SF-2", team1: B1, team2: A2, score1: "", score2: "", winner: null }
      ],
      final: null,
      champion: null
    });
  }

  function generateFinal() {
    const winners = state.semifinals.map(m => m.winner).filter(Boolean);
    if (winners.length !== 2) return alert("Πρέπει πρώτα να τελειώσουν οι ημιτελικοί.");
    update({
      ...state,
      final: { id: "FINAL", team1: winners[0], team2: winners[1], score1: "", score2: "", winner: null },
      champion: null
    });
  }

  function resetAll() {
    if (confirm("Reset όλο το tournament;")) update(initialState);
  }

  const canEditScores = view === "admin" || unlocked;
  const isAdmin = view === "admin";

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Tichu Tournament</p>
          <h1>ULTREX CUP</h1>
          <p className="sub"> TOΥΡΝΟΥΑ ΜΕ ΤΑ ΜΕΛΗ - ΙΟΥΝΙΟΣ </p>
        </div>
        <div className="top-actions">
          <button onClick={() => setView("admin-login")}>Admin</button>
          <button onClick={() => setView("score")}>Scorekeeper</button>
          {view === "admin" && (
          <button className="danger" onClick={resetAll}>Reset</button>
)}
        </div>
      </header>
      {view === "admin-login" && (
  <section className="panel pin-panel">
    <h2>Admin Access</h2>
    <input value={pin} onChange={e => setPin(e.target.value)} placeholder="Admin PIN" />
    <button
      onClick={() => {
        if (pin.trim() === ADMIN_PIN) {
          setView("admin");
          setUnlocked(true);
        }
      }}
    >
      Unlock Admin
    </button>
  </section>
)}

      {view === "score" && !unlocked && (
        <section className="panel pin-panel">
          <h2>Scorekeeper Access</h2>
          <input value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN" />
          <button
            onClick={() => {
         if (pin === SCORE_PIN) {
       setUnlocked(true);
       setView("score");
    }
  }}
>
  Unlock
</button>
          <p className="muted">Default PIN: 1234</p>
        </section>
      )}

      {(view === "public" || canEditScores) && (
        <>
          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Stage 1</p>
                <h2>Round 1 — 12 Teams</h2>
              </div>
              <span className="pill">{round1Winners.length}/6 winners</span>
            </div>
            <div className="grid">
              {state.stage1.map(match => (
              <MatchCard key={match.id} 
              state={state} match={match} 
              canEditScores={canEditScores} 
              onUpdate={m => updateMatch
              ("stage1", m)} />              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Stage 2</p>
                <h2>Group Stage — 2 Groups of 3</h2>
              </div>
              {view === "admin" && <button onClick={randomizeGroups}>GENERATE</button>}
            </div>

            {!groupsReady ? (
              <p className="muted">Όταν τελειώσει το Round 1, θα διαμορφωθούν οι ομίλοι”.</p>
            ) : (
              <>
                <div className="groups">
                  <GroupBox title="Group A" rows={standingsA} />
                  <GroupBox title="Group B" rows={standingsB} />
                </div>
                <div className="grid">
                  {state.groupMatches.map(match => (
                <MatchCard
                  key={match.id}
                  state={state}
                  match={match}
                  canEditScores={canEditScores}
                  onUpdate={m => updateMatch("groups", m)}
                />                ))}
                </div>
              </>
            )}
          </section>

          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Stage 3</p>
                <h2>Finals</h2>
              </div>
              <div className="mini-actions">
                {view === "admin" && <button onClick={generateSemis}>Generate Semifinals</button>}
                {view === "admin" && <button onClick={generateFinal}>Generate Final</button>}
              </div>
            </div>
          {state.semifinals.length > 0 ? (
            <div className="grid finals">
              {state.semifinals.map(match => (
                <MatchCard
                  key={match.id}
                  state={state}
                  match={match}
                  canEditScores={canEditScores}
                  onUpdate={m => updateMatch("semis", m)}
                />
              ))}
            </div>
          ) : (
            <p className="muted">Top 2 από κάθε όμιλο πάνε ημιτελικά: A1 vs B2 και B1 vs A2.</p>
          )}

          {state.final && (
  <div className="final-box">
    <h3>Final</h3>
    <MatchCard
      state={state}
      match={state.final}
      canEditScores={canEditScores}
      onUpdate={m => updateMatch("final", m)}
    />
  </div>
)}

            {state.champion && (
              <div className="champion">
                🏆 Champion: {getTeam(state, state.champion)?.name}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function GroupBox({ title, rows }) {
  return (
    <div className="group-box">
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>
            <th>Team</th>
            <th>W</th>
            <th>Diff</th>
            <th>PF</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className={i < 2 ? "qualifies" : ""}>
              <td>{i + 1}. {r.name}</td>
              <td>{r.wins}</td>
              <td>{r.diff}</td>
              <td>{r.pointsFor}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;

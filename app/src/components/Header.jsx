import logo from '../assets/logo.png'

/** Teams see their name + credit; hosts (no team) see `staffLabel` instead. */
export default function Header({ team, staffLabel, onLogout, onHome, onAdmin, onHost }) {
  return (
    <header className="header">
      <button className="logo-btn" onClick={onHome} aria-label="Main menu" disabled={!onHome}>
        <img src={logo} alt="The Squad Games" className="logo" />
      </button>
      <div className="team-info">
        {team ? (
          <>
            <div className="team-name">{team.teamName}</div>
            <div className="credit" aria-label="Current credit">
              <span className="credit-value">{team.credit}</span> fc
            </div>
          </>
        ) : (
          <div className="team-name">{staffLabel}</div>
        )}
        {onHost && <button className="btn small" onClick={onHost}>Host</button>}
        {onAdmin && <button className="btn small" onClick={onAdmin}>Admin</button>}
        <button className="link" onClick={onLogout}>Log out</button>
      </div>
    </header>
  )
}

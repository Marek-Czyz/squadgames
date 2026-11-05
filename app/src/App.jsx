import { onAuthStateChanged, signOut } from 'firebase/auth'
import { onSnapshot } from 'firebase/firestore'
import { useEffect, useRef, useState } from 'react'
import AdminPanel from './components/AdminPanel.jsx'
import Header from './components/Header.jsx'
import HostPanel from './components/HostPanel.jsx'
import Login from './components/Login.jsx'
import Menu from './components/Menu.jsx'
import Scoreboard from './components/Scoreboard.jsx'
import TeamSetup from './components/TeamSetup.jsx'
import { POSTS } from './posts.js'
import { auth } from './firebase.js'
import { useFreshTeams } from './lib/fresh.js'
import { loadRoles, syncScore, teamRef } from './lib/game.js'

function StaffSection({ eyebrow, title, onBack, children }) {
  return (
    <section className="post">
      {onBack && <button className="back" onClick={onBack}>← Back</button>}
      <div className="post-head">
        <span className="badge">★</span>
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
      </div>
      {children}
    </section>
  )
}

export default function App() {
  const [user, setUser] = useState(undefined) // undefined = still loading
  const [teamSnap, setTeamSnap] = useState({ uid: null, data: undefined })
  const [roles, setRoles] = useState({ uid: null, admin: false, host: false })
  const [postId, setPostId] = useState(null) // 1-5, 'admin', 'host' or null (main menu)
  const synced = useRef(null) // uid whose scoreboard entry was refreshed this session
  const [listenKey, setListenKey] = useState(0) // bumped to re-open the live team listener after an error
  const freshest = useFreshTeams()

  useEffect(() => onAuthStateChanged(auth, setUser), [])

  useEffect(() => {
    if (!user) return
    loadRoles(user.uid).then(
      (r) => setRoles({ uid: user.uid, ...r }),
      () => setRoles({ uid: user.uid, admin: false, host: false }),
    )
  }, [user])

  useEffect(() => {
    if (!user) return
    return onSnapshot(teamRef(user.uid), (snap) => {
      // 'estimate' fills in pending server timestamps (e.g. the guess countdown) right away
      const data = snap.exists() ? snap.data({ serverTimestamps: 'estimate' }) : null
      setTeamSnap({ uid: user.uid, data })
      // Teams created before the public scoreboard existed get their entry on first login
      if (data && !snap.metadata.hasPendingWrites && synced.current !== user.uid) {
        synced.current = user.uid
        syncScore(user.uid, data).catch(() => {})
      }
    }, (err) => {
      // A broken listener would leave the screen frozen: open a new one shortly
      console.warn('team listener failed, reconnecting', err)
      setTimeout(() => setListenKey((k) => k + 1), 2000)
    })
  }, [user, listenKey])

  const rolesLoaded = Boolean(user) && roles.uid === user.uid
  // undefined = still loading, null = no team doc yet (first login)
  const snapTeam = user && teamSnap.uid === user.uid ? teamSnap.data : undefined
  const team = snapTeam ? freshest(user.uid, snapTeam) : snapTeam
  const logout = () => { setPostId(null); signOut(auth) }

  if (user === undefined || (user && (team === undefined || !rolesLoaded))) {
    return <div className="screen center"><div className="spinner" /></div>
  }
  if (!user) return <Login />

  // Hosts have no team: they only get the host panel (plus the scoreboard)
  if (roles.host && !roles.admin && !team) {
    return (
      <div className="screen app">
        <Header staffLabel={`Host · ${user.email}`} onLogout={logout} />
        <main className="main">
          <StaffSection eyebrow="Host" title="Award fc">
            <HostPanel />
          </StaffSection>
          <Scoreboard />
        </main>
      </div>
    )
  }
  if (team === null) return <TeamSetup user={user} />

  const post = POSTS.find((p) => p.id === postId)
  const PostView = post?.component
  const home = () => setPostId(null)

  return (
    <div className="screen app">
      <Header
        team={team}
        onLogout={logout}
        onHome={home}
        onAdmin={roles.admin ? () => setPostId('admin') : null}
        onHost={roles.admin || roles.host ? () => setPostId('host') : null}
      />
      <main className="main">
        {postId === 'admin' && roles.admin ? (
          <StaffSection eyebrow="Admin" title="Game control" onBack={home}>
            <AdminPanel uid={user.uid} />
          </StaffSection>
        ) : postId === 'host' && (roles.admin || roles.host) ? (
          <StaffSection eyebrow="Host" title="Award fc" onBack={home}>
            <HostPanel />
          </StaffSection>
        ) : post ? (
          <section className="post">
            <button className="back" onClick={home}>← Back</button>
            <div className="post-head" style={{ '--accent': post.accent }}>
              <span className="badge">{post.id}</span>
              <div>
                <p className="eyebrow">Post {post.id}</p>
                <h1>{post.title}</h1>
              </div>
            </div>
            <PostView uid={user.uid} team={team} post={post} />
          </section>
        ) : (
          <Menu uid={user.uid} team={team} onOpen={setPostId} />
        )}
      </main>
    </div>
  )
}

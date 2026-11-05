export default function Feedback({ msg }) {
  if (!msg) return null
  return <p className={`msg ${msg.kind}`} role="status">{msg.text}</p>
}

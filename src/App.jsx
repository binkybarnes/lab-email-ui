import AsciiBackground from './components/AsciiBackground'

export default function App() {
  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fa', position: 'relative' }}>
      <AsciiBackground />
      <div style={{ position: 'relative', zIndex: 10, padding: 40, color: '#0f172a' }}>
        Background texture test — chars should be very dim
      </div>
    </div>
  )
}

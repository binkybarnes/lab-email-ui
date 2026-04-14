export default function LoginScreen({ onSignIn }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: '#13151a' }}
    >
      <div
        className="flex flex-col items-center gap-6 p-10"
        style={{
          border: '1px solid #363b47',
          borderRadius: '5px',
          background: '#1e2128',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        <span className="text-xs text-muted tracking-widest uppercase">Lab Emailer</span>
        <h1 className="text-lg font-semibold text-primary font-serif">UCSD Lab Browser</h1>
        <button
          onClick={onSignIn}
          className="text-xs px-5 py-2 transition-all"
          style={{ background: '#4d6dff', color: '#fff', borderRadius: '3px' }}
          onMouseEnter={e => e.currentTarget.style.background = '#3d5df0'}
          onMouseLeave={e => e.currentTarget.style.background = '#4d6dff'}
        >
          Sign in with Google
        </button>
        <p className="text-xs text-muted">Use your @ucsd.edu account</p>
      </div>
    </div>
  )
}

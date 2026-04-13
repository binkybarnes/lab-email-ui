import { useEffect, useRef } from 'react'

const CHARS = '[]{}|/\\.,;:01ABCDEF<>-+~'
const CHAR_COUNT = 120
// Very dim on white — this is a texture, not a statement
const CHAR_COLOR = 'rgba(15, 23, 42, 0.045)'

function randomBetween(min, max) {
  return Math.random() * (max - min) + min
}

function makeParticle(w, h, initialPlace = false) {
  return {
    x: randomBetween(0, w),
    y: initialPlace ? randomBetween(0, h) : h + 20,
    char: CHARS[Math.floor(Math.random() * CHARS.length)],
    size: randomBetween(10, 13),
    speed: randomBetween(0.25, 0.8),
    drift: randomBetween(-0.12, 0.12),
  }
}

export default function AsciiBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animId

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Seed particles spread across the screen on load
    const particles = Array.from({ length: CHAR_COUNT }, () =>
      makeParticle(canvas.width, canvas.height, true)
    )

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = CHAR_COLOR
      particles.forEach(p => {
        ctx.font = `${p.size}px 'DM Mono', monospace`
        ctx.fillText(p.char, p.x, p.y)
        p.y -= p.speed
        p.x += p.drift
        if (p.y < -20) {
          Object.assign(p, makeParticle(canvas.width, canvas.height))
        }
      })
      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}

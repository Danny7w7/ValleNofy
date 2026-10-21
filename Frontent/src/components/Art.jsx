import { useId } from 'react'

export function BrandMark({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="23" r="20" fill="currentColor" opacity=".13" />
      <path d="M9 32V18l8 3 14-5 8 3v14l-8-3-14 5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M21 21v10m5-12v10m5-11v10M13 23v5m22-4v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M17 10l-1-3m8 2V5m7 6 2-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function Accordion({ x = 0, y = 0, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M18 31Q-3 9 6-4Q13-12 30 5M184 24q26-30 32-14t-18 47" fill="none" stroke="#e6b568" strokeWidth="7" opacity=".7" />
      <path d="m48 10 101-15 6 128-103-12Z" fill="#173335" stroke="#dfac65" strokeWidth="2" />
      {Array.from({ length: 11 }, (_, i) => (
        <path key={i} d={`m${52 + i * 9} ${9 - i * 1.4} 3 105`} stroke={i % 2 ? '#688778' : '#edc28a'} strokeWidth="3" />
      ))}
      <path d="m9 9 35-4 6 112-35 5Q2 73 9 9Z" fill="#df7861" stroke="#f2c68c" strokeWidth="2" />
      <path d="m151-7 37 9 7 111-37 14Z" fill="#e8c997" stroke="#f8dfb4" strokeWidth="2" />
      {Array.from({ length: 7 }, (_, i) => (
        <g key={i} transform={`translate(0 ${i * 13})`}>
          <path d="m154 5 33 6m-32 6 32 6" stroke="#33413a" strokeWidth="1.2" />
          <path d="m155 9 19 4 1 6-20-4Z" fill="#27322c" />
        </g>
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <g key={i} fill="#f8dfb4"><circle cx="20" cy={23 + i * 14} r="3" /><circle cx="33" cy={28 + i * 14} r="3" /></g>
      ))}
      <path d="m13 115 34-5m111 9 35-12" stroke="#a45b43" strokeWidth="5" />
    </g>
  )
}

export function CoastalArt({ className = '', compact = false }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg className={`coastal-art ${className}`} viewBox="0 0 440 430" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-sky`} x1="220" y1="35" x2="220" y2="390" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e8b46d" /><stop offset="1" stopColor="#bd6048" />
        </linearGradient>
        <clipPath id={`${id}-arch`}><path d="M48 387V193a172 172 0 0 1 344 0v194Z" /></clipPath>
      </defs>
      <path d="M35 392V193a185 185 0 0 1 370 0v199" stroke="#b69765" opacity=".28" />
      <g clipPath={`url(#${id}-arch)`}>
        <path d="M48 387V193a172 172 0 0 1 344 0v194Z" fill={`url(#${id}-sky)`} />
        <circle cx="235" cy="162" r="73" fill="#f9dda0" />
        <path d="m30 285 83-95 45 39 47-47 73 83 61-56 82 80v110H30Z" fill="#49645a" />
        <path d="m24 307 92-62 70 41 72-35 58 36 104-36v157H24Z" fill="#2f4b45" />
        <path d="M39 329q110-40 188-3t180-13v99H39Z" fill="#153b39" />
        <path d="M63 351q61-18 106-3m111 5q45 14 101-5M84 373q89-22 141 0m72 9q41-13 75-6" stroke="#d8b877" opacity=".32" strokeWidth="2" strokeLinecap="round" />
        <path d="M348 317q-12-83 3-150" stroke="#203c32" strokeWidth="8" />
        <path d="M352 170q-52-23-66-1 35-6 66 1m0 0q-23-52-46-44 32 18 46 44m0 0q9-50 34-44-24 22-34 44m0 0q45-29 66-5-35-6-66 5m0 0q39 2 45 32-23-18-45-32" fill="#203c32" />
        <path d="M78 292q8-44-4-78" stroke="#203c32" strokeWidth="5" />
        <path d="M74 215q-37-18-49 1 26-7 49-1m0 0q-3-34-23-30 14 9 23 30m0 0q30-32 45-14-27-1-45 14m0 0q34 1 39 22-25-16-39-22" fill="#203c32" />
      </g>
      <ellipse cx="220" cy="373" rx="126" ry="16" fill="#101e1b" opacity=".6" />
      <g transform="rotate(-12 220 275)"><Accordion x={112} y={220} scale={1.08} /></g>
      <path d="m103 150-8-9m4 22H86m36-28-1-13M331 96l4-12m8 23 12-2" stroke="#f6d692" strokeWidth="2" strokeLinecap="round" />
      {!compact && <g fill="#dbaf70" opacity=".7"><circle cx="28" cy="240" r="2.5" /><circle cx="410" cy="275" r="2.5" /><path d="m32 102 3 7 7 3-7 3-3 7-3-7-7-3 7-3Zm378 30 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" /></g>}
    </svg>
  )
}

const palettes = [
  ['#a95f47', '#f3c783', '#273e37'],
  ['#446a61', '#e8c78c', '#1d3431'],
  ['#8a643a', '#f1bd65', '#283d36'],
  ['#625376', '#d5a680', '#292b3b'],
  ['#49717a', '#e5c38c', '#1d393c'],
]

export function SongArt({ song, large = false, className = '' }) {
  const id = useId().replace(/:/g, '')
  const hash = [...String(song.id)].reduce((value, letter) => value + letter.charCodeAt(0), 0)
  const [base, sun, dark] = palettes[hash % palettes.length]
  const color = /^#[0-9a-f]{3,8}$/i.test(song.art_color || '') ? song.art_color : base
  return (
    <div className={`song-art ${large ? 'song-art-large' : ''} ${className}`} style={{ '--art-color': color }} aria-hidden="true">
      <svg viewBox="0 0 320 320" fill="none">
        <defs>
          <linearGradient id={`${id}-cover`} x1="160" y1="0" x2="160" y2="320" gradientUnits="userSpaceOnUse"><stop stopColor={color} /><stop offset="1" stopColor={dark} /></linearGradient>
          <pattern id={`${id}-lines`} width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 0v7" stroke="#fff" strokeOpacity=".035" /></pattern>
        </defs>
        <path fill={`url(#${id}-cover)`} d="M0 0h320v320H0z" />
        <circle cx="160" cy="139" r="91" stroke={sun} opacity=".2" />
        <circle cx="160" cy="139" r="78" fill={sun} />
        <path d="m-10 219 64-59 54 39 56-39 68 60 43-29 56 44v95H-10Z" fill={dark} opacity=".9" />
        <path d="M0 267q78-43 162-3t158-1v57H0Z" fill={dark} />
        <g transform="rotate(-13 160 175)"><Accordion x={83} y={134} scale={0.73} /></g>
        <path d="M24 26h31M24 26v31m272-31h-31m31 0v31M24 294h31m-31 0v-31m272 31h-31m31 0v-31" stroke={sun} opacity=".45" />
        <path d="M0 0h320v320H0z" fill={`url(#${id}-lines)`} />
      </svg>
      {large && <><span className="cover-label">DE LA TIERRA<br />AL CORAZÓN</span><span className="cover-bottom">VALLE<span>NOFY</span> · SELECCIÓN VALLENATA</span></>}
    </div>
  )
}

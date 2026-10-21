import { useId } from 'react'

export function BrandMark({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="44" height="44" rx="15" fill="#ff6249" />
      <path d="m12 15 5 20h14l5-20h-7l-5 13-5-13Z" fill="#fff9ec" />
      <circle cx="36" cy="11" r="4" fill="#ffe45c" />
    </svg>
  )
}

function Accordion({ x = 0, y = 0, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M23 14C-6-13-14 8 8 50m176-35c29-35 45-7 20 29" fill="none" stroke="#172b35" strokeWidth="7" />
      <path d="m44 12 108-16 5 122-108-10Z" fill="#172b35" stroke="#fff5d8" strokeWidth="3" />
      {Array.from({ length: 11 }, (_, i) => <path key={i} d={`m${49 + i * 10} ${12 - i * 1.5} 4 ${94 + i * 2}`} stroke={i % 2 ? '#ffe45c' : '#fff5d8'} strokeWidth="4" />)}
      <path d="m5 13 38-6 7 107-38 6Z" fill="#ff6249" stroke="#172b35" strokeWidth="4" strokeLinejoin="round" />
      <path d="m153-6 41 9 6 107-42 13Z" fill="#fff9ec" stroke="#172b35" strokeWidth="4" strokeLinejoin="round" />
      {Array.from({ length: 7 }, (_, i) => <g key={i} transform={`translate(0 ${i * 14})`}><path d="m156 6 38 7" stroke="#172b35" strokeWidth="2" /><path d="m157 10 23 4v7l-23-4Z" fill="#172b35" /></g>)}
      {Array.from({ length: 6 }, (_, i) => <g key={i} fill="#fff9ec"><circle cx="17" cy={26 + i * 14} r="3" /><circle cx="31" cy={29 + i * 14} r="3" /></g>)}
    </g>
  )
}

function Star({ x, y, size = 20, color = '#ffe45c' }) {
  return <path transform={`translate(${x} ${y}) scale(${size / 20})`} d="m0-20 5 13 13-7-7 13 13 5-13 5 7 13-13-7-5 13-5-13-13 7 7-13-13-5 13-5-7-13 13 7Z" fill={color} />
}

export function CoastalArt({ className = '', compact = false }) {
  return (
    <svg className={`coastal-art ${className}`} viewBox="0 0 480 400" fill="none" aria-hidden="true">
      <path d="M43 270c17-110 31-164 124-182 93-19 168-32 218 30 50 61 50 155-20 205-70 49-145 29-222 26-77-2-111-8-100-79Z" fill="#f9b7cc" />
      <path d="M423 299q-18-76-4-134" stroke="#62c5ad" strokeWidth="8" /><path d="M419 169q-36-35-58-12 34-2 58 12m0 0q-14-48-39-40 24 18 39 40m0 0q17-43 36-27-23 10-36 27m0 0q43-26 55 1-33-5-55-1m0 0q38 4 41 34-19-21-41-34" fill="#62c5ad" />
      <g transform="rotate(-12 230 205)">
        <rect x="75" y="47" width="300" height="300" rx="22" fill="#087f83" stroke="#172b35" strokeWidth="3" />
        <path d="M77 99h296M77 294h296" stroke="#62c8ba" strokeWidth="2" />
        <g className="hero-vinyl">
        <circle cx="226" cy="199" r="123" fill="#172b35" />
        {[111, 101, 91, 81].map((r) => <circle key={r} cx="226" cy="199" r={r} stroke="#43525b" strokeWidth="1.5" />)}
        <circle cx="226" cy="199" r="69" fill="#ffe45c" />
        <path d="m154 100 23 39m79 122 35 63" stroke="#fff9ec" strokeWidth="18" opacity=".1" />
        <g transform="rotate(-8 225 200)"><Accordion x={169} y={167} scale={0.58} /></g>
        </g>
        <path d="M97 68h45m-45 12h22m183 236h51m-25 11h25" stroke="#fff9ec" strokeWidth="3" strokeLinecap="round" />
      </g>
      <Star x={384} y={88} size={48} />
      <Star x={60} y={301} size={25} color="#fff9ec" />
      <Star x={412} y={296} size={13} color="#172b35" />
      <g transform="rotate(10 365 323)"><rect x="273" y="298" width="175" height="47" rx="23" fill="#fff9ec" stroke="#172b35" strokeWidth="2" /><text x="360" y="328" fill="#172b35" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="15" fontWeight="800">HECHO PA’ CANTAR</text></g>
      {!compact && <><path d="M34 126V83l28-6v35" stroke="#172b35" strokeWidth="4" strokeLinecap="round" /><ellipse cx="26" cy="129" rx="10" ry="7" fill="#172b35" /><ellipse cx="54" cy="115" rx="10" ry="7" fill="#172b35" /><path d="m403 182 15 4m-14 12 18 12m-26 1 8 13" stroke="#172b35" strokeWidth="4" strokeLinecap="round" /></>}
    </svg>
  )
}

const palettes = [
  ['#087f83', '#ffe45c', '#134951'],
  ['#f55d45', '#ffe998', '#8b3334'],
  ['#7770c7', '#ffd976', '#3f3a77'],
  ['#f4b63d', '#fff2bd', '#7c4b2f'],
  ['#397eb8', '#fbbbd0', '#193e65'],
  ['#c94c80', '#ffe45c', '#642947'],
]

export function SongArt({ song, large = false, className = '' }) {
  const id = useId().replace(/:/g, '')
  const hash = [...String(song.id ?? song.title)].reduce((value, letter) => value + letter.charCodeAt(0), 0)
  const [base, sun, dark] = palettes[hash % palettes.length]
  return (
    <div className={`song-art ${large ? 'song-art-large' : ''} ${className}`} style={{ '--art-color': base }} aria-hidden="true">
      <svg viewBox="0 0 400 440" fill="none" preserveAspectRatio="xMidYMid slice">
        <defs><pattern id={`${id}-dots`} width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#fff9ec" opacity=".16" /></pattern></defs>
        <path fill={base} d="M0 0h400v440H0z" />
        <path fill={`url(#${id}-dots)`} d="M0 0h400v440H0z" />
        <circle cx="202" cy="181" r="121" fill={sun} />
        <circle cx="202" cy="181" r="141" stroke={sun} opacity=".4" />
        <path d="m-30 306 85-95 70 56 67-64 87 94 50-58 100 82v139H-30Z" fill={dark} />
        <path d="M-20 352c115-83 171 27 267-9s124-2 173 23v96H-20Z" fill="#172b35" opacity=".6" />
        <g transform="rotate(-13 200 204)"><Accordion x={95} y={146} scale={1.05} /></g>
        <Star x={62} y={114} size={15} color="#fff9ec" />
        <Star x={337} y={208} size={20} color={sun} />
        <path d="m310 82 6-16m8 27 16-5M58 236l-16 5m23 8-10 14" stroke="#fff9ec" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  )
}

'use client'

interface BracketTeam {
  id: string
  name: string
  sport: { name: string; color: string }
}

interface Bracket {
  id: string
  tournamentId: string
  round: number
  matchNumber: number
  team1Id: string | null
  team2Id: string | null
  winnerId: string | null
  team1: BracketTeam | null
  team2: BracketTeam | null
  winner: BracketTeam | null
}

interface SingleEliminationBracketProps {
  brackets: Bracket[]
  onMatchClick: (bracket: Bracket) => void
}

const MATCH_W = 200
const MATCH_H = 56
const GAP_X = 80
const GAP_Y = 16
const PADDING = 24
const TEAM_ROW_H = MATCH_H / 2

export default function SingleEliminationBracket({ brackets, onMatchClick }: SingleEliminationBracketProps) {
  if (brackets.length === 0) return null

  const maxRound = Math.max(...brackets.map((b) => b.round))
  const round1Count = brackets.filter((b) => b.round === 1).length

  // Calculate positions for each match
  const getMatchPosition = (round: number, matchNumber: number) => {
    const x = PADDING + (round - 1) * (MATCH_W + GAP_X)
    const matchesInRound = round1Count / Math.pow(2, round - 1)
    const totalHeightR1 = round1Count * (MATCH_H + GAP_Y) - GAP_Y
    const spacing = totalHeightR1 / matchesInRound
    const y = PADDING + (matchNumber - 1) * spacing + (spacing - MATCH_H) / 2
    return { x, y }
  }

  const svgWidth = PADDING * 2 + maxRound * (MATCH_W + GAP_X) - GAP_X
  const svgHeight = PADDING * 2 + round1Count * (MATCH_H + GAP_Y) - GAP_Y

  // Group brackets by round
  const roundMap: Record<number, Bracket[]> = {}
  for (const b of brackets) {
    if (!roundMap[b.round]) roundMap[b.round] = []
    roundMap[b.round].push(b)
  }

  const roundLabel = (round: number) => {
    if (round === maxRound) return 'Final'
    if (round === maxRound - 1 && maxRound > 2) return 'Semifinals'
    if (round === maxRound - 2 && maxRound > 3) return 'Quarterfinals'
    return `Round ${round}`
  }

  return (
    <>
    {/* Mobile: vertical match list by round */}
    <div className="sm:hidden space-y-4">
      {Array.from({ length: maxRound }, (_, i) => i + 1).map((round) => (
        <div key={round}>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{roundLabel(round)}</h4>
          <div className="space-y-2">
            {(roundMap[round] || []).map((match) => {
              const hasTeams = match.team1Id || match.team2Id
              return (
                <div
                  key={match.id}
                  className={`ui-glass p-3 rounded-xl ${hasTeams ? 'cursor-pointer active:scale-[0.97]' : ''}`}
                  onClick={() => hasTeams && onMatchClick(match)}
                >
                  <div className={`flex items-center justify-between py-1 ${match.winnerId === match.team1Id ? 'font-semibold text-green-700' : 'text-slate-700'}`}>
                    <span className="text-sm">{match.team1?.name || 'TBD'}</span>
                    {match.winnerId === match.team1Id && <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium">W</span>}
                  </div>
                  <div className="h-px bg-slate-100 my-1" />
                  <div className={`flex items-center justify-between py-1 ${match.winnerId === match.team2Id ? 'font-semibold text-green-700' : 'text-slate-700'}`}>
                    <span className="text-sm">{match.team2?.name || 'TBD'}</span>
                    {match.winnerId === match.team2Id && <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium">W</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>

    {/* Desktop: SVG bracket */}
    <div className="overflow-x-auto -mx-4 px-4 hidden sm:block">
      <svg
        width={svgWidth}
        height={svgHeight + 32}
        viewBox={`0 0 ${svgWidth} ${svgHeight + 32}`}
        className="select-none"
      >
        {/* Round labels */}
        {Array.from({ length: maxRound }, (_, i) => i + 1).map((round) => (
          <text
            key={`label-${round}`}
            x={PADDING + (round - 1) * (MATCH_W + GAP_X) + MATCH_W / 2}
            y={14}
            textAnchor="middle"
            className="fill-slate-400 text-[11px] font-medium"
          >
            {roundLabel(round)}
          </text>
        ))}

        <g transform="translate(0, 24)">
          {/* Connector lines */}
          {brackets
            .filter((b) => b.round > 1)
            .map((match) => {
              const pos = getMatchPosition(match.round, match.matchNumber)
              // Two feeder matches from previous round
              const feeder1Num = (match.matchNumber - 1) * 2 + 1
              const feeder2Num = (match.matchNumber - 1) * 2 + 2
              const feeder1 = roundMap[match.round - 1]?.find((b) => b.matchNumber === feeder1Num)
              const feeder2 = roundMap[match.round - 1]?.find((b) => b.matchNumber === feeder2Num)

              const lines: JSX.Element[] = []

              if (feeder1) {
                const f1Pos = getMatchPosition(feeder1.round, feeder1.matchNumber)
                const startX = f1Pos.x + MATCH_W
                const startY = f1Pos.y + MATCH_H / 2
                const midX = startX + GAP_X / 2
                const endX = pos.x
                const endY = pos.y + TEAM_ROW_H / 2

                lines.push(
                  <path
                    key={`line-${match.id}-1`}
                    d={`M${startX},${startY} H${midX} V${endY} H${endX}`}
                    fill="none"
                    stroke="#d1d5db"
                    strokeWidth={1.5}
                  />,
                )
              }

              if (feeder2) {
                const f2Pos = getMatchPosition(feeder2.round, feeder2.matchNumber)
                const startX = f2Pos.x + MATCH_W
                const startY = f2Pos.y + MATCH_H / 2
                const midX = startX + GAP_X / 2
                const endX = pos.x
                const endY = pos.y + MATCH_H - TEAM_ROW_H / 2

                lines.push(
                  <path
                    key={`line-${match.id}-2`}
                    d={`M${startX},${startY} H${midX} V${endY} H${endX}`}
                    fill="none"
                    stroke="#d1d5db"
                    strokeWidth={1.5}
                  />,
                )
              }

              return lines
            })}

          {/* Match boxes */}
          {brackets.map((match) => {
            const pos = getMatchPosition(match.round, match.matchNumber)
            const t1IsWinner = match.winnerId && match.winnerId === match.team1Id
            const t2IsWinner = match.winnerId && match.winnerId === match.team2Id
            const hasTeams = match.team1Id || match.team2Id

            return (
              <g
                key={match.id}
                onClick={() => hasTeams && onMatchClick(match)}
                className={hasTeams ? 'cursor-pointer' : ''}
              >
                {/* Match container */}
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={MATCH_W}
                  height={MATCH_H}
                  rx={6}
                  fill="white"
                  stroke={match.winnerId ? '#d1fae5' : '#e5e7eb'}
                  strokeWidth={1.5}
                  className={hasTeams ? 'hover:stroke-slate-400 transition-colors' : ''}
                />

                {/* Divider */}
                <line
                  x1={pos.x}
                  y1={pos.y + TEAM_ROW_H}
                  x2={pos.x + MATCH_W}
                  y2={pos.y + TEAM_ROW_H}
                  stroke="#f3f4f6"
                  strokeWidth={1}
                />

                {/* Team 1 row */}
                {t1IsWinner && (
                  <rect
                    x={pos.x + 1}
                    y={pos.y + 1}
                    width={MATCH_W - 2}
                    height={TEAM_ROW_H - 1}
                    rx={5}
                    fill="#f0fdf4"
                  />
                )}
                <text
                  x={pos.x + 10}
                  y={pos.y + TEAM_ROW_H / 2 + 1}
                  dominantBaseline="middle"
                  className={`text-[12px] ${t1IsWinner ? 'fill-green-700 font-semibold' : 'fill-slate-700'}`}
                >
                  {match.team1?.name || (match.team1Id ? 'Team' : 'TBD')}
                </text>
                {t1IsWinner && (
                  <text
                    x={pos.x + MATCH_W - 10}
                    y={pos.y + TEAM_ROW_H / 2 + 1}
                    dominantBaseline="middle"
                    textAnchor="end"
                    className="text-[10px] fill-green-600 font-medium"
                  >
                    W
                  </text>
                )}

                {/* Team 2 row */}
                {t2IsWinner && (
                  <rect
                    x={pos.x + 1}
                    y={pos.y + TEAM_ROW_H}
                    width={MATCH_W - 2}
                    height={TEAM_ROW_H - 1}
                    rx={0}
                    fill="#f0fdf4"
                  />
                )}
                <text
                  x={pos.x + 10}
                  y={pos.y + TEAM_ROW_H + TEAM_ROW_H / 2 + 1}
                  dominantBaseline="middle"
                  className={`text-[12px] ${t2IsWinner ? 'fill-green-700 font-semibold' : 'fill-slate-700'}`}
                >
                  {match.team2?.name || (match.team2Id ? 'Team' : 'TBD')}
                </text>
                {t2IsWinner && (
                  <text
                    x={pos.x + MATCH_W - 10}
                    y={pos.y + TEAM_ROW_H + TEAM_ROW_H / 2 + 1}
                    dominantBaseline="middle"
                    textAnchor="end"
                    className="text-[10px] fill-green-600 font-medium"
                  >
                    W
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>
    </div>
    </>
  )
}

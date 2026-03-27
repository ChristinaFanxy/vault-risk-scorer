type Grade = 'A' | 'B' | 'C' | 'D' | 'F'

const GRADE_COLORS: Record<Grade, string> = {
  A: 'text-green-400 border-green-400',
  B: 'text-lime-400 border-lime-400',
  C: 'text-yellow-400 border-yellow-400',
  D: 'text-orange-400 border-orange-400',
  F: 'text-red-500 border-red-500',
}

interface Props {
  grade: Grade
  score: number
  label: string
  size?: 'sm' | 'lg'
}

export function RiskGrade({ grade, score, label, size = 'lg' }: Props) {
  const colors = GRADE_COLORS[grade]
  return (
    <div className={`flex flex-col items-center border-2 rounded-xl p-3 ${colors}`}>
      <span className={size === 'lg' ? 'text-5xl font-bold' : 'text-2xl font-bold'}>{grade}</span>
      <span className="text-sm opacity-80">Risk Score: {score}/100</span>
      <span className="text-xs mt-1 font-medium">{label}</span>
    </div>
  )
}

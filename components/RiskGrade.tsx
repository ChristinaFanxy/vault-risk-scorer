type Grade = 'A' | 'B' | 'C' | 'D' | 'F'

const GRADE_COLORS: Record<Grade, string> = {
  A: 'text-green-800 border-green-700 bg-green-50',
  B: 'text-lime-800 border-lime-700 bg-lime-50',
  C: 'text-yellow-800 border-yellow-700 bg-yellow-50',
  D: 'text-orange-800 border-orange-600 bg-orange-50',
  F: 'text-red-700 border-red-600 bg-red-50',
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
    <div className={`flex flex-col items-center border-2 rounded-xl px-4 py-3 ${colors}`}>
      <span className={size === 'lg' ? 'text-4xl font-bold' : 'text-2xl font-bold'}>{grade}</span>
      <span className="text-sm font-medium mt-1">Score: {score}/100</span>
      <span className="text-sm mt-0.5">{label}</span>
    </div>
  )
}

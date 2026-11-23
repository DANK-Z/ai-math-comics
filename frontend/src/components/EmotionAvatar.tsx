import type { Emotion } from '../api'
import { characterFor } from '../characters'
import { PifikSprite } from './PifikSprite'
import { SheetCrop } from './SheetCrop'

const mouth: Record<Exclude<Emotion, 'neutral'>, string> = {
  happy: 'M18 29 Q24 36 30 29',
  confused: 'M19 32 Q24 28 29 31',
  scared: 'M20 31 Q24 27 28 31 Q24 36 20 31',
  surprised: 'M21 31 A3 4 0 1 0 27 31 A3 4 0 1 0 21 31',
  angry: 'M18 32 Q24 27 30 32',
}

export function Expression({ emotion, className = '' }: {
  emotion: Exclude<Emotion, 'neutral'>; className?: string
}) {
  const wide = emotion === 'scared' || emotion === 'surprised'
  return (
    <svg className={className} aria-hidden="true" viewBox="0 0 48 48">
      {emotion === 'happy' ? (
        <path d="M14 24 Q17 18 20 24 M28 24 Q31 18 34 24" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      ) : (
        <g fill="currentColor">
          <ellipse cx="17" cy="23" rx={wide ? 3.1 : 2.5} ry={wide ? 4 : 2.8} />
          <ellipse cx="31" cy="23" rx={wide ? 3.1 : 2.5} ry={wide ? 4 : 2.8} />
        </g>
      )}
      {emotion === 'angry' && <path d="M13 17 L20 20 M28 20 L35 17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />}
      {emotion === 'confused' && <path d="M13 17 Q16 13 20 16 M28 17 H35" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />}
      <path d={mouth[emotion]} stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export function EmotionAvatar({ speaker, emotion = 'neutral', className = '' }: {
  speaker: string; emotion?: Emotion; className?: string
}) {
  const character = characterFor(speaker)
  const frame = `relative aspect-square shrink-0 overflow-hidden rounded-full border-2 border-ink ${className}`
  if (!character) return null
  if (character.id === 'pifik') return (
    <PifikSprite className={frame} expression={emotion !== 'neutral' && (
      <div className="absolute top-[37%] left-[21%] w-[58%] rounded-xl bg-[#142846] text-cyan-300" data-emotion={emotion}>
        <Expression emotion={emotion} className="-my-[12%] w-full" />
      </div>
    )} />
  )
  if (emotion === 'neutral') return <SheetCrop rect={character.portrait} className={frame} />

  const aruna = character.id === 'aruna'
  return (
    <div aria-hidden="true" className={`${frame} ${aruna ? 'bg-fuchsia-100' : 'bg-sky-100'}`} data-emotion={emotion}>
      <svg viewBox="0 0 48 48" className="absolute inset-0 size-full">
        <path d="M4 48 Q8 36 24 36 T44 48" fill={aruna ? '#9352c4' : '#2742a4'} />
        {aruna && <path d="M8 22 C6 4 42 2 41 20 L43 41 L34 37 L14 41 L6 37 Z" fill="#342035" />}
        <ellipse cx="24" cy="23" rx="14" ry="16" fill={aruna ? '#edb88c' : '#dba477'} />
        <path d={aruna ? 'M9 22 Q8 6 23 6 Q39 5 39 23 Q26 16 22 10 Q18 17 9 22' : 'M9 22 Q6 5 22 5 Q39 1 39 22 L34 15 Q25 18 21 12 Q15 18 9 22'} fill="#2e2435" />
      </svg>
      <Expression emotion={emotion} className="absolute inset-0 size-full text-[#33202f]" />
    </div>
  )
}

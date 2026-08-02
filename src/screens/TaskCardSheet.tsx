// Карточка задачи — плитка, развёрнутая на весь экран.
// Фон и цвет текста берутся у состояния плитки, поэтому все приглушённые
// плашки (разделители, чипы, второстепенные кнопки) на живой карточке —
// это color-mix от цвета текста, а не отдельный токен.

import { useEffect, useRef, useState } from 'react'
import { db } from '../data/db'
import { useLive } from '../data/hooks'
import type { TagRow, TaskRow, TaskTemplateRow } from '../data/contract'
import { completeTask, moveTaskToDay, reopenTask, softDeleteTask } from '../data/repo'
import { describeRule, editThisAndFollowing, templateRule } from '../data/templates'
import { addDays } from '../domain/date'
import { daysHanging, taskState } from '../domain/state'
import { effectiveUrgency } from '../domain/urgency'
import type { DateStr, Importance, Urgency } from '../domain/types'
import { tileFill, tileTextColor } from '../ui/Tile'
import { dateLong, dueLabel, hangingLabel, plural } from '../ui/format'
import { CategoryIcon, IconClose, IconRepeatRing } from '../ui/icons'

const IMPORTANCE_LABELS: Record<Importance, string> = {
  1: 'мелочь',
  2: 'обычная',
  3: 'важная',
  4: 'ключевая',
}

const URGENCY_LABELS: Record<Urgency, string> = {
  1: 'когда-нибудь',
  2: 'на неделе',
  3: 'скоро',
  4: 'горит',
}

/** «за 15 минут», «за час», «за день» — из минут remind_before. */
function remindLabel(minutes: number): string {
  if (minutes % 1440 === 0 && minutes >= 1440) {
    const d = minutes / 1440
    return d === 1 ? 'за день' : `за ${d} ${plural(d, 'день', 'дня', 'дней')}`
  }
  if (minutes % 60 === 0 && minutes >= 60) {
    const h = minutes / 60
    return h === 1 ? 'за час' : `за ${h} ${plural(h, 'час', 'часа', 'часов')}`
  }
  return `за ${minutes} ${plural(minutes, 'минуту', 'минуты', 'минут')}`
}

type ParamRow = { label: string; value: string; mono?: boolean }

/** «повторяется · каждую неделю по вт, пт» — с прочтением правила из шаблона. */
function repeatValue(template: TaskTemplateRow | undefined): string {
  if (!template) return 'повторяется'
  const text = describeRule(templateRule(template))
  return `повторяется · ${text.charAt(0).toLowerCase()}${text.slice(1)}`
}

function paramRows(
  task: TaskRow,
  categoryName: string | null,
  repeatText: string | null,
  today: DateStr,
): ParamRow[] {
  const rows: ParamRow[] = []
  if (task.due_on) {
    rows.push({ label: 'Срок', value: dueLabel(task.due_on, task.due_time, today), mono: true })
  }
  rows.push({
    label: 'План',
    value: task.scheduled_on ? dateLong(task.scheduled_on) : 'без дня',
    mono: true,
  })
  rows.push({ label: 'Важность', value: IMPORTANCE_LABELS[task.importance] })
  rows.push({ label: 'Срочность', value: URGENCY_LABELS[effectiveUrgency(task, today)] })
  if (categoryName) rows.push({ label: 'Категория', value: categoryName.toLowerCase() })
  if (repeatText) rows.push({ label: 'Повтор', value: repeatText })
  if (task.remind_before.length > 0) {
    rows.push({ label: 'Напомнить', value: task.remind_before.map(remindLabel).join(', ') })
  }
  return rows
}

export function TaskCardSheet({
  taskId,
  onClose,
  today,
  embedded = false,
}: {
  taskId: string
  onClose: () => void
  today: DateStr
  /** Правая панель раскладки мака: обычный блок на всю высоту вместо fixed. */
  embedded?: boolean
}) {
  const task = useLive(() => db.tasks.get(taskId), [taskId])
  const catId = task?.category_id ?? null
  const category = useLive(
    () => (catId ? db.categories.get(catId) : Promise.resolve(undefined)),
    [catId],
  )
  const templateId = task?.template_id ?? null
  const template = useLive(
    () => (templateId ? db.task_templates.get(templateId) : Promise.resolve(undefined)),
    [templateId],
  )
  const tags = useLive(async () => {
    const links = await db.task_tags.where('task_id').equals(taskId).toArray()
    if (links.length === 0) return [] as TagRow[]
    const rows = await db.tags.bulkGet(links.map((l) => l.tag_id))
    return rows.filter((t): t is TagRow => t !== undefined).sort((a, b) => (a.name < b.name ? -1 : 1))
  }, [taskId])

  // Двухшаговое удаление: первый тап взводит кнопку на 3 секунды.
  const [deleteArmed, setDeleteArmed] = useState(false)
  const deleteTimer = useRef<number | null>(null)
  // Для шаблонной задачи перенос спрашивает «только эту / эту и все следующие»;
  // здесь лежит целевой день отложенного переноса.
  const [pendingMove, setPendingMove] = useState<DateStr | null>(null)
  useEffect(
    () => () => {
      if (deleteTimer.current !== null) clearTimeout(deleteTimer.current)
    },
    [],
  )

  if (!task) return null

  const st = taskState(task, today)
  const urg = effectiveUrgency(task, today)
  const fill = tileFill({ state: st, urgency: urg })
  const color = tileTextColor({ state: st, urgency: urg })
  const live = st === 'live'
  const hanging = daysHanging(task, today)

  // На живой карточке приглушённые плашки — 20% цвета текста поверх заливки
  // на серой/выполненной — обычные поверхности.
  const mix20 = `color-mix(in srgb, ${color} 20%, transparent)`
  const rowBorder = live ? `1px solid ${mix20}` : '1px solid var(--line)'
  const chipBg = live ? mix20 : 'var(--surface2)'
  const primaryBg = live ? color : 'var(--text)'
  const primaryText = live ? fill : 'var(--bg)'
  const secondaryBg = live ? mix20 : 'var(--surface2)'
  const secondaryText = live ? color : 'var(--text)'

  const run = (action: () => Promise<void>) => () => {
    void action().then(onClose)
  }

  const onDelete = () => {
    if (!deleteArmed) {
      setDeleteArmed(true)
      deleteTimer.current = window.setTimeout(() => setDeleteArmed(false), 3000)
      return
    }
    if (deleteTimer.current !== null) clearTimeout(deleteTimer.current)
    void softDeleteTask(taskId).then(onClose)
  }

  const rows = paramRows(task, category?.name ?? null, task.template_id ? repeatValue(template) : null, today)

  // Перенос шаблонной задачи не выполняется сразу — сначала выбор «только эту /
  // эту и все следующие». Выполнение при этом всегда трогает только экземпляр.
  const moveOrAsk = (day: DateStr) => () => {
    if (task.template_id) setPendingMove(day)
    else void moveTaskToDay(taskId, day, today).then(onClose)
  }

  const moveOnlyThis = () => {
    const day = pendingMove
    if (day === null) return
    setPendingMove(null)
    void moveTaskToDay(taskId, day, today).then(onClose)
  }

  // «Эту и все следующие»: перенос расписания — шаблон с теми же полями,
  // но серия стартует с нового дня.
  const moveFollowing = () => {
    const day = pendingMove
    if (day === null || !template) return
    setPendingMove(null)
    void editThisAndFollowing(
      taskId,
      {
        title: template.title,
        note: template.note,
        importance: template.importance,
        urgency_manual: template.urgency_manual,
        category_id: template.category_id,
        due_time: template.due_time,
        remind_before: template.remind_before,
        rule: { ...templateRule(template), starts_on: day },
      },
      today,
    ).then(onClose)
  }

  const secondaries: { label: string; onClick: () => void }[] =
    st === 'live'
      ? [
          { label: 'Перенести на завтра', onClick: moveOrAsk(addDays(today, 1)) },
          { label: 'Убрать в инбокс', onClick: run(() => moveTaskToDay(taskId, null, today)) },
        ]
      : st === 'done'
        ? []
        : [{ label: 'Выполнено', onClick: run(() => completeTask(taskId, today)) }]

  const primary =
    st === 'live'
      ? { label: 'Выполнено', onClick: run(() => completeTask(taskId, today)) }
      : st === 'done'
        ? { label: 'Вернуть в работу', onClick: run(() => reopenTask(taskId)) }
        : { label: 'Перенести на сегодня', onClick: moveOrAsk(today) }

  return (
    <div
      className={embedded ? 'flex h-full flex-col' : 'fixed inset-0 z-50 flex flex-col'}
      style={{
        background: fill,
        color,
        border: st === 'expired' ? '1px solid var(--expired-outline)' : undefined,
        paddingTop: embedded ? undefined : 'env(safe-area-inset-top)',
      }}
    >
      <div className="flex shrink-0 items-start justify-between px-4 pt-2.5">
        <button
          type="button"
          aria-label="Закрыть"
          onClick={onClose}
          className="-ml-[7px] -mt-[7px] flex h-[34px] w-[34px] items-center justify-center"
        >
          <IconClose size={20} />
        </button>
        {st !== 'done' && (
          <span className="mt-[7px] flex gap-[3px]">
            {Array.from({ length: urg }, (_, i) => (
              <span
                key={i}
                className="h-[5px] w-[5px]"
                style={{ background: live ? color : `var(--u${urg})` }}
              />
            ))}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 pt-6">
          <span className="flex items-center gap-2" style={{ opacity: 0.85 }}>
            {category && <CategoryIcon icon={category.icon} size={22} />}
            {task.template_id && <IconRepeatRing size={14} style={{ opacity: 0.9 }} />}
          </span>
          <h1 className="mt-3.5 font-tile text-32 font-semibold" style={{ lineHeight: 1.1 }}>
            {task.title}
          </h1>
          {(st === 'slipped' || st === 'expired') && hanging > 0 && (
            <div className="mt-2.5 font-mono text-15">{hangingLabel(hanging)}</div>
          )}
        </div>

        <div className="flex flex-col px-4 pt-6">
          {rows.map((row, i) => (
            <div
              key={row.label}
              className="flex justify-between py-2.5"
              style={i < rows.length - 1 ? { borderBottom: rowBorder } : undefined}
            >
              <span className="text-13" style={{ opacity: 0.72 }}>
                {row.label}
              </span>
              <span className={row.mono ? 'font-mono text-13' : 'text-13'}>{row.value}</span>
            </div>
          ))}
        </div>

        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1 px-4 pt-3">
            {tags.map((t) => (
              <span
                key={t.id}
                className="flex h-[30px] items-center rounded-tile px-2.5 font-mono text-11"
                style={{ background: chipBg }}
              >
                #{t.name}
              </span>
            ))}
          </div>
        )}

        {task.note && (
          <div className="px-4 pt-4">
            <div className="text-13" style={{ opacity: 0.88, lineHeight: 1.55 }}>
              {task.note}
            </div>
          </div>
        )}

        <div className="px-4 pb-6 pt-5">
          <div className="mb-2 text-11" style={{ opacity: 0.6 }}>
            История
          </div>
          <div className="flex flex-col gap-[5px] font-mono text-11" style={{ opacity: 0.78 }}>
            <span>создана {dateLong(task.created_at.slice(0, 10))}</span>
            {task.completed_at && <span>выполнена {dateLong(task.completed_at.slice(0, 10))}</span>}
          </div>
        </div>
      </div>

      <div
        className="flex shrink-0 flex-col gap-1 px-4 pt-3"
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={primary.onClick}
          className="flex h-12 w-full items-center justify-center rounded-tile text-15 font-medium"
          style={{ background: primaryBg, color: primaryText }}
        >
          {primary.label}
        </button>
        {secondaries.map((b) => (
          <button
            key={b.label}
            type="button"
            onClick={b.onClick}
            className="flex h-11 w-full items-center justify-center rounded-tile text-15 font-medium"
            style={{ background: secondaryBg, color: secondaryText }}
          >
            {b.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onDelete}
          className="flex h-11 w-full items-center justify-center rounded-tile text-15 font-medium"
          style={{ background: secondaryBg, color: secondaryText }}
        >
          {deleteArmed ? 'Точно удалить' : 'Удалить'}
        </button>
      </div>

      {pendingMove !== null && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-6"
          style={{ background: 'var(--scrim)' }}
          onClick={() => setPendingMove(null)}
        >
          <div
            className="w-full max-w-[320px] rounded-tile bg-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-15 font-medium text-text">Повторяющаяся задача</div>
            <div className="mt-1 text-13 text-text-muted">
              Перенести только этот повтор или всю серию начиная с него?
            </div>
            <div className="mt-3 flex flex-col gap-1">
              <button
                type="button"
                onClick={moveOnlyThis}
                className="h-11 w-full rounded-tile text-15 font-medium"
                style={{ background: 'var(--text)', color: 'var(--bg)' }}
              >
                Только эту
              </button>
              <button
                type="button"
                disabled={!template}
                onClick={moveFollowing}
                className="h-11 w-full rounded-tile bg-surface2 text-15 font-medium text-text"
              >
                Эту и все следующие
              </button>
              <button
                type="button"
                onClick={() => setPendingMove(null)}
                className="h-11 w-full rounded-tile text-15 text-text-muted"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
